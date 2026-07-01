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

// NOTA: il filesystem di Vercel è effimero — fs.writeFileSync su process.cwd()
// non persiste in modo affidabile tra invocazioni diverse della funzione.
// Usiamo quindi GitHub come storage persistente, stesso pattern già in uso
// per users.json e voicebots.json in questo file.
const CALL_RESULTS_REPO_PATH = "call-results.json";

async function readCallResults(): Promise<any[]> {
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    console.error("GITHUB_TOKEN non configurato — impossibile leggere call-results da GitHub");
    return [];
  }
  try {
    const res = await fetch(
      `https://api.github.com/repos/${GITHUB_REPO}/contents/${CALL_RESULTS_REPO_PATH}`,
      { headers: { Authorization: `token ${token}`, Accept: "application/vnd.github.v3+json", "User-Agent": "gem-app" } }
    );
    if (!res.ok) {
      if (res.status === 404) return []; // file non ancora creato: prima chiamata mai ricevuta
      console.error("GitHub GET call-results error:", res.status, await res.text());
      return [];
    }
    const fileData = await res.json() as any;
    const content = Buffer.from(fileData.content, "base64").toString("utf-8");
    return JSON.parse(content);
  } catch (err) {
    console.error("Error reading call-results from GitHub:", err);
    return [];
  }
}

async function writeCallResults(results: any[]) {
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    console.error("GITHUB_TOKEN non configurato — impossibile salvare call-results su GitHub");
    return;
  }
  try {
    // Serve lo sha attuale del file per poterlo sovrascrivere (se esiste già)
    const getRes = await fetch(
      `https://api.github.com/repos/${GITHUB_REPO}/contents/${CALL_RESULTS_REPO_PATH}`,
      { headers: { Authorization: `token ${token}`, Accept: "application/vnd.github.v3+json", "User-Agent": "gem-app" } }
    );
    const sha = getRes.ok ? (await getRes.json() as any).sha : undefined;

    const content = Buffer.from(JSON.stringify(results.slice(0, 5000), null, 2)).toString("base64");
    const putRes = await fetch(
      `https://api.github.com/repos/${GITHUB_REPO}/contents/${CALL_RESULTS_REPO_PATH}`,
      {
        method: "PUT",
        headers: {
          Authorization: `token ${token}`,
          Accept: "application/vnd.github.v3+json",
          "Content-Type": "application/json",
          "User-Agent": "gem-app",
        },
        body: JSON.stringify({ message: "chore: update call results", content, ...(sha ? { sha } : {}) }),
      }
    );
    if (!putRes.ok) {
      console.error("GitHub PUT call-results error:", putRes.status, await putRes.text());
    }
  } catch (err) {
    console.error("Error writing call-results to GitHub:", err);
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
const CONTACT_NAMES_REPO_PATH = "contact-names.json";

async function readContactNames(): Promise<Record<string, string>> {
  const token = process.env.GITHUB_TOKEN;
  if (!token) return {};
  try {
    const res = await fetch(
      `https://api.github.com/repos/${GITHUB_REPO}/contents/${CONTACT_NAMES_REPO_PATH}`,
      { headers: { Authorization: `token ${token}`, Accept: "application/vnd.github.v3+json", "User-Agent": "gem-app" } }
    );
    if (!res.ok) return {};
    const fileData = await res.json() as any;
    return JSON.parse(Buffer.from(fileData.content, "base64").toString("utf-8"));
  } catch {
    return {};
  }
}

async function writeContactNames(map: Record<string, string>) {
  const token = process.env.GITHUB_TOKEN;
  if (!token) return;
  try {
    const getRes = await fetch(
      `https://api.github.com/repos/${GITHUB_REPO}/contents/${CONTACT_NAMES_REPO_PATH}`,
      { headers: { Authorization: `token ${token}`, Accept: "application/vnd.github.v3+json", "User-Agent": "gem-app" } }
    );
    const sha = getRes.ok ? (await getRes.json() as any).sha : undefined;
    const content = Buffer.from(JSON.stringify(map, null, 2)).toString("base64");
    await fetch(
      `https://api.github.com/repos/${GITHUB_REPO}/contents/${CONTACT_NAMES_REPO_PATH}`,
      {
        method: "PUT",
        headers: { Authorization: `token ${token}`, Accept: "application/vnd.github.v3+json", "Content-Type": "application/json", "User-Agent": "gem-app" },
        body: JSON.stringify({ message: "chore: update contact names", content, ...(sha ? { sha } : {}) }),
      }
    );
  } catch (err) {
    console.error("Error writing contact-names to GitHub:", err);
  }
}

// Endpoint chiamato dal frontend al lancio di una campagna, per registrare
// l'associazione numero → nome contatto (serve ad arricchire i risultati
// del voicebot, dato che il webhook Wildix restituisce solo il numero).
app.post("/api/register-campaign-contacts", express.json(), async (req, res) => {
  const { contacts } = req.body as { contacts: { numero: string; nome: string }[] };
  if (!Array.isArray(contacts)) {
    return res.status(400).json({ ok: false, error: "contacts deve essere un array" });
  }
  const map = await readContactNames();
  for (const c of contacts) {
    const n = normalizePhone(c.numero);
    if (n && c.nome) map[n] = c.nome;
  }
  await writeContactNames(map);
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
      return res.sendStatus(200);
    }

    // NOTA: su Vercel il codice non è garantito proseguire dopo l'invio
    // della risposta (niente "fire and forget"), quindi attendiamo il
    // completamento della scrittura su GitHub PRIMA di rispondere 200.
    try {
      const results = await readCallResults();
      const contactNames = await readContactNames();

      if (event.type === "call:completed") {
        const flow = event.data?.flows?.[0] || {};
        const numero = normalizePhone(flow.callee?.phone || event.data?.destination || null);
        const risposto = (flow.talkTime || 0) > 0;
        const nome = numero ? contactNames[numero] || null : null;

        const idx = results.findIndex((r) => r.callId === event.id);
        const entry = {
          callId: event.id,
          numero,
          nome,
          risposto,
          durata: flow.talkTime || 0,
          timestamp: new Date(event.time).toISOString(),
          trascrizione: null,
        };
        if (idx !== -1) {
          results[idx] = { ...results[idx], ...entry, trascrizione: results[idx].trascrizione, riassunto: results[idx].riassunto };
        } else {
          results.unshift(entry);
        }
        await writeCallResults(results);
      }

      if (event.type === "call:transcription:completed") {
        const callId = event.id || event.data?.call?.id;
        const idx = results.findIndex((r) => r.callId === callId);

        // La trascrizione arriva come array di "chunks" (battute per parlante),
        // non come singolo campo transcription/summary.
        const chunks = event.data?.chunks || [];
        const trascrizione = chunks
          .map((c: any) => `[${c.time}] ${c.name}: ${c.text}`)
          .join("\n");

        if (idx !== -1) {
          results[idx].trascrizione = trascrizione;
        } else {
          // trascrizione arrivata prima del call:completed (raro ma possibile)
          const numero = normalizePhone(event.data?.call?.destination || null);
          results.unshift({
            callId,
            numero,
            nome: numero ? contactNames[numero] || null : null,
            risposto: (event.data?.call?.talkTime || 0) > 0,
            durata: event.data?.call?.talkTime || null,
            timestamp: new Date().toISOString(),
            trascrizione,
          });
        }
        await writeCallResults(results);
      }

      if (event.type === "call:summary:completed") {
        const callId = event.id || event.data?.call?.id;
        const idx = results.findIndex((r) => r.callId === callId);
        const summary = event.data?.summary || {};

        const riassunto = {
          titolo: summary.title || null,
          testo: summary.brief || null,
          argomenti: summary.json?.topics || [],
          decisioni: summary.json?.decisions || [],
          problemi: summary.json?.issues || [],
        };

        if (idx !== -1) {
          results[idx].riassunto = riassunto;
        } else {
          // riassunto arrivato prima del call:completed (raro ma possibile)
          const numero = normalizePhone(event.data?.call?.destination || null);
          results.unshift({
            callId,
            numero,
            nome: numero ? contactNames[numero] || null : null,
            risposto: (event.data?.call?.talkTime || 0) > 0,
            durata: event.data?.call?.talkTime || null,
            timestamp: new Date().toISOString(),
            trascrizione: null,
            riassunto,
          });
        }
        await writeCallResults(results);

        // ── Notifica: se il paziente ha rifiutato/non ha confermato, avvisa un operatore ──
        const rifiutato = riassunto.decisioni.some((d: string) => /non conferm|rifiut/i.test(d));
        if (rifiutato && process.env.SMTP_USER && process.env.NOTIFY_EMAIL) {
          try {
            const transporter = nodemailer.createTransport({
              host: process.env.SMTP_HOST || "smtp.gmail.com",
              port: parseInt(process.env.SMTP_PORT || "587"),
              secure: process.env.SMTP_SECURE === "true",
              auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
            });
            const entry = results.find((r) => r.callId === callId);
            await transporter.sendMail({
              from: `"GEM Voicebot Alert" <${process.env.SMTP_USER}>`,
              to: process.env.NOTIFY_EMAIL,
              subject: `⚠️ Appuntamento rifiutato — ${entry?.nome || entry?.numero || callId}`,
              html: `
                <h2>Appuntamento non confermato</h2>
                <p><strong>Contatto:</strong> ${entry?.nome || '—'} (${entry?.numero || '—'})</p>
                <p><strong>Riassunto:</strong> ${riassunto.testo || '—'}</p>
                <p><strong>Decisione rilevata:</strong> ${riassunto.decisioni.join('; ')}</p>
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

app.get("/api/call-results", async (_req, res) => {
  const results = await readCallResults();
  res.json({ ok: true, results });
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

function readVoicebots() {
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
    await fetch(
      `https://api.github.com/repos/${GITHUB_REPO}/contents/${VOICEBOTS_FILE_PATH}`,
      {
        method: "PUT",
        headers: { Authorization: `token ${token}`, Accept: "application/vnd.github.v3+json", "Content-Type": "application/json", "User-Agent": "gem-app" },
        body: JSON.stringify({ message: "chore: update voicebots", content, ...(sha ? { sha } : {}) })
      }
    );
  } catch (err) { console.error("Error writing voicebots to GitHub:", err); }
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
app.get("/api/voicebots", (_req, res) => {
  res.json({ ok: true, voicebots: readVoicebots() });
});

app.post("/api/voicebots", async (req, res) => {
  const { nome, exten, context, descrizione } = req.body;
  if (!nome || !exten || !context) return res.status(400).json({ ok: false, error: "Nome, interno e contesto sono obbligatori" });
  const bots = readVoicebots();
  const id = `vb${Date.now()}`;
  bots.push({ id, nome, exten: parseInt(exten), context, descrizione: descrizione || "", attivo: true });
  await writeVoicebots(bots);
  res.json({ ok: true, id });
});

app.put("/api/voicebots/:id", async (req, res) => {
  const bots = readVoicebots();
  const idx = bots.findIndex((b: any) => b.id === req.params.id);
  if (idx === -1) return res.status(404).json({ ok: false, error: "Voicebot non trovato" });
  bots[idx] = { ...bots[idx], ...req.body, id: req.params.id };
  // Salva localmente subito e rispondi, GitHub in background
  try { fs.writeFileSync(VOICEBOTS_LOCAL, JSON.stringify(bots, null, 2)); } catch {}
  res.json({ ok: true });
  writeVoicebots(bots).catch(() => {});
});

app.delete("/api/voicebots/:id", async (req, res) => {
  const bots = readVoicebots().filter((b: any) => b.id !== req.params.id);
  try { fs.writeFileSync(VOICEBOTS_LOCAL, JSON.stringify(bots, null, 2)); } catch {}
  res.json({ ok: true });
  writeVoicebots(bots).catch(() => {});
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
