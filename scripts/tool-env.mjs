import path from 'node:path';
const runtime = path.resolve('.tool-state');
for (const [key,value] of Object.entries({
  CLOUDFLARE_CF_FETCH_ENABLED:'false', WRANGLER_SEND_METRICS:'false',
  WRANGLER_WRITE_LOGS:'false', WRANGLER_LOG_PATH:path.join(runtime,'logs'),
  WRANGLER_REGISTRY_PATH:path.join(runtime,'dev-registry'),
  MINIFLARE_REGISTRY_PATH:path.join(runtime,'registry')
})) process.env[key] ??= value;
