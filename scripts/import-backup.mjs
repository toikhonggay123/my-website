import './tool-env.mjs';
import fs from 'node:fs';
import {spawn} from 'node:child_process';
import {restoreBackup,tableHash,tableOrder} from './backup-format.mjs';
import {decryptStudentToken} from '../lib/qr.mjs';
const [input,sqlPath]=process.argv.slice(2);
if(!input||!sqlPath)throw Error('Pass private backup JSON and its generated restore SQL');
const backup=JSON.parse(fs.readFileSync(input,'utf8')),restored=restoreBackup(backup);
if(fs.readFileSync(sqlPath,'utf8')!==restored.sql)throw Error('Restore SQL does not match the validated backup');
for(const row of backup.tables.student_qr.rows){
  const data=await decryptStudentToken(process.env,row.token);
  if(data.id!==row.student_id||data.s!==row.space)throw Error('Original QR key does not match the cards');
}
const config=JSON.parse(fs.readFileSync('wrangler.jsonc','utf8'));
const database=config.d1_databases.find(d=>d.binding==='DB').database_id;
if(!database||database.startsWith('00000000-'))throw Error('Configure the new production database first');
const account=process.env.CLOUDFLARE_ACCOUNT_ID,token=process.env.CLOUDFLARE_API_TOKEN;
if(!/^[a-f0-9]{32}$/i.test(account||'')||!token)throw Error('Cloudflare account ID and API token are required');
async function query(sql){
  const response=await fetch('https://api.cloudflare.com/client/v4/accounts/'+account+'/d1/database/'+database+'/query',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({sql}),signal:AbortSignal.timeout(60000)});
  const payload=await response.json();
  if(!response.ok||!payload.success||payload.result?.some(r=>!r.success))throw Error('Cloudflare D1 query failed; no import retry was attempted');
  return payload.result[0].results;
}
const existing=await query("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%'");
if(existing.length)throw Error('Refusing to import: destination has existing tables. Use a new empty database; no overwrite option is provided.');
console.log('Validated original QR key and empty destination. Importing into the new D1 database.');
await new Promise((resolve,reject)=>{
  const child=spawn(process.execPath,['scripts/cli.mjs','wrangler','d1','execute','DB','--remote','--file',sqlPath,'--yes'],{stdio:'inherit'});
  child.once('error',reject);child.once('exit',code=>code===0?resolve():reject(Error('Import failed. Do not retry into a partially initialized target; inspect it first.')));
});
for(const table of tableOrder){
  const rows=await query('SELECT * FROM "'+table+'"');
  if(rows.length!==restored.counts[table]||tableHash(rows)!==restored.hashes[table])throw Error('Imported data verification failed for '+table+'; keep the old system active');
}
if((await query('PRAGMA foreign_key_check')).length)throw Error('Foreign key verification failed');
console.log(JSON.stringify({importVerified:true,counts:restored.counts,oldSystemModified:false}));
