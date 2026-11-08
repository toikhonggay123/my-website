import test from 'node:test';
import assert from 'node:assert/strict';
import {scannerClock,scannerDate,sessionForScan} from '../lib/scanner-session.mjs';

test('scanner uses server day despite a wrong phone date and advances across midnight',()=>{
 const clock=scannerClock(Date.parse('2026-11-04T23:59:59+07:00'),100);
 assert.equal(scannerDate(clock,100),'2026-11-04');
 assert.equal(sessionForScan('live','sang','live:2026-11-04:sang',clock,200).needsPreparation,false);
 const next=sessionForScan('live','sang','live:2026-11-04:sang',clock,2100);
 assert.deepEqual(next,{id:'live:2026-11-05:sang',date:'2026-11-05',needsPreparation:true});
 assert.equal(scannerDate(clock,50),'2026-11-04','monotonic reset never moves time backwards');
});

test('switching meals prepares the right day/session; missing selection cannot enqueue',()=>{
 const clock=scannerClock(Date.parse('2026-11-05T12:00:00+07:00'),0);
 assert.equal(sessionForScan('demo','trua','demo:2026-11-04:trua',clock,10).id,'demo:2026-11-05:trua');
 assert.equal(sessionForScan('demo','trua','demo:2026-11-05:trua',clock,10).needsPreparation,false);
 assert.throws(()=>sessionForScan('live','','',clock,10),/Chọn buổi/);
 assert.throws(()=>scannerClock(undefined),/thời gian/);
});
