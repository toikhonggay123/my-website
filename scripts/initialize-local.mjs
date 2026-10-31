import './tool-env.mjs';
import fs from 'node:fs';
import path from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {createHash} from 'node:crypto';
import {spawn} from 'node:child_process';
import {restoreBackup,tableHash,tableOrder} from './backup-format.mjs';
const input=path.resolve(process.argv[2]||'../.migration-private/sites-d1-backup.json');
const state=path.resolve('.wrangler/local-state'),privateDir=path.resolve('.local-server');
function sqliteFiles(dir){if(!fs.existsSync(dir))return [];return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?sqliteFiles(path.join(dir,e.name)):e.name.endsWith('.sqlite')&&e.name!=='metadata.sqlite'?[path.join(dir,e.name)]:[]);}
const verifyOnly=process.argv.includes('--verify-only');
if(!verifyOnly&&(sqliteFiles(state).length||fs.existsSync(path.join(privateDir,'data-import.json'))))throw Error('Local database already exists; refusing to overwrite it.');
const raw=fs.readFileSync(input),backup=JSON.parse(raw),restored=restoreBackup(backup);
fs.mkdirSync(privateDir,{recursive:true});const sqlPath=path.join(privateDir,'initial-restore.sql');
if(!verifyOnly){
  fs.writeFileSync(sqlPath,restored.sql,{flag:'wx'});
  const log=fs.openSync(path.join(privateDir,'initial-import.log'),'wx');
  try{await new Promise((resolve,reject)=>{const child=spawn(process.execPath,['scripts/cli.mjs','wrangler','d1','execute','DB','--local','--persist-to',state,'--file',sqlPath,'--yes'],{stdio:['ignore',log,log]});child.once('error',reject);child.once('exit',code=>code===0?resolve():reject(Error('Local import failed; inspect the private import log. Do not overwrite or automatically retry.')));});}finally{fs.closeSync(log);}
}
const files=sqliteFiles(state);if(files.length!==1)throw Error('Expected exactly one local D1 database');
const db=new DatabaseSync(files[0],{readOnly:true});
try{for(const t of tableOrder){const rows=db.prepare('SELECT * FROM "'+t+'"').all();if(rows.length!==restored.counts[t]||tableHash(rows)!==restored.hashes[t])throw Error('Local data verification failed: '+t);}if(db.prepare('PRAGMA foreign_key_check').all().length)throw Error('Foreign key check failed');}finally{db.close();}
const report={importedAt:new Date().toISOString(),backupSha256:createHash('sha256').update(raw).digest('hex'),counts:restored.counts,localOnly:true,oldSystemModified:false};
fs.writeFileSync(path.join(privateDir,'data-import.json'),JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({localImport:'PASS',counts:restored.counts,hashesMatch:true,oldSystemModified:false}));
