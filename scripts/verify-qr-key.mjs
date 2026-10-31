import fs from 'node:fs';
import {decryptStudentToken} from '../lib/qr.mjs';
const input=process.argv[2];if(!input)throw Error('Pass a private backup JSON path');
const backup=JSON.parse(fs.readFileSync(input,'utf8'));
let count=0;
for(const row of backup.tables.student_qr.rows){
  const data=await decryptStudentToken(process.env,row.token);
  if(data.id!==row.student_id||data.s!==row.space)throw Error('QR key verification failed');
  count++;
}
if(!count)throw Error('No issued QR cards to validate the original key against');
console.log(JSON.stringify({verifiedCards:count,keyPrinted:false}));
