const {expect, driver} = require('@wdio/globals');
const path = require('node:path');
const fs = require('node:fs');
const {execSync} = require('node:child_process');
const {branch, email} = require('../../urls')
const webSelectors = require('../../selectors')
const mainFunctions = require('../../mainFunctions')


describe('Travel doc pre and post payment are working correctly', () => {
  const APP_ID = 'com.ivisa.services.stg';
  beforeEach(async () => {
    const state = await driver.queryAppState(APP_ID);
    // estados: 0=no instalada, 1=no corriendo, 2=segundo plano, 3=suspendida, 4=primer plano
    if (state >= 2) {
      await driver.terminateApp(APP_ID); // cierra la app (y su ventana)
    }
    await driver.activateApp(APP_ID); // abre la app antes de empezar las validaciones
    await mainFunctions.dismissStylusDialog(driver);
  });
  it('Navigate through an india application without errors', async () => {

    await mainFunctions.uploadImageToDevice(driver, 'passport.jpeg')
    await mainFunctions.waitInitialScreen(driver)
    let existingAccount = true;
    const doesntExist = await driver.$('~Start a New Application').isExisting()
  
    if (doesntExist){
      const checkHomepage = await driver.$('~Unlock the World').isExisting()
      existingAccount = false;
      console.log('Account already exists')
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
      await mainFunctions.scrollDown(driver)

      await driver.$('~API URLs').click()
      const branchInput = await driver.$('android=new UiSelector().className("android.widget.EditText").instance(0)')
      await branchInput.click()
      await driver.pause(500)
      await mainFunctions.typeText(driver,branch)
      await driver.hideKeyboard()
      await driver.$('~Confirm').click()
      await driver.$('~Welcome').waitForExist({ timeout: 5000 });
      await driver.$('~homeOutline').click()
      await driver.pause(3000)
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
    console.log(existingAccount)
    if(existingAccount){
      await driver.$('~Select travelers').waitForExist()
      await driver.$('~Continue to Application').click()
    }else{
      await driver.$('~Upload file').click()
      await driver.$('~Browse Files').click()
      await mainFunctions.pickFileFromDevice(driver, 'passport.jpeg')
      await driver.$('~Personal details').waitForDisplayed({ timeout: 60000})
      await mainFunctions.scrollDown(driver)
      await driver.$('~Gender\nSelect\nchevronDown, tap for more information on the below field').click()
      await driver.$('~Female').click()
      await driver.$('~Save and Continue').click()
      await driver.$('~Passport details').waitForDisplayed()
      await driver.$('~Save and Continue').click()
    }
    await driver.$('~Additional information').waitForDisplayed()
    await driver.$('~Are you employed?\nSelect\nchevronDown, tap for more information on the below field').click()
    await driver.$('~Yes').click()
    await driver.$('~Have you ever been convicted of a criminal offense?\nSelect\nchevronDown, tap for more information on the below field').click({x: 20, y: 20})
    await driver.$('~No').click()
    await mainFunctions.scrollDown(driver)
    await driver.$('~Reason for trip\nSelect\nchevronDown, tap for more information on the below field').click()
    await driver.$('~Tourism').click()
    await driver.$('~Do you have confirmed travel plans?\nSelect\nchevronDown, tap for more information on the below field').click()
    await driver.$('~No').click()
    await driver.$('~Save and Continue').click()

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

    if (existingAccount === false){
      await driver.$('android=new UiSelector().className("android.widget.EditText").instance(1)').click()
      await mainFunctions.typeText(driver,email)
      await driver.hideKeyboard()
    }
    await driver.$('~Continue to payment').click()
    await mainFunctions.primerCheckout(driver, '4000000000000010')
    await mainFunctions.switchToWebView(driver)
    await webSelectors.arrivalDate(driver, 'general.arrival_date')
    await webSelectors.dropdownSelectors(driver, 'general.port_of_arrival', 'dropdown-general.port_of_arrival', 'agatti', 'Agatti Seaport – Agatti Island')
    await webSelectors.dropdownSelectors(driver, 'general.ten_years_countries.0.country_where_boarded', 'dropdown-general.ten_years_countries.0.country_where_boarded', 'mexico', 'MX')
    const nextPostPayment = await driver.$('#btnContinueUnderSection')
    await nextPostPayment.click()
    await webSelectors.addressApi(driver,'applicant.0.home_address')
    await nextPostPayment.click()
    await webSelectors.dropdownSelectors(driver, 'applicant.0.religion', 'dropdown-applicant.0.religion', 'bahai', 'Bahai')
    await webSelectors.booleanOptions(driver, "applicant.0.marital_status", "option-Single")
    await webSelectors.dropdownSelectors(driver, 'applicant.0.birth_country', 'dropdown-applicant.0.birth_country', 'mexico', 'MX')
    await nextPostPayment.click()
    
    await webSelectors.booleanOptions(driver, "applicant.0.occupation", "option-Unemployed")
    await nextPostPayment.click()

    await webSelectors.booleanOptions(driver, "applicant.0.applicable_statement", "option-No, I don’t know their names")
    await nextPostPayment.click()
    
    await mainFunctions.uploadImageToDevice(driver, 'applicant.jpg')
    await webSelectors.fileUploadApplicant(driver)
  });
});
