// Baseline browser protections for every response the Worker returns: app pages,
// API, shield rejections and afyllx.com brand pages. Headers already set by a
// handler win. Nothing legitimately frames MealCheck (the Edu portal links to it
// on the same origin), so the public admin and its reset buttons cannot be
// embedded by other sites. Static files served directly by the assets binding
// never reach the Worker; public/_headers covers them.
export const SECURITY_HEADERS={
  'X-Frame-Options':'SAMEORIGIN',
  'X-Content-Type-Options':'nosniff',
  'Referrer-Policy':'strict-origin-when-cross-origin',
};
export const FRAME_ANCESTORS="frame-ancestors 'self'";
export const HSTS='max-age=31536000; includeSubDomains';

export function withSecurityHeaders(response,request){
  // A WebSocket upgrade cannot be rebuilt; MealCheck does not use one.
  if(response.status===101||response.webSocket)return response;
  // Fetched, redirect and binding responses can have immutable headers. Rebuilding
  // keeps the streamed body, status and every Set-Cookie value.
  const secured=new Response(response.body,response),headers=secured.headers;
  for(const [name,value] of Object.entries(SECURITY_HEADERS))if(!headers.has(name))headers.set(name,value);
  if(!headers.has('Content-Security-Policy'))headers.set('Content-Security-Policy',FRAME_ANCESTORS);
  if(new URL(request.url).protocol==='https:'&&!headers.has('Strict-Transport-Security'))headers.set('Strict-Transport-Security',HSTS);
  return secured;
}
