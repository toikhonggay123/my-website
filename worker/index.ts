import handler from 'vinext/server/fetch-handler';
import { isBrandRequest } from '../lib/brand-routing.mjs';
export default {
 async fetch(request:Request,env:Cloudflare.Env,ctx:ExecutionContext){
  if(isBrandRequest(request)){
   if(!env.AFYLLX_WEB)return new Response('Website temporarily unavailable',{status:503,headers:{'Cache-Control':'no-store'}});
   return env.AFYLLX_WEB.fetch(request);
  }
  return handler.fetch(request,env,ctx);
 }
};
