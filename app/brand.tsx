import {Mail} from 'lucide-react';
import {BRAND_MARK,BRAND_TOP,BRAND_BOTTOM,PRODUCT_NAME,SUPPORT_EMAIL} from '@/lib/branding.mjs';

export function Brand({className=''}:{className?:string}={}){
 return <div className={'brand '+className} aria-label={PRODUCT_NAME}>
  <img className="brandmark" src={BRAND_MARK} width="42" height="42" alt=""/>
  <div className="brand-copy"><strong>{BRAND_TOP}</strong><span>{BRAND_BOTTOM}</span></div>
 </div>;
}

export function BrandSupport({onHomeClick}:{onHomeClick?:()=>void}={}){
 return <footer className="brand-support" aria-label="Thông tin phần mềm và hỗ trợ">
  {onHomeClick?<button type="button" className="brand-home" aria-label="Trở lại trang chủ AFYLLX Edu" onClick={onHomeClick}><Brand/></button>:<Brand/>}
  <span className="support-label">Email hỗ trợ</span>
  <a href={'mailto:'+SUPPORT_EMAIL}><Mail size={14} aria-hidden="true"/><strong>{SUPPORT_EMAIL}</strong></a>
 </footer>;
}
