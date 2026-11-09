const CAPACITY=2000;

export function createScanStore(indexedDB){
 let database=null;
 function open(){
  if(database)return database;
  const opening=new Promise((resolve,reject)=>{
   const request=indexedDB.open('mealcheck-device',1);
   const reset=()=>{if(database===opening)database=null;};
   request.onupgradeneeded=()=>request.result.createObjectStore('scans',{keyPath:'key'});
   request.onsuccess=()=>{
    const db=request.result;
    db.onclose=reset;
    db.onversionchange=()=>{db.close();reset();};
    resolve(db);
   };
   request.onerror=()=>{reset();reject(Error('Không mở được bộ nhớ trên máy. Kiểm tra dung lượng hoặc chế độ riêng tư.'));};
  });
  database=opening;
  return opening;
 }
 async function transact(mode,run,retry=true,strict=true){
  const db=await open();
  let tx;
  try{tx=mode==='readwrite'&&strict?db.transaction('scans',mode,{durability:'strict'}):db.transaction('scans',mode);}
  catch(error){
   // Safari can close the connection while suspended. Retry only before a transaction starts.
   if(retry&&error.name==='InvalidStateError'){database=null;return transact(mode,run,false,strict);}
   if(mode==='readwrite'&&strict&&error.name==='TypeError')return transact(mode,run,retry,false);
   throw Error('Không kết nối được bộ nhớ trên máy. Vui lòng mở lại ứng dụng.');
  }
  return new Promise((resolve,reject)=>{
   let result;
   tx.oncomplete=()=>resolve(result);
   tx.onerror=()=>reject(Error('Không lưu được lượt quét trên điện thoại.'));
   tx.onabort=()=>reject(Error('Lượt quét chưa được lưu. Vui lòng thử lại.'));
   run(tx.objectStore('scans'),value=>{result=value;},reject);
  });
 }
 function change(row,expected,error){
  return transact('readwrite',(store,done)=>{
   const current=store.get(row.key);
   current.onsuccess=()=>{
    if(current.result?.id!==row.id||current.result.state!==expected){done(false);return;}
    if(error)store.put({...row,state:'failed',error});
    else store.delete(row.key);
    done(true);
   };
  });
 }
 return {
  all:()=>/** @type {Promise<any[]>} */(transact('readonly',(store,done)=>{
   const request=store.getAll();request.onsuccess=()=>done(request.result);
  })),
  enqueue:row=>transact('readwrite',(store,done,reject)=>{
   const current=store.get(row.key);
   current.onsuccess=()=>{
    if(current.result){done(current.result);return;}
    const size=store.count();
    size.onsuccess=()=>{
     if(size.result>=CAPACITY){reject(Error('Đã có 2.000 lượt trên máy. Kết nối mạng để đồng bộ trước khi quét tiếp.'));return;}
     store.add(row);done(row);
    };
   };
  }),
  settle:(row,error)=>change(row,'pending',error),
  discard:row=>change(row,'failed'),
 };
}
