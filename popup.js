document.addEventListener('DOMContentLoaded', () => {
  fetchBitcoinStats();
  loadBadgeMetric();
  document.getElementById('badgeMetric').addEventListener('change', updateBadgeMetric);
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

  statsDiv.innerHTML = `
    <div class="stats">BTC Price: <span>${btcPrice}</span></div>
    <div class="stats">MVRV Z-Score: <span>${mvrvZScore}</span></div>
    <div class="stats">PI Multiple: <span>${piMultiple}</span></div>
  `;
};

const loadBadgeMetric = () => {
  chrome.storage.sync.get('badgeMetric', (data) => {
    if (data.badgeMetric) {
      document.getElementById('badgeMetric').value = data.badgeMetric;
    }
  });
};

const updateBadgeMetric = () => {
  const metric = document.getElementById('badgeMetric').value;
  chrome.storage.sync.set({badgeMetric: metric}, () => {
    chrome.runtime.sendMessage({action: "updateBadgeMetric", metric: metric});
  });
};