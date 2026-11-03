import test from 'node:test';
import assert from 'node:assert/strict';
import {cameraRegion,videoFramePump} from '../lib/camera-region.mjs';
test('camera guide maps through cover cropping instead of decoding invisible image edges',()=>{
 const region=cameraRegion(1280,720,{left:0,top:0,width:360,height:720},{left:60,top:210,width:240,height:240});
 assert.deepEqual(region,{x:500,y:190,width:280,height:280});
 assert.equal(cameraRegion(0,720,{},{}),null);
 const full=cameraRegion(1280,720,{left:0,top:0,width:1280,height:720},{left:0,top:0,width:1280,height:720});assert.deepEqual(full,{x:0,y:0,width:1280,height:720});
});
test('video pump decodes new media frames once, and cancellation stops pending callbacks',async()=>{
 let callback,handle=0,cancelled=0,reads=0;
 const video={currentTime:0,requestVideoFrameCallback(fn){callback=fn;return ++handle;},cancelVideoFrameCallback(){cancelled++;}};
 const stop=videoFramePump(video,async()=>{reads++;},{minimumInterval:0});
 await callback(0,{mediaTime:1});assert.equal(reads,1);
 await callback(100,{mediaTime:1});assert.equal(reads,1);
 await callback(200,{mediaTime:2});assert.equal(reads,2);stop();assert.equal(cancelled,1);
 await callback(300,{mediaTime:3});assert.equal(reads,2);
});
