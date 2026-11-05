import {localClock,MEALS} from './mealcheck.mjs';

// Advance server time with a monotonic clock, independent of a phone's date.
export function scannerClock(serverNow,tick=performance.now()){
 if(!Number.isFinite(serverNow))throw Error('Chưa nhận được thời gian từ máy chủ. Mở lại máy quét.');
 return {serverNow,tick};
}
export function scannerDate(clock,tick=performance.now()){
 return clock?localClock(clock.serverNow+Math.max(0,tick-clock.tick)).date:localClock().date;
}
export function sessionForScan(space,meal,session,clock,tick=performance.now()){
 if(!['live','demo'].includes(space)||!MEALS.includes(meal))throw Error('Chọn bữa ăn trước khi quét.');
 const date=scannerDate(clock,tick);
 return {id:`${space}:${date}:${meal}`,date,needsPreparation:session!==`${space}:${date}:${meal}`};
}
