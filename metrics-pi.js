/** Pi multiple = live_price / (2 * SMA(350)) from daily OHLC. */
import { CONFIG } from './config.js';
import { fetchJson, isFiniteNumber, isFresh } from './fetch-utils.js';

const extractDailyCloses = (id, json) => {
    if (id === 'kraken') {
        const result = json?.result || {};
        const pairKey = Object.keys(result).find((k) => k !== 'last');
        const bars = pairKey ? result[pairKey] : null;
        if (!Array.isArray(bars)) return [];
        return bars.map((b) => parseFloat(b[4])).filter(isFiniteNumber);
    }
    if (id === 'coinbase') {
        if (!Array.isArray(json)) return [];
        return [...json]
            .sort((a, b) => a[0] - b[0])
            .map((b) => parseFloat(b[4]))
            .filter(isFiniteNumber);
    }
    return [];
};

const computeSma = (values, window) => {
    if (!Array.isArray(values) || values.length < window) return NaN;
    const slice = values.slice(-window);
    return slice.reduce((acc, v) => acc + v, 0) / window;
};

/** @param {number|null|undefined} livePrice */
export const fetchPiMultiple = async (cacheEntry, livePrice) => {
    const canRecomputeFromSma =
        isFresh(cacheEntry, CONFIG.CACHE_TTL.pi) && isFiniteNumber(cacheEntry?.sma350);

    if (canRecomputeFromSma && isFiniteNumber(livePrice)) {
        return {
            ...cacheEntry,
            value: livePrice / (2 * cacheEntry.sma350),
            timestamp: cacheEntry.timestamp
        };
    }

    if (isFresh(cacheEntry, CONFIG.CACHE_TTL.pi) && isFiniteNumber(cacheEntry?.value)) {
        return cacheEntry;
    }

    let lastError;
    for (const endpoint of CONFIG.OHLC_ENDPOINTS) {
        try {
            const json = await fetchJson(endpoint.url);
            const closes = extractDailyCloses(endpoint.id, json);
            const sma350 = computeSma(closes, CONFIG.PI_SMA_DAYS);
            if (!isFiniteNumber(sma350) || sma350 <= 0) {
                lastError = new Error(`Insufficient OHLC bars from ${endpoint.id}`);
                continue;
            }
            const priceForPi = isFiniteNumber(livePrice) ? livePrice : closes[closes.length - 1];
            return {
                value: priceForPi / (2 * sma350),
                sma350,
                source: endpoint.id,
                timestamp: Date.now()
            };
        } catch (error) {
            lastError = error;
            console.warn(`OHLC source ${endpoint.id} failed:`, error);
        }
    }

    if (cacheEntry && isFiniteNumber(cacheEntry.value)) {
        console.warn('Using stale Pi cache after OHLC failures');
        return cacheEntry;
    }
    throw lastError || new Error('All OHLC sources failed');
};
