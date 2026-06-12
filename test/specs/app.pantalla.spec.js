const {expect} = require('@wdio/globals');

describe('App - Pantalla inicial', () => {
  it('debería renderizar contenido en pantalla', async () => {
    // Esperamos a que el árbol de la UI tenga elementos (la app dibujó algo)
    const source = await driver.getPageSource();
    expect(source.length).toBeGreaterThan(100);

    await driver.pause(3000);
  });
});
