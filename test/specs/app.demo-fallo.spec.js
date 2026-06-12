const {expect} = require('@wdio/globals');

// Prueba de DEMOSTRACIÓN: falla a propósito para que veas cómo se reporta
// un fallo (estado FAIL + video + captura en Allure).
// Puedes borrar este archivo cuando tengas tus pruebas reales.
describe('App - Demo de fallo', () => {
  it('debería encontrar un elemento que NO existe (falla a propósito)', async () => {
    const fantasma = await driver.$('//*[@text="ESTO_NO_EXISTE_12345"]');
    await fantasma.waitForExist({timeout: 5000});
    expect(await fantasma.isDisplayed()).toBe(true);
  });
});
