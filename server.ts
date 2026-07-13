import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { OTP } from 'otplib';
import QRCode from 'qrcode';
import apiApp from "./api/index.ts";

const app = express();
const PORT = 3000;
const authenticator = new OTP({ strategy: 'totp' });

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

// Login con 2FA (TOTP) — solo per lo sviluppo locale. In produzione (Vercel)
// viene usata la rotta /api/login definita in api/index.ts, senza 2FA.
// Applichiamo express.json() solo a queste due rotte (e non globalmente)
// perché /api/wildix-webhook, gestita da apiApp qui sotto, richiede il body
// grezzo (raw) per la verifica della firma HMAC: un parser JSON globale
// consumerebbe lo stream prima che quella rotta possa leggerlo.
app.post("/api/login", express.json(), async (req, res) => {
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

app.post("/api/verify-otp", express.json(), (req, res) => {
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

// Tutte le altre rotte (utenti, assistenza, voicebot, esiti chiamate,
// follow-up, statistiche, webhook Wildix, ecc.) sono quelle usate realmente
// in produzione: montiamo qui la stessa app di api/index.ts invece di
// mantenerne una copia separata, per evitare che l'ambiente di sviluppo
// locale diverga da quello di produzione (rotte mancanti, comportamenti
// diversi) come accadeva finora.
app.use(apiApp);

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
