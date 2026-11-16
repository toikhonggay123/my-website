/*
 * Sự kiện có thời hạn: "Lời chúc 20/11".
 * Đặt <script src="/su-kien/loi-chuc-20-11.js"></script> ngay sau thẻ <body>.
 * Dải thông báo tự biến mất sau 18:00 ngày 17/11/2026 (giờ Việt Nam).
 * Hết sự kiện thì có thể xoá thẻ script và tệp này.
 */
(() => {
 const END = Date.parse('2026-11-17T18:00:00+07:00');
 const LINK = '/loi-chuc-20-11';
 const DISMISS_KEY = 'afyllx-event-loi-chuc-20-11';
 const anchor = document.currentScript;

 if (!anchor || Date.now() >= END) return;
 try { if (sessionStorage.getItem(DISMISS_KEY) === '1') return; } catch { /* vẫn hiện nếu storage bị chặn */ }

 const css = `
.evt{--evt-a:#123c9c;--evt-b:#2b6ef0;--evt-c:#f1a877;position:relative;isolation:isolate;overflow:hidden;color:#fff;
 background:linear-gradient(100deg,var(--evt-a) 0%,var(--evt-b) 58%,#5d8ff5 78%,var(--evt-c) 100%);font-family:'Be Vietnam Pro',system-ui,sans-serif}
:root[data-theme=dark] .evt{--evt-a:#0d2a6e;--evt-b:#1d4fb8;--evt-c:#b9734a}
.evt::before{content:"";position:absolute;z-index:-1;inset:-60% -10% auto auto;width:46vmax;aspect-ratio:1;border-radius:50%;
 background:radial-gradient(closest-side,#ffd2b0aa,transparent 70%)}
.evt::after{content:"";position:absolute;z-index:-1;inset:0;background:
 radial-gradient(circle at 18% 30%,#ffffff55 0 1.5px,transparent 2px),radial-gradient(circle at 63% 72%,#ffffff40 0 1px,transparent 1.5px),
 radial-gradient(circle at 41% 18%,#ffffff40 0 1px,transparent 1.5px),radial-gradient(circle at 86% 40%,#ffffff60 0 1.5px,transparent 2px)}
.evt-in{max-width:1360px;margin-inline:auto;padding:12px clamp(18px,4vw,56px);display:flex;align-items:center;gap:clamp(12px,2vw,28px)}
.evt-plane{flex:none;width:52px;height:40px;animation:evt-fly 1.6s cubic-bezier(.16,1,.3,1) both}
.evt-copy{min-width:0;margin-right:auto;text-decoration:none;color:inherit;display:grid;gap:1px}
.evt-title{font-size:19px;font-weight:800;letter-spacing:-.02em;line-height:1.2;display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.evt-tag{font-size:12px;font-weight:700;letter-spacing:0;padding:2px 9px;border-radius:99px;background:#ffffff26;box-shadow:inset 0 0 0 1px #ffffff4d}
.evt-sub{font-size:14.5px;line-height:1.4;color:#e4edff}
.evt-time{flex:none;display:grid;justify-items:end;gap:3px}
.evt-time small{font-size:12.5px;color:#e4edff}
.evt-clock{display:flex;gap:5px;font-variant-numeric:tabular-nums}
.evt-clock span{display:grid;justify-items:center;min-width:46px;padding:4px 6px 3px;border-radius:10px;background:#0b1f4d40;box-shadow:inset 0 0 0 1px #ffffff33;
 font-size:19px;font-weight:800;line-height:1.05}
.evt-clock i{font-style:normal;font-size:10.5px;font-weight:600;color:#d7e4ff}
.evt-go{flex:none;display:inline-flex;align-items:center;justify-content:center;min-height:46px;padding:0 22px;border-radius:999px;background:#fff;color:#0b1f4d;
 font-weight:800;font-size:15.5px;text-decoration:none;box-shadow:0 10px 24px -10px #0b1f4dcc;transition:transform .25s cubic-bezier(.16,1,.3,1),box-shadow .3s}
.evt-go:hover{transform:translateY(-2px);box-shadow:0 0 0 5px #ffffff3d,0 14px 30px -10px #0b1f4dcc}
.evt-go:focus-visible,.evt-x:focus-visible,.evt-copy:focus-visible{outline:2px solid #fff;outline-offset:3px;border-radius:12px}
.evt-x{flex:none;display:grid;place-items:center;width:36px;height:36px;border-radius:10px;color:#fff;background:transparent;border:0;cursor:pointer;opacity:.8}
.evt-x:hover{opacity:1;background:#ffffff26}
.evt-x svg{width:18px;height:18px}
@keyframes evt-fly{from{opacity:0;transform:translate(-28px,14px) rotate(-8deg)}to{opacity:1;transform:none}}
@media (max-width:860px){
 .evt-in{display:grid;grid-template-columns:auto minmax(0,1fr) auto;row-gap:10px;padding-block:12px 14px}
 .evt-plane{width:42px;height:32px}
 .evt-copy{margin:0}
 .evt-x{grid-column:3;grid-row:1}
 .evt-time{grid-column:1/3;grid-row:2;justify-items:start}
 .evt-go{grid-column:3;grid-row:2;align-self:end;min-height:42px;padding:0 16px;font-size:14.5px}
 .evt-title{font-size:17px}
 .evt-sub{font-size:13.5px}
}
@media (max-width:480px){
 .evt-time{grid-column:1/-1}
 .evt-go{grid-column:1/-1;grid-row:3;width:100%}
 .evt-clock span{min-width:42px;font-size:17px}
}
@media (prefers-reduced-motion:reduce){.evt-plane{animation:none}.evt-go{transition:none}}`;

 const style = document.createElement('style');
 style.textContent = css;
 document.head.append(style);

 const bar = document.createElement('aside');
 bar.className = 'evt';
 bar.setAttribute('aria-label', 'Sự kiện Lời chúc 20/11');
 bar.innerHTML = `
<div class="evt-in">
 <svg class="evt-plane" viewBox="0 0 52 40" fill="none" aria-hidden="true">
  <path d="M2 36c8-2 13-6 17-11" stroke="#fff" stroke-opacity=".7" stroke-width="1.6" stroke-linecap="round" stroke-dasharray="2 4"/>
  <path d="M50 3 17 19l9 4 4 11 20-31Z" fill="#fff"/>
  <path d="M50 3 26 23l4 11" fill="#dbe7ff"/>
  <path d="M50 3 17 19l9 4L50 3Z" fill="#f6d2b8"/>
 </svg>
 <a class="evt-copy" href="${LINK}">
  <span class="evt-title">Lời chúc 20/11 <span class="evt-tag">Sự kiện có hạn</span></span>
  <span class="evt-sub">Ghép ảnh của bạn vào khung tri ân thầy cô, viết lời chúc rồi tải ảnh về</span>
 </a>
 <div class="evt-time" role="timer" aria-live="off">
  <small>Kết thúc lúc 18:00, 17/11/2026</small>
  <div class="evt-clock">
   <span><b data-u="d">0</b><i>ngày</i></span><span><b data-u="h">00</b><i>giờ</i></span><span><b data-u="m">00</b><i>phút</i></span><span><b data-u="s">00</b><i>giây</i></span>
  </div>
 </div>
 <a class="evt-go" href="${LINK}">Tạo ảnh lời chúc</a>
 <button class="evt-x" type="button" aria-label="Ẩn thông báo sự kiện">
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>
 </button>
</div>`;
 anchor.after(bar);

 const units = {};
 bar.querySelectorAll('[data-u]').forEach(el => { units[el.dataset.u] = el; });
 const pad = n => String(n).padStart(2, '0');
 let timer = 0;

 function tick() {
  const left = END - Date.now();
  if (left <= 0) {
   clearInterval(timer);
   bar.remove();
   return;
  }
  const s = Math.floor(left / 1000);
  const days = Math.floor(s / 86400);
  units.d.textContent = days;
  units.d.parentElement.style.display = days ? '' : 'none';
  units.h.textContent = pad(Math.floor((s % 86400) / 3600));
  units.m.textContent = pad(Math.floor((s % 3600) / 60));
  units.s.textContent = pad(s % 60);
 }
 tick();
 timer = setInterval(tick, 1000);

 bar.querySelector('.evt-x').addEventListener('click', () => {
  try { sessionStorage.setItem(DISMISS_KEY, '1'); } catch { /* chỉ ẩn trong lần xem này */ }
  clearInterval(timer);
  bar.remove();
 });
})();
