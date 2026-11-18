import { categories, demoEmail, pages, projects } from './content.mjs';
import { galleryCards, number, views } from './views.mjs';

const main = document.querySelector('main');
const menu = document.querySelector('.menu-toggle');
const navigation = document.querySelector('.navigation');
const lightbox = document.querySelector('.lightbox');
const lightboxImage = new Image();
lightboxImage.id = 'lightbox-image';
const lightboxCredit = document.querySelector('#lightbox-credit');
const motion = matchMedia('(prefers-reduced-motion: reduce)');
const easeOut = 'cubic-bezier(0.23, 1, 0.32, 1)';

let route;
let transition;
let filter = 'All';
let visibleProjects = [];
let lightboxProjects = [];
let photoIndex = 0;
let touchStart;
let toastTimer;
let inquiryValues = {};

const reveal = 'IntersectionObserver' in window ? new IntersectionObserver(entries => {
  for (const entry of entries) {
    if (!entry.isIntersecting) continue;
    entry.target.classList.remove('await-reveal');
    reveal.unobserve(entry.target);
  }
}, { threshold: 0.08 }) : null;

function revealOnScroll() {
  reveal?.disconnect();
  if (!reveal || motion.matches) return;
  const sections = main.querySelectorAll('.home-work, .about-location, .process, .portrait-grid, .page-turn');
  for (const section of sections) {
    if (section.getBoundingClientRect().top < innerHeight + 25) continue;
    section.classList.add('await-reveal');
    reveal.observe(section);
  }
}

function setMenu(open) {
  menu.setAttribute('aria-expanded', String(open));
  navigation.classList.toggle('menu-open', open);
}

function updateGallery(animate = false) {
  const grid = main.querySelector('#project-grid');
  visibleProjects = projects.filter(project => filter === 'All' || project.category === filter);
  grid.dataset.filter = filter;
  grid.innerHTML = galleryCards(visibleProjects);
  main.querySelector('.gallery-count').textContent = `${number(visibleProjects.length)} ảnh`;
  for (const button of main.querySelectorAll('[data-filter]')) {
    button.setAttribute('aria-pressed', String(button.dataset.filter === filter));
  }
  if (animate && !motion.matches) {
    grid.animate([{ opacity: 0.35, transform: 'translateY(8px)' }, { opacity: 1, transform: 'none' }], { duration: 250, easing: easeOut });
  }
}

function render(id, { selectedService, preferSelectedService = false, focus = false, intro = false } = {}) {
  const previousForm = main.querySelector('.inquiry');
  if (previousForm) inquiryValues = Object.fromEntries(new FormData(previousForm));
  route = id;
  main.dataset.page = id;
  main.toggleAttribute('data-intro', intro && id === 'home');
  main.innerHTML = views[id](id === 'work' ? filter : undefined);
  if (id === 'work') updateGallery();
  if (id === 'contact') {
    const form = main.querySelector('.inquiry');
    for (const [name, value] of Object.entries(inquiryValues)) form.elements.namedItem(name).value = value;
    if (selectedService && (preferSelectedService || !Object.hasOwn(inquiryValues, 'service'))) {
      form.elements.service.value = selectedService;
    }
  }
  for (const link of navigation.querySelectorAll('a')) {
    if (link.hash === `#${id}`) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  }
  const label = pages.find(page => page.id === id).label;
  document.title = id === 'home' ? 'Trần Minh Quân — Hồ sơ nhiếp ảnh' : `${label} — Trần Minh Quân`;
  if (focus) {
    const title = main.querySelector('h1');
    title.tabIndex = -1;
    title.focus({ preventScroll: true });
  }
  window.scrollTo({ top: 0, behavior: 'instant' });
  revealOnScroll();
}

function waitForPageImages() {
  const images = [...main.querySelectorAll('img:not([loading="lazy"])')];
  const decoded = Promise.allSettled(images.map(image => image.decode()));
  let timer;
  const deadline = new Promise(resolve => { timer = setTimeout(resolve, 100); });
  return Promise.race([decoded, deadline]).finally(() => clearTimeout(timer));
}

function navigate(id, { push = false, selectedService, focus = true } = {}) {
  if (!Object.hasOwn(views, id)) return;
  const focusedMenuLink = menu.getAttribute('aria-expanded') === 'true' && navigation.contains(document.activeElement);
  setMenu(false);
  if (lightbox.open) lightbox.close();
  if (route === id && !transition) {
    if (selectedService && id === 'contact') main.querySelector('[name="service"]').value = selectedService;
    if (focusedMenuLink) menu.focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: motion.matches ? 'instant' : 'smooth' });
    return;
  }

  if (push && location.hash !== `#${id}`) history.pushState({ selectedService }, '', `#${id}`);
  transition?.animation.skipTransition();
  transition = undefined;
  const update = () => render(id, { selectedService, preferSelectedService: push, focus });

  if (!motion.matches && document.startViewTransition) {
    const current = { id, animation: document.startViewTransition(() => {
      if (transition !== current) return;
      update();
      return waitForPageImages();
    }) };
    transition = current;
    // A newer route can skip this visual while its promises are still pending.
    current.animation.ready.catch(() => {});
    current.animation.finished.then(() => {
      if (transition === current) transition = undefined;
    }).catch(() => {
      if (transition === current) transition = undefined;
    });
    return;
  }

  update();
  if (!motion.matches) {
    main.animate([{ opacity: 0.2, transform: 'translateY(14px)' }, { opacity: 1, transform: 'none' }], { duration: 380, easing: easeOut });
  }
}

function routeFromLocation() {
  const id = location.hash.slice(1);
  return Object.hasOwn(views, id) ? id : 'home';
}

function onHistory() {
  const id = routeFromLocation();
  if (id !== (transition?.id ?? route)) navigate(id, { selectedService: history.state?.selectedService });
}

function showPhoto(animate = true) {
  const project = lightboxProjects[photoIndex];
  lightboxImage.src = `assets/${project.id}.webp`;
  lightboxImage.alt = project.alt;
  document.querySelector('#photo-count').textContent = `${number(photoIndex + 1)} / ${number(lightboxProjects.length)}`;
  document.querySelector('#lightbox-title').textContent = project.title;
  document.querySelector('#lightbox-category').textContent = categories[project.category];
  lightboxCredit.hidden = !project.credit;
  if (project.credit) {
    lightboxCredit.href = project.credit.url;
    lightboxCredit.textContent = `Ảnh minh họa · ${project.credit.author} / Pexels`;
  } else {
    lightboxCredit.removeAttribute('href');
    lightboxCredit.textContent = '';
  }
  if (animate && !motion.matches) {
    lightboxImage.getAnimations().forEach(animation => animation.cancel());
    lightboxImage.animate([{ opacity: 0.3, transform: 'scale(.987)' }, { opacity: 1, transform: 'none' }], { duration: 220, easing: easeOut });
  }
}

function openProject(id) {
  lightboxProjects = route === 'work' ? visibleProjects : route === 'portraits'
    ? projects.filter(project => project.category === 'Portrait')
    : projects.slice(0, 3);
  photoIndex = lightboxProjects.findIndex(project => project.id === id);
  if (photoIndex < 0) return;
  showPhoto(false);
  if (!lightboxImage.isConnected) lightbox.querySelector('.lightbox-frame').append(lightboxImage);
  lightbox.showModal();
}

function stepPhoto(offset) {
  photoIndex = (photoIndex + offset + lightboxProjects.length) % lightboxProjects.length;
  showPhoto();
}

function notify(message) {
  const toast = document.querySelector('.toast');
  clearTimeout(toastTimer);
  toast.textContent = message;
  toast.classList.add('toast-visible');
  toastTimer = setTimeout(() => toast.classList.remove('toast-visible'), 3800);
}

async function copyEmail() {
  try {
    await navigator.clipboard.writeText(demoEmail);
    notify('Đã sao chép địa chỉ email.');
  } catch {
    const email = main.querySelector('[data-example-email]');
    if (!email) return;
    const range = document.createRange();
    range.selectNodeContents(email);
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
    notify('Đã chọn địa chỉ email. Bạn có thể sao chép địa chỉ này.');
  }
}

document.addEventListener('click', event => {
  const link = event.target.closest('a[data-route]');
  if (link && event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) {
    event.preventDefault();
    navigate(link.hash.slice(1), { push: true, selectedService: link.dataset.service });
    return;
  }
  const project = event.target.closest('[data-project]');
  const filterButton = event.target.closest('[data-filter]');
  if (project) openProject(project.dataset.project);
  if (filterButton && filter !== filterButton.dataset.filter) {
    filter = filterButton.dataset.filter;
    updateGallery(true);
  }
  if (event.target.closest('[data-scroll-work]')) {
    const section = document.querySelector('#featured-work');
    section.focus({ preventScroll: true });
    section.scrollIntoView({ behavior: motion.matches ? 'instant' : 'smooth' });
  }
  if (event.target.closest('[data-copy-email]')) void copyEmail();
});

document.querySelector('.skip-link').addEventListener('click', event => {
  event.preventDefault();
  main.focus();
});

menu.addEventListener('click', () => setMenu(menu.getAttribute('aria-expanded') === 'false'));
document.addEventListener('keydown', event => {
  if (event.key !== 'Escape' || menu.getAttribute('aria-expanded') !== 'true') return;
  setMenu(false);
  menu.focus();
});

window.addEventListener('popstate', onHistory);
window.addEventListener('hashchange', onHistory);
matchMedia('(max-width: 850px)').addEventListener('change', () => setMenu(false));

document.querySelector('.lightbox-close').addEventListener('click', () => lightbox.close());
document.querySelector('.previous-photo').addEventListener('click', () => stepPhoto(-1));
document.querySelector('.next-photo').addEventListener('click', () => stepPhoto(1));
lightbox.addEventListener('click', event => {
  if (!event.target.closest('button, a, .lightbox-caption, #lightbox-image')) lightbox.close();
});
lightbox.addEventListener('keydown', event => {
  if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
    event.preventDefault();
    stepPhoto(event.key === 'ArrowLeft' ? -1 : 1);
  }
});
lightboxImage.addEventListener('pointerdown', event => {
  if (event.pointerType !== 'touch') return;
  touchStart = event.clientX;
  lightboxImage.setPointerCapture(event.pointerId);
});
lightboxImage.addEventListener('pointerup', event => {
  if (touchStart === undefined) return;
  const distance = event.clientX - touchStart;
  touchStart = undefined;
  if (Math.abs(distance) > 45) stepPhoto(distance < 0 ? 1 : -1);
});
lightboxImage.addEventListener('pointercancel', () => { touchStart = undefined; });
lightboxImage.addEventListener('lostpointercapture', () => { touchStart = undefined; });

const requiredMessages = {
  name: 'Vui lòng nhập họ và tên.',
  email: 'Vui lòng nhập địa chỉ email.',
  message: 'Vui lòng nhập thông tin dự án.',
};

main.addEventListener('invalid', event => {
  const field = event.target;
  if (!field.closest('.inquiry')) return;
  if (field.validity.valueMissing) field.setCustomValidity(requiredMessages[field.name]);
  else if (field.validity.typeMismatch) field.setCustomValidity('Vui lòng nhập địa chỉ email hợp lệ.');
}, true);

main.addEventListener('input', event => {
  if (event.target.matches('.inquiry input, .inquiry textarea')) event.target.setCustomValidity('');
});

main.addEventListener('submit', event => {
  if (!event.target.matches('.inquiry')) return;
  event.preventDefault();
  const values = new FormData(event.target);
  const name = values.get('name').trim();
  const message = values.get('message').trim();
  if (!name || !message) {
    notify(name ? requiredMessages.message : requiredMessages.name);
    event.target.elements[name ? 'message' : 'name'].focus();
    return;
  }
  notify('Đã thử gửi thành công.');
});

const initialPage = routeFromLocation();
render(initialPage, { intro: true, selectedService: history.state?.selectedService });
