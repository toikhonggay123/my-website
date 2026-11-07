// Application-layer flood shield for the public Worker.
// Cloudflare already absorbs network/volumetric DDoS at its edge; this layer caps
// per-client request rates before any D1 query runs, so a single source (or a
// botnet hitting row-creating routes) cannot exhaust the database or Worker quota.
// Limits use Workers Rate Limiting bindings declared in wrangler.cloud.jsonc.
// Missing bindings (local loopback app, QA) mean the shield is a no-op, and a
// limiter failure lets the request through: availability beats strictness.

export const SHIELD_BUCKETS={
  page:{binding:'RL_PAGE',period:10},
  read:{binding:'RL_READ',period:10},
  write:{binding:'RL_WRITE',period:10},
  heavy:{binding:'RL_HEAVY',period:60},
  enroll:{binding:'RL_ENROLL',period:60},
};
export const ENROLL_GLOBAL_BINDING='RL_ENROLL_GLOBAL';
export const MAX_URL_LENGTH=4096;
const API_METHODS=new Set(['GET','HEAD','POST','OPTIONS']);

// Routes that build large result sets, files or card images.
const HEAVY=new Set(['export','export/today','daily','daily/today','audit','qr/cards','qr/cards/issued','attendance/reset-preview','attendance/reset-backups','devices']);
// Routes that may insert a new device row for a caller without a cookie.
const ENROLL=new Set(['device/start','qr/scanner/start']);

export function classifyRequest(url,method){
  if(!url.pathname.startsWith('/api/'))return 'page';
  const route=url.pathname.slice(5).replace(/\/+$/,'');
  if(ENROLL.has(route))return 'enroll';
  if(HEAVY.has(route))return 'heavy';
  return method==='POST'?'write':'read';
}

// Group IPv6 clients by /64: one host usually controls a whole /64 and can rotate
// addresses inside it freely. IPv4 stays per address.
export function clientKey(raw){
  const ip=String(raw||'').trim().toLowerCase();
  if(!ip)return 'unknown';
  if(!ip.includes(':'))return /^\d{1,3}(?:\.\d{1,3}){3}$/.test(ip)?ip:'raw:'+ip.slice(0,64);
  const mapped=ip.match(/^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/);if(mapped)return mapped[1];
  const parts=ip.split('::');
  if(parts.length>2)return 'raw:'+ip.slice(0,64);
  const head=parts[0]?parts[0].split(':'):[],tail=parts.length===2&&parts[1]?parts[1].split(':'):[];
  const groups=parts.length===2?[...head,...Array(Math.max(0,8-head.length-tail.length)).fill('0'),...tail]:head;
  if(groups.length!==8||!groups.every(g=>/^[0-9a-f]{1,4}$/.test(g)))return 'raw:'+ip.slice(0,64);
  return groups.slice(0,4).map(g=>parseInt(g,16).toString(16)).join(':')+'::/64';
}

function blocked(kind,status,message,retryAfter){
  const headers={'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};
  if(retryAfter)headers['Retry-After']=String(retryAfter);
  if(kind==='page')return new Response(message,{status,headers:{...headers,'Content-Type':'text/plain; charset=utf-8'}});
  return Response.json({error:message},{status,headers});
}

async function allowed(limiter,key){
  if(!limiter||typeof limiter.limit!=='function')return true;
  try{return (await limiter.limit({key}))?.success!==false;}catch{return true;}
}

// Returns a Response to send instead of the app, or null to continue.
export async function shield(request,env={}){
  const url=new URL(request.url),kind=classifyRequest(url,request.method);
  if(request.url.length>MAX_URL_LENGTH)return blocked(kind,414,'Địa chỉ yêu cầu quá dài.');
  if(kind!=='page'&&!API_METHODS.has(request.method))return blocked(kind,405,'Phương thức không được hỗ trợ.');
  const bucket=SHIELD_BUCKETS[kind],client=clientKey(request.headers.get('cf-connecting-ip'));
  if(!await allowed(env[bucket.binding],kind+':'+client))
    return blocked(kind,429,'Quá nhiều yêu cầu từ mạng này. Vui lòng thử lại sau ít giây.',bucket.period);
  // A distributed flood on one enrollment route must not lock out the other.
  if(kind==='enroll'&&!await allowed(env[ENROLL_GLOBAL_BINDING],'enroll-global:'+url.pathname.slice(5).replace(/\/+$/,'')))
    return blocked(kind,503,'Máy chủ đang bận đăng ký thiết bị. Vui lòng thử lại sau ít phút.',60);
  return null;
}
