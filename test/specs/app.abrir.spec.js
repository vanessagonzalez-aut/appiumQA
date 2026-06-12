const {expect} = require('@wdio/globals');

describe('App - Arranque', () => {
  it('debería abrir la aplicación correctamente', async () => {
    // La sesión ya lanza el APK (capability "app"). Verificamos que arrancó.
    const pkg = await driver.getCurrentPackage();
    console.log('Paquete actual:', pkg);
    expect(pkg).toBeTruthy();

    // Pequeña pausa para ver la app en el video de evidencia
    await driver.pause(3000);
  });
});
