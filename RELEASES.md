# Releases de APK (GitHub Actions)

El workflow [`.github/workflows/release-apk.yml`](.github/workflows/release-apk.yml) compila el APK
Android **directamente con Gradle** (sin gastar builds de EAS) y lo publica en GitHub Releases.

## URLs fijas de descarga

Una vez ejecutado el workflow al menos una vez, estas URLs siempre apuntan al último APK publicado
(release rodante `latest-apk`):

```
https://github.com/<owner>/<repo>/releases/latest/download/LlegueBien01-preview.apk
https://github.com/<owner>/<repo>/releases/latest/download/LlegueBien01-development.apk
```

- **`preview`**: APK standalone optimizado (release). No necesita Metro ni el servidor de desarrollo.
  Es el que se comparte con estudiantes y docentes.
- **`development`**: APK con `expo-dev-client` (variante debug) para desarrollo. Necesita
  `npx expo start --dev-client` y estar en la misma red (o usar tunnel).

## Secrets requeridos

Configúralos en **Settings → Secrets and variables → Actions → New repository secret**:

| Secret | Obligatorio | Contenido |
| --- | --- | --- |
| `EXPO_PUBLIC_SUPABASE_URL` | Sí | URL del proyecto Supabase (`https://<ref>.supabase.co`). |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Sí | Clave anon pública de Supabase. |
| `EXPO_PUBLIC_MAPBOX_TOKEN` | Sí | Token público de Mapbox (`pk...`) usado en tiempo de ejecución. |
| `RNMAPBOX_MAPS_DOWNLOAD_TOKEN` | Sí | Token secreto de Mapbox (`sk...`) con scope `Downloads:Read`; Gradle lo usa para bajar los AAR. |
| `GOOGLE_SERVICES_JSON_B64` | Opcional | `google-services.json` codificado en base64. Sin él, el APK compila pero las push notifications FCM no funcionan. |

Generar el base64 del archivo de Firebase:

```bash
base64 -w 0 google-services.json   # Linux
base64 -i google-services.json     # macOS (sin saltos de línea)
```

## Cómo lanzar un release

### Desde la terminal (tag `v*`)

```bash
git tag v0.4.0-fase4
git push origin v0.4.0-fase4
```

Esto crea/actualiza:

1. Un release con el nombre del tag y el APK adjunto.
2. El release rodante `latest-apk` (marcado como *latest*), que alimenta las URLs fijas de arriba.

El `versionName` del APK sale del tag (`v0.4.0-fase4` → `0.4.0`) y el `versionCode` del número de
ejecución del workflow, para que Android permita actualizar sobre la instalación anterior.

### Desde la interfaz web

**Actions → Release APK Android → Run workflow**:

- `profile`: `preview` (por defecto) o `development`.
- `release_notes`: texto opcional que se incluye en el release.

En este modo solo se actualiza el release rodante `latest-apk` (no se crea un release por tag).

## Detalles de la compilación

- Runner `ubuntu-latest`, Node.js 20, Java 17 (Temurin) y Android SDK/NDK provistos por el runner.
- `npx expo prebuild --platform android --clean --no-install` genera `android/` (ignorado por git).
- `preview` → `./gradlew assembleRelease`; `development` → `./gradlew assembleDebug`
  (el dev-launcher de `expo-dev-client` se deshabilita en builds release, por eso el perfil de
  desarrollo usa debug).
- Los APK se firman con el **keystore de debug** que genera Expo. Sirven para distribución interna
  (instalar por sideload), **no** para publicar en Play Store.
- Caché de npm y de Gradle habilitada; el job tiene un timeout de 90 minutos.

## Optimizaciones de tamaño aplicadas

Definidas en `app.json` → plugin `expo-build-properties`:

- `buildArchs: ["arm64-v8a"]`: solo empaqueta binarios nativos de 64 bits (Mapbox, Hermes, SQLite,
  Reanimated, etc.). Es el ahorro más grande.
- `enableMinifyInReleaseBuilds`: R8 elimina código Java/Kotlin no usado.
- `enableShrinkResourcesInReleaseBuilds`: elimina recursos Android no usados.
- `enablePngCrunchInReleaseBuilds`: optimiza PNGs en release.

### Si necesitas soportar celulares Android de 32 bits

Edita `app.json` y agrega la ABI:

```json
"buildArchs": ["arm64-v8a", "armeabi-v7a"]
```

El APK crecerá de forma notable porque incluye una copia extra de cada librería nativa.

### Si un release falla al abrir el mapa

R8 puede eliminar clases accedidas por reflexión. Las reglas conservadoras ya incluidas en
`app.json` (`com.rnmapbox.rnmbx.**`, `com.mapbox.geojson.**`) cubren los casos conocidos. Si aun así
falla, agrega reglas más amplias en `extraProguardRules`:

```proguard
-keep class com.mapbox.** { *; }
```

## Compilar el APK localmente (para medir tamaño)

```bash
# Requiere .env con EXPO_PUBLIC_* y RNMAPBOX_MAPS_DOWNLOAD_TOKEN
npx expo prebuild --platform android --clean
cd android && ./gradlew assembleRelease
# Resultado: android/app/build/outputs/apk/release/app-release.apk
```

`android/` e `ios/` están en `.gitignore`: nunca se suben al repositorio (Continuous Native
Generation).
