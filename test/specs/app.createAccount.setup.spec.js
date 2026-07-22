const {expect, driver} = require('@wdio/globals');
const path = require('node:path');
const fs = require('node:fs');
const {execSync} = require('node:child_process');
const {branch, email} = require('../../urls')
const webSelectors = require('../../selectors')
const mainFunctions = require('../../mainFunctions');
const { WASI } = require('node:wasi');


describe('Setup Account', () => {
  const APP_ID = 'com.ivisa.services.stg';
  beforeEach(async () => {
    mainFunctions.checkIfAppIsOpen(driver, APP_ID)
  })
  it('Setup account with password login for Turkey eVisa', async () => {
    await mainFunctions.uploadImageToDevice(driver, 'passport.jpeg')
    await mainFunctions.waitInitialScreen(driver)
    const doesntExist = await driver.$('~Unlock the World').isExisting()
    const firstTime = await driver.$('~Choose your language').isExisting()
    const accountExistResult = await mainFunctions.checkExistingAccount(driver, firstTime, doesntExist, branch)
    let existingAccount = accountExistResult;
    await driver.$('~Start a New Application').click()
    await mainFunctions.checkNotificationScreen(driver)
    await mainFunctions.changeUserNationalityS1(driver, "Mexico", 'Turkey')

    if(existingAccount){
      await mainFunctions.existingAccountEditInfo(driver)
    }else{
      await mainFunctions.nonExistingAccountInfo(driver, 'Scan passport to autofill')
    }
    await driver.$('~Travelers').waitForDisplayed()
    await driver.$('~Save and Continue').click()
    await driver.$('~Choose your processing time').waitForDisplayed()
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
    await mainFunctions.primerCheckout(driver, '4000000000000010')
    await mainFunctions.switchToWebView(driver)
    await driver.$(`input[name="general.arrival_date"]`).waitForDisplayed({timeout: 70000})
    await webSelectors.arrivalDate(driver, 'general.arrival_date')
    const nextPostPayment = await driver.$('#btnContinueUnderSection')
    await nextPostPayment.click()
    await driver.$(`input[name="applicant.0.passport_num"]`).waitForDisplayed()
    await nextPostPayment.click()
    await webSelectors.dropdownSelectors(driver, "applicant.0.birth_country", 'dropdown-applicant.0.birth_country', 'mexico', 'MX')
    await nextPostPayment.click()
    await webSelectors.contactDetails(driver)
    await driver.$('#btnSubmitApplication').click()
    await mainFunctions.switchToNativeApp(driver)
    await mainFunctions.postPaymentProcess(driver)
    await driver.$('~userOutline').click()
    await driver.$('~Security & Privacy\nSet up your password').click()
    await driver.$('~Change your password').click()
    await driver.$('~Not now').click()
    const passwordEnter = await driver.$('android=new UiSelector().className("android.widget.EditText").instance(1)')
    await passwordEnter.click()
    await mainFunctions.typeText(driver, 'testivisa5!')
    const passwordConfirm = await driver.$('android=new UiSelector().className("android.widget.EditText").instance(3)')
    await passwordConfirm.click()
    await mainFunctions.typeText(driver, 'testivisa5!')
    await mainFunctions.hideKeyboardSafely(driver)
    await driver.$('~Update password').click()
    await driver.$('~Change your password').waitForDisplayed()
  });
});