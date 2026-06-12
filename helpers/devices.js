const {execSync} = require('node:child_process');

/**
 * Devuelve la lista de dispositivos/emuladores Android conectados y listos.
 * Lee la salida de `adb devices` y filtra solo los que están en estado "device".
 *
 * @returns {string[]} udids, p.ej. ['emulator-5554', 'emulator-5556']
 */
function getConnectedDevices() {
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

module.exports = {getConnectedDevices};
