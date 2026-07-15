import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import apiApp from "./api/index.ts";

const app = express();
const PORT = 3000;

// Tutte le rotte (login, 2FA, utenti, assistenza, voicebot, esiti chiamate,
// follow-up, statistiche, webhook Wildix, ecc.) sono quelle usate realmente
// in produzione: montiamo qui la stessa app di api/index.ts invece di
// mantenerne una copia separata, per evitare che l'ambiente di sviluppo
// locale diverga da quello di produzione (rotte mancanti, comportamenti
// diversi, o — come accadeva prima — un'implementazione 2FA duplicata e
// incoerente con quella reale).
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
