const {execSync} = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

/**
 * Busca el binario aapt/aapt2 dentro del SDK de Android (para leer el APK).
 * @returns {string|null} ruta al ejecutable o null si no se encuentra
 */
function findAapt() {
  const sdk = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT;
  if (!sdk) return null;
  const btDir = path.join(sdk, 'build-tools');
  if (!fs.existsSync(btDir)) return null;
  // Probamos las versiones de build-tools de la más nueva a la más vieja
  const versions = fs.readdirSync(btDir).sort().reverse();
  const exeName = process.platform === 'win32' ? '.exe' : '';
  for (const v of versions) {
    for (const bin of ['aapt2', 'aapt']) {
      const exe = path.join(btDir, v, `${bin}${exeName}`);
      if (fs.existsSync(exe)) return exe;
    }
  }
  return null;
}

/**
 * Lee el package y la activity lanzable de un APK usando aapt.
 * @param {string} apkPath
 * @returns {{appPackage: string, appActivity: string|undefined}|null}
 */
function getApkInfo(apkPath) {
  const aapt = findAapt();
  if (!aapt || !fs.existsSync(apkPath)) return null;
  try {
    const out = execSync(`"${aapt}" dump badging "${apkPath}"`, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    const pkg = (out.match(/package: name='([^']+)'/) || [])[1];
    const act = (out.match(/launchable-activity: name='([^']+)'/) || [])[1];
    return pkg ? {appPackage: pkg, appActivity: act} : null;
  } catch {
    return null;
  }
}

/**
 * Comprueba si un paquete ya está instalado en el dispositivo indicado.
 * @param {string} udid
 * @param {string} pkg
 * @returns {boolean}
 */
function isAppInstalled(udid, pkg) {
  try {
    const out = execSync(`adb -s ${udid} shell pm list packages ${pkg}`, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    return out.split('\n').some((line) => line.trim() === `package:${pkg}`);
  } catch {
    return false;
  }
}

module.exports = {getApkInfo, isAppInstalled};
