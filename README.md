# BTC Badge - Bitcoin Price Ticker

![BTC Badge Logo](icon128.png)

A Chrome extension that displays Bitcoin metrics directly in your browser's toolbar. Track **BTC price**, **MVRV Z-score**, and **Pi multiple** with a single glance — and pin any of them to the badge.

## Features

- 🔄 Real-time Bitcoin price updates
- 📊 MVRV Z-score tracking
- 📈 Pi Multiple indicator
- 🔝 Pin any metric to the toolbar badge
- 💾 Local data caching with separate TTLs per metric
- ⚡ Lightweight Manifest V3 service worker

## Installation

### Option 1: Install from Chrome Web Store (Recommended)

Visit [BTC Badge on Chrome Web Store](https://chromewebstore.google.com/detail/btc-badge-bitcoin-price-t/ifjgfkaoepolegjfndicdmcmigjdoofe) and click "Add to Chrome" to install.

### Option 2: Install from Source

1. Download or clone this repository
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" in the top right corner
4. Click "Load unpacked" and select the extension directory

## Usage

1. After installation, you'll see the BTC Badge icon in your Chrome toolbar
2. Click the icon to open the popup with detailed metrics
3. Hover over any available metric and click the 🔝 button to pin it to your toolbar
4. The badge refreshes on a 5-minute alarm (spot price); slower metrics use longer caches

## Metrics Explained

- **BTC Price**: Current Bitcoin price in USD
- **MVRV Z-Score**: Market Value to Realized Value Z-Score (from [bitcoin-data.com](https://bitcoin-data.com/) / BGeometrics)
- **Pi Multiple**: Local computation `price / (2 × SMA(350))` from daily OHLC closes (classic simplification used by many BTC tools; related to the Pi Cycle Top idea, not a licensed LookIntoBitcoin feed)

## Data Sources (v0.2.1)

**Breaking change vs ≤0.1.1:** The previous single-source API `https://bitcoinition.com/current.json` now returns **HTTP 404** (site appears gone / replaced). That endpoint previously supplied `btc_price`, `current_mvrvzscore`, and `current_pimultiple` together. v0.2.x rebuilds all three from free public sources.

### BTC USD price (tried in order)

1. [Coinbase](https://api.coinbase.com/v2/prices/BTC-USD/spot)
2. [mempool.space](https://mempool.space/api/v1/prices)
3. [Kraken](https://api.kraken.com/0/public/Ticker?pair=XBTUSD)
4. [CoinPaprika](https://api.coinpaprika.com/v1/tickers/btc-bitcoin)

Cache TTL ≈ **5 minutes**.

### Pi multiple

Computed locally from daily OHLC:

1. Kraken `OHLC?pair=XBTUSD&interval=1440`
2. Fallback: Coinbase Exchange daily candles

Formula: **`live_price / (2 * SMA(350))`**. OHLC/SMA cache TTL ≈ **1 hour** (daily bars); the numerator updates when spot price refreshes.

### MVRV Z-score

[BGeometrics bitcoin-data.com](https://bitcoin-data.com/) free endpoints (no API key):

- `GET https://api.bitcoin-data.com/v1/mvrv-zscore/last`
- Fallback: `https://bitcoin-data.com/api/v1/mvrv-zscore/last`

**Honesty notes:**

- Free tier is tightly rate-limited (~8–10 requests/hour). The extension caches MVRV for **~12 hours** and reuses stale cache on HTTP 429.
- Free `/last` responses may include `"delayed": true` — real-time (last ~7 days) can require a paid plan. The popup notes when a delayed value is shown.
- No paid API keys are required or shipped in this repo.

## Version History

- v0.2.1: Restore MVRV Z-score + Pi multiple (bitcoin-data.com + local SMA350); separate cache TTLs; drop dead bitcoinition host
- v0.2.0: Multi-source BTC price after bitcoinition.com 404; temporary MVRV/Pi N/A
- v0.1.1: Added caching mechanism and improved UI/UX
- v0.1.0: Initial release

## Privacy

This extension only requests public market / on-chain summary data from the hosts listed above and does not collect or transmit any personal information. See [docs/privacy.html](docs/privacy.html).

## Contributing

Feel free to submit issues and enhancement requests!

## License

This project is licensed under the MIT License - see the LICENSE file for details.

---
Made with ❤️ for Bitcoin enthusiasts
