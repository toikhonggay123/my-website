import type { Metadata } from 'next';
import App from '../mealcheck-client';
export const dynamic='force-dynamic';
export const metadata: Metadata={title:'Quản trị · EdTech MealCheck'};
export default function Page(){return <App/>;}
