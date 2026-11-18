import {handleOrder, orderPath} from './order.mjs';

// Worker chỉ chạy cho /api/* (xem run_worker_first trong wrangler.jsonc); trang và bản mẫu do assets phục vụ.
export default {
 async fetch(request, env) {
  const path = new URL(request.url).pathname.replace(/\/+$/, '');
  if (path === orderPath) return handleOrder(request, env);
  if (path.startsWith('/api/')) return Response.json({ok: false}, {status: 404, headers: {'Cache-Control': 'no-store'}});
  return env.ASSETS.fetch(request);
 },
};
