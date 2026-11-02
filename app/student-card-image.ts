import type {StudentCard} from './student-qr-card';
import {SCHOOL} from '@/lib/mealcheck.mjs';

const DPI=300,WIDTH=Math.round(85.6/25.4*DPI),HEIGHT=Math.round(54/25.4*DPI);
function crc(bytes:Uint8Array){let c=0xffffffff;for(const b of bytes){c^=b;for(let bit=0;bit<8;bit++)c=(c>>>1)^((c&1)?0xedb88320:0);}return (c^0xffffffff)>>>0;}
// Canvas defaults to 96 dpi. Write the PNG resolution chunk for a card-sized 300 dpi export.
function withPrintResolution(buffer:ArrayBuffer){
 const source=new Uint8Array(buffer),chunks:Uint8Array[]=[source.slice(0,8)],view=new DataView(buffer);let at=8,inserted=false;
 const chunk=new Uint8Array(21),v=new DataView(chunk.buffer);v.setUint32(0,9);chunk.set([112,72,89,115],4);v.setUint32(8,Math.round(DPI/0.0254));v.setUint32(12,Math.round(DPI/0.0254));chunk[16]=1;v.setUint32(17,crc(chunk.subarray(4,17)));
 while(at<source.length){const length=view.getUint32(at),type=String.fromCharCode(...source.subarray(at+4,at+8));if(type!=='pHYs')chunks.push(source.slice(at,at+12+length));at+=12+length;if(type==='IHDR'&&!inserted){chunks.push(chunk);inserted=true;}}
 return new Blob(chunks as BlobPart[],{type:'image/png'});
}
function lines(ctx:CanvasRenderingContext2D,text:string,width:number){const rows:string[]=[];for(const word of text.split(/\s+/)){const last=rows.at(-1);if(!last||ctx.measureText(last+' '+word).width>width)rows.push(word);else rows[rows.length-1]+=' '+word;}return rows;}
export async function downloadStudentCard(card:StudentCard,demo=false){
 await document.fonts.ready;
 const image=new Image();image.src=card.image;const logo=new Image();logo.src="/brand/afyllx-logo.png";await Promise.all([image.decode(),logo.decode()]);
 const canvas=document.createElement('canvas');canvas.width=WIDTH;canvas.height=HEIGHT;const ctx=canvas.getContext('2d')!;
 const scale=WIDTH/856;ctx.scale(scale,scale);const h=HEIGHT/scale;
 ctx.beginPath();ctx.roundRect(0,0,856,h,31.8);ctx.clip();
 ctx.fillStyle='#eef7fb';ctx.fillRect(0,0,856,h);
 for(const [x,y,r,color] of [[-40,80,400,'rgba(102,221,220,.45)'],[800,500,390,'rgba(184,172,247,.45)'],[500,-160,400,'rgba(255,255,255,.95)']] as const){const g=ctx.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,color);g.addColorStop(1,'rgba(255,255,255,0)');ctx.fillStyle=g;ctx.fillRect(0,0,856,h);}
 const gloss=ctx.createLinearGradient(0,0,856,h);gloss.addColorStop(0,'rgba(255,255,255,.85)');gloss.addColorStop(.48,'rgba(255,255,255,.18)');gloss.addColorStop(1,'rgba(255,255,255,.55)');ctx.fillStyle=gloss;ctx.fillRect(0,0,856,h);
 ctx.strokeStyle='rgba(255,255,255,.95)';ctx.lineWidth=3;ctx.strokeRect(2,2,852,h-4);
 // Keep the QR and its built-in four-module quiet zone fully opaque and unstyled.
 ctx.fillStyle='#ffffff';ctx.fillRect(30,38,445,445);ctx.imageSmoothingEnabled=false;ctx.drawImage(image,30,38,445,445);ctx.imageSmoothingEnabled=true;
 ctx.fillStyle='#3e6470';ctx.font='600 17px "Segoe UI",Arial,sans-serif';ctx.textAlign='center';ctx.fillText('QUÉT MÃ ĐỂ ĐIỂM DANH',252.5,513);ctx.textAlign='left';
 const x=510,w=315;
 ctx.fillStyle='#4d697a';ctx.font='400 20px "Segoe UI",Arial,sans-serif';let y=50;for(const line of lines(ctx,SCHOOL,w)){ctx.fillText(line,x,y);y+=25;}
 y+=20;ctx.fillStyle='#376880';ctx.font='600 18px "Segoe UI",Arial,sans-serif';ctx.fillText('THẺ NHÀ ĂN',x,y);
 let size=card.name.length>30?31:35;let nameLines:string[]=[];for(;size>=20;size--){ctx.font=`700 ${size}px "Segoe UI",Arial,sans-serif`;nameLines=lines(ctx,card.name,w);if(nameLines.length<=3)break;}
 ctx.fillStyle='#15364e';y+=42;for(const line of nameLines){ctx.fillText(line,x,y);y+=size*1.15;}
 y+=21;ctx.font='600 24px "Segoe UI",Arial,sans-serif';ctx.fillText(`LỚP ${card.class}   ·   KHỐI ${card.grade}`,x,y,w);
 y+=41;ctx.font='500 16px "Segoe UI",Arial,sans-serif';ctx.fillStyle='#45647a';ctx.fillText('MÃ HỌC SINH',x,y);y+=31;ctx.font='700 25px Consolas,monospace';ctx.fillStyle='#163e58';ctx.fillText(card.code,x,y,w);
 if(demo){ctx.font='600 15px "Segoe UI",Arial,sans-serif';ctx.fillStyle='#4d697a';ctx.fillText('DỮ LIỆU THỬ NGHIỆM',x,y+27);}
 // Right-aligned signature shares one baseline, below the student information.
 const logoSize=30,brandGap=9,wordGap=6,brandBottom=h-30;
 ctx.font='700 23px "Segoe UI",Arial,sans-serif';const afyllxWidth=ctx.measureText('AFYLLX').width;
 ctx.font='400 21px "Segoe UI",Arial,sans-serif';const mealcheckWidth=ctx.measureText('MealCheck').width;
 const brandX=856-31-(logoSize+brandGap+afyllxWidth+wordGap+mealcheckWidth),baseline=brandBottom-6;
 ctx.drawImage(logo,brandX,brandBottom-logoSize,logoSize,logoSize);
 ctx.fillStyle='#173d59';ctx.font='700 23px "Segoe UI",Arial,sans-serif';ctx.fillText('AFYLLX',brandX+logoSize+brandGap,baseline);
 ctx.fillStyle='#31576e';ctx.font='400 21px "Segoe UI",Arial,sans-serif';ctx.fillText('MealCheck',brandX+logoSize+brandGap+afyllxWidth+wordGap,baseline);
 const blob=await new Promise<Blob>((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(Error('PNG failed')),'image/png'));
 const url=URL.createObjectURL(withPrintResolution(await blob.arrayBuffer())),link=document.createElement('a');link.href=url;link.download='The-hoc-sinh-'+card.code.replace(/[^\p{L}\p{N}_-]/gu,'-')+'.png';link.click();setTimeout(()=>URL.revokeObjectURL(url),10000);
}
