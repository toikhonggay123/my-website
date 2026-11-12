import type {Metadata} from 'next';
import App from '../mealcheck-client';
import {SchoolGate} from '../school-gate';
import {PRODUCT_NAME} from '@/lib/branding.mjs';

export const dynamic='force-dynamic';
export const metadata:Metadata={title:PRODUCT_NAME};
export default function Page(){return <SchoolGate><App/></SchoolGate>;}
