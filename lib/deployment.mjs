import {AppError} from './mealcheck.mjs';
const loopback=new Set(['localhost','127.0.0.1','[::1]']);

// Cloud hosting is explicitly opt-in; demo and live use separate databases.
export function deploymentPolicy(url,env={}){
  const mode=env.MEALCHECK_DEPLOYMENT||'local';
  if(mode==='local'){
    if(!loopback.has(url.hostname))throw new AppError('Ứng dụng chỉ dùng trên máy localhost.',403);
    return {mode,demoOnly:false,liveOnly:false,publicCloud:false,defaultSpace:'live'};
  }
  if(!['cloud-demo','cloud-live'].includes(mode))throw new AppError('Cấu hình triển khai không hợp lệ.',503);
  const host=env.MEALCHECK_PUBLIC_HOST;
  const aliases=(env.MEALCHECK_PUBLIC_HOST_ALIASES||'').split(',').map(host=>host.trim()).filter(Boolean);
  if(!host||![host,...aliases].includes(url.hostname)||url.protocol!=='https:')throw new AppError('Địa chỉ ứng dụng không hợp lệ.',403);
  return {mode,demoOnly:mode==='cloud-demo',liveOnly:mode==='cloud-live',publicCloud:true,defaultSpace:mode==='cloud-demo'?'demo':'live'};
}

export function deploymentSpace(url,policy){
  const space=url.searchParams.get('space')||policy.defaultSpace;
  if(!['live','demo'].includes(space))throw new AppError('Môi trường không hợp lệ.');
  if(policy.demoOnly&&space!=='demo')throw new AppError('Bản công khai chỉ sử dụng dữ liệu giả lập.',403);
  if(policy.liveOnly&&space!=='live')throw new AppError('Môi trường thử nghiệm đã được tắt.',403);
  return space;
}

export function allowDemoOperation(policy,route,method){
  // Student kiosk enrollment is not used by the current UI and would add a device row
  // per anonymous call on a public host. Already enrolled kiosks keep kiosk/* routes.
  if(policy.publicCloud&&route==='device/start')throw new AppError('Không tìm thấy chức năng.',404);
  if(policy.demoOnly&&route==='students'&&method==='POST')throw new AppError('Bản công khai không nhận danh sách học sinh. Chỉ dùng dữ liệu giả lập có sẵn.',403);
  if(policy.liveOnly&&route==='seed')throw new AppError('Chức năng tạo dữ liệu thử nghiệm đã được tắt.',403);
}

export function deploymentCookies(policy){
  return policy.liveOnly?{device:'mc_device_live',scanner:'mc_scanner_live'}:{device:'mc_device',scanner:'mc_scanner'};
}
