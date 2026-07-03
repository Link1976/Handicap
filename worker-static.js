import html from './index.html';
import manifest from './manifest.webmanifest';
import icon192 from './icon-192.png';
import icon512 from './icon-512.png';

// Se embebe como string literal (no como import de módulo) para evitar que el
// bundler/validador de Cloudflare intente tratarlo como código ejecutable del worker.
const SW_SOURCE = `// Cache-first para el shell de la app: permite abrirla sin conexion en el campo.
// Los datos (RFEG, buscador de campos) siguen yendo a la red; solo se cachea lo estatico.
var CACHE="handicap-shell-v15";
var SHELL=[
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./icon-192.png",
  "./icon-512.png",
  "https://cdnjs.cloudflare.com/ajax/libs/react/18.2.0/umd/react.production.min.js",
  "https://cdnjs.cloudflare.com/ajax/libs/react-dom/18.2.0/umd/react-dom.production.min.js",
  "https://cdnjs.cloudflare.com/ajax/libs/babel-standalone/7.23.9/babel.min.js"
];

self.addEventListener("install",function(e){
  e.waitUntil(caches.open(CACHE).then(function(c){return c.addAll(SHELL)}).then(function(){return self.skipWaiting()}));
});

self.addEventListener("activate",function(e){
  e.waitUntil(caches.keys().then(function(keys){
    return Promise.all(keys.filter(function(k){return k!==CACHE}).map(function(k){return caches.delete(k)}));
  }).then(function(){return self.clients.claim()}));
});

var SHELL_URLS=SHELL.map(function(u){return new URL(u,self.location).href});

self.addEventListener("fetch",function(e){
  if(e.request.method!=="GET")return;
  var isShellReq=SHELL_URLS.indexOf(e.request.url)>=0;
  if(!isShellReq)return; // deja pasar a la red todo lo demas (worker RFEG, pdf.js on-demand, etc.)
  e.respondWith(
    caches.match(e.request).then(function(cached){
      var network=fetch(e.request).then(function(res){
        if(res&&res.ok)caches.open(CACHE).then(function(c){c.put(e.request,res.clone())});
        return res;
      }).catch(function(){return cached});
      return cached||network;
    })
  );
});
`;

const ASSETS = {
  '/manifest.webmanifest': { body: manifest, type: 'application/manifest+json; charset=UTF-8' },
  '/sw.js': { body: SW_SOURCE, type: 'application/javascript; charset=UTF-8' },
  '/icon-192.png': { body: icon192, type: 'image/png' },
  '/icon-512.png': { body: icon512, type: 'image/png' },
};

export default {
  fetch(request) {
    const path = new URL(request.url).pathname;
    const asset = ASSETS[path];
    if (asset) return new Response(asset.body, { headers: { 'Content-Type': asset.type } });
    return new Response(html, { headers: { 'Content-Type': 'text/html; charset=UTF-8' } });
  }
}
