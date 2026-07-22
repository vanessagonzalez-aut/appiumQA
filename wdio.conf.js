const fs = require('node:fs');
const path = require('node:path');
const {detectDevices, buildCapabilities, baseConfig} = require('./wdio.shared');

// --- Fase EN PARALELO --------------------------------------------------------
// Corre todos los specs EXCEPTO los de precondición (*.setup.spec.js), repartidos
// round-robin entre todos los dispositivos detectados. Los specs de precondición
// se corren aparte, antes que esta fase, con `npm run test:setup` (ver
// wdio.setup.conf.js) — así garantizamos que terminen antes de que arranque esto.
const devices = detectDevices();

const specsDir = path.resolve(__dirname, 'test', 'specs');
const allSpecs = fs
  .readdirSync(specsDir)
  .filter((f) => f.endsWith('.js') && !f.endsWith('.setup.spec.js'))
  .map((f) => path.join(specsDir, f));

// Reparto round-robin: el dispositivo i corre los specs i, i+N, i+2N...
const specsByDevice = devices.map((_, i) => allSpecs.filter((_, idx) => idx % devices.length === i));
const capabilities = buildCapabilities(devices, specsByDevice);

console.log(
  `\n📱 ${devices.length} dispositivo(s) detectado(s): ${devices.join(', ')}` +
    `\n🧪 ${allSpecs.length} prueba(s) repartida(s) en paralelo\n`
);

exports.config = baseConfig({devices, capabilities, specs: allSpecs});
