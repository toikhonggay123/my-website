import {InstallApp} from '../pwa';
import {Brand} from '../brand';
export default function InstallPage(){return <main className="install-page"><div className="install-intro"><Brand/><h1>Cài đặt EdTech MealCheck</h1><p>Phần mềm quản lý suất ăn học đường.</p></div><InstallApp expanded/><a className="primary" href="/quan-tri">Mở EdTech MealCheck</a></main>;}
