// Configuration constants for BTC Badge
export const CONFIG = {
    // Public price endpoints (no API key). Tried in order until one succeeds.
    PRICE_ENDPOINTS: [
        { id: 'coinbase', url: 'https://api.coinbase.com/v2/prices/BTC-USD/spot' },
        { id: 'mempool', url: 'https://mempool.space/api/v1/prices' },
        { id: 'kraken', url: 'https://api.kraken.com/0/public/Ticker?pair=XBTUSD' },
        { id: 'coinpaprika', url: 'https://api.coinpaprika.com/v1/tickers/btc-bitcoin' }
    ],
    // Daily OHLC for Pi multiple = price / (2 * SMA(350)). Tried in order.
    OHLC_ENDPOINTS: [
        {
            id: 'kraken',
            url: 'https://api.kraken.com/0/public/OHLC?pair=XBTUSD&interval=1440'
        },
        {
            id: 'coinbase',
            url: 'https://api.exchange.coinbase.com/products/BTC-USD/candles?granularity=86400'
        }
    ],
    // MVRV Z-score (BGeometrics / bitcoin-data.com). Free tier ~8–10 req/hour — cache hard.
    MVRV_ENDPOINTS: [
        { id: 'bitcoin-data-api', url: 'https://api.bitcoin-data.com/v1/mvrv-zscore/last' },
        { id: 'bitcoin-data', url: 'https://bitcoin-data.com/api/v1/mvrv-zscore/last' },
        { id: 'bitcoin-data-series', url: 'https://api.bitcoin-data.com/v1/mvrv-zscore' }
    ],
    METRICS_AVAILABLE: {
        btc_price: true,
        mvrvzscore: true,
        pimultiple: true
    },
    METRIC_LINKS: {
        btc_price: 'https://coinmarketcap.com/currencies/bitcoin/',
        mvrvzscore: 'https://www.lookintobitcoin.com/charts/mvrv-zscore/',
        pimultiple: 'https://www.lookintobitcoin.com/charts/pi-cycle-top-indicator/'
    },
    // Separate TTLs: spot price refreshes often; on-chain MVRV rarely; Pi SMA is daily.
    CACHE_TTL: {
        price: 5 * 60 * 1000,          // 5 minutes
        pi: 60 * 60 * 1000,            // 1 hour (OHLC / SMA350)
        mvrv: 12 * 60 * 60 * 1000      // 12 hours (rate-limit friendly)
    },
    // Legacy alias used by alarm / overall freshness checks
    CACHE_DURATION: 5 * 60 * 1000,
    UPDATE_INTERVAL: 5, // minutes
    RETRY_ATTEMPTS: 3,
    RETRY_DELAY: 1000,
    PI_SMA_DAYS: 350,
    DEFAULT_BADGE_METRIC: 'btc_price',
    BADGE_COLORS: {
        ERROR: '#FF0000',
        NORMAL: '#0000FF'
    }
};
