document.addEventListener('DOMContentLoaded', () => {
  loadBadgeMetric();
  fetchBitcoinStats();
});

const fetchBitcoinStats = () => {
  chrome.runtime.sendMessage({action: "fetchBitcoinStats"}, response => {
    if (response.success) {
      displayStats(response.data.data);
    } else {
      console.error('Error:', response.error);
      document.getElementById('stats').textContent = 'Failed to retrieve data, please try again later.';
    }
  });
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
    { key: 'btc_price', label: 'BTC Price', value: btcPrice },
    { key: 'mvrvzscore', label: 'MVRV Z-Score', value: mvrvZScore },
    { key: 'pimultiple', label: 'PI Multiple', value: piMultiple }
  ];

  chrome.storage.sync.get('badgeMetric', (data) => {
    const currentMetric = data.badgeMetric || 'mvrvzscore';
    
    const selectedStatIndex = statsOrder.findIndex(stat => stat.key === currentMetric);
    if (selectedStatIndex !== -1) {
      const selectedStat = statsOrder.splice(selectedStatIndex, 1)[0];
      statsOrder.unshift(selectedStat);
    }

    let statsHtml = '';
    statsOrder.forEach((stat, index) => {
      const className = index === 0 ? 'stats first-child' : 'stats';
      const pinButton = index === 0 ? '' : '<button class="pin-button" title="置顶显示">🔝</button>';
      statsHtml += `
        <div class="${className}" data-metric="${stat.key}">
          ${stat.label}: <span>${stat.value}</span>
          ${pinButton}
        </div>
      `;
    });

    statsDiv.innerHTML = statsHtml;

    document.querySelectorAll('.stats:not(.first-child)').forEach(statDiv => {
      const button = statDiv.querySelector('.pin-button');
      button.style.display = 'none';

      statDiv.addEventListener('mouseenter', () => {
        button.style.display = 'block';
      });

      statDiv.addEventListener('mouseleave', () => {
        button.style.display = 'none';
      });

      button.addEventListener('click', () => {
        const metric = statDiv.dataset.metric;
        updateBadgeMetric(metric);
      });
    });
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