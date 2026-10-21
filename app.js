/* =====================================================
   app.js — منطق المنيو (يعتمد على config.js و data.js)
   الأقسام: 1) الحالة  2) تحميل البيانات  3) عرض الأصناف
            4) نافذة اختيار الكمية  5) السلة  6) إرسال واتساب  7) التشغيل
   ===================================================== */

/* ---------- 1) الحالة والدوال المساعدة ---------- */
let sections = [];     // [{index, title, items}]
let allItems = [];     // كل الأصناف، رقم الصنف id = موضعه + 1
const cart = {};       // {id: الكمية}
let orderMode = "in";  // in = داخل المحل ، out = توصيل
let searchTerm = "";
let picker = null;     // الصنف المفتوح في نافذة الكمية {id, qty}
let geo = null;       // موقع الزبون {lat, lng, acc} بعد الضغط على زر تحديد الموقع
let sourceStatus = ""; // حالة التحميل (تظهر مع ?debug)

const $ = id => document.getElementById(id);
const fmt = n => Number(n).toLocaleString("ar-EG", { maximumFractionDigits: 2 });
const isKg = item => item.unit === "kg";
const qtyText = (item, q) => isKg(item) ? fmt(q) + " كجم" : fmt(q);
const lineTotal = (item, q) => Math.round(q * item.price);

/* ---------- 2) تحميل البيانات ---------- */
function setMenu(list) {            // list = [{title, items}]
  sections = list.map((s, index) => ({ index, title: s.title, items: s.items }));
  allItems = sections.flatMap(s => s.items);
}

// البيانات الاحتياطية من data.js
function loadFallback() {
  let id = 0;
  setMenu(FALLBACK_MENU.trim().split("\n").map(line => {
    const [title, rest] = line.split("|");
    const items = rest.split(",").map(x => {
      let [name, price] = x.split("~");
      const isNew = name.endsWith("*");
      name = name.replace(/\*$/, "");
      const kg = CONFIG.kgSections.includes(title) && !CONFIG.pieceNames.test(name);
      return { id: ++id, name, price: +price, section: title, unit: kg ? "kg" : "piece", soldOut: false, isNew, image: "" };
    });
    return { title, items };
  }));
}

// تحويل نص CSV إلى مصفوفة صفوف (يدعم النصوص بين علامات تنصيص)
function parseCsv(text) {
  const rows = []; let row = [], cell = "", quoted = false;
  text = text.replace(/^\uFEFF/, "");
  const endRow = () => { row.push(cell); cell = ""; if (row.some(c => c.trim())) rows.push(row); row = []; };
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else quoted = false; }
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") { row.push(cell); cell = ""; }
    else if (c === "\n" || c === "\r") { if (c === "\r" && text[i + 1] === "\n") i++; endRow(); }
    else cell += c;
  }
  endRow();
  return rows;
}

// تحويل صفوف الشيت إلى أقسام وأصناف
function loadFromCsv(text) {
  const rows = parseCsv(text);
  const head = rows[0].map(h => h.trim());
  const col = name => head.indexOf(name);
  const [cSec, cName, cPrice] = [col("القسم"), col("الصنف"), col("السعر")];
  const [cUnit, cAvail, cNew, cImg] = [col("الوحدة"), col("متاح"), col("جديد"), col("صورة")];
  if (cSec < 0 || cName < 0 || cPrice < 0) throw new Error("أعمدة الشيت ناقصة");

  const groups = new Map(); let id = 0;
  rows.slice(1).forEach(r => {
    const get = i => i < 0 ? "" : (r[i] || "").trim();
    const name = get(cName), section = get(cSec), avail = get(cAvail);
    const price = parseFloat(get(cPrice).replace(/[٠-٩]/g, d => d.charCodeAt(0) - 1632).replace(/[^\d.]/g, ""));
    if (!name || !section || isNaN(price) || /^(مخفي|إخفاء|اخفاء|hide|hidden)$/i.test(avail)) return;   // صف مخفي أو ناقص
    const item = {
      id: ++id, name, price, section,
      unit: /كجم|كيلو|kg/i.test(get(cUnit)) ? "kg" : "piece",
      soldOut: /^(لا|no|false|0|غير متاح)$/i.test(avail),
      isNew: /^(نعم|جديد|new|yes)$/i.test(get(cNew)),
      image: /^https?:\/\//.test(get(cImg)) ? get(cImg) : ""
    };
    if (!groups.has(section)) groups.set(section, []);
    groups.get(section).push(item);
  });
  if (!groups.size) throw new Error("الشيت فارغ");
  setMenu([...groups].map(([title, items]) => ({ title, items })));
}

// المحاولة: الشيت ← آخر نسخة محفوظة ← data.js
async function loadMenu() {
  loadFallback();
  sourceStatus = "البيانات المدمجة (data.js)";
  if (!CONFIG.sheetUrl) return;
  try {
    const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), 7000);
    const url = CONFIG.sheetUrl + (CONFIG.sheetUrl.includes("?") ? "&" : "?") + "t=" + Date.now();
    const res = await fetch(url, { signal: ctl.signal, cache: "no-store" });
    clearTimeout(timer);
    if (!res.ok) throw new Error("HTTP " + res.status);
    const text = await res.text();
    loadFromCsv(text);
    sourceStatus = "✓ الأسعار محدّثة من الشيت";
    try { localStorage.setItem("menuCache", text); } catch (e) {}
  } catch (err) {
    console.error("sheet error", err);
    sourceStatus = "⚠ تعذر الاتصال بالشيت: " + err;
    try { const cached = localStorage.getItem("menuCache"); if (cached) loadFromCsv(cached); } catch (e) {}
  }
}

/* ---------- 3) عرض الأقسام والأصناف ---------- */
// اختيار صورة الصنف: رابط الشيت ← قواعد config.js ← أيقونة بديلة
function itemImage(item) {
  if (item.image) return `<img src="${item.image}" loading="lazy" alt="${item.name}">`;
  const rule = CONFIG.imageRules.find(r => r.section === item.section && (!r.match || r.match.test(item.name)));
  if (rule) return `<img src="${CONFIG.images[rule.image]}" loading="lazy" alt="${item.name}">`;
  const emoji = /كرواسون|بريوش/.test(item.name) ? "🥐" : /دونات/.test(item.name) ? "🍩" : "🥮";
  return `<div class="ph">${emoji}</div>`;
}

function renderTabs() {
  $("tabs").innerHTML = sections.map(s => `<button id="t${s.index}" onclick="goSection(${s.index})">${s.title}</button>`).join("");
}

function goSection(i) {
  $("q").value = ""; searchTerm = ""; renderMenu();
  setTimeout(() => {
    document.querySelectorAll(".tabs button").forEach(b => b.classList.remove("on"));
    $("t" + i).classList.add("on");
    $("s" + i).scrollIntoView();
  }, 30);
}

function itemCard(item) {
  const q = cart[item.id];
  const price = `${fmt(item.price)} <small>ج.م${isKg(item) ? " / كجم" : ""}</small>`;
  let action;
  if (q) action = `<div class="qty"><button onclick="changeQty(${item.id},1)">+</button><span onclick="openPicker(${item.id})">${qtyText(item, q)}</span><button onclick="changeQty(${item.id},-1)">−</button></div>`;
  else if (item.soldOut) action = `<button class="add" disabled>غير متاح حاليًا</button>`;
  else action = `<button class="add" onclick="openPicker(${item.id})">+ إضافة للسلة</button>`;
  return `<div class="card${item.soldOut ? " off" : ""}">
    <div class="im">${itemImage(item)}</div>
    <b>${item.name}${item.isNew ? '<span class="new">جديد</span>' : ""}</b>
    <div class="pr">${price}</div>${action}</div>`;
}

function renderMenu() {
  const term = searchTerm.trim();
  let html = "";
  sections.forEach(s => {
    const items = term ? s.items.filter(x => x.name.includes(term)) : s.items;
    if (items.length) html += `<h2 id="s${s.index}">${s.title}</h2><div class="grid">${items.map(itemCard).join("")}</div>`;
  });
  $("main").innerHTML = html || '<div class="empty">لا توجد نتائج مطابقة</div>';
  updateCartBar();
}

/* ---------- 4) نافذة اختيار الكمية ---------- */
function openPicker(id) {
  if (allItems[id - 1].soldOut) return;
  picker = { id, qty: cart[id] || 1 };
  drawPicker();
  $("pv").classList.add("show");
}

function drawPicker() {
  const item = allItems[picker.id - 1], kg = isKg(item);
  const chips = kg ? [0.5, 1, 1.5, 2, 3, 5] : [1, 2, 3, 5, 10];
  const step = kg ? 0.25 : 1;
  $("ps").innerHTML = `
    <h3>${item.name}<button onclick="closePicker()">×</button></h3>
    <div class="im big">${itemImage(item)}</div>
    <div class="pr" style="margin:8px 0">${fmt(item.price)} ج.م${kg ? " / كجم" : ""}</div>
    <div class="chips">${chips.map(v => `<button class="${picker.qty === v ? "on" : ""}" onclick="setPickerQty(${v})">${kg ? fmt(v) + " كجم" : fmt(v)}</button>`).join("")}</div>
    <div class="qty big"><button onclick="setPickerQty(picker.qty+${step})">+</button><span>${qtyText(item, picker.qty)}</span><button onclick="setPickerQty(picker.qty-${step})">−</button></div>
    <div class="tot"><span>السعر</span><span>${fmt(lineTotal(item, picker.qty))} ج.م</span></div>
    <button class="send" style="background:var(--gold);color:#3a0720" onclick="confirmPicker()">${cart[picker.id] ? "تحديث الكمية" : "إضافة للسلة"}</button>`;
}

function setPickerQty(v) {
  picker.qty = Math.max(isKg(allItems[picker.id - 1]) ? 0.25 : 1, v);
  drawPicker();
}
function closePicker() { $("pv").classList.remove("show"); }
function confirmPicker() {
  cart[picker.id] = picker.qty;
  closePicker(); renderMenu(); refreshCartIfOpen();
}

/* ---------- 5) السلة ---------- */
function changeQty(id, dir) {                 // أزرار + و − في الكارت والسلة
  const step = isKg(allItems[id - 1]) ? 0.5 : 1;
  cart[id] = (cart[id] || 0) + dir * step;
  if (cart[id] <= 0.01) delete cart[id];
  renderMenu(); refreshCartIfOpen();
}

function cartTotals() {
  const ids = Object.keys(cart);
  const total = ids.reduce((sum, id) => sum + lineTotal(allItems[id - 1], cart[id]), 0);
  return { count: ids.length, total };
}

function updateCartBar() {
  const { count, total } = cartTotals();
  $("fl").classList.toggle("show", count > 0);
  $("fc").textContent = "🛒 عرض السلة (" + fmt(count) + " صنف)";
  $("ft").textContent = fmt(total) + " ج.م";
}

function refreshCartIfOpen() { if ($("ov").classList.contains("show")) openCart(); }
function closeCart() { $("ov").classList.remove("show"); }

function openCart() {
  const { count, total } = cartTotals();
  if (!count) { closeCart(); return; }
  const rows = Object.keys(cart).map(id => {
    const item = allItems[id - 1];
    return `<div class="row">
      <div class="im sm">${itemImage(item)}</div>
      <div><b>${item.name}</b><br><small>${fmt(lineTotal(item, cart[id]))} ج.م</small></div>
      <div class="qty"><button onclick="changeQty(${id},1)">+</button><span>${qtyText(item, cart[id])}</span><button onclick="changeQty(${id},-1)">−</button></div>
    </div>`;
  }).join("");
  const fields = orderMode === "in"
    ? '<input id="tb" placeholder="رقم الطاولة" inputmode="numeric">'
    : '<input id="nm" placeholder="الاسم"><input id="ph" placeholder="رقم الموبايل" inputmode="tel"><textarea id="ad" rows="2" placeholder="العنوان بالتفصيل"></textarea><button type="button" class="gps" onclick="getLocation()">📍 تحديد موقعي الحالي (اختياري)</button><div id="gpsMsg" class="gpsmsg"></div>';
  $("sh").innerHTML = `
    <h3>🛒 سلة المشتريات<button onclick="closeCart()">×</button></h3>${rows}
    <div class="tot"><span>الإجمالي</span><span>${fmt(total)} ج.م</span></div>
    <div class="mode">
      <button class="${orderMode === "in" ? "on" : ""}" onclick="setMode('in')">🍽️ داخل المحل</button>
      <button class="${orderMode === "out" ? "on" : ""}" onclick="setMode('out')">🛵 توصيل للمنزل</button>
    </div>
    <div class="f">${fields}<textarea id="nt" rows="2" placeholder="ملاحظات على الطلب (اختياري)"></textarea></div>
    <button class="send" onclick="sendOrder()">إرسال الطلب عبر واتساب</button>`;
  showGpsMsg();
  $("ov").classList.add("show");
}

/* ---------- تحديد موقع الزبون (GPS) ---------- */
function showGpsMsg(text) {
  const el = $("gpsMsg");
  if (!el) return;
  el.textContent = text || (geo ? "✓ تم تحديد موقعك (دقة تقريبية " + geo.acc + " متر) وسيُرسل مع الطلب" : "");
}

function getLocation() {
  if (!navigator.geolocation) { showGpsMsg("المتصفح لا يدعم تحديد الموقع، اكتب العنوان بالتفصيل"); return; }
  showGpsMsg("جارٍ تحديد الموقع...");
  navigator.geolocation.getCurrentPosition(
    pos => {
      geo = { lat: +pos.coords.latitude.toFixed(6), lng: +pos.coords.longitude.toFixed(6), acc: Math.round(pos.coords.accuracy) };
      showGpsMsg();
    },
    err => showGpsMsg(err.code === 1
      ? "لم يتم السماح بالوصول للموقع. فعّله من إعدادات المتصفح أو اكتب العنوان بالتفصيل"
      : "تعذر تحديد الموقع، تأكد من تشغيل GPS أو اكتب العنوان بالتفصيل"),
    { enableHighAccuracy: true, timeout: 15000 }
  );
}

function setMode(mode) {
  const notes = $("nt") ? $("nt").value : "";
  orderMode = mode; openCart(); $("nt").value = notes;
}

/* ---------- 6) إرسال الطلب إلى واتساب ---------- */
function sendOrder() {
  const val = id => $(id) ? $(id).value.trim() : "";
  if (orderMode === "in" && !val("tb")) { alert("من فضلك اكتب رقم الطاولة"); return; }
  if (orderMode === "out" && (!val("nm") || !val("ph") || !val("ad"))) { alert("من فضلك اكتب الاسم ورقم الموبايل والعنوان"); return; }

  const { count, total } = cartTotals();
  const line = "━━━━━━━━━━━━━━";
  let msg = `🧾 *فاتورة طلب جديد*\n*${CONFIG.shopName}*\n${line}\n`;
  Object.keys(cart).forEach((id, i) => {
    const item = allItems[id - 1], q = cart[id];
    msg += `${i + 1}) *${item.name}* (${item.section})\n    الكمية: ${isKg(item) ? q + " كجم" : q}\n    ${q} × ${item.price} = *${lineTotal(item, q)}* ج.م\n`;
  });
  msg += `${line}\n📦 عدد الأصناف: ${count}\n💰 *الإجمالي: ${total} ج.م*\n${line}\n`;
  msg += orderMode === "in"
    ? `🍽️ *داخل المحل*\n🪑 رقم الطاولة: ${val("tb")}\n`
    : `🛵 *توصيل للمنزل*\n👤 الاسم: ${val("nm")}\n📞 الموبايل: ${val("ph")}\n📍 العنوان: ${val("ad")}\n${geo ? "🧭 تحديد المسار للعميل: https://www.google.com/maps/dir/?api=1&destination=" + geo.lat + "," + geo.lng + (CONFIG.shopLocation ? "&origin=" + CONFIG.shopLocation.lat + "," + CONFIG.shopLocation.lng : "") + "&travelmode=driving\n" : ""}(لم يشمل السعر رسوم التوصيل)\n`;
  if (val("nt")) msg += `📝 ملاحظات: ${val("nt")}\n`;
  window.open("https://wa.me/" + CONFIG.phone + "?text=" + encodeURIComponent(msg), "_blank");
}

/* ---------- 7) التشغيل ---------- */
async function start() {
  $("shop").textContent = "✦ " + CONFIG.shopName + " ✦";
  document.title = CONFIG.shopName;
  $("q").addEventListener("input", e => { searchTerm = e.target.value; renderMenu(); });
  $("pv").addEventListener("click", e => { if (e.target.id === "pv") closePicker(); });
  if (CONFIG.shopMapUrl) {                      // رابط موقع المحل في الهيدر (اختياري)
    const link = document.createElement("a");
    link.className = "shopmap"; link.href = CONFIG.shopMapUrl; link.target = "_blank";
    link.textContent = "📍 موقع المحل على الخريطة";
    document.querySelector("header").appendChild(link);
  }
  await loadMenu();
  renderTabs(); renderMenu();
  if (/debug/.test(location.search)) {          // شريط تشخيص: افتح الرابط بإضافة ?debug
    const bar = document.createElement("div");
    bar.style.cssText = "text-align:center;padding:8px;color:#fff;background:#222;font-size:14px";
    bar.textContent = sourceStatus;
    document.body.prepend(bar);
  }
}
start();
