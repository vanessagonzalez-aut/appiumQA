const {expect, driver} = require('@wdio/globals');
const path = require('node:path');
const fs = require('node:fs');
const {execSync} = require('node:child_process');

describe('Travel doc pre and post payment are working correctly', () => {
  const APP_ID = 'com.ivisa.services.stg';
  beforeEach(async () => {
    const state = await driver.queryAppState(APP_ID);
    // estados: 0=no instalada, 1=no corriendo, 2=segundo plano, 3=suspendida, 4=primer plano
    if (state >= 2) {
      await driver.terminateApp(APP_ID); // cierra la app (y su ventana)
    }
    await driver.activateApp(APP_ID); // abre la app antes de empezar las validaciones
  });

  it('Navigate through an india application without errors', async () => {
    const localImage = path.resolve(__dirname, '../../images/passport.jpeg');
    const remoteImage = '/sdcard/Download/passport.jpeg';
    let imageAlreadyOnDevice = false;
    try {
      await driver.pullFile(remoteImage);
      imageAlreadyOnDevice = true;
    } catch {
      imageAlreadyOnDevice = false;
    }
    if (!imageAlreadyOnDevice) {
      await driver.pushFile(remoteImage, fs.readFileSync(localImage).toString('base64'));
      // Forzar el escaneo de medios para que el selector de archivos VEA la imagen.
      // Sin esto, en un emulador limpio (CI) el archivo existe pero no está indexado
      // en MediaStore y no aparece en el selector. Best-effort: si falla, seguimos.
      try {
        const caps = await driver.capabilities;
        const udid = caps['appium:udid'] || caps.udid || caps.deviceUDID;
        const target = udid ? `-s ${udid}` : '';
        execSync(
          `adb ${target} shell am broadcast -a android.intent.action.MEDIA_SCANNER_SCAN_FILE -d file://${remoteImage}`,
          {stdio: 'ignore'}
        );
      } catch {
        // En local la imagen suele ya estar indexada; ignoramos el fallo del escaneo
      }
    }
    // Espera a que la app TERMINE de cargar: aparece la pantalla inicial
    await driver.waitUntil(
      async () =>
        (await driver.$('~Unlock the World').isExisting()) ||
        (await driver.$('~Choose your language').isExisting()),
      {
        timeout: 60000,
        interval: 1000,
        timeoutMsg: 'La app no cargó la pantalla inicial en 60s',
      }
    );
    const checkHomepage = await driver.$('~Unlock the World').isExisting()
    if(!checkHomepage){
      await driver.$('~Choose your language').waitForDisplayed()
      await driver.$('~Confirm').click()
      await driver.$('~Continue').click()
      await driver.$('~Skip').click()
    }else{
      await driver.$('~Start a New Application').click()
    }
    const notifSkip = await driver.$('~Skip');
    try {
      await notifSkip.waitForExist({ timeout: 10000 });
      await notifSkip.click();
    } catch {
      // No apareció la pantalla de notificaciones; seguimos
    }
    await driver.$('~My passport is from\nUnited States\nsolidPassport, tap for more information on the below field').click()
    const countryInput = 'new UiSelector().className("android.widget.EditText").instance(1)'
    await driver.$(`android=${countryInput}`).addValue('mexico')
    await driver.$('~Mexico').click()
    await driver.$("~I'm going to\nSelect\nsearchOutline, tap for more information on the below field").click()
    await driver.$(`android=${countryInput}`).addValue('india')
    await driver.$('~India').click()
    await driver.$('~Get Started!').click()
    try {
      await driver.$('~Apply now').waitForExist({ timeout: 5000 });
      await driver.$('~Apply now').click();
    } catch {
      await driver.$('~Save and Continue').click()
    }
    await driver.$('~Confirm').click()
    await driver.$('~Upload file').click()
    await driver.$('~Browse Files').click()
    // El selector del sistema abre en "Recientes", que está vacío para archivos
    // subidos por adb. Lo llevamos a Downloads y elegimos el archivo por su nombre.
    await driver.$('~Show roots').click()
    await driver.$('android=new UiSelector().resourceId("android:id/title").text("Downloads")').click()
    const file = await driver.$('~passport.jpeg')
    await file.waitForExist({ timeout: 20000 })
    await file.click()
    await driver.$('~Checking Image Quality ...').waitForDisplayed()
    await driver.$('~Personal details').waitForDisplayed({ timeout: 30000})
    await driver.$('~Save and Continue').click()
    await driver.$('~Passport details').waitForDisplayed()
    await driver.$('~Save and Continue').click()
    await driver.$('~Travelers').waitForDisplayed()
    await driver.$('~Save and Continue').click()
    await driver.$('~Choose your processing time').waitForDisplayed()
    await driver.$('~Save and Continue').click()
    await driver.$('~Order Review').waitForDisplayed()
    await driver.$('~Continue to payment').click()

  });
});
