import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
const ignored=new Set(['.git','node_modules','dist','.vinext','.wrangler','.tool-state','.migration-private','.sites-runtime','.local-server']);
let files=[];
function walk(dir){for(const entry of fs.readdirSync(dir,{withFileTypes:true})){if(ignored.has(entry.name))continue;const p=path.join(dir,entry.name);if(entry.isDirectory())walk(p);else files.push(p);}}
try{files=execFileSync('git',['ls-files','--cached','--others','--exclude-standard','-z'],{encoding:'utf8'}).split('\0').filter(Boolean);}catch{walk('.');files=files.filter(p=>!/(^|[\\/])(?:\.dev\.vars|\.env)(?!\.example)/.test(p));}
const failures=[];
for(const p of files){
  const normalized=p.replaceAll('\\','/');
  if(/\.(p12|pem|jks|sqlite|db|apk)$/.test(p)||(/(^|\/)(\.env|\.dev.vars)/.test(normalized)&&!p.endsWith('.env.example'))||/roster-|password\.txt|sites-d1-backup/.test(normalized))failures.push(p+': private or generated file');
  if(!/\.(ts|tsx|mjs|js|json|jsonc|yaml|yml|md|java|py|xml)$/.test(p))continue;
  const text=fs.readFileSync(p,'utf8');
  if(/-----BEGIN (?:RSA |EC )?PRIVATE KEY-----[\r\n]+[A-Za-z0-9+/=]{32,}|github_pat_[A-Za-z0-9_]{20,}|ghp_[A-Za-z0-9]{30,}/.test(text))failures.push(p+': credential pattern');
  if(/^(app|worker|lib|android-app\/src)\//.test(normalized)&&/chatgpt\.site|signin-with-chatgpt|signout-with-chatgpt/.test(text))failures.push(p+': legacy host dependency');
}
if(failures.length)throw Error(failures.join('\n'));
console.log('Source checks passed: no known credential files or legacy runtime URLs. This is a bounded scan, not a secret-detection guarantee.');
