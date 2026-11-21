# LleguéBien — Expo student-safety app

Mobile app (Expo SDK 58, React Native 0.88, React 19.3, Expo Router, Supabase) for students at Universidad del Pacífico to share their walk home with trusted contacts. UI and code comments are in Spanish; keep them that way.

## Commands

Use npm (`package-lock.json` is the lockfile; there is no bun.lock).

```bash
npm install                  # install deps
npm start                    # Expo dev server
npm run ios / npm run android  # development builds: scripts run `expo run:*`, not Expo Go
npm run web
npx tsc --noEmit             # typecheck — the only working automated check
npx expo-doctor              # currently passes 20/20
```

- `npm run lint` (`expo lint`) is **not usable yet**: there is no ESLint config or dependency, so it prompts to install/set one up. Do not treat lint as part of verification unless you are intentionally configuring ESLint.
- There is no test runner and no tests. Verify changes with `npx tsc --noEmit` and by running the affected flow.
- `README.md` is the stock `create-expo-app` template and is stale; trust `package.json`, `app.json`, and this file instead.

## Architecture

- Entry point is `expo-router/entry`. All routes live in `src/app/`; the root `Stack` is `src/app/_layout.tsx`, and student tabs are in `src/app/estudiante/_layout.tsx` (inicio, seguidores, perfil).
- Only two non-route areas exist: `src/services/supabase.ts` (the shared client) and `src/styles/*.ts` (one `StyleSheet` per screen, imported by the screen). There is no API layer, state library, or session context — screens call Supabase directly.
- Imports are relative (`../services/supabase`). The `@/*` alias exists in `tsconfig.json` but is unused.
- Supabase project URL and publishable anon key are hardcoded in `src/services/supabase.ts`; there is no `.env` or `process.env` usage. Sessions persist through AsyncStorage and `detectSessionInUrl` is `false`.
- Tables used: `perfiles` (keyed by auth user id; onboarding is considered complete when `identificacion` is set) and `configuracion_sensores` (shake count, cancellation seconds, emergency contact). Schema/migrations are not in this repo — they live in Supabase.

## Auth quirks

- Only `@unipacifico.edu.co` emails are accepted; the 6-digit PIN is used directly as the Supabase password.
- `auth.tsx` auto-registers on "Invalid login credentials"; `registro.tsx` auto-logs-in on "User already registered". Both decide the next route from `perfiles.identificacion` (present → `/estudiante/inicio`, absent → `/datos-personales`). This duplicated logic is intentional behavior, not dead code.
- Password reset emails redirect to `lleguebien01://rol/recuperar/nuevo-pin`, but `_layout.tsx` has no URL/auth-session listener. The reset flow requires a dev build and manual testing; don't assume it works in Expo Go.
- No route guards exist: each screen calls `supabase.auth.getUser()` itself. Add the same explicit check rather than expecting middleware.

## Navigation & UI

- `app.json` enables `typedRoutes` and `reactCompiler`. Route types live in the gitignored `.expo/types/router.d.ts`; after adding a route, start the dev server to regenerate them before blaming `tsc` for a failed `router.push`.
- `src/app/recorrido.tsx` is a placeholder ("Recorrido en curso..."). `iniciar-recorrido` is only reachable through `proteccion` → `permisos` → `estudiante/inicio`.
- Followers, protection contacts, and the emergency-alert UI are hardcoded mock data; shake detection is not implemented even though `expo-sensors`, permission prompts, and config fields exist. Don't mistake these screens for working features.
- Palette repeated across style files: navy `#1A1E3C`, orange `#F5A623`, teal `#1ABC9C`, red `#E5484D`, muted gray `#73799D`.

## Expo / build rules

- Expo ships breaking changes every SDK release. Before touching an Expo/EAS/React Native API, check the SDK 58 docs (`https://docs.expo.dev/versions/v58.0.0/`) and use `https://docs.expo.dev/llms.txt` instead of relying on memory.
- `ios/` and `android/` are not checked in (Continuous Native Generation). Never create or edit them; configure native behavior in `app.json` and config plugins.
- Builds use EAS (`eas.json` profiles: development, preview, production) via `npx eas-cli@latest ...`. `expo-dev-client` is not a dependency, so OTA/EAS dev builds are the path for native modules.
- Never run `npm run reset-project`: `scripts/reset-project.js` deletes or moves `src/` and `scripts/` and replaces the app with a blank template.
- `.agents/` and `skills-lock.json` hold locally installed agent skills; `.agents/` is gitignored and not part of the app.
