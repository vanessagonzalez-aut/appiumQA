const {expect, driver} = require('@wdio/globals');
const path = require('node:path');
const fs = require('node:fs');
const {execSync} = require('node:child_process');
const {branch, email} = require('../../urls')
const webSelectors = require('../../selectors')
const mainFunctions = require('../../mainFunctions');
const { WASI } = require('node:wasi');


describe('Travel doc pre and post payment are working correctly', () => {
  const APP_ID = 'com.ivisa.services.stg';
  beforeEach(async () => {
    mainFunctions.checkIfAppIsOpen(driver, APP_ID)
  })
  it('Navigate through an india application without errors', async () => {
    await mainFunctions.uploadImageToDevice(driver, 'passport.jpeg')
    await mainFunctions.waitInitialScreen(driver)
    const doesntExist = await driver.$('~Unlock the World').isExisting()
    const firstTime = await driver.$('~Choose your language').isExisting()
    const accountExistResult = await mainFunctions.checkExistingAccount(driver, firstTime, doesntExist, branch)
    let existingAccount = accountExistResult;

    await driver.$('~Start a New Application').click()
    await mainFunctions.checkNotificationScreen(driver)
    await mainFunctions.changeUserNationalityS1(driver, "Mexico", 'India')
    await driver.$('~Confirm').click()
    
    if(existingAccount){
      await mainFunctions.existingAccountEditInfo(driver)
    }else{
      await mainFunctions.nonExistingAccountInfo(driver, 'Upload file')
    }
    await driver.$('~Save and Continue').click()
    try{
      await driver.$('~Choose your processing time').waitForDisplayed({timeout: 3000})
      await driver.$('~Save and Continue').click()
    }catch{

    }
    await driver.$('~Travelers').waitForDisplayed()
    await driver.$('~Save and Continue').click() 
    await mainFunctions.checkDuplicateBanner(driver)
    await driver.$('~Order Review').waitForDisplayed()

    if (existingAccount === false){
      await mainFunctions.scrollDown(driver)
      await driver.$('android=new UiSelector().className("android.widget.EditText").instance(1)').click()
      await mainFunctions.typeText(driver,email)
      await mainFunctions.hideKeyboardSafely(driver)
    }
    await driver.$('~Continue to payment').click()
    await mainFunctions.primerCheckout(driver, '4000000000000010', true)
  
    
    await mainFunctions.switchToWebView(driver)
    await driver.$(`input[name="general.arrival_date"]`).waitForDisplayed({timeout: 70000})
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
    await await driver.$('div[name="applicant.0.occupation"]').waitForDisplayed({timeout: 30000})
    await webSelectors.booleanOptions(driver, "applicant.0.occupation", "option-Unemployed")
    await nextPostPayment.click()

    await webSelectors.booleanOptions(driver, "applicant.0.applicable_statement", "option-No, I don’t know their names")
    await nextPostPayment.click()
      

    await mainFunctions.uploadImageToDevice(driver, 'applicant.jpg')
    await webSelectors.selectFileUploadOption(driver)
    await mainFunctions.switchToNativeApp(driver)
    await mainFunctions.checkDeviceUpload(driver)

    await webSelectors.fileUploadQuestion(driver, 'applicant.jpg')
    await mainFunctions.switchToWebView(driver)
    await driver.$("p=Your upload passed our initial review!").waitForDisplayed({timeout: 30000})
    const nextPostPaymentUpload = await driver.$('#review-continue')
    await nextPostPaymentUpload.click()

    await driver.$("p=Your upload passed our initial review!").waitForDisplayed({timeout: 30000})
    await nextPostPaymentUpload.click()
    await nextPostPayment.click()
    await webSelectors.contactDetails(driver)
    await driver.$('#btnSubmitApplication').click()

    await mainFunctions.switchToNativeApp(driver)
    await mainFunctions.postPaymentProcess(driver)
  });
});
