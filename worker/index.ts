import handler from 'vinext/server/fetch-handler';
import { isBrandRequest } from '../lib/brand-routing.mjs';
import { shield } from '../lib/shield.mjs';
import { withSecurityHeaders } from '../lib/security-headers.mjs';
async function route(request:Request,env:Cloudflare.Env,ctx:ExecutionContext):Promise<Response>{
  // Rate limits run before brand forwarding, page rendering or any D1 query.
  const rejected=await shield(request,env);
  if(rejected)return rejected;
  if(isBrandRequest(request)){
   if(!env.AFYLLX_WEB)return new Response('Website temporarily unavailable',{status:503,headers:{'Cache-Control':'no-store'}});
   return env.AFYLLX_WEB.fetch(request);
  }
  return handler.fetch(request,env,ctx);
}
export default {
 async fetch(request:Request,env:Cloudflare.Env,ctx:ExecutionContext){
  return withSecurityHeaders(await route(request,env,ctx),request);
 }
};
