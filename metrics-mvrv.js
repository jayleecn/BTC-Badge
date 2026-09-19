/** MVRV Z-score from bitcoin-data.com (BGeometrics) free tier. */
import { CONFIG } from './config.js';
import { fetchJson, isFiniteNumber, isFresh } from './fetch-utils.js';

/** Last known good free-tier /last reading (curl when API worked). Prefer live + real cache. */
const SEED_DELAYED_MVRV = {
    value: 0.8061,
    delayed: true,
    date: '2026-09-12',
    source: 'seed-delayed'
};

const parseMvrvZscore = (json) => {
    const readRow = (row) => {
        if (!row || typeof row !== 'object') return null;
        const raw =
            row.mvrvZscore ??
            row.mvrv_zscore ??
            row.mvrvzscore ??
            row.zscore ??
            row.value;
        if (!isFiniteNumber(raw)) return null;
        const value = Number(raw);
        if (!Number.isFinite(value)) return null;
        return {
            value,
            delayed: Boolean(row.delayed),
            date: row.d || null
        };
    };

    if (Array.isArray(json) && json.length) {
        return readRow(json[json.length - 1]);
    }
    return readRow(json);
};

export const fetchMvrvZscore = async (cacheEntry) => {
    if (isFresh(cacheEntry, CONFIG.CACHE_TTL.mvrv) && isFiniteNumber(cacheEntry.value)) {
        return cacheEntry;
    }

    let lastError;
    let rateLimited = false;

    for (const endpoint of CONFIG.MVRV_ENDPOINTS) {
        try {
            const json = await fetchJson(endpoint.url, 1);
            const parsed = parseMvrvZscore(json);
            if (!parsed || !isFiniteNumber(parsed.value)) {
                lastError = new Error(`Unexpected MVRV payload from ${endpoint.id}`);
                continue;
            }
            return {
                value: parsed.value,
                delayed: parsed.delayed,
                date: parsed.date,
                source: endpoint.id,
                timestamp: Date.now()
            };
        } catch (error) {
            lastError = error;
            if (error?.status === 429) rateLimited = true;
            console.warn(`MVRV source ${endpoint.id} failed:`, error);
            if (rateLimited) break;
        }
    }

    if (cacheEntry && isFiniteNumber(cacheEntry.value)) {
        console.warn(
            rateLimited
                ? 'MVRV rate-limited; serving stale cached Z-score'
                : 'Using stale MVRV cache after fetch failures'
        );
        return cacheEntry;
    }

    // Cold start / 429 with empty cache: seed last known good free-tier reading (never NaN).
    console.warn(
        rateLimited
            ? 'MVRV rate-limited with empty cache; using seed-delayed fallback'
            : `All MVRV sources failed with empty cache (${lastError || 'unknown'}); using seed-delayed fallback`
    );
    return {
        ...SEED_DELAYED_MVRV,
        timestamp: Date.now()
    };
};
