const fs = require('node:fs');
const path = require('node:path');
const https = require('node:https');

// Hace el POST con el módulo nativo `https` en vez de `fetch()`. `fetch()` usa
// el dispatcher de undici, cuyos sockets keep-alive a veces no terminan de
// cerrarse antes de que WDIO llame a process.exit() al terminar `onComplete`,
// lo que provoca un crash nativo de libuv en Windows (UV_HANDLE_CLOSING).
function postJson(url, payload) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(payload);
    const {hostname, pathname, search} = new URL(url);
    const req = https.request(
      {
        hostname,
        path: pathname + search,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body),
        },
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => resolve({status: res.statusCode, body: data}));
      }
    );
    req.on('error', reject);
    req.end(body);
  });
}

/**
 * Obtiene la URL del webhook de Slack desde:
 *  1. La variable de entorno SLACK_WEBHOOK_URL, o
 *  2. Un archivo `.slack-webhook` en la raíz del proyecto (ignorado por git).
 *
 * @returns {string} la URL del webhook, o cadena vacía si no está configurada
 */
function getWebhookUrl() {
  if (process.env.SLACK_WEBHOOK_URL) {
    return process.env.SLACK_WEBHOOK_URL.trim();
  }
  const file = path.resolve(__dirname, '..', '.slack-webhook');
  if (fs.existsSync(file)) {
    return fs.readFileSync(file, 'utf8').trim();
  }
  return '';
}

// URL del reporte en GitHub Pages SOLO si se define explícitamente (variable
// PAGES_URL). En local NO apuntamos al reporte de CI/producción porque no
// corresponde a la corrida local.
function getPagesUrl() {
  return (process.env.PAGES_URL || '').trim();
}

/**
 * Envía un resumen de resultados a Slack mediante un Incoming Webhook.
 *
 * @param {{passed: number, failed: number, source?: string}} args
 * @returns {Promise<boolean>} true si se envió correctamente
 */
async function sendSlackMessage({passed = 0, failed = 0, source = 'local', pagesUrl = getPagesUrl()}) {
  const webhook = getWebhookUrl();
  if (!webhook) {
    console.log('ℹ️  SLACK_WEBHOOK_URL no configurado; se omite el aviso a Slack.');
    return false;
  }

  const ok = failed === 0;
  const emoji = ok ? '✅' : '❌';
  const statusText = ok ? 'PASARON' : 'FALLARON';
  const color = ok ? '#36a64f' : '#d00000';

  const blocks = [
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `${emoji} *Pruebas (${source}) ${statusText}* — ${passed} ✓ / ${failed} ✗`,
      },
    },
  ];

  if (pagesUrl) {
    // Solo en contextos donde el reporte SÍ está publicado (p.ej. CI con PAGES_URL)
    blocks.push({
      type: 'actions',
      elements: [
        {
          type: 'button',
          text: {type: 'plain_text', text: '📊 Ver reporte (GitHub Pages)'},
          url: pagesUrl,
        },
      ],
    });
  } else {
    // Corrida local: el reporte no está publicado en la web, se genera localmente
    blocks.push({
      type: 'context',
      elements: [
        {
          type: 'mrkdwn',
          text: '💻 Corrida local — ejecuta `npm run report` para ver el reporte detallado con video.',
        },
      ],
    });
  }

  const payload = {attachments: [{color, blocks}]};

  try {
    const res = await postJson(webhook, payload);
    if (res.status >= 200 && res.status < 300) {
      console.log('📨 Resultado enviado a Slack');
      return true;
    }
    console.warn(`⚠️  Slack respondió ${res.status}: ${res.body}`);
    return false;
  } catch (err) {
    console.warn('⚠️  No se pudo enviar a Slack:', err.message);
    return false;
  }
}

module.exports = {getWebhookUrl, getPagesUrl, sendSlackMessage};
