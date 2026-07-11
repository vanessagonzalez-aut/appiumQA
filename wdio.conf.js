const fs = require('node:fs');
const path = require('node:path');
const {getConnectedDevices} = require('./helpers/devices');
const {getApkInfo, isAppInstalled} = require('./helpers/app');

// Ruta absoluta al APK que se va a probar.
// En CI se descarga el APK y se pasa su ruta por la variable de entorno APP_PATH.
const APP_PATH = process.env.APP_PATH
  ? path.resolve(process.env.APP_PATH)
  : path.resolve(__dirname, 'app-staging-release - 6.1.4 (1584).apk');

// Carpeta donde se guardan los videos de evidencia
const VIDEO_DIR = path.resolve(__dirname, 'videos');

// --- Detección de dispositivos y reparto de pruebas --------------------------
// Listamos los emuladores/dispositivos conectados. Cada uno corre en paralelo
// con su propia sesión. Las pruebas se reparten (round-robin) entre ellos.
const devices = getConnectedDevices();
if (devices.length === 0) {
  throw new Error(
    'No hay dispositivos conectados. Levanta un emulador (o conecta un teléfono) y verifica con `adb devices`.'
  );
}

// Lista de archivos de prueba (cada *.js dentro de test/specs es una prueba)
const specsDir = path.resolve(__dirname, 'test', 'specs');
const allSpecs = fs
  .readdirSync(specsDir)
  .filter((f) => f.endsWith('.js'))
  .map((f) => path.join(specsDir, f));

// Datos del APK (package + activity) para poder lanzarlo sin reinstalar
const apkInfo = getApkInfo(APP_PATH);
// Permite forzar la (re)instalación aunque ya esté instalado: APP_FORCE_INSTALL=1
const forceInstall = process.env.APP_FORCE_INSTALL === '1';

// Una capability por dispositivo, cada una con su porción de pruebas y puertos únicos
const capabilities = devices.map((udid, i) => {
  const cap = {
    // Cada dispositivo corre sus specs de uno en uno (una sesión por dispositivo)
    maxInstances: 1,
    platformName: 'Android',
    'appium:automationName': 'UiAutomator2',
    'appium:udid': udid,
    // No reinstalar el APK en cada sesión: instala una vez y reutiliza (mucho más rápido)
    'appium:noReset': true,
    'appium:fullReset': false,
    // Puertos únicos para que las sesiones en paralelo no choquen entre sí
    'appium:systemPort': 8200 + i,
    'appium:mjpegServerPort': 7810 + i,
    // La instalación del APK puede ser lenta (sobre todo desde OneDrive)
    'appium:androidInstallTimeout': 300000,
    'appium:newCommandTimeout': 300000,
    'appium:chromedriverAutoDownload': true,
    'appium:settings[stylus_handwriting_enabled]': false,
    // Reparto round-robin: el dispositivo i corre los specs i, i+N, i+2N...
    specs: allSpecs.filter((_, idx) => idx % devices.length === i),
  };

  // Si la app YA está instalada en este dispositivo, la lanzamos directamente
  // (appPackage/appActivity, sin instalar nada). Si no, instalamos el APK.
  if (!forceInstall && apkInfo && apkInfo.appPackage && isAppInstalled(udid, apkInfo.appPackage)) {
    cap['appium:appPackage'] = apkInfo.appPackage;
    if (apkInfo.appActivity) cap['appium:appActivity'] = apkInfo.appActivity;
    console.log(`⏩ ${udid}: app ya instalada (${apkInfo.appPackage}); se omite la instalación`);
  } else {
    cap['appium:app'] = APP_PATH;
    console.log(`⬇️  ${udid}: se instalará el APK`);
  }
  return cap;
});

console.log(
  `\n📱 ${devices.length} dispositivo(s) detectado(s): ${devices.join(', ')}` +
    `\n🧪 ${allSpecs.length} prueba(s) repartida(s) en paralelo\n`
);

exports.config = {
  runner: 'local',

  // Conecta al servidor Appium que corres aparte (`appium` en otra terminal)
  hostname: process.env.APPIUM_HOST || 'localhost',
  port: parseInt(process.env.APPIUM_PORT, 10) || 4723,
  path: '/',

  specs: allSpecs,
  exclude: [],

  // Máximo de sesiones en paralelo = número de dispositivos
  maxInstances: devices.length,
  capabilities,

  logLevel: 'info',
  bail: 0,
  waitforTimeout: 15000,
  connectionRetryTimeout: 360000,
  connectionRetryCount: 1,
  specFileRetries: 2,
  specFileRetriesDelay: 5,

  framework: 'mocha',
  mochaOpts: {
    ui: 'bdd',
    timeout: 600000,
  },

  reporters: [
    'spec',
    [
      'allure',
      {
        outputDir: 'allure-results',
        disableWebdriverStepsReporting: true,
        disableWebdriverScreenshotsReporting: false,
      },
    ],
  ],

  // --- Hooks de grabación de video (nativa de Appium) ------------------------
  beforeTest: async function () {
    // Empieza a grabar la pantalla del dispositivo antes de cada prueba.
    // Best-effort: si el dispositivo no soporta grabación, no rompemos la prueba.
    try {
      await driver.startRecordingScreen({timeLimit: 1800});
    } catch (err) {
      console.warn('No se pudo iniciar la grabación de pantalla:', err.message);
    }
  },

  afterTest: async function (test, context, {passed}) {
    const allure = require('@wdio/allure-reporter').default;

    // Detiene la grabación y guarda/adjunta el MP4 (best-effort)
    try {
      const base64Video = await driver.stopRecordingScreen();
      if (base64Video) {
        if (!fs.existsSync(VIDEO_DIR)) {
          fs.mkdirSync(VIDEO_DIR, {recursive: true});
        }
        const status = passed ? 'PASS' : 'FAIL';
        const safeName = test.title.replace(/[^a-z0-9]+/gi, '_').slice(0, 60);
        const filePath = path.join(VIDEO_DIR, `${status}__${safeName}.mp4`);
        fs.writeFileSync(filePath, Buffer.from(base64Video, 'base64'));
        allure.addAttachment('Video evidencia', Buffer.from(base64Video, 'base64'), 'video/mp4');
      }
    } catch (err) {
      console.warn('No se pudo guardar el video:', err.message);
    }

    // Si la prueba falló, también adjunta una captura de pantalla
    if (!passed) {
      try {
        const screenshot = await driver.takeScreenshot();
        allure.addAttachment('Captura del fallo', Buffer.from(screenshot, 'base64'), 'image/png');
      } catch (err) {
        console.warn('No se pudo tomar la captura del fallo:', err.message);
      }
    }
  },

  // --- Aviso a Slack al terminar toda la suite -------------------------------
  onComplete: async function (exitCode, config, capabilities, results) {
    // En CI el aviso lo envía el workflow (con enlaces al reporte y a la corrida),
    // así que aquí solo notificamos en corridas LOCALES para no duplicar mensajes.
    if (process.env.GITHUB_ACTIONS) {
      return;
    }
    const {sendSlackMessage} = require('./helpers/slack');
    await sendSlackMessage({
      passed: (results && results.passed) || 0,
      failed: (results && results.failed) || 0,
      source: 'local',
    });
  },
};
