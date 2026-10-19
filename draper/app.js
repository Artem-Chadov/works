/* DRAPER concept: local selection and text preparation; no data submission. */
(() => {
  'use strict';
  const models = {
    lamas: {name:'Ламас',size:'140 × 200',image:'lamas-640.webp'},
    plush: {name:'Плюш',size:'90 × 180',image:'plush-640.webp'},
    ralf: {name:'Ральф',size:'90 × 200',image:'ralf-640.webp'}
  };
  const qs = (s, root=document) => root.querySelector(s);
  const qsa = (s, root=document) => [...root.querySelectorAll(s)];
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  const canHover = window.matchMedia('(hover: hover) and (pointer: fine)');
  const motion = () => window.gsap && !reduce.matches;
  const currentModel = qs('[data-current-model]')?.dataset.currentModel || null;
  let lastTrigger = null;
  let scrollBeforeDialog = 0;

  function openDialog(dialog, trigger) {
    qsa('dialog[open]').forEach(d => d.close());
    lastTrigger = trigger?.closest('#menuDialog') ? qs('.menu-toggle') : (trigger || document.activeElement);
    scrollBeforeDialog = window.scrollY;
    document.body.classList.add('modal-open');
    dialog.showModal();
    if (motion()) gsap.fromTo(qs('.dialog-surface',dialog) || qs('.photo-dialog-surface',dialog),
      {x:dialog.id==='photoDialog'?0:22,opacity:.65},
      {x:0,opacity:1,duration:.32,ease:'power3.out',overwrite:true,clearProps:'transform,opacity'});
  }
  function closeDialog(dialog) { if (dialog?.open) dialog.close(); }
  qsa('dialog').forEach(dialog => {
    dialog.addEventListener('keydown', e => {
      if(e.key!=='Tab') return;
      const focusable=qsa('a[href],button,input,select,textarea,[tabindex]',dialog)
        .filter(el=>!el.disabled&&el.tabIndex>=0&&el.getClientRects().length&&getComputedStyle(el).visibility!=='hidden');
      if(!focusable.length){e.preventDefault();dialog.focus();return;}
      const first=focusable[0],last=focusable[focusable.length-1];
      const current=document.activeElement;
      if(e.shiftKey&&(current===first||!focusable.includes(current))){e.preventDefault();last.focus();}
      else if(!e.shiftKey&&(current===last||!focusable.includes(current))){e.preventDefault();first.focus();}
    });
    dialog.addEventListener('close', () => {
      if (!qs('dialog[open]')) {
        document.body.classList.remove('modal-open');
        window.scrollTo({top:scrollBeforeDialog,behavior:'instant'});
        if (lastTrigger?.isConnected) lastTrigger.focus({preventScroll:true});
      }
    });
    dialog.addEventListener('click', e => {if(e.target===dialog) {
      const r=dialog.getBoundingClientRect();
      if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom) closeDialog(dialog);
    }});
  });
  qsa('[data-close]').forEach(b=>b.addEventListener('click',()=>closeDialog(b.closest('dialog'))));
  qsa('[data-open]').forEach(b=>b.addEventListener('click',()=>openDialog(document.getElementById(b.dataset.open),b)));
  qsa('[data-close-link]').forEach(link=>link.addEventListener('click',e=>{
    e.preventDefault();
    const target=qs(link.getAttribute('href'));
    closeDialog(link.closest('dialog'));
    requestAnimationFrame(()=>requestAnimationFrame(()=>target?.scrollIntoView({behavior:reduce.matches?'instant':'smooth'})));
  }));

  // Keep each product's link meaningful and preserve the visitor's catalog selection.
  const grid=qs('#productGrid');
  const safeStorage={get(k){try{return sessionStorage.getItem(k)}catch{return null}},set(k,v){try{sessionStorage.setItem(k,v)}catch{}}};
  if(!grid){const previous=safeStorage.get('draper-catalog');if(previous)qsa('[data-catalog-link]').forEach(a=>a.href='index.html'+previous);}
  else {
    const cards=qsa('.product-card',grid);
    const allowedSize=new Set(['90x180','90x200','140x200']);
    const allowedBase=new Set(['plywood','lift']);
    const allowedSort=new Set(['default','price-asc','price-desc']);
    let state={size:new Set(),base:new Set(),sort:'default'};
    const labels={'90x180':'90 × 180 см','90x200':'90 × 200 см','140x200':'140 × 200 см',plywood:'Фанерное основание',lift:'Подъёмный механизм'};
    const readURL=()=>{
      const p=new URLSearchParams(location.search);
      state={size:new Set((p.get('size')||'').split(',').filter(x=>allowedSize.has(x))),base:new Set((p.get('base')||'').split(',').filter(x=>allowedBase.has(x))),sort:allowedSort.has(p.get('sort'))?p.get('sort'):'default'};
    };
    function applyFilter(push=false) {
      qsa('.filter-options input').forEach(i=>i.checked=state[i.name].has(i.value));
      qs('#sort').value=state.sort;
      let visible=cards.filter(c=>(!state.size.size||state.size.has(c.dataset.size))&&(!state.base.size||state.base.has(c.dataset.base)));
      const ordered=[...cards].sort((a,b)=>state.sort==='default'?cards.indexOf(a)-cards.indexOf(b):(Number(a.dataset.price)-Number(b.dataset.price))*(state.sort==='price-desc'?-1:1));
      ordered.forEach((card,index)=>{card.style.order=index;card.hidden=!visible.includes(card);});
      const help=qs('.help-tile');help.style.order=cards.length;help.hidden=visible.length!==3;
      const count=visible.length;
      qs('#resultCount').textContent=count+' '+(count===1?'модель':count>1&&count<5?'модели':'моделей');
      qs('#emptyState').hidden=count!==0;
      qs('.catalog-note').hidden=count===0;
      qs('#applyFilters').querySelector('.btn-label').textContent='Показать '+count+' '+(count===1?'модель':count>1&&count<5?'модели':'моделей');
      const active=qs('#activeFilters');active.replaceChildren();
      for(const group of ['size','base'])for(const value of state[group]){
        const button=document.createElement('button');button.className='filter-chip';button.setAttribute('aria-label','Убрать фильтр: '+labels[value]);
        const text=document.createElement('span');text.textContent=labels[value];button.append(text);
        const cross=document.createElement('span');cross.textContent='×';cross.setAttribute('aria-hidden','true');button.append(cross);
        button.addEventListener('click',()=>{const hadFocus=document.activeElement===button;state[group].delete(value);applyFilter(true);if(hadFocus)(qs('.filter-chip')||qs('.filter-toggle')||qs('#sort')).focus({preventScroll:true});});active.append(button);
      }
      const badge=qs('#filterBadge');const selected=state.size.size+state.base.size;badge.hidden=!selected;badge.textContent=selected;
      const params=new URLSearchParams();if(state.size.size)params.set('size',[...state.size].join(','));if(state.base.size)params.set('base',[...state.base].join(','));if(state.sort!=='default')params.set('sort',state.sort);
      const search=params.toString()?'?'+params.toString():'';
      if(push)history.pushState(null,'',location.pathname+search);
      safeStorage.set('draper-catalog',search);
      if(push&&motion()&&visible.length)gsap.fromTo(visible,{opacity:.65,y:5},{opacity:1,y:0,duration:.2,stagger:.025,overwrite:true,clearProps:'transform,opacity'});
    }
    qsa('.filter-options input').forEach(i=>i.addEventListener('change',()=>{i.checked?state[i.name].add(i.value):state[i.name].delete(i.value);applyFilter(true);}));
    qsa('[data-reset]').forEach(b=>b.addEventListener('click',()=>{state.size.clear();state.base.clear();applyFilter(true);}));
    qs('#sort').addEventListener('change',e=>{state.sort=e.target.value;applyFilter(true);});
    window.addEventListener('popstate',()=>{readURL();applyFilter();});
    readURL();applyFilter();
    qs('.main-nav [data-catalog-link]')?.setAttribute('aria-current','page');
  }

  // Demonstration only, as requested: no fetch, mail, clipboard or persistent contact storage.
  const request=qs('#requestDialog');
  const form=qs('#requestForm');
  const contact=qs('#requestContact');
  const note=qs('#requestNote');
  const consent=qs('#requestConsent');
  let selectedModel=null,visitMode=false,formTitle='';
  let activeDraft=null;
  const drafts=new Map();

  function fieldError(id,text){const el=qs('#'+id);el.textContent=text;el.hidden=!text;}
  function setContactType(type){
    const phone=type==='phone';
    contact.type=phone?'tel':'email';contact.inputMode=phone?'tel':'email';
    contact.autocomplete=phone?'tel':'email';contact.maxLength=phone?40:120;
    contact.placeholder=phone?'+7 900 123-45-67':'name@example.ru';
    qs('#contactLabel').textContent=phone?'Ваш телефон':'Ваша почта';
    contact.removeAttribute('aria-invalid');fieldError('contactError','');
  }
  function contactError(){
    const value=contact.value.trim();
    if(!value)return 'Укажите контакт, по которому можно ответить.';
    const type=form.elements.contactType.value;
    if(type==='phone'){
      const digits=value.replace(/\D/g,'');
      if(!/^[+\d\s()\-]+$/.test(value)||digits.length<7||digits.length>15)return 'Проверьте номер: нужно от 7 до 15 цифр.';
    }else if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)||value.length>120)return 'Укажите почту в формате name@example.ru.';
    return '';
  }
  function validateContact(){const error=contactError();fieldError('contactError',error);if(error)contact.setAttribute('aria-invalid','true');else contact.removeAttribute('aria-invalid');return !error;}
  function remember(){
    if(!activeDraft)return;
    const type=form.elements.contactType.value;
    drafts.set(activeDraft,{type,contact:contact.value,note:note.value,consent:consent.checked,phoneValue:contact.dataset.phoneValue||'',emailValue:contact.dataset.emailValue||'',[type+'Value']:contact.value});
  }
  function showForm(){
    qs('#requestFields').hidden=false;qs('#requestSuccess').hidden=true;
    qs('#requestTitle').textContent=formTitle;
    qs('#formStatus').textContent='';
  }
  function updateCounter(){qs('#noteCount').textContent=note.value.length+' / 800';}
  function openRequest(key,trigger){
    remember();
    const next=key==='selection'?null:(key==='visit'?currentModel:key.replace('visit:',''));
    selectedModel=models[next]?next:null;visitMode=key.startsWith('visit');
    activeDraft=key;
    const saved=drafts.get(key)||{type:'phone',contact:'',note:'',consent:false};
    form.elements.contactType.value=saved.type;setContactType(saved.type);
    contact.dataset.previousType=saved.type;
    contact.dataset.phoneValue=saved.phoneValue||'';contact.dataset.emailValue=saved.emailValue||'';
    contact.value=saved.contact;note.value=saved.note;consent.checked=saved.consent;
    fieldError('consentError','');consent.removeAttribute('aria-invalid');updateCounter();
    const m=models[selectedModel];
    qs('#requestModelLabel').textContent=m?'Выбранная модель':'Ваш запрос';
    qs('#requestModel').textContent=m?m.name:(visitMode?'Визит в салон':'Подбор кровати');
    qs('#requestSize').textContent=m?m.size+' см':(visitMode?'ОТК «Тандем», Владимир':'Размер, форма и ваши пожелания');
    qs('#requestImage').src='assets/'+(m?.image||'lamas-640.webp');qs('#requestImage').hidden=!m;
    formTitle=visitMode?'Договоримся о визите':(m?'Уточним детали':'Поможем выбрать кровать');
    qs('#noteLabel').textContent=visitMode?'Когда хотите приехать?':(m?'Что хотите уточнить?':'Какая кровать нужна?');
    note.placeholder=visitMode?'Удобный день и что хотите посмотреть':(m?'Например, другой размер или обивку':'Размер спального места, форма и что для вас важно');
    qs('#noteHelper').textContent=m?'Модель и размер добавим автоматически.':(visitMode?'Укажите удобное время и пожелания к визиту.':'Можно указать размер и описать пожелания.');
    showForm();openDialog(request,trigger);
  }
  qsa('[data-request]').forEach(button=>button.addEventListener('click',()=>openRequest(button.dataset.request,button)));
  qsa('input[name="contactType"]',form).forEach(input=>input.addEventListener('change',()=>{
    // Keep a separate contact per type while the visitor edits this short form.
    const previous=contact.dataset.previousType||'phone';
    contact.dataset[previous+'Value']=contact.value;
    setContactType(input.value);contact.value=contact.dataset[input.value+'Value']||'';
    contact.dataset.previousType=input.value;remember();
  }));
  contact.addEventListener('blur',()=>{if(contact.value.trim())validateContact();});
  contact.addEventListener('input',()=>{
    if(contact.getAttribute('aria-invalid')==='true'){fieldError('contactError','');contact.removeAttribute('aria-invalid');}
    remember();
  });
  note.addEventListener('input',()=>{updateCounter();remember();});
  consent.addEventListener('change',()=>{if(consent.checked){fieldError('consentError','');consent.removeAttribute('aria-invalid');}remember();});
  form.addEventListener('submit',event=>{
    event.preventDefault();
    const valid=validateContact();
    const consentValid=consent.checked;
    fieldError('consentError',consentValid?'':'Подтвердите, что можно связаться с вами по заявке.');
    if(!consentValid)consent.setAttribute('aria-invalid','true');else consent.removeAttribute('aria-invalid');
    if(!valid||!consentValid){qs('#formStatus').textContent='Проверьте отмеченные поля.';(!valid?contact:consent).focus();return;}
    remember();
    const m=models[selectedModel];
    qs('#successModel').textContent=m?(visitMode?'Визит: ':'')+'«'+m.name+'», '+m.size+' см':(visitMode?'Визит в салон':'Помощь с выбором кровати');
    qs('#successContact').textContent=contact.value.trim();
    qs('#successNote').textContent=note.value.trim();qs('#successNoteRow').hidden=!note.value.trim();
    qs('#requestFields').hidden=true;qs('#requestSuccess').hidden=false;
    qs('#requestTitle').textContent='Пример заявки';
    qs('#successTitle').focus({preventScroll:true});request.scrollTop=0;
  });
  qs('#editRequest').addEventListener('click',()=>{showForm();contact.focus({preventScroll:true});request.scrollTop=0;});
  request.addEventListener('close',remember);
  qs('#submitRequest').disabled=false;


  const mainImage=qs('#mainImage');
  qsa('[data-gallery]').forEach(b=>b.addEventListener('click',()=>{
    mainImage.src=b.dataset.gallery;
    qs('.main-image-button').dataset.galleryOpen=b.dataset.gallery;
    qsa('[data-gallery]').forEach(t=>{const active=t===b;t.classList.toggle('selected',active);t.setAttribute('aria-pressed',active);});
    if(motion())gsap.fromTo(mainImage,{opacity:.6},{opacity:1,duration:.23,overwrite:true,clearProps:'opacity'});
  }));
  qsa('[data-gallery-open]').forEach(b=>b.addEventListener('click',()=>{
    const dialog=qs('#photoDialog');if(!dialog)return;
    qs('#largePhoto').src=b.dataset.galleryOpen;
    qs('#largePhoto').alt=(mainImage?.alt||'Фотография модели')+(b.dataset.galleryOpen.includes('detail')?' — деталь изголовья':'');
    openDialog(dialog,b);
  }));

  if(window.gsap){
    const mm=gsap.matchMedia();
    mm.add({reduced:'(prefers-reduced-motion: reduce)',normal:'(prefers-reduced-motion: no-preference)',hover:'(hover: hover) and (pointer: fine)'},context=>{
      if(context.conditions.reduced){gsap.killTweensOf('.product-photo img,.photo-action,.btn-fill,.btn-icon svg,.dialog-surface,.main-image,.faq-plus,.product-card');gsap.set('.product-photo img,.photo-action,.dialog-surface,.main-image,.product-card',{clearProps:'transform,opacity'});gsap.set('.btn-fill',{scale:0});return;}
      const cleanups=[];
      const listen=(el,event,fn)=>{el.addEventListener(event,fn);cleanups.push(()=>el.removeEventListener(event,fn));};
      if(context.conditions.hover){
        qsa('.btn').forEach(button=>{
          const fill=qs('.btn-fill',button),icon=qs('.btn-icon svg',button);let arrowTL;
          listen(button,'pointerenter',()=>{
            gsap.to(fill,{scale:1,duration:.4,ease:'power2.out',overwrite:true});
            arrowTL?.kill();arrowTL=gsap.timeline().to(icon,{x:16,y:-16,duration:.12,ease:'power1.in'}).set(icon,{x:-16,y:16}).to(icon,{x:0,y:0,duration:.22,ease:'power2.out'});
          });
          listen(button,'pointerleave',()=>{gsap.to(fill,{scale:0,duration:.28,ease:'power2.out',overwrite:true});arrowTL?.kill();gsap.to(icon,{x:0,y:0,duration:.2,overwrite:true});});
        });
        qsa('.product-link').forEach(link=>{
          const image=qs('.product-photo>img',link),label=qs('.photo-action',link);
          const enter=()=>{gsap.to(image,{scale:1.025,duration:.45,ease:'power2.out',overwrite:true});gsap.to(label,{opacity:1,y:0,duration:.25,ease:'power2.out',overwrite:true});};
          const leave=()=>{gsap.to(image,{scale:1,duration:.4,ease:'power2.out',overwrite:true});gsap.to(label,{opacity:0,y:12,duration:.2,overwrite:true});};
          listen(link,'pointerenter',enter);listen(link,'pointerleave',leave);listen(link,'focus',enter);listen(link,'blur',leave);
        });
      }
      qsa('.product-questions details').forEach(d=>listen(d,'toggle',()=>gsap.to(qs('.faq-plus',d),{rotation:d.open?45:0,duration:.2,overwrite:true})));
      return ()=>{cleanups.forEach(fn=>fn());gsap.set('.product-photo img,.photo-action,.btn-icon svg,.dialog-surface,.main-image,.product-card',{clearProps:'transform,opacity'});};
    });
  }
  document.documentElement.dataset.ready='true';
})();
