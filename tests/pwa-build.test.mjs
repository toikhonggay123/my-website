import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
const script=path.resolve('scripts/build-pwa-precache.mjs');
const serviceWorker=fs.readFileSync('public/sw.js','utf8');
test('PWA build rejects file URLs before publishing a broken QR worker',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'mealcheck-worker-build-'));
 try{
  const staticDir=path.join(dir,'dist/client/_next/static');fs.mkdirSync(staticDir,{recursive:true});
  fs.writeFileSync(path.join(dir,'dist/client/sw.js'),serviceWorker);
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

test('PWA revision is reproducible and changes for both JavaScript and CSS updates',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'mealcheck-pwa-revision-'));
 try{
  const root=path.join(dir,'dist/client'),assets=path.join(root,'_next/static');fs.mkdirSync(assets,{recursive:true});
  const sw=path.join(root,'sw.js');fs.writeFileSync(sw,serviceWorker);
  fs.writeFileSync(path.join(assets,'app.js'),'console.log(1)');fs.writeFileSync(path.join(assets,'app.css'),'body{color:black}');
  const build=()=>{const result=spawnSync(process.execPath,[script],{cwd:dir,encoding:'utf8'});assert.equal(result.status,0,result.stderr);return fs.readFileSync(sw,'utf8');};
  const first=build();assert.doesNotMatch(first,/BUILD='development'/);assert.equal(build(),first);
  fs.writeFileSync(path.join(assets,'app.js'),'console.log(2)');const second=build();assert.notEqual(second,first);
  fs.writeFileSync(path.join(assets,'app.css'),'body{color:blue}');assert.notEqual(build(),second);
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
