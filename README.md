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

---

# Correr en GitHub Actions (CI)

El workflow [.github/workflows/tests.yml](.github/workflows/tests.yml) corre las
pruebas en la nube cada vez que haces push, en pull requests, todos los días
(06:00 UTC) y manualmente. Al terminar:

- 📊 Publica el **reporte Allure con historial de tendencias** en GitHub Pages.
- 💬 Envía el resultado (pasaron/fallaron + enlaces) a un **canal de Slack**.
- 🎬 Sube los **videos** de cada prueba como artifact descargable.

## Puesta en marcha (una sola vez)

### 1. Subir el código a un repositorio público de GitHub

El commit inicial ya está hecho. Crea el repo y haz push:

```powershell
# Opción A: con GitHub CLI (gh) instalado
gh repo create pruebas-appium --public --source . --remote origin --push

# Opción B: manual — crea el repo vacío en github.com y luego:
git remote add origin https://github.com/TU_USUARIO/pruebas-appium.git
git push -u origin main
```

> ⚠️ El APK **no** se sube al repo (está en `.gitignore` por su tamaño de 192 MB).

### 2. Subir el APK como GitHub Release

El workflow descarga el APK desde un Release con el tag `apk-latest`:

```powershell
# Con gh (recomendado):
gh release create apk-latest "app-staging-release - 6.1.0 (1536).apk" `
  --title "APK de pruebas" --notes "APK usado por las pruebas automatizadas"

# Para actualizar el APK más adelante:
gh release upload apk-latest "ruta\al\nuevo.apk" --clobber
```

O hazlo desde la web: **Releases → Draft a new release → tag `apk-latest`**, y
arrastra el `.apk` como asset.

> Si prefieres otro tag, crea una *Repository variable* `APK_RELEASE_TAG` en
> **Settings → Secrets and variables → Actions → Variables**.

### 3. Configurar el webhook de Slack

1. Ve a <https://api.slack.com/apps> → **Create New App** → *From scratch*.
2. Activa **Incoming Webhooks** → *Add New Webhook to Workspace* → elige el canal.
3. Copia la URL (`https://hooks.slack.com/services/...`).
4. En tu repo: **Settings → Secrets and variables → Actions → New repository secret**
   - Nombre: `SLACK_WEBHOOK_URL`
   - Valor: la URL del webhook.

### 4. Habilitar GitHub Pages (tras la primera corrida)

La primera corrida crea la rama `gh-pages`. Luego:

- **Settings → Pages → Source: Deploy from a branch → `gh-pages` / `(root)`**.

El reporte quedará en `https://TU_USUARIO.github.io/pruebas-appium/` (el mismo
enlace que llega a Slack), con gráficas de tendencia de las últimas 30 corridas.

## Disparar una corrida

- Automático: con cada `git push` a `main` o en cada Pull Request.
- Manual: pestaña **Actions → Pruebas móviles (Appium) → Run workflow**.

## Notas

- El emulador corre en runners Ubuntu con KVM (API 33, x86_64). Puedes cambiar
  `api-level` en el workflow.
- La prueba `app.demo-fallo.spec.js` **falla a propósito**, así que la primera
  corrida saldrá en rojo y Slack dirá "FALLARON". Bórrala cuando metas tus
  pruebas reales.
- El paralelismo en CI se logra con una *matrix* (un emulador por job). Si lo
  necesitas, te lo puedo configurar; hoy corre en un emulador por simplicidad.
