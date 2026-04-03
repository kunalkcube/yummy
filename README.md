# Yummy

A personal movie/TV show streaming app with TMDB integration, built with React Native and Expo.

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
- Stream content with multiple providers
- Read manga with built-in reader
- Dark theme
- Automatic update alerts via GitHub Releases

## Prerequisites

- TMDB API Key (free at [themoviedb.org](https://www.themoviedb.org/settings/api))

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
BASE_STREAM_URL=https://player.videasy.net
EXPO_PUBLIC_MANGAPLUS_BASE_URL=your_mangaplus_api_url
```

3. Start the app:

```bash
npm start
```

---

Made by [kunalkcube](https://github.com/kunalkcube)
