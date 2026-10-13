(() => {
  'use strict';
  document.body.classList.add('js-enabled');
  const qs = (s, root = document) => root.querySelector(s);
  const qsa = (s, root = document) => Array.from(root.querySelectorAll(s));
  const dialogs = qsa('dialog');
  const menu = qs('#site-menu');
  const request = qs('#request-dialog');
  const menuButton = qs('.mobile-menu');
  let returnFocus = null;

  function openDialog(dialog, trigger) {
    dialogs.filter(d => d.open).forEach(d => d.close());
    returnFocus = trigger || document.activeElement;
    dialog.showModal();
    document.body.classList.add('has-dialog');
    if (dialog === menu) menuButton?.setAttribute('aria-expanded', 'true');
  }
  dialogs.forEach(dialog => {
    dialog.addEventListener('keydown', event => {
      if (event.key !== 'Tab') return;
      const targets = qsa('a[href],button,input,select,textarea,summary,[tabindex]',dialog)
        .filter(el => !el.disabled && el.tabIndex >= 0 && !el.closest('[hidden]')
          && el.checkVisibility({checkOpacity:true,checkVisibilityCSS:true}));
      const first = targets[0], last = targets[targets.length - 1];
      if (!first) {event.preventDefault(); return;}
      if (event.shiftKey && (document.activeElement === first || !dialog.contains(document.activeElement))) {
        event.preventDefault(); last.focus();
      } else if (!event.shiftKey && (document.activeElement === last || !dialog.contains(document.activeElement))) {
        event.preventDefault(); first.focus();
      }
    });
    qs('.dialog-close', dialog)?.addEventListener('click', () => dialog.close());
    dialog.addEventListener('click', event => {
      if (event.target !== dialog) return;
      const r = dialog.getBoundingClientRect();
      if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) dialog.close();
    });
    dialog.addEventListener('close', () => {
      if (!dialogs.some(d => d.open)) document.body.classList.remove('has-dialog');
      if (dialog === menu) menuButton?.setAttribute('aria-expanded', 'false');
      if (returnFocus?.isConnected) returnFocus.focus({preventScroll: true});
    });
  });
  menuButton?.addEventListener('click', () => openDialog(menu, menuButton));
  document.addEventListener('click', event => {
    const trigger = event.target.closest('[data-request]');
    if (!trigger) return;
    event.preventDefault();
    const select = qs('[name=service]', request);
    select.value = trigger.dataset.service || document.body.dataset.service || 'remont';
    openDialog(request, trigger);
  });
  const servicesMenu = qs('.nav-services');
  document.addEventListener('click', event => {
    if (servicesMenu && !servicesMenu.contains(event.target)) servicesMenu.open = false;
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && servicesMenu?.open) servicesMenu.open = false;
  });

  function error(field, message) {
    field.setAttribute('aria-invalid', message ? 'true' : 'false');
    const label = qs('#' + field.id + '-error');
    if (label) label.hidden = !message;
  }
  qsa('.enquiry-form').forEach(form => {
    const inputs = qs('.form-inputs', form);
    const result = qs('.form-result', form);
    const object = qs('[name=object]', form);
    const area = qs('[name=area]', form);
    const message = qs('.prepared-message', form);
    const status = qs('.copy-status', form);
    object.addEventListener('change', () => error(object, !object.value));
    area.addEventListener('input', () => error(area, false));
    form.addEventListener('submit', event => {
      event.preventDefault();
      const validObject = !!object.value;
      const validArea = area.validity.valid;
      error(object, !validObject);
      error(area, !validArea);
      if (!validObject || !validArea) {
        (validObject ? area : object).focus();
        return;
      }
      const service = qs('[name=service]', form);
      const name = qs('[name=name]', form).value.trim();
      const notes = qs('[name=notes]', form).value.trim();
      const lines = ['Здравствуйте! Хочу обсудить работы с «СанРемО».', '',
        'Вид работ: ' + service.selectedOptions[0].textContent,
        'Объект: ' + object.value];
      if (area.value) lines.push('Площадь: ' + Number(area.value).toLocaleString('ru-RU') + '\u00a0м²');
      if (notes) lines.push('О\u00a0задаче: ' + notes);
      if (name) lines.push('Меня зовут ' + name + '.');
      lines.push('', 'Подскажите, что\u00a0понадобится для\u00a0расчёта и\u00a0как\u00a0согласовать осмотр?');
      message.value = lines.join('\n');
      inputs.hidden = true;
      result.hidden = false;
      status.textContent = '';
      message.focus({preventScroll: true});
      if (!form.closest('dialog')) result.scrollIntoView({block:'nearest',behavior:'auto'});
    });
    qs('.edit-enquiry', form).addEventListener('click', () => {
      inputs.hidden = false;
      result.hidden = true;
      object.focus({preventScroll:true});
    });
    qs('.copy-enquiry', form).addEventListener('click', async () => {
      try {
        if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
        await navigator.clipboard.writeText(message.value);
        status.textContent = 'Текст скопирован. Откройте Telegram и\u00a0отправьте сообщение.';
      } catch {
        message.focus();
        message.select();
        status.textContent = 'Выделили текст. Скопируйте его\u00a0вручную, затем вставьте в\u00a0Telegram.';
      }
    });
  });

  const portfolio = qs('.portfolio-section .portfolio');
  if (portfolio) {
    const cards = qsa('.project-card', portfolio);
    const buttons = qsa('[data-filter]');
    buttons.forEach(button => button.addEventListener('click', () => {
      const category = button.dataset.filter;
      let count = 0;
      cards.forEach(card => {
        card.hidden = category !== 'all' && card.dataset.category !== category;
        if (!card.hidden) count += 1;
      });
      buttons.forEach(b => b.setAttribute('aria-pressed', b === button ? 'true' : 'false'));
      portfolio.dataset.count = String(count);
      qs('.filter-status').textContent = button.textContent + ': ' + count;
      if (window.ScrollTrigger) ScrollTrigger.refresh();
    }));
  }
  const gallery = qs('#gallery-dialog');
  const galleryImage = qs('#gallery-image');
  const prev = qs('.gallery-prev');
  const next = qs('.gallery-next');
  let pictures = [], pictureIndex = 0;
  function showPicture(index) {
    pictureIndex = (index + pictures.length) % pictures.length;
    const p = pictures[pictureIndex];
    galleryImage.src = p.src;
    galleryImage.alt = p.caption;
    qs('#gallery-caption').textContent = p.caption;
    qs('#gallery-counter').textContent = (pictureIndex + 1) + '\u00a0из\u00a0' + pictures.length;
    prev.disabled = next.disabled = pictures.length < 2;
  }
  qsa('.zoom-photo').forEach(anchor => anchor.addEventListener('click', event => {
    event.preventDefault();
    const group = anchor.dataset.gallery;
    const seen = new Set();
    pictures = qsa('.zoom-photo').filter(a => a.dataset.gallery === group).map(a => ({src:a.href,caption:a.dataset.caption || qs('img',a).alt})).filter(p => {
      if (seen.has(p.src)) return false;
      seen.add(p.src); return true;
    });
    showPicture(Math.max(0, pictures.findIndex(p => p.src === anchor.href)));
    openDialog(gallery, anchor);
  }));
  prev.addEventListener('click', () => showPicture(pictureIndex - 1));
  next.addEventListener('click', () => showPicture(pictureIndex + 1));
  gallery.addEventListener('keydown', event => {
    if (event.key === 'ArrowLeft') {event.preventDefault(); showPicture(pictureIndex - 1);}
    if (event.key === 'ArrowRight') {event.preventDefault(); showPicture(pictureIndex + 1);}
  });
  let touchX = null;
  galleryImage.addEventListener('touchstart', e => {touchX = e.changedTouches[0].clientX;},{passive:true});
  galleryImage.addEventListener('touchend', e => {
    const delta = e.changedTouches[0].clientX - touchX;
    if (Math.abs(delta)>70) showPicture(pictureIndex + (delta<0 ? 1 : -1));
    touchX = null;
  },{passive:true});

  if (window.gsap && window.ScrollTrigger) {
    gsap.registerPlugin(ScrollTrigger);
    const mm = gsap.matchMedia();
    mm.add('(prefers-reduced-motion: no-preference)', () => {
      const intro = qs('.hero h1,.service-hero h1,.project-hero h1');
      if (intro) gsap.from(intro,{autoAlpha:.25,y:12,duration:.65,ease:'power2.out',clearProps:'all'});
    });
    mm.add('(min-width: 761px) and (prefers-reduced-motion: no-preference)', () => {
      const steps = qs('.steps-grid');
      if (!steps) return;
      const track = document.createElement('div');
      track.className = 'steps-track'; track.setAttribute('aria-hidden','true');
      const bar = document.createElement('span'); track.append(bar);
      steps.before(track);
      const timeline = gsap.timeline({scrollTrigger:{trigger:steps,start:'top 80%',end:'bottom 30%',scrub:.3}});
      timeline.fromTo(bar,{scaleX:0},{scaleX:1,ease:'none'});
      return () => track.remove();
    });
    document.fonts.ready.then(() => ScrollTrigger.refresh());
    window.addEventListener('load', () => ScrollTrigger.refresh(), {once:true});
  }
})();
