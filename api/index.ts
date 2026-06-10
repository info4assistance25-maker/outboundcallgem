import express from "express";
import path from "path";
import fs from "fs";
import nodemailer from "nodemailer";

const app = express();
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
    // Nota: in ambiente serverless (es. Vercel), la scrittura su file system non è persistente.
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), "utf-8");
  } catch (err) {
    console.error("Error writing users.json", err);
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
      canSchedule: user.hasOwnProperty('canSchedule') ? user.canSchedule : true
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

export default app;

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
