const pages = new Set(['/', '/index', '/edu', '/digital', '/gov', '/ve-afyllx', '/lien-he', '/quyen-rieng-tu', '/404']);
const files = new Set(['/robots.txt', '/sitemap.xml']);
const assets = ['/afyllx-assets/', '/afyllx-brand/', '/afyllx-media/'];

/** Only the public brand surface on the apex domain uses the static website. */
export function isBrandRequest(request) {
  const url = new URL(request.url);
  if (url.hostname !== 'afyllx.com' || !['GET', 'HEAD'].includes(request.method)) return false;
  const path = url.pathname;
  if (files.has(path) || assets.some(prefix => path.startsWith(prefix))) return true;
  const page = path.replace(/\/$/, '').replace(/\.html$/, '') || '/';
  return pages.has(page);
}
