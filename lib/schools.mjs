// School registry shared by every AFYLLX Edu product entrance (owner decision 12/11/2026).
// Phase 1 is a click-through picker only: no sign-in, no data split. Every school here still
// uses the current CheckIn database; a second school needs its own D1 and QR key first (phase 2).
// ClassHub keeps a copy of the slugs in classhub/src/web/school-choice.ts (a test keeps them equal).

/** @typedef {{slug:string,shortName:string,fullName:string,products:string[]}} School */

/** @type {readonly School[]} */
export const SCHOOLS=Object.freeze([
  Object.freeze({
    slug:'na-ri',
    shortName:'Trường PTDTNT Na Rì',
    fullName:'Trường Phổ thông Dân tộc Nội trú Xã Na Rì',
    products:Object.freeze(['checkin','classhub']),
  }),
]);
export const DEFAULT_SCHOOL=SCHOOLS[0];
export const SCHOOL_COOKIE='afyllx_truong';
export const SCHOOL_STORAGE_KEY='afyllx:truong';
export const SCHOOL_PARAM='truong';
export const PICKER_PATH='/mealcheck/chon-truong';
const DEFAULT_NEXT='/mealcheck';
// Only these same-origin entrances may be the destination after picking a school.
const NEXT_PREFIXES=['/mealcheck','/quan-tri','/classhub'];
const LOOPBACK=new Set(['localhost','127.0.0.1','[::1]','::1']);

export function findSchool(slug){
  return typeof slug==='string'?SCHOOLS.find(school=>school.slug===slug)??null:null;
}

// The local app serves one school and must keep working offline, so it never asks.
export function pickerApplies(hostname){
  return !LOOPBACK.has(String(hostname||'').toLowerCase());
}

/** Accept only a relative path into a known product; anything else falls back to CheckIn. */
export function safeNext(next){
  if(typeof next!=='string'||!next.startsWith('/')||next.startsWith('//')||next.includes('\\'))return DEFAULT_NEXT;
  let url;
  try{url=new URL(next,'https://edu.afyllx.com');}catch{return DEFAULT_NEXT;}
  if(url.origin!=='https://edu.afyllx.com')return DEFAULT_NEXT;
  const path=url.pathname;
  if(path===PICKER_PATH||!NEXT_PREFIXES.some(prefix=>path===prefix||path.startsWith(prefix+'/')))return DEFAULT_NEXT;
  return path+url.search+url.hash;
}

export function productForNext(next){
  return safeNext(next).startsWith('/classhub')?'ClassHub':'CheckIn';
}

export function pickerHref(next){
  return PICKER_PATH+'?tiep='+encodeURIComponent(safeNext(next));
}

/** Read a cookie value from a document.cookie string. */
export function readCookie(cookieText,name=SCHOOL_COOKIE){
  for(const part of String(cookieText||'').split(';')){
    const [key,...rest]=part.trim().split('=');
    if(key===name){try{return decodeURIComponent(rest.join('='));}catch{return null;}}
  }
  return null;
}

export function schoolCookie(slug,secure){
  return `${SCHOOL_COOKIE}=${encodeURIComponent(slug)}; Path=/; Max-Age=31536000; SameSite=Lax${secure?'; Secure':''}`;
}

/**
 * Decide what a product entrance does before rendering.
 * enter: show the product (save the school when `save` is set); choose: open the picker.
 * Scanners, installed apps and offline pages never wait for a choice: they keep the default school,
 * so attendance scanning cannot be blocked by this screen.
 */
export function decideEntry({hostname,stored,param,scanner=false,standalone=false,online=true}){
  if(!pickerApplies(hostname))return {action:'enter',school:DEFAULT_SCHOOL,save:false};
  const fromLink=findSchool(param);
  if(fromLink)return {action:'enter',school:fromLink,save:true};
  const remembered=findSchool(stored);
  if(remembered)return {action:'enter',school:remembered,save:false};
  if(scanner||standalone||!online)return {action:'enter',school:DEFAULT_SCHOOL,save:true};
  return {action:'choose'};
}
