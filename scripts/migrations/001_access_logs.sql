-- Migrazione: tabella access_logs
-- Sostituisce il vecchio access-logs.json (filesystem effimero, incompatibile
-- con l'ambiente serverless di Vercel). Eseguire una volta sul database Neon.
--
-- Esecuzione:
--   psql "$DATABASE_URL" -f scripts/migrations/001_access_logs.sql
-- oppure incollando il contenuto nella console SQL di Neon.

CREATE TABLE IF NOT EXISTS access_logs (
  id       SERIAL PRIMARY KEY,
  ts       TIMESTAMPTZ NOT NULL DEFAULT now(),
  username TEXT        NOT NULL,
  nome     TEXT,
  action   TEXT        NOT NULL
);

-- Indice per la query di lettura (ORDER BY ts DESC LIMIT 200)
CREATE INDEX IF NOT EXISTS idx_access_logs_ts ON access_logs (ts DESC);
