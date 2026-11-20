const build = '1.2.0';
const prefix = 'htongrad-02-shell-';
const cacheName = prefix + build;
const scope = self.registration.scope;
const index = new URL('index.html',scope);
const assets = [
  'app.js','model.js','writing.js','google-sync.js','style.css','manifest.webmanifest'
].map(path=>new URL(path+'?v='+build,scope).href);
assets.push(...['icon-192.png','icon-512.png'].map(path=>new URL(path,scope).href));

self.addEventListener('install',event=>{
  event.waitUntil((async()=>{
    const page = await fetch(index.href+'?v='+build,{cache:'reload'});
    if(!page.ok || !(await page.clone().text()).includes('<meta name="panel-build" content="'+build+'">')) {
      throw Error('Сборка ещё не опубликована.');
    }
    const cache = await caches.open(cacheName);
    await cache.addAll(assets.map(url=>new Request(url,{cache:'reload'})));
    await cache.put(index,page);
  })());
});

self.addEventListener('activate',event=>{
  event.waitUntil((async()=>{
    const keys = await caches.keys();
    await Promise.all(keys.filter(key=>key.startsWith(prefix)&&key!==cacheName).map(key=>caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch',event=>{
  const {request} = event;
  if(request.method!=='GET') return;
  const url = new URL(request.url);
  const isPage = request.mode==='navigate' && (url.origin+url.pathname===scope || url.origin+url.pathname===index.href);
  if(!isPage&&!assets.includes(url.href)) return;
  event.respondWith((async()=>{
    const cache = await caches.open(cacheName);
    return (await cache.match(isPage?index:request)) ?? fetch(request);
  })());
});
