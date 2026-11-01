# Still

Still is a calm space for a daily pause: play Word Garden or a mini crossword, explore astronomy, read science and technology news, learn a German word, discover a painting, and build a personal vision board with photos and small, trackable steps.

[Open Still](https://still-a-little-every-day.cleanode2.chatgpt.site/)

## Technologies

- Plain JavaScript ES modules, semantic HTML, and responsive CSS; no frontend framework.
- A Cloudflare Workers-compatible server handles public content requests and serves the app. The live version is hosted with ChatGPT Sites.
- [Astronomy Engine](https://github.com/cosinekitty/astronomy), bundled locally, calculates the Moon's phase, illumination, and local rise/set times in the browser.
- Node.js for local development, esbuild for bundling, Prettier for formatting, and Node's built-in test runner.

## Daily content and data sources

The browser requests the app's `/api/*` routes with the selected date and time zone. The server fetches these public sources without private API keys:

| Feature                   | Source and selection                                                                                                                                               |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Science news              | [ScienceDaily RSS](https://www.sciencedaily.com/rss/all.xml); one date-based selection, preferring stories from that local day.                                    |
| Technology news           | [TechCrunch RSS](https://techcrunch.com/feed/), with [Ars Technica](https://feeds.arstechnica.com/arstechnica/technology-lab) as a fallback.                       |
| Astronomy                 | [NASA Astronomy Picture of the Day](https://science.nasa.gov/apod/); the current image, explanation, credits, and original publication date.                       |
| Art                       | [Cleveland Museum of Art Open Access API](https://openaccess-api.clevelandart.org/api/artworks/); a date-based painting selection with its image and museum facts. |
| German                    | A rotating local vocabulary collection, enriched with a definition and pronunciation from [Wiktionary](https://en.wiktionary.org/w/api.php).                       |
| Vision-board photo search | [Wikimedia Commons](https://commons.wikimedia.org/w/api.php); image results include source and license attribution.                                                |
| Puzzles                   | Local word and crossword collections selected deterministically by date.                                                                                           |

Daily responses are cached in the browser by date and time zone; the server also uses the hosting cache when available. NASA content carries its actual source date and is retried after 15 minutes if today's feature has not arrived. News may show the latest available story when nothing was published that day. Source failures show a retry option; German vocabulary remains available locally.

Progress, saved discoveries, vision-board images, settings, and optional location coordinates stay in that browser's `localStorage`. There are no accounts, database, or cross-device sync. Settings includes JSON backup and import. Browser geolocation is requested only after choosing **Use my location**; lunar calculations happen on the device.

## Run locally

Requires Node.js 22.12 or newer.

```sh
npm ci
npm run dev
```

Open [the local preview](http://127.0.0.1:4174). After editing source, rebuild with `npm run build` and refresh the page. Set `PORT` to use another port.

```sh
npm test
npm run format:check
npm run build
npm run validate
```

The build writes a self-contained Worker to `dist/server/index.js`. Generated output, dependencies, credentials, and account-specific Sites settings are excluded from this repository.

## Code layout

- `src/client/` — feature modules, rendering, dialogs, and personal storage.
- `src/data/` — puzzle grids, word hints, and German vocabulary.
- `src/*.mjs` — content adapters, puzzle logic, lunar calculations, state rules, and Worker routes.
- `src/style.css` and `src/index.html` — presentation and page shell.
- `scripts/` — build, local server, artifact validation, and tests.
- `assets/` and `vendor/` — bundled imagery and Astronomy Engine.

See [third-party credits](THIRD_PARTY.md) for bundled libraries and images.
