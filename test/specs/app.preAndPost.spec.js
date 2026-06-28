const {expect, driver} = require('@wdio/globals');
const path = require('node:path');
const fs = require('node:fs');
const {execSync} = require('node:child_process');
const {branch, email} = require('../../urls')
const webSelectors = require('../../selectors')

async function typeText(text) {
  await driver.execute('mobile: type', { text: text + ' ' })
  await driver.execute('mobile: pressKey', { keycode: 67 })
}

async function switchToWebView() {
  await driver.waitUntil(async () => {
    const contexts = await driver.getContexts()
    return contexts.some(c => c.includes('WEBVIEW'))
  }, { timeout: 15000, interval: 1000, timeoutMsg: 'WebView no apareció en 15s' })
  const contexts = await driver.getContexts()
  const webview = contexts.find(c => c.includes('WEBVIEW'))
  await driver.switchContext(webview)
}

async function dismissStylusDialog() {
  try {
    const caps = await driver.capabilities
    const udid = caps['appium:udid'] || caps.udid || ''
    const target = udid ? `-s ${udid}` : ''
    execSync(`adb ${target} shell settings put secure stylus_handwriting_enabled 0`, { stdio: 'ignore' })
  } catch {}
}

describe('Travel doc pre and post payment are working correctly', () => {
  const APP_ID = 'com.ivisa.services.stg';
  beforeEach(async () => {
    const state = await driver.queryAppState(APP_ID);
    // estados: 0=no instalada, 1=no corriendo, 2=segundo plano, 3=suspendida, 4=primer plano
    if (state >= 2) {
      await driver.terminateApp(APP_ID); // cierra la app (y su ventana)
    }
    await driver.activateApp(APP_ID); // abre la app antes de empezar las validaciones
    await dismissStylusDialog();
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
    let existingAccount = true;
    // Espera a que la app TERMINE de cargar: aparece la pantalla inicial
    await driver.waitUntil(
      async () =>
        (await driver.$('~Unlock the World').isExisting()) ||
        (await driver.$('~Choose your language').isExisting()) ||
        (await driver.$('~Start a New Application').isExisting()),
      {
        timeout: 60000,
        interval: 1000,
        timeoutMsg: 'La app no cargó la pantalla inicial en 60s',
      }
    );
    const alreadyExist = await driver.$('~Start a New Application').isExisting()
    if (!alreadyExist){
      const checkHomepage = await driver.$('~Unlock the World').isExisting()
      if(!checkHomepage){
        await driver.$('~Choose your language').waitForDisplayed()
        await driver.$('~Confirm').click()
        await driver.$('~Continue').click()
        await driver.$('~Skip').click()
        await driver.$('~back').click()
        await driver.$('~userOutline').click()
      }else{
        await driver.$('~userOutline').click()
      }
      await driver.$('~solidSettings').click()
      await driver.$('~API URLs').click()
      const branchInput = await driver.$('android=new UiSelector().className("android.widget.EditText").instance(0)')
      await branchInput.click()
      await driver.pause(500)
      await typeText(branch)
      await driver.$('~Confirm').click()
      await driver.$('~Welcome').waitForExist({ timeout: 5000 });
      await driver.$('~homeOutline').click()
      await driver.pause(3000)
      await driver.$('~Start a New Application').click()
      existingAccount = false;
    }
    await driver.$('~Start a New Application').click()
    const notifSkip = await driver.$('~Skip');
    try {
      await notifSkip.waitForExist({ timeout: 5000 });
      await notifSkip.click();
    } catch {
      // No apareció la pantalla de notificaciones; seguimos
    }
    try{
      await driver.$('~My passport is from\nUnited States\nsolidPassport, tap for more information on the below field').waitForExist({ timeout: 5000 });
      await driver.$('~My passport is from\nUnited States\nsolidPassport, tap for more information on the below field').click()
    }catch{
      await driver.$('~My passport is from\nMexico\nsolidPassport, tap for more information on the below field').waitForExist({ timeout: 5000 });
      await driver.$('~My passport is from\nMexico\nsolidPassport, tap for more information on the below field').click()
    }
    const countryInput = 'new UiSelector().className("android.widget.EditText").instance(1)'
    await driver.$(`android=${countryInput}`).addValue('mexico')
    await driver.$('~Mexico').click()
    await driver.$("~I'm going to\nSelect\nsearchOutline, tap for more information on the below field").click()
    await driver.$(`android=${countryInput}`).addValue('india')
    await driver.$('~India').click()
    await driver.$('~Get Started!').click()
    try {
      await driver.$('~Apply now').waitForExist({ timeout: 3000 });
      await driver.$('~Apply now').click();
    } catch {
      await driver.$('~Save and Continue').click()
    }
    await driver.$('~Confirm').click()
    if(existingAccount){
      await driver.$('~Select travelers').waitForExist()
      await driver.$('~Continue to Application').click()
    }else{
      await driver.$('~Upload file').click()
      await driver.$('~Browse Files').click()
      // El selector del sistema abre en "Recientes", que está vacío para archivos
      // subidos por adb. Lo llevamos a Downloads y elegimos el archivo por su nombre.
      await driver.$('~Show roots').click()
      await driver.$('android=new UiSelector().resourceId("android:id/title").text("Downloads")').click()
      const file = await driver.$('android=new UiSelector().resourceId("android:id/title").text("passport.jpeg")')
      await file.waitForExist({ timeout: 20000 })
      await file.click()
      await driver.$('~Checking Image Quality ...').waitForDisplayed()
      await driver.$('~Personal details').waitForDisplayed({ timeout: 30000})
      await driver.$('~Save and Continue').click()
      await driver.$('~Passport details').waitForDisplayed()
      await driver.$('~Save and Continue').click()
    }
    await driver.$('~Travelers').waitForDisplayed()
    await driver.$('~Save and Continue').click()
    await driver.$('~Choose your processing time').waitForDisplayed()
    await driver.$('~Save and Continue').click()
    try{
      const duplicateBanner = await driver.$('~Continue with purchase')
      await duplicateBanner.waitForDisplayed({timeout: 5000})
      await duplicateBanner.click()
    }catch{

    }
    await driver.$('~Order Review').waitForDisplayed()
    try{
      if (existingAccount === false){
        await driver.$('android=new UiSelector().className("android.widget.EditText").instance(1)').click()
        await typeText(email)
        await driver.hideKeyboard()
      }
      await driver.$('~Continue to payment').click()
      await driver.$('android=new UiSelector().resourceId("com.ivisa.services.stg:id/card_preview_button_text")').waitForDisplayed({timeout: 30000})
      await driver.$('android=new UiSelector().resourceId("com.ivisa.services.stg:id/card_preview_button_text")').click()

      await driver.$('android=new UiSelector().resourceId("com.ivisa.services.stg:id/card_form_card_number_input")').click()
      await typeText('4000000000000010')
      await driver.$('android=new UiSelector().resourceId("com.ivisa.services.stg:id/card_form_card_expiry_input")').click()
      await typeText('1028')
      await driver.$('android=new UiSelector().resourceId("com.ivisa.services.stg:id/card_form_card_cvv_input")').click()
      await typeText('123')
      await driver.$('android=new UiSelector().resourceId("com.ivisa.services.stg:id/card_form_cardholder_name_input")').click()
      await typeText('Jhon')
      await driver.pause(3000)
      await driver.$('android=new UiSelector().resourceId("com.ivisa.services.stg:id/btnSubmitForm")').click()
      await driver.$('~Processing payment...').waitForDisplayed({timeout: 30000})
      await driver.$('~Payment successful!').waitForDisplayed({timeout:30000})
    }catch{
      const ccNumber = await driver.$('~accepted credit cards\nVisa\nMastercard\nAmerican Express\nDiscover')
      await ccNumber.click()
      await typeText('4111111111111111')
      const expiration = await driver.$('android=new UiSelector().className("android.widget.EditText").instance(1)')
      await expiration.click()
      await typeText('1028')
      const cvv = await driver.$('android=new UiSelector().className("android.widget.EditText").instance(2)')
      await cvv.click()
      await typeText('123')
      const cardholderName = await driver.$('android=new UiSelector().className("android.widget.EditText").instance(3)')
      await cardholderName.click()
      await typeText('Jhon')
      await driver.$('android=new UiSelector().className("android.widget.EditText").instance(5)').click()
      await typeText(email)
      await driver.$('~solidLock').click()
    }
    /*
    await switchToWebView()
    await driver.switchContext('NATIVE_APP')
    await webSelectors.arrivalDate(driver, 'general.arrival_date')
    */
  });
});
