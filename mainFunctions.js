const path = require('node:path');
const fs = require('node:fs');
async function typeText(driver,text) {
  await driver.execute('mobile: type', { text: text + ' ' })
  await driver.execute('mobile: pressKey', { keycode: 67 })

}

async function switchToWebView(driver) {
  await driver.waitUntil(async () => {
    const contexts = await driver.getContexts()
    return contexts.some(c => c.includes('WEBVIEW'))
  }, { timeout: 20000, interval: 1000, timeoutMsg: 'WebView no apareció en 15s' })
  const contexts = await driver.getContexts()
  const webview = contexts.find(c => c.includes('WEBVIEW'))
  await driver.switchContext(webview)
}
async function scrollDown(driver) {
  const { width, height } = await driver.getWindowSize()
  await driver.execute('mobile: scrollGesture', {
    left: width * 0.1,
    top: height * 0.2,
    width: width * 0.8,
    height: height * 0.6,
    direction: 'down',
    percent: 0.75,
  })
}

async function dismissStylusDialog(driver) {
  try {
    const caps = await driver.capabilities
    const udid = caps['appium:udid'] || caps.udid || ''
    const target = udid ? `-s ${udid}` : ''
    execSync(`adb ${target} shell settings put secure stylus_handwriting_enabled 0`, { stdio: 'ignore' })
  } catch {}
}

async function uploadImageToDevice(driver, imgName) {
  const localImage = path.resolve(__dirname, 'images/' + imgName);
  const remoteImage = '/sdcard/Download/' + imgName;
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
}

// Navega el selector de archivos nativo de Android y elige el archivo por nombre.
// Distintos fabricantes (Samsung, MIUI, etc.) usan pickers distintos al AOSP del
// emulador, así que intentamos varias rutas antes de rendirnos.
async function pickFileFromDevice(driver, fileName) {
  // Ruta 1: AOSP DocumentsUI (emulador) -> Show roots -> Downloads -> archivo
  try {
    await driver.$('~Show roots').waitForExist({ timeout: 5000 })
    await driver.$('~Show roots').click()
    await driver.$('android=new UiSelector().resourceId("android:id/title").text("Downloads")').click()
    const file = await driver.$(`android=new UiSelector().resourceId("android:id/title").text("${fileName}")`)
    await file.waitForExist({ timeout: 10000 })
    await file.click()
    return
  } catch {
    // Este picker no tiene "Show roots" (dispositivo físico con picker del fabricante)
  }

  // Ruta 2: el archivo ya es visible en la vista inicial (p.ej. "Recientes")
  try {
    const fileByText = await driver.$(`android=new UiSelector().textContains("${fileName}")`)
    await fileByText.waitForExist({ timeout: 5000 })
    await fileByText.click()
    return
  } catch {
    // No está visible directamente
  }

  // Ruta 3: usar el buscador del picker (casi universal entre fabricantes)
  await driver.$('~Search').click()
  await typeText(driver, fileName)
  const searchResult = await driver.$(`android=new UiSelector().textContains("${fileName}")`)
  await searchResult.waitForExist({ timeout: 10000 })
  await searchResult.click()
}

async function waitInitialScreen(driver) {
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
}

async function primerCheckout(driver, cc) {
  await driver.$('android=new UiSelector().resourceId("com.ivisa.services.stg:id/card_preview_button_text")').waitForDisplayed({timeout: 30000})
  await driver.$('android=new UiSelector().resourceId("com.ivisa.services.stg:id/card_preview_button_text")').click()
  await driver.$('android=new UiSelector().resourceId("com.ivisa.services.stg:id/card_form_card_number_input")').click()
  await typeText(driver, cc)
  await driver.$('android=new UiSelector().resourceId("com.ivisa.services.stg:id/card_form_card_expiry_input")').click()
  await typeText(driver,'1028')
  await driver.$('android=new UiSelector().resourceId("com.ivisa.services.stg:id/card_form_card_cvv_input")').click()
  await typeText(driver,'123')
  await driver.$('android=new UiSelector().resourceId("com.ivisa.services.stg:id/card_form_cardholder_name_input")').click()
  await typeText(driver,'Jhon')
  await driver.pause(3000)
  await driver.hideKeyboard()
  await driver.$('android=new UiSelector().resourceId("com.ivisa.services.stg:id/card_form_postal_code_input")').click()
  await typeText(driver,'12345')
  await driver.hideKeyboard()
  await driver.$('android=new UiSelector().resourceId("com.ivisa.services.stg:id/btnSubmitForm")').click()
  await driver.$('~Processing payment...').waitForDisplayed({timeout: 40000})
  await driver.$('~Payment successful!').waitForDisplayed({timeout: 40000})
}

async function spreedly(driver) {
  const ccNumber = await driver.$('~accepted credit cards\nVisa\nMastercard\nAmerican Express\nDiscover')
  await ccNumber.click()
  await typeText ('4111111111111111')
  const expiration = await driver.$('android=new UiSelector().className("android.widget.EditText").instance(1)')
  await expiration.click()
  await typeText ('1028')
  const cvv = await driver.$('android=new UiSelector().className("android.widget.EditText").instance(2)')
  await cvv.click()
  await typeText ('123')
  const cardholderName = await driver.$('android=new UiSelector().className("android.widget.EditText").instance(3)')
  await cardholderName.click()
  await typeText ('Jhon')
  await driver.$('android=new UiSelector().className("android.widget.EditText").instance(5)').click()
  await typeText(email)
  await driver.$('~solidLock').click()
}
module.exports = {
    typeText,
    switchToWebView,
    dismissStylusDialog,
    uploadImageToDevice,
    pickFileFromDevice,
    waitInitialScreen,
    primerCheckout, 
    scrollDown
}