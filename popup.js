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

    chrome.runtime.sendMessage({ action: 'fetchBitcoinStats' }, (response) => {
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

/** Reject null/undefined/'' — Number(null)===0 must not look available. Never show "NaN". */
const isDisplayableNumber = (value) =>
    value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value));

const formatPrice = (value) => {
    if (!isDisplayableNumber(value)) return 'N/A';
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
        notation: 'compact',
        compactDisplay: 'short'
    }).format(Number(value));
};

const formatScore = (value) => {
    if (!isDisplayableNumber(value)) return 'N/A';
    return Number(value).toFixed(1);
};

const isMetricUnavailable = (value, statusFlag) => {
    if (statusFlag === 'unavailable') return true;
    return !isDisplayableNumber(value);
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
        span.title = 'Metric temporarily unavailable';
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

const displayStats = (data) => {
    const statsDiv = document.getElementById('stats');
    if (!statsDiv || !data) return;

    const mvrvUnavailable = isMetricUnavailable(
        data.current_mvrvzscore,
        data.metrics_status?.mvrvzscore
    );
    const piUnavailable = isMetricUnavailable(
        data.current_pimultiple,
        data.metrics_status?.pimultiple
    );

    const statsOrder = [
        {
            key: 'btc_price',
            label: 'BTC Price',
            link: CONFIG.METRIC_LINKS.btc_price,
            value: formatPrice(data.btc_price),
            unavailable: isMetricUnavailable(
                data.btc_price,
                data.metrics_status?.btc_price
            )
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
        const pinned = statsOrder.find((stat) => stat.key === currentMetric);
        if (!pinned || pinned.unavailable) {
            currentMetric = 'btc_price';
        }

        const selectedStatIndex = statsOrder.findIndex((stat) => stat.key === currentMetric);
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
            const missing = [
                mvrvUnavailable ? 'MVRV' : null,
                piUnavailable ? 'Pi' : null
            ].filter(Boolean).join(' / ');
            note.textContent = `${missing} temporarily unavailable (network or rate limit). Cached values are kept when possible.`;
            fragment.appendChild(note);
        } else if (data.mvrv_delayed) {
            const note = document.createElement('p');
            note.className = 'metrics-note';
            const asOf = data.mvrv_date ? ` (as of ${data.mvrv_date})` : '';
            note.textContent = `MVRV Z-score from free bitcoin-data.com tier may be delayed up to ~7 days${asOf}.`;
            fragment.appendChild(note);
        }

        const sources = [];
        if (data.price_source) sources.push(`price: ${data.price_source}`);
        if (data.mvrv_source) sources.push(`mvrv: ${data.mvrv_source}`);
        if (data.pi_source) sources.push(`pi: ${data.pi_source}`);
        if (sources.length) {
            const source = document.createElement('p');
            source.className = 'metrics-note source';
            source.textContent = `Sources — ${sources.join(' · ')}`;
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
