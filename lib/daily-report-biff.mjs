import {CFB} from 'xlsx';

// SheetJS CE writes genuine BIFF8 values/merges, but not report cell styles.
// Add BIFF8 FONT/XF/PALETTE records without changing cell values or string data.
// Record layouts: https://www.openoffice.org/sc/excelfileformat.pdf (BIFF8).
const view=bytes=>new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
const record=(id,data)=>({id,data});
function font({size=11,bold=false,color=8}){
 const name='Arial',data=new Uint8Array(16+2*name.length),v=view(data);
 v.setUint16(0,size*20,true);v.setUint16(4,color,true);v.setUint16(6,bold?700:400,true);
 data[14]=name.length;data[15]=1;
 for(let i=0;i<name.length;i++)v.setUint16(16+2*i,name.charCodeAt(i),true);
 return record(0x0031,data);
}
function palette(){
 const colors=['19283F','FFFFFF','3264E6','EAF0FD','173B6A','DCE4EF','52637B','F5F8FC'];
 const data=new Uint8Array(2+56*4);view(data).setUint16(0,56,true);
 for(let i=0;i<56;i++){const hex=colors[i]||'FFFFFF';for(let c=0;c<3;c++)data[2+i*4+c]=parseInt(hex.slice(c*2,c*2+2),16);}
 return record(0x0092,data);
}
function xf(base,{font:fontIndex=0,align=1,fill=9,border=false,wrap=false}){
 const data=base.slice(),v=view(data);
 v.setUint16(0,fontIndex,true);
 // Cell XF, preserving the original number format.
 v.setUint16(4,0,true);
 v.setUint32(6,(align|0x10|(wrap?8:0)|0x78000000)>>>0,true);
 v.setUint32(10,border?(0x1111|(13<<16)|(13<<23))>>>0:0,true);
 v.setUint32(14,((1<<26)|(border?13|(13<<7):0))>>>0,true);
 v.setUint16(18,fill|(9<<7),true);
 return record(0x00e0,data);
}
function styleFor(sheet,row,col){
 const r=sheet['!report'];
 if(row===0)return 'school';if(row===1)return 'title';if(row===2)return 'date';if(row===3)return 'note';
 if(row===5||row===6)return 'header';if(row===r.totalRow)return 'total';
 if(row>=7&&row<=r.lastData){
  const left=r.kind!=='summary'&&(col===2||(r.kind==='meal'&&col===7));
  return (left?'left':'center')+(row%2?'':'Alternate');
 }
 return 'note';
}
export function formatDailyBiff(bytes,wb){
 const cfb=CFB.read(bytes,{type:'array'}),entry=CFB.find(cfb,'Workbook');
 if(!entry)throw Error('Không tìm thấy nội dung Excel BIFF8.');
 const source=new Uint8Array(entry.content),src=view(source),records=[];
 for(let offset=0;offset<source.length;){
  if(offset+4>source.length)throw Error('Excel BIFF8 bị thiếu tiêu đề bản ghi.');
  const id=src.getUint16(offset,true),length=src.getUint16(offset+2,true);
  if(!id&&length===0)break;
  if(offset+4+length>source.length)throw Error('Excel BIFF8 bị thiếu dữ liệu bản ghi.');
  records.push(record(id,source.slice(offset+4,offset+4+length)));offset+=4+length;
 }
 const endGlobals=records.findIndex(r=>r.id===0x000a),globals=records.slice(0,endGlobals);
 const fonts=globals.filter(r=>r.id===0x0031),xfs=globals.filter(r=>r.id===0x00e0);
 if(endGlobals<0||!fonts.length||!xfs.length)throw Error('Cấu trúc Excel BIFF8 không được hỗ trợ.');
 const fontIndex=n=>n<4?n:n+1; // BIFF reserves font index 4.
 const bold=fontIndex(fonts.length),title=fontIndex(fonts.length+1),white=fontIndex(fonts.length+2);
 const styles={school:{font:bold,align:2},title:{font:title,align:2},date:{align:2},note:{wrap:true},header:{font:white,align:2,fill:10,border:true,wrap:true},total:{font:bold,align:2,fill:11,border:true},left:{border:true,wrap:true},center:{align:2,border:true},leftAlternate:{fill:15,border:true,wrap:true},centerAlternate:{align:2,fill:15,border:true}};
 const additions=[],indices=new Map();
 const indexFor=(base,name)=>{
  const key=base+':'+name;
  if(!indices.has(key)){
   if(!xfs[base])throw Error('Chỉ số định dạng Excel không hợp lệ.');
   indices.set(key,xfs.length+additions.length);additions.push(xf(xfs[base].data,styles[name]));
  }
  return indices.get(key);
 };
 const cellIds=new Set([0x0203,0x00fd,0x0204,0x0205,0x0201,0x0006,0x027e]);
 let sheetIndex=-1;
 for(const r of records.slice(endGlobals+1)){
  const v=view(r.data);
  if(r.id===0x0809&&v.getUint16(2,true)===0x0010)sheetIndex++;
  if(sheetIndex<0)continue;
  const sheet=wb.Sheets[wb.SheetNames[sheetIndex]];
  if(cellIds.has(r.id))v.setUint16(4,indexFor(v.getUint16(4,true),styleFor(sheet,v.getUint16(0,true),v.getUint16(2,true))),true);
  // The current writer emits individual cells. Fail rather than partially style
  // packed cells if a future dependency changes that contract.
  if(r.id===0x00bd||r.id===0x00be||r.id===0x020b||r.id===0x00d7)throw Error('Cần cập nhật bộ định dạng Excel cho phiên bản mới.');
  if(r.id===0x023e)v.setUint16(0,((v.getUint16(0,true)|0x0108)&~0x0602)|(sheetIndex===0?0x0600:0),true); // freeze; hide grid; select only first sheet
  if(r.id===0x001d)r.data[0]=2; // active pane below the frozen headers
 }
 const output=[];let addedFonts=false,addedXfs=false,currentSheet=-1,lastRow=-1;
 for(let i=0;i<records.length;i++){
  const r=records[i];
  if(i>endGlobals&&r.id===0x0809&&view(r.data).getUint16(2,true)===0x0010){currentSheet++;lastRow=-1;}
  if(currentSheet>=0&&cellIds.has(r.id)){
   const row=view(r.data).getUint16(0,true);
   if(row!==lastRow){
    const sheet=wb.Sheets[wb.SheetNames[currentSheet]],data=new Uint8Array(16),v=view(data);
    v.setUint16(0,row,true);v.setUint16(4,sheet['!cols'].length,true);v.setUint16(6,Math.round(sheet['!rows'][row].hpt*20),true);data[12]=0x40;
    output.push(record(0x0208,data));lastRow=row;
   }
  }
  if(i<endGlobals&&r.id===0x0092)continue; // replace palette once
  if(i<endGlobals&&r.id===0x00e0&&!addedFonts){output.push(font({bold:true}),font({bold:true,size:17,color:12}),font({bold:true,color:9}));addedFonts=true;}
  if(i===endGlobals&&!addedXfs){output.push(...additions,palette());addedXfs=true;}
  output.push(r);
  if(i<endGlobals&&r===fonts[0]){const v=view(r.data);v.setUint16(0,220,true);v.setUint16(4,8,true);}
  if(i>endGlobals&&r.id===0x023e){
   const pane=new Uint8Array(10),v=view(pane);v.setUint16(2,7,true);v.setUint16(4,7,true);pane[8]=2;
   output.push(record(0x0041,pane));
  }
 }
 // Globals and pane records grow the stream; relocate every BOUNDSHEET pointer.
 let length=0;const starts=[];
 for(const r of output){if(r.id===0x0809&&view(r.data).getUint16(2,true)===0x0010)starts.push(length);length+=4+r.data.length;}
 const bounds=output.filter(r=>r.id===0x0085);
 if(bounds.length!==starts.length||starts.length!==wb.SheetNames.length)throw Error('Số trang Excel không khớp.');
 bounds.forEach((r,i)=>view(r.data).setUint32(0,starts[i],true));
 const result=new Uint8Array(length),v=view(result);let offset=0;
 for(const r of output){v.setUint16(offset,r.id,true);v.setUint16(offset+2,r.data.length,true);result.set(r.data,offset+4);offset+=4+r.data.length;}
 CFB.utils.cfb_add(cfb,'Workbook',result);
 return new Uint8Array(CFB.write(cfb,{type:'array'}));
}
