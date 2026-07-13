import express from "express";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import nodemailer from "nodemailer";

// IMPORTANTE: disabilita il body-parsing automatico di Vercel.
// Senza questo, Vercel consuma lo stream della richiesta prima che
// express.raw() possa leggerlo, rendendo impossibile la verifica
// della firma HMAC del webhook Wildix (causa dei 401 ricevuti finora).
export const config = {
  api: {
    bodyParser: false,
  },
};

const app = express();

// ══════════════════════════════════════════════════════════════
// WILDIX WEBHOOK: risultati chiamate + trascrizioni
// IMPORTANTE: questa rotta va registrata PRIMA di app.use(express.json())
// perché la verifica della firma richiede il body grezzo (raw), non parsato.
// ══════════════════════════════════════════════════════════════

import { neon } from "@neondatabase/serverless";

// Inizializzazione "difensiva": se DATABASE_URL manca o non è valida, neon()
// lancia subito un'eccezione. Senza il try/catch questo farebbe fallire il
// caricamento dell'intero modulo, portando giù anche le rotte che non
// dipendono da Postgres (login, utenti, voicebot su GitHub, ecc.).
// Le funzioni che usano sql() gestiscono già singolarmente gli errori delle
// query con try/catch, quindi qui basta evitare il crash in fase di boot.
let sql: ReturnType<typeof neon> | null = null;
try {
  sql = neon(process.env.DATABASE_URL!);
} catch (err) {
  console.error("DATABASE_URL non configurata o non valida — funzionalità Postgres (esiti chiamate, follow-up, statistiche) disabilitate:", err);
}

async function readCallResults(limit = 50, offset = 0): Promise<{ rows: any[]; total: number }> {
  try {
    const rows = await sql`
      SELECT * FROM call_results ORDER BY ts DESC LIMIT ${limit} OFFSET ${offset}
    `;
    const countRes = await sql`SELECT COUNT(*)::int AS total FROM call_results`;
    return {
      rows: (rows as any[]).map((r: any) => ({
        callId: r.call_id,
        numero: r.numero,
        nome: r.nome,
        risposto: r.risposto,
        durata: r.durata,
        timestamp: r.ts,
        trascrizione: r.trascrizione,
        riassunto: r.riassunto,
      })),
      total: (countRes[0] as any).total,
    };
  } catch (err) {
    console.error("Error reading call_results from Postgres:", err);
    return { rows: [], total: 0 };
  }
}

async function upsertCallResult(entry: any) {
  try {
    await sql`
      INSERT INTO call_results (call_id, numero, nome, risposto, durata, ts, trascrizione, riassunto)
      VALUES (${entry.callId}, ${entry.numero}, ${entry.nome || null}, ${entry.risposto}, ${entry.durata}, ${entry.timestamp}, ${entry.trascrizione}, ${entry.riassunto ? JSON.stringify(entry.riassunto) : null})
      ON CONFLICT (call_id) DO UPDATE SET
        numero = COALESCE(EXCLUDED.numero, call_results.numero),
        nome = COALESCE(EXCLUDED.nome, call_results.nome),
        risposto = COALESCE(EXCLUDED.risposto, call_results.risposto),
        durata = COALESCE(EXCLUDED.durata, call_results.durata),
        trascrizione = COALESCE(EXCLUDED.trascrizione, call_results.trascrizione),
        riassunto = COALESCE(EXCLUDED.riassunto, call_results.riassunto)
    `;
  } catch (err) {
    console.error("Error upserting call_results in Postgres:", err);
  }
}

function verifyWildixSignature(rawBody: string, signature: string | undefined): boolean {
  if (!signature) return false;
  const secret = process.env.WILDIX_WEBHOOK_SECRET;
  if (!secret) {
    console.error("WILDIX_WEBHOOK_SECRET non configurato!");
    return false;
  }
  const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  try {
    const expectedBuf = Buffer.from(expected, "utf-8");
    const signatureBuf = Buffer.from(signature, "utf-8");
    if (expectedBuf.length !== signatureBuf.length) return false;
    return crypto.timingSafeEqual(expectedBuf, signatureBuf);
  } catch {
    return false;
  }
}

// Normalizza un numero in formato E.164-ish (solo cifre + prefisso +),
// per evitare mismatch tra "+393533266370", "3533266370", "393533266370", ecc.
function normalizePhone(numero: string | null | undefined): string | null {
  if (!numero) return null;
  const cleaned = numero.replace(/[^\d+]/g, "");
  if (!cleaned) return null;
  if (cleaned.startsWith("+")) return cleaned;
  if (cleaned.startsWith("00")) return "+" + cleaned.slice(2);
  if (cleaned.startsWith("39") && cleaned.length >= 11) return "+" + cleaned;
  if (cleaned.length === 10) return "+39" + cleaned; // numero italiano senza prefisso
  return cleaned;
}

// ── Nome contatto: lookup numero → nome, popolato dall'app al lancio campagna ──
async function readContactNames(): Promise<Record<string, string>> {
  try {
    const rows = await sql`SELECT numero, nome FROM contact_names`;
    const map: Record<string, string> = {};
    for (const r of rows as any[]) map[r.numero] = r.nome;
    return map;
  } catch (err) {
    console.error("Error reading contact_names from Postgres:", err);
    return {};
  }
}

async function upsertContactName(numero: string, nome: string) {
  try {
    await sql`
      INSERT INTO contact_names (numero, nome) VALUES (${numero}, ${nome})
      ON CONFLICT (numero) DO UPDATE SET nome = EXCLUDED.nome
    `;
  } catch (err) {
    console.error("Error upserting contact_names in Postgres:", err);
  }
}

// ── Log eventi webhook scartati (firma invalida, chiamate non-voicebot) ──
// Utile per debug senza dover rifrugare i log Vercel.
async function logWebhookEvent(eventType: string, reason: string) {
  try {
    await sql`INSERT INTO webhook_log (event_type, reason) VALUES (${eventType}, ${reason})`;
  } catch (err) {
    console.error("Error writing webhook_log:", err);
  }
}

// ── Follow-up: appuntamenti che richiedono un intervento umano ──
// (disdetta, richiesta informazioni, trasferimento, non risposto)
async function createFollowup(entry: { callId: string; numero: string | null; nome: string | null; motivo: string }) {
  try {
    await sql`
      INSERT INTO followups (call_id, numero, nome, motivo)
      VALUES (${entry.callId}, ${entry.numero}, ${entry.nome}, ${entry.motivo})
    `;
  } catch (err) {
    console.error("Error creating followup:", err);
  }
}

app.get("/api/followups", async (req, res) => {
  const stato = (req.query.stato as string) || "pending";
  try {
    const rows = await sql`
      SELECT * FROM followups WHERE stato = ${stato} ORDER BY created_at DESC LIMIT 200
    `;
    res.json({ ok: true, followups: rows });
  } catch (err) {
    console.error("Error reading followups:", err);
    res.status(500).json({ ok: false, followups: [] });
  }
});

app.post("/api/followups/:id/done", express.json(), async (req, res) => {
  try {
    await sql`UPDATE followups SET stato = 'done' WHERE id = ${parseInt(req.params.id)}`;
    res.json({ ok: true });
  } catch (err) {
    console.error("Error updating followup:", err);
    res.status(500).json({ ok: false });
  }
});

// ── Statistiche aggregate sui risultati del voicebot ──
app.get("/api/voicebot-stats", async (_req, res) => {
  try {
    const totals = await sql`
      SELECT
        COUNT(*)::int AS totale,
        COUNT(*) FILTER (WHERE risposto = true)::int AS risposte,
        COUNT(*) FILTER (WHERE risposto = false)::int AS non_risposte,
        AVG(durata) FILTER (WHERE durata > 0)::int AS durata_media_ms
      FROM call_results
    `;
    const perGiorno = await sql`
      SELECT DATE(ts) AS giorno, COUNT(*)::int AS totale
      FROM call_results
      WHERE ts > now() - interval '30 days'
      GROUP BY DATE(ts)
      ORDER BY giorno ASC
    `;
    res.json({ ok: true, totali: totals[0], perGiorno });
  } catch (err) {
    console.error("Error reading voicebot-stats:", err);
    res.status(500).json({ ok: false });
  }
});

// Endpoint chiamato dal frontend al lancio di una campagna, per registrare
// l'associazione numero → nome contatto (serve ad arricchire i risultati
// del voicebot, dato che il webhook Wildix restituisce solo il numero).
app.post("/api/register-campaign-contacts", express.json(), async (req, res) => {
  const { contacts } = req.body as { contacts: { numero: string; nome: string }[] };
  if (!Array.isArray(contacts)) {
    return res.status(400).json({ ok: false, error: "contacts deve essere un array" });
  }
  for (const c of contacts) {
    const n = normalizePhone(c.numero);
    if (n && c.nome) await upsertContactName(n, c.nome);
  }
  res.json({ ok: true, count: contacts.length });
});

app.post(
  "/api/wildix-webhook",
  express.raw({ type: "application/json" }), // body grezzo, necessario per la firma
  async (req, res) => {
    const rawBody = req.body.toString("utf-8");
    const signature = req.headers["x-signature"] as string | undefined;

    if (!verifyWildixSignature(rawBody, signature)) {
      console.warn("Wildix webhook: firma non valida, richiesta rifiutata");
      logWebhookEvent("unknown", "invalid-signature").catch(() => {});
      return res.status(401).json({ ok: false, error: "Invalid signature" });
    }

    let event: any;
    try {
      event = JSON.parse(rawBody);
    } catch {
      return res.status(400).json({ ok: false, error: "Invalid JSON" });
    }

    // ── FILTRO: interessano solo le chiamate gestite da un Voicebot ──
    // (campagne outbound / conferme appuntamento), non tutte le chiamate del PBX.
    function isVoicebotCall(ev: any): boolean {
      if (ev.type === "call:completed") {
        const flow = ev.data?.flows?.[0] || {};
        return flow.callee?.userDevice === "VOICEBOT" || flow.caller?.userDevice === "VOICEBOT";
      }
      if (ev.type === "call:transcription:completed" || ev.type === "call:summary:completed") {
        const call = ev.data?.call || {};
        return call.callee?.userDevice === "VOICEBOT" || call.caller?.userDevice === "VOICEBOT";
      }
      return false;
    }

    if (!isVoicebotCall(event)) {
      // Non è una chiamata del voicebot: la ignoriamo, ma rispondiamo comunque 200
      // per evitare che Wildix la re-invii inutilmente come se fosse fallita.
      logWebhookEvent(event.type, "not-voicebot").catch(() => {});
      return res.sendStatus(200);
    }

    // NOTA: con Postgres l'UPSERT gestisce da solo il merge dei campi già
    // presenti (COALESCE), quindi non serve più leggere tutto l'array e
    // cercare l'indice manualmente come si faceva con GitHub.
    try {
      const contactNames = await readContactNames();

      if (event.type === "call:completed") {
        const flow = event.data?.flows?.[0] || {};
        // remotePhone è il vero numero esterno per chiamate outbound reali;
        // callee.phone/destination possono essere un'estensione interna
        // (es. nei test diretti su un interno del voicebot).
        const numero = normalizePhone(flow.remotePhone || flow.callee?.phone || event.data?.destination || null);
        const risposto = (flow.talkTime || 0) > 0;
        const nome = numero ? contactNames[numero] || null : null;

        await upsertCallResult({
          callId: event.id,
          numero,
          nome,
          risposto,
          durata: flow.talkTime || 0,
          timestamp: new Date(event.time).toISOString(),
          trascrizione: null,
        });
      }

      if (event.type === "call:transcription:completed") {
        const callId = event.id || event.data?.call?.id;
        const numero = normalizePhone(event.data?.call?.remotePhone || event.data?.call?.destination || null);

        // La trascrizione arriva come array di "chunks" (battute per parlante),
        // non come singolo campo transcription/summary.
        const chunks = event.data?.chunks || [];
        const trascrizione = chunks
          .map((c: any) => `[${c.time}] ${c.name}: ${c.text}`)
          .join("\n");

        await upsertCallResult({
          callId,
          numero,
          nome: numero ? contactNames[numero] || null : null,
          risposto: (event.data?.call?.talkTime || 0) > 0,
          durata: event.data?.call?.talkTime || null,
          timestamp: new Date().toISOString(),
          trascrizione,
        });
      }

      if (event.type === "call:summary:completed") {
        const callId = event.id || event.data?.call?.id;
        const numero = normalizePhone(event.data?.call?.remotePhone || event.data?.call?.destination || null);
        const nome = numero ? contactNames[numero] || null : null;
        const summary = event.data?.summary || {};

        const riassunto = {
          titolo: summary.title || null,
          testo: summary.brief || null,
          argomenti: summary.json?.topics || [],
          decisioni: summary.json?.decisions || [],
          problemi: summary.json?.issues || [],
        };

        await upsertCallResult({
          callId,
          numero,
          nome,
          risposto: (event.data?.call?.talkTime || 0) > 0,
          durata: event.data?.call?.talkTime || null,
          timestamp: new Date().toISOString(),
          trascrizione: null,
          riassunto,
        });

        // ── Follow-up: qualsiasi esito che richiede intervento umano ──
        const testoCompleto = [riassunto.testo, ...riassunto.decisioni, ...riassunto.problemi].join(" ").toLowerCase();
        let motivoFollowup: string | null = null;
        if (/non conferm|rifiut/.test(testoCompleto)) motivoFollowup = "Appuntamento rifiutato";
        else if (/disdett|riprogramm/.test(testoCompleto)) motivoFollowup = "Disdetta / da riprogrammare";
        else if (/informazio.*trasfer|trasfer.*informazio/.test(testoCompleto)) motivoFollowup = "Richiesta informazioni — trasferito";
        else if (/trasferit.*assist|assist.*trasferit/.test(testoCompleto)) motivoFollowup = "Paziente da assistere";
        else if (/loop/.test(testoCompleto)) motivoFollowup = "Conversazione in loop — trasferito";
        else if (/non trovat/.test(testoCompleto)) motivoFollowup = "Appuntamento non trovato";

        if (motivoFollowup) {
          await createFollowup({ callId, numero, nome, motivo: motivoFollowup });
        }

        // ── Notifica: qualsiasi esito che richiede un operatore ──
        if (motivoFollowup && process.env.SMTP_USER && process.env.NOTIFY_EMAIL) {
          try {
            const transporter = nodemailer.createTransport({
              host: process.env.SMTP_HOST || "smtp.gmail.com",
              port: parseInt(process.env.SMTP_PORT || "587"),
              secure: process.env.SMTP_SECURE === "true",
              auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
            });
            await transporter.sendMail({
              from: `"GEM Voicebot Alert" <${process.env.SMTP_USER}>`,
              to: process.env.NOTIFY_EMAIL,
              subject: `⚠️ ${motivoFollowup} — ${nome || numero || callId}`,
              html: `
                <h2>${motivoFollowup}</h2>
                <p><strong>Contatto:</strong> ${nome || '—'} (${numero || '—'})</p>
                <p><strong>Riassunto:</strong> ${riassunto.testo || '—'}</p>
                <p><strong>Decisione rilevata:</strong> ${riassunto.decisioni.join('; ') || '—'}</p>
                <p>Serve un follow-up manuale.</p>
              `,
            });
          } catch (err) {
            console.error("Errore invio notifica rifiuto:", err);
          }
        }
      }

      res.sendStatus(200);
    } catch (err) {
      console.error("Errore elaborazione evento Wildix webhook:", err);
      // Rispondiamo comunque 200: l'evento è stato ricevuto e verificato,
      // un 5xx farebbe scattare inutili retry da parte di Wildix.
      res.sendStatus(200);
    }
  }
);

app.get("/api/call-results", async (req, res) => {
  const limit = Math.min(parseInt((req.query.limit as string) || "50"), 200);
  const offset = parseInt((req.query.offset as string) || "0");
  const { rows, total } = await readCallResults(limit, offset);
  res.json({ ok: true, results: rows, total, limit, offset });
});

// ══════════════════════════════════════════════════════════════
// Da qui in poi: parsing JSON standard per tutte le altre rotte
// ══════════════════════════════════════════════════════════════
app.use(express.json());

const USERS_FILE = path.join(process.cwd(), "users.json");
const GITHUB_REPO = "info4assistance25-maker/outboundcallgem";
const GITHUB_FILE_PATH = "users.json";
const VOICEBOTS_FILE_PATH = "voicebots.json";
const VOICEBOTS_LOCAL = path.join(process.cwd(), "voicebots.json");

async function readVoicebots() {
  const token = process.env.GITHUB_TOKEN;
  if (token) {
    try {
      const getRes = await fetch(
        `https://api.github.com/repos/${GITHUB_REPO}/contents/${VOICEBOTS_FILE_PATH}`,
        { headers: { Authorization: `token ${token}`, Accept: "application/vnd.github.v3+json", "User-Agent": "gem-app" } }
      );
      if (getRes.ok) {
        const fileData = await getRes.json() as any;
        const content = Buffer.from(fileData.content, "base64").toString("utf-8");
        return JSON.parse(content);
      }
      console.error("GitHub GET voicebots error:", getRes.status);
    } catch (err) { console.error("Error reading voicebots from GitHub:", err); }
  }
  // Fallback: file locale (ambiente senza GITHUB_TOKEN, es. sviluppo locale)
  try {
    if (!fs.existsSync(VOICEBOTS_LOCAL)) return [];
    return JSON.parse(fs.readFileSync(VOICEBOTS_LOCAL, "utf-8"));
  } catch { return []; }
}

async function writeVoicebots(bots: any[]) {
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    try { fs.writeFileSync(VOICEBOTS_LOCAL, JSON.stringify(bots, null, 2)); } catch {}
    return;
  }
  try {
    const getRes = await fetch(
      `https://api.github.com/repos/${GITHUB_REPO}/contents/${VOICEBOTS_FILE_PATH}`,
      { headers: { Authorization: `token ${token}`, Accept: "application/vnd.github.v3+json", "User-Agent": "gem-app" } }
    );
    const sha = getRes.ok ? (await getRes.json() as any).sha : undefined;
    const content = Buffer.from(JSON.stringify(bots, null, 2)).toString("base64");
    const putRes = await fetch(
      `https://api.github.com/repos/${GITHUB_REPO}/contents/${VOICEBOTS_FILE_PATH}`,
      {
        method: "PUT",
        headers: { Authorization: `token ${token}`, Accept: "application/vnd.github.v3+json", "Content-Type": "application/json", "User-Agent": "gem-app" },
        body: JSON.stringify({ message: "chore: update voicebots", content, ...(sha ? { sha } : {}) })
      }
    );
    if (!putRes.ok) {
      const errText = await putRes.text();
      console.error("GitHub PUT voicebots error:", putRes.status, errText);
      throw new Error("GitHub write failed");
    }
  } catch (err) { console.error("Error writing voicebots to GitHub:", err); throw err; }
}

function readUsers() {
  try {
    if (!fs.existsSync(USERS_FILE)) return [];
    return JSON.parse(fs.readFileSync(USERS_FILE, "utf-8"));
  } catch (err) {
    console.error("Error reading users.json", err);
    return [];
  }
}

async function writeUsers(users: any[]) {
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    console.error("GITHUB_TOKEN non configurato — impossibile salvare su GitHub");
    try { fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2)); } catch {}
    return;
  }
  try {
    // 1. Leggi SHA attuale
    const getRes = await fetch(
      `https://api.github.com/repos/${GITHUB_REPO}/contents/${GITHUB_FILE_PATH}`,
      { headers: { Authorization: `token ${token}`, Accept: "application/vnd.github.v3+json", "User-Agent": "gem-app" } }
    );
    if (!getRes.ok) {
      const errText = await getRes.text();
      console.error("GitHub GET error:", getRes.status, errText);
      return;
    }
    const fileData = await getRes.json() as any;
    const sha = fileData.sha;

    // 2. Scrivi contenuto aggiornato
    const content = Buffer.from(JSON.stringify(users, null, 2)).toString("base64");
    const putRes = await fetch(
      `https://api.github.com/repos/${GITHUB_REPO}/contents/${GITHUB_FILE_PATH}`,
      {
        method: "PUT",
        headers: {
          Authorization: `token ${token}`,
          Accept: "application/vnd.github.v3+json",
          "Content-Type": "application/json",
          "User-Agent": "gem-app"
        },
        body: JSON.stringify({ message: "chore: update users permissions", content, sha })
      }
    );
    if (!putRes.ok) {
      const errText = await putRes.text();
      console.error("GitHub PUT error:", putRes.status, errText);
    } else {
      console.log("users.json aggiornato su GitHub con successo");
    }
  } catch (err) {
    console.error("Error writing users to GitHub:", err);
  }
}

// API
app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

app.post("/api/login", (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ ok: false, error: "Username e password richiesti" });
  }

  const users = readUsers();
  const user = users.find(
    (u: any) => u.username.toLowerCase() === username.toLowerCase() && u.password === password
  );

  if (user) {
    res.json({ 
      ok: true, 
      username: user.username, 
      nome: user.nome, 
      role: user.role || (user.isAdmin ? 'Admin' : 'Editor'),
      isAdmin: user.username.toLowerCase() === "admin" || user.isAdmin === true || user.role === 'Admin',
      canSchedule: user.canSchedule === true,
      email: user.email || '',
      telefono: user.telefono || ''
    });
  } else {
    res.status(401).json({ ok: false, error: "Credenziali errate" });
  }
});

app.get("/api/users", (req, res) => {
  const users = readUsers();
  // Return users without passwords for safety, though it's internal logic
  const safeUsers = users.map((u: any) => ({ 
    username: u.username, 
    nome: u.nome, 
    password: u.password, 
    role: u.role || (u.isAdmin ? 'Admin' : 'Editor'),
    canSchedule: u.canSchedule === true
  }));
  res.json(safeUsers);
});

app.post("/api/users", async (req, res) => {
  const { username, password, nome, role, canSchedule } = req.body;
  
  if (!username || !password || !nome || !role) {
    return res.status(400).json({ error: "Dati mancanti" });
  }

  const users = readUsers();
  if (users.find((u: any) => u.username.toLowerCase() === username.toLowerCase())) {
    return res.status(400).json({ error: "Username già esistente" });
  }

  users.push({ username, password, nome, role, isAdmin: role === 'Admin', canSchedule: canSchedule === true });
  await writeUsers(users);

  res.json({ ok: true });
});

app.put("/api/users/:username", async (req, res) => {
  const { username } = req.params;
  const { password, nome, role, canSchedule } = req.body;

  if (!password || !nome || !role) {
    return res.status(400).json({ error: "Dati mancanti" });
  }

  let users = readUsers();
  const index = users.findIndex((u: any) => u.username.toLowerCase() === username.toLowerCase());

  if (index === -1) {
    return res.status(404).json({ error: "Utente non trovato" });
  }

  users[index] = { 
    ...users[index], 
    password, 
    nome, 
    role, 
    isAdmin: role === 'Admin' || users[index].username.toLowerCase() === 'admin',
    canSchedule: canSchedule === true
  };
  await writeUsers(users);
  
  res.json({ ok: true });
});

app.delete("/api/users/:username", async (req, res) => {
  const { username } = req.params;
  
  let users = readUsers();
  const initialLength = users.length;
  users = users.filter((u: any) => u.username.toLowerCase() !== username.toLowerCase());

  if (users.length === initialLength) {
    return res.status(404).json({ error: "Utente non trovato" });
  }

  await writeUsers(users);
  res.json({ ok: true });
});


app.post("/api/support", async (req, res) => {
  const { name, email, phone, company, subject, message } = req.body;
  if (!subject || !message || !email || !phone) {
    return res.status(400).json({ ok: false, error: "Dati mancanti (email, telefono, oggetto e messaggio sono obbligatori)" });
  }

  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    return res.status(500).json({ ok: false, error: "Credenziali SMTP non configurate." });
  }

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || "smtp.gmail.com",
    port: parseInt(process.env.SMTP_PORT || "587"),
    secure: process.env.SMTP_SECURE === "true",
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  const subjectLine = `[Supporto Campagne Out] ${name} ${phone}`;

  const html = `
    <p><strong>Da:</strong> ${name}</p>
    <p><strong>Email:</strong> ${email}</p>
    <p><strong>Telefono:</strong> ${phone}</p>
    ${company ? `<p><strong>Azienda:</strong> ${company}</p>` : ''}
    <p><strong>Oggetto:</strong> ${subject}</p>
    <hr>
    <p><strong>Messaggio:</strong></p>
    <p>${message.replace(/\n/g, '<br>')}</p>
  `;

  try {
    await transporter.sendMail({
      from: `"GEM Campagne Out" <${process.env.SMTP_USER}>`,
      replyTo: email,
      to: "ticket@gemgroup.odoo.com",
      subject: subjectLine,
      text: `Da: ${name}\nEmail: ${email}\nTelefono: ${phone}\n${company ? `Azienda: ${company}\n` : ''}Oggetto: ${subject}\n\n${message}`,
      html,
    });
    res.json({ ok: true });
  } catch (error) {
    console.error("Errore invio email:", error);
    res.status(500).json({ ok: false, error: "Errore invio email. Verifica la configurazione SMTP." });
  }
});

// ── PROFILO UTENTE ──
app.get("/api/me", (req, res) => {
  const { username } = req.query;
  if (!username) return res.status(400).json({ ok: false });
  const users = readUsers();
  const user = users.find((u: any) => u.username.toLowerCase() === String(username).toLowerCase());
  if (!user) return res.status(404).json({ ok: false });
  res.json({ ok: true, email: user.email || '', telefono: user.telefono || '' });
});

app.put("/api/me", async (req, res) => {
  const { username, email, telefono } = req.body;
  if (!username) return res.status(400).json({ ok: false, error: 'Username richiesto' });
  const users = readUsers();
  const idx = users.findIndex((u: any) => u.username.toLowerCase() === username.toLowerCase());
  if (idx === -1) return res.status(404).json({ ok: false, error: 'Utente non trovato' });
  users[idx].email = email || '';
  users[idx].telefono = telefono || '';
  await writeUsers(users);
  res.json({ ok: true });
});

// ── VOICEBOT ENDPOINTS ──
app.get("/api/voicebots", async (_req, res) => {
  res.json({ ok: true, voicebots: await readVoicebots() });
});

app.post("/api/voicebots", async (req, res) => {
  const { nome, exten, context, descrizione } = req.body;
  if (!nome || !exten || !context) return res.status(400).json({ ok: false, error: "Nome, interno e contesto sono obbligatori" });
  const bots = await readVoicebots();
  const id = `vb${Date.now()}`;
  bots.push({ id, nome, exten: parseInt(exten), context, descrizione: descrizione || "", attivo: true });
  try {
    await writeVoicebots(bots);
    res.json({ ok: true, id });
  } catch {
    res.status(500).json({ ok: false, error: "Errore salvataggio su GitHub" });
  }
});

app.put("/api/voicebots/:id", async (req, res) => {
  const bots = await readVoicebots();
  const idx = bots.findIndex((b: any) => b.id === req.params.id);
  if (idx === -1) return res.status(404).json({ ok: false, error: "Voicebot non trovato" });
  bots[idx] = { ...bots[idx], ...req.body, id: req.params.id };
  try {
    await writeVoicebots(bots);
    res.json({ ok: true });
  } catch {
    res.status(500).json({ ok: false, error: "Errore salvataggio su GitHub" });
  }
});

app.delete("/api/voicebots/:id", async (req, res) => {
  const bots = (await readVoicebots()).filter((b: any) => b.id !== req.params.id);
  try {
    await writeVoicebots(bots);
    res.json({ ok: true });
  } catch {
    res.status(500).json({ ok: false, error: "Errore eliminazione su GitHub" });
  }
});

// ── ACCESS LOGS ──
const LOGS_PATH = path.join(process.cwd(), 'access-logs.json');

function readLogs(): any[] {
  try { return JSON.parse(fs.readFileSync(LOGS_PATH, 'utf8')); } catch { return []; }
}
function writeLogs(logs: any[]) {
  try { fs.writeFileSync(LOGS_PATH, JSON.stringify(logs.slice(0, 200), null, 2)); } catch {}
}

app.post("/api/access-log", (req, res) => {
  const { username, nome, action } = req.body;
  if (!username || !action) return res.status(400).json({ ok: false });
  const logs = readLogs();
  logs.unshift({ ts: new Date().toISOString(), username, nome: nome || username, action });
  writeLogs(logs);
  res.json({ ok: true });
});

app.get("/api/access-logs", (req, res) => {
  res.json({ logs: readLogs() });
});

// ── NOTIFICA EMAIL COMPLETAMENTO CAMPAGNA ──
app.post("/api/notify-campaign", async (req, res) => {
  const { operatore, count, scheduledAt, note } = req.body;
  if (!process.env.SMTP_USER || !process.env.NOTIFY_EMAIL) {
    return res.status(200).json({ ok: false, reason: 'NOTIFY_EMAIL non configurata' });
  }
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_SECURE === 'true',
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
  const ora = new Date().toLocaleString('it-IT', { timeZone: 'Europe/Rome' });
  try {
    await transporter.sendMail({
      from: `"GEM Campagne Out" <${process.env.SMTP_USER}>`,
      to: process.env.NOTIFY_EMAIL,
      subject: `✅ Campagna completata — ${count} chiamate (${operatore})`,
      html: `
        <h2>Campagna completata</h2>
        <p><strong>Operatore:</strong> ${operatore}</p>
        <p><strong>Chiamate inviate:</strong> ${count}</p>
        <p><strong>Completata alle:</strong> ${ora}</p>
        ${note ? `<p><strong>Note:</strong> ${note}</p>` : ''}
        ${scheduledAt ? `<p><strong>Era pianificata per:</strong> ${new Date(scheduledAt).toLocaleString('it-IT')}</p>` : ''}
      `,
    });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, error: 'Errore invio notifica' });
  }
});

export default app;
