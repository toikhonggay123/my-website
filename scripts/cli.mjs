import './tool-env.mjs';
import {pathToFileURL} from 'node:url';
import path from 'node:path';
import {spawn} from 'node:child_process';
const [tool,...args] = process.argv.slice(2);
for(let i=0;i<args.length;i++)if(args[i]==='--env-file'&&args[i+1])args[i+1]=path.resolve(args[i+1]);
const commands={vinext:'vinext/dist/cli.js',wrangler:'wrangler/bin/wrangler.js',tsc:'typescript/bin/tsc',eslint:'eslint/bin/eslint.js'};
if(!commands[tool]) throw Error('Unsupported project tool');
const entry=path.resolve('node_modules',commands[tool]);
process.argv=[process.execPath,entry,...args];
if(tool==='wrangler'){
  const child=spawn(process.execPath,[entry,...args],{stdio:'inherit',env:process.env});
  process.on('SIGTERM',()=>child.kill('SIGTERM'));
  process.on('SIGINT',()=>child.kill('SIGINT'));
  child.on('error',error=>{console.error(error.message);process.exit(1);});
  child.on('exit',code=>process.exit(code??1));
  await new Promise(()=>{});
}
await import(pathToFileURL(entry).href);
