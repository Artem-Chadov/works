(() => {
  'use strict';

  const qs = (selector, root = document) => root?.querySelector(selector) || null;
  const qsa = (selector, root = document) => Array.from(root?.querySelectorAll(selector) || []);
  const NB = '\u00a0';
  const isVisible = element => {
    if (!element?.isConnected || element.closest('[hidden]')) return false;
    if (typeof element.checkVisibility === 'function') {
      try { return element.checkVisibility({checkOpacity: true, checkVisibilityCSS: true}); } catch {}
    }
    const style = getComputedStyle(element);
    return element.getClientRects().length > 0 && style.display !== 'none'
      && style.visibility !== 'hidden' && style.visibility !== 'collapse';
  };
  const focus = element => {
    if (isVisible(element)) element.focus({preventScroll: true});
  };
  const refreshLayout = () => {
    try { window.ScrollTrigger?.refresh(); } catch {}
  };
  const init = (name, callback) => {
    try { return callback(); } catch {
      // Never log a form value or a prepared message.
      console.warn('СанРемО: не удалось подключить компонент ' + name + '.');
      return null;
    }
  };

  function initDialogs() {
    const records = new Map(qsa('dialog').map(dialog => [dialog, {opener: null, suppress: false}]));
    const menuButton = qs('.mobile-menu');
    const sync = () => {
      document.body.classList.toggle('has-dialog', Array.from(records.keys()).some(dialog => dialog.open));
      menuButton?.setAttribute('aria-expanded', qs('#site-menu')?.open ? 'true' : 'false');
    };
    const close = dialog => {
      if (dialog?.open && typeof dialog.close === 'function') dialog.close();
      sync();
    };
    const open = (dialog, trigger) => {
      if (!dialog?.isConnected || typeof dialog.showModal !== 'function') return false;
      if (dialog.open) return true;
      let opener = trigger || document.activeElement;
      const prior = opener?.closest('dialog');
      if (prior?.open && records.get(prior)?.opener) opener = records.get(prior).opener;
      records.forEach((record, current) => {
        if (current.open) {
          record.suppress = true;
          close(current);
        }
      });
      const record = records.get(dialog);
      if (!record) return false;
      record.opener = opener;
      record.suppress = false;
      try { dialog.showModal(); } catch { sync(); return false; }
      sync();
      return true;
    };
    records.forEach((record, dialog) => {
      let backdropPress = false;
      const outside = event => {
        const rect = dialog.getBoundingClientRect();
        return event.clientX < rect.left || event.clientX > rect.right
          || event.clientY < rect.top || event.clientY > rect.bottom;
      };
      dialog.addEventListener('pointerdown', event => {
        backdropPress = event.target === dialog && outside(event);
      });
      dialog.addEventListener('click', event => {
        if (event.target === dialog && backdropPress && outside(event)) close(dialog);
        backdropPress = false;
      });
      qsa('.dialog-close', dialog).forEach(button => button.addEventListener('click', () => close(dialog)));
      dialog.addEventListener('keydown', event => {
        if (event.key !== 'Tab') return;
        const targets = qsa('a[href],button,input,select,textarea,summary,[tabindex]', dialog)
          .filter(element => !element.disabled && element.tabIndex >= 0 && isVisible(element));
        const first = targets[0], last = targets[targets.length - 1];
        if (!first) { event.preventDefault(); focus(dialog); return; }
        if (event.shiftKey && (document.activeElement === first || !dialog.contains(document.activeElement))) {
          event.preventDefault(); focus(last);
        } else if (!event.shiftKey && (document.activeElement === last || !dialog.contains(document.activeElement))) {
          event.preventDefault(); focus(first);
        }
      });
      dialog.addEventListener('close', () => {
        sync();
        // A queued close event from an earlier opening must not disturb a new modal.
        if (dialog.open || Array.from(records.keys()).some(current => current.open)) return;
        if (!record.suppress) focus(record.opener);
        record.suppress = false;
      });
    });
    return {open, close};
  }

  function initMenu(dialogs) {
    const menu = qs('#site-menu');
    const button = qs('.mobile-menu');
    if (menu && button && dialogs) {
      button.addEventListener('click', () => dialogs.open(menu, button));
      qsa('a[href]', menu).forEach(link => link.addEventListener('click', () => {
        if (!link.hasAttribute('data-request')) dialogs.close(menu);
      }));
    }
    qsa('.nav-services').forEach(details => {
      document.addEventListener('click', event => {
        if (!details.contains(event.target)) details.open = false;
      });
      details.addEventListener('focusout', () => {
        requestAnimationFrame(() => {
          if (!details.contains(document.activeElement)) details.open = false;
        });
      });
      document.addEventListener('keydown', event => {
        if (event.key === 'Escape' && details.open) {
          const hadFocus = details.contains(document.activeElement);
          details.open = false;
          if (hadFocus) focus(qs('summary', details));
        }
      });
    });
  }

  const SERVICES = {
    unknown: {phrase: '', hint: 'Опишите задачу своими словами. Если\u00a0знаете район и\u00a0состояние объекта, добавьте их.'},
    remont: {phrase: 'ремонт квартиры', hint: 'Район, состояние квартиры и\u00a0нужные работы.'},
    santehnika: {phrase: 'сантехнические работы', hint: 'Что\u00a0установить, заменить или\u00a0отремонтировать; район объекта.'},
    elektrika: {phrase: 'электромонтажные работы', hint: 'Помещение, оборудование, нужные подключения и\u00a0район.'},
    otdelka: {phrase: 'отделочные работы', hint: 'Стены, пол или\u00a0другие поверхности; размеры, состояние и\u00a0покрытия.'},
    balkony: {phrase: 'остекление и\u00a0ремонт балкона', hint: 'Остекление или\u00a0отделка; что\u00a0установлено сейчас; известные размеры и\u00a0район.'},
    stroitelstvo: {phrase: 'строительство дома или\u00a0бани', hint: 'Участок, дом или\u00a0баня, примерные размеры, наличие проекта и\u00a0нужные этапы.'},
  };
  const serviceId = value => Object.hasOwn(SERVICES, value) ? value : 'unknown';

  function workContext(element) {
    if (!element?.dataset.workId || !element.dataset.workTitle) return null;
    let url = '';
    try {
      const candidate = new URL(element.dataset.workUrl || '', location.href);
      if (element.dataset.workUrl && ['http:', 'https:'].includes(candidate.protocol)) {
        candidate.search = '';
        candidate.hash = '';
        url = candidate.href;
      }
    } catch {}
    return {
      id: element.dataset.workId,
      title: element.dataset.workTitle,
      url,
      task: element.dataset.taskLabel || '',
      service: serviceId(element.dataset.service),
    };
  }
  const contextKey = context => context
    ? [context.id, context.title, context.url, context.task].join('|') : '';

  function parseArea(value) {
    const raw = value.trim();
    if (!raw) return {valid: true, formatted: ''};
    if (!/^(?:\d+(?:[.,]\d+)?|[.,]\d+)$/.test(raw)) return {valid: false};
    const number = Number(raw.replace(',', '.'));
    if (!Number.isFinite(number) || number <= 0) return {valid: false};
    // Format the accepted decimal string without rounding away small surface areas.
    const parts = raw.replace(',', '.').split('.');
    const integer = (parts[0] || '0').replace(/^0+(?=\d)/, '').replace(/\B(?=(\d{3})+(?!\d))/g, NB);
    const fraction = (parts[1] || '').replace(/0+$/, '');
    return {valid: true, formatted: integer + (fraction ? ',' + fraction : '')};
  }

  function initForms() {
    const candidates = qsa('.enquiry-form');
    const views = candidates.map(form => {
      const fields = Object.fromEntries(['service', 'object', 'area', 'name', 'notes']
        .map(name => [name, qs('[name="' + name + '"]', form)]));
      return {form, fields, inputs: qs('.form-inputs', form), result: qs('.form-result', form),
        message: qs('.prepared-message', form), status: qs('.copy-status', form),
        copy: qs('.copy-enquiry', form), edit: qs('.edit-enquiry', form)};
    }).filter(view => Object.values(view.fields).every(Boolean)
      && view.inputs && view.result && view.message && view.status && view.copy && view.edit);
    if (!views.length) return null;
    const initial = views.find(view => !view.form.closest('dialog')) || views[0];
    const labels = select => new Map(Array.from(select.options)
      .filter(option => option.value).map(option => [option.value, option.textContent.trim()]));
    const serviceLabels = labels(initial.fields.service);
    const objectLabels = labels(initial.fields.object);
    const initialContext = workContext(document.body);
    const state = {
      service: serviceId(document.body.hasAttribute('data-service')
        ? document.body.dataset.service : initial.fields.service.value),
      object: initial.fields.object.value,
      area: initial.fields.area.value,
      name: initial.fields.name.value,
      notes: initial.fields.notes.value,
      context: initialContext,
      lastContext: contextKey(initialContext),
      serviceTouched: false,
      mode: 'editing',
      errors: {},
      message: '',
      copyStatus: '',
      copying: false,
      revision: 0,
      copyToken: 0,
    };
    const areaRelevant = () => ['remont', 'otdelka'].includes(state.service)
      && !(state.context && /двер|остеклен|разводк/i.test(state.context.task));
    const invalidate = () => {
      state.revision += 1;
      state.copyToken += 1;
      state.copying = false;
      state.message = '';
      state.copyStatus = '';
      state.mode = Object.keys(state.errors).length ? 'invalid' : 'editing';
    };
    const fieldError = name => {
      if (name === 'object' && !objectLabels.has(state.object)) {
        return 'Выберите объект или\u00a0вариант «Другое / пока не\u00a0знаю».';
      }
      if (name === 'area' && areaRelevant() && !parseArea(state.area).valid) {
        return 'Укажите положительную площадь, например 12,5, или\u00a0оставьте поле пустым.';
      }
      if (name === 'name' && state.name.length > 80) return 'Сократите имя до\u00a080\u00a0символов.';
      if (name === 'notes' && state.notes.length > 1500) return 'Сократите описание до\u00a01500\u00a0символов.';
      return '';
    };
    const validateField = name => {
      const message = fieldError(name);
      if (message) state.errors[name] = message;
      else delete state.errors[name];
    };
    const render = () => {
      const prepared = state.mode === 'prepared';
      views.forEach(view => {
        const {form, fields} = view;
        form.dataset.formState = state.mode;
        form.classList.toggle('has-work-context', !!state.context);
        Object.entries(fields).forEach(([name, field]) => {
          if (field.value !== state[name]) field.value = state[name];
          const error = qs('#' + field.id + '-error', form);
          const text = state.errors[name] || '';
          field.setAttribute('aria-invalid', text ? 'true' : 'false');
          if (error) { error.textContent = text; error.hidden = !text; }
        });
        const areaField = qs('.area-field', form) || fields.area.closest('label');
        if (areaField) areaField.hidden = !areaRelevant();
        fields.area.disabled = !areaRelevant();
        const areaLabel = qs('[data-area-label]', form);
        if (areaLabel) areaLabel.textContent = state.service === 'remont' ? 'Площадь квартиры, м²' : 'Площадь работ, м²';
        const hint = qs('[data-notes-hint]', form);
        if (hint) hint.textContent = SERVICES[state.service].hint;
        qsa('[data-count-for]', form).forEach(counter => {
          const name = counter.dataset.countFor;
          counter.textContent = state[name].length + ' / ' + (name === 'name' ? 80 : 1500);
        });
        const context = qs('.form-work-context', form);
        if (context) {
          context.hidden = !state.context;
          const title = qs('[data-context-title]', context);
          const link = qs('[data-context-link]', context);
          if (title) title.textContent = state.context?.title || '';
          if (link) {
            if (state.context?.url) link.href = state.context.url;
            else link.removeAttribute('href');
          }
        }
        view.inputs.hidden = prepared;
        view.result.hidden = !prepared;
        view.message.value = state.message;
        view.status.textContent = state.copyStatus;
        view.copy.disabled = state.copying || !prepared;
        view.copy.setAttribute('aria-busy', state.copying ? 'true' : 'false');
      });
    };
    const createMessage = () => {
      const phrase = state.context?.task || SERVICES[state.service].phrase;
      const lines = [phrase
        ? 'Добрый день! Хочу обсудить ' + phrase + '.'
        : 'Добрый день! Хочу обсудить работы с\u00a0«СанРемО».'];
      if (state.context) {
        lines.push('', 'Интересует работа «' + state.context.title + '» на\u00a0сайте' + (state.context.url ? ':' : '.'));
        if (state.context.url) lines.push(state.context.url);
        if (state.serviceTouched && state.service !== 'unknown' && state.service !== state.context.service) {
          lines.push('Направление: ' + serviceLabels.get(state.service) + '.');
        }
      }
      lines.push('', 'Объект: ' + objectLabels.get(state.object).toLocaleLowerCase('ru-RU') + '.');
      const area = areaRelevant() ? parseArea(state.area).formatted : '';
      if (area) lines.push((state.service === 'remont' ? 'Площадь квартиры: ' : 'Площадь работ: ') + area + NB + 'м².');
      if (state.notes.trim()) lines.push(state.notes.trim());
      if (state.name.trim()) {
        const name = state.name.trim();
        lines.push('Меня зовут ' + name + (/[.!?…]$/.test(name) ? '' : '.'));
      }
      lines.push('', 'Что\u00a0понадобится для\u00a0расчёта?');
      return lines.join('\n');
    };
    views.forEach(view => {
      const {form, fields} = view;
      const update = event => {
        const field = event.target;
        if (!Object.hasOwn(fields, field.name) || fields[field.name] !== field) return;
        if (field.name === 'service') state.serviceTouched = true;
        const value = field.name === 'service' ? serviceId(field.value) : field.value;
        if (state[field.name] === value) return;
        state[field.name] = value;
        delete state.errors[field.name];
        if (!areaRelevant()) delete state.errors.area;
        invalidate();
        if (field.name === 'object') validateField('object');
        state.mode = Object.keys(state.errors).length ? 'invalid' : 'editing';
        render();
      };
      form.addEventListener('input', update);
      form.addEventListener('change', update);
      ['area', 'name', 'notes'].forEach(name => fields[name].addEventListener('blur', () => {
        validateField(name);
        if (state.mode !== 'prepared') state.mode = Object.keys(state.errors).length ? 'invalid' : 'editing';
        render();
      }));
      form.addEventListener('submit', event => {
        event.preventDefault();
        ['object', 'area', 'name', 'notes'].forEach(validateField);
        if (Object.keys(state.errors).length) {
          invalidate();
          state.mode = 'invalid';
          render();
          const firstInvalid = ['object', 'area', 'name', 'notes'].find(name => state.errors[name]);
          focus(fields[firstInvalid]);
          return;
        }
        state.copyToken += 1;
        state.copying = false;
        state.copyStatus = '';
        state.message = createMessage();
        state.mode = 'prepared';
        render();
        focus(view.message);
        if (!form.closest('dialog')) view.result.scrollIntoView({block: 'nearest', behavior: 'auto'});
      });
      view.edit.addEventListener('click', () => {
        invalidate();
        render();
        focus(fields.service);
      });
      qs('[data-remove-context]', form)?.addEventListener('click', () => {
        state.context = null;
        delete state.errors.area;
        invalidate();
        render();
        focus(fields.service);
      });
      view.copy.addEventListener('click', async () => {
        if (state.mode !== 'prepared' || state.copying) return;
        const token = ++state.copyToken;
        const revision = state.revision;
        const message = state.message;
        state.copying = true;
        state.copyStatus = '';
        render();
        try {
          if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
          await navigator.clipboard.writeText(message);
          if (token !== state.copyToken || revision !== state.revision || state.mode !== 'prepared') return;
          state.copyStatus = 'Текст скопирован. Вставьте его\u00a0в\u00a0Telegram и\u00a0отправьте.';
        } catch {
          if (token !== state.copyToken || revision !== state.revision || state.mode !== 'prepared') return;
          focus(view.message);
          try { view.message.select(); } catch {}
          state.copyStatus = 'Не\u00a0получилось скопировать автоматически. Выделите текст и\u00a0скопируйте его\u00a0вручную.';
        } finally {
          if (token === state.copyToken) { state.copying = false; render(); }
        }
      });
      form.hidden = false;
    });
    render();
    const syncKeyboard = () => {
      const active = document.activeElement;
      const editing = active?.matches('input:not([type="button"]):not([type="submit"]),textarea,[contenteditable="true"]');
      document.body.classList.toggle('has-input-focus', !!editing);
    };
    document.addEventListener('focusin', syncKeyboard);
    document.addEventListener('focusout', () => requestAnimationFrame(syncKeyboard));
    return {
      applyTrigger(trigger) {
        const incoming = workContext(trigger) || workContext(document.body);
        const key = contextKey(incoming);
        const changedContext = incoming && key !== state.lastContext;
        let changed = false;
        if (changedContext) {
          state.context = incoming;
          state.lastContext = key;
          changed = true;
        }
        const explicitService = trigger.hasAttribute('data-service') ? trigger.dataset.service : null;
        if (!state.serviceTouched && (changedContext || explicitService)) {
          const next = serviceId(explicitService === null ? incoming?.service : explicitService);
          if (next !== state.service) { state.service = next; changed = true; }
        }
        if (changed) {
          if (!areaRelevant()) delete state.errors.area;
          invalidate();
          render();
        }
      },
      focusIn(dialog) {
        const view = views.find(item => dialog.contains(item.form));
        if (view) focus(state.mode === 'prepared' ? view.message : view.fields.service);
      },
    };
  }

  function initRequests(dialogs, forms) {
    const dialog = qs('#request-dialog');
    if (!dialog || !dialogs || !forms) return;
    document.addEventListener('click', event => {
      const trigger = event.target.closest?.('[data-request]');
      if (!trigger || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      // Keep the ordinary href when native dialog support is unavailable.
      if (typeof dialog.showModal !== 'function') return;
      forms.applyTrigger(trigger);
      if (dialogs.open(dialog, trigger)) {
        event.preventDefault();
        forms.focusIn(dialog);
      }
    });
  }

  function initFilters() {
    const section = qs('.portfolio-section');
    const portfolio = qs('.portfolio', section);
    if (!portfolio) return;
    const cards = qsa('.project-card', portfolio);
    const buttons = qsa('[data-filter]', section);
    if (!buttons.length) return;
    const aliases = {remont: 'otdelka', stroitelstvo: 'balkony'};
    const category = value => aliases[value] || value;
    const valid = new Set(buttons.map(button => button.dataset.filter));
    const counts = new Map(buttons.map(button => [button.dataset.filter,
      cards.filter(card => button.dataset.filter === 'all' || category(card.dataset.category) === button.dataset.filter).length]));
    buttons.forEach(button => {
      button.dataset.filterLabel = button.dataset.filterLabel || button.textContent.trim();
      let counter = qs('[data-filter-count]', button);
      if (!counter) {
        counter = document.createElement('span');
        counter.className = 'filter-count';
        counter.dataset.filterCount = '';
        counter.setAttribute('aria-hidden', 'true');
        button.append(' ', counter);
      }
      counter.textContent = counts.get(button.dataset.filter);
      button.setAttribute('aria-label', button.dataset.filterLabel + ': ' + counter.textContent);
      button.disabled = button.dataset.filter !== 'all' && counts.get(button.dataset.filter) === 0;
    });
    const read = () => {
      const requested = category(new URL(location.href).searchParams.get('category') || 'all');
      return valid.has(requested) && (requested === 'all' || counts.get(requested)) ? requested : 'all';
    };
    const filterUrl = value => {
      const url = new URL(location.pathname, location.origin);
      if (value !== 'all') url.searchParams.set('category', value);
      return url.pathname + url.search;
    };
    const apply = value => {
      cards.forEach(card => { card.hidden = value !== 'all' && category(card.dataset.category) !== value; });
      buttons.forEach(button => button.setAttribute('aria-pressed', button.dataset.filter === value ? 'true' : 'false'));
      portfolio.dataset.count = String(counts.get(value));
      const displayedCount = counts.get(value);
      qsa('img', portfolio).forEach(image => {
        image.sizes = displayedCount === 1
          ? '(min-width: 1040px) 600px, (min-width: 768px) 46vw, 100vw'
          : displayedCount === 2
            ? '(min-width: 768px) 46vw, 100vw'
            : '(min-width: 1040px) 30vw, (min-width: 768px) 46vw, 100vw';
      });
      const active = buttons.find(button => button.dataset.filter === value);
      const status = qs('.filter-status', section);
      if (status) status.textContent = active.dataset.filterLabel + ': ' + counts.get(value);
      refreshLayout();
    };
    const initial = read();
    apply(initial);
    if (location.pathname + location.search !== filterUrl(initial)) {
      history.replaceState(null, '', filterUrl(initial));
    }
    buttons.forEach(button => button.addEventListener('click', () => {
      const value = button.dataset.filter;
      if (button.disabled) return;
      apply(value);
      if (location.pathname + location.search !== filterUrl(value)) history.pushState(null, '', filterUrl(value));
    }));
    window.addEventListener('popstate', () => apply(read()));
  }

  function initGallery(dialogs) {
    const dialog = qs('#gallery-dialog');
    const stage = qs('.gallery-stage', dialog);
    const image = qs('#gallery-image', dialog);
    const previous = qs('.gallery-prev', dialog);
    const next = qs('.gallery-next', dialog);
    const caption = qs('#gallery-caption', dialog);
    const counter = qs('#gallery-counter', dialog);
    if (!dialogs || !dialog || !stage || !image || !previous || !next || !caption || !counter) return;
    const ensure = (selector, tag, className, parent, text = '') => {
      let element = qs(selector, dialog);
      if (!element) {
        element = document.createElement(tag);
        element.className = className;
        element.textContent = text;
        parent.append(element);
      }
      return element;
    };
    const feedback = ensure('.gallery-feedback', 'div', 'gallery-feedback', stage);
    const status = ensure('.gallery-status', 'p', 'gallery-status', feedback);
    status.setAttribute('role', 'status');
    status.setAttribute('aria-live', 'polite');
    const error = ensure('.gallery-error', 'p', 'gallery-error', feedback);
    error.setAttribute('role', 'alert');
    const actions = ensure('.gallery-error-actions', 'div', 'gallery-error-actions', feedback);
    const retry = ensure('.gallery-retry', 'button', 'gallery-retry btn', actions, 'Повторить');
    const closeError = ensure('.gallery-close-error', 'button', 'gallery-close-error text-button', actions, 'Закрыть');
    retry.type = closeError.type = 'button';
    let pictures = [];
    let index = 0;
    let generation = 0;
    let pendingImage = null;
    let timer = null;
    const stopPending = () => {
      clearTimeout(timer);
      if (pendingImage) pendingImage.onload = pendingImage.onerror = null;
      pendingImage = null;
    };
    const show = (requested, retrying = false) => {
      if (!pictures.length) return;
      stopPending();
      const token = ++generation;
      index = (requested + pictures.length) % pictures.length;
      const picture = pictures[index];
      const focusWouldDisappear = actions.contains(document.activeElement)
        || document.activeElement === retry || document.activeElement === closeError;
      dialog.dataset.galleryState = 'loading';
      stage.setAttribute('aria-busy', 'true');
      image.hidden = true;
      image.removeAttribute('src');
      image.alt = '';
      caption.textContent = '';
      counter.textContent = (index + 1) + NB + 'из' + NB + pictures.length;
      previous.disabled = next.disabled = pictures.length < 2;
      previous.hidden = next.hidden = pictures.length < 2;
      feedback.hidden = false;
      status.hidden = false;
      status.textContent = 'Загружаем фотографию…';
      error.hidden = true;
      error.textContent = '';
      actions.hidden = true;
      retry.hidden = closeError.hidden = true;
      if (focusWouldDisappear) focus(qs('.dialog-close', dialog) || dialog);
      const failed = () => {
        if (token !== generation || !dialog.open) return;
        generation += 1;
        stopPending();
        dialog.dataset.galleryState = 'error';
        stage.setAttribute('aria-busy', 'false');
        status.hidden = true;
        status.textContent = '';
        error.hidden = false;
        error.textContent = 'Не\u00a0удалось загрузить фотографию';
        actions.hidden = false;
        retry.hidden = closeError.hidden = false;
      };
      const loader = new Image();
      pendingImage = loader;
      loader.decoding = 'async';
      loader.onerror = failed;
      loader.onload = async () => {
        try { await loader.decode(); } catch {}
        if (token !== generation || !dialog.open) return;
        if (!loader.naturalWidth) { failed(); return; }
        stopPending();
        image.src = loader.src;
        image.alt = picture.caption;
        image.hidden = false;
        caption.textContent = picture.caption;
        dialog.dataset.galleryState = 'ready';
        stage.setAttribute('aria-busy', 'false');
        feedback.hidden = true;
        status.textContent = '';
      };
      const source = new URL(picture.src);
      if (retrying) source.searchParams.set('_retry', String(Date.now()));
      loader.src = source.href;
      timer = setTimeout(failed, 15000);
    };
    qsa('.zoom-photo').forEach(anchor => anchor.addEventListener('click', event => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const group = anchor.dataset.gallery || '';
      const seen = new Set();
      const candidates = qsa('.zoom-photo').filter(item => (item.dataset.gallery || '') === group);
      pictures = candidates.map(item => ({src: item.href, caption: item.dataset.caption || qs('img', item)?.alt || 'Фотография работы'}))
        .filter(picture => {
          if (seen.has(picture.src) || !/^https?:/.test(picture.src)) return false;
          seen.add(picture.src);
          return true;
        });
      if (!pictures.length || !dialogs.open(dialog, anchor)) return;
      event.preventDefault();
      show(Math.max(0, pictures.findIndex(picture => picture.src === anchor.href)));
    }));
    previous.addEventListener('click', () => show(index - 1));
    next.addEventListener('click', () => show(index + 1));
    retry.addEventListener('click', () => show(index, true));
    closeError.addEventListener('click', () => dialogs.close(dialog));
    dialog.addEventListener('keydown', event => {
      if (event.key === 'ArrowLeft') { event.preventDefault(); show(index - 1); }
      if (event.key === 'ArrowRight') { event.preventDefault(); show(index + 1); }
    });
    dialog.addEventListener('close', () => {
      if (dialog.open) return;
      generation += 1;
      stopPending();
      image.hidden = true;
      image.removeAttribute('src');
    });
    let gesture = null;
    stage.addEventListener('touchstart', event => {
      if (event.touches.length !== 1 || event.target.closest('button,a,input,textarea')) { gesture = null; return; }
      const touch = event.touches[0];
      gesture = {id: touch.identifier, x: touch.clientX, y: touch.clientY};
    }, {passive: true});
    stage.addEventListener('touchend', event => {
      const touch = gesture && Array.from(event.changedTouches).find(item => item.identifier === gesture.id);
      if (touch) {
        const dx = touch.clientX - gesture.x;
        const dy = touch.clientY - gesture.y;
        if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) show(index + (dx < 0 ? 1 : -1));
      }
      gesture = null;
    }, {passive: true});
    stage.addEventListener('touchcancel', () => { gesture = null; }, {passive: true});
  }

  function initAnimation() {
    if (!window.gsap) return;
    if (window.ScrollTrigger) window.gsap.registerPlugin(window.ScrollTrigger);
    const media = window.gsap.matchMedia();
    media.add('(prefers-reduced-motion: no-preference)', () => {
      const title = qs('.hero h1,.service-hero h1,.project-hero h1,.directory-intro h1');
      if (title) window.gsap.from(title, {opacity: .8, y: 8, duration: .4, ease: 'power2.out', clearProps: 'opacity,transform'});
    });
    document.fonts?.ready.then(refreshLayout).catch(() => {});
    window.addEventListener('load', refreshLayout, {once: true});
  }

  document.body.classList.add('js-enabled');
  const dialogs = init('диалоги', initDialogs);
  init('меню', () => initMenu(dialogs));
  const forms = init('форма', initForms);
  init('обращение', () => initRequests(dialogs, forms));
  init('фильтры', initFilters);
  init('галерея', () => initGallery(dialogs));
  init('анимация', initAnimation);
})();
