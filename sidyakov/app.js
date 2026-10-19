'use strict';
const menuButton = document.querySelector('.menu-toggle');
const mobileNav = document.querySelector('#mobile-nav');
function closeMenu() { mobileNav.hidden = true; menuButton.setAttribute('aria-expanded', 'false'); }
menuButton.addEventListener('click', () => { const open = menuButton.getAttribute('aria-expanded') !== 'true'; menuButton.setAttribute('aria-expanded', String(open)); mobileNav.hidden = !open; });
mobileNav.addEventListener('click', event => { if (event.target.closest('a')) closeMenu(); });
document.addEventListener('keydown', event => { if (event.key === 'Escape' && !mobileNav.hidden) { closeMenu(); menuButton.focus(); } });

const requestDialog = document.querySelector('#request-dialog');
const galleryDialog = document.querySelector('#gallery-dialog');
const privacyDialog = document.querySelector('#privacy-dialog');
const form = document.querySelector('#request-form');
const result = document.querySelector('#message-result');
const projectPanel = document.querySelector('.selected-project');
const projectLabel = document.querySelector('#selected-project');
const preparedMessage = document.querySelector('#prepared-message');
const copyStatus = document.querySelector('#copy-status');
let selectedProject = '';
let requestTrigger = null;
let galleryTrigger = null;
let previewUrl = '';
let galleryKey = 'breytovo';
let galleryIndex = 0;
let caseIndex = 1;
const galleries = {
  breytovo: { title: 'Берёзовая роща на фасаде', project: 'Берёзовая роща в Брейтовском крае', surface: 'Фасад', photos: [
    { src: 'assets/breytovo-0.webp', alt: 'Осенние берёзы и река на боковом фасаде', caption: 'Боковой фасад с осенним пейзажем' },
    { src: 'assets/breytovo-1.webp', alt: 'Роспись на двух сторонах постройки', caption: 'Рисунок связывает две стороны постройки' },
    { src: 'assets/breytovo-2.webp', alt: 'Пейзаж с берёзами на торцевой стене', caption: 'Торцевой фасад: продолжение берёзовой рощи' },
    { src: 'assets/breytovo-3.webp', alt: 'Настоящие осенние берёзы у воды в Брейтовском крае', caption: 'Местный пейзаж: берёзы у воды из той же поездки художника' }
  ] },
  husky: { title: 'Хаски на воротах', project: 'Хаски на воротах', surface: 'Отдельная поверхность', photos: [
    { src: 'assets/husky-1.webp', alt: 'Два хаски на воротах дачного участка', caption: 'Роспись ворот дачного участка' }
  ] },
  veranda: { title: 'Веранда детского сада', project: 'Веранда детского сада в Рыбинске', surface: 'Фасад', photos: [
    { src: 'assets/veranda-0.webp', alt: 'Роспись веранды детского сада в Рыбинске', caption: 'Персонажи «Барбоскиных» на стенах веранды' },
    { src: 'assets/veranda-1.webp', alt: 'Другой ракурс росписи детской веранды', caption: 'Ещё один ракурс расписанной веранды' }
  ] }
};
function setProject(value) {
  selectedProject = value || '';
  projectLabel.textContent = selectedProject;
  projectPanel.hidden = !selectedProject;
}
function openDialog(dialog, trigger) {
  if (dialog.open) return;
  dialog._trigger = trigger;
  dialog.showModal();
  document.body.classList.add('has-dialog');
  dialog.scrollTop = 0;
}
document.querySelectorAll('dialog').forEach(dialog => {
  dialog.querySelector('[data-close]').addEventListener('click', () => dialog.close());
  dialog.addEventListener('keydown', event => {
    if (event.key !== 'Tab') return;
    const controls = [...dialog.querySelectorAll('button:not([disabled]),a[href],input:not([disabled]):not([type="hidden"]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])')].filter(element => element.getClientRects().length && getComputedStyle(element).visibility !== 'hidden');
    if (!controls.length) { event.preventDefault(); return; }
    const index = controls.indexOf(document.activeElement);
    if (index === -1 || (event.shiftKey && index === 0) || (!event.shiftKey && index === controls.length - 1)) {
      event.preventDefault();
      controls[event.shiftKey ? controls.length - 1 : 0].focus();
    }
  });
  dialog.addEventListener('click', event => {
    if (event.target !== dialog) return;
    const box = dialog.getBoundingClientRect();
    if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) dialog.close();
  });
  dialog.addEventListener('close', () => {
    if (!document.querySelector('dialog[open]')) document.body.classList.remove('has-dialog');
    if (dialog._trigger?.isConnected && !dialog._suppressFocus) dialog._trigger.focus({ preventScroll: true });
    dialog._suppressFocus = false;
  });
});
function showRequest(trigger, project, surface) {
  requestTrigger = trigger || requestTrigger;
  if (project !== undefined) setProject(project);
  if (surface) form.elements.surface.value = surface;
  form.hidden = false;
  result.hidden = true;
  copyStatus.textContent = '';
  closeMenu();
  openDialog(requestDialog, requestTrigger);
  document.querySelector('#request-title').focus();
}
document.querySelectorAll('[data-request]').forEach(button => button.addEventListener('click', () => {
  showRequest(button, button.dataset.project || '', button.dataset.surface);
}));
document.querySelector('#remove-project').addEventListener('click', () => { setProject(''); form.elements.surface.focus(); });
function clearError(input) { input.removeAttribute('aria-invalid'); document.querySelector('#' + input.id + '-error').textContent = ''; }
function fieldError(input, message) { input.setAttribute('aria-invalid', 'true'); document.querySelector('#' + input.id + '-error').textContent = message; }
['place', 'idea'].forEach(name => {
  const input = form.elements[name];
  input.addEventListener('blur', () => { if (input.value.trim()) clearError(input); });
  input.addEventListener('input', () => { if (input.getAttribute('aria-invalid') === 'true' && input.value.trim()) clearError(input); });
});
form.addEventListener('submit', event => {
  event.preventDefault();
  let firstInvalid = null;
  for (const [name, message] of [['place', 'Укажите город или населённый пункт.'], ['idea', 'Опишите задачу или напишите, что идеи пока нет.']]) {
    const input = form.elements[name];
    clearError(input);
    if (!input.value.trim()) { fieldError(input, message); firstInvalid ||= input; }
  }
  if (firstInvalid) { firstInvalid.focus(); return; }
  const lines = ['Григорий, здравствуйте! Хочу обсудить роспись.', '', 'Поверхность: ' + form.elements.surface.value, 'Место: ' + form.elements.place.value.trim()];
  if (form.elements.size.value.trim()) lines.push('Размеры: ' + form.elements.size.value.trim());
  lines.push('Задача: ' + form.elements.idea.value.trim());
  if (selectedProject) lines.push('Понравилась работа: ' + selectedProject);
  if (form.elements.photo.files.length) lines.push('Фотографию стены приложу к сообщению отдельно.');
  preparedMessage.value = lines.join('\n');
  form.hidden = true;
  result.hidden = false;
  copyStatus.textContent = '';
  requestDialog.scrollTop = 0;
  document.querySelector('#message-title').focus();
});
document.querySelector('#back-edit').addEventListener('click', () => {
  form.hidden = false; result.hidden = true; requestDialog.scrollTop = 0;
  form.elements.surface.focus();
});
document.querySelector('#copy-message').addEventListener('click', async event => {
  const button = event.currentTarget;
  if (button.disabled) return;
  button.disabled = true;
  copyStatus.textContent = '';
  const textToCopy = preparedMessage.value;
  try {
    if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
    await navigator.clipboard.writeText(textToCopy);
    copyStatus.textContent = preparedMessage.value === textToCopy ? 'Текст скопирован. Теперь откройте VK и вставьте его в сообщение.' : 'Текст изменён. Скопируйте новую версию.';
  } catch {
    copyStatus.textContent = 'Автоматическое копирование недоступно. Выделите текст выше и скопируйте вручную.';
    preparedMessage.focus(); preparedMessage.select();
  } finally { button.disabled = false; }
});
preparedMessage.addEventListener('input', () => { copyStatus.textContent = 'Текст изменён. Скопируйте новую версию.'; });
const photoInput = document.querySelector('#wall-photo');
const preview = document.querySelector('.photo-preview');
function clearPhoto() {
  if (previewUrl) URL.revokeObjectURL(previewUrl);
  previewUrl = ''; photoInput.value = ''; preview.hidden = true;
  preview.querySelector('img').removeAttribute('src');
  document.querySelector('#photo-error').textContent = '';
  photoInput.removeAttribute('aria-invalid');
}
photoInput.addEventListener('change', async () => {
  if (previewUrl) URL.revokeObjectURL(previewUrl);
  const file = photoInput.files[0];
  preview.hidden = true;
  document.querySelector('#photo-error').textContent = '';
  photoInput.removeAttribute('aria-invalid');
  if (!file) return;
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 10 * 1024 * 1024) {
    photoInput.value = ''; photoInput.setAttribute('aria-invalid', 'true');
    document.querySelector('#photo-error').textContent = 'Выберите JPG, PNG или WebP размером до 10 МБ.'; return;
  }
  const currentUrl = URL.createObjectURL(file); previewUrl = currentUrl;
  const img = preview.querySelector('img'); img.src = currentUrl;
  try { await img.decode(); if (previewUrl === currentUrl) preview.hidden = false; }
  catch { if (previewUrl === currentUrl) { clearPhoto(); photoInput.setAttribute('aria-invalid', 'true'); document.querySelector('#photo-error').textContent = 'Не удалось открыть фото. Выберите другой файл.'; } }
});
document.querySelector('#remove-photo').addEventListener('click', () => { clearPhoto(); photoInput.focus(); });
document.querySelectorAll('[data-case-image]').forEach(button => button.addEventListener('click', () => {
  caseIndex = Number(button.dataset.caseImage);
  const image = galleries.breytovo.photos[caseIndex];
  document.querySelector('#case-image').src = image.src;
  document.querySelector('#case-image').alt = image.alt;
  document.querySelector('#case-caption').textContent = image.caption;
  document.querySelector('.gallery-main').dataset.index = String(caseIndex);
  document.querySelector('.gallery-main').setAttribute('aria-label', 'Открыть фотографию: ' + image.alt);
  document.querySelectorAll('[data-case-image]').forEach(b => b.setAttribute('aria-pressed', String(b === button)));
}));
function renderGallery() {
  const gallery = galleries[galleryKey];
  const photo = gallery.photos[galleryIndex];
  document.querySelector('#gallery-title').textContent = gallery.title;
  document.querySelector('#lightbox-img').src = photo.src;
  document.querySelector('#lightbox-img').alt = photo.alt;
  document.querySelector('#gallery-description').textContent = photo.caption;
  document.querySelector('#gallery-count').textContent = (galleryIndex + 1) + ' из ' + gallery.photos.length;
  document.querySelectorAll('.gallery-arrow').forEach(button => { button.hidden = gallery.photos.length < 2; });
}
document.querySelectorAll('[data-gallery]').forEach(button => button.addEventListener('click', () => {
  galleryKey = button.dataset.gallery;
  galleryIndex = Number(button.dataset.index || 0);
  galleryTrigger = button;
  renderGallery();
  openDialog(galleryDialog, button);
}));
function changePhoto(direction) { const count = galleries[galleryKey].photos.length; galleryIndex = (galleryIndex + direction + count) % count; renderGallery(); }
document.querySelector('.gallery-prev').addEventListener('click', () => changePhoto(-1));
document.querySelector('.gallery-next').addEventListener('click', () => changePhoto(1));
galleryDialog.addEventListener('keydown', event => {
  if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') { event.preventDefault(); changePhoto(event.key === 'ArrowRight' ? 1 : -1); }
});
document.querySelector('#gallery-request').addEventListener('click', () => {
  const gallery = galleries[galleryKey];
  galleryDialog._suppressFocus = true;
  galleryDialog.close();
  showRequest(galleryTrigger, gallery.project, gallery.surface);
});
document.querySelector('[data-privacy]').addEventListener('click', event => openDialog(privacyDialog, event.currentTarget));
document.addEventListener('pointerdown', event => { if (!mobileNav.hidden && !event.target.closest('.site-header')) closeMenu(); });
matchMedia('(min-width:761px)').addEventListener('change', event => { if (event.matches) closeMenu(); });
