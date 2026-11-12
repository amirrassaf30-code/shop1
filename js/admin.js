(() => {
  const $ = s => document.querySelector(s);
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const money = n => Number(n || 0).toLocaleString('fa-IR');
  const CATS = {phone:'گوشی', tablet:'تبلت', accessory:'لوازم جانبی', charger:'شارژر و کابل'};

  let DB = null;

  const sha256 = async t => [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(t)))]
    .map(b => b.toString(16).padStart(2, '0')).join('');

  const toast = t => { const el = $('#toast'); el.textContent = t; el.hidden = false; clearTimeout(el._t); el._t = setTimeout(() => el.hidden = true, 2500); };

  function show(id) {
    ['setup', 'login', 'panel'].forEach(x => $('#' + x).hidden = x !== id);
  }

  // Brute-force protection: lock login for 60s after 5 failed attempts
  const failKey = 'ms_admin_fail';
  const getFail = () => { try { return JSON.parse(localStorage.getItem(failKey)) || {n: 0, until: 0}; } catch { return {n: 0, until: 0}; } };

  function openPanel() {
    sessionStorage.setItem('ms_admin_ok', '1');
    show('panel');
    fillSettings();
    renderTable();
    resetForm();
  }

  function fillSettings() {
    const f = $('#settingsForm');
    f.shop.value = DB.settings.shop || '';
    f.phone.value = DB.settings.phone || '';
    f.intro.value = DB.settings.intro || '';
  }

  function renderTable() {
    $('#pTable').innerHTML = DB.products.map(p => `
      <tr>
        <td>${esc(p.name)}<div class="muted">${esc(p.brand)} · ${esc(CATS[p.cat] || '')}</div></td>
        <td>${money(p.price)}</td>
        <td>${Number(p.stock)}</td>
        <td><div class="act">
          <button data-edit="${esc(p.id)}">ویرایش</button>
          <button data-del="${esc(p.id)}">حذف</button>
        </div></td>
      </tr>`).join('') || '<tr><td colspan="4" class="muted">محصولی ثبت نشده</td></tr>';
  }

  function resetForm() {
    $('#pForm').reset();
    $('#pForm').id.value = '';
    $('#pFormTitle').textContent = 'افزودن محصول';
  }

  function editProduct(id) {
    const p = DB.products.find(x => x.id === id);
    if (!p) return;
    const f = $('#pForm');
    ['id', 'name', 'brand', 'cat', 'price', 'oldPrice', 'stock', 'img', 'desc'].forEach(k => f[k].value = p[k] ?? '');
    $('#pFormTitle').textContent = 'ویرایش محصول';
    window.scrollTo({top: f.offsetTop - 80, behavior: 'smooth'});
  }

  function saveProduct(e) {
    e.preventDefault();
    const f = e.target;
    const img = (f.img.value || '').trim();
    if (img && !/^https:\/\//i.test(img)) return toast('لینک تصویر باید با https شروع شود');
    const data = {
      name: f.name.value.trim(),
      brand: f.brand.value.trim(),
      cat: f.cat.value,
      price: Math.max(0, Number(f.price.value) || 0),
      oldPrice: Math.max(0, Number(f.oldPrice.value) || 0),
      stock: Math.max(0, parseInt(f.stock.value, 10) || 0),
      img,
      desc: f.desc.value.trim(),
    };
    if (f.id.value) {
      const i = DB.products.findIndex(x => x.id === f.id.value);
      if (i > -1) DB.products[i] = {id: f.id.value, ...data};
    } else {
      DB.products.push({id: 'p' + Date.now().toString(36), ...data});
    }
    renderTable(); resetForm(); toast('محصول ذخیره شد');
  }

  async function saveSettings(e) {
    e.preventDefault();
    const f = e.target;
    const phone = f.phone.value.trim();
    if (!/^\d{7,15}$/.test(phone)) return toast('شماره واتساپ فقط عدد باشد');
    DB.settings.shop = f.shop.value.trim();
    DB.settings.phone = phone;
    DB.settings.intro = f.intro.value.trim();
    if (f.newPass.value) {
      if (f.newPass.value.length < 8) return toast('رمز باید حداقل ۸ کاراکتر باشد');
      DB.settings.adminHash = await sha256(f.newPass.value);
      f.newPass.value = '';
    }
    toast('تنظیمات ثبت شد. فایل را دانلود کنید');
  }

  function exportJson() {
    const blob = new Blob([JSON.stringify(DB, null, 2)], {type: 'application/json'});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'shop.json';
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  async function setup(e) {
    e.preventDefault();
    const p = e.target.p.value;
    if (p.length < 8) return $('#setupMsg').textContent = 'رمز حداقل ۸ کاراکتر باشد';
    DB.settings.adminHash = await sha256(p);
    toast('رمز ثبت شد. حتماً فایل shop.json را دانلود و آپلود کنید');
    openPanel();
    exportJson();
  }

  async function login(e) {
    e.preventDefault();
    const st = getFail();
    if (Date.now() < st.until) {
      const sec = Math.ceil((st.until - Date.now()) / 1000);
      return $('#loginMsg').textContent = `تلاش زیاد. ${sec} ثانیه صبر کنید`;
    }
    const ok = (await sha256(e.target.p.value)) === DB.settings.adminHash;
    if (ok) {
      localStorage.removeItem(failKey);
      e.target.reset();
      openPanel();
    } else {
      const n = st.n + 1;
      localStorage.setItem(failKey, JSON.stringify({n, until: n >= 5 ? Date.now() + 60000 : 0}));
      $('#loginMsg').textContent = 'رمز اشتباه است';
    }
  }

  async function init() {
    try {
      const r = await fetch('data/shop.json', {cache: 'no-store'});
      if (!r.ok) throw new Error();
      DB = await r.json();
    } catch {
      document.body.insertAdjacentHTML('afterbegin', '<p class="msg" style="padding:16px">فایل data/shop.json پیدا نشد یا سرور در دسترس نیست</p>');
      return;
    }
    if (!DB.settings.adminHash) return show('setup');
    if (sessionStorage.getItem('ms_admin_ok') === '1') return openPanel();
    show('login');
  }

  $('#setupForm').addEventListener('submit', setup);
  $('#loginForm').addEventListener('submit', login);
  $('#settingsForm').addEventListener('submit', saveSettings);
  $('#pForm').addEventListener('submit', saveProduct);
  $('#pReset').onclick = resetForm;
  $('#exportBtn').onclick = exportJson;
  $('#logoutBtn').onclick = () => { sessionStorage.removeItem('ms_admin_ok'); show('login'); };
  $('#pTable').addEventListener('click', e => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.edit) editProduct(b.dataset.edit);
    if (b.dataset.del && confirm('این محصول حذف شود؟')) {
      DB.products = DB.products.filter(p => p.id !== b.dataset.del);
      renderTable(); toast('حذف شد');
    }
  });

  init();
})();
