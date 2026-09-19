import { CONFIG } from './config.js';

let currentBadgeMetric = CONFIG.DEFAULT_BADGE_METRIC;
let cachedData = null;
let cacheTimestamp = null;

const isCacheValid = () => {
    if (!cachedData || !cacheTimestamp) return false;
    return (Date.now() - cacheTimestamp) < CONFIG.CACHE_DURATION;
};

const isFiniteNumber = (value) => Number.isFinite(Number(value));

const retryFetch = async (url, attempts = CONFIG.RETRY_ATTEMPTS) => {
    let lastError;
    for (let i = 0; i < attempts; i++) {
        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            return await response.json();
        } catch (error) {
            lastError = error;
            if (i < attempts - 1) {
                await new Promise(resolve => setTimeout(resolve, CONFIG.RETRY_DELAY));
            }
        }
    }
    throw lastError || new Error(`Failed to fetch ${url}`);
};

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

const fetchBtcPrice = async () => {
    let lastError;
    for (const endpoint of CONFIG.PRICE_ENDPOINTS) {
        try {
            const json = await retryFetch(endpoint.url);
            const price = parsePriceFromEndpoint(endpoint.id, json);
            if (isFiniteNumber(price) && price > 0) {
                return { price, source: endpoint.id };
            }
            lastError = new Error(`Invalid price from ${endpoint.id}`);
        } catch (error) {
            lastError = error;
            console.warn(`Price source ${endpoint.id} failed:`, error);
        }
    }
    throw lastError || new Error('All price sources failed');
};

/** Normalize to legacy field names so popup/badge keep working. */
const buildMetricsPayload = ({ price, source }) => ({
    btc_price: price,
    current_mvrvzscore: null,
    current_pimultiple: null,
    metrics_status: {
        btc_price: 'ok',
        mvrvzscore: CONFIG.METRICS_AVAILABLE.mvrvzscore ? 'ok' : 'unavailable',
        pimultiple: CONFIG.METRICS_AVAILABLE.pimultiple ? 'ok' : 'unavailable'
    },
    price_source: source
});

const resolveBadgeMetric = (metric, data) => {
    const requested = metric || CONFIG.DEFAULT_BADGE_METRIC;
    if (requested === 'btc_price' && isFiniteNumber(data?.btc_price)) {
        return 'btc_price';
    }
    if (requested === 'mvrvzscore' && isFiniteNumber(data?.current_mvrvzscore)) {
        return 'mvrvzscore';
    }
    if (requested === 'pimultiple' && isFiniteNumber(data?.current_pimultiple)) {
        return 'pimultiple';
    }
    // Prefer price when selected (or default) metric is missing.
    if (isFiniteNumber(data?.btc_price)) return 'btc_price';
    return requested;
};

const formatBadgeText = (metric, data) => {
    switch (metric) {
        case 'mvrvzscore':
            return parseFloat(data.current_mvrvzscore).toFixed(1);
        case 'pimultiple':
            return parseFloat(data.current_pimultiple).toFixed(1);
        case 'btc_price':
        default:
            return new Intl.NumberFormat('en-US', {
                style: 'currency',
                currency: 'USD',
                minimumFractionDigits: 0,
                maximumFractionDigits: 0,
                notation: 'compact',
                compactDisplay: 'short'
            }).format(parseFloat(data.btc_price)).replace('$', '');
    }
};

const updateBadge = (data) => {
    if (!data) return;
    cachedData = data;
    const metric = resolveBadgeMetric(currentBadgeMetric, data);
    if (metric !== currentBadgeMetric) {
        currentBadgeMetric = metric;
        chrome.storage.sync.set({ badgeMetric: metric });
    }

    if (!isFiniteNumber(data.btc_price) && metric === 'btc_price') {
        chrome.action.setBadgeText({ text: 'ERR' });
        chrome.action.setBadgeBackgroundColor({ color: CONFIG.BADGE_COLORS.ERROR });
        chrome.action.setBadgeTextColor({ color: '#FFFFFF' });
        return;
    }

    const badgeText = formatBadgeText(metric, data);
    chrome.action.setBadgeText({ text: String(badgeText) });
    chrome.action.setBadgeBackgroundColor({ color: CONFIG.BADGE_COLORS.NORMAL });
    chrome.action.setBadgeTextColor({ color: '#FFFFFF' });
};

const persistCache = (data) => {
    cachedData = data;
    cacheTimestamp = Date.now();
    chrome.storage.local.set({
        cachedData: data,
        cacheTimestamp
    });
};

const fetchDataAndUpdateBadge = async () => {
    try {
        if (isCacheValid()) {
            updateBadge(cachedData);
            return cachedData;
        }

        const { price, source } = await fetchBtcPrice();
        const data = buildMetricsPayload({ price, source });
        updateBadge(data);
        persistCache(data);
        return data;
    } catch (error) {
        console.error('Error fetching data:', error);
        chrome.action.setBadgeText({ text: 'ERR' });
        chrome.action.setBadgeBackgroundColor({ color: CONFIG.BADGE_COLORS.ERROR });
        chrome.action.setBadgeTextColor({ color: '#FFFFFF' });
        throw error;
    }
};

const ensureBadgeMetricPersisted = () => {
    chrome.storage.sync.get('badgeMetric', (result) => {
        if (chrome.runtime.lastError) {
            console.warn('storage.sync.get failed:', chrome.runtime.lastError.message);
            return;
        }
        if (result.badgeMetric) {
            currentBadgeMetric = result.badgeMetric;
            if (cachedData) updateBadge(cachedData);
            return;
        }
        chrome.storage.sync.set({ badgeMetric: CONFIG.DEFAULT_BADGE_METRIC }, () => {
            if (chrome.runtime.lastError) {
                console.warn('storage.sync.set failed:', chrome.runtime.lastError.message);
            }
        });
        currentBadgeMetric = CONFIG.DEFAULT_BADGE_METRIC;
    });
};

// Warm from local cache, then refresh if stale.
chrome.storage.local.get(['cachedData', 'cacheTimestamp'], (result) => {
    if (chrome.runtime.lastError) {
        console.warn('storage.local.get failed:', chrome.runtime.lastError.message);
        fetchDataAndUpdateBadge().catch(() => {});
        return;
    }
    if (result.cachedData && result.cacheTimestamp) {
        cachedData = result.cachedData;
        cacheTimestamp = result.cacheTimestamp;
        if (isCacheValid()) {
            updateBadge(cachedData);
            return;
        }
    }
    fetchDataAndUpdateBadge().catch(() => {});
});

chrome.alarms.create('updateBadge', { periodInMinutes: CONFIG.UPDATE_INTERVAL });

chrome.alarms.onAlarm.addListener(alarm => {
    if (alarm.name === 'updateBadge') {
        fetchDataAndUpdateBadge().catch(() => {});
    }
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'fetchBitcoinStats') {
        const reply = (payload) => {
            try {
                sendResponse(payload);
            } catch (error) {
                console.warn('sendResponse failed:', error);
            }
        };

        if (cachedData && isCacheValid()) {
            reply({ success: true, data: { data: cachedData } });
            return false;
        }

        fetchDataAndUpdateBadge()
            .then(data => reply({ success: true, data: { data } }))
            .catch(error => reply({ success: false, error: String(error) }));
        return true; // keep channel open for async reply
    }

    if (request.action === 'updateBadgeMetric') {
        const metric = request.metric || CONFIG.DEFAULT_BADGE_METRIC;
        currentBadgeMetric = metric;
        chrome.storage.sync.set({ badgeMetric: metric }, () => {
            if (chrome.runtime.lastError) {
                console.warn('Failed to persist badgeMetric:', chrome.runtime.lastError.message);
            }
        });
        if (cachedData) {
            updateBadge(cachedData);
            sendResponse({ success: true, metric: currentBadgeMetric });
        } else {
            fetchDataAndUpdateBadge()
                .then(() => sendResponse({ success: true, metric: currentBadgeMetric }))
                .catch(error => sendResponse({ success: false, error: String(error) }));
            return true;
        }
    }

    return false;
});

ensureBadgeMetricPersisted();
