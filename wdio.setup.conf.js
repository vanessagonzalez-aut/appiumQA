const fs = require('node:fs');
const path = require('node:path');
const {detectDevices, buildCapabilities, baseConfig} = require('./wdio.shared');

// --- Fase de PRECONDICIÓN ----------------------------------------------------
// Corre SOLO los specs que terminan en ".setup.spec.js", en un único dispositivo
// y de forma secuencial. Debe terminar (y pasar) antes de que arranque la fase
// en paralelo (`npm run test:parallel`). Usa prefijos numéricos en el nombre
// (p.ej. "01-crear-cuenta.setup.spec.js") si necesitas un orden específico entre
// varios specs de precondición.
const specsDir = path.resolve(__dirname, 'test', 'specs');
const setupSpecs = fs
  .readdirSync(specsDir)
  .filter((f) => f.endsWith('.setup.spec.js'))
  .map((f) => path.join(specsDir, f))
  .sort();

if (setupSpecs.length === 0) {
  console.log('ℹ️  No hay specs de precondición (*.setup.spec.js); se omite esta fase.');
  process.exit(0);
}

const allDevices = detectDevices();
const device = [allDevices[0]]; // un solo dispositivo: corre secuencial, sin paralelismo

const capabilities = buildCapabilities(device, [setupSpecs]);

console.log(`\n🔧 Fase de precondición: ${setupSpecs.length} prueba(s) en ${device[0]}\n`);

exports.config = baseConfig({
  devices: device,
  capabilities,
  specs: setupSpecs,
  notifyOnlyOnFailure: true, // solo avisa si el setup falla; si pasa, el único mensaje final lo manda la fase en paralelo
  source: 'precondición',
});
