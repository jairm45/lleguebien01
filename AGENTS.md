# LleguéBien — Expo student-safety app

Mobile app (Expo SDK 58, React Native 0.88, React 19.3, Expo Router, Supabase, Mapbox via `@rnmapbox/maps`) for students at Universidad del Pacífico (Buenaventura, Valle del Cauca) to share their walk home with trusted contacts. UI and code comments are in Spanish; keep them that way.

## Current Project Status (after OpenCode work)

- **Fase 1 (Completada):** Mapa `@rnmapbox/maps` (`MapaMapbox.native.tsx`, `MapaMapbox.types.ts`, fallback web), flujo `src/app/recorrido/`, validaciones anti-recorridos fantasmas en `src/hooks/useRequisitosRecorrido.ts` + `src/services/red.ts`, rutas peatonales en `src/services/mapboxDirections.ts`, zonas de riesgo en `src/services/zonasRiesgo.ts` y seed en `docs/seed-zonas-riesgo.sql`. Se eliminaron la tab fantasma `recorrido` en `src/app/estudiante/_layout.tsx` y el placeholder `src/app/recorrido.tsx`.
- **Fase 2 (Completada):** Migración `docs/migration-fase2-postgis-rpc.sql` (aplicada) delegando a PostGIS la distancia real elipsoidal, el filtro de ruido GPS en servidor y la detección de zonas de riesgo en tiempo real mediante `registrar_ubicacion_recorrido` y `finalizar_recorrido`. Servicios `src/services/seguidores.ts` y `src/services/recorridos.ts`, hook `src/hooks/useUbicacionRecorrido.ts` y pantalla de cierre `src/app/recorrido/llegada.tsx` (E14).
- **Fase 2.5 (Completada):** Persistencia de sesión corregida en Supabase Auth (`AppState` auto-refresh + verificación inicial), tabla y RPCs en `docs/migration-fase2-5-destinos.sql` (`destinos_guardados`), servicios `src/services/mapboxGeocoding.ts` y `src/services/destinos.ts`, y selector interactivo `src/app/seleccionar-destino.tsx` (toque directo en mapa, pin arrastrable, barra de búsqueda Mapbox y tarjeta inferior compacta). No existe destino predeterminado quemado en código; el estudiante elige su destino y decide si lo guarda como predeterminado.
- **Fase 3A (Completada):**
  - Migración aplicada en Supabase (`docs/migration-fase3a-emergencias-fifo.sql`, proyecto `kbthjrgbrkzbzmnrarnp`): soporte de estado `'emergencia'`, `captured_at`, `client_event_id`, `alertas.modo`, 4 tipos de alerta, 6 RPCs, políticas RLS e índice `dispositivos_push_expo_push_token_key`.
  - Cola offline FIFO en SQLite (`src/services/colaOffline.ts`) con prioridades (emergencias antes que GPS), mutex, reintentos y descarte de eventos venenosos.
  - Tracking en segundo plano (`src/tasks/backgroundLocationTask.ts`), contextos compartidos (`src/context/RecorridoContext.tsx`, `src/context/SesionContext.tsx`), servicios `src/services/emergencias.ts` y `src/services/notificacionesPush.ts`.
  - Pantallas E11 (`cuenta-regresiva.tsx`), E12 (`sos.tsx`, modo sonoro o silencioso), E13 (`emergencia.tsx`), hooks `src/hooks/useAlarmaEmergencia.ts` y `src/hooks/useDetectorSacudidas.ts`, lógica `src/lib/shake.ts`, audio `assets/audio/alarma.m4a`, permisos en dos pasos + canales Android (`src/app/permisos.tsx`), limpieza de token al cerrar sesión (`src/app/estudiante/perfil.tsx`) y Edge Function `supabase/functions/enviar-alerta/index.ts`.
  - `enviar-alerta` está desplegada en Supabase. El Development Build debe incluir las dependencias nativas de 3A (`expo-sqlite`, `expo-network`, `expo-device`).
- **Fase 3B (A medias — requiere auditoría antes de continuar):** Quedó interrumpida por límite de cuota de OpenCode. Alcance esperado: botón/acción rápida SOS desde la notificación persistente en segundo plano y monitor pasivo _"¿Estás bien?"_ (ante retrasos, pérdida de señal o parada prolongada en zona de riesgo, siempre con confirmación local antes de escalar al seguidor).
- **Fase 4A (Implementada):** `docs/migration-fase4-rol-seguidor.sql` y las RPC de invitación permiten previsualizar, aceptar, rechazar y revocar vínculos. El estudiante comparte un código de seis caracteres con vigencia de 24 horas. Las Edge Functions `enviar-invitacion-seguidor` y `enviar-alerta` usan Gmail SMTP mediante Nodemailer y `_shared/correoSmtp.ts`. Los reintentos del monitor reservan cada correo por alerta y seguidor. Los avisos de entrada a zona de riesgo son locales.
- **Fase 4B (Completada):** P01 elige el rol según la sesión y el perfil (`src/app/index.tsx`). S01–S06 viven en `src/app/familiar/`. El deep link `lleguebien01://seguir?codigo=…` se registra en `src/app/seguir.tsx` y conserva la invitación al iniciar sesión o completar el registro. S07–S11 y Perfil viven en `src/app/seguidor/`. El panel, el historial y los mapas consultan datos bajo RLS, se refrescan al enfocar y escuchan Realtime. El mapa reutiliza Mapbox con respaldo de consulta cada 20 s y ordena el rastro por `captured_at`. El toque de una notificación con `alerta_id` y `recorrido_id` abre S11 para una cuenta vinculada (`src/hooks/useAccionesNotificacion.ts`). El cierre de sesión del seguidor usa `cerrarSesionSeguidor`, que elimina el token push antes de invalidar el JWT. La validación de entrega por Gmail, push y ubicación GPS requiere dos cuentas en un Development Build.
- **Infra de release (Completada):** APK Android optimizado con `expo-build-properties` (solo `arm64-v8a`, R8, `shrinkResources`, PNG crunch) y workflow `.github/workflows/release-apk.yml` que compila con Gradle en GitHub Actions y publica en GitHub Releases (tag `v*` + release rodante `latest-apk`). Guía completa en `RELEASES.md`.

## Commands

Use npm (`package-lock.json` is the lockfile; there is no `bun.lock`).

```bash
npm install                                                        # install deps
npx expo start --dev-client                                        # dev server for Development Build (not Expo Go)
npx tsc --noEmit                                                   # typecheck — main automated check
npx expo-doctor                                                    # project health check (20/20)
npx eas-cli@latest build --profile development --platform android  # rebuild dev build when native deps/plugins change
npx supabase functions deploy enviar-invitacion-seguidor --project-ref kbthjrgbrkzbzmnrarnp
npx supabase functions deploy enviar-alerta --project-ref kbthjrgbrkzbzmnrarnp

# APK release optimizado compilado localmente (mismo camino que el workflow de GitHub)
npx expo prebuild --platform android --clean
cd android && ./gradlew assembleRelease                            # → android/app/build/outputs/apk/release/app-release.apk
```

- `npm run lint` (`expo lint`) is **not usable yet**: there is no ESLint config or dependency. Do not treat lint as part of verification unless intentionally configuring ESLint.
- There is no automated test runner. Verify changes with `npx tsc --noEmit`, `npx expo-doctor`, and manual testing on a Development Build.
- Releases de APK: `RELEASES.md` (secrets, tags `v*`, release rodante `latest-apk` y URLs fijas de descarga). El workflow no usa EAS, compila con Gradle.
- `README.md` is the stock `create-expo-app` template and is stale; trust `package.json`, `app.json`, `docs/*.sql`, and this file instead.

## Architecture & PostGIS / Offline Rules

- Entry point is `expo-router/entry`. All routes live in `src/app/`; root layout is `src/app/_layout.tsx` (registers background location task, notification routing, and session state; SesionContext inicia la sincronización FIFO para estudiantes). Student tabs live in `src/app/estudiante/_layout.tsx` (`inicio`, `seguidores`, `perfil`).
- Recorrido flow lives in `src/app/recorrido/` (`_layout.tsx`, `index.tsx` [E10], `cuenta-regresiva.tsx` [E11], `sos.tsx` [E12], `emergencia.tsx` [E13], `llegada.tsx` [E14]) coordinated through `src/context/RecorridoContext.tsx` and `src/tasks/backgroundLocationTask.ts`.
- Shared logic is organized under `src/services/`, `src/hooks/`, `src/components/`, `src/context/`, `src/tasks/`, `src/lib/`, and `src/styles/`. Imports are relative (`../services/supabase`).
- **Supabase & PostGIS (project `kbthjrgbrkzbzmnrarnp`):**
  - PostGIS 3.3.7 is installed in schema `extensions`.
  - Always use `geography` (SRID 4326) and explicit `search_path = public, extensions, pg_catalog` (or explicit schema qualification) for geodetic calculations (`ST_Distance`, `ST_Length`, `ST_MakeLine`, `ST_Intersects`).
  - Preserve `lat`/`lng` (`double precision`) and `geojson`/`ruta_geojson` (`jsonb`) columns for Mapbox and `expo-location` compatibility.
  - Keep RLS helper functions and RPCs as `SECURITY INVOKER` where appropriate, accepting `'activo'` and `'emergencia'` during active tracking and preserving `captured_at` + `client_event_id` for idempotent FIFO replay.
  - Database migrations live in `docs/migration-*.sql` (SQL scripts are idempotent and applied via Supabase SQL Editor if MCP is read-only).
- **Offline-first FIFO:** `src/services/colaOffline.ts` stores offline emergencies and GPS points in SQLite with priority ordering, mutex locking, retry limits, and poison-event discarding. Emergency sound/vibration must start locally without waiting for network.
- **Environment & Secrets:** Public client tokens use `EXPO_PUBLIC_*` in `.env` (gitignored, e.g., `EXPO_PUBLIC_MAPBOX_TOKEN`). Native build secrets like `RNMAPBOX_MAPS_DOWNLOAD_TOKEN` live in EAS secrets/env vars, and Edge Function secrets (`SMTP_HOST`, `SMTP_PORT` (465 para Gmail), `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`) live in Supabase Secrets. Never commit `.env` or secret tokens.

## Auth, Navigation & UI Conventions

- Student auth currently accepts `@unipacifico.edu.co` emails with a 6-digit PIN as the Supabase password. `auth.tsx` auto-registers on `"Invalid login credentials"` and `registro.tsx` auto-logs-in on `"User already registered"`, routing by `perfiles.identificacion` (intentional behavior). El acceso familiar admite cualquier dominio de correo válido y conserva el rol de las cuentas existentes.
- Password reset redirects to `lleguebien01://rol/recuperar/nuevo-pin` and requires a Development Build for testing.
- Push tokens in `dispositivos_push` have a global unique constraint (`expo_push_token`); always clean up via `eliminar_token_push` on sign-out and upsert cleanly on sign-in.
- `app.json` enables `typedRoutes` and `reactCompiler`. Route types live in gitignored `.expo/types/router.d.ts`; restart dev server if route types look stale after adding routes.
- Use `useSafeAreaInsets` from `react-native-safe-area-context` instead of React Native's `SafeAreaView` on new/updated screens.
- Importar iconos desde el subpath (`import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons"`), **no** desde `@expo/vector-icons`: el import raíz empaqueta las ~20 fuentes tipográficas (~3 MB extra en el APK).
- Color palette: navy `#1A1E3C`, orange `#F5A623`, teal `#1ABC9C`, red `#E5484D`, muted gray `#73799D`.

## Expo / Build Rules

- Mapbox (`@rnmapbox/maps`), background location, audio, and push notifications require a **Development Build (`expo-dev-client`)** — do not test in Expo Go.
- Check Expo SDK 58 docs (`https://docs.expo.dev/versions/v58.0.0/` and `https://docs.expo.dev/llms.txt`) before modifying Expo/RN native APIs.
- `ios/` and `android/` are not checked in (Continuous Native Generation). Never create or edit them manually; configure native behavior in `app.json` and config plugins.
- **Tamaño del APK:** `app.json` usa `expo-build-properties` con `buildArchs: ["arm64-v8a"]`, R8 (`enableMinifyInReleaseBuilds`), `enableShrinkResourcesInReleaseBuilds` y PNG crunch. Si se necesita soportar Android de 32 bits, agregar `"armeabi-v7a"` a `buildArchs` (ver `RELEASES.md`). Los APK de GitHub Releases se firman con el keystore de debug: sirven para sideload, no para Play Store.
- Do not install new native dependencies without explicitly notifying the user (they require rebuilding the EAS Development Build).
- Never run `npm run reset-project` (`scripts/reset-project.js` removes/moves `src/` and `scripts/`).
- `.agents/` and `skills-lock.json` hold locally installed agent skills; `.agents/` is gitignored and not part of the app.
