"use client";

import {useEffect, useState} from "react";
import {ArrowRight, ChevronDown, Download, Moon, ScanLine, Sun, Sunset, Users} from "lucide-react";
import {LABELS, MEALS} from "@/lib/mealcheck.mjs";
import {readDevicePref, saveDevicePref} from "./offline-store";
import {TodayExport} from "./daily-attendance";
import {InstallApp} from "./pwa";

export type HomeBoard = {date:string; total:number; meals:Record<string,{count:number;missing:number;rate:number}>; byClass:Array<{grade:string;class:string;total:number;[key:string]:any}>};
const icons:Record<string,typeof Sun> = {sang:Sun,trua:Sunset,toi:Moon};
const shortLabels:Record<string,string> = {sang:"Sáng",trua:"Trưa",toi:"Tối"};
const nf = new Intl.NumberFormat("vi-VN");

export function HomeOverview({board,space,onScan,onMissing}:{board:HomeBoard;space:string;onScan:()=>void;onMissing:(meal:string,date:string)=>void}) {
  const [selected,setSelected] = useState("");
  useEffect(()=>{
    const saved=readDevicePref("meal:"+space,null);
    setSelected(saved?.date===board.date && MEALS.includes(saved.meal) ? saved.meal : "");
  },[space,board.date]);
  const choose=(meal:string)=>{
    setSelected(meal);
    saveDevicePref("meal:"+space,{date:board.date,meal});
  };
  const chosen=board.meals[selected];
  const displayDate=new Date(board.date+"T12:00:00+07:00").toLocaleDateString("vi-VN",{weekday:"long",day:"2-digit",month:"2-digit",timeZone:"Asia/Ho_Chi_Minh"});
  return <div className="home-overview">
    <header className="home-heading">
      <div><p className="home-date">{displayDate}</p><h1>Hôm nay</h1><p className="home-roster"><Users size={15} aria-hidden="true"/>{nf.format(board.total)} học sinh<span aria-hidden="true">·</span>{board.byClass.length} lớp</p></div>
      <details className="home-actions"><summary aria-label="Xuất danh sách hôm nay"><Download size={18} aria-hidden="true"/><span>Xuất Excel</span></summary><div className="home-actions-menu"><TodayExport space={space}/></div></details>
    </header>
    <InstallApp compact/>
    <button className="home-scan primary" onClick={onScan}><ScanLine size={25} aria-hidden="true"/><span>Quét QR điểm danh</span><ArrowRight size={20} aria-hidden="true"/></button>
    <section className="home-meals" aria-labelledby="home-meals-title">
      <div className="home-section-heading"><h2 id="home-meals-title">Ba bữa hôm nay</h2><span>Đã điểm danh / tổng số</span></div>
      <div className="home-meal-grid">{MEALS.map(meal=>{
        const Icon=icons[meal],stats=board.meals[meal];
        return <button key={meal} className={"home-meal "+meal} aria-pressed={selected===meal} aria-controls="home-meal-detail" aria-label={`${LABELS[meal as keyof typeof LABELS]}: ${stats.count} trên ${board.total} học sinh đã điểm danh`} onClick={()=>choose(meal)}>
          <span className="home-meal-name"><Icon size={19} aria-hidden="true"/>{shortLabels[meal]}</span>
          <strong>{nf.format(stats.count)}<small>/{nf.format(board.total)}</small></strong>
          <span className="home-progress" aria-hidden="true"><i style={{width:`${Math.max(0,Math.min(1,stats.rate))*100}%`}}/></span>
        </button>;
      })}</div>
      <div id="home-meal-detail" className={"home-meal-detail "+(chosen?"has-selection":"")}>
        {chosen ? <><div><span>{LABELS[selected as keyof typeof LABELS]}</span><p><b>{nf.format(chosen.missing)}</b> chưa điểm danh</p></div><button onClick={()=>onMissing(selected,board.date)}>Xem danh sách<ArrowRight size={17} aria-hidden="true"/></button></> : <p>Chọn một bữa để xem học sinh chưa điểm danh.</p>}
      </div>
    </section>
    <details className="home-classes"><summary><span>Theo lớp</span><small>{board.byClass.length} lớp</small><ChevronDown size={18} aria-hidden="true"/></summary>
      <div className="home-class-list">{board.byClass.length ? board.byClass.map(c=><article key={c.grade+":"+c.class}>
        <div className="home-class-title"><b>Lớp {c.class}</b><span>{nf.format(c.total)} học sinh</span></div>
        <div className="home-class-meals">{MEALS.map(meal=><span key={meal}>{shortLabels[meal]}<b>{nf.format(c[meal])}<small>/{nf.format(c.total)}</small></b></span>)}</div>
      </article>) : <p>Chưa có lớp đang hoạt động.</p>}</div>
    </details>
  </div>;
}
