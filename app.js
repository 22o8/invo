const app = document.getElementById('app');
const printMount = document.getElementById('printMount');
const $ = (selector, root=document) => root.querySelector(selector);

const STORE_V7 = 'invoice_pwa_v7_final_ready';
const STORE_V6 = 'invoice_pwa_v6_mobile_final';
const STORE_V5 = 'invoice_pwa_v5_final';
const STORE_V4 = 'invoice_pwa_v4';

const templateMeta = {
  classic: { name:'كلاسيكي', badge:'التصميم 01', cls:'classic', color:'#0b3b75' },
  green:   { name:'حديث أخضر', badge:'التصميم 02', cls:'green', color:'#128149' },
  luxury:  { name:'فاخر ذهبي', badge:'التصميم 03', cls:'luxury', color:'#d6a739' },
  blue:    { name:'مبسط أزرق', badge:'التصميم 04', cls:'blue', color:'#1d7be8' }
};

const defaultSettings = {
  template:'classic',
  showLogo:false,
  logo:'',
  showUSD:true,
  showIQD:true,
  phone:'+964 770 000 0000',
  email:'info@example.com',
  address:'العراق - بغداد',
  company:'برنامج الفواتير'
};

let state = {
  user:null,
  view:'home',
  draft:null,
  selected:null,
  settings:{...defaultSettings}
};

function loadDB(){
  try{
    const v7 = localStorage.getItem(STORE_V7);
    if(v7) return JSON.parse(v7);
    const v6 = localStorage.getItem(STORE_V6);
    if(v6) return JSON.parse(v6);
    const v5 = localStorage.getItem(STORE_V5);
    if(v5) return JSON.parse(v5);
    const v4 = localStorage.getItem(STORE_V4);
    if(v4){
      const old = JSON.parse(v4);
      return { invoices: old.invoices || [], settings: {...defaultSettings, ...(old.settings || {})} };
    }
  }catch(e){}
  return { invoices:[], settings:{...defaultSettings} };
}
let db = loadDB();
state.settings = {...defaultSettings, ...(db.settings || {})};

function saveDB(){
  db.settings = state.settings;
  localStorage.setItem(STORE_V7, JSON.stringify(db));
  localStorage.setItem(STORE_V6, JSON.stringify(db));
  localStorage.setItem(STORE_V5, JSON.stringify(db));
}

function esc(value){
  return String(value ?? '').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
}
function fmt(value){
  const n = Number(value || 0);
  if(!isFinite(n)) return '0';
  return n.toLocaleString('en-US', { maximumFractionDigits: 2 });
}
function money(usd, iqd, doc){
  const d = doc || getActiveDoc() || state.settings;
  const parts = [];
  if(d.showUSD) parts.push('$' + fmt(usd));
  if(d.showIQD) parts.push(fmt(iqd) + ' دينار عراقي');
  return parts.join(' = ');
}
function templateName(key){ return templateMeta[key]?.name || templateMeta.classic.name; }
function today(){ return new Date().toISOString().slice(0,10); }
function newDocNo(){ return 'INV-' + Math.floor(100000 + Math.random() * 899999); }
function clone(obj){ return JSON.parse(JSON.stringify(obj)); }
function getActiveDoc(){ return state.draft || state.selected; }
function developerFooter(){
  return `<footer class="dev-footer no-print">
    <a class="developer-link" href="https://wa.me/9647704252132" target="_blank" rel="noopener">تواصل مع المطور</a>
  </footer>`;
}

function initDraft(base={}){
  return {
    id:null,
    title:'فاتورة',
    docNo:newDocNo(),
    date:today(),
    to:'',
    items:[{desc:'', usd:'', iqd:''}],
    totalUSD:'', totalIQD:'', paidUSD:'', paidIQD:'', remainUSD:'', remainIQD:'',
    notes:'',
    template:state.settings.template,
    showLogo:state.settings.showLogo,
    logo:state.settings.logo,
    makeLogoDefault:false,
    showUSD:state.settings.showUSD,
    showIQD:state.settings.showIQD,
    ...base
  };
}

function fileToDataURL(file, callback){
  const reader = new FileReader();
  reader.onload = () => callback(reader.result);
  reader.readAsDataURL(file);
}

function login(){
  app.innerHTML = `
    <div class="login">
      <div class="login-card">
        <div class="login-logo"><img src="icon.svg" alt="شعار البرنامج"></div>
        <h1>برنامج الفواتير</h1>
        <p class="small">نسخة ويب + PWA، تعمل على الحاسبة والهاتف وتحفظ الفواتير محلياً.</p>
        <div class="field"><span>اسم المستخدم</span><input id="u" value="l" autocomplete="username"></div>
        <div class="field"><span>الرمز</span><input id="p" type="password" value="123456" autocomplete="current-password"></div>
        <button class="btn primary block" id="loginBtn">دخول</button>
        <p id="loginErr" class="small"></p>
      </div>
      ${developerFooter()}
    </div>`;
  $('#loginBtn').onclick = () => {
    if($('#u').value.trim() === 'l' && $('#p').value === '123456'){
      state.user = 'l';
      render();
    }else{
      $('#loginErr').textContent = 'بيانات الدخول غير صحيحة';
    }
  };
}

function shell(content){
  const title = ({home:'الرئيسية', create:'إنشاء فاتورة جديدة', list:'الفواتير السابقة', settings:'الإعدادات'})[state.view] || 'برنامج الفواتير';
  app.innerHTML = `
    <div class="app">
      <aside class="side no-print">
        <div class="side-brand">
          <div class="side-icon"><img src="icon.svg" alt="شعار البرنامج"></div>
          <div><b>فاتورة بلس</b><span>إدارة الفواتير</span></div>
        </div>
        <div class="nav">
          <button data-view="home">⌂ الرئيسية</button>
          <button data-view="create">▣ إنشاء فاتورة</button>
          <button data-view="list">☷ الفواتير السابقة</button>
          <button data-view="settings">⚙ الإعدادات</button>
          <button id="logoutBtn">↩ تسجيل الخروج</button>
        </div>
        <div class="side-foot">أهلاً بك<br><b>مدير النظام</b><br><a href="https://wa.me/9647704252132" target="_blank" rel="noopener">تواصل مع المطور</a></div>
      </aside>
      <main class="main">
        <div class="topbar no-print">
          <div><h2>${title}</h2><div class="small">التصميم الحالي: ${templateName(state.settings.template)}</div></div>
          <div class="top-actions">
            <button class="btn primary" onclick="startNewInvoice()">+ فاتورة جديدة</button>
            <button class="btn ghost" onclick="state.view='list';render()">عرض السابق</button>
          </div>
        </div>
        <div class="page-content">${content}</div>
        ${developerFooter()}
      </main>
    </div>`;
  document.querySelectorAll('[data-view]').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.view === state.view);
    btn.onclick = () => {
      state.view = btn.dataset.view;
      if(state.view === 'create' && !state.draft) state.draft = initDraft();
      render();
    };
  });
  $('#logoutBtn').onclick = () => { state.user = null; state.draft = null; state.selected = null; render(); };
}

function home(){
  const totalInvoices = db.invoices.length;
  const last = db.invoices[0];
  shell(`
    <div class="cards">
      <div class="stat-card"><span>عدد الفواتير</span><b>${totalInvoices}</b></div>
      <div class="stat-card"><span>آخر فاتورة</span><b style="font-size:18px">${last ? esc(last.docNo) : 'لا يوجد'}</b></div>
      <div class="stat-card"><span>التصميم الافتراضي</span><b style="font-size:18px">${templateName(state.settings.template)}</b></div>
      <div class="stat-card"><span>العملات</span><b style="font-size:18px">${state.settings.showUSD?'دولار ':''}${state.settings.showIQD?'دينار':''}</b></div>
    </div>
    <div class="grid">
      <section class="card">
        <h3>ابدأ بسرعة</h3>
        <p class="small">أنشئ فاتورة، اختر التصميم، فعّل أو ألغِ الدولار والدينار، ثم احفظها PDF أو Word. كل فاتورة تضغط عليها حفظ أو PDF تنضاف تلقائياً إلى الفواتير السابقة.</p>
        <div class="actions">
          <button class="btn primary" onclick="startNewInvoice()">إنشاء فاتورة</button>
          <button class="btn ghost" onclick="state.view='settings';render()">تعديل الإعدادات</button>
        </div>
      </section>
      <section class="card">
        <h3>ملاحظة PDF مهمة</h3>
        <div class="notice">عند الحفظ PDF من نافذة الطباعة، عطّل خيار <b>Headers and footers</b> حتى لا يظهر التاريخ أو رابط الملف بأسفل الورقة.</div>
      </section>
      <section class="card full">
        <div class="section-title"><h3>نماذج التصاميم المتاحة</h3><span class="pill">4 تصاميم احترافية</span></div>
        ${templatesHTML(state.settings.template, 'homeTemplate')}
      </section>
    </div>`);
  bindTemplateCards('homeTemplate', key => { state.settings.template = key; saveDB(); render(); });
}

function startNewInvoice(){
  state.selected = null;
  state.draft = initDraft();
  state.view = 'create';
  render();
}

function templatesHTML(selected, group='template'){
  return `<div class="template-chooser">${Object.entries(templateMeta).map(([key, meta]) => `
    <button type="button" class="template-card ${selected===key?'selected':''}" data-group="${group}" data-template="${key}">
      <span class="badge b-${key}">${meta.badge}</span>
      <div class="thumb ${key}">
        <div class="thumb-title">فاتورة</div>
        <div class="thumb-line"></div>
        <div class="thumb-row">إلى: العميل</div>
        <div class="thumb-row">مجموع الحساب الكلي</div>
        <div class="thumb-row">الواصل</div>
        <div class="thumb-row">المبلغ المتبقي</div>
      </div>
      <div class="template-name">${meta.name}</div>
    </button>`).join('')}</div>`;
}
function bindTemplateCards(group, onSelect){
  document.querySelectorAll(`[data-group="${group}"]`).forEach(card => {
    card.onclick = () => onSelect(card.dataset.template);
  });
}

function create(){
  if(!state.draft) state.draft = initDraft();
  const d = state.draft;
  shell(`
    <div class="create-layout">
      <div class="left-stack">
        <section class="card">
          <div class="section-title"><h3>بيانات الفاتورة</h3><span class="pill">A4 PDF</span></div>
          <div class="grid3">
            <div class="field"><span>عنوان المستند</span><input id="title" value="${esc(d.title)}"></div>
            <div class="field"><span>رقم المستند</span><input id="docNo" value="${esc(d.docNo)}"></div>
            <div class="field"><span>التاريخ</span><input id="date" type="date" value="${esc(d.date)}"></div>
            <div class="field full"><span>إلى / الجهة</span><input id="to" value="${esc(d.to)}" placeholder="مثال: شركة نور عشتار"></div>
          </div>
        </section>

        <section class="card">
          <div class="section-title"><h3>خيارات الظهور</h3><span class="small">هذه الخيارات تتحكم بما يظهر في PDF</span></div>
          <div class="switches">
            <label class="check"><span>إظهار الأسعار بالدينار العراقي</span><input id="showIQD" type="checkbox" ${d.showIQD?'checked':''}></label>
            <label class="check"><span>إظهار الأسعار بالدولار الأمريكي</span><input id="showUSD" type="checkbox" ${d.showUSD?'checked':''}></label>
            <label class="check"><span>إظهار الشعار في هذه الفاتورة</span><input id="showLogo" type="checkbox" ${d.showLogo?'checked':''}></label>
            <label class="check"><span>تثبيت هذا الشعار دائماً</span><input id="makeLogoDefault" type="checkbox" ${d.makeLogoDefault?'checked':''}></label>
          </div>
          <div class="file-row" style="margin-top:12px">
            <div class="logo-preview-small">${d.logo?`<img src="${d.logo}" alt="logo">`:'لا يوجد شعار'}</div>
            <div style="flex:1;min-width:210px" class="field"><span>اختيار شعار للفاتورة</span><input id="logoFile" type="file" accept="image/*"></div>
            ${d.logo?`<button class="btn red" onclick="removeDraftLogo()">حذف الشعار</button>`:''}
          </div>
        </section>

        <section class="card">
          <div class="section-title"><h3>اختيار التصميم</h3><span class="small">سيُحفظ PDF بنفس التصميم المختار</span></div>
          ${templatesHTML(d.template, 'draftTemplate')}
        </section>

        <section class="card">
          <div class="section-title">
            <h3>بنود الفاتورة</h3>
            <button class="btn ghost" onclick="addItem()">+ إضافة بند</button>
          </div>
          ${itemsHTML(d)}
        </section>

        <section class="card">
          <div class="section-title"><h3>الحسابات النهائية</h3><button class="btn ghost" onclick="calcTotals()">حساب تلقائي من البنود</button></div>
          ${totalsHTML(d)}
          <div class="field"><span>ملاحظات</span><textarea id="notes" placeholder="أي ملاحظات إضافية...">${esc(d.notes)}</textarea></div>
          <div class="actions">
            <button class="btn primary" onclick="saveInvoice()">حفظ الفاتورة</button>
            <button class="btn green" onclick="printPDF()">تصدير PDF / طباعة</button>
            <button class="btn blue" onclick="exportWord()">تصدير Word</button>
          </div>
        </section>
      </div>

      <section class="card preview-panel">
        <div class="section-title"><h3>معاينة الفاتورة</h3><span class="pill">${templateName(d.template)}</span></div>
        <div class="preview-wrap"><div class="preview-scale" id="preview">${invoiceHTML(d)}</div></div>
        <div class="actions">
          <button class="btn green" onclick="printPDF()">PDF</button>
          <button class="btn blue" onclick="exportWord()">Word</button>
          <button class="btn ghost" onclick="syncDraftFromForm(); renderPreviewOnly()">تحديث المعاينة</button>
        </div>
        <p class="small">لأفضل PDF: من نافذة الطباعة اختر Save as PDF وألغِ Headers and footers.</p>
      </section>
    </div>`);
  bindCreateEvents();
}

function bindCreateEvents(){
  ['title','docNo','date','to','notes','totalUSD','totalIQD','paidUSD','paidIQD','remainUSD','remainIQD'].forEach(id => {
    const el = document.getElementById(id);
    if(el) el.addEventListener('input', () => { state.draft[id] = el.value; renderPreviewOnly(); });
  });
  ['showIQD','showUSD','showLogo','makeLogoDefault'].forEach(id => {
    const el = document.getElementById(id);
    if(el) el.addEventListener('change', () => {
      state.draft[id] = el.checked;
      if(id === 'showIQD' || id === 'showUSD') render(); else renderPreviewOnly();
    });
  });
  const f = document.getElementById('logoFile');
  if(f) f.onchange = event => {
    const file = event.target.files[0];
    if(file) fileToDataURL(file, data => { state.draft.logo = data; state.draft.showLogo = true; render(); });
  };
  bindTemplateCards('draftTemplate', key => { state.draft.template = key; render(); });
}

function itemsHTML(d){
  const showUSD = d.showUSD;
  const showIQD = d.showIQD;
  const cls = showUSD && showIQD ? 'cols-4' : showUSD ? 'cols-3-usd' : showIQD ? 'cols-3-iqd' : 'cols-2';
  const head = `<div class="item-row ${cls} item-head"><div>الوصف</div>${showUSD?'<div>دولار</div>':''}${showIQD?'<div>دينار عراقي</div>':''}<div></div></div>`;
  const rows = d.items.map((item, i) => `
    <div class="item-row ${cls}">
      <input value="${esc(item.desc)}" placeholder="وصف البند" oninput="updateItem(${i},'desc',this.value)">
      ${showUSD?`<input type="number" value="${esc(item.usd)}" placeholder="0" oninput="updateItem(${i},'usd',this.value)">`:''}
      ${showIQD?`<input type="number" value="${esc(item.iqd)}" placeholder="0" oninput="updateItem(${i},'iqd',this.value)">`:''}
      <button class="delete-btn" onclick="removeItem(${i})">×</button>
    </div>`).join('');
  return `<div class="items-table">${head}${rows}</div>`;
}

function totalsHTML(d){
  return `<div class="grid3">
    ${d.showUSD?`<div class="field"><span>مجموع الحساب الكلي / دولار</span><input id="totalUSD" type="number" value="${esc(d.totalUSD)}"></div>`:''}
    ${d.showIQD?`<div class="field"><span>مجموع الحساب الكلي / دينار</span><input id="totalIQD" type="number" value="${esc(d.totalIQD)}"></div>`:''}
    ${d.showUSD?`<div class="field"><span>الواصل / دولار</span><input id="paidUSD" type="number" value="${esc(d.paidUSD)}"></div>`:''}
    ${d.showIQD?`<div class="field"><span>الواصل / دينار</span><input id="paidIQD" type="number" value="${esc(d.paidIQD)}"></div>`:''}
    ${d.showUSD?`<div class="field"><span>المتبقي / دولار</span><input id="remainUSD" type="number" value="${esc(d.remainUSD)}"></div>`:''}
    ${d.showIQD?`<div class="field"><span>المتبقي / دينار</span><input id="remainIQD" type="number" value="${esc(d.remainIQD)}"></div>`:''}
  </div>`;
}

function syncDraftFromForm(){
  if(!state.draft) return;
  ['title','docNo','date','to','notes','totalUSD','totalIQD','paidUSD','paidIQD','remainUSD','remainIQD'].forEach(id => {
    const el = document.getElementById(id);
    if(el) state.draft[id] = el.value;
  });
  ['showIQD','showUSD','showLogo','makeLogoDefault'].forEach(id => {
    const el = document.getElementById(id);
    if(el) state.draft[id] = el.checked;
  });
}
function renderPreviewOnly(){
  const preview = document.getElementById('preview');
  if(preview && state.draft) preview.innerHTML = invoiceHTML(state.draft);
}
window.updateItem = (index, key, value) => { state.draft.items[index][key] = value; renderPreviewOnly(); };
window.addItem = () => { state.draft.items.push({desc:'', usd:'', iqd:''}); render(); };
window.removeItem = index => {
  state.draft.items.splice(index,1);
  if(!state.draft.items.length) state.draft.items.push({desc:'', usd:'', iqd:''});
  render();
};
window.removeDraftLogo = () => { state.draft.logo = ''; state.draft.showLogo = false; render(); };
window.calcTotals = () => {
  syncDraftFromForm();
  const d = state.draft;
  d.totalUSD = d.items.reduce((sum, item) => sum + Number(item.usd || 0), 0) || '';
  d.totalIQD = d.items.reduce((sum, item) => sum + Number(item.iqd || 0), 0) || '';
  d.remainUSD = Number(d.totalUSD || 0) - Number(d.paidUSD || 0);
  d.remainIQD = Number(d.totalIQD || 0) - Number(d.paidIQD || 0);
  render();
};

function normalizeDoc(doc){
  return initDraft({ ...doc, items: (doc.items && doc.items.length ? doc.items : [{desc:'', usd:'', iqd:''}]) });
}

function persistDraftToHistory(){
  syncDraftFromForm();
  const d = normalizeDoc(state.draft || initDraft());
  d.id = d.id || Date.now();
  d.updatedAt = new Date().toISOString();
  d.createdAt = d.createdAt || new Date().toISOString();
  if(d.makeLogoDefault && d.logo){
    state.settings.logo = d.logo;
    state.settings.showLogo = true;
  }
  state.settings.template = d.template;
  state.settings.showUSD = d.showUSD;
  state.settings.showIQD = d.showIQD;
  const idx = db.invoices.findIndex(x => x.id === d.id);
  if(idx >= 0) db.invoices[idx] = d; else db.invoices.unshift(d);
  saveDB();
  state.draft = clone(d);
  return d;
}

function saveInvoice(){
  const d = persistDraftToHistory();
  state.selected = d;
  state.draft = null;
  state.view = 'list';
  render();
}

function list(){
  const rows = db.invoices.length ? db.invoices.map(inv => `
    <div class="list-row">
      <div>
        <b>${esc(inv.title || 'فاتورة')}</b>
        <div class="small">${esc(inv.docNo)} — ${esc(inv.to || 'بدون جهة')} — ${esc(inv.date)} — ${templateName(inv.template)}</div>
      </div>
      <div class="actions">
        <button class="btn ghost" onclick="previewInvoice(${inv.id})">معاينة</button>
        <button class="btn blue" onclick="editInvoice(${inv.id})">تعديل</button>
        <button class="btn green" onclick="printSaved(${inv.id})">PDF</button>
        <button class="btn red" onclick="deleteInvoice(${inv.id})">حذف</button>
      </div>
    </div>`).join('') : '<div class="card"><div class="empty">لا توجد فواتير محفوظة حالياً</div></div>';
  const selectedHTML = state.selected ? `
    <section class="card preview-panel" style="margin-top:16px">
      <div class="section-title"><h3>معاينة الفاتورة المحددة</h3><span class="pill">${templateName(state.selected.template)}</span></div>
      <div class="preview-wrap"><div class="preview-scale">${invoiceHTML(state.selected)}</div></div>
      <div class="actions">
        <button class="btn green" onclick="printSaved(${state.selected.id})">تصدير PDF / طباعة</button>
        <button class="btn blue" onclick="exportWord(${state.selected.id})">تصدير Word</button>
        <button class="btn ghost" onclick="editInvoice(${state.selected.id})">تعديل</button>
      </div>
    </section>` : '';
  shell(`<section class="card">
    <div class="section-title list-title-actions">
      <h3>الفواتير المحفوظة</h3>
      <div class="list-tools">
        <span class="pill">${db.invoices.length} فاتورة</span>
        ${db.invoices.length ? '<button class="btn red" onclick="clearAllInvoices()">حذف الكل</button>' : ''}
      </div>
    </div>
    <div class="notice" style="margin-bottom:12px">الهستوري حقيقي ومحفوظ داخل المتصفح. أي فاتورة تحفظها أو تصدرها PDF تنضاف هنا وتبقى حتى بعد إغلاق البرنامج.</div>
    <div class="invoice-list">${rows}</div>
  </section>${selectedHTML}`);
}
window.previewInvoice = id => { state.selected = db.invoices.find(x => x.id === id); render(); };
window.editInvoice = id => { const inv = db.invoices.find(x => x.id === id); if(inv){ state.draft = clone(inv); state.selected = null; state.view = 'create'; render(); } };
window.deleteInvoice = id => { if(confirm('هل تريد حذف هذه الفاتورة؟')){ db.invoices = db.invoices.filter(x => x.id !== id); if(state.selected?.id === id) state.selected = null; saveDB(); render(); } };
window.clearAllInvoices = () => {
  if(!db.invoices.length) return;
  if(confirm('هل تريد حذف كل الفواتير السابقة؟ لا يمكن التراجع عن هذه العملية.')){
    db.invoices = [];
    state.selected = null;
    saveDB();
    render();
  }
};
window.printSaved = id => { const inv = db.invoices.find(x => x.id === id); if(inv) printPDF(inv); };

function settings(){
  shell(`
    <div class="grid">
      <section class="card full">
        <div class="section-title"><h3>التصميم الافتراضي</h3><span class="small">يستخدم تلقائياً عند إنشاء فاتورة جديدة</span></div>
        ${templatesHTML(state.settings.template, 'settingsTemplate')}
      </section>
      <section class="card">
        <h3>الشعار والعملات الافتراضية</h3>
        <div class="switches">
          <label class="check"><span>إظهار الشعار افتراضياً</span><input id="setShowLogo" type="checkbox" ${state.settings.showLogo?'checked':''}></label>
          <label class="check"><span>إظهار الدولار افتراضياً</span><input id="setShowUSD" type="checkbox" ${state.settings.showUSD?'checked':''}></label>
          <label class="check"><span>إظهار الدينار افتراضياً</span><input id="setShowIQD" type="checkbox" ${state.settings.showIQD?'checked':''}></label>
        </div>
        <div class="file-row" style="margin-top:14px">
          <div class="logo-preview-small">${state.settings.logo?`<img src="${state.settings.logo}" alt="logo">`:'لا يوجد شعار'}</div>
          <div style="flex:1" class="field"><span>رفع شعار دائمي</span><input id="setLogoFile" type="file" accept="image/*"></div>
          ${state.settings.logo?`<button class="btn red" onclick="clearDefaultLogo()">حذف</button>`:''}
        </div>
      </section>
      <section class="card">
        <h3>بيانات التذييل</h3>
        <div class="field"><span>اسم البرنامج/الشركة</span><input id="setCompany" value="${esc(state.settings.company)}"></div>
        <div class="field"><span>الهاتف</span><input id="setPhone" value="${esc(state.settings.phone)}"></div>
        <div class="field"><span>البريد الإلكتروني</span><input id="setEmail" value="${esc(state.settings.email)}"></div>
        <div class="field"><span>العنوان</span><input id="setAddress" value="${esc(state.settings.address)}"></div>
      </section>
    </div>`);
  bindTemplateCards('settingsTemplate', key => { state.settings.template = key; saveDB(); render(); });
  ['setShowLogo','setShowUSD','setShowIQD'].forEach(id => {
    const el = document.getElementById(id);
    if(el) el.onchange = () => { state.settings[id.replace('setS','s')] = el.checked; saveDB(); };
  });
  const map = {setCompany:'company', setPhone:'phone', setEmail:'email', setAddress:'address'};
  Object.entries(map).forEach(([id, key]) => {
    const el = document.getElementById(id);
    if(el) el.oninput = () => { state.settings[key] = el.value; saveDB(); };
  });
  const f = document.getElementById('setLogoFile');
  if(f) f.onchange = e => {
    const file = e.target.files[0];
    if(file) fileToDataURL(file, data => { state.settings.logo = data; state.settings.showLogo = true; saveDB(); render(); });
  };
}
window.clearDefaultLogo = () => { state.settings.logo = ''; state.settings.showLogo = false; saveDB(); render(); };

function invoiceHTML(rawDoc){
  const d = normalizeDoc(rawDoc || initDraft());
  const tpl = templateMeta[d.template] ? d.template : 'classic';
  const hasLogo = Boolean(d.showLogo && d.logo);
  const itemRows = (d.items || []).filter(x => x.desc || x.usd || x.iqd).map(item => {
    const m = money(item.usd, item.iqd, d);
    return `<div class="invoice-item"><div class="item-bullet"></div><div class="item-desc">${esc(item.desc || 'بند بدون وصف')}</div>${m?`<div class="item-amount">${m}</div>`:''}</div>`;
  }).join('') || `<div class="invoice-item"><div class="item-bullet"></div><div class="item-desc">لا توجد بنود مدخلة</div></div>`;
  const total = money(d.totalUSD, d.totalIQD, d);
  const paid = money(d.paidUSD, d.paidIQD, d);
  const remain = money(d.remainUSD, d.remainIQD, d);
  return `<div class="template-scope tpl-${tpl}">
    <article class="invoice-sheet">
      <div class="invoice-top-band"></div>
      <div class="invoice-corner"></div>
      <div class="invoice-watermark">INVOICE</div>
      <div class="invoice-content">
        <header class="invoice-header">
          <div class="logo-area">
            ${d.showLogo ? (d.logo ? `<div class="invoice-logo ${tpl==='classic'?'diamond':''}"><img src="${d.logo}" alt="logo"></div>` : `<div class="invoice-logo ${tpl==='classic'?'diamond':''}"><span>LOGO</span></div>`) : `<div class="invoice-logo-empty"></div>`}
          </div>
          <div class="invoice-title-box">
            <div class="invoice-title-main">${esc(d.title || 'فاتورة')}</div>
          </div>
          <div class="meta-card">
            <div class="meta-row"><b>إلى:</b><span>${esc(d.to || '-')}</span></div>
            <div class="meta-row"><b>رقم المستند:</b><span>${esc(d.docNo || '-')}</span></div>
            <div class="meta-row"><b>التاريخ:</b><span>${esc(d.date || '-')}</span></div>
          </div>
        </header>
        <hr class="header-line">
        <section class="items-section">${itemRows}</section>
        <section class="summary-section">
          ${summaryBox('مجموع الحساب الكلي', total, '▦')}
          ${summaryBox('الواصل', paid, '◉')}
          ${summaryBox('المبلغ المتبقي', remain, '▣')}
        </section>
        <section class="notes-box"><b>ملاحظات:</b> ${esc(d.notes || 'لا توجد ملاحظات')}</section>
        <section class="signature-row">
          <div class="signature-box">توقيع المستلم</div>
          <div class="signature-box">توقيع وختم الجهة</div>
        </section>
        <footer class="invoice-footer">
          <div class="footer-cell"><span class="footer-icon">☎</span><span>${esc(state.settings.phone || '')}</span></div>
          <div class="footer-cell"><span class="footer-icon">✉</span><span>${esc(state.settings.email || '')}</span></div>
          <div class="footer-cell"><span class="footer-icon">📍</span><span>${esc(state.settings.address || '')}</span></div>
        </footer>
      </div>
      <div class="bottom-strip"></div>
    </article>
  </div>`;
}
function summaryBox(title, value, icon){
  return `<div class="summary-box"><div><h3>${title}</h3><strong>${value || '<span class="empty-amount">لا توجد عملة مفعّلة</span>'}</strong></div><div class="summary-icon">${icon}</div></div>`;
}

window.printPDF = function(doc){
  let d;
  if(doc){
    d = normalizeDoc(doc);
  }else if(state.draft){
    d = persistDraftToHistory();
  }else{
    d = normalizeDoc(getActiveDoc() || initDraft());
  }
  state.selected = d;
  const css = collectCss();
  const base = `<base href="${location.href.replace(/[^/]*$/, '')}">`;
  const html = `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">${base}<title>${esc(d.docNo || 'invoice')}</title><link rel="stylesheet" href="styles.css"><style>${css}</style><style>body{background:#fff!important}.print-help{display:none!important}</style></head><body><div id="printMount">${invoiceHTML(d)}</div><script>window.onload=function(){setTimeout(function(){window.focus();window.print();},250)};<\/script></body></html>`;

  // نفتح نافذة طباعة مستقلة حتى يشتغل PDF بشكل ثابت على المتصفح والموبايل.
  const win = window.open('', '_blank', 'width=980,height=900');
  if(win){
    try{ win.opener = null; }catch(e){}
    win.document.open();
    win.document.write(html);
    win.document.close();
    return;
  }

  // بديل إذا كان فتح النوافذ محظور.
  printMount.innerHTML = invoiceHTML(d);
  setTimeout(() => {
    window.print();
    setTimeout(() => { printMount.innerHTML = ''; }, 800);
  }, 120);
};

window.exportWord = function(id){
  let doc;
  if(id){
    doc = db.invoices.find(x => x.id === id);
  }else if(state.draft){
    doc = persistDraftToHistory();
  }else{
    doc = getActiveDoc() || initDraft();
  }
  if(!doc) return;
  doc = normalizeDoc(doc);
  const css = collectCss();
  const body = invoiceHTML(doc);
  const html = `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>${esc(doc.docNo || 'invoice')}</title><style>${css}</style><style>@page{size:A4;margin:0} body{background:#fff;margin:0}.invoice-sheet{box-shadow:none!important;margin:0!important;zoom:1!important}</style></head><body>${body}</body></html>`;
  try{
    const blob = new Blob(['\ufeff', html], {type:'application/msword;charset=utf-8'});
    download(blob, `${safeFileName(doc.docNo || 'invoice')}.doc`);
  }catch(e){
    const fallback = window.open('', '_blank');
    if(fallback){
      fallback.document.open();
      fallback.document.write(html);
      fallback.document.close();
    }else{
      alert('المتصفح منع تنزيل ملف Word. جرّب فتح الموقع من Chrome أو ارفع النسخة على Vercel/Netlify.');
    }
  }
};

function collectCss(){
  let css = '';
  try{
    for(const sheet of Array.from(document.styleSheets)){
      try{
        css += Array.from(sheet.cssRules || []).map(rule => rule.cssText).join('\n') + '\n';
      }catch(e){}
    }
  }catch(e){}
  return css;
}

function safeFileName(name){
  return String(name || 'invoice').replace(/[\\/:*?"<>|]+/g, '-').replace(/\s+/g, '-').slice(0,80) || 'invoice';
}

function download(blob, filename){
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    a.remove();
    URL.revokeObjectURL(url);
  }, 700);
}

function render(){
  if(!state.user) return login();
  if(state.view === 'home') return home();
  if(state.view === 'create') return create();
  if(state.view === 'list') return list();
  if(state.view === 'settings') return settings();
  home();
}

if('serviceWorker' in navigator){
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
}
render();
