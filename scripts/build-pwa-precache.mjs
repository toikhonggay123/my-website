import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {build} from 'vite';
const root=path.resolve('dist/client');
const assets=fs.readdirSync(root,{recursive:true}).filter(file=>/^_next[\\/]static[\\/]/.test(file)&&/\.(js|css)$/.test(file)).map(file=>'/'+file.replaceAll('\\','/'));
if(!assets.length)throw Error('No built PWA assets found');
for(const asset of assets.filter(file=>file.endsWith('.js'))){
 const source=fs.readFileSync(path.join(root,asset.slice(1)),'utf8');
 if(/file:\/\/\/_next\/static\//.test(source))throw Error('Invalid file:// URL in client bundle: '+asset+'. Browser workers must load from HTTP(S) assets.');
}
assets.sort();
const revision=createHash('sha256');
for(const asset of assets)revision.update(asset).update(fs.readFileSync(path.join(root,asset.slice(1))));
const swPath=path.join(root,'sw.js'),sw=fs.readFileSync(swPath,'utf8');
if(!/const BUILD='[^']*';/.test(sw))throw Error('Missing PWA build revision marker');
const syncSlot=/\/\* CHECKIN_BACKGROUND_SYNC \*\/[\s\S]*?\/\* END_CHECKIN_BACKGROUND_SYNC \*\//;
if(!syncSlot.test(sw))throw Error('Missing PWA background sync bundle marker');
const bundled=await build({
 configFile:false,logLevel:'silent',publicDir:false,
 build:{write:false,target:'es2020',lib:{entry:fileURLToPath(new URL('../worker/scan-sync.mjs',import.meta.url)),name:'CheckInScanSync',formats:['iife']}},
});
const syncCode=(Array.isArray(bundled)?bundled[0]:bundled).output.find(item=>item.type==='chunk')?.code;
if(!syncCode)throw Error('Missing PWA background sync bundle');
revision.update(syncCode);
fs.writeFileSync(swPath,sw.replace(/const BUILD='[^']*';/,`const BUILD='${revision.digest('hex').slice(0,20)}';`)
 .replace(syncSlot,()=>`/* CHECKIN_BACKGROUND_SYNC */\n${syncCode}\n/* END_CHECKIN_BACKGROUND_SYNC */`));
fs.writeFileSync(path.join(root,'precache.json'),JSON.stringify(assets));
console.log('PWA offline shell: '+assets.length+' built JS/CSS assets.');
