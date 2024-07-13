let currentBadgeMetric = 'mvrvzscore';
let cachedData = null;

const fetchDataAndUpdateBadge = () => {
  fetch('https://bitcoinition.com/current.json')
    .then(response => response.json())
    .then(data => {
      updateBadge(data.data);
      // 缓存数据
      chrome.storage.local.set({ cachedData: data.data });
    })
    .catch(error => {
      console.error('Error fetching data:', error);
      chrome.action.setBadgeText({text: 'ERR'});
      chrome.action.setBadgeBackgroundColor({color: '#FF0000'});
      chrome.action.setBadgeTextColor({color: '#FFFFFF'});
    });
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
  chrome.action.setBadgeBackgroundColor({color: '#0000FF'});
  chrome.action.setBadgeTextColor({color: '#FFFFFF'});
};

// 初始化时，先尝试从缓存加载数据
chrome.storage.local.get('cachedData', (result) => {
  if (result.cachedData) {
    updateBadge(result.cachedData);
  }
  // 无论是否有缓存数据，都进行一次数据获取
  fetchDataAndUpdateBadge();
});

// 设置定期更新（每5分钟）
chrome.alarms.create('updateBadge', { periodInMinutes: 5 });

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
      fetch('https://bitcoinition.com/current.json')
        .then(response => response.json())
        .then(data => {
          cachedData = data.data;
          chrome.storage.local.set({ cachedData: data.data });
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