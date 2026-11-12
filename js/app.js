(() => {
  const $ = s => document.querySelector(s);
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const money = n => Number(n || 0).toLocaleString('fa-IR') + ' تومان';
  const CATS = {phone:'گوشی موبایل', accessory:'لوازم جانبی', charger:'شارژر و کابل', tablet:'تبلت'};
  const safeImg = u => /^https:\/\//i.test(u || '') ? u : '';

  let DB = {settings:{}, products:[]};
  let cart = JSON.parse(localStorage.getItem('ms_cart') || '{}');
  let cat = 'all';

  const saveCart = () => localStorage.setItem('ms_cart', JSON.stringify(cart));
  const toast = t => { const el = $('#toast'); el.textContent = t; el.hidden = false; clearTimeout(el._t); el._t = setTimeout(() => el.hidden = true, 2500); };

  function applySettings() {
    const s = DB.settings;
    document.title = s.shop || 'فروشگاه';
    $('#shopName').textContent = s.shop || '';
    $('#footName').textContent = s.shop || '';
    $('#intro').textContent = s.intro || '';
    const wa = `https://wa.me/${encodeURIComponent(s.phone || '')}`;
    $('#waFloat').href = wa;
  }

  function renderChips() {
    const keys = ['all', ...Object.keys(CATS)];
    $('#chips').innerHTML = keys.map(k => `<button class="chip ${k === cat ? 'active' : ''}" data-cat="${k}">${k === 'all' ? 'همه' : CATS[k]}</button>`).join('');
  }

  function card(p) {
    const off = p.oldPrice > p.price ? Math.round(100 - p.price * 100 / p.oldPrice) : 0;
    const img = safeImg(p.img);
    return `<article class="card">
      ${off ? `<span class="badge">${off}٪ تخفیف</span>` : ''}
      <div class="img">${img ? `<img loading="lazy" src="${esc(img)}" alt="${esc(p.name)}">` : '📱'}</div>
      <h3>${esc(p.name)}</h3>
      <p class="muted">${esc(p.brand)} · ${esc(CATS[p.cat] || '')}</p>
      <p class="muted">${esc(p.desc)}</p>
      <div class="price">${off ? `<s>${money(p.oldPrice)}</s>` : ''}<b>${money(p.price)}</b></div>
      <p class="stock ${p.stock > 0 ? '' : 'out'}">${p.stock > 0 ? 'موجودی: ' + Number(p.stock) + ' عدد' : 'ناموجود'}</p>
      <button class="btn" data-add="${esc(p.id)}" ${p.stock > 0 ? '' : 'disabled'}>افزودن به سبد</button>
    </article>`;
  }

  function renderProducts() {
    const q = $('#search').value.trim().toLowerCase();
    const list = DB.products.filter(p =>
      (cat === 'all' || p.cat === cat) &&
      (!q || (p.name + ' ' + p.brand).toLowerCase().includes(q)));
    $('#products').innerHTML = list.length ? list.map(card).join('') : '<p class="empty">محصولی یافت نشد</p>';
  }

  function cartLines() {
    return Object.entries(cart).map(([id, qty]) => {
      const p = DB.products.find(x => x.id === id);
      return p ? {id, qty, p, sum: p.price * qty} : null;
    }).filter(Boolean);
  }

  function renderCart() {
    const lines = cartLines();
    const count = lines.reduce((s, l) => s + l.qty, 0);
    $('#cartCount').textContent = count;
    $('#cartItems').innerHTML = lines.length ? lines.map(l => `
      <div class="row">
        <div><b>${esc(l.p.name)}</b><div class="muted">${money(l.p.price)}</div></div>
        <div class="qty">
          <button data-dec="${esc(l.id)}">−</button><span>${l.qty}</span>
          <button data-inc="${esc(l.id)}" ${l.qty >= l.p.stock ? 'disabled' : ''}>+</button>
          <button data-rm="${esc(l.id)}" title="حذف">🗑</button>
        </div>
      </div>`).join('') : '<p class="empty">سبد خرید خالی است</p>';
    $('#cartTotal').textContent = money(lines.reduce((s, l) => s + l.sum, 0));
  }

  function addToCart(id) {
    const p = DB.products.find(x => x.id === id);
    if (!p || p.stock <= 0) return;
    if ((cart[id] || 0) >= p.stock) return toast('موجودی کافی نیست');
    cart[id] = (cart[id] || 0) + 1;
    saveCart(); renderCart(); toast('به سبد اضافه شد');
  }

  function changeQty(id, d) {
    const p = DB.products.find(x => x.id === id);
    const n = (cart[id] || 0) + d;
    if (n <= 0 || !p) delete cart[id];
    else if (n > p.stock) return toast('موجودی کافی نیست');
    else cart[id] = n;
    saveCart(); renderCart();
  }

  function checkout(e) {
    e.preventDefault();
    const f = new FormData(e.target);
    const name = String(f.get('name') || '').trim();
    const phone = String(f.get('phone') || '').trim();
    const address = String(f.get('address') || '').trim();
    if (!name || !/^[0-9+ ]{7,15}$/.test(phone) || !address) return toast('لطفاً فیلدها را درست وارد کنید');
    const lines = cartLines();
    if (!lines.length) return toast('سبد خالی است');
    const total = lines.reduce((s, l) => s + l.sum, 0);
    const text = `سفارش جدید\nنام: ${name}\nتلفن: ${phone}\nآدرس: ${address}\n` +
      lines.map(l => `• ${l.p.name} × ${l.qty}`).join('\n') + `\nجمع کل: ${money(total)}`;
    cart = {}; saveCart(); renderCart();
    $('#cartModal').hidden = true;
    e.target.reset();
    window.open(`https://wa.me/${encodeURIComponent(DB.settings.phone || '')}?text=${encodeURIComponent(text)}`, '_blank', 'noopener');
  }

  async function init() {
    try {
      const r = await fetch('data/shop.json', {cache: 'no-store'});
      if (!r.ok) throw new Error();
      DB = await r.json();
    } catch {
      $('#products').innerHTML = '<p class="empty">خطا در بارگذاری اطلاعات فروشگاه. لطفاً از طریق یک سرور (نه فایل مستقیم) باز کنید.</p>';
      return;
    }
    applySettings(); renderChips(); renderProducts(); renderCart();
  }

  document.addEventListener('click', e => {
    const t = e.target.closest('button,a');
    if (!t) return;
    if (t.dataset.add) addToCart(t.dataset.add);
    else if (t.dataset.inc) changeQty(t.dataset.inc, 1);
    else if (t.dataset.dec) changeQty(t.dataset.dec, -1);
    else if (t.dataset.rm) { delete cart[t.dataset.rm]; saveCart(); renderCart(); }
    else if (t.dataset.cat) { cat = t.dataset.cat; renderChips(); renderProducts(); }
  });
  $('#search').addEventListener('input', renderProducts);
  $('#openCart').onclick = () => { renderCart(); $('#cartModal').hidden = false; };
  $('#closeCart').onclick = () => $('#cartModal').hidden = true;
  $('#cartModal').addEventListener('click', e => { if (e.target.id === 'cartModal') e.target.hidden = true; });
  $('#checkout').addEventListener('submit', checkout);

  init();
})();
