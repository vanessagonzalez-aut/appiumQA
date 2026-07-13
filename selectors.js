const { timeout } = require("async")
const mainFunctions = require('./mainFunctions')

const arrivalDate = async (driver, name) => {
    await driver.$(`input[name="${name}"]`).click()
    await driver.$('button[data-dp-element="action-next"]').click()
    await driver.pause(1000)
    await driver.$('div=22').click()
    await driver.pause(1000)
}

const dropdownSelectors = async (driver, name, datahandle, text, value) =>{
    await driver.$('div[name="' + name + '"]').waitForDisplayed()
    await driver.$('div[name="' + name + '"]').click()
    await driver.$('input[data-handle="' + datahandle + '"]').waitForDisplayed()
    await driver.$('input[data-handle="' + datahandle + '"]').addValue(text)
    await driver.$('div[name="' + name + '"]').$('div[value="' + value + '"]').click()
    await driver.pause(1000)
}
async function booleanOptions(driver, name, dataHandle) {
    await driver.pause(3000)
    await driver.$('div[name="' + name + '"]').$('div[data-handle="' + dataHandle + '"]').click()
    await driver.pause(3000)
}

async function addressApi(page, name) {
    await driver.$('input[name="' + name + '"]').click()
    await driver.execute('mobile: type', { text: '123' + ' ' })
    await driver.$('#autocomplete_results').waitForDisplayed({timeout: 40000})
    await driver.$('#autocomplete-option-0').click()
    await driver.pause(3000)
}
async function fileUploadApplicant(driver) {
    await driver.$('button[data-handle="acceptFileUploadBtn"]').click()
    await driver.$('button[data-handle="try-another-way-button"]').click()

    const locationTryAnotherWay = await driver.$('button[data-handle="try-another-way-button"]').getLocation()
    const { width, height } = await driver.getWindowSize()
    const x = Math.min(Math.max(Math.round(locationTryAnotherWay.x), 0), width - 1)
    const y = Math.min(Math.max(Math.round(locationTryAnotherWay.y + 45), 0), height - 1)
    await driver.tap({x, y})
}
module.exports = {
    arrivalDate,
    dropdownSelectors,
    booleanOptions,
    addressApi,
    fileUploadApplicant
}