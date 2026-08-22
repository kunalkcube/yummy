# Yummy Agent Guide

## Purpose

Yummy is a personal React Native media app built with Expo. It browses TMDB movies and TV shows, plays public direct IPTV streams, and searches/reads manga from MangaPlus, MangaDex, and AniList.

## Stack

- Expo SDK 57, React 19.2, React Native 0.86, TypeScript (strict)
- Expo Router 57 for file-based navigation
- React Navigation tabs/stack (via Expo Router), React Native WebView, Gesture Handler/Reanimated
- Axios and `fetch` for external APIs
- AsyncStorage for device-local settings and MangaPlus device credentials
- ESLint via `eslint-config-expo`

## Commands

```sh
npm install
npm start
npm run android
npm run ios
npm run web
npm run lint
npx tsc --noEmit
npm run tauri:dev
npm run tauri:build
```

There is currently no test runner or test script. Run `npm run lint` for every code change and use the most focused available validation (for example, `npx tsc --noEmit` for TypeScript changes). Do not start a long-running Expo server as a validation substitute.

Desktop (Win / Linux / macOS) uses Tauri 2 wrapping the Expo web export. Requires Rust (`rustc`/`cargo`) and platform WebView deps. `tauri:dev` starts Expo web then the native shell; `tauri:build` runs `expo export -p web` into `dist/` then bundles installers.

## Project Map

| Path | Responsibility |
| --- | --- |
| `app/` | Expo Router screens and navigation layouts |
| `app/(tabs)/` | Home, search, manga, IPTV, and settings tabs |
| `app/details.tsx`, `app/person.tsx` | TMDB detail screens |
| `app/player.tsx` | Third-party streaming-provider player (WebView native / iframe web) |
| `app/iptv-player.tsx` | Direct IPTV stream playback through Plyr |
| `app/manga-details.tsx`, `app/manga-reader.tsx` | Manga metadata, chapters, and gesture-enabled reader |
| `components/` | Shared media UI, `AppAlert`, and update prompt |
| `contexts/SettingsContext.tsx` | Persisted TMDB, IPTV playlist, favorite, and recent-channel state |
| `hooks/useIptv.ts` | Validated M3U parsing and playlist loading |
| `hooks/useTMDB.ts` | TMDB API client and shared media types |
| `hooks/useMangaPlus.ts` | MangaPlus device lifecycle and API client |
| `hooks/useVersionCheck.ts` | GitHub Release update check |
| `constants/` | Colors, fonts, stream providers, TMDB provider filters, IPTV types |
| `assets/` | App icons, splash image, and bundled Geist Mono fonts |
| `src-tauri/` | Tauri 2 desktop shell (Win / Linux / macOS) |

## Architecture and Conventions

### Routing

- Routes are determined by `app/` filenames. Keep `app/_layout.tsx` in sync when adding a stack screen.
- Main tabs are declared in `app/(tabs)/_layout.tsx`.
- Pass route parameters with Expo Router's typed `pathname`/`params` shape used by existing screens.
- TMDB detail routes require an `id` and `type` (`movie` or `tv`).
- The IPTV player route receives a channel name and a validated direct HTTP(S) stream URL.

### State and networking

- Read and write app preferences only through `useSettings()`; it persists values in AsyncStorage.
- Use `useTMDB()` for all TMDB calls (trending, popular, top-rated, upcoming, search, details, credits, recommendations, person, seasons). Do not reimplement bearer/API-key auth in screens.
- `useMangaPlus()` owns device registration and the persisted MangaPlus device secret. Await its initialization before relying on its client calls.
- IPTV playlist configuration, favorites, and recents belong in `useSettings()`. Validate M3U URLs and parsed channels before persisting or rendering them.
- Existing external calls generally handle failures by returning empty data or setting screen-local error state. Preserve that user-facing behavior when extending a screen.
- Do not log credentials, bearer tokens, device secrets, full authorization headers, or raw sensitive API responses. Prefer silent failure / empty returns over debug logging in hooks.

### UI

- Product theme: `constants/colors.ts` (black / surface / card, red accent `#e50914`) and `constants/fonts.ts`.
- Bundled Geist Mono weights in use: **Regular**, **Medium**, **SemiBold**, **Bold** only. Do not reintroduce unused weights.
- Prefer quiet uppercase section labels, radius-8 controls, white primary CTAs, accent-border selected chips, Lucide icons (including `Star` for ratings — no emoji stars), and safe-area insets on headers.
- Use `Colors` and `Fonts.GeistMono` rather than ad-hoc replacements for shared tokens.
- Do not import `@react-navigation/*` in app code (SDK 56+). Use `expo-router/react-navigation`, `expo-router/js-tabs`, etc.
- TMDB/MangaPlus clients expose stable `useCallback` fetchers. Screen loads use `useCallback` + `useEffect([loader])` (or a cancelable effect on Home); do not put unstable function identities in effect deps.
- Keep screen-local `StyleSheet.create` styles and functional-component patterns unless extracting a genuinely shared component.
- Alerts: use `AppAlert.alert(title, message?, buttons?)` from `components/AppAlert.tsx`. Do not use React Native `Alert`. The root layout mounts `AlertProvider`.

### IPTV playback

- `app/iptv-player.tsx` supports public direct HLS and direct-file streams through Plyr. Do not honor playlist-supplied credential/header directives or try to bypass DRM, CORS, source restrictions, or offline streams.
- On web/Tauri use `iframe` (`srcDoc`); on native use `react-native-webview`. Desktop does not support RN WebView.
- Check IPTV playback on a physical/emulated Android device because WebView fullscreen and media playback cannot be proven by lint alone.

## Secrets and Safety

- `.env` is local-only. Never commit API keys, bearer tokens, device secrets, release tokens, or signing credentials.
- Expo exposes only variables prefixed `EXPO_PUBLIC_` to the app bundle. These values are public at runtime; they must not contain secrets.
- `EXPO_PUBLIC_MANGAPLUS_BASE_URL` is required by `useMangaPlus.ts` and must point to a compatible MangaPlus API service.
- TMDB credentials are entered in Settings and stored in AsyncStorage — not read from env by product code.
- Privacy: Yummy has no backend. Device-local storage only; summary in Settings → About. IPTV streams and public manga APIs can change or block clients; guard parsing and preserve fallback/error UI.

## Release (personal APK / desktop)

- Splash/adaptive icon backgrounds use `#000000` to match the dark UI (`app.json`).
- Build Android locally with `npm run android` / EAS Build when configured. Keep keystores and credentials out of git.
- Build desktop with `npm run tauri:build` (outputs under `src-tauri/target/release/bundle/`). Keep signing credentials out of git.
- There is no CI release pipeline in-repo; document or add one only when intentionally shipping signed builds.
- Before sharing a build: confirm Settings has no shared TMDB key you care about, and run lint/typecheck.

## Change Workflow

1. Inspect the target screen/hook plus its callers before editing.
2. Follow established imports (`@/` alias), functional components, strict TypeScript, and local `StyleSheet` patterns.
3. Keep changes focused; match the current quiet UI language when touching screens.
4. Run `npm run lint` and, for TypeScript changes, `npx tsc --noEmit` when practical.
5. Manually exercise changed route, loading, empty/error, and navigation paths in Expo/Android when behavior changes.
6. Review `git status --short` before finishing. The working tree may contain changes unrelated to your task; preserve them.

## Documentation Notes

- `README.md` is the user-facing quick-start guide.
- `MEMORY.md` is the current architecture and operational reference for future agents. Update it when routes, data ownership, external contracts, or known constraints materially change.
