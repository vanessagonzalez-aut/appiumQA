const fs = require('node:fs');
const path = require('node:path');
const {getConnectedDevices} = require('./helpers/devices');
const {getApkInfo, isAppInstalled} = require('./helpers/app');

const APP_PATH = process.env.APP_PATH
  ? path.resolve(process.env.APP_PATH)
  : path.resolve(__dirname, 'app-staging-release - 6.1.4 (1584).apk');

const VIDEO_DIR = path.resolve(__dirname, 'videos');

// Detecta los dispositivos conectados una sola vez por proceso launcher y los
// comparte con los workers vía env var (ver helpers/devices.js para el retry).
function detectDevices() {
  const devices = process.env.WDIO_DETECTED_DEVICES
    ? process.env.WDIO_DETECTED_DEVICES.split(',')
    : getConnectedDevices();
  if (devices.length === 0) {
    throw new Error(
      'No hay dispositivos conectados. Levanta un emulador (o conecta un teléfono) y verifica con `adb devices`.'
    );
  }
  process.env.WDIO_DETECTED_DEVICES = devices.join(',');
  return devices;
}

// Una capability por dispositivo. `specsByDevice[i]` son los specs que le tocan al dispositivo i.
function buildCapabilities(devices, specsByDevice) {
  const apkInfo = getApkInfo(APP_PATH);
  const forceInstall = process.env.APP_FORCE_INSTALL === '1';

  return devices.map((udid, i) => {
    const cap = {
      maxInstances: 1,
      platformName: 'Android',
      'appium:automationName': 'UiAutomator2',
      'appium:udid': udid,
      'appium:noReset': true,
      'appium:fullReset': false,
      'appium:systemPort': 8200 + i,
      'appium:mjpegServerPort': 7810 + i,
      'appium:androidInstallTimeout': 300000,
      'appium:newCommandTimeout': 300000,
      'appium:chromedriverAutoDownload': true,
      'appium:settings[stylus_handwriting_enabled]': false,
      specs: specsByDevice[i] || [],
    };

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
}

// Config base compartida entre la fase de setup y la fase en paralelo.
// `notifySlack: false` evita mandar aviso. `notifyOnlyOnFailure: true` manda
// aviso solo si la fase falló (usado en setup: si pasa, se queda callado y
// el único mensaje final lo manda la fase en paralelo).
function baseConfig({devices, capabilities, specs, notifySlack = true, notifyOnlyOnFailure = false, source = 'local'}) {
  return {
    runner: 'local',
    hostname: process.env.APPIUM_HOST || 'localhost',
    port: parseInt(process.env.APPIUM_PORT, 10) || 4723,
    path: '/',

    specs,
    exclude: [],
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

    beforeTest: async function () {
      try {
        await driver.startRecordingScreen({timeLimit: 1800});
      } catch (err) {
        console.warn('No se pudo iniciar la grabación de pantalla:', err.message);
      }
    },

    afterTest: async function (test, context, {passed}) {
      const allure = require('@wdio/allure-reporter').default;
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

      if (!passed) {
        try {
          const screenshot = await driver.takeScreenshot();
          allure.addAttachment('Captura del fallo', Buffer.from(screenshot, 'base64'), 'image/png');
        } catch (err) {
          console.warn('No se pudo tomar la captura del fallo:', err.message);
        }
      }
    },

    onComplete: async function (exitCode, config, capabilities, results) {
      if (process.env.GITHUB_ACTIONS || !notifySlack) {
        return;
      }
      const failed = (results && results.failed) || 0;
      if (notifyOnlyOnFailure && failed === 0) {
        return;
      }
      const {sendSlackMessage} = require('./helpers/slack');
      await sendSlackMessage({
        passed: (results && results.passed) || 0,
        failed,
        source,
      });
    },
  };
}

module.exports = {detectDevices, buildCapabilities, baseConfig};
