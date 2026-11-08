"use client";
import { useState, useEffect, useRef, useMemo } from "react";
import {
  Sun,
  Sunset,
  Moon,
  Users,
  ClipboardCheck,
  Clock3,
  ShieldCheck,
  X,
  ChevronRight,
  Search,
  Plus,
  Download,
  LoaderCircle,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import {
  MEALS,
  LABELS as LABEL_MAP,
  normalize,
  localClock,
} from "@/lib/mealcheck.mjs";
import { parseCsv, readXlsx } from "@/lib/files.mjs";
import { QRScanner, QRStudentCards } from "./qr-panel";
import { StudentDirectory } from "./student-directory";
import { ResetAttendance } from "./reset-attendance";
import { LocalSettings } from "./local-settings";
import { TeacherGuide } from "./teacher-guide";
import { TodayExport, MissingAttendance } from "./daily-attendance";
import { HomeOverview, type HomeBoard } from "./home-overview";
import { readDevicePref, saveDevicePref } from "./offline-store";
import { AppNavigation, Brand, navigationItems } from "./app-navigation";
import { SectionTabs } from "./section-tabs";
import { searchForView, sectionForView, viewFromSearch } from "@/lib/navigation.mjs";
import { MotionPresence, usePageMotion } from "./liquid-motion";
type R = Record<string, any>;
const LABELS: R = LABEL_MAP;
const mealIcons: R = { sang: Sun, trua: Sunset, toi: Moon },
  nf = new Intl.NumberFormat("vi-VN");
const day = (d: string) =>
  new Date(d + "T12:00:00+07:00").toLocaleDateString("vi-VN", {
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "Asia/Ho_Chi_Minh",
  });
const time = (t: number) =>
  new Date(t).toLocaleTimeString("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
async function api(p: string, b?: any): Promise<any> {
  const r = await fetch("/api/" + p, {
      method: b === undefined ? "GET" : "POST",
      cache: "no-store",
      headers: b === undefined ? {} : { "Content-Type": "application/json" },
      body: b === undefined ? undefined : JSON.stringify(b),
    }),
    d: any = await r.json();
  if (!r.ok) throw Error(d.error || "Không kết nối được máy chủ.");
  return d;
}
function Empty({ title, Icon = ClipboardCheck }: any) {
  return (
    <div className="empty">
      <span>
        <Icon size={29} />
      </span>
      <h3>{title}</h3>
    </div>
  );
}
export default function App() {
  const [who, SWho] = useState<R | null>(null),
    [board, SB] = useState<(HomeBoard & R) | null>(null),
    [students, SS] = useState<R[]>([]),
    [directoryClasses, SDirectoryClasses] = useState<R[]>([]),
    [records, SR] = useState<R[]>([]),
    [devices, SD] = useState<R[]>([]),
    [logs, SL] = useState<R[]>([]),
    [tab, ST] = useState("overview"),
    [space, SP] = useState("live"),
    [error, SE] = useState(""),
    [note, SN] = useState(""),
    [busy, SBu] = useState(false);
  const [cardStart,setCardStart]=useState<{grade:string;class:string}|null>(null);
  const [missingStart, setMissingStart] = useState<{meal:string;date:string}|null>(null);
  const pageSurface = useRef<HTMLDivElement>(null);
  const scannerLaunch = useRef(false);
  const preparePageMotion = usePageMotion(pageSurface, tab, scannerLaunch);
  const [query, SQ] = useState(""),
    [grade, SG] = useState(""),
    [cl, SC] = useState(""),
    [meal, SM] = useState(""),
    [date, SDate] = useState(localClock().date),
    [revision, setRevision] = useState(0),
    [from, SF] = useState(localClock().date),
    [to, STo] = useState(localClock().date),
    [edit, SEdit] = useState<R | null>(null);
  const user = who?.user,
    admin = user?.role === "admin",
    publicDemo = !!who?.publicDemo,
    canEditRoster = admin && !publicDemo,
    suffix = "?space=" + space;
  const flash = (s: string) => {
    SN(s);
    setTimeout(() => SN(""), 4500);
  };
  const serverToday=useRef(date);
  function acceptServerDate(next:string){
    if(!/^\d{4}-\d{2}-\d{2}$/.test(next))return;
    const previous=serverToday.current;serverToday.current=next;SDate(next);
    // Follow today across midnight/device clock corrections, preserving an
    // explicitly selected historical date range.
    SF(value=>value===previous?next:value);STo(value=>value===previous?next:value);
  }
  useEffect(()=>{
    const ack=(event:Event)=>{const detail=(event as CustomEvent).detail;if(detail?.space===space&&['recorded','already'].includes(detail.result?.status))acceptServerDate(detail.result.date);};
    window.addEventListener('mealcheck-scan-ack',ack);
    return()=>window.removeEventListener('mealcheck-scan-ack',ack);
  },[space]);
  async function act(fn: () => Promise<any>, message = "") {
    if (busy) return;
    SBu(true);
    SE("");
    try {
      const r = await fn();
      if (message) flash(message);
      return r;
    } catch (e: any) {
      SE(e.message);
    } finally {
      SBu(false);
    }
  }
  async function identity() {
    try {
      const d = await api("identity");
      if (d.publicCloud) SP(d.defaultSpace);
      saveDevicePref("boot", {
        publicCloud: d.publicCloud,
        publicDemo: d.publicDemo,
        defaultSpace: d.defaultSpace,
        deployment: d.deployment,
        user: {
          id: d.user.id,
          role: d.user.role,
          email: "Quản trị trên máy",
          name: "Quản trị trên máy",
        },
      });
      SWho(d);
      ST(viewFromSearch(location.search));
    } catch (e) {
      const cached = readDevicePref("boot", null);
      if ((!navigator.onLine || e instanceof TypeError) && cached) {
        SP(
          cached.publicCloud
            ? cached.defaultSpace
            : readDevicePref("dataSpace", "live"),
        );
        SWho(cached);
        ST(
          new URLSearchParams(location.search).get("tab") === "guide"
            ? "guide"
            : "scanner",
        );
        window.dispatchEvent(new Event("mealcheck-server-offline"));
      } else throw e;
    }
  }
  async function boardLoad() {
    const b = await api("board" + suffix + "&date=" + date);
    SB(b);
    setRevision((n) => n + 1);
  }
  async function rosterLoad() {
    if (navigator.onLine) {
      try {
        const shared=await api("students" + suffix + "&directory=1");
        SS(shared.students);
        SDirectoryClasses(shared.classes);
      } catch (e) {
        if (e instanceof TypeError)
          window.dispatchEvent(new Event("mealcheck-server-offline"));
        else throw e;
      }
    }
  }
  async function recordLoad() {
    SR(
      await api(
        `records${suffix}&from=${from}&to=${to}&meal=${meal}&grade=${encodeURIComponent(grade)}&class=${encodeURIComponent(cl)}`,
      ),
    );
  }
  useEffect(() => {
    void identity().catch((e) => SE(e.message));
    const restoreView = () => ST(viewFromSearch(location.search));
    window.addEventListener("popstate", restoreView);
    return () => window.removeEventListener("popstate", restoreView);
  }, []);
  useEffect(() => {
    if (!user || !["students", "qrcards", "attendance", "missing", "reports"].includes(tab)) return;
    void rosterLoad().catch((e) => SE(e.message));
  }, [user?.id, space, date, tab]);
  useEffect(() => {
    SG("");
    SC("");
    SQ("");
  }, [user?.id, space, date]);
  useEffect(() => {
    if (!user) return;
    if (tab === "settings" && admin)
      void Promise.all([api("devices" + suffix), api("audit" + suffix)])
        .then(([d, a]) => {
          SD(d);
          SL(a);
        })
        .catch((e) => SE(e.message));
  }, [tab, user?.id, space, from, to, meal, grade, cl]);
  useEffect(() => {
    if (!user) return;
    if (!["overview", "attendance", "missing", "reports"].includes(tab)) return;
    let gone = false,
      inFlight = false;
    const controller = new AbortController();
    const refresh = async () => {
      if (document.hidden || !navigator.onLine || inFlight || gone) return;
      inFlight = true;
      try {
        const b = await fetch(
          "/api/board" + suffix + "&date=" + localClock().date,
          { cache: "no-store", signal: controller.signal },
        ).then(async (r) => {
          const d: any = await r.json();
          if (!r.ok) throw Error(d.error);
          return d;
        });
        if (gone || document.hidden) return;
        SB(b);
        window.dispatchEvent(new Event("mealcheck-server-online"));
        acceptServerDate(b.date);
        setRevision((n) => n + 1);
        if (["attendance", "reports"].includes(tab)) {
          const rows = await fetch(
            `/api/records${suffix}&from=${from}&to=${to}&meal=${meal}&grade=${encodeURIComponent(grade)}&class=${encodeURIComponent(cl)}`,
            { cache: "no-store", signal: controller.signal },
          ).then(async (r) => {
            const d: any = await r.json();
            if (!r.ok) throw Error(d.error);
            return d;
          });
          if (!gone && !document.hidden) SR(rows);
        }
      } catch (e: any) {
        if (!gone && e.name !== "AbortError")
          window.dispatchEvent(new Event("mealcheck-server-offline"));
      } finally {
        inFlight = false;
      }
    };
    const visible = () => {
      if (!document.hidden) void refresh();
    };
    void refresh();
    const interval = setInterval(() => void refresh(), 10000);
    const confirmed=(event:Event)=>{if((event as CustomEvent).detail?.space===space)void refresh();};
    document.addEventListener("visibilitychange", visible);
    window.addEventListener('mealcheck-scan-ack',confirmed);
    return () => {
      gone = true;
      controller.abort();
      clearInterval(interval);
      document.removeEventListener("visibilitychange", visible);
      window.removeEventListener('mealcheck-scan-ack',confirmed);
    };
  }, [user?.id, space, tab, from, to, meal, grade, cl]);
  const grades = useMemo(() => Array.from(
    new Set([...students.filter((s) => s.active).map((s) => s.grade),...directoryClasses.map(c=>c.grade)]),
  ).sort((a, b) => a.localeCompare(b, "vi", { numeric: true })),[students,directoryClasses]);
  const classes = useMemo(() => Array.from(
    new Set(
      [...students
        .filter((s) => (!grade || s.grade === grade) && s.active)
        .map((s) => s.class),...directoryClasses.filter(c=>!grade||c.grade===grade).map(c=>c.name)],
    ),
  ).sort((a, b) => a.localeCompare(b, "vi", { numeric: true })),[students,grade,directoryClasses]);
  const filtered = useMemo(() => students.filter(
    (s) =>
      (!grade || s.grade === grade) &&
      (!cl || s.class === cl) &&
      normalize(s.name + " " + s.code).includes(normalize(query)),
  ),[students,grade,cl,query]);
  const visibleRecords = useMemo(() => records.filter(r => normalize(r.name + " " + r.code).includes(normalize(query))),[records,query]);
  const alerts = (
    <>
      {error && (
        <div className="alert" role="alert">
          <AlertCircle size={18} />
          <span>{error}</span>
          <button aria-label="Đóng" onClick={() => SE("")}>
            <X size={17} />
          </button>
        </div>
      )}
      {note && (
        <div className="toast" role="status">
          <CheckCircle2 size={19} />
          {note}
        </div>
      )}
    </>
  );
  const filters = (
    <>
      <label className="search">
        <Search size={18} />
        <input
          aria-label="Tìm học sinh"
          value={query}
          onChange={(e) => SQ(e.target.value)}
          placeholder="Tìm tên hoặc mã học sinh…"
        />
      </label>
      <select
        aria-label="Khối"
        value={grade}
        onChange={(e) => {
          SG(e.target.value);
          SC("");
        }}
      >
        <option value="">Tất cả khối</option>
        {grades.map((g) => (
          <option key={g}>{g}</option>
        ))}
      </select>
      <select aria-label="Lớp" value={cl} onChange={(e) => SC(e.target.value)}>
        <option value="">Tất cả lớp</option>
        {classes.map((c) => (
          <option key={c}>{c}</option>
        ))}
      </select>
    </>
  );
  if (!who)
    return (
      <div className="loading">
        <Brand />
        {error ? (
          <>
            <p>{error}</p>
            <button
              className="secondary"
              onClick={() => void identity().catch((e) => SE(e.message))}
            >
              Thử lại
            </button>
          </>
        ) : (
          <>
            <LoaderCircle className="spin" />
            <p>Đang kết nối AFYLLX Edu CheckIn…</p>
          </>
        )}
      </div>
    );
  if (!user)
    return (
      <div className="loading">
        <Brand />
        <p>Không tải được cấu hình quản trị trên máy.</p>
        <button
          className="secondary"
          onClick={() => void identity().catch((e) => SE(e.message))}
        >
          Thử lại
        </button>
      </div>
    );
  const nav = navigationItems(admin);
  const section = sectionForView(tab);
  const hasSectionTabs = section === "attendance" || (section === "students" && admin);
  const navigate = (id: string) => {
    if (id !== tab) preparePageMotion();
    scannerLaunch.current = tab === "overview" && id === "scanner";
    ST(id);
    if(id!=="qrcards")setCardStart(null);
    if (id !== "missing") setMissingStart(null);
    const search = searchForView(id, location.search);
    if (search !== location.search) window.history.pushState(null, "", location.pathname + search);
    SQ("");
    window.scrollTo({
      top: 0,
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "instant"
        : "smooth",
    });
  };
  const exportUrl = (format: string) =>
    `/api/export${suffix}&from=${from}&to=${to}&meal=${meal}&grade=${encodeURIComponent(grade)}&class=${encodeURIComponent(cl)}&q=${encodeURIComponent(query)}&format=${format}`;
  return (
    <div className={"app-shell " + (tab === "scanner" ? "scanner-page" : tab === "overview" ? "home-page" : "")}>
      <a className="skip-link" href="#main-content">
        Đến nội dung chính
      </a>
      <AppNavigation
        current={tab}
        admin={admin}
        publicDemo={publicDemo}
        onNavigate={navigate}
      />
      <div className="workspace">
        <header className="topbar">
          <div>
            <span>Nhà trường</span>
            <ChevronRight size={14} />
            <b>{nav.find((n) => n.id === section)?.label}</b>
          </div>
        </header>
        <main id="main-content" className="main-content" tabIndex={-1}>
          {alerts}
          {space === "demo" && (
            <div className="demo-banner">
              <ShieldCheck size={17} />
              {publicDemo
                ? "Bản demo công khai · Không nhập thông tin học sinh thật."
                : "Môi trường thử nghiệm · Dữ liệu giả lập tách riêng"}
              {admin && (
                <button
                  disabled={busy}
                  onClick={() =>
                    void act(async () => {
                      await api("seed" + suffix, {});
                      await rosterLoad();
                      await boardLoad();
                    }, "Đã tạo 1.000 học sinh giả lập.")
                  }
                >
                  Tạo 1.000 học sinh
                </button>
              )}
            </div>
          )}
          {tab !== "overview" && (<div className="page-heading">
            <div>
              <h1>
                {
                  (
                    {
                      overview: "Tổng quan hôm nay",
                      scanner: "Quét QR điểm danh",
                      attendance: "Lịch sử điểm danh",
                      students: "Học sinh",
                      reports: "Báo cáo điểm danh",
                      settings: "Cài đặt nhà trường",
                      guide: "Hướng dẫn sử dụng",
                    } as R
                  )[section]
                }
              </h1>
            </div>
            <div className="page-actions">
              <span className="date-chip">
                <Clock3 size={17} />
                {day(date)}
              </span>

            </div>
          </div>)}
          <SectionTabs current={tab} admin={admin} onNavigate={navigate} />
          <div
            ref={pageSurface}
            id="section-panel"
            role={hasSectionTabs ? "tabpanel" : undefined}
            aria-labelledby={hasSectionTabs ? `view-tab-${tab}` : undefined}
            tabIndex={hasSectionTabs ? 0 : undefined}
          >
          {!board && ["overview", "attendance", "missing", "reports"].includes(tab) ? (
            <section className="panel">
              <Empty title="Đang tải dữ liệu…" />
            </section>
          ) : (
            <>
              {tab === "missing" && (
                <MissingAttendance
                  key={space}
                  space={space}
                  revision={revision}
                  initialMeal={missingStart?.meal}
                  initialDate={missingStart?.date}
                />
              )}
              {tab === "guide" && (
                <TeacherGuide
                  onNavigate={navigate}
                />
              )}
              {tab === "scanner" && (
                <QRScanner
                  key={space}
                  space={space}
                  onNavigate={navigate}
                />
              )}
              {tab === "qrcards" && admin && (
                <QRStudentCards key={space} space={space} students={students} initialFilter={cardStart} sample={!!who.sampleRoster||space==='demo'} />
              )}
              {tab === "overview" && board && <HomeOverview board={board} space={space} onScan={()=>navigate("scanner")} onMissing={(meal,date)=>{setMissingStart({meal,date});navigate("missing");}}/>}
              {tab === "students" && (
                <>
                  <div className="toolbar">
                    {canEditRoster && (
                      <>
                        <button
                          className="primary"
                          onClick={() =>
                            SEdit({
                              code: "",
                              name: "",
                              grade: "",
                              class: "",
                              active: 1,
                            })
                          }
                        >
                          <Plus size={17} />
                          Thêm học sinh
                        </button>
                        <label className="secondary file-button">
                          <FileSpreadsheet size={17} />
                          Nhập Excel / CSV
                          <input
                            type="file"
                            accept=".xlsx,.csv"
                            disabled={busy}
                            onChange={(e) => {
                              const f = e.target.files?.[0];
                              e.target.value = "";
                              if (!f) return;
                              void act(async () => {
                                if (f.size > 5_000_000)
                                  throw Error("Tệp tối đa 5 MB.");
                                const rows = f.name
                                  .toLowerCase()
                                  .endsWith(".xlsx")
                                  ? await readXlsx(f)
                                  : parseCsv(await f.text());
                                if (
                                  !["Mã học sinh", "code"].includes(
                                    rows[0]?.[0],
                                  )
                                )
                                  throw Error(
                                    "Cột đầu phải là Mã học sinh. Tiếp theo: Họ tên, Khối, Lớp, Trạng thái.",
                                  );
                                await api("students" + suffix, {
                                  rows: rows
                                    .slice(1)
                                    .filter((r: any[]) => r.some(Boolean))
                                    .map((r: any[]) => ({
                                      code: r[0],
                                      name: r[1],
                                      grade: r[2],
                                      class: r[3],
                                      active: r[4] === "Vô hiệu hóa" ? 0 : 1,
                                    })),
                                });
                                await rosterLoad();
                                await boardLoad();
                              }, "Đã nhập danh sách.");
                            }}
                          />
                        </label>
                      </>
                    )}
                  </div>
                  <StudentDirectory directoryClasses={directoryClasses} students={students} grade={grade} cl={cl} query={query} onQuery={SQ} onGrade={g=>{SG(g);SC("");}} onClass={SC} onCards={(g,c)=>{setCardStart({grade:g,class:c});navigate("qrcards");}} onEdit={SEdit} onToggle={s=>void act(async()=>{await api("students"+suffix,{rows:[{...s,active:s.active?0:1}]});await rosterLoad();await boardLoad();})} busy={busy} editable={canEditRoster} sample={!!who.sampleRoster||space==='demo'}/>
                </>
              )}
              {["attendance", "reports"].includes(tab) && (
                <>
                  <div className="toolbar">
                    <label>
                      Từ ngày
                      <input
                        type="date"
                        value={from}
                        onChange={(e) => SF(e.target.value)}
                      />
                    </label>
                    <label>
                      Đến ngày
                      <input
                        type="date"
                        value={to}
                        onChange={(e) => STo(e.target.value)}
                      />
                    </label>
                    <select
                      aria-label="Buổi"
                      value={meal}
                      onChange={(e) => SM(e.target.value)}
                    >
                      <option value="">Cả ba buổi</option>
                      {MEALS.map((m) => (
                        <option key={m} value={m}>
                          {LABELS[m]}
                        </option>
                      ))}
                    </select>
                    {filters}
                    <a className="secondary" href={exportUrl("csv")}>
                      <Download size={16} />
                      CSV
                    </a>
                    <a className="secondary" href={exportUrl("xlsx")}>
                      <Download size={16} />
                      Excel theo bộ lọc
                    </a>
                    <TodayExport space={space} />
                    {tab === "attendance" && admin && (
                      <ResetAttendance
                        key={space}
                        space={space}
                        onReset={async () => {
                          await Promise.all([recordLoad(), boardLoad()]);
                        }}
                      />
                    )}
                  </div>
                  {tab === "reports" && (
                    <>
                      <div className="period-buttons">
                        {[
                          ["day", "Hôm nay"],
                          ["week", "7 ngày"],
                          ["month", "Tháng này"],
                        ].map(([k, l]) => (
                          <button
                            key={k}
                            onClick={() => {
                              const today = localClock().date;
                              STo(today);
                              SF(
                                k === "day"
                                  ? today
                                  : k === "month"
                                    ? today.slice(0, 8) + "01"
                                    : new Date(
                                        Date.parse(today + "T12:00:00Z") -
                                          6 * 86400000,
                                      )
                                        .toISOString()
                                        .slice(0, 10),
                              );
                            }}
                          >
                            {l}
                          </button>
                        ))}
                      </div>
                      <section className="panel">
                        <div className="panel-heading">
                          <h2>So sánh ba buổi</h2>
                          <small>
                            {from} — {to}
                          </small>
                        </div>
                        <div className="bar-chart">
                          {MEALS.map((m) => {
                            const n = visibleRecords.filter(
                                (r) => r.meal === m,
                              ).length,
                              max = Math.max(
                                1,
                                ...MEALS.map(
                                  (x) =>
                                    visibleRecords.filter((r) => r.meal === x).length,
                                ),
                              ),
                              Icon = mealIcons[m];
                            return (
                              <div key={m}>
                                <b>{nf.format(n)}</b>
                                <div
                                  className={"chart-bar " + m}
                                  style={{
                                    height: `${Math.max(3, (n / max) * 170)}px`,
                                  }}
                                />
                                <span>
                                  <Icon size={17} />
                                  {LABELS[m]}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </section>
                    </>
                  )}
                  <section className="panel">
                    <div className="panel-heading">
                      <h2>
                        {nf.format(
                          visibleRecords.length,
                        )}{" "}
                        lượt được xác nhận
                      </h2>
                    </div>
                    {visibleRecords.length ? (
                      <div className="table-scroll">
                        <table>
                          <thead>
                            <tr>
                              <th>Ngày / Buổi</th>
                              <th>Học sinh</th>
                              <th>Lớp</th>
                              <th>Thời gian</th>
                              <th>Người ghi nhận</th>
                              <th>Trạng thái</th>
                            </tr>
                          </thead>
                          <tbody>
                            {visibleRecords.map((r) => (
                                <tr key={r.seq}>
                                  <td>
                                    <b>{LABELS[r.meal]}</b>
                                    <small>{r.date}</small>
                                  </td>
                                  <td>
                                    <b>{r.name}</b>
                                    <small>{r.code}</small>
                                  </td>
                                  <td>{r.class}</td>
                                  <td>{time(r.confirmed_at)}</td>
                                  <td>{r.teacher}</td>
                                  <td>
                                    <span className="status">Đã xác nhận</span>
                                  </td>
                                </tr>
                              ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <Empty title="Chưa có lượt điểm danh" />
                    )}
                  </section>
                </>
              )}
              {tab === "settings" && admin && (
                <div className="settings-grid">
                  <LocalSettings
                    key={space}
                    devices={devices}
                    busy={busy}
                    onScan={() => navigate("scanner")}
                    onRevoke={(id) =>
                      void act(async () => {
                        await api("devices/revoke" + suffix, { id });
                        SD(await api("devices" + suffix));
                      }, "Đã thu hồi thiết bị.")
                    }
                  />
                  <section className="panel full">
                    <div className="panel-heading">
                      <h2>Nhật ký xử lý</h2>
                      <small>500 hoạt động gần nhất</small>
                    </div>
                    <div className="table-scroll">
                      <table>
                        <thead>
                          <tr>
                            <th>Thời điểm</th>
                            <th>Tài khoản</th>
                            <th>Hành động</th>
                            <th>Kết quả</th>
                          </tr>
                        </thead>
                        <tbody>
                          {logs.map((l) => (
                            <tr key={l.seq}>
                              <td>
                                {new Date(l.at).toLocaleString("vi-VN", {
                                  timeZone: "Asia/Ho_Chi_Minh",
                                })}
                              </td>
                              <td>{l.actor}</td>
                              <td>{l.action}</td>
                              <td className="mono">{l.result}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </section>
                </div>
              )}
            </>
          )}
          </div>
        </main>
      </div>
      <MotionPresence open={!!edit} onDismiss={busy ? undefined : () => SEdit(null)}>
      {edit && (
        <div className="modal-backdrop">
          <form
            className="modal"
            onSubmit={(e) => {
              e.preventDefault();
              void act(async () => {
                await api("students" + suffix, { rows: [edit] });
                SEdit(null);
                await rosterLoad();
                await boardLoad();
              }, "Đã lưu học sinh.");
            }}
          >
            <h2>{edit.id ? "Cập nhật học sinh" : "Thêm học sinh"}</h2>
            {[
              ["code", "Mã học sinh"],
              ["name", "Họ và tên"],
              ["grade", "Khối"],
              ["class", "Lớp"],
            ].map(([k, l]) => (
              <label key={k}>
                {l}
                <input
                  required
                  value={edit[k]}
                  disabled={busy || (!!edit.id && k === "code")}
                  onChange={(e) => SEdit({ ...edit, [k]: e.target.value })}
                />
              </label>
            ))}
            <div className="button-row">
              <button className="primary" disabled={busy}>
                Lưu học sinh
              </button>
              <button
                type="button"
                className="secondary"
                disabled={busy}
                onClick={() => SEdit(null)}
              >
                Hủy
              </button>
            </div>
          </form>
        </div>
      )}
      </MotionPresence>
    </div>
  );
}
