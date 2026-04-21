const CACHE_NAME = 'freshfin-v1';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './manifest.json',
  // 如果你还有其他图片或CSS，也可以加在这里
];

// 安装时缓存所有资源
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
});

// 离线拦截：没网时直接从缓存读取
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      // 如果缓存里有，直接给；没有就去联网找
      return response || fetch(event.request).catch(() => {
        // 如果联网找也失败了（彻底没网），如果是访问主页，就强制返回缓存的主页
        if (event.request.mode === 'navigate') {
          return caches.match('./');
        }
      });
    })
  );
});

// 激活时清理旧版本缓存
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});
