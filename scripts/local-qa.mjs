import './tool-env.mjs';
import fs from 'node:fs';
import path from 'node:path';
import {randomBytes} from 'node:crypto';
import {spawn} from 'node:child_process';
const cli='scripts/cli.mjs',vars=path.resolve('.tool-state/qa-'+randomBytes(6).toString('hex')+'.vars');
const state='.wrangler/qa-state-'+randomBytes(6).toString('hex');
fs.mkdirSync(path.dirname(vars),{recursive:true});
const run=args=>new Promise((resolve,reject)=>{const child=spawn(process.execPath,args,{stdio:'inherit'});child.once('error',reject);child.once('exit',code=>code===0?resolve():reject(Error('QA command failed')));});
let server,logs='';
try{
  const directoryKey=randomBytes(32).toString('base64url');
  fs.writeFileSync(vars,'MEALCHECK_QA_MODE=true\nMEALCHECK_QR_KEY='+randomBytes(32).toString('base64url')+'\nMEALCHECK_DIRECTORY_KEY='+directoryKey+'\n',{flag:'wx'});
  await run([cli,'wrangler','d1','migrations','apply','DB','--env-file',vars,'--local','--persist-to',state]);
  server=spawn(process.execPath,[cli,'wrangler','dev','--config','dist/server/wrangler.json','--env-file',vars,'--local','--persist-to',state,'--ip','127.0.0.1','--port','5173','--inspector-port','0'],{stdio:['ignore','pipe','pipe']});
  // Keep startup logs bounded; do not emit environment values.
  for(const stream of [server.stdout,server.stderr])stream.on('data',c=>{logs=(logs+c).slice(-6000);});
  let ready=false;
  for(let i=0;i<100;i++){
    if(server.exitCode!==null)throw Error('Local Worker exited before readiness: '+logs);
    try{const r=await fetch('http://127.0.0.1:5173/api/identity',{signal:AbortSignal.timeout(1000)});if(r.ok){ready=true;break;}}catch{}
    await new Promise(r=>setTimeout(r,300));
  }
  if(!ready)throw Error('Local Worker did not become ready');
  await new Promise((resolve,reject)=>{
    const test=spawn(process.execPath,['tests/cloud.http.mjs'],{
      stdio:'inherit',env:{...process.env,MEALCHECK_QA_DIRECTORY_KEY:directoryKey},
    });
    test.once('error',reject);
    test.once('exit',code=>code===0?resolve():reject(Error('HTTP QA failed')));
  });
  if(process.argv.includes('--preview')){
    console.log('Verified local preview ready: http://127.0.0.1:5173/quan-tri');
    await new Promise(resolve=>{
      let poll;
      const done=()=>{clearInterval(poll);resolve();};
      process.once('SIGINT',done);process.once('SIGTERM',done);
      const stopFile=process.env.MEALCHECK_QA_STOP_FILE;
      if(stopFile)poll=setInterval(()=>{if(fs.existsSync(stopFile))done();},500);
    });
  }
}catch(error){console.error('Local Worker diagnostic log:\n'+logs.slice(-2400));throw error;}finally{
  if(server){
    if(process.platform==='win32'&&server.exitCode===null&&Number.isInteger(server.pid))await new Promise(resolve=>{const stop=spawn('taskkill',['/PID',String(server.pid),'/T','/F'],{stdio:'ignore'});stop.once('exit',resolve);stop.once('error',resolve);});
    else server.kill();
    await new Promise(resolve=>{if(server.exitCode!==null)resolve();else{server.once('exit',resolve);setTimeout(resolve,3000);}});
  }
  if(fs.existsSync(vars))fs.unlinkSync(vars);
}
