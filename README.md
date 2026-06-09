# campagne-out

Piattaforma GEM Group per campagne chiamate outbound via Wildix Voicebot.

## File

```
├── index.html       ← App completa (login + dashboard)
├── users.json       ← Gestione account utenti
├── vercel.json      ← Config routing Vercel
├── package.json     ← Metadata
└── api/
    └── login.js     ← Serverless function autenticazione
```

## Gestione utenti

Modifica `users.json` per aggiungere o cambiare account:

```json
[
  { "username": "mario", "password": "Password1!", "nome": "Mario" }
]
```

Ogni modifica su GitHub rideploya automaticamente in ~30 secondi.

## Deploy su Vercel

1. [vercel.com/new](https://vercel.com/new) → Import Git Repository
2. Seleziona questa repo → Deploy
