const path = require('node:path');
const fs = require('node:fs');
async function typeText(driver,text) {
  await driver.execute('mobile: type', { text: text + ' ' })
  await driver.execute('mobile: pressKey', { keycode: 67 })

}

async function hideKeyboardSafely(driver) {
  try {
    const isShown = await driver.isKeyboardShown()
    if (isShown) await driver.hideKeyboard()
  } catch {
    // Algunos IME de dispositivos físicos no soportan ocultar el teclado; lo ignoramos
  }
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
async function switchToNativeApp(driver) {
  await driver.switchContext('NATIVE_APP')
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

async function primerCheckout(driver, cc, shouldExist) {
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
  //await hideKeyboardSafely(driver)
  try{
    await driver.$('android=new UiSelector().resourceId("com.ivisa.services.stg:id/card_form_postal_code_input")').waitForDisplayed({timeout: 2000})
    await driver.$('android=new UiSelector().resourceId("com.ivisa.services.stg:id/card_form_postal_code_input")').click()
    await typeText(driver,'12345')
    await hideKeyboardSafely(driver)
  }catch{

  }
  await driver.$('android=new UiSelector().resourceId("com.ivisa.services.stg:id/btnSubmitForm")').click()
  await driver.$('~Processing payment...').waitForDisplayed({timeout: 40000})
  await driver.$('~Payment successful!').waitForDisplayed({timeout: 40000})
  if(shouldExist){
    try{
      await driver.$("~Welcome back").waitForDisplayed({timeout: 10000})
      await driver.$('android=new UiSelector().className("android.widget.EditText").instance(1)').click()
      await typeText(driver, 'testivisa5!')
      await hideKeyboardSafely(driver)
      await driver.$('~Continue').click()
    }catch{

    }
  }
  
}
async function spreedly(driver) {
  const ccNumber = await driver.$('~accepted credit cards\nVisa\nMastercard\nAmerican Express\nDiscover')
  await ccNumber.click()
  await typeText ('4111111111111111')
  const expiration = await driver.$('android=new UiSelector().className("android.widget.EditText").instance(1)')
  await expiration.click()
  await typeText('1028')
  const cvv = await driver.$('android=new UiSelector().className("android.widget.EditText").instance(2)')
  await cvv.click()
  await typeText('123')
  const cardholderName = await driver.$('android=new UiSelector().className("android.widget.EditText").instance(3)')
  await cardholderName.click()
  await typeText ('Jhon')
  await driver.$('android=new UiSelector().className("android.widget.EditText").instance(5)').click()
  await typeText(email)
  await driver.$('~solidLock').click()
}
async function checkDeviceUpload(driver) {
  try{
    await await driver.$(`android=new UiSelector().text("Selector de medios")`).waitForDisplayed({timeout: 5000})
    await await driver.$(`android=new UiSelector().text("Selector de medios")`).click()
  }catch{
  }
}
async function checkExistingAccount(driver, firstTime, doesntExist, branch) {
  if (firstTime){
    await driver.$('~Choose your language').waitForDisplayed()
    await driver.$('~Confirm').click()
    await driver.$('~Continue').click()
    await driver.$('~Skip').click()
    await driver.$('~back').click()
    await driver.$('~userOutline').click()
    await driver.$('~solidSettings').click()
    await scrollDown(driver)
    await driver.$('~API URLs').click()
    const branchInput = await driver.$('android=new UiSelector().className("android.widget.EditText").instance(0)')
    await branchInput.click()
    await driver.pause(500)
    await typeText(driver,branch)
    await hideKeyboardSafely(driver)
    await driver.$('~Confirm').click()
    await driver.$('~Welcome').waitForExist({ timeout: 5000 });
    await driver.$('~homeOutline').click()
    await driver.pause(3000)
    return false
  }else if(doesntExist){
    await driver.$('~userOutline').click()
    await driver.$('~solidSettings').click()
    await scrollDown(driver)
    await driver.$('~API URLs').click()
    const branchInput = await driver.$('android=new UiSelector().className("android.widget.EditText").instance(0)')
    await branchInput.click()
    await driver.pause(500)
    await typeText(driver,branch)
    await hideKeyboardSafely(driver)
    await driver.$('~Confirm').click()
    await driver.$('~Welcome').waitForExist({ timeout: 5000 });
    await driver.$('~homeOutline').click()
    await driver.pause(3000)
    return false
  }
  return true
}

async function checkIfAppIsOpen(driver, APP_ID) {
  const state = await driver.queryAppState(APP_ID);
  // estados: 0=no instalada, 1=no corriendo, 2=segundo plano, 3=suspendida, 4=primer plano
  if (state >= 2) {
    await driver.terminateApp(APP_ID); // cierra la app (y su ventana)
  }
  await driver.activateApp(APP_ID); // abre la app antes de empezar las validaciones
  await dismissStylusDialog(driver);
}

async function checkNotificationScreen(driver) {
    const notifSkip = await driver.$('~Skip');
    try {
      await notifSkip.waitForExist({ timeout: 5000 });
      await notifSkip.click();
    } catch {
      // No apareció la pantalla de notificaciones; seguimos
    }
}

async function changeUserNationalityS1(driver, nationality, destination) {
 try{
    await driver.$('~My passport is from\nUnited States\nsolidPassport, tap for more information on the below field').waitForExist({ timeout: 3000 });
    await driver.$('~My passport is from\nUnited States\nsolidPassport, tap for more information on the below field').click()
  }catch{
    await driver.$('~My passport is from\nMexico\nsolidPassport, tap for more information on the below field').waitForExist({ timeout: 3000 });
    await driver.$('~My passport is from\nMexico\nsolidPassport, tap for more information on the below field').click()
  }

  const countryInput = 'new UiSelector().className("android.widget.EditText").instance(1)'
  await driver.$(`android=${countryInput}`).addValue(`${nationality}`)
  await driver.$(`~${nationality}`).click()
  await driver.$("~I'm going to\nSelect\nsearchOutline, tap for more information on the below field").click()
  await driver.$(`android=${countryInput}`).addValue(`${destination}`)
  await driver.$(`~${destination}`).click()
  await driver.$('~Get Started!').click()

  try {
    await driver.$('~Apply now').waitForExist({ timeout: 3000 });
    await driver.$('~Apply now').click();
  } catch {
    await driver.$('~Save and Continue').click()
  }
}

async function passportScanPre(driver, selector) {
  await driver.$(`~${selector}`).click()
  await driver.$('~Browse Files').click()
  await pickFileFromDevice(driver, 'passport.jpeg')
}

async function additionalInfoStep(driver) {
  await driver.$('~Are you employed?\nSelect\nchevronDown, tap for more information on the below field').click()
  await driver.$('~Yes').click()
  await driver.$('~Have you ever been convicted of a criminal offense?\nSelect\nchevronDown, tap for more information on the below field').click({x: 20, y: 20})
  await driver.$('~No').click()
  await scrollDown(driver)
  await driver.$('~Reason for trip\nSelect\nchevronDown, tap for more information on the below field').click()
  await driver.$('~Tourism').click()
  await driver.$('~Do you have confirmed travel plans?\nSelect\nchevronDown, tap for more information on the below field').click()
  await driver.$('~No').click()
}

async function checkDuplicateBanner(driver) {
  try{
    const duplicateBanner = await driver.$('~Continue with purchase')
    await duplicateBanner.waitForDisplayed({timeout: 5000})
    await duplicateBanner.click()
  }catch{
  }
}

async function postPaymentProcess(driver) {
  await driver.$('~Go Home').waitForDisplayed({timeout: 30000})
  await driver.$('~Go Home').click()
  await driver.$("~How easy or difficult was it to complete your application?").waitForDisplayed({timeout: 5000})
  await driver.$('~closeOutline').click()
  try{
    await driver.$("~Ask me later").waitForDisplayed({timeout: 5000})
    await driver.$("~Ask me later").click()
    await driver.$("~Not this time, thanks").waitForDisplayed({timeout: 3000})
    await driver.$("~Not this time, thanks").click()
  }catch{
    if(await driver.$("~Not this time, thanks").isDisplayed()){
      await driver.$("~Not this time, thanks").waitForDisplayed({timeout: 5000})
      await driver.$("~Not this time, thanks").click()
      await driver.$("~Ask me later").waitForDisplayed({timeout: 5000})
      await driver.$("~Ask me later").click()
    }
  }
  await driver.$("~Start a New Application").waitForDisplayed({timeout: 5000})
}

async function existingAccountEditInfo(driver) {
  await driver.$('~Select travelers').waitForExist()
  await driver.$('~Continue to Application').click()
  await driver.$('~solidEdit').click()
  try{
    await driver.$('~Ok').waitForDisplayed({ timeout: 5000})
    await driver.$('~Ok').click()
    await driver.$('~Gender\nSelect\nchevronDown\nThis field cannot be empty, tap for more information on the below field').click()
    await driver.$('~Female').click()
    await scrollDown(driver)
    await driver.$('~Country of residence\nSelect\nchevronDown\nThis field cannot be empty, tap for more information on the below field').click()
    const countryInput = 'new UiSelector().className("android.widget.EditText").instance(1)'
    await driver.$(`android=${countryInput}`).click()
    await typeText(driver, 'Mexico')
    await driver.$(`~Mexico`).click()
    await driver.pause(2000)
    await scrollDown(driver)
    await driver.$('~Are you employed?\nSelect\nchevronDown\nThis field cannot be empty, tap for more information on the below field').click()
    await driver.$('~Yes').click()
    await driver.$('~Have you ever been convicted of a criminal offense?\nSelect\nchevronDown\nThis field cannot be empty, tap for more information on the below field').click({x: 20, y: 20})
    await driver.$('~No').click()
    await scrollDown(driver)
    await driver.$('~Reason for trip\nSelect\nchevronDown\nThis field cannot be empty, tap for more information on the below field').click()
    await driver.$('~Tourism').click()
    await driver.$('~Do you have confirmed travel plans?\nSelect\nchevronDown\nThis field cannot be empty, tap for more information on the below field').click()
    await driver.$('~No').click()
    await driver.$('~Save Changes').click()
    await additionalInfoStep(driver)
  }catch{
    await scrollDown(driver)
    await additionalInfoStep(driver)
    await driver.$('~Save Changes').click()
  }
}
async function nonExistingAccountInfo(driver, scanCopy) {
  await passportScanPre(driver, scanCopy)
  await driver.$('~Personal details').waitForDisplayed({ timeout: 60000})
  await scrollDown(driver)
  await driver.$('~Gender\nSelect\nchevronDown, tap for more information on the below field').click()
  await driver.$('~Female').click()
  await driver.$('~Save and Continue').click()
  await driver.$('~Passport details').waitForDisplayed()
  await driver.$('~Passport\nAustralia\nchevronDown, tap for more information on the below field').click()
  const countryInput = 'new UiSelector().className("android.widget.EditText").instance(1)'
  await driver.$(`android=${countryInput}`).addValue('mexico')
  await driver.$('~Mexico').click()
  await driver.$('~Save and Continue').click()
  await driver.$('~Additional information').waitForDisplayed()
  await additionalInfoStep(driver)
  await driver.$('~Save and Continue').click()
}
module.exports = {
  typeText,
  hideKeyboardSafely,
  switchToWebView,
  switchToNativeApp,
  dismissStylusDialog,
  uploadImageToDevice,
  pickFileFromDevice,
  waitInitialScreen,
  primerCheckout,
  scrollDown,
  checkDeviceUpload,
  checkExistingAccount,
  checkIfAppIsOpen,
  checkNotificationScreen,
  passportScanPre,
  additionalInfoStep,
  checkDuplicateBanner,
  changeUserNationalityS1,
  postPaymentProcess, 
  existingAccountEditInfo,
  nonExistingAccountInfo
}