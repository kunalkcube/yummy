# Yummy Agent Guide

## Purpose

Yummy is a personal React Native media app built with Expo. It browses TMDB movies and TV shows, plays public direct IPTV streams, and searches/reads manga from MangaPlus, MangaDex, and AniList.

## Stack

- Expo SDK 54, React 19, React Native 0.81, TypeScript (strict)
- Expo Router 6 for file-based navigation
- React Navigation tabs/stack, React Native WebView, Gesture Handler/Reanimated
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
```

There is currently no test runner or test script. Run `npm run lint` for every code change and use the most focused available validation (for example, `npx tsc --noEmit` for TypeScript changes). Do not start a long-running Expo server as a validation substitute.

## Project Map

| Path | Responsibility |
| --- | --- |
| `app/` | Expo Router screens and navigation layouts |
| `app/(tabs)/` | Home, search, manga, IPTV, and settings tabs |
| `app/details.tsx`, `app/person.tsx` | TMDB detail screens |

| `app/iptv-player.tsx` | Direct IPTV stream playback through Plyr |
| `app/manga-details.tsx`, `app/manga-reader.tsx` | Manga metadata, chapters, and gesture-enabled reader |
| `components/` | Reusable media, empty-state, and update UI |
| `contexts/SettingsContext.tsx` | Persisted TMDB, IPTV playlist, favorite, and recent-channel state |
| `hooks/useIptv.ts` | Validated M3U parsing and playlist loading |
| `hooks/useTMDB.ts` | TMDB API client and shared media types |
| `hooks/useMangaPlus.ts` | MangaPlus device lifecycle and API client |
| `hooks/useVersionCheck.ts` | GitHub Release update check |
| `constants/` | Active theme tokens, fonts, TMDB provider filters, and IPTV types |
| `assets/` | App icons, splash image, and bundled Geist Mono fonts |

## Architecture and Conventions

### Routing

- Routes are determined by `app/` filenames. Keep `app/_layout.tsx` in sync when adding a stack screen.
- Main tabs are declared in `app/(tabs)/_layout.tsx`.
- Pass route parameters with Expo Router's typed `pathname`/`params` shape used by existing screens.
- TMDB detail routes require an `id` and `type` (`movie` or `tv`).
- The IPTV player route receives a channel name and a validated direct HTTP(S) stream URL.

### State and networking

- Read and write app preferences only through `useSettings()`; it persists values in AsyncStorage.
- Use `useTMDB()` for TMDB list/detail/season calls instead of duplicating its auth logic. The app accepts either a v3 API key or a v4 bearer token.
- `useMangaPlus()` owns device registration and the persisted MangaPlus device secret. Await its initialization before relying on its client calls.
- IPTV playlist configuration, favorites, and recents belong in `useSettings()`. Validate M3U URLs and parsed channels before persisting or rendering them.
- Existing external calls generally handle failures by returning empty data or setting screen-local error state. Preserve that user-facing behavior when extending a screen.
- Do not log credentials, bearer tokens, device secrets, full authorization headers, or raw sensitive API responses.

### UI

- The active product theme is `constants/colors.ts` and `constants/fonts.ts`: black/surface/card backgrounds, red accent, and bundled Geist Mono fonts.
- Use `Colors` and `Fonts.GeistMono` rather than hardcoded replacements for shared UI tokens.
- `constants/theme.ts`, themed components, and some UI files are Expo starter artifacts; do not migrate screens to them unless the task explicitly includes a theme-system refactor.
- Keep screen-local `StyleSheet.create` styles and existing functional-component patterns unless extracting a genuinely shared component.

### IPTV playback

- `app/iptv-player.tsx` supports public direct HLS and direct-file streams through Plyr. Do not honor playlist-supplied credential/header directives or try to bypass DRM, CORS, source restrictions, or offline streams.
- Check IPTV playback on a physical/emulated Android device because WebView fullscreen and media playback cannot be proven by lint alone.

## Secrets and Safety

- `.env` is local-only. Never commit API keys, bearer tokens, device secrets, release tokens, or signing credentials.
- Expo exposes only variables prefixed `EXPO_PUBLIC_` to the app bundle. These values are public at runtime; they must not contain secrets.
- `EXPO_PUBLIC_MANGAPLUS_BASE_URL` is required by `useMangaPlus.ts` and must point to a compatible MangaPlus API service.
- The repository contains legacy debug/test UI under `components/`; do not copy credentials from it into production paths. Flag exposed credentials for removal or rotation when that work is in scope.
- IPTV streams and public manga APIs can change or block clients. Avoid assuming their response shapes are stable; guard parsing and preserve fallback/error UI.

## Change Workflow

1. Inspect the target screen/hook plus its callers before editing.
2. Follow established imports (`@/` alias), functional components, strict TypeScript, and local `StyleSheet` patterns.
3. Keep changes focused; do not reformat or refactor starter artifacts as collateral.
4. Run `npm run lint` and, for TypeScript changes, `npx tsc --noEmit` when practical.
5. Manually exercise changed route, loading, empty/error, and navigation paths in Expo/Android when behavior changes.
6. Review `git status --short` before finishing. The working tree may contain changes unrelated to your task; preserve them.

## Documentation Notes

- `README.md` is the user-facing quick-start guide.
- `MEMORY.md` is the current architecture and operational reference for future agents. Update it when routes, data ownership, external contracts, or known constraints materially change.
