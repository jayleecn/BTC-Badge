# Repository navigation

Chrome Manifest V3 extension using native JavaScript modules; no npm/build step.

- `manifest.json` identifies the worker (`background.js`) and popup (`popup.html`).
- Data sources and TTLs: `config.js`; parsers/fallbacks: `metrics-price.js`, `metrics-mvrv.js`, `metrics-pi.js`; shared fetch helpers: `fetch-utils.js`.
- Badge/cache/alarm/message orchestration: `background.js`; UI and pinning: `popup.js`, `styles.css`.
- `index.html` is marketing, not the popup. Privacy copy: `docs/privacy.html`.
- [README.md](README.md) contains source installation, message/storage contracts, and smoke checks.

The manifest is the version authority; `config.js` is the endpoint/TTL authority. Preserve the worker/popup's legacy metric names and nested reply shape when changing either side. MVRV can come from an embedded historical seed (`seed-delayed`); inspect source/date before treating it as fresh data. There is no automated test suite.
