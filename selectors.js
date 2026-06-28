const arrivalDate = async (driver, name) => {
    await $('button[name="' + name + '"]').click()
    await $('div[data-dp-element="action-next"]').click()
    await $('div[data-dp-element="action-next"]').click()
    await page.waitForTimeout(1000)
    await $('.dp--future=14').click()
    await page.waitForTimeout(1000)
}

module.exports = {
    arrivalDate
}