import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { OTP } from 'otplib';
import QRCode from 'qrcode';
import nodemailer from 'nodemailer';

const app = express();
const PORT = 3000;
const authenticator = new OTP({ strategy: 'totp' });

app.use(express.json());

const USERS_FILE = path.join(process.cwd(), "users.json");

// Helper per leggere e scrivere utenti
function readUsers() {
  try {
    if (!fs.existsSync(USERS_FILE)) {
      return [];
    }
    const data = fs.readFileSync(USERS_FILE, "utf-8");
    return JSON.parse(data);
  } catch (err) {
    console.error("Error reading users.json", err);
    return [];
  }
}

function writeUsers(users: any[]) {
  try {
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), "utf-8");
  } catch (err) {
    console.error("Error writing users.json", err);
  }
}

// API
app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

app.post("/api/login", async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ ok: false, error: "Username e password richiesti" });
  }

  const users = readUsers();
  const userIndex = users.findIndex(
    (u: any) => u.username.toLowerCase() === username.toLowerCase() && u.password === password
  );

  if (userIndex !== -1) {
    const user = users[userIndex];
    let secret = user.totpSecret;
    let qrUrl = null;
    let setup2FA = false;

    if (!secret) {
      // Generate standard TOTP secret on first login
      secret = authenticator.generateSecret();
      users[userIndex].totpSecret = secret;
      writeUsers(users);
      
      const otpauth = authenticator.generateURI({
        label: user.username, 
        issuer: 'GEM Campaign System', 
        secret
      });
      qrUrl = await QRCode.toDataURL(otpauth);
      setup2FA = true;
    }

    res.json({ 
      ok: true, 
      requires2FA: true,
      setup2FA,
      qrUrl,
      username: user.username,
      message: setup2FA ? "Configurazione 2FA richiesta" : "Inserisci o codice dall'app Authenticator"
    });
  } else {
    res.status(401).json({ ok: false, error: "Credenziali errate" });
  }
});

app.post("/api/verify-otp", (req, res) => {
  const { username, otp } = req.body;
  
  if (!username || !otp) {
    return res.status(400).json({ ok: false, error: "Dati mancanti" });
  }
  
  const users = readUsers();
  const user = users.find((u: any) => u.username.toLowerCase() === username.toLowerCase());
  
  if (!user) {
    return res.status(404).json({ ok: false, error: "Utente non trovato" });
  }

  if (!user.totpSecret) {
    return res.status(400).json({ ok: false, error: "2FA non configurata per questo utente" });
  }
  
  const verifyResult = authenticator.verifySync({ token: otp, secret: user.totpSecret });
  
  if (!verifyResult) {
    return res.status(401).json({ ok: false, error: "Codice errato" });
  }
  
  // Also check if verifyResult resolves to boolean or Object with valid property
  const isOtpValid = typeof verifyResult === 'boolean' ? verifyResult : (verifyResult as any).valid || (verifyResult as any).isValid;
  if (!isOtpValid) {
    return res.status(401).json({ ok: false, error: "Codice errato" });
  }
  
  res.json({ 
    ok: true, 
    username: user.username, 
    nome: user.nome, 
    role: user.role || (user.isAdmin ? 'Admin' : 'Editor'),
    isAdmin: user.username.toLowerCase() === "admin" || user.isAdmin === true || user.role === 'Admin',
    canSchedule: user.hasOwnProperty('canSchedule') ? user.canSchedule : true
  });
});

app.get("/api/users", (req, res) => {
  const users = readUsers();
  // Return users without passwords for safety, though it's internal logic
  const safeUsers = users.map((u: any) => ({ 
    username: u.username, 
    nome: u.nome, 
    password: u.password, 
    role: u.role || (u.isAdmin ? 'Admin' : 'Editor'),
    canSchedule: u.hasOwnProperty('canSchedule') ? u.canSchedule : true
  }));
  res.json(safeUsers);
});

app.post("/api/users", (req, res) => {
  const { username, password, nome, role, canSchedule } = req.body;
  
  if (!username || !password || !nome || !role) {
    return res.status(400).json({ error: "Dati mancanti" });
  }

  const users = readUsers();
  if (users.find((u: any) => u.username.toLowerCase() === username.toLowerCase())) {
    return res.status(400).json({ error: "Username già esistente" });
  }

  users.push({ username, password, nome, role, isAdmin: role === 'Admin', canSchedule: canSchedule !== false });
  writeUsers(users);

  res.json({ ok: true });
});

app.put("/api/users/:username", (req, res) => {
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
    canSchedule: canSchedule !== false
  };
  writeUsers(users);
  
  res.json({ ok: true });
});

app.delete("/api/users/:username", (req, res) => {
  const { username } = req.params;
  
  let users = readUsers();
  const initialLength = users.length;
  users = users.filter((u: any) => u.username.toLowerCase() !== username.toLowerCase());

  if (users.length === initialLength) {
    return res.status(404).json({ error: "Utente non trovato" });
  }

  writeUsers(users);
  res.json({ ok: true });
});

app.post("/api/support", async (req, res) => {
  const { name, email, subject, message } = req.body;
  if (!subject || !message) {
    return res.status(400).json({ ok: false, error: "Dati mancanti" });
  }

  // Create reusable transporter object using the default SMTP transport
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || "smtp.gmail.com",
    port: parseInt(process.env.SMTP_PORT || "587"),
    secure: process.env.SMTP_SECURE === "true", // true for 465, false for other ports
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  try {
    if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
      return res.status(500).json({ ok: false, error: "Credenziali SMTP non configurate. Configura SMTP_USER, SMTP_PASS, SMTP_HOST e SMTP_PORT nel pannello Secrets." });
    }

    // Send mail with defined transport object
    await transporter.sendMail({
      from: `"${name}" <${email}>`, // sender address
      to: "ticket@gemgroup.odoo.com", // list of receivers
      subject: `[Supporto] ${subject}`, // Subject line
      text: message, // plain text body
      html: `<p><strong>Da:</strong> ${name} (${email})</p><p><strong>Messaggio:</strong></p><p>${message.replace(/\\n/g, '<br>')}</p>`, // html body
    });

    res.json({ ok: true });
  } catch (error) {
    console.error("Errore invio email:", error);
    res.status(500).json({ ok: false, error: "Errore durante l'invio dell'email. Verifica la configurazione SMTP." });
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
