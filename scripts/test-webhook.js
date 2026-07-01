/**
 * Script di test end-to-end per il webhook Wildix.
 * Simula un evento "call:completed" firmato correttamente e lo invia
 * all'endpoint deployato, senza dover fare una vera chiamata vocale.
 *
 * Uso:
 *   WILDIX_WEBHOOK_SECRET=xxx node scripts/test-webhook.js
 *
 * (il secret deve essere lo stesso configurato su Vercel)
 */

const crypto = require('crypto');

const WEBHOOK_URL = process.env.WEBHOOK_URL || 'https://outboundcallgem.vercel.app/api/wildix-webhook';
const SECRET = process.env.WILDIX_WEBHOOK_SECRET;

if (!SECRET) {
  console.error('Errore: imposta la variabile WILDIX_WEBHOOK_SECRET (stesso valore configurato su Vercel)');
  process.exit(1);
}

const fakeEvent = {
  id: `test_${Date.now()}`,
  pbx: 'test-pbx',
  company: 'test-company',
  time: Date.now(),
  type: 'call:completed',
  integrationId: 'test',
  data: {
    id: `test_${Date.now()}`,
    flows: [
      {
        flowIndex: 0,
        talkTime: 25000,
        remotePhone: '+393331234567',
        callee: { phone: 'test-voicebot', userDevice: 'VOICEBOT', userAgent: 'Voicebot' },
        caller: { userDevice: 'XBEES_WEB' },
      },
    ],
  },
};

async function main() {
  const body = JSON.stringify(fakeEvent);
  const signature = crypto.createHmac('sha256', SECRET).update(body).digest('hex');

  console.log('Invio evento di test a:', WEBHOOK_URL);

  const res = await fetch(WEBHOOK_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-SIGNATURE': signature,
    },
    body,
  });

  console.log('Status:', res.status);
  console.log('Risposta:', await res.text());

  if (res.status === 200) {
    console.log('\n✅ Webhook OK. Verifica ora su /api/call-results che sia comparso callId:', fakeEvent.id);
  } else {
    console.log('\n❌ Qualcosa non va — controlla che il secret coincida con quello su Vercel.');
  }
}

main().catch(err => {
  console.error('Errore:', err);
  process.exit(1);
});
