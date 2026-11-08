import {InstallApp} from '../pwa';
import {Brand} from '../brand';
export default function InstallPage(){return <main className="install-page"><div className="install-intro"><Brand/><h1>Cài đặt AFYLLX Edu CheckIn</h1><p>Phần mềm điểm danh học sinh bằng thẻ QR.</p></div><InstallApp expanded/><a className="primary" href="/mealcheck">Mở AFYLLX Edu CheckIn</a></main>;}
