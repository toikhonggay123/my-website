import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
const script=path.resolve('scripts/build-pwa-precache.mjs');
test('PWA build rejects file URLs before publishing a broken QR worker',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'mealcheck-worker-build-'));
 try{
  const staticDir=path.join(dir,'dist/client/_next/static');fs.mkdirSync(staticDir,{recursive:true});
  const asset=path.join(staticDir,'scanner.js');
  fs.writeFileSync(asset,'new Worker("file:///_next/static/qr-decode.worker-broken.js")');
  const failed=spawnSync(process.execPath,[script],{cwd:dir,encoding:'utf8'});
  assert.notEqual(failed.status,0);assert.match(failed.stderr,/Invalid file:\/\/ URL/);
  assert.equal(fs.existsSync(path.join(dir,'dist/client/precache.json')),false);
  fs.writeFileSync(asset,'new Worker("/_next/static/qr-decode.worker-fixed.js", {type:"module"})');
  fs.writeFileSync(path.join(staticDir,'qr-decode.worker-fixed.js'),'self.onmessage = () => {};');
  const passed=spawnSync(process.execPath,[script],{cwd:dir,encoding:'utf8'});
  assert.equal(passed.status,0,passed.stderr);
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(dir,'dist/client/precache.json'),'utf8')),['/_next/static/qr-decode.worker-fixed.js','/_next/static/scanner.js']);
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
