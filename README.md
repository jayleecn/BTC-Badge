# BTC Badge - Bitcoin Price Ticker

![BTC Badge Logo](icon128.png)

A Chrome extension that displays real-time Bitcoin metrics directly in your browser's toolbar. Track BTC price (and MVRV Z-score / Pi multiple when a free public source is available) with a single glance.

## Features

- 🔄 Real-time Bitcoin price updates
- 📊 MVRV Z-score tracking (when a free public API is available)
- 📈 Pi Multiple indicator (when a free public API is available)
- 🔝 Easy metric switching
- 💾 Local data caching
- ⚡ Lightweight and efficient

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
4. The badge will automatically update every 5 minutes

## Metrics Explained

- **BTC Price**: Current Bitcoin price in USD
- **MVRV Z-Score**: Market Value to Realized Value Z-Score (shown as N/A until a free public source is restored)
- **Pi Multiple**: Valuation metric related to the Pi Cycle Top indicator (shown as N/A until a free public source is restored)

## Data Source

**v0.2.0+** — BTC USD price is fetched from public no-key endpoints (tried in order):

1. [Coinbase](https://api.coinbase.com/v2/prices/BTC-USD/spot)
2. [mempool.space](https://mempool.space/api/v1/prices)
3. [Kraken](https://api.kraken.com/0/public/Ticker?pair=XBTUSD)
4. [CoinPaprika](https://api.coinpaprika.com/v1/tickers/btc-bitcoin)

**Breaking change:** The previous single-source API `https://bitcoinition.com/current.json` now returns HTTP 404 (site appears replaced). That endpoint previously supplied `btc_price`, `current_mvrvzscore`, and `current_pimultiple`. No free, no-key public replacement for MVRV Z-score or Pi multiple was found (LookIntoBitcoin / Newhedge / CryptoQuant require auth or paid plans). The extension therefore keeps price working and shows **N/A** for those metrics instead of failing the whole badge.

## Version History

- v0.2.0: Replace dead bitcoinition.com API; multi-source BTC price; graceful degrade for MVRV/Pi; hardening
- v0.1.1: Added caching mechanism and improved UI/UX
- v0.1.0: Initial release

## Privacy

This extension only requests public market data from the price hosts listed above and does not collect or transmit any personal information. See [docs/privacy.html](docs/privacy.html).

## Contributing

Feel free to submit issues and enhancement requests!

## License

This project is licensed under the MIT License - see the LICENSE file for details.

---
Made with ❤️ for Bitcoin enthusiasts
