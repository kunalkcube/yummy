# Yummy

A personal media app for TMDB discovery, manga reading, and IPTV playback, built with React Native and Expo.

<p align="center">
  <img src="docs/home_screen.jpg" alt="Home Screen" width="200" />
  <img src="docs/search_screen.jpg" alt="Search Screen" width="200" />
  <img src="docs/manga_screen.jpg" alt="Manga Screen" width="200" />
</p>

<p align="center">
  <img src="docs/detail_screen.jpg" alt="Detail Screen" width="200" />
  <img src="docs/manga_details_screen.jpg" alt="Manga Details" width="200" />
</p>

## Features

- Browse movies and TV shows
- Search across TMDB catalog

- Read manga with built-in reader
- Browse IPTV-org channels and saved M3U playlists with Plyr playback
- Dark theme
- Automatic update alerts via GitHub Releases

## Prerequisites

- TMDB API Key (free at [themoviedb.org](https://www.themoviedb.org/settings/api))

## IPTV

The IPTV tab includes the category-grouped [iptv-org playlist](https://iptv-org.github.io/iptv/index.category.m3u). Add additional public HTTPS M3U playlists from **Settings → IPTV Playlists**. IPTV streams must allow direct browser playback; protected, DRM, or offline streams cannot be played by the embedded player.

## DNS Configuration

You must set your DNS to `1.1.1.1` (Cloudflare) to fetch data from TMDB. The API may be blocked by certain DNS providers.

**Android:** Settings > Network > Private DNS > `One.One.One.One`

## Getting Started

1. Clone and install:

```bash
git clone https://github.com/kunalkcube/yummy.git
cd yummy
npm install
```

2. Set up environment variables:

```bash
cp .env.example .env
```

Edit `.env` with your API keys:

```
TMDB_API_KEY=your_tmdb_api_key_here
EXPO_PUBLIC_MANGAPLUS_BASE_URL=your_mangaplus_api_url
```

3. Start the app:

```bash
npm start
```

---

Built by [kunalkcube](https://github.com/kunalkcube)
