import fs from 'node:fs';
import path from 'node:path';
const root=path.resolve('dist/client');
const assets=fs.readdirSync(root,{recursive:true}).filter(file=>/^_next[\\/]static[\\/]/.test(file)&&/\.(js|css)$/.test(file)).map(file=>'/'+file.replaceAll('\\','/'));
if(!assets.length)throw Error('No built PWA assets found');
fs.writeFileSync(path.join(root,'precache.json'),JSON.stringify(assets));
console.log('PWA offline shell: '+assets.length+' built JS/CSS assets.');
