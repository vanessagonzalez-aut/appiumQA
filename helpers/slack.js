const fs = require('node:fs');
const path = require('node:path');

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

// URL del reporte publicado en GitHub Pages. Se puede sobreescribir con la
// variable de entorno PAGES_URL; si no, usa la del repo por defecto.
const DEFAULT_PAGES_URL = 'https://vanessagonzalez-aut.github.io/appiumQA/';

function getPagesUrl() {
  return (process.env.PAGES_URL || DEFAULT_PAGES_URL).trim();
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

  // Botón con el enlace al reporte publicado en GitHub Pages
  if (pagesUrl) {
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
  }

  const payload = {attachments: [{color, blocks}]};

  try {
    const res = await fetch(webhook, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      console.log('📨 Resultado enviado a Slack');
      return true;
    }
    console.warn(`⚠️  Slack respondió ${res.status}: ${await res.text()}`);
    return false;
  } catch (err) {
    console.warn('⚠️  No se pudo enviar a Slack:', err.message);
    return false;
  }
}

module.exports = {getWebhookUrl, getPagesUrl, sendSlackMessage};
