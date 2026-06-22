const {expect, driver} = require('@wdio/globals');
const path = require('node:path');
const fs = require('node:fs');

describe('Travel doc pre and post payment are working correctly', () => {
  const APP_ID = 'com.ivisa.services.stg';

  // Arranque limpio: antes de cada prueba, si la app está abierta la cerramos
  // y la volvemos a abrir desde cero, para que las validaciones siempre empiecen
  // en la pantalla inicial.
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
    }
    await driver.pause(5000);
    const checkHomepage = await driver.$('~Unlock the World').isExisting()
    if(!checkHomepage){
      await driver.$('~Choose your language').waitForDisplayed()
      await driver.$('~Confirm').click()
      await driver.$('~Continue').click()
      await driver.$('~Skip').click()
    }else{
      await driver.$('~Start a New Application').click()
    }
    await driver.pause(3000);
    const checkNotifications = await driver.$('~Skip').isExisting()
    if(checkNotifications){
      await driver.$('~Skip').click()
    }
    await driver.$('~My passport is from\nUnited States\nsolidPassport, tap for more information on the below field').click()
    const countryInput = 'new UiSelector().className("android.widget.EditText").instance(1)'
    await driver.$(`android=${countryInput}`).addValue('mexico')
    await driver.$('~Mexico').click()
    await driver.$("~I'm going to\nSelect\nsearchOutline, tap for more information on the below field").click()
    await driver.$(`android=${countryInput}`).addValue('india')
    await driver.$('~India').click()
    await driver.$('~Get Started!').click()
    await driver.$('~Save and Continue').click()
    await driver.$('~Confirm').click()
    await driver.$('~Upload file').click()
    await driver.$('~Browse Files').click()
    await driver.$('id=com.google.android.documentsui:id/icon_thumb').click()
    await driver.$('~Checking Image Quality ...').waitForDisplayed()
    await driver.$('~Personal details').waitForDisplayed({ timeout: 30000})
  });
});
