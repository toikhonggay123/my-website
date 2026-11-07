import {contactPath,handleContact} from './contact.mjs';

const appPages=new Set(['/mealcheck','/quan-tri','/cai-dat','/diem-danh','/xuat-excel']);
const appFiles=new Set(['/sw.js','/manifest.webmanifest','/precache.json','/offline.html','/install-qr.svg','/brand/edtech-mark.png']);
// Path prefixes served by their own Workers. The prefix is removed before forwarding, as for ClassHub.
const services=[['/classhub','CLASSHUB','ClassHub'],['/tai-khoan','ACCOUNTS','AFYLLX Account']];
export function isMealCheckPath(path){
 const normalized=path.replace(/\/+$/,'')||'/';
 if(normalized===contactPath)return false;
 return appPages.has(normalized)||path.startsWith('/mealcheck/')||path==='/api'||path.startsWith('/api/')||path.startsWith('/_next/')||path.startsWith('/icons/')||appFiles.has(path);
}
// AFYLLX Account has its own domain. On edu.afyllx.com only its API stays under /tai-khoan/api (same-origin reads by the
// portal and MealCheck); its pages move to account.afyllx.com. Browsers keep the #code of older one-time links across
// the redirect.
// Not exported: a Worker module may only export handlers and functions.
const accountOrigin='https://account.afyllx.com';
function accountPageRedirect(request,url){
 if(url.hostname!=='edu.afyllx.com'||!['GET','HEAD'].includes(request.method))return null;
 if(url.pathname!=='/tai-khoan'&&!url.pathname.startsWith('/tai-khoan/'))return null;
 const rest=url.pathname.slice('/tai-khoan'.length)||'/';
 if(rest==='/api'||rest.startsWith('/api/'))return null;
 return new Response(null,{status:302,headers:{Location:accountOrigin+rest+url.search,'Cache-Control':'no-store'}});
}
export default {
 async fetch(request,env){
  const url=new URL(request.url);
  const moved=accountPageRedirect(request,url);
  if(moved)return moved;
  for(const [prefix,binding,name] of services){
   if(url.pathname!==prefix&&!url.pathname.startsWith(prefix+'/'))continue;
   url.pathname=url.pathname.slice(prefix.length)||'/';
   try{if(!env[binding])throw Error('Missing binding');return await env[binding].fetch(new Request(url,request));}
   catch{return Response.json({error:name+' tạm thời chưa kết nối được. Vui lòng thử lại.'},{status:503,headers:{'Cache-Control':'no-store'}});}
  }
  if(url.pathname.replace(/\/+$/,'')===contactPath)return handleContact(request,env);
  if(isMealCheckPath(url.pathname)){
   try{if(!env.MEALCHECK)throw Error('Missing binding');return await env.MEALCHECK.fetch(request);}
   catch{return Response.json({error:'MealCheck tạm thời chưa kết nối được. Vui lòng thử lại.'},{status:503,headers:{'Cache-Control':'no-store'}});}
  }
  return env.ASSETS.fetch(request);
 }
};
