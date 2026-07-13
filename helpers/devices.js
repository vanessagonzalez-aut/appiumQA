const {execSync} = require('node:child_process');

function sleepSync(ms) {
  const sab = new SharedArrayBuffer(4);
  Atomics.wait(new Int32Array(sab), 0, 0, ms);
}

function queryDevices() {
  try {
    const output = execSync('adb devices', {encoding: 'utf8'});
    return output
      .split('\n')
      .slice(1) // saltar la cabecera "List of devices attached"
      .map((line) => line.trim())
      .filter((line) => line.endsWith('\tdevice'))
      .map((line) => line.split('\t')[0]);
  } catch (err) {
    console.error('No se pudo ejecutar `adb devices`. ¿Está adb en el PATH?', err.message);
    return [];
  }
}

/**
 * Devuelve la lista de dispositivos/emuladores Android conectados y listos.
 * Reintenta unas cuantas veces: aunque el emulador ya haya bootedo, adb a veces
 * tarda un momento extra en reflejarlo justo cuando arranca la corrida en CI.
 *
 * @returns {string[]} udids, p.ej. ['emulator-5554', 'emulator-5556']
 */
function getConnectedDevices(retries = 5, delayMs = 3000) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    const devices = queryDevices();
    if (devices.length > 0) return devices;
    if (attempt < retries) {
      console.log(`⏳ No se detectaron dispositivos (intento ${attempt}/${retries}); reintentando en ${delayMs / 1000}s...`);
      sleepSync(delayMs);
    }
  }
  return [];
}

module.exports = {getConnectedDevices};
