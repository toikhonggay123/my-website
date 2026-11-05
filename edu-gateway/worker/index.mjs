import {contactPath,handleContact} from './contact.mjs';

const appPages=new Set(['/mealcheck','/quan-tri','/cai-dat','/diem-danh','/xuat-excel']);
const appFiles=new Set(['/sw.js','/manifest.webmanifest','/precache.json','/offline.html','/install-qr.svg','/brand/edtech-mark.png']);
const classHubPrefix='/classhub';
export function isMealCheckPath(path){
 const normalized=path.replace(/\/+$/,'')||'/';
 if(normalized===contactPath)return false;
 return appPages.has(normalized)||path.startsWith('/mealcheck/')||path==='/api'||path.startsWith('/api/')||path.startsWith('/_next/')||path.startsWith('/icons/')||appFiles.has(path);
}
export default {
 async fetch(request,env){
  const url=new URL(request.url);
  if(url.pathname===classHubPrefix||url.pathname.startsWith(classHubPrefix+'/')){
   url.pathname=url.pathname.slice(classHubPrefix.length)||'/';
   try{return await env.CLASSHUB.fetch(new Request(url,request));}
   catch{return Response.json({error:'ClassHub tạm thời chưa kết nối được. Vui lòng thử lại.'},{status:503,headers:{'Cache-Control':'no-store'}});}
  }
  if(url.pathname.replace(/\/+$/,'')===contactPath)return handleContact(request,env);
  if(isMealCheckPath(url.pathname)){
   try{if(!env.MEALCHECK)throw Error('Missing binding');return await env.MEALCHECK.fetch(request);}
   catch{return Response.json({error:'MealCheck tạm thời chưa kết nối được. Vui lòng thử lại.'},{status:503,headers:{'Cache-Control':'no-store'}});}
  }
  return env.ASSETS.fetch(request);
 }
};
