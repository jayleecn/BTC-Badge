// Configuration constants for BTC Badge
export const CONFIG = {
    // Public price endpoints (no API key). Tried in order until one succeeds.
    PRICE_ENDPOINTS: [
        { id: 'coinbase', url: 'https://api.coinbase.com/v2/prices/BTC-USD/spot' },
        { id: 'mempool', url: 'https://mempool.space/api/v1/prices' },
        { id: 'kraken', url: 'https://api.kraken.com/0/public/Ticker?pair=XBTUSD' },
        { id: 'coinpaprika', url: 'https://api.coinpaprika.com/v1/tickers/btc-bitcoin' }
    ],
    // After bitcoinition.com went down, no free no-key public API for these remains.
    METRICS_AVAILABLE: {
        btc_price: true,
        mvrvzscore: false,
        pimultiple: false
    },
    METRIC_LINKS: {
        btc_price: 'https://coinmarketcap.com/currencies/bitcoin/',
        mvrvzscore: 'https://www.lookintobitcoin.com/charts/mvrv-zscore/',
        pimultiple: 'https://www.lookintobitcoin.com/charts/pi-cycle-top-indicator/'
    },
    CACHE_DURATION: 5 * 60 * 1000, // 5 minutes
    UPDATE_INTERVAL: 5, // minutes
    RETRY_ATTEMPTS: 3,
    RETRY_DELAY: 1000,
    DEFAULT_BADGE_METRIC: 'btc_price',
    BADGE_COLORS: {
        ERROR: '#FF0000',
        NORMAL: '#0000FF'
    }
};
