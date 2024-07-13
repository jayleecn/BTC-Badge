document.addEventListener('DOMContentLoaded', () => {
  loadBadgeMetric();
  fetchBitcoinStats();
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

  const currentMetric = document.getElementById('badgeMetric').value;

  let statsHtml = '';
  const statsOrder = [
    { key: 'mvrvzscore', label: 'MVRV Z-Score', value: mvrvZScore },
    { key: 'pimultiple', label: 'PI Multiple', value: piMultiple },
    { key: 'btc_price', label: 'BTC Price', value: btcPrice }
  ];

  // 将当前选中的指标移到数组的第一位
  const selectedStatIndex = statsOrder.findIndex(stat => stat.key === currentMetric);
  if (selectedStatIndex !== -1) {
    const selectedStat = statsOrder.splice(selectedStatIndex, 1)[0];
    statsOrder.unshift(selectedStat);
  }

  statsOrder.forEach((stat, index) => {
    const className = index === 0 ? 'stats first-child' : 'stats';
    statsHtml += `<div class="${className}">${stat.label}: <span>${stat.value}</span></div>`;
  });

  statsDiv.innerHTML = statsHtml;
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
    fetchBitcoinStats(); // 重新获取并显示数据，以更新顺序
  });
};