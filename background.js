import { CONFIG } from './config.js';

let currentBadgeMetric = CONFIG.DEFAULT_BADGE_METRIC;
let cachedData = null;
let cacheTimestamp = null;

const isCacheValid = () => {
    if (!cachedData || !cacheTimestamp) return false;
    return (Date.now() - cacheTimestamp) < CONFIG.CACHE_DURATION;
};

const retryFetch = async (url, attempts = CONFIG.RETRY_ATTEMPTS) => {
    for (let i = 0; i < attempts; i++) {
        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            return await response.json();
        } catch (error) {
            if (i === attempts - 1) throw error;
            await new Promise(resolve => setTimeout(resolve, CONFIG.RETRY_DELAY));
        }
    }
};

const fetchDataAndUpdateBadge = async () => {
    try {
        if (isCacheValid()) {
            updateBadge(cachedData);
            return;
        }

        const data = await retryFetch(CONFIG.API_URL);
        updateBadge(data.data);
        // 更新缓存和时间戳
        cachedData = data.data;
        cacheTimestamp = Date.now();
        chrome.storage.local.set({ 
            cachedData: data.data,
            cacheTimestamp: cacheTimestamp
        });
    } catch (error) {
        console.error('Error fetching data:', error);
        chrome.action.setBadgeText({text: 'ERR'});
        chrome.action.setBadgeBackgroundColor({color: CONFIG.BADGE_COLORS.ERROR});
        chrome.action.setBadgeTextColor({color: '#FFFFFF'});
    }
};

const updateBadge = (data) => {
    cachedData = data;
    let badgeText;
    switch (currentBadgeMetric) {
        case 'mvrvzscore':
            badgeText = parseFloat(data.current_mvrvzscore).toFixed(1);
            break;
        case 'pimultiple':
            badgeText = parseFloat(data.current_pimultiple).toFixed(1);
            break;
        case 'btc_price':
            badgeText = new Intl.NumberFormat('en-US', {
                style: 'currency',
                currency: 'USD',
                minimumFractionDigits: 0,
                maximumFractionDigits: 0,
                notation: 'compact',
                compactDisplay: 'short'
            }).format(parseFloat(data.btc_price)).replace('$', '');
            break;
    }
    
    chrome.action.setBadgeText({text: badgeText.toString()});
    chrome.action.setBadgeBackgroundColor({color: CONFIG.BADGE_COLORS.NORMAL});
    chrome.action.setBadgeTextColor({color: '#FFFFFF'});
};

// 初始化时，先从缓存加载数据
chrome.storage.local.get(['cachedData', 'cacheTimestamp'], (result) => {
    if (result.cachedData && result.cacheTimestamp) {
        cachedData = result.cachedData;
        cacheTimestamp = result.cacheTimestamp;
        if (isCacheValid()) {
            updateBadge(cachedData);
            return;
        }
    }
    fetchDataAndUpdateBadge();
});

// 设置定期更新
chrome.alarms.create('updateBadge', { periodInMinutes: CONFIG.UPDATE_INTERVAL });

chrome.alarms.onAlarm.addListener(alarm => {
    if (alarm.name === 'updateBadge') {
        fetchDataAndUpdateBadge();
    }
});

// 处理来自popup的消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "fetchBitcoinStats") {
        if (cachedData) {
            sendResponse({success: true, data: { data: cachedData }});
        } else {
            retryFetch(CONFIG.API_URL)
                .then(data => {
                    cachedData = data.data;
                    cacheTimestamp = Date.now();
                    chrome.storage.local.set({ 
                        cachedData: data.data,
                        cacheTimestamp: cacheTimestamp
                    });
                    sendResponse({success: true, data: data});
                })
                .catch(error => {
                    console.error('Error:', error);
                    sendResponse({success: false, error: error.toString()});
                });
        }
        return true;  // 保持消息通道开放，以便异步响应
    } else if (request.action === "updateBadgeMetric") {
        currentBadgeMetric = request.metric;
        if (cachedData) {
            updateBadge(cachedData);
        } else {
            fetchDataAndUpdateBadge();
        }
    }
});

// 加载保存的badge metric
chrome.storage.sync.get('badgeMetric', (data) => {
    if (data.badgeMetric) {
        currentBadgeMetric = data.badgeMetric;
        if (cachedData) {
            updateBadge(cachedData);
        }
    }
});