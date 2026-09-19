/** Shared fetch helpers for BTC Badge metric sources. */
import { CONFIG } from './config.js';

/** Reject null/undefined/'' — Number(null)===0 would otherwise fake a valid metric. */
export const isFiniteNumber = (value) =>
    value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value));

export const isFresh = (entry, ttl) =>
    Boolean(entry && entry.timestamp && (Date.now() - entry.timestamp) < ttl);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Fetch JSON with limited retries. Does NOT retry HTTP 429 (rate limit).
 */
export const fetchJson = async (url, attempts = CONFIG.RETRY_ATTEMPTS) => {
    let lastError;
    for (let i = 0; i < attempts; i++) {
        try {
            const response = await fetch(url);
            if (response.status === 429) {
                const err = new Error(`HTTP 429 rate limited: ${url}`);
                err.status = 429;
                throw err;
            }
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return await response.json();
        } catch (error) {
            lastError = error;
            if (error?.status === 429) throw error;
            if (i < attempts - 1) await sleep(CONFIG.RETRY_DELAY);
        }
    }
    throw lastError || new Error(`Failed to fetch ${url}`);
};
