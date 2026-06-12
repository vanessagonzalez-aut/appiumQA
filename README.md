# Pruebas automatizadas móviles (Appium + WebdriverIO)

Framework para correr varias pruebas **en paralelo** sobre Android, con
**reporte Allure** (qué pasó / qué falló) y **video de evidencia** de cada prueba.

## Estructura

```
wdio.conf.js              # Configuración: detecta dispositivos y reparte pruebas
helpers/devices.js        # Detecta emuladores/teléfonos conectados (adb)
test/specs/*.js           # Cada archivo es una prueba
videos/                   # Videos MP4 de evidencia (se generan al correr)
allure-results/           # Datos crudos del reporte (se generan al correr)
allure-report/            # Reporte HTML navegable (se genera con npm run report)
```

## Requisitos

1. **Emulador o teléfono Android** conectado. Verifica con:
   ```powershell
   adb devices
   ```
2. **Servidor Appium** corriendo en otra terminal:
   ```powershell
   appium
   ```
3. **Java (JRE)** instalado, solo para *abrir* el reporte Allure.

## Cómo correr las pruebas

```powershell
npm test
```

Esto:
- Detecta cuántos dispositivos hay conectados.
- Reparte las pruebas entre ellos y las corre **en paralelo**.
- Guarda un video MP4 de cada prueba en `videos/` (prefijo `PASS__` o `FAIL__`).
- Muestra un resumen pass/fail en la consola.

## Ver el reporte con video

```powershell
npm run report
```

Genera y abre el reporte HTML de Allure, con el estado de cada prueba,
el video adjunto y, en los fallos, una captura de pantalla.

## Paralelismo real

El paralelismo depende del **número de dispositivos conectados**:

- **1 emulador** → las pruebas corren una tras otra (en ese dispositivo).
- **2+ emuladores/teléfonos** → cada prueba corre en un dispositivo distinto
  al mismo tiempo. No hay que tocar la configuración: se detecta solo.

### Levantar un segundo emulador (para paralelo real)

```powershell
# Lista tus AVDs
emulator -list-avds

# Crea un segundo AVD (clónalo en Android Studio > Device Manager),
# luego levántalo en otro puerto:
emulator -avd NOMBRE_DEL_AVD -port 5556
```

Al volver a correr `npm test`, detectará los 2 emuladores y paralelizará.

## Agregar tus propias pruebas

Crea un archivo nuevo en `test/specs/`, por ejemplo `login.spec.js`:

```js
const {expect} = require('@wdio/globals');

describe('Login', () => {
  it('debería iniciar sesión', async () => {
    const usuario = await driver.$('//*[@resource-id="campo_usuario"]');
    await usuario.setValue('miusuario');
    // ...
    expect(algo).toBe(true);
  });
});
```

Se incluye automáticamente en la próxima corrida. Puedes borrar
`app.demo-fallo.spec.js` (es solo una demostración de cómo se ve un fallo).
```
