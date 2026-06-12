const {remote} = require('webdriverio');

const capabilities = {
  platformName: 'Android',
  'appium:automationName': 'UiAutomator2',
  'appium:deviceName': 'Android',
  'appium:app': 'C:/Users/vanei/OneDrive/Desktop/appium/app-staging-release - 6.1.0 (1536).apk',
  // La instalación del APK tardó >90s; le damos más margen
  'appium:androidInstallTimeout': 300000,
  // Espera a que Appium termine de crear la sesión antes de rendirse
  'appium:newCommandTimeout': 300000,
};

const wdOpts = {
  hostname: process.env.APPIUM_HOST || 'localhost',
  port: parseInt(process.env.APPIUM_PORT, 10) || 4723,
  logLevel: 'info',
  connectionRetryTimeout: 360000,
  connectionRetryCount: 1,
  capabilities,
};

async function runTest() {
  const driver = await remote(wdOpts);
  try {
    const langScreen = await driver.$('~Choose your language')
    await langScreen.waitForDisplayed()
    const langScreenCta = await driver.$('~Confirm')
    await langScreenCta.click()
    await driver.pause(5000);
  } finally {
    await driver.deleteSession();
  }
}

runTest().catch(console.error);
