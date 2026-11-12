import type { Metadata } from 'next';
import App from '../mealcheck-client';
import {SchoolGate} from '../school-gate';
export const dynamic='force-dynamic';
export const metadata: Metadata={title:'Quản trị · AFYLLX Edu CheckIn'};
export default function Page(){return <SchoolGate><App/></SchoolGate>;}
