import { CONFIG } from './config.js';

document.addEventListener('DOMContentLoaded', () => {
    ensureDefaultBadgeMetric();
    fetchBitcoinStats();
});

const ensureDefaultBadgeMetric = () => {
    chrome.storage.sync.get('badgeMetric', (result) => {
        if (chrome.runtime.lastError) {
            console.warn('storage.sync.get failed:', chrome.runtime.lastError.message);
            return;
        }
        if (!result.badgeMetric) {
            chrome.storage.sync.set({ badgeMetric: CONFIG.DEFAULT_BADGE_METRIC });
        }
    });
};

const fetchBitcoinStats = () => {
    const statsDiv = document.getElementById('stats');
    if (!statsDiv) return;
    statsDiv.textContent = 'Loading...';

    chrome.runtime.sendMessage({ action: 'fetchBitcoinStats' }, response => {
        if (chrome.runtime.lastError) {
            console.error('Message error:', chrome.runtime.lastError.message);
            statsDiv.textContent = 'Failed to reach background. Retrying in 5 seconds...';
            setTimeout(fetchBitcoinStats, 5000);
            return;
        }

        if (!response) {
            statsDiv.textContent = 'No response from background. Retrying in 5 seconds...';
            setTimeout(fetchBitcoinStats, 5000);
            return;
        }

        if (response.success && response.data?.data) {
            displayStats(response.data.data);
        } else {
            console.error('Error:', response.error);
            statsDiv.textContent = 'Failed to retrieve data. Retrying in 5 seconds...';
            setTimeout(fetchBitcoinStats, 5000);
        }
    });
};

const formatPrice = (value) => {
    if (!Number.isFinite(Number(value))) return 'N/A';
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
        notation: 'compact',
        compactDisplay: 'short'
    }).format(parseFloat(value));
};

const formatScore = (value) => {
    if (!Number.isFinite(Number(value))) return 'N/A';
    return parseFloat(value).toFixed(1);
};

const createStatElement = (stat, isFirst) => {
    const div = document.createElement('div');
    div.className = isFirst ? 'stats first-child' : 'stats';
    div.dataset.metric = stat.key;

    const link = document.createElement('a');
    link.href = stat.link;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.textContent = stat.label;

    const span = document.createElement('span');
    span.textContent = stat.value;
    if (stat.unavailable) {
        span.classList.add('unavailable');
        span.title = 'No free public API currently provides this metric';
    }

    div.appendChild(link);
    div.appendChild(document.createTextNode(': '));
    div.appendChild(span);

    if (!isFirst && !stat.unavailable) {
        const pinButton = document.createElement('button');
        pinButton.className = 'pin-button';
        pinButton.title = 'set as badge';
        pinButton.textContent = '🔝';
        pinButton.style.display = 'none';

        div.appendChild(pinButton);

        div.addEventListener('mouseenter', () => { pinButton.style.display = 'block'; });
        div.addEventListener('mouseleave', () => { pinButton.style.display = 'none'; });
        pinButton.addEventListener('click', () => updateBadgeMetric(stat.key));
    }

    return div;
};

const displayStats = data => {
    const statsDiv = document.getElementById('stats');
    if (!statsDiv || !data) return;

    const mvrvUnavailable = !Number.isFinite(Number(data.current_mvrvzscore));
    const piUnavailable = !Number.isFinite(Number(data.current_pimultiple));

    const statsOrder = [
        {
            key: 'btc_price',
            label: 'BTC Price',
            link: CONFIG.METRIC_LINKS.btc_price,
            value: formatPrice(data.btc_price),
            unavailable: !Number.isFinite(Number(data.btc_price))
        },
        {
            key: 'mvrvzscore',
            label: 'MVRV Z-Score',
            link: CONFIG.METRIC_LINKS.mvrvzscore,
            value: formatScore(data.current_mvrvzscore),
            unavailable: mvrvUnavailable
        },
        {
            key: 'pimultiple',
            label: 'PI Multiple',
            link: CONFIG.METRIC_LINKS.pimultiple,
            value: formatScore(data.current_pimultiple),
            unavailable: piUnavailable
        }
    ];

    chrome.storage.sync.get('badgeMetric', (storage) => {
        if (chrome.runtime.lastError) {
            console.warn('storage.sync.get failed:', chrome.runtime.lastError.message);
        }

        let currentMetric = storage?.badgeMetric || CONFIG.DEFAULT_BADGE_METRIC;
        // If pinned metric is unavailable, fall back to price for ordering.
        const pinned = statsOrder.find(stat => stat.key === currentMetric);
        if (!pinned || pinned.unavailable) {
            currentMetric = 'btc_price';
        }

        const selectedStatIndex = statsOrder.findIndex(stat => stat.key === currentMetric);
        if (selectedStatIndex > 0) {
            const selectedStat = statsOrder.splice(selectedStatIndex, 1)[0];
            statsOrder.unshift(selectedStat);
        }

        const fragment = document.createDocumentFragment();
        statsOrder.forEach((stat, index) => {
            fragment.appendChild(createStatElement(stat, index === 0));
        });

        if (mvrvUnavailable || piUnavailable) {
            const note = document.createElement('p');
            note.className = 'metrics-note';
            note.textContent = 'MVRV / Pi unavailable: former bitcoinition.com API is gone; no free public replacement yet. Price still updates.';
            fragment.appendChild(note);
        }

        if (data.price_source) {
            const source = document.createElement('p');
            source.className = 'metrics-note source';
            source.textContent = `Price source: ${data.price_source}`;
            fragment.appendChild(source);
        }

        statsDiv.innerHTML = '';
        statsDiv.appendChild(fragment);
    });
};

const updateBadgeMetric = (metric) => {
    chrome.storage.sync.set({ badgeMetric: metric }, () => {
        if (chrome.runtime.lastError) {
            console.warn('Failed to save badgeMetric:', chrome.runtime.lastError.message);
        }
        chrome.runtime.sendMessage({ action: 'updateBadgeMetric', metric }, () => {
            if (chrome.runtime.lastError) {
                console.warn('updateBadgeMetric message failed:', chrome.runtime.lastError.message);
            }
            fetchBitcoinStats();
        });
    });
};
