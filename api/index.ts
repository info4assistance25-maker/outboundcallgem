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

const CALL_RESULTS_FILE = path.join(process.cwd(), "call-results.json");

function readCallResults(): any[] {
  try {
    if (!fs.existsSync(CALL_RESULTS_FILE)) return [];
    return JSON.parse(fs.readFileSync(CALL_RESULTS_FILE, "utf-8"));
  } catch { return []; }
}

function writeCallResults(results: any[]) {
  try {
    fs.writeFileSync(CALL_RESULTS_FILE, JSON.stringify(results.slice(0, 5000), null, 2));
  } catch (err) { console.error("Error writing call-results.json", err); }
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

app.post(
  "/api/wildix-webhook",
  express.raw({ type: "application/json" }), // body grezzo, necessario per la firma
  (req, res) => {
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

    const results = readCallResults();

    if (event.type === "call:completed") {
      const flow = event.data?.flows?.[0] || {};
      const numero = flow.callee?.phone || event.data?.destination || null;
      const risposto = (flow.talkTime || 0) > 0;

      results.unshift({
        callId: event.id,
        numero,
        risposto,
        durata: flow.talkTime || 0,
        timestamp: new Date(event.time).toISOString(),
        trascrizione: null,
      });
      writeCallResults(results);
    }

    if (event.type === "call:transcription:completed") {
      const callId = event.id || event.data?.id;
      const idx = results.findIndex((r) => r.callId === callId);
      const trascrizione = event.data?.transcription || event.data?.summary || null;

      if (idx !== -1) {
        results[idx].trascrizione = trascrizione;
      } else {
        // trascrizione arrivata prima del call:completed (raro ma possibile)
        results.unshift({
          callId,
          numero: null,
          risposto: null,
          durata: null,
          timestamp: new Date().toISOString(),
          trascrizione,
        });
      }
      writeCallResults(results);
    }

    res.sendStatus(200);
  }
);

app.get("/api/call-results", (_req, res) => {
  res.json({ ok: true, results: readCallResults() });
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
