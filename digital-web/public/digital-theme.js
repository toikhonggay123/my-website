(() => {
 const key = 'afyllx-digital-theme';
 const system = matchMedia('(prefers-color-scheme: dark)');
 const root = document.documentElement;
 const meta = document.querySelector('meta[name="theme-color"]');
 let choice;
 let toggle;

 try { choice = localStorage.getItem(key); } catch { /* Vẫn đổi được trong trang hiện tại. */ }

 function applyTheme() {
  const theme = choice === 'light' || choice === 'dark' ? choice : system.matches ? 'dark' : 'light';
  root.dataset.theme = theme;
  const dark = theme === 'dark';
  meta?.setAttribute('content', dark ? '#0a1428' : '#2454c6');
  if (toggle) {
   toggle.setAttribute('aria-pressed', String(dark));
   toggle.title = dark ? 'Chuyển sang chế độ sáng' : 'Chuyển sang chế độ tối';
  }
 }

 // Chạy trước CSS để tải trang với đúng màu đã chọn.
 applyTheme();
 system.addEventListener('change', applyTheme);
 addEventListener('storage', event => {
  if (event.key !== key && event.key !== null) return;
  try {
   if (event.storageArea !== localStorage) return;
   choice = localStorage.getItem(key);
  } catch { return; }
  applyTheme();
 });
 document.addEventListener('DOMContentLoaded', () => {
  toggle = document.querySelector('.theme-toggle');
  applyTheme();
  toggle.hidden = false;
  toggle.addEventListener('click', () => {
   choice = root.dataset.theme === 'dark' ? 'light' : 'dark';
   try { localStorage.setItem(key, choice); } catch { /* Storage có thể bị chặn. */ }
   applyTheme();
  });
 });
})();
