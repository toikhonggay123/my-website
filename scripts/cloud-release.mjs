import './tool-env.mjs';
import fs from 'node:fs';
import {spawnSync} from 'node:child_process';
const action=process.argv[2];
if(!['build','deploy'].includes(action))throw Error('Use build or deploy');
const config=JSON.parse(fs.readFileSync('wrangler.cloud.jsonc','utf8'));
if(config.name!=='my-website'||config.vars?.MEALCHECK_DEPLOYMENT!=='cloud-live'||!config.vars?.MEALCHECK_PUBLIC_HOST)throw Error('Invalid live cloud configuration');
const binding=config.d1_databases?.find(d=>d.binding==='DB');
if(!binding?.database_id||binding.database_id.startsWith('00000000-')||!binding.database_name.startsWith('afyllx-mealcheck-live-'))throw Error('Live hosting requires its own live database');
const demo=JSON.parse(fs.readFileSync('wrangler.demo.jsonc','utf8'));
if(binding.database_id===demo.d1_databases?.find(d=>d.binding==='DB')?.database_id)throw Error('Live and demo databases must remain separate');
if(action==='deploy'){
 const built=JSON.parse(fs.readFileSync('dist/server/wrangler.json','utf8'));
 if(built.name!==config.name||built.vars?.MEALCHECK_DEPLOYMENT!=='cloud-live'||built.d1_databases?.find(d=>d.binding==='DB')?.database_id!==binding.database_id)throw Error('Build the live target before deployment');
}
const result=spawnSync(process.execPath,['scripts/cli.mjs',...(action==='build'?['vinext','build']:['wrangler','deploy','--config','dist/server/wrangler.json','--env',''])],{stdio:'inherit',env:{...process.env,MEALCHECK_BUILD_TARGET:'cloud-live'}});
if(result.error)throw result.error;
process.exit(result.status??1);
