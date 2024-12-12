// 配置常量
export const CONFIG = {
    API_URL: 'https://bitcoinition.com/current.json',
    CACHE_DURATION: 5 * 60 * 1000, // 5分钟的缓存时间
    UPDATE_INTERVAL: 5, // 更新间隔（分钟）
    RETRY_ATTEMPTS: 3, // 重试次数
    RETRY_DELAY: 1000, // 重试延迟（毫秒）
    DEFAULT_BADGE_METRIC: 'mvrvzscore',
    BADGE_COLORS: {
        ERROR: '#FF0000',
        NORMAL: '#0000FF'
    }
};
