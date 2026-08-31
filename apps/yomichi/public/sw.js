/**
 * オフラインで開くための Service Worker。
 *
 * プレースホルダはビルド後に vite.config.ts のプラグインが実ファイル一覧へ
 * 置き換える。dev サーバでは登録しないので、置換前のこのファイルは動かない。
 *
 * 更新は自動で適用しない。読んでいる途中に画面が入れ替わると
 * 取りこぼしうる。新しい版が来たことだけ知らせて、押されるまで待つ。
 */

const VERSION = "__VERSION__";
const BASE = "__BASE__";
const PRECACHE = "__PRECACHE__";

const CACHE = `yomichi-${VERSION}`;
const FILES = Array.isArray(PRECACHE) ? PRECACHE : [];
const SHELL = `${BASE}index.html`;

/**
 * プリキャッシュは必ずネットワークから取る。
 *
 * `cache.addAll` はブラウザの HTTP キャッシュを使うので、GitHub Pages の
 * max-age が効いて**古い index.html** が保存されうる。その index.html が指す
 * ハッシュ付きファイルは新しいデプロイで消えているため、更新を適用した瞬間に
 * 白い画面になる。版ごとに変わる問い合わせを付けて取り、cache には問い合わせ
 * 無しの URL で収める。1 つでも取れなければ install を失敗させる。
 */
async function precache(cache) {
  const urls = [...new Set([...FILES, SHELL, BASE])];
  await Promise.all(
    urls.map(async (url) => {
      const fresh = `${url}${url.includes('?') ? '&' : '?'}v=${VERSION}`;
      const response = await fetch(fresh, { cache: 'reload' });
      if (!response.ok) throw new Error(`${url} を取得できない (${response.status})`);
      await cache.put(url, response);
    }),
  );
}

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then(precache));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(names.filter((n) => n.startsWith('yomichi-') && n !== CACHE).map((n) => caches.delete(n)));
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'skip-waiting') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  if (new URL(request.url).origin !== self.location.origin) return;

  // 画面遷移はどのパスでもアプリ本体を返す。
  if (request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        const cached = await caches.match(SHELL);
        if (cached) return cached;
        try {
          return await fetch(request);
        } catch {
          return new Response('オフラインで、まだアプリを保存できていない', {
            status: 503,
            headers: { 'Content-Type': 'text/plain; charset=utf-8' },
          });
        }
      })(),
    );
    return;
  }

  /*
   * 住人の書き込みだけは、まずネットワークへ取りに行く。
   *
   * ここはアプリの本体と違って**毎回変わる**もので、キャッシュを優先すると
   * 版を切り替えるまで流れが止まって見える。取れなければキャッシュに落ちるので、
   * 圏外でも最後に見た状態は開く。
   */
  if (new URL(request.url).pathname.endsWith('/feed.json')) {
    event.respondWith(
      (async () => {
        try {
          const response = await fetch(request, { cache: 'no-store' });
          if (response.ok) {
            const cache = await caches.open(CACHE);
            cache.put(request, response.clone());
          }
          return response;
        } catch {
          const cached = await caches.match(request);
          if (cached) return cached;
          throw new Error('feed.json を取得できない');
        }
      })(),
    );
    return;
  }

  event.respondWith(
    (async () => {
      const cached = await caches.match(request);
      if (cached) return cached;
      const response = await fetch(request);
      // ハッシュ付きでない資産（アイコンなど）を後から拾う
      if (response.ok && response.type === 'basic') {
        const cache = await caches.open(CACHE);
        cache.put(request, response.clone());
      }
      return response;
    })(),
  );
});
