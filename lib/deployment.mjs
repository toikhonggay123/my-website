import {AppError} from './mealcheck.mjs';
const loopback=new Set(['localhost','127.0.0.1','[::1]']);

// Cloud hosting is explicitly opt-in and never exposes the local/live environment.
export function deploymentPolicy(url,env={}){
  const mode=env.MEALCHECK_DEPLOYMENT||'local';
  if(mode==='local'){
    if(!loopback.has(url.hostname))throw new AppError('Ứng dụng chỉ dùng trên máy localhost.',403);
    return {mode,demoOnly:false,defaultSpace:'live'};
  }
  if(mode!=='cloud-demo')throw new AppError('Cấu hình triển khai không hợp lệ.',503);
  const host=env.MEALCHECK_PUBLIC_HOST;
  if(!host||host!==url.hostname||url.protocol!=='https:')throw new AppError('Địa chỉ bản demo không hợp lệ.',403);
  return {mode,demoOnly:true,defaultSpace:'demo'};
}

export function deploymentSpace(url,policy){
  const space=url.searchParams.get('space')||policy.defaultSpace;
  if(!['live','demo'].includes(space))throw new AppError('Môi trường không hợp lệ.');
  if(policy.demoOnly&&space!=='demo')throw new AppError('Bản công khai chỉ sử dụng dữ liệu giả lập.',403);
  return space;
}

export function allowDemoOperation(policy,route,method){
  if(policy.demoOnly&&route==='students'&&method==='POST')throw new AppError('Bản công khai không nhận danh sách học sinh. Chỉ dùng dữ liệu giả lập có sẵn.',403);
}
