const xml=s=>String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g,'');
const encoder=new TextEncoder();
function crc32(b){let c=0xffffffff;for(const byte of b){c^=byte;for(let i=0;i<8;i++)c=(c>>>1)^((c&1)?0xedb88320:0);}return (c^0xffffffff)>>>0;}
function zip(files){const chunks=[],central=[];let offset=0,size=0;for(const [name,str] of Object.entries(files)){const n=encoder.encode(name),b=encoder.encode(str),crc=crc32(b),h=new Uint8Array(30+n.length),v=new DataView(h.buffer);v.setUint32(0,0x04034b50,true);v.setUint16(4,20,true);v.setUint32(14,crc,true);v.setUint32(18,b.length,true);v.setUint32(22,b.length,true);v.setUint16(26,n.length,true);h.set(n,30);chunks.push(h,b);const c=new Uint8Array(46+n.length),cv=new DataView(c.buffer);cv.setUint32(0,0x02014b50,true);cv.setUint16(4,20,true);cv.setUint16(6,20,true);cv.setUint32(16,crc,true);cv.setUint32(20,b.length,true);cv.setUint32(24,b.length,true);cv.setUint16(28,n.length,true);cv.setUint32(42,offset,true);c.set(n,46);central.push(c);offset+=h.length+b.length;size+=c.length;}const end=new Uint8Array(22),ev=new DataView(end.buffer);ev.setUint32(0,0x06054b50,true);ev.setUint16(8,central.length,true);ev.setUint16(10,central.length,true);ev.setUint32(12,size,true);ev.setUint32(16,offset,true);const out=new Uint8Array(offset+size+22);let p=0;for(const a of [...chunks,...central,end]){out.set(a,p);p+=a.length;}return out;}
export function makeXlsx(rows,name='Report'){
 const sheet=`<?xml version="1.0"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${rows.map((r,i)=>`<row r="${i+1}">${r.map((v,j)=>{let col='',x=j+1;while(x){col=String.fromCharCode(65+(x-1)%26)+col;x=Math.floor((x-1)/26);}return typeof v==='number'?`<c r="${col}${i+1}"><v>${v}</v></c>`:`<c r="${col}${i+1}" t="inlineStr"><is><t xml:space="preserve">${xml(v)}</t></is></c>`;}).join('')}</row>`).join('')}</sheetData></worksheet>`;
 return zip({'[Content_Types].xml':'<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>','_rels/.rels':'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>','xl/workbook.xml':`<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="${xml(name)}" sheetId="1" r:id="rId1"/></sheets></workbook>`,'xl/_rels/workbook.xml.rels':'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>','xl/worksheets/sheet1.xml':sheet});
}
export function parseCsv(text){const rows=[];let row=[],cell='',quoted=false;let commas=0,semicolons=0,inQuotes=false;for(let i=0;i<text.length;i++){const c=text[i];if(c==='\"'){if(inQuotes&&text[i+1]==='\"')i++;else inQuotes=!inQuotes;}else if(!inQuotes){if(c==='\n'||c==='\r')break;if(c===',')commas++;if(c===';')semicolons++;}}const delim=semicolons>commas?';':',';text=text.replace(/^\uFEFF/,'');for(let i=0;i<text.length;i++){const c=text[i];if(c==='"'){if(quoted&&text[i+1]==='"'){cell+='"';i++;}else quoted=!quoted;}else if(c===delim&&!quoted){row.push(cell);cell='';}else if((c==='\n'||c==='\r')&&!quoted){if(c==='\r'&&text[i+1]==='\n')i++;row.push(cell);if(row.some(Boolean))rows.push(row);row=[];cell='';}else cell+=c;}if(quoted)throw Error('Tệp CSV có dấu ngoặc kép chưa đóng.');row.push(cell);if(row.some(Boolean))rows.push(row);return rows;}
export async function readXlsx(file){
 const buffer=await file.arrayBuffer(),v=new DataView(buffer),bytes=new Uint8Array(buffer),decoder=new TextDecoder(),files={};
 const corrupt=()=>{throw Error('Tệp Excel không hợp lệ hoặc bị hỏng.');};
 const bounds=(offset,length)=>{if(offset<0||length<0||offset+length>bytes.length)corrupt();};
 if(bytes.length<22)corrupt();
 const lower=Math.max(0,bytes.length-65557);let end=bytes.length-22;
 while(end>=lower){if(v.getUint32(end,true)===0x06054b50&&end+22+v.getUint16(end+20,true)===bytes.length)break;end--;}
 if(end<lower)corrupt();
 const count=v.getUint16(end+10,true),centralSize=v.getUint32(end+12,true),centralStart=v.getUint32(end+16,true);
 if(v.getUint16(end+4,true)||v.getUint16(end+6,true)||v.getUint16(end+8,true)!==count)corrupt();
 if(count>1000)throw Error('Tệp có quá nhiều thành phần.');
 bounds(centralStart,centralSize);if(centralStart+centralSize>end)corrupt();
 let p=centralStart,expanded=0;
 for(let i=0;i<count;i++){
  bounds(p,46);if(v.getUint32(p,true)!==0x02014b50)corrupt();
  const flags=v.getUint16(p+8,true),method=v.getUint16(p+10,true),size=v.getUint32(p+20,true),uncompressed=v.getUint32(p+24,true),nl=v.getUint16(p+28,true),el=v.getUint16(p+30,true),cl=v.getUint16(p+32,true),off=v.getUint32(p+42,true);
  bounds(p+46,nl+el+cl);if(p+46+nl+el+cl>centralStart+centralSize)corrupt();
  const name=decoder.decode(bytes.slice(p+46,p+46+nl));expanded+=uncompressed;
  if(expanded>15000000)throw Error('Tệp Excel vượt giới hạn 15 MB sau giải nén.');
  if(flags&1)throw Error('Tệp Excel có mật khẩu chưa được hỗ trợ.');
  if(name.endsWith('.xml')||name.endsWith('.rels')){
   bounds(off,30);if(v.getUint32(off,true)!==0x04034b50)corrupt();
   const start=off+30+v.getUint16(off+26,true)+v.getUint16(off+28,true);bounds(start,size);
   let b=bytes.slice(start,start+size);
   if(method===8){
    const reader=new Blob([b]).stream().pipeThrough(new DecompressionStream('deflate-raw')).getReader(),chunks=[];let length=0;
    try{while(true){const chunk=await reader.read();if(chunk.done)break;length+=chunk.value.length;if(length>uncompressed){await reader.cancel();throw Error('Sai kích thước tệp Excel.');}chunks.push(chunk.value);}}finally{reader.releaseLock();}
    b=new Uint8Array(length);let at=0;for(const chunk of chunks){b.set(chunk,at);at+=chunk.length;}
   }else if(method!==0)throw Error('Định dạng nén Excel chưa được hỗ trợ.');
   if(b.length!==uncompressed)throw Error('Sai kích thước tệp Excel.');
   if(crc32(b)!==v.getUint32(p+16,true))corrupt();
   files[name]=decoder.decode(b);
  }
  p+=46+nl+el+cl;
 }
 const parser=new DOMParser(),parse=s=>{if(!s)corrupt();const doc=parser.parseFromString(s,'application/xml');if(doc.getElementsByTagName('parsererror').length)corrupt();return doc;};
 const strings=files['xl/sharedStrings.xml']?Array.from(parse(files['xl/sharedStrings.xml']).getElementsByTagName('si')).map(si=>Array.from(si.getElementsByTagName('t')).map(t=>t.textContent).join('')):[];
 const workbook=parse(files['xl/workbook.xml']),sheets=Array.from(workbook.getElementsByTagName('sheet')),sheet=sheets.find(s=>s.getAttribute('name')==='HOC_SINH')||sheets[0];
 if(!sheet)corrupt();
 const rid=sheet.getAttribute('r:id'),rels=parse(files['xl/_rels/workbook.xml.rels']),rel=Array.from(rels.getElementsByTagName('Relationship')).find(r=>r.getAttribute('Id')===rid);
 let target=rel?.getAttribute('Target')||'worksheets/sheet1.xml';target=target.startsWith('/')?target.slice(1):'xl/'+target;
 const source=files[target];if(!source)throw Error('Không đọc được trang học sinh.');
 return Array.from(parse(source).getElementsByTagName('row')).map(r=>{
  const values=[];
  for(const c of r.getElementsByTagName('c')){
   const ref=c.getAttribute('r')||'A',letters=ref.replace(/[0-9]/g,'');let col=0;
   if(!/^[A-Z]{1,3}$/.test(letters))corrupt();
   for(const l of letters)col=col*26+l.charCodeAt(0)-64;if(col>16384)corrupt();
   const val=c.getElementsByTagName('v')[0]?.textContent||'';
   values[col-1]=c.getAttribute('t')==='s'?strings[Number(val)]:c.getAttribute('t')==='inlineStr'?Array.from(c.getElementsByTagName('t')).map(t=>t.textContent).join(''):val;
  }
  return values;
 });
}
