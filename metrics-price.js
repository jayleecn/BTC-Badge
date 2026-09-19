/** BTC spot price fetchers. */
import { CONFIG } from './config.js';
import { fetchJson, isFiniteNumber, isFresh } from './fetch-utils.js';

const parsePriceFromEndpoint = (id, json) => {
    switch (id) {
        case 'coinbase':
            return parseFloat(json?.data?.amount);
        case 'mempool':
            return parseFloat(json?.USD);
        case 'kraken': {
            const ticker = json?.result?.XXBTZUSD || Object.values(json?.result || {})[0];
            return parseFloat(ticker?.c?.[0]);
        }
        case 'coinpaprika':
            return parseFloat(json?.quotes?.USD?.price);
        default:
            return NaN;
    }
};

/** @param {{ value:number, source:string, timestamp:number }|null} cacheEntry */
export const fetchBtcPrice = async (cacheEntry) => {
    if (isFresh(cacheEntry, CONFIG.CACHE_TTL.price)) {
        return cacheEntry;
    }

    let lastError;
    for (const endpoint of CONFIG.PRICE_ENDPOINTS) {
        try {
            const json = await fetchJson(endpoint.url);
            const price = parsePriceFromEndpoint(endpoint.id, json);
            if (isFiniteNumber(price) && price > 0) {
                return { value: price, source: endpoint.id, timestamp: Date.now() };
            }
            lastError = new Error(`Invalid price from ${endpoint.id}`);
        } catch (error) {
            lastError = error;
            console.warn(`Price source ${endpoint.id} failed:`, error);
        }
    }

    if (cacheEntry && isFiniteNumber(cacheEntry.value)) {
        console.warn('Using stale price cache after fetch failures');
        return cacheEntry;
    }
    throw lastError || new Error('All price sources failed');
};
