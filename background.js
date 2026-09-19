import { CONFIG } from './config.js';
import { isFiniteNumber, isFresh } from './fetch-utils.js';
import { fetchBtcPrice } from './metrics-price.js';
import { fetchPiMultiple } from './metrics-pi.js';
import { fetchMvrvZscore } from './metrics-mvrv.js';

let currentBadgeMetric = CONFIG.DEFAULT_BADGE_METRIC;

/** In-memory metric caches (also mirrored to chrome.storage.local). */
const caches = {
    price: null,
    pi: null,
    mvrv: null
};

const persistCaches = () => {
    chrome.storage.local.set({
        priceCache: caches.price,
        piCache: caches.pi,
        mvrvCache: caches.mvrv,
        cachedData: buildCombinedPayload(),
        cacheTimestamp: Date.now()
    });
};

const clearMetricCaches = () =>
    new Promise((resolve) => {
        chrome.storage.local.remove(
            ['priceCache', 'piCache', 'mvrvCache', 'cachedData', 'cacheTimestamp'],
            () => {
                caches.price = null;
                caches.pi = null;
                caches.mvrv = null;
                resolve();
            }
        );
    });

const hydrateCache = (entry) =>
    entry && isFiniteNumber(entry.value)
        ? entry
        : null;

const loadCachesFromStorage = () =>
    new Promise((resolve) => {
        chrome.storage.local.get(
            ['priceCache', 'piCache', 'mvrvCache', 'cachedData', 'cacheTimestamp'],
            (result) => {
                if (chrome.runtime.lastError) {
                    console.warn('storage.local.get failed:', chrome.runtime.lastError.message);
                    resolve(false);
                    return;
                }
                caches.price = hydrateCache(result.priceCache);
                caches.pi = hydrateCache(result.piCache);
                caches.mvrv = hydrateCache(result.mvrvCache);

                if (!caches.price && isFiniteNumber(result.cachedData?.btc_price)) {
                    caches.price = {
                        value: Number(result.cachedData.btc_price),
                        source: result.cachedData.price_source || 'legacy',
                        timestamp: result.cacheTimestamp || 0
                    };
                }
                if (!caches.mvrv && isFiniteNumber(result.cachedData?.current_mvrvzscore)) {
                    caches.mvrv = {
                        value: Number(result.cachedData.current_mvrvzscore),
                        delayed: Boolean(result.cachedData.mvrv_delayed),
                        source: result.cachedData.mvrv_source || 'legacy',
                        timestamp: result.cacheTimestamp || 0
                    };
                }
                if (!caches.pi && isFiniteNumber(result.cachedData?.current_pimultiple)) {
                    caches.pi = {
                        value: Number(result.cachedData.current_pimultiple),
                        sma350: null,
                        source: result.cachedData.pi_source || 'legacy',
                        timestamp: result.cacheTimestamp || 0
                    };
                }
                resolve(true);
            }
        );
    });

/** Normalize to legacy field names so popup/badge keep working. Never emit NaN. */
const buildCombinedPayload = () => {
    const price = isFiniteNumber(caches.price?.value) ? Number(caches.price.value) : null;
    const mvrv = isFiniteNumber(caches.mvrv?.value) ? Number(caches.mvrv.value) : null;
    const pi = isFiniteNumber(caches.pi?.value) ? Number(caches.pi.value) : null;

    return {
        btc_price: price,
        current_mvrvzscore: mvrv,
        current_pimultiple: pi,
        metrics_status: {
            btc_price: isFiniteNumber(price) ? 'ok' : 'unavailable',
            mvrvzscore: isFiniteNumber(mvrv) ? 'ok' : 'unavailable',
            pimultiple: isFiniteNumber(pi) ? 'ok' : 'unavailable'
        },
        price_source: caches.price?.source || null,
        mvrv_source: caches.mvrv?.source || null,
        mvrv_delayed: Boolean(caches.mvrv?.delayed),
        mvrv_date: caches.mvrv?.date || null,
        pi_source: caches.pi?.source || null
    };
};

const resolveBadgeMetric = (metric, data) => {
    const requested = metric || CONFIG.DEFAULT_BADGE_METRIC;
    if (requested === 'btc_price' && isFiniteNumber(data?.btc_price)) return 'btc_price';
    if (requested === 'mvrvzscore' && isFiniteNumber(data?.current_mvrvzscore)) return 'mvrvzscore';
    if (requested === 'pimultiple' && isFiniteNumber(data?.current_pimultiple)) return 'pimultiple';
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
    const metric = resolveBadgeMetric(currentBadgeMetric, data);
    if (metric !== currentBadgeMetric) {
        currentBadgeMetric = metric;
        chrome.storage.sync.set({ badgeMetric: metric });
    }

    const missingPinned =
        (metric === 'btc_price' && !isFiniteNumber(data.btc_price)) ||
        (metric === 'mvrvzscore' && !isFiniteNumber(data.current_mvrvzscore)) ||
        (metric === 'pimultiple' && !isFiniteNumber(data.current_pimultiple));

    if (missingPinned) {
        chrome.action.setBadgeText({ text: 'ERR' });
        chrome.action.setBadgeBackgroundColor({ color: CONFIG.BADGE_COLORS.ERROR });
        chrome.action.setBadgeTextColor({ color: '#FFFFFF' });
        return;
    }

    chrome.action.setBadgeText({ text: String(formatBadgeText(metric, data)) });
    chrome.action.setBadgeBackgroundColor({ color: CONFIG.BADGE_COLORS.NORMAL });
    chrome.action.setBadgeTextColor({ color: '#FFFFFF' });
};

const fetchDataAndUpdateBadge = async () => {
    const errors = [];

    try {
        caches.price = await fetchBtcPrice(caches.price);
    } catch (error) {
        errors.push(error);
        console.error('Price fetch failed:', error);
        if (!isFiniteNumber(caches.price?.value)) {
            caches.price = null;
        }
    }

    const livePrice = caches.price?.value;

    try {
        caches.pi = await fetchPiMultiple(caches.pi, livePrice);
    } catch (error) {
        errors.push(error);
        console.warn('Pi fetch failed:', error);
        if (!isFiniteNumber(caches.pi?.value)) {
            caches.pi = null;
        }
    }

    try {
        const next = await fetchMvrvZscore(caches.mvrv);
        caches.mvrv = next && isFiniteNumber(next.value) ? next : null;
    } catch (error) {
        errors.push(error);
        console.warn('MVRV fetch failed:', error);
        if (!isFiniteNumber(caches.mvrv?.value)) {
            caches.mvrv = null;
        }
    }

    const data = buildCombinedPayload();
    updateBadge(data);
    persistCaches();

    if (!isFiniteNumber(data.btc_price)) {
        chrome.action.setBadgeText({ text: 'ERR' });
        chrome.action.setBadgeBackgroundColor({ color: CONFIG.BADGE_COLORS.ERROR });
        chrome.action.setBadgeTextColor({ color: '#FFFFFF' });
        throw errors[0] || new Error('Failed to fetch Bitcoin metrics');
    }

    return data;
};

const ensureBadgeMetricPersisted = () => {
    chrome.storage.sync.get('badgeMetric', (result) => {
        if (chrome.runtime.lastError) {
            console.warn('storage.sync.get failed:', chrome.runtime.lastError.message);
            return;
        }
        if (result.badgeMetric) {
            currentBadgeMetric = result.badgeMetric;
            const data = buildCombinedPayload();
            if (isFiniteNumber(data.btc_price) || isFiniteNumber(data.current_mvrvzscore)) {
                updateBadge(data);
            }
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

chrome.runtime.onInstalled.addListener((details) => {
    if (details.reason === 'update' || details.reason === 'install') {
        clearMetricCaches().then(() => {
            fetchDataAndUpdateBadge().catch(() => {});
        });
    }
});

(async () => {
    await loadCachesFromStorage();
    const warmed = buildCombinedPayload();
    if (
        isFiniteNumber(warmed.btc_price) ||
        isFiniteNumber(warmed.current_mvrvzscore) ||
        isFiniteNumber(warmed.current_pimultiple)
    ) {
        updateBadge(warmed);
    }

    const needsRefresh =
        !isFresh(caches.price, CONFIG.CACHE_TTL.price) ||
        !isFresh(caches.pi, CONFIG.CACHE_TTL.pi) ||
        !isFresh(caches.mvrv, CONFIG.CACHE_TTL.mvrv);

    if (needsRefresh) {
        fetchDataAndUpdateBadge().catch(() => {});
    }
})();

chrome.alarms.create('updateBadge', { periodInMinutes: CONFIG.UPDATE_INTERVAL });

chrome.alarms.onAlarm.addListener((alarm) => {
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

        const allFresh =
            isFresh(caches.price, CONFIG.CACHE_TTL.price) &&
            isFresh(caches.pi, CONFIG.CACHE_TTL.pi) &&
            isFresh(caches.mvrv, CONFIG.CACHE_TTL.mvrv);

        if (allFresh) {
            reply({ success: true, data: { data: buildCombinedPayload() } });
            return false;
        }

        fetchDataAndUpdateBadge()
            .then((data) => reply({ success: true, data: { data } }))
            .catch((error) => {
                const data = buildCombinedPayload();
                if (isFiniteNumber(data.btc_price)) {
                    reply({ success: true, data: { data } });
                } else {
                    reply({ success: false, error: String(error) });
                }
            });
        return true;
    }

    if (request.action === 'updateBadgeMetric') {
        const metric = request.metric || CONFIG.DEFAULT_BADGE_METRIC;
        currentBadgeMetric = metric;
        chrome.storage.sync.set({ badgeMetric: metric }, () => {
            if (chrome.runtime.lastError) {
                console.warn('Failed to persist badgeMetric:', chrome.runtime.lastError.message);
            }
        });
        const data = buildCombinedPayload();
        if (isFiniteNumber(data.btc_price) || isFiniteNumber(data.current_mvrvzscore)) {
            updateBadge(data);
            sendResponse({ success: true, metric: currentBadgeMetric });
        } else {
            fetchDataAndUpdateBadge()
                .then(() => sendResponse({ success: true, metric: currentBadgeMetric }))
                .catch((error) => sendResponse({ success: false, error: String(error) }));
            return true;
        }
    }

    return false;
});

ensureBadgeMetricPersisted();
