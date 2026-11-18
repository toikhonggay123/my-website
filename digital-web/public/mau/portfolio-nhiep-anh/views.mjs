import { categories, demoEmail, pages, photoCredits, process, projects, services } from './content.mjs';

export const number = n => String(n).padStart(2, '0');

function projectImage(project, eager = false, sizes = '(max-width: 650px) 90vw, 50vw') {
  const src = `assets/${project.id}.webp`;
  const sources = project.previewWidth
    ? ` srcset="assets/${project.id}-preview.webp ${project.previewWidth}w, ${src} ${project.width}w" sizes="${sizes}"`
    : '';
  return `<img src="${src}"${sources} alt="${project.alt}" width="${project.width}" height="${project.height}" decoding="async"${eager ? '' : ' loading="lazy"'}>`;
}

function creditLink(credit) {
  return `<a class="photo-credit" href="${credit.url}" target="_blank" rel="noopener noreferrer">Ảnh minh họa · ${credit.author} / Pexels</a>`;
}

export function galleryCards(items) {
  return items.map((project, index) => `
    <button class="project-card" type="button" data-project="${project.id}">
      <span class="project-image">${projectImage(project, index < 2)}<span class="project-open" aria-hidden="true">↗</span></span>
      <span class="project-info">
        <span class="project-title">${project.title}</span>
        <span class="project-meta"><span class="micro">${categories[project.category]}</span>${project.credit ? '<span class="project-source">Ảnh minh họa</span>' : ''}</span>
      </span>
    </button>`).join('');
}

function pageIndex(id) {
  return number(pages.findIndex(page => page.id === id) + 1);
}

function editorialTitle(id, title, accent, text) {
  const label = pages.find(page => page.id === id).label;
  return `<div class="editorial-title">
    <p class="eyebrow"><span class="pip"></span> ${pageIndex(id)} / ${label}</p>
    <h1 class="display">${title} <em>${accent}</em></h1>
    <p class="editorial-lede">${text}</p>
  </div>`;
}

function turnPage(id) {
  const i = pages.findIndex(page => page.id === id);
  const next = pages[(i + 1) % pages.length];
  return `<a class="page-turn" href="#${next.id}" data-route>
    <span><span class="micro">${i === pages.length - 1 ? 'Quay về' : 'Trang tiếp theo'}</span><span class="turn-title">${next.label}</span></span>
    <span class="round-arrow" aria-hidden="true">↗</span>
  </a>`;
}

function home() {
  return `
  <section class="shell home">
    <div class="folio-line">
      <span class="micro"><span class="pip"></span> Hồ sơ nhiếp ảnh</span>
      <span class="folio-rule"></span>
      <span class="micro folio-edition">Hà Nội, Việt Nam <span></span> 2026</span>
    </div>
    <div class="hero">
      <div class="hero-visual">
        <picture>
          <source media="(max-width: 650px)" srcset="assets/hero-mobile.webp" width="960" height="1135">
          <img src="assets/hero.webp" width="2048" height="1366" fetchpriority="high" alt="Quân mặc áo đen, cầm máy ảnh bên tường bê tông">
        </picture>
      </div>
      <div class="hero-ribbon" aria-hidden="true"></div>
      <div class="hero-copy">
        <p class="hero-kicker micro reveal"><span></span> Trần Minh Quân</p>
        <h1 class="hero-title display" aria-label="Kể chuyện bằng ảnh.">
          <span class="title-line"><span>Kể chuyện</span></span>
          <span class="title-line"><em>bằng ảnh.</em></span>
        </h1>
        <p class="hero-deck reveal">Ghi lại cảm xúc chân thật, ánh sáng<br> và không khí của mỗi khoảnh khắc.</p>
        <a class="primary-button reveal" href="#work" data-route>Khám phá tác phẩm <span aria-hidden="true">↗</span></a>
      </div>
      <div class="hero-index micro"><span></span> 01 / 06</div>
      <button class="hero-peek" type="button" data-project="${projects[0].id}" aria-label="Xem ảnh ${projects[0].title}">
        <span class="peek-image">${projectImage(projects[0], true, '(max-width: 650px) 145px, 220px')}</span>
        <span class="peek-caption micro">${projects[0].title} <span aria-hidden="true">↗</span></span>
      </button>
      <div class="frame-mark mark-top" aria-hidden="true"></div>
      <div class="frame-mark mark-bottom" aria-hidden="true"></div>
    </div>
    <div class="hero-rail">
      <button type="button" class="scroll-link micro" data-scroll-work><span class="mini-arrow" aria-hidden="true">↓</span> Cuộn để khám phá</button>
      <span class="micro rail-role">Nhiếp ảnh gia / Kể chuyện bằng hình ảnh</span>
    </div>
  </section>
  <section class="shell home-work" id="featured-work" tabindex="-1">
    <div class="section-top">
      <div><p class="eyebrow"><span class="pip"></span> Đường phố và đời thường</p><h2 class="display section-title">Ảnh <em>tiêu biểu.</em></h2></div>
      <a class="text-link" href="#work" data-route>Xem thư viện ảnh <span aria-hidden="true">↗</span></a>
    </div>
    <div class="featured-grid">${galleryCards(projects.slice(0, 3))}</div>
    ${turnPage('home')}
  </section>`;
}

function about() {
  return `<article class="shell inner-page">
    <div class="split-editorial reveal">
      <figure class="profile-figure">
        <div class="photo-frame profile-frame"><img src="assets/quan-portrait.webp" alt="Một nhiếp ảnh gia ngồi xem lại máy ảnh bên bức tường" width="1600" height="1067" fetchpriority="high"></div>
        <figcaption>${creditLink(photoCredits.profile)}</figcaption>
      </figure>
      <div class="split-copy">
        ${editorialTitle('about', 'Về', 'tôi.', 'Tôi là Trần Minh Quân, nhiếp ảnh gia kể chuyện bằng hình ảnh tại Hà Nội, Việt Nam.')}
        <p>Tôi chụp chân dung, đường phố, đời thường và hình ảnh thương hiệu. Tôi thích quan sát những cử chỉ nhỏ và vệt sáng thoáng qua tạo nên nét riêng của một khung cảnh quen thuộc.</p>
        <p>Tôi cân nhắc bố cục và dành chỗ cho mọi thứ diễn ra tự nhiên. Dù chụp một người, một con phố đông hay một bộ ảnh thương hiệu, tôi đều tìm nét riêng của nơi chụp và những khoảnh khắc chân thật.</p>
        <a class="text-link" href="#services" data-route>Xem dịch vụ nhiếp ảnh <span aria-hidden="true">↗</span></a>
      </div>
    </div>
    <div class="about-location">
      <figure>
        <div class="photo-frame"><img src="assets/on-location.webp" loading="lazy" alt="Một nhiếp ảnh gia đưa máy lên ngắm trên đường phố" width="1500" height="1000"></div>
        <figcaption>${creditLink(photoCredits.location)}</figcaption>
      </figure>
      <blockquote><span aria-hidden="true">“</span>Một bức ảnh đẹp khiến ta cảm được khoảnh khắc ấy.</blockquote>
    </div>
    ${turnPage('about')}
  </article>`;
}

function work(filter) {
  return `<section class="shell inner-page">
    <div class="reveal">${editorialTitle('work', 'Ảnh', 'tiêu biểu.', 'Góc phố, gương mặt thân quen và những khoảnh khắc thoáng qua trong đời sống Hà Nội.')}</div>
    <div class="gallery-bar reveal">
      <div class="filters" role="group" aria-label="Lọc ảnh theo thể loại">
        ${Object.entries(categories).map(([id, label]) => `<button type="button" class="filter" data-filter="${id}" aria-pressed="${id === filter}">${label}</button>`).join('')}
      </div>
      <span class="micro gallery-count" role="status"></span>
    </div>
    <div class="gallery-grid" id="project-grid"></div>
    ${turnPage('work')}
  </section>`;
}

function portraits() {
  const portraits = projects.filter(project => project.category === 'Portrait');
  return `<section class="shell inner-page">
    <div class="split-editorial portrait-intro reveal">
      <div class="split-copy">
        ${editorialTitle('portraits', 'Chuyện qua', 'chân dung.', 'Chân dung cá nhân và ảnh tạp chí, với ánh sáng tự nhiên và những cử chỉ riêng của mỗi người trước ống kính.')}
        <a class="text-link" href="#contact" data-route data-service="Portrait Photography">Lên lịch chụp chân dung <span aria-hidden="true">↗</span></a>
      </div>
      <div class="portrait-feature">${galleryCards(portraits.slice(0, 1))}</div>
    </div>
    <div class="gallery-grid portrait-grid">${galleryCards(portraits.slice(1))}</div>
    ${turnPage('portraits')}
  </section>`;
}

function servicePage() {
  return `<section class="shell inner-page">
    <div class="reveal">${editorialTitle('services', 'Dịch vụ', 'nhiếp ảnh.', 'Chụp ảnh cho cá nhân, thương hiệu và sự kiện, từ buổi trao đổi đầu tiên đến khi bàn giao bộ ảnh.')}</div>
    <div class="service-layout reveal">
      <div class="service-list">
        ${services.map((service, index) => `
          <details class="service"${index === 0 ? ' open' : ''}>
            <summary><span class="micro service-number">${number(index + 1)}</span><span class="service-title">${service.title}<small class="micro">${service.scope}</small></span><span class="service-toggle" aria-hidden="true"></span></summary>
            <div class="service-content"><p>${service.detail}</p><a class="text-link" href="#contact" data-service="${service.id.replaceAll('&', '&amp;')}" data-route>Trao đổi về dịch vụ <span aria-hidden="true">↗</span></a></div>
          </details>`).join('')}
      </div>
      <figure>
        <div class="photo-frame service-photo"><img src="assets/on-set.webp" alt="Người mẫu ngồi trên ghế cao, nhiếp ảnh gia đang chụp dưới đèn studio" width="1500" height="1125"></div>
        <figcaption>${creditLink(photoCredits.studio)}</figcaption>
      </figure>
    </div>
    <section class="process">
      <h2 class="display section-title">Quy trình <em>làm việc.</em></h2>
      <ol>${process.map(([title, detail], index) => `<li><span class="micro">${number(index + 1)}</span><h3>${title}</h3><p>${detail}</p></li>`).join('')}</ol>
    </section>
    ${turnPage('services')}
  </section>`;
}

function contactPage() {
  return `<section class="shell inner-page contact-page">
    <div class="contact-layout">
      <div class="reveal">
        ${editorialTitle('contact', 'Cùng nhau', 'sáng tạo.', 'Tôi làm việc tại Hà Nội và sẵn sàng nhận dự án tự do, hợp tác sáng tạo hoặc công việc toàn thời gian.')}
        <div class="contact-links">
          <div class="contact-row"><span class="micro">Email mẫu</span><span data-example-email>${demoEmail}</span><button type="button" data-copy-email class="copy-button" aria-label="Sao chép địa chỉ email mẫu">Sao chép</button></div>
        </div>
      </div>
      <form class="inquiry reveal">
        <h2>Chia sẻ về dự án của bạn.</h2>
        <div class="field-pair">
          <label>Họ và tên <input name="name" autocomplete="name" required maxlength="100"></label>
          <label>Email <input type="email" name="email" autocomplete="email" required maxlength="150"></label>
        </div>
        <label>Loại dự án <select name="service">
          <option value="">Chọn dịch vụ</option>
          ${services.map(service => `<option value="${service.id.replaceAll('&', '&amp;')}">${service.title}</option>`).join('')}
          <option value="Other / Collaboration">Dự án khác hoặc hợp tác</option>
        </select></label>
        <label>Thông tin dự án <textarea name="message" rows="5" required maxlength="1500" placeholder="Ý tưởng, thời gian và địa điểm dự kiến"></textarea></label>
        <button type="submit" class="primary-button">Thử gửi yêu cầu <span aria-hidden="true">↗</span></button>
        <p class="form-note">Biểu mẫu chạy ở chế độ xem thử.</p>
      </form>
    </div>
    ${turnPage('contact')}
  </section>`;
}

export const views = { home, about, work, portraits, services: servicePage, contact: contactPage };
