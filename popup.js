import { CONFIG } from './config.js';

document.addEventListener('DOMContentLoaded', () => {
    loadBadgeMetric();
    fetchBitcoinStats();
});

const fetchBitcoinStats = () => {
    const statsDiv = document.getElementById('stats');
    statsDiv.textContent = 'Loading...';

    chrome.runtime.sendMessage({action: "fetchBitcoinStats"}, response => {
        if (response.success) {
            displayStats(response.data.data);
        } else {
            console.error('Error:', response.error);
            statsDiv.textContent = 'Failed to retrieve data. Retrying in 5 seconds...';
            setTimeout(fetchBitcoinStats, 5000);
        }
    });
};

const createStatElement = (stat, isFirst) => {
    const div = document.createElement('div');
    div.className = isFirst ? 'stats first-child' : 'stats';
    div.dataset.metric = stat.key;

    const link = document.createElement('a');
    link.href = stat.link;
    link.target = '_blank';
    link.textContent = stat.label;

    const span = document.createElement('span');
    span.textContent = stat.value;

    div.appendChild(link);
    div.appendChild(document.createTextNode(': '));
    div.appendChild(span);

    if (!isFirst) {
        const pinButton = document.createElement('button');
        pinButton.className = 'pin-button';
        pinButton.title = 'set as badge';
        pinButton.textContent = '🔝';
        pinButton.style.display = 'none';

        div.appendChild(pinButton);

        // 事件监听
        div.addEventListener('mouseenter', () => pinButton.style.display = 'block');
        div.addEventListener('mouseleave', () => pinButton.style.display = 'none');
        pinButton.addEventListener('click', () => updateBadgeMetric(stat.key));
    }

    return div;
};

const displayStats = data => {
    const statsDiv = document.getElementById('stats');
    
    const btcPrice = new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
        notation: 'compact',
        compactDisplay: 'short'
    }).format(parseFloat(data.btc_price));

    const mvrvZScore = parseFloat(data.current_mvrvzscore).toFixed(1);
    const piMultiple = parseFloat(data.current_pimultiple).toFixed(1);

    const statsOrder = [
        { key: 'btc_price', label: 'BTC Price', link:'https://coinmarketcap.com/currencies/bitcoin/', value: btcPrice },
        { key: 'mvrvzscore', label: 'MVRV Z-Score',link:'https://bitcoinition.com/charts/mvrv-z-score/',  value: mvrvZScore },
        { key: 'pimultiple', label: 'PI Multiple',link:'https://bitcoinition.com/charts/pimultiple/',  value: piMultiple }
    ];

    chrome.storage.sync.get('badgeMetric', (data) => {
        const currentMetric = data.badgeMetric || CONFIG.DEFAULT_BADGE_METRIC;
        
        const selectedStatIndex = statsOrder.findIndex(stat => stat.key === currentMetric);
        if (selectedStatIndex !== -1) {
            const selectedStat = statsOrder.splice(selectedStatIndex, 1)[0];
            statsOrder.unshift(selectedStat);
        }

        // 使用 DocumentFragment 优化 DOM 操作
        const fragment = document.createDocumentFragment();
        statsOrder.forEach((stat, index) => {
            fragment.appendChild(createStatElement(stat, index === 0));
        });

        statsDiv.innerHTML = '';
        statsDiv.appendChild(fragment);
    });
};

const updateBadgeMetric = (metric) => {
    chrome.storage.sync.set({badgeMetric: metric}, () => {
        chrome.runtime.sendMessage({action: "updateBadgeMetric", metric: metric});
        fetchBitcoinStats();
    });
};

const loadBadgeMetric = () => {
    chrome.storage.sync.get('badgeMetric', (data) => {
        if (data.badgeMetric) {
            fetchBitcoinStats();
        }
    });
};