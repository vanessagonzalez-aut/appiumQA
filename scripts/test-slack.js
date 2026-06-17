// Envía un mensaje de PRUEBA a Slack para verificar que el webhook está bien
// configurado, sin necesidad de correr toda la suite de Appium.
//
// Uso:
//   $env:SLACK_WEBHOOK_URL="https://hooks.slack.com/services/..."; npm run slack:test
//   (o crea un archivo .slack-webhook con la URL dentro y solo: npm run slack:test)

const {sendSlackMessage, getWebhookUrl} = require('../helpers/slack');

(async () => {
  if (!getWebhookUrl()) {
    console.error(
      '❌ No hay webhook configurado.\n\n' +
        'Configúralo de una de estas dos formas:\n' +
        '  1. Variable de entorno (PowerShell):\n' +
        '     $env:SLACK_WEBHOOK_URL="https://hooks.slack.com/services/XXX/YYY/ZZZ"\n' +
        '  2. Archivo: crea un archivo llamado .slack-webhook en la raíz del\n' +
        '     proyecto con la URL del webhook dentro.\n'
    );
    process.exit(1);
  }

  console.log('Enviando mensaje de prueba a Slack...');
  const ok = await sendSlackMessage({passed: 3, failed: 0, source: 'prueba manual'});
  if (ok) {
    console.log('✅ Listo. Revisa tu canal de Slack.');
  }
  // Marcamos el código de salida pero NO llamamos process.exit() para dejar que
  // Node cierre los sockets de fetch limpiamente (evita el crash de libuv en Windows).
  process.exitCode = ok ? 0 : 1;
})();
