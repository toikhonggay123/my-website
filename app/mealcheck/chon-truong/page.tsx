import type {Metadata} from 'next';
import {SchoolPicker} from '../../school-picker';

export const dynamic='force-dynamic';
export const metadata:Metadata={title:'Chọn trường · AFYLLX Edu'};
export default function Page(){return <SchoolPicker/>;}
