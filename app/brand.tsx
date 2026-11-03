import {Mail} from 'lucide-react';
import {COMPANY_NAME,SUITE_NAME,PRODUCT_NAME,SUPPORT_EMAIL} from '@/lib/branding.mjs';

export function Brand(){
 return <div className="brand" aria-label={COMPANY_NAME+' · '+PRODUCT_NAME}>
  <img className="brandmark" src="/brand/afyllx-logo.png" width="42" height="42" alt=""/>
  <div className="brand-copy"><span className="brand-company">{COMPANY_NAME}</span><b>{PRODUCT_NAME}</b></div>
 </div>;
}

export function BrandSupport(){
 return <footer className="brand-support" aria-label="Thông tin phần mềm và hỗ trợ">
  <b className="support-company">{COMPANY_NAME}</b>
  <span className="support-product">{SUITE_NAME} <span aria-hidden="true">/</span> MealCheck</span>
  <span className="support-label">Email hỗ trợ</span>
  <a href={'mailto:'+SUPPORT_EMAIL}><Mail size={14} aria-hidden="true"/><strong>{SUPPORT_EMAIL}</strong></a>
 </footer>;
}
