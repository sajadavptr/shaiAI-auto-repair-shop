/* ── Storage ── */
const DB = {
  get: k => JSON.parse(localStorage.getItem('shai_' + k) || '[]'),
  getObj: k => JSON.parse(localStorage.getItem('shai_' + k) || '{}'),
  set: (k, v) => localStorage.setItem('shai_' + k, JSON.stringify(v)),
  customers: () => DB.get('customers'),
  vehicles: () => DB.get('vehicles'),
  orders: () => DB.get('orders'),
  inspections: () => DB.get('inspections'),
  appointments: () => DB.get('appointments'),
  settings: () => DB.getObj('settings'),
  save: (k, v) => DB.set(k, v),
};

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const fmt = n => '$' + (+n || 0).toFixed(2);
const fmtDate = d => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
const fmtDateShort = d => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
const normPlate = p => (p || '').replace(/[\s\-]/g, '').toUpperCase();
const COLORS = ['#22C55E','#3B82F6','#A855F7','#F59E0B','#EF4444','#06B6D4','#EC4899','#F97316'];
const avatarColor = str => COLORS[(str || 'A').charCodeAt(0) % COLORS.length];

/* ── Settings ── */
const DEFAULT_SERVICES = [
  'Oil Change', 'Tire Rotation', 'Brake Inspection', 'Brake Replacement', 'Transmission Service',
  'Engine Diagnostics', 'AC Service', 'Battery Replacement', 'Wheel Alignment', 'Suspension Check',
  'Coolant Flush', 'Spark Plug Replacement', 'Air Filter Replacement', 'Fuel System Service',
  'Pre-Purchase Inspection', 'State Inspection', 'Emissions Test', 'Tire Replacement', 'Other'
];
function getServices() {
  const custom = DB.get('services');
  return [...DEFAULT_SERVICES, ...custom.filter(s => !DEFAULT_SERVICES.includes(s))];
}
function populateServiceSelect(selectId, selectedVal = '') {
  const el = document.getElementById(selectId);
  if (!el) return;
  el.innerHTML = '<option value="">Select service…</option>' +
    getServices().map(s => `<option value="${s}" ${s === selectedVal ? 'selected' : ''}>${s}</option>`).join('');
}
function showAddServiceInput() {
  const panel = document.getElementById('panel-new-service');
  panel.classList.toggle('open');
}
function saveCustomService() {
  const name = (document.getElementById('new-service-name').value || '').trim();
  if (!name) { toast('Enter a service name', 'error'); return; }
  const all = DB.get('services');
  if (!all.includes(name) && !DEFAULT_SERVICES.includes(name)) {
    all.push(name);
    DB.set('services', all);
  }
  document.getElementById('new-service-name').value = '';
  document.getElementById('panel-new-service').classList.remove('open');
  populateServiceSelect('apptf-reason', name);
  toast(`"${name}" added to services`);
}

function getSettings() {
  return Object.assign({ name: 'ShaiAI Garage', phone: '', email: '', address: '', tax: 10, labor: 85, reviewUrl: '' }, DB.settings());
}
function applySettings() {
  const s = getSettings();
  const el = document.getElementById('sidebar-shop-name');
  if (el) el.textContent = s.name;
  const av = document.getElementById('sidebar-avatar');
  if (av) av.textContent = (s.name || 'S')[0].toUpperCase();
  document.querySelectorAll('.tax-rate-label, #tax-rate-label').forEach(el => el.textContent = s.tax);
}
function openSettings() {
  const s = getSettings();
  document.getElementById('set-name').value = s.name;
  document.getElementById('set-phone').value = s.phone;
  document.getElementById('set-email').value = s.email;
  document.getElementById('set-address').value = s.address;
  document.getElementById('set-tax').value = s.tax;
  document.getElementById('set-labor').value = s.labor;
  document.getElementById('set-review-url').value = s.reviewUrl || '';
  openModal('settings-modal');
}
function saveSettings() {
  DB.set('settings', {
    name: document.getElementById('set-name').value.trim() || 'ShaiAI Garage',
    phone: document.getElementById('set-phone').value.trim(),
    email: document.getElementById('set-email').value.trim(),
    address: document.getElementById('set-address').value.trim(),
    tax: parseFloat(document.getElementById('set-tax').value) || 10,
    labor: parseFloat(document.getElementById('set-labor').value) || 85,
    reviewUrl: document.getElementById('set-review-url').value.trim(),
  });
  closeModal('settings-modal');
  applySettings();
  calcTotal();
  toast('Settings saved');
}

/* ── Toast ── */
function toast(msg, type = 'success', undoFn = null) {
  const t = document.createElement('div');
  t.className = 'toast ' + type;
  const dot = document.createElement('span');
  dot.className = 'toast-dot';
  const m = document.createElement('span');
  m.className = 'toast-msg';
  m.textContent = msg;
  t.appendChild(dot);
  t.appendChild(m);
  if (undoFn) {
    const u = document.createElement('button');
    u.className = 'toast-undo';
    u.textContent = 'Undo';
    u.onclick = () => { undoFn(); t.remove(); };
    t.appendChild(u);
  }
  document.getElementById('toast-container').appendChild(t);
  const timer = setTimeout(() => {
    t.style.animation = 'toastOut 0.3s ease forwards';
    setTimeout(() => t.remove(), 300);
  }, undoFn ? 5000 : 3000);
  if (undoFn) t.querySelector('.toast-undo').addEventListener('click', () => clearTimeout(timer));
}

/* ── Custom Confirm ── */
function confirm(title, message, okLabel = 'Delete') {
  return new Promise(resolve => {
    document.getElementById('confirm-title').textContent = title;
    document.getElementById('confirm-message').textContent = message;
    document.getElementById('confirm-ok').textContent = okLabel;
    openModal('confirm-modal');
    const ok = document.getElementById('confirm-ok');
    const cancel = document.getElementById('confirm-cancel');
    const cleanup = val => {
      closeModal('confirm-modal');
      ok.replaceWith(ok.cloneNode(true));
      cancel.replaceWith(cancel.cloneNode(true));
      resolve(val);
    };
    document.getElementById('confirm-ok').onclick = () => cleanup(true);
    document.getElementById('confirm-cancel').onclick = () => cleanup(false);
  });
}

/* ── Modal helpers ── */
function openModal(id) { document.getElementById(id).classList.add('open'); }
function closeModal(id) { document.getElementById(id).classList.remove('open'); }
document.addEventListener('click', e => {
  const mc = e.target.closest('.modal-close');
  if (mc) closeModal(mc.dataset.modal);
  const mb = e.target.closest('.modal-backdrop');
  if (mb && mb === e.target) closeModal(mb.id);
});

/* ── Navigation ── */
let currentView = 'dashboard';
let cameraStream = null;

function navigate(view) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  const el = document.getElementById('view-' + view);
  if (!el) return;
  el.classList.add('active');
  currentView = view;
  const nav = document.querySelector(`.nav-item[data-view="${view}"]`);
  if (nav) nav.classList.add('active');
  if (view !== 'scanner' && cameraStream) { cameraStream.getTracks().forEach(t => t.stop()); cameraStream = null; }
  refreshView(view);
  closeSearchDropdown();
  if (window.innerWidth <= 768) closeSidebar();
}

function refreshView(view) {
  if (view === 'dashboard') renderDashboard();
  if (view === 'customers') renderCustomers();
  if (view === 'vehicles') renderVehicles();
  if (view === 'repair-orders') renderOrders();
  if (view === 'kanban') renderKanban();
  if (view === 'inspections') renderInspections();
  if (view === 'invoices') renderInvoices();
  if (view === 'appointments') renderAppointments();
}

function closeSidebar() {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('sidebar-overlay').classList.remove('visible');
}

document.getElementById('menu-toggle').addEventListener('click', () => {
  document.getElementById('sidebar').classList.toggle('open');
  document.getElementById('sidebar-overlay').classList.toggle('visible');
});

document.querySelectorAll('.nav-item').forEach(item => {
  item.addEventListener('click', e => { e.preventDefault(); navigate(item.dataset.view); });
});

document.getElementById('quick-add-btn').addEventListener('click', () => {
  navigate('repair-orders'); openROModal();
});

/* ── Global Search ── */
let searchFocusIdx = -1;
const searchInput = document.getElementById('global-search');
const searchDropdown = document.getElementById('search-dropdown');

searchInput.addEventListener('input', () => {
  const q = searchInput.value.trim();
  if (q.length < 2) { closeSearchDropdown(); return; }
  const results = [];
  DB.customers().forEach(c => {
    const name = (c.first + ' ' + c.last).trim();
    if (name.toLowerCase().includes(q.toLowerCase()) || (c.phone || '').includes(q) || (c.email || '').toLowerCase().includes(q.toLowerCase())) {
      results.push({ type: 'customer', label: name || 'Unknown', sub: c.phone || c.email || '—', id: c.id, color: avatarColor(c.first), initials: ((c.first||'?')[0] + (c.last||'')[0]).toUpperCase() });
    }
  });
  DB.vehicles().forEach(v => {
    if (!v.plate) return;
    if (normPlate(v.plate).includes(normPlate(q)) || (v.make + ' ' + v.model).toLowerCase().includes(q.toLowerCase())) {
      const c = DB.customers().find(x => x.id === v.customerId);
      results.push({ type: 'vehicle', label: v.plate + ' — ' + v.year + ' ' + v.make + ' ' + v.model, sub: c ? c.first + ' ' + c.last : 'No owner', id: v.id, customerId: v.customerId });
    }
  });
  DB.orders().forEach(o => {
    if ((o.desc || '').toLowerCase().includes(q.toLowerCase())) {
      const c = DB.customers().find(x => x.id === o.customerId);
      results.push({ type: 'order', label: o.desc || 'Repair Order', sub: c ? c.first + ' ' + c.last : '', id: o.id });
    }
  });
  renderSearchDropdown(results.slice(0, 8));
});

searchInput.addEventListener('keydown', e => {
  const items = searchDropdown.querySelectorAll('.search-result');
  if (e.key === 'ArrowDown') { e.preventDefault(); searchFocusIdx = Math.min(searchFocusIdx + 1, items.length - 1); updateSearchFocus(items); }
  if (e.key === 'ArrowUp') { e.preventDefault(); searchFocusIdx = Math.max(searchFocusIdx - 1, 0); updateSearchFocus(items); }
  if (e.key === 'Enter' && searchFocusIdx >= 0) items[searchFocusIdx]?.click();
  if (e.key === 'Escape') closeSearchDropdown();
});

searchInput.addEventListener('blur', () => setTimeout(closeSearchDropdown, 220));

function updateSearchFocus(items) {
  items.forEach((el, i) => el.classList.toggle('focused', i === searchFocusIdx));
}

function renderSearchDropdown(results) {
  searchFocusIdx = -1;
  if (!results.length) { closeSearchDropdown(); return; }
  const typeIcon = { customer: '👤', vehicle: '🚗', order: '📋' };
  const typeColor = { customer: '#3B82F6', vehicle: '#A855F7', order: '#F59E0B' };
  searchDropdown.innerHTML = results.map((r, i) => `
    <div class="search-result" data-idx="${i}" onclick="handleSearchClick('${r.type}','${r.id}','${r.customerId || ''}')">
      <div class="search-result-icon" style="background:${typeColor[r.type]}22;color:${typeColor[r.type]};font-size:.8rem;font-weight:700">
        ${r.type === 'customer' ? (r.initials || '?') : r.type === 'vehicle' ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M5 17H3a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v7a2 2 0 0 1-2 2h-2"/><circle cx="7" cy="17" r="2"/><circle cx="17" cy="17" r="2"/></svg>' : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>'}
      </div>
      <div class="search-result-info">
        <div class="search-result-name">${r.label}</div>
        ${r.sub ? `<div class="search-result-sub">${r.sub}</div>` : ''}
      </div>
      <span class="search-result-type">${r.type}</span>
    </div>`).join('');
  searchDropdown.classList.add('open');
}

function closeSearchDropdown() { searchDropdown.classList.remove('open'); searchFocusIdx = -1; }

function handleSearchClick(type, id, customerId) {
  searchInput.value = '';
  closeSearchDropdown();
  if (type === 'customer') { navigate('customers'); openCustomerDetail(id); }
  if (type === 'vehicle') { navigate('vehicles'); }
  if (type === 'order') { navigate('repair-orders'); openROModal(id); }
}

document.addEventListener('keydown', e => {
  if ((e.ctrlKey || e.metaKey) && e.key === 'k') { e.preventDefault(); searchInput.focus(); searchInput.select(); }
});

/* ── Sparklines ── */
function sparkline(data, color) {
  if (!data.length) return '';
  const max = Math.max(...data, 1);
  const w = 100, h = 28, pad = 2;
  const pts = data.map((v, i) => {
    const x = pad + (i / (data.length - 1 || 1)) * (w - pad * 2);
    const y = h - pad - (v / max) * (h - pad * 2);
    return `${x},${y}`;
  }).join(' ');
  const area = `${pad},${h - pad} ${pts} ${w - pad},${h - pad}`;
  return `<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none">
    <defs><linearGradient id="sg${color.slice(1)}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${color}" stop-opacity="0.3"/>
      <stop offset="100%" stop-color="${color}" stop-opacity="0"/>
    </linearGradient></defs>
    <polygon points="${area}" fill="url(#sg${color.slice(1)})"/>
    <polyline points="${pts}" fill="none" stroke="${color}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`;
}

function last7Days(items, valueKey) {
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i); d.setHours(0, 0, 0, 0);
    const next = new Date(d); next.setDate(d.getDate() + 1);
    const val = items.filter(x => x.created >= d.getTime() && x.created < next.getTime())
      .reduce((s, x) => s + (valueKey ? (x[valueKey] || 0) : 1), 0);
    days.push(val);
  }
  return days;
}

/* ── DASHBOARD ── */
function renderDashboard() {
  const orders = DB.orders();
  const customers = DB.customers();
  const inspections = DB.inspections();
  const appts = DB.appointments();
  const open = orders.filter(o => o.status !== 'completed');
  const revenue = orders.filter(o => o.status === 'completed').reduce((s, o) => s + (o.total || 0), 0);

  document.getElementById('stat-open').textContent = open.length;
  document.getElementById('stat-customers').textContent = customers.length;
  document.getElementById('stat-revenue').textContent = fmt(revenue);
  document.getElementById('stat-inspections').textContent = inspections.length;
  document.getElementById('ro-badge').textContent = open.length;

  document.getElementById('spark-orders').innerHTML = sparkline(last7Days(orders), '#22C55E');
  document.getElementById('spark-customers').innerHTML = sparkline(last7Days(customers), '#3B82F6');
  document.getElementById('spark-revenue').innerHTML = sparkline(last7Days(orders.filter(o => o.status === 'completed'), 'total'), '#A855F7');
  document.getElementById('spark-insp').innerHTML = sparkline(last7Days(inspections), '#F59E0B');

  const h = new Date().getHours();
  const greeting = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
  document.getElementById('dash-greeting').textContent = `${greeting} — here's what's happening today.`;

  // Recent orders
  const list = document.getElementById('recent-orders-list');
  const recent = [...orders].sort((a, b) => b.created - a.created).slice(0, 6);
  if (!recent.length) {
    list.innerHTML = `<div class="empty-state"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg><p>No repair orders yet</p></div>`;
  } else {
    list.innerHTML = recent.map(o => {
      const c = DB.customers().find(x => x.id === o.customerId);
      const v = DB.vehicles().find(x => x.id === o.vehicleId);
      return `<div class="order-item" style="cursor:pointer" onclick="navigate('repair-orders');openROModal('${o.id}')">
        <div class="order-item-info">
          <div class="order-item-name">${c ? c.first + ' ' + c.last : 'Unknown'}</div>
          <div class="order-item-plate">${v ? v.year + ' ' + v.make + ' ' + v.model + (v.plate ? ' · ' + v.plate : '') : '—'} · ${fmtDateShort(o.created)}</div>
        </div>
        <span class="badge badge-${o.status}">${o.status.replace('-', ' ')}</span>
        <div class="order-item-amount">${fmt(o.total)}</div>
      </div>`;
    }).join('');
  }

  // Today's appointments
  const today = new Date().toISOString().slice(0, 10);
  const todayAppts = appts.filter(a => a.date === today).sort((a, b) => a.time.localeCompare(b.time));
  const apptEl = document.getElementById('today-appts');
  if (!todayAppts.length) {
    apptEl.innerHTML = `<div style="color:var(--text-dim);font-size:.84rem;padding:8px 0">No appointments today.</div>`;
  } else {
    apptEl.innerHTML = todayAppts.map(a => {
      const c = DB.customers().find(x => x.id === a.customerId);
      return `<div class="appt-card appt-today" style="margin-bottom:8px;padding:10px 14px;border-radius:8px">
        <div class="appt-time" style="font-size:.85rem;font-weight:800;color:var(--accent);min-width:48px">${fmtTime(a.time)}</div>
        <div class="appt-info" style="flex:1;padding-left:12px">
          <div class="appt-reason" style="font-size:.84rem">${a.reason}</div>
          <div class="appt-who" style="font-size:.75rem">${c ? c.first + ' ' + c.last : 'Walk-in'}</div>
        </div>
      </div>`;
    }).join('');
  }
}

/* ── CUSTOMERS ── */
function renderCustomers(filter = '') {
  const all = DB.customers().filter(c =>
    !filter || (c.first + ' ' + c.last + ' ' + c.phone + ' ' + (c.email || '')).toLowerCase().includes(filter.toLowerCase())
  );
  const list = document.getElementById('customers-list');
  if (!all.length) {
    list.innerHTML = `<div class="empty-state"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="9" cy="7" r="4"/><path d="M3 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2"/></svg><p>${filter ? 'No results for "' + filter + '"' : 'No customers yet. Add your first one!'}</p></div>`;
    return;
  }
  const sorted = [...all].sort((a, b) => (a.first + a.last).localeCompare(b.first + b.last));
  list.innerHTML = sorted.map(c => {
    const vehicles = DB.vehicles().filter(v => v.customerId === c.id);
    const orders = DB.orders().filter(o => o.customerId === c.id);
    const spent = orders.reduce((s, o) => s + (o.total || 0), 0);
    const initials = (c.first[0] || '') + (c.last[0] || '');
    return `<div class="data-card" onclick="openCustomerDetail('${c.id}')">
      <div class="data-card-avatar" style="background:${avatarColor(c.first)};color:#000">${initials}</div>
      <div class="data-card-info">
        <div class="data-card-name">${c.first} ${c.last}</div>
        <div class="data-card-sub">${c.phone}${c.email ? ' · ' + c.email : ''} · ${vehicles.length} vehicle${vehicles.length !== 1 ? 's' : ''} · ${orders.length} order${orders.length !== 1 ? 's' : ''} · ${fmt(spent)} total</div>
      </div>
      <div class="data-card-actions">
        <button class="btn-ghost btn-sm" onclick="event.stopPropagation();openCustomerModal(DB.customers().find(x=>x.id==='${c.id}'))">Edit</button>
        <button class="btn-danger" onclick="event.stopPropagation();deleteCustomer('${c.id}')">Delete</button>
      </div>
    </div>`;
  }).join('');
}

document.getElementById('customer-search').addEventListener('input', e => renderCustomers(e.target.value));

function openCustomerModal(customer = null) {
  document.getElementById('customer-modal-title').textContent = customer ? 'Edit Customer' : 'New Customer';
  document.getElementById('cf-id').value = customer?.id || '';
  document.getElementById('cf-first').value = customer?.first || '';
  document.getElementById('cf-last').value = customer?.last || '';
  document.getElementById('cf-phone').value = customer?.phone || '';
  document.getElementById('cf-email').value = customer?.email || '';
  document.getElementById('cf-notes').value = customer?.notes || '';
  openModal('customer-modal');
}

async function deleteCustomer(id) {
  const c = DB.customers().find(x => x.id === id);
  const ok = await confirm('Delete Customer', `Delete ${c?.first} ${c?.last} and all their data? This cannot be undone.`);
  if (!ok) return;
  const snapshot = { customers: DB.customers(), vehicles: DB.vehicles(), orders: DB.orders() };
  DB.save('customers', DB.customers().filter(x => x.id !== id));
  DB.save('vehicles', DB.vehicles().filter(v => v.customerId !== id));
  DB.save('orders', DB.orders().filter(o => o.customerId !== id));
  closeModal('customer-detail-modal');
  renderCustomers(document.getElementById('customer-search').value);
  renderDashboard();
  toast(`${c?.first} deleted`, 'error', () => {
    DB.save('customers', snapshot.customers);
    DB.save('vehicles', snapshot.vehicles);
    DB.save('orders', snapshot.orders);
    renderCustomers(); renderDashboard();
    toast('Undo successful');
  });
}

document.getElementById('customer-form').addEventListener('submit', e => {
  e.preventDefault();
  const id = document.getElementById('cf-id').value || uid();
  const customers = DB.customers();
  const idx = customers.findIndex(c => c.id === id);
  const customer = {
    id,
    first: document.getElementById('cf-first').value.trim(),
    last: document.getElementById('cf-last').value.trim(),
    phone: document.getElementById('cf-phone').value.trim(),
    email: document.getElementById('cf-email').value.trim(),
    notes: document.getElementById('cf-notes').value.trim(),
    created: idx >= 0 ? customers[idx].created : Date.now(),
  };
  if (idx >= 0) customers[idx] = customer; else customers.push(customer);
  DB.save('customers', customers);
  closeModal('customer-modal');
  renderCustomers(document.getElementById('customer-search').value);
  renderDashboard();
  toast(idx >= 0 ? 'Customer updated' : 'Customer added');
});

function openCustomerDetail(id) {
  const c = DB.customers().find(x => x.id === id);
  if (!c) return;
  const vehicles = DB.vehicles().filter(v => v.customerId === id);
  const orders = [...DB.orders().filter(o => o.customerId === id)].sort((a, b) => b.created - a.created);
  const spent = orders.reduce((s, o) => s + (o.total || 0), 0);
  document.getElementById('cd-name').textContent = c.first + ' ' + c.last;

  const timeline = orders.map(o => {
    const v = DB.vehicles().find(x => x.id === o.vehicleId);
    return `<div class="tl-item">
      <div class="tl-line"><div class="tl-dot" style="background:${o.status === 'completed' ? 'var(--accent)' : o.status === 'in-progress' ? 'var(--amber)' : 'var(--blue)'}"></div><div class="tl-track"></div></div>
      <div class="tl-content">
        <div class="tl-date">${fmtDate(o.created)}</div>
        <div class="tl-title">${o.desc || 'Repair Order'} <span class="badge badge-${o.status}" style="vertical-align:middle">${o.status.replace('-',' ')}</span></div>
        <div class="tl-sub">${v ? v.year + ' ' + v.make + ' ' + v.model : '—'} · ${fmt(o.total)}</div>
      </div>
    </div>`;
  }).join('');

  document.getElementById('customer-detail-body').innerHTML = `
    <div class="cd-meta">
      <div class="cd-avatar" style="background:${avatarColor(c.first)};color:#000">${c.first[0]}${c.last[0]}</div>
      <div class="cd-info">
        <div class="cd-cname">${c.first} ${c.last}</div>
        <div class="cd-phone">${c.phone}${c.email ? ' · ' + c.email : ''}</div>
      </div>
      <div style="margin-left:auto;text-align:right">
        <div style="font-size:1.2rem;font-weight:800;color:var(--accent)">${fmt(spent)}</div>
        <div style="font-size:.72rem;color:var(--text-dim)">Total spent</div>
      </div>
    </div>
    ${c.notes ? `<div style="color:var(--text-muted);font-size:.84rem;margin-bottom:14px;padding:10px 13px;background:var(--glass);border-radius:8px;border:1px solid var(--border)">${c.notes}</div>` : ''}
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px">
      <button class="btn-primary btn-sm" onclick="closeModal('customer-detail-modal');openCustomerModal(DB.customers().find(x=>x.id==='${id}'))">Edit</button>
      <button class="btn-ghost btn-sm" onclick="closeModal('customer-detail-modal');navigate('repair-orders');openROModal(null,'${id}')">New Repair Order</button>
      <button class="btn-ghost btn-sm" onclick="openVehicleModal('${id}')">Add Vehicle</button>
      <button class="btn-ghost btn-sm" onclick="closeModal('customer-detail-modal');navigate('appointments');openApptModal('${id}')">Book Appointment</button>
    </div>
    <div class="cd-section-title">Vehicles (${vehicles.length})</div>
    ${vehicles.length ? vehicles.map(v => {
      const mileageWarning = v.nextService && v.mileage && +v.mileage >= +v.nextService;
      return `<div class="data-card" style="margin-bottom:8px;cursor:default">
        <div class="data-card-info">
          <div class="data-card-name">${v.year || ''} ${v.make || ''} ${v.model || ''} <span class="plate-badge" style="margin-left:6px">${v.plate || 'No plate'}</span>${mileageWarning ? '<span style="color:var(--amber);font-size:.7rem;margin-left:8px">⚠ Service Due</span>' : ''}</div>
          <div class="data-card-sub">${[v.color, v.mileage ? v.mileage.toLocaleString() + ' mi' : '', v.vin ? 'VIN: ' + v.vin : ''].filter(Boolean).join(' · ')}</div>
        </div>
        <button class="btn-ghost btn-sm" onclick="openVehicleModal('${v.customerId}','${v.id}')">Edit</button>
      </div>`;
    }).join('') : '<p style="color:var(--text-dim);font-size:.84rem;margin-bottom:10px">No vehicles registered.</p>'}
    <div class="cd-section-title">Service History (${orders.length})</div>
    ${orders.length ? `<div class="timeline">${timeline}</div>` : '<p style="color:var(--text-dim);font-size:.84rem">No repair orders on file.</p>'}
  `;
  openModal('customer-detail-modal');
}

/* ── VEHICLES ── */
function renderVehicles(filter = '') {
  const all = DB.vehicles().filter(v => {
    if (!filter) return true;
    const c = DB.customers().find(x => x.id === v.customerId);
    return (v.plate + ' ' + v.make + ' ' + v.model + ' ' + v.year + ' ' + (c ? c.first + ' ' + c.last : '')).toLowerCase().includes(filter.toLowerCase());
  });
  const list = document.getElementById('vehicles-list');
  if (!all.length) {
    list.innerHTML = `<div class="empty-state"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M5 17H3a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v7a2 2 0 0 1-2 2h-2"/><circle cx="7" cy="17" r="2"/><circle cx="17" cy="17" r="2"/></svg><p>No vehicles found</p></div>`;
    return;
  }
  list.innerHTML = all.map(v => {
    const c = DB.customers().find(x => x.id === v.customerId);
    const orders = DB.orders().filter(o => o.vehicleId === v.id);
    const mileageWarning = v.nextService && v.mileage && +v.mileage >= +v.nextService;
    return `<div class="data-card">
      <div class="data-card-avatar" style="background:var(--bg3);color:var(--text-muted)">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="20" height="20"><path d="M5 17H3a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v7a2 2 0 0 1-2 2h-2"/><circle cx="7" cy="17" r="2"/><circle cx="17" cy="17" r="2"/></svg>
      </div>
      <div class="data-card-info">
        <div class="data-card-name">${v.year || ''} ${v.make || ''} ${v.model || ''} <span class="plate-badge" style="margin-left:6px">${v.plate || 'No plate'}</span>${mileageWarning ? ' <span style="color:var(--amber);font-size:.7rem">⚠ Service Due</span>' : ''}</div>
        <div class="data-card-sub">${c ? c.first + ' ' + c.last : 'No owner'} · ${v.color || ''} · ${v.mileage ? v.mileage.toLocaleString() + ' mi' : ''} · ${orders.length} order${orders.length !== 1 ? 's' : ''}</div>
      </div>
      <div class="data-card-actions">
        <button class="btn-ghost btn-sm" onclick="event.stopPropagation();openVehicleModal('${v.customerId}','${v.id}')">Edit</button>
        <button class="btn-danger" onclick="event.stopPropagation();deleteVehicle('${v.id}')">Delete</button>
      </div>
    </div>`;
  }).join('');
}

document.getElementById('vehicle-search').addEventListener('input', e => renderVehicles(e.target.value));

function openVehicleModal(customerId = null, vehicleId = null) {
  const v = vehicleId ? DB.vehicles().find(x => x.id === vehicleId) : null;
  document.getElementById('vehicle-modal-title').textContent = v ? 'Edit Vehicle' : 'Add Vehicle';
  document.getElementById('vf-id').value = v?.id || '';
  // Populate customer select
  const custSel = document.getElementById('vf-customer-id');
  const customers = DB.customers();
  custSel.innerHTML = '<option value="">Unassigned / Walk-in</option>' +
    customers.map(c => `<option value="${c.id}">${c.first} ${c.last}${c.phone ? ' · ' + c.phone : ''}</option>`).join('');
  custSel.value = v?.customerId || customerId || '';
  document.getElementById('vf-plate').value = v?.plate || '';
  document.getElementById('vf-year').value = v?.year || '';
  document.getElementById('vf-make').value = v?.make || '';
  document.getElementById('vf-model').value = v?.model || '';
  document.getElementById('vf-color').value = v?.color || '';
  document.getElementById('vf-vin').value = v?.vin || '';
  document.getElementById('vf-mileage').value = v?.mileage || '';
  document.getElementById('vf-next-service').value = v?.nextService || '';
  document.getElementById('vf-service-notes').value = v?.serviceNotes || '';
  openModal('vehicle-modal');
}

async function deleteVehicle(id) {
  const v = DB.vehicles().find(x => x.id === id);
  const ok = await confirm('Delete Vehicle', `Delete ${v?.year} ${v?.make} ${v?.model} (${v?.plate || 'no plate'})?`);
  if (!ok) return;
  const snapshot = DB.vehicles();
  DB.save('vehicles', DB.vehicles().filter(x => x.id !== id));
  renderVehicles(document.getElementById('vehicle-search').value);
  toast('Vehicle deleted', 'error', () => { DB.save('vehicles', snapshot); renderVehicles(); toast('Undo successful'); });
}

document.getElementById('vehicle-form').addEventListener('submit', e => {
  e.preventDefault();
  const id = document.getElementById('vf-id').value || uid();
  const vehicles = DB.vehicles();
  const idx = vehicles.findIndex(v => v.id === id);
  const vehicle = {
    id, customerId: document.getElementById('vf-customer-id').value,
    year: document.getElementById('vf-year').value,
    make: document.getElementById('vf-make').value.trim(),
    model: document.getElementById('vf-model').value.trim(),
    plate: document.getElementById('vf-plate').value.trim().toUpperCase(),
    color: document.getElementById('vf-color').value.trim(),
    vin: document.getElementById('vf-vin').value.trim().toUpperCase(),
    mileage: +document.getElementById('vf-mileage').value || 0,
    nextService: +document.getElementById('vf-next-service').value || 0,
    serviceNotes: document.getElementById('vf-service-notes').value.trim(),
    created: idx >= 0 ? vehicles[idx].created : Date.now(),
  };
  if (idx >= 0) vehicles[idx] = vehicle; else vehicles.push(vehicle);
  DB.save('vehicles', vehicles);
  closeModal('vehicle-modal');
  renderVehicles(document.getElementById('vehicle-search').value);
  toast(idx >= 0 ? 'Vehicle updated' : 'Vehicle added');
});

/* ── Quick-Add helpers (inline RO modal panels) ── */
function toggleInlinePanel(panelId, btnEl) {
  const panel = document.getElementById(panelId);
  const open = panel.classList.toggle('open');
  btnEl.textContent = open ? '− Cancel' : (panelId.includes('customer') ? '+ New Customer' : '+ New Vehicle');
}
function quickAddCustomer() {
  const first = document.getElementById('qc-first').value.trim();
  const last = document.getElementById('qc-last').value.trim();
  const phone = document.getElementById('qc-phone').value.trim();
  if (!first && !last) { toast('Enter at least a first or last name', 'error'); return; }
  const c = { id: uid(), first: first || 'Unknown', last: last || '', phone, email: '', notes: '', created: Date.now() };
  const customers = DB.customers();
  customers.push(c);
  DB.save('customers', customers);
  populateCustomerSelects();
  document.getElementById('rof-customer').value = c.id;
  updateVehicleSelect('rof-vehicle', c.id);
  document.getElementById('qc-first').value = '';
  document.getElementById('qc-last').value = '';
  document.getElementById('qc-phone').value = '';
  document.getElementById('panel-new-customer').classList.remove('open');
  const btn = document.getElementById('toggle-new-customer');
  if (btn) btn.textContent = '+ New Customer';
  toast(`Customer ${c.first} ${c.last} added`);
}
function quickAddVehicle() {
  const plate = document.getElementById('qv-plate').value.trim().toUpperCase();
  const year = document.getElementById('qv-year').value.trim();
  const make = document.getElementById('qv-make').value.trim();
  const model = document.getElementById('qv-model').value.trim();
  if (!plate && !make) { toast('Enter at least a plate or make', 'error'); return; }
  const customerId = document.getElementById('rof-customer').value || null;
  const v = { id: uid(), customerId, plate, year, make, model, color: '', vin: '', mileage: 0, nextService: 0, serviceNotes: '', created: Date.now() };
  const vehicles = DB.vehicles();
  vehicles.push(v);
  DB.save('vehicles', vehicles);
  updateVehicleSelect('rof-vehicle', customerId, v.id);
  document.getElementById('qv-plate').value = '';
  document.getElementById('qv-year').value = '';
  document.getElementById('qv-make').value = '';
  document.getElementById('qv-model').value = '';
  document.getElementById('panel-new-vehicle').classList.remove('open');
  const btn = document.getElementById('toggle-new-vehicle');
  if (btn) btn.textContent = '+ New Vehicle';
  toast(`Vehicle ${year} ${make} ${model || plate} added & selected`);
}

/* ── REPAIR ORDERS ── */
let roFilter = 'all';
let roSearch = '';
let lineItems = [];
let roPhotos = []; // base64 strings for current RO being edited

/* ── Photo helpers ── */
function compressImage(file) {
  return new Promise(resolve => {
    const reader = new FileReader();
    reader.onload = e => {
      const img = new Image();
      img.onload = () => {
        const MAX = 1200;
        let { width, height } = img;
        if (width > MAX || height > MAX) {
          if (width > height) { height = Math.round(height * MAX / width); width = MAX; }
          else { width = Math.round(width * MAX / height); height = MAX; }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width; canvas.height = height;
        canvas.getContext('2d').drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.72));
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

async function handlePhotoUpload(files) {
  if (!files || !files.length) return;
  toast('Processing photos…', 'info');
  for (const file of Array.from(files)) {
    if (!file.type.startsWith('image/')) continue;
    const b64 = await compressImage(file);
    roPhotos.push(b64);
  }
  document.getElementById('rof-photos').value = '';
  renderPhotoThumbs();
  toast(`${files.length} photo${files.length > 1 ? 's' : ''} added`);
}

function renderPhotoThumbs() {
  const container = document.getElementById('photo-thumbs');
  if (!container) return;
  if (!roPhotos.length) { container.innerHTML = ''; return; }
  container.innerHTML = roPhotos.map((src, i) => `
    <div class="photo-thumb-wrap">
      <img src="${src}" class="photo-thumb" onclick="viewPhoto(${i})" alt="Photo ${i + 1}">
      <button type="button" class="photo-thumb-del" onclick="removePhoto(${i})" title="Remove">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="10" height="10"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    </div>`).join('');
}

function removePhoto(idx) {
  roPhotos.splice(idx, 1);
  renderPhotoThumbs();
}

function viewPhoto(idx) {
  const w = window.open('', '_blank');
  w.document.write(`<html><body style="margin:0;background:#000;display:flex;align-items:center;justify-content:center;min-height:100vh"><img src="${roPhotos[idx]}" style="max-width:100%;max-height:100vh;object-fit:contain"></body></html>`);
  w.document.close();
}

function roDateStart(filter) {
  const now = new Date();
  if (filter === 'today') { const d = new Date(now.getFullYear(), now.getMonth(), now.getDate()); return d.getTime(); }
  if (filter === 'yesterday') { const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1); return d.getTime(); }
  if (filter === 'week') { const d = new Date(now); d.setDate(now.getDate() - now.getDay()); d.setHours(0,0,0,0); return d.getTime(); }
  return 0;
}
function roDateEnd(filter) {
  if (filter === 'yesterday') { const now = new Date(); const d = new Date(now.getFullYear(), now.getMonth(), now.getDate()); return d.getTime(); }
  return Infinity;
}

function renderOrders() {
  let all = DB.orders();
  const isDateFilter = ['today','yesterday','week'].includes(roFilter);
  if (!isDateFilter && roFilter !== 'all') {
    all = all.filter(o => o.status === roFilter);
  } else if (isDateFilter) {
    const since = roDateStart(roFilter), until = roDateEnd(roFilter);
    all = all.filter(o => { const t = o.updated || o.created; return t >= since && t < until; });
  }
  if (roSearch) {
    const q = roSearch.toLowerCase();
    all = all.filter(o => {
      const c = DB.customers().find(x => x.id === o.customerId);
      const v = DB.vehicles().find(x => x.id === o.vehicleId);
      return (o.desc || '').toLowerCase().includes(q) ||
        (c ? (c.first + ' ' + c.last).toLowerCase().includes(q) : false) ||
        (v ? (v.plate + ' ' + v.make + ' ' + v.model).toLowerCase().includes(q) : false);
    });
  }
  all = [...all].sort((a, b) => {
    const pri = { urgent: 0, high: 1, normal: 2 };
    if (a.status !== 'completed' && b.status !== 'completed') {
      if ((pri[a.priority] || 2) !== (pri[b.priority] || 2)) return (pri[a.priority] || 2) - (pri[b.priority] || 2);
    }
    return b.created - a.created;
  });
  const list = document.getElementById('ro-list');
  if (!all.length) {
    list.innerHTML = `<div class="empty-state"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg><p>No orders found</p></div>`;
    return;
  }
  list.innerHTML = all.map(o => {
    const c = DB.customers().find(x => x.id === o.customerId);
    const v = DB.vehicles().find(x => x.id === o.vehicleId);
    return `<div class="data-card" onclick="openROModal('${o.id}')">
      <div class="data-card-info">
        <div class="data-card-name">${c ? c.first + ' ' + c.last : 'Unknown'}${v ? ' — ' + v.year + ' ' + v.make + ' ' + v.model : ''}</div>
        <div class="data-card-sub">${o.desc || 'No description'} · ${fmtDate(o.created)}</div>
      </div>
      ${o.priority !== 'normal' ? `<span class="badge badge-${o.priority}">${o.priority}</span>` : ''}
      <span class="badge badge-${o.status}">${o.status.replace('-', ' ')}</span>
      ${o.photos?.length ? `<span class="badge" style="background:rgba(59,130,246,.15);color:#3B82F6"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="10" height="10" style="margin-right:3px"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>${o.photos.length}</span>` : ''}
      <div style="font-weight:700;color:var(--accent);white-space:nowrap">${fmt(o.total)}</div>
      <div class="data-card-actions">
        <button class="btn-danger" onclick="event.stopPropagation();deleteOrder('${o.id}')">Delete</button>
      </div>
    </div>`;
  }).join('');
}

// RO status/date filter tabs — scoped to the repair-orders view only
document.querySelectorAll('#view-repair-orders .filter-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('#view-repair-orders .filter-tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active'); roFilter = tab.dataset.filter; renderOrders();
  });
});
document.getElementById('ro-search').addEventListener('input', e => { roSearch = e.target.value.trim(); renderOrders(); });

async function deleteOrder(id) {
  const o = DB.orders().find(x => x.id === id);
  const ok = await confirm('Delete Repair Order', `Delete this repair order for "${o?.desc || 'service'}"?`);
  if (!ok) return;
  const snapshot = DB.orders();
  DB.save('orders', DB.orders().filter(x => x.id !== id));
  renderOrders(); renderDashboard(); if (currentView === 'kanban') renderKanban();
  toast('Order deleted', 'error', () => { DB.save('orders', snapshot); renderOrders(); renderDashboard(); if (currentView === 'kanban') renderKanban(); toast('Undo successful'); });
}

function populateCustomerSelects() {
  const customers = DB.customers();
  const walkInOpts = '<option value="">Walk-in / No customer</option>' + customers.map(c => `<option value="${c.id}">${c.first} ${c.last}${c.phone ? ' · ' + c.phone : ''}</option>`).join('');
  ['rof-customer', 'dvif-customer', 'apptf-customer'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = walkInOpts;
  });
}

function updateVehicleSelect(selId, customerId, selectedVehicleId = null) {
  const sel = document.getElementById(selId);
  const all = DB.vehicles();
  const vehicles = customerId ? all.filter(v => v.customerId === customerId) : all;
  sel.innerHTML = '<option value="">Select vehicle…</option>' + vehicles.map(v => `<option value="${v.id}" ${v.id === selectedVehicleId ? 'selected' : ''}>${v.year} ${v.make} ${v.model}${v.plate ? ' (' + v.plate + ')' : ''}</option>`).join('');
}

function openROModal(id = null, preCustomerId = null) {
  const o = id ? DB.orders().find(x => x.id === id) : null;
  document.getElementById('ro-modal-title').textContent = o ? 'Edit Repair Order' : 'New Repair Order';
  document.getElementById('rof-id').value = o?.id || '';
  lineItems = o?.lines ? JSON.parse(JSON.stringify(o.lines)) : [];
  roPhotos = o?.photos ? [...o.photos] : [];
  populateCustomerSelects();
  const cid = o?.customerId || preCustomerId || '';
  document.getElementById('rof-customer').value = cid;
  updateVehicleSelect('rof-vehicle', cid, o?.vehicleId);
  document.getElementById('rof-status').value = o?.status || 'open';
  document.getElementById('rof-priority').value = o?.priority || 'normal';
  document.getElementById('rof-desc').value = o?.desc || '';
  document.getElementById('rof-notes').value = o?.notes || '';
  // reset inline panels
  ['panel-new-customer','panel-new-vehicle'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.classList.remove('open');
  });
  const tnc = document.getElementById('toggle-new-customer');
  if (tnc) tnc.textContent = '+ New Customer';
  const tnv = document.getElementById('toggle-new-vehicle');
  if (tnv) tnv.textContent = '+ New Vehicle';
  renderLineItems();
  renderPhotoThumbs();
  openModal('ro-modal');
}

document.getElementById('rof-customer').addEventListener('change', e => updateVehicleSelect('rof-vehicle', e.target.value));

/* ── Parts / Services Catalog ── */
function getCatalog() { return DB.get('catalog'); }
function saveToCatalog(desc, price) {
  if (!desc) return;
  const catalog = getCatalog();
  const existing = catalog.find(c => c.name.toLowerCase() === desc.toLowerCase());
  if (existing) { existing.price = price || existing.price; existing.uses = (existing.uses || 0) + 1; }
  else catalog.push({ name: desc, price: price || 0, uses: 1 });
  catalog.sort((a, b) => (b.uses || 0) - (a.uses || 0));
  DB.set('catalog', catalog.slice(0, 300));
}

function renderLineItems() {
  const container = document.getElementById('line-items');
  container.innerHTML = lineItems.map((li, i) => {
    const lineTotal = (li.qty || 1) * (li.price || 0);
    return `<div class="line-item">
      <div class="li-desc-wrap">
        <input type="text" class="li-desc-input" placeholder="Service or part" value="${escHtml(li.desc || '')}"
          oninput="lineItems[${i}].desc=this.value;showCatalogDropdown(this,${i})"
          onfocus="showCatalogDropdown(this,${i})"
          onblur="hideCatalogDropdown(${i})"
          autocomplete="off">
        <div class="catalog-dropdown" id="cat-dd-${i}"></div>
      </div>
      <input type="number" placeholder="1" value="${li.qty || 1}" min="1" oninput="lineItems[${i}].qty=+this.value||1;updateLineTotal(${i})" style="text-align:center">
      <input type="number" placeholder="0.00" value="${li.price || ''}" step="0.01" min="0" id="li-price-${i}" oninput="lineItems[${i}].price=+this.value||0;updateLineTotal(${i})">
      <span class="line-item-total" id="lt-${i}">${fmt(lineTotal)}</span>
      <button type="button" class="line-item-del" onclick="removeLine(${i})">×</button>
    </div>`;
  }).join('');
  calcTotal();
}

function showCatalogDropdown(input, idx) {
  const q = (input.value || '').trim().toLowerCase();
  const dd = document.getElementById('cat-dd-' + idx);
  if (!dd) return;
  const catalog = getCatalog();
  const matches = q.length === 0
    ? catalog.slice(0, 10)
    : catalog.filter(c => c.name.toLowerCase().includes(q)).slice(0, 10);
  if (!matches.length) { dd.innerHTML = ''; dd.classList.remove('open'); return; }
  dd.innerHTML = matches.map(c => `
    <div class="catalog-option" onmousedown="selectCatalogItem(event,${idx},'${c.name.replace(/'/g,"\\'")}',${c.price || 0})">
      <span class="catalog-option-name">${c.name}</span>
      ${c.price ? `<span class="catalog-option-price">${fmt(c.price)}</span>` : ''}
    </div>`).join('');
  dd.classList.add('open');
}

function hideCatalogDropdown(idx) {
  setTimeout(() => {
    const dd = document.getElementById('cat-dd-' + idx);
    if (dd) dd.classList.remove('open');
  }, 180);
}

function selectCatalogItem(e, idx, name, price) {
  e.preventDefault();
  lineItems[idx].desc = name;
  lineItems[idx].price = price;
  renderLineItems();
  calcTotal();
  // focus the qty field of the selected row
  const inputs = document.getElementById('line-items').querySelectorAll('.line-item');
  if (inputs[idx]) {
    const qtyInput = inputs[idx].querySelectorAll('input[type=number]')[0];
    if (qtyInput) qtyInput.focus();
  }
}

function updateLineTotal(i) {
  const el = document.getElementById('lt-' + i);
  if (el) el.textContent = fmt((lineItems[i].qty || 1) * (lineItems[i].price || 0));
  calcTotal();
}

function removeLine(i) { lineItems.splice(i, 1); renderLineItems(); }

document.getElementById('add-line-btn').addEventListener('click', () => {
  lineItems.push({ desc: '', qty: 1, price: 0 });
  renderLineItems();
  const inputs = document.getElementById('line-items').querySelectorAll('input');
  if (inputs.length) inputs[inputs.length - 3]?.focus();
});

function calcTotal() {
  const tax = getSettings().tax / 100;
  const subtotal = lineItems.reduce((s, l) => s + (l.qty || 1) * (l.price || 0), 0);
  const taxAmt = subtotal * tax;
  document.getElementById('ro-subtotal').textContent = fmt(subtotal);
  document.getElementById('ro-tax').textContent = fmt(taxAmt);
  document.getElementById('ro-total').textContent = fmt(subtotal + taxAmt);
}

document.getElementById('ro-form').addEventListener('submit', e => {
  e.preventDefault();
  const tax = getSettings().tax / 100;
  const id = document.getElementById('rof-id').value || uid();
  const orders = DB.orders();
  const idx = orders.findIndex(o => o.id === id);
  const subtotal = lineItems.reduce((s, l) => s + (l.qty || 1) * (l.price || 0), 0);
  const order = {
    id, customerId: document.getElementById('rof-customer').value,
    vehicleId: document.getElementById('rof-vehicle').value,
    status: document.getElementById('rof-status').value,
    priority: document.getElementById('rof-priority').value,
    desc: document.getElementById('rof-desc').value.trim(),
    notes: document.getElementById('rof-notes').value.trim(),
    lines: JSON.parse(JSON.stringify(lineItems)),
    photos: [...roPhotos],
    subtotal, tax: subtotal * tax, total: subtotal * (1 + tax),
    created: idx >= 0 ? orders[idx].created : Date.now(),
    updated: Date.now(),
  };
  if (idx >= 0) orders[idx] = order; else orders.push(order);
  DB.save('orders', orders);
  // persist line items to reusable catalog
  order.lines.forEach(l => { if (l.desc) saveToCatalog(l.desc, l.price); });
  closeModal('ro-modal');
  renderOrders(); renderDashboard(); if (currentView === 'kanban') renderKanban();
  toast(idx >= 0 ? 'Order updated' : 'Repair order created');
  const wasCompleted = idx >= 0 ? orders[idx]?.status === 'completed' : false;
  if (order.status === 'completed' && !wasCompleted) triggerReviewPrompt(order.customerId);
});

/* ── KANBAN ── */
let draggingId = null;
let kanbanDateFilter = 'all';
let kanbanHiddenCols = new Set();

function kanbanDateStart(filter) {
  const now = new Date();
  if (filter === 'today') { const d = new Date(now.getFullYear(), now.getMonth(), now.getDate()); return d.getTime(); }
  if (filter === 'week') { const d = new Date(now); d.setDate(now.getDate() - now.getDay()); d.setHours(0,0,0,0); return d.getTime(); }
  if (filter === 'month') { return new Date(now.getFullYear(), now.getMonth(), 1).getTime(); }
  return 0;
}

function renderKanban() {
  let orders = DB.orders();
  const since = kanbanDateStart(kanbanDateFilter);
  if (since) orders = orders.filter(o => (o.updated || o.created) >= since);

  ['open', 'in-progress', 'completed'].forEach(status => {
    const colEl = document.getElementById('k-' + status);
    if (!colEl) return;
    if (kanbanHiddenCols.has(status)) { colEl.style.display = 'none'; return; }
    colEl.style.display = '';
    const col = orders.filter(o => o.status === status);
    document.getElementById('kc-' + status).textContent = col.length;
    document.getElementById('kcards-' + status).innerHTML = col.length
      ? col.sort((a, b) => b.created - a.created).map(o => kanbanCard(o)).join('')
      : `<div style="color:var(--text-dim);font-size:.8rem;text-align:center;padding:20px 0">Drop orders here</div>`;
  });
  document.getElementById('ro-badge').textContent = DB.orders().filter(o => o.status !== 'completed').length;

  // Sync toggle button states
  document.querySelectorAll('.kcol-toggle').forEach(btn => {
    const col = btn.dataset.kcol;
    btn.classList.toggle('active', !kanbanHiddenCols.has(col));
  });
  document.querySelectorAll('.kfilter-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.kdate === kanbanDateFilter);
  });
}

// Kanban controls event delegation
document.addEventListener('click', e => {
  const fb = e.target.closest('.kfilter-btn');
  if (fb) { kanbanDateFilter = fb.dataset.kdate; renderKanban(); return; }
  const tb = e.target.closest('.kcol-toggle');
  if (tb) {
    const col = tb.dataset.kcol;
    if (kanbanHiddenCols.has(col)) kanbanHiddenCols.delete(col); else kanbanHiddenCols.add(col);
    renderKanban(); return;
  }
});

function kanbanCard(o) {
  const c = DB.customers().find(x => x.id === o.customerId);
  const v = DB.vehicles().find(x => x.id === o.vehicleId);
  return `<div class="kanban-card" draggable="true" data-id="${o.id}"
    ondragstart="kanbanDragStart(event,'${o.id}')"
    ondragend="kanbanDragEnd(event)"
    onclick="openROModal('${o.id}')">
    <div class="kcard-top">
      <div class="kcard-name">${c ? c.first + ' ' + c.last : 'Unknown'}</div>
      ${o.priority !== 'normal' ? `<span class="badge badge-${o.priority}" style="font-size:.62rem">${o.priority}</span>` : ''}
    </div>
    <div class="kcard-vehicle">${v ? v.year + ' ' + v.make + ' ' + v.model + (v.plate ? ' · ' + v.plate : '') : '—'}</div>
    ${o.desc ? `<div style="font-size:.78rem;color:var(--text-muted);margin-bottom:4px">${o.desc}</div>` : ''}
    <div class="kcard-footer">
      <span class="kcard-amount">${fmt(o.total)}</span>
      <span class="kcard-date">${fmtDateShort(o.created)}</span>
    </div>
  </div>`;
}

function kanbanDragStart(e, id) {
  draggingId = id;
  e.currentTarget.classList.add('dragging');
  e.dataTransfer.effectAllowed = 'move';
}
function kanbanDragEnd(e) { e.currentTarget.classList.remove('dragging'); }
function kanbanDragOver(e) { e.preventDefault(); e.currentTarget.classList.add('drag-over'); }
function kanbanDrop(e, newStatus) {
  e.preventDefault();
  e.currentTarget.classList.remove('drag-over');
  document.querySelectorAll('.kanban-col').forEach(c => c.classList.remove('drag-over'));
  if (!draggingId) return;
  const orders = DB.orders();
  const idx = orders.findIndex(o => o.id === draggingId);
  if (idx >= 0 && orders[idx].status !== newStatus) {
    orders[idx].status = newStatus;
    orders[idx].updated = Date.now();
    DB.save('orders', orders);
    renderKanban();
    toast(`Moved to ${newStatus.replace('-', ' ')}`);
    if (newStatus === 'completed') triggerReviewPrompt(orders[idx].customerId);
  }
  draggingId = null;
}

/* ── Google Review ── */
let _reviewCustomerId = null;
let _reviewMailto = '';

function triggerReviewPrompt(customerId) {
  const s = getSettings();
  const url = s.reviewUrl || '';
  const shopName = s.name || 'our shop';
  const c = DB.customers().find(x => x.id === customerId);
  _reviewCustomerId = customerId;

  const name = c ? c.first + ' ' + c.last : 'Valued Customer';
  const email = c?.email || '';

  // Avatar
  const av = document.getElementById('review-customer-avatar');
  const color = avatarColor(c?.first || 'U');
  av.style.background = color + '22';
  av.style.color = color;
  av.textContent = ((c?.first || 'U')[0] + (c?.last || '')[0]).toUpperCase();

  document.getElementById('review-customer-name').textContent = name;
  document.getElementById('review-customer-email').textContent = email || 'No email on file';

  // Build email content
  const subject = `Thank you for choosing ${shopName}!`;
  const firstName = c?.first || 'there';
  const body = [
    `Hi ${firstName},`,
    '',
    `Thank you for trusting ${shopName} with your vehicle. We truly appreciate your business and hope everything is running smoothly.`,
    '',
    `If you have a moment, we'd love it if you could leave us a quick Google review — it helps our small business more than you know:`,
    '',
    url || '[Add your Google Review link in Settings]',
    '',
    `It only takes a minute and means the world to us. Thank you!`,
    '',
    `— The ${shopName} Team`,
  ].join('\n');

  document.getElementById('review-to').textContent = email || '—';
  document.getElementById('review-subject').textContent = subject;
  document.getElementById('review-body-preview').textContent = body;

  // mailto link
  _reviewMailto = `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

  // Show/hide warnings
  document.getElementById('review-no-email-warn').style.display = email ? 'none' : '';
  document.getElementById('review-no-url-warn').style.display = url ? 'none' : '';
  document.getElementById('review-email-preview').style.display = email ? '' : 'none';
  document.getElementById('review-email-btn').disabled = !email;

  openModal('review-modal');
}

function sendReviewEmail() {
  if (!_reviewMailto) return;
  window.location.href = _reviewMailto;
  setTimeout(() => closeModal('review-modal'), 800);
}

function copyReviewLink() {
  const url = getSettings().reviewUrl || '';
  if (!url) { toast('No review link configured — add it in Settings', 'error'); return; }
  navigator.clipboard.writeText(url).then(() => toast('Review link copied'));
}
document.addEventListener('dragover', e => {
  document.querySelectorAll('.kanban-col').forEach(c => { if (!c.contains(e.target)) c.classList.remove('drag-over'); });
});

/* ── INSPECTIONS ── */
const DVI_ITEMS = {
  exterior: ['Body Condition', 'Glass / Windshield', 'Lights — Front', 'Lights — Rear', 'Wipers / Washers', 'Mirrors'],
  underhood: ['Engine Oil Level', 'Coolant Level', 'Brake Fluid', 'Power Steering Fluid', 'Transmission Fluid', 'Belts & Hoses', 'Battery & Terminals', 'Air Filter'],
  brakes: ['Front Brake Pads', 'Rear Brake Pads', 'Front Rotors', 'Rear Rotors', 'Tire Tread — FL', 'Tire Tread — FR', 'Tire Tread — RL', 'Tire Tread — RR', 'Tire Pressure', 'Spare Tire'],
  interior: ['Horn', 'Seat Belts', 'A/C & Heating', 'Check Engine Light', 'Other Warning Lights', 'Windshield Wipers', 'Interior Lights'],
};
let dviState = {};

function renderInspections() {
  const all = [...DB.inspections()].sort((a, b) => b.created - a.created);
  const list = document.getElementById('inspections-list');
  if (!all.length) {
    list.innerHTML = `<div class="empty-state"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg><p>No inspections yet</p></div>`;
    return;
  }
  list.innerHTML = all.map(insp => {
    const c = DB.customers().find(x => x.id === insp.customerId);
    const v = DB.vehicles().find(x => x.id === insp.vehicleId);
    const results = Object.values(insp.results || {});
    const critical = results.filter(r => r === 'critical').length;
    const attention = results.filter(r => r === 'attention').length;
    const ok = results.filter(r => r === 'ok').length;
    const total = results.length;
    const score = total ? Math.round((ok / total) * 100) : null;
    return `<div class="data-card">
      <div class="data-card-info">
        <div class="data-card-name">${c ? c.first + ' ' + c.last : 'Unknown'} — ${v ? v.year + ' ' + v.make + ' ' + v.model : 'Unknown vehicle'}</div>
        <div class="data-card-sub">${fmtDate(insp.created)}${insp.notes ? ' · ' + insp.notes.slice(0, 50) : ''}</div>
      </div>
      <div style="display:flex;gap:6px;align-items:center;flex-shrink:0">
        ${critical ? `<span class="badge badge-urgent">${critical} critical</span>` : ''}
        ${attention ? `<span class="badge badge-high">${attention} attention</span>` : ''}
        ${score !== null ? `<span class="badge badge-${score >= 80 ? 'completed' : score >= 50 ? 'in-progress' : 'open'}">${score}% OK</span>` : ''}
      </div>
      <button class="btn-danger" onclick="event.stopPropagation();deleteInspection('${insp.id}')">Delete</button>
    </div>`;
  }).join('');
}

async function deleteInspection(id) {
  const ok = await confirm('Delete Inspection', 'Delete this inspection report?');
  if (!ok) return;
  const snapshot = DB.inspections();
  DB.save('inspections', DB.inspections().filter(i => i.id !== id));
  renderInspections();
  toast('Inspection deleted', 'error', () => { DB.save('inspections', snapshot); renderInspections(); toast('Undo successful'); });
}

function openDVIModal(preCustomerId = null) {
  dviState = {};
  document.getElementById('dvif-id').value = '';
  document.getElementById('dvif-notes').value = '';
  populateCustomerSelects();
  if (preCustomerId) {
    document.getElementById('dvif-customer').value = preCustomerId;
    updateVehicleSelect('dvif-vehicle', preCustomerId);
  } else {
    document.getElementById('dvif-vehicle').innerHTML = '<option value="">Select…</option>';
  }
  Object.entries(DVI_ITEMS).forEach(([section, items]) => {
    document.getElementById('dvi-' + section).innerHTML = items.map((item, idx) => `
      <div class="dvi-item" id="dvi-item-${section}-${idx}">
        <span class="dvi-item-label">${item}</span>
        <div class="dvi-status-btns">
          <button type="button" class="dvi-btn" data-val="ok" onclick="setDVI('${item}','ok',this)">OK</button>
          <button type="button" class="dvi-btn" data-val="attention" onclick="setDVI('${item}','attention',this)">Attention</button>
          <button type="button" class="dvi-btn" data-val="critical" onclick="setDVI('${item}','critical',this)">Critical</button>
        </div>
      </div>`).join('');
  });
  openModal('dvi-modal');
}

function setDVI(item, val, btn) {
  dviState[item] = val;
  const row = btn.closest('.dvi-item');
  row.className = 'dvi-item status-' + val;
  btn.closest('.dvi-status-btns').querySelectorAll('.dvi-btn').forEach(b => b.classList.remove('selected'));
  btn.classList.add('selected');
}

document.getElementById('dvif-customer').addEventListener('change', e => updateVehicleSelect('dvif-vehicle', e.target.value));

document.getElementById('dvi-form').addEventListener('submit', e => {
  e.preventDefault();
  const insp = {
    id: uid(),
    customerId: document.getElementById('dvif-customer').value,
    vehicleId: document.getElementById('dvif-vehicle').value,
    results: { ...dviState },
    notes: document.getElementById('dvif-notes').value.trim(),
    created: Date.now(),
  };
  const all = DB.inspections(); all.push(insp);
  DB.save('inspections', all);
  closeModal('dvi-modal'); renderInspections(); renderDashboard();
  toast('Inspection saved');
});

/* ── INVOICES ── */
let invoiceFilter = 'all';
let invoiceSearch = '';

function invoiceDateStart(f) {
  const now = new Date();
  if (f === 'today') return new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  if (f === 'week') { const d = new Date(now); d.setDate(now.getDate() - now.getDay()); d.setHours(0,0,0,0); return d.getTime(); }
  if (f === 'month') return new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  return 0;
}

function renderInvoices() {
  let orders = [...DB.orders()].sort((a, b) => b.created - a.created);
  if (invoiceFilter === 'completed') {
    orders = orders.filter(o => o.status === 'completed');
  } else {
    const since = invoiceDateStart(invoiceFilter);
    if (since) orders = orders.filter(o => (o.updated || o.created) >= since);
  }
  if (invoiceSearch) {
    const q = invoiceSearch.toLowerCase();
    orders = orders.filter(o => {
      const c = DB.customers().find(x => x.id === o.customerId);
      const v = DB.vehicles().find(x => x.id === o.vehicleId);
      return (o.desc || '').toLowerCase().includes(q) ||
        (c ? (c.first + ' ' + c.last).toLowerCase().includes(q) : false) ||
        (v ? (v.plate + ' ' + v.make + ' ' + v.model).toLowerCase().includes(q) : false) ||
        String(o.total || '').includes(q);
    });
  }
  const list = document.getElementById('invoices-list');
  if (!orders.length) {
    list.innerHTML = `<div class="empty-state"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg><p>No invoices match your filter.</p></div>`;
    return;
  }
  const totalRevenue = orders.filter(o => o.status === 'completed').reduce((s, o) => s + (o.total || 0), 0);
  list.innerHTML = `<div style="display:flex;gap:12px;margin-bottom:16px;flex-wrap:wrap">
    <div class="glass-card" style="padding:14px 20px;flex:1;min-width:180px">
      <div style="font-size:.72rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px">Total Invoiced</div>
      <div style="font-size:1.5rem;font-weight:800;color:var(--accent)">${fmt(orders.reduce((s,o)=>s+(o.total||0),0))}</div>
    </div>
    <div class="glass-card" style="padding:14px 20px;flex:1;min-width:180px">
      <div style="font-size:.72rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px">Collected</div>
      <div style="font-size:1.5rem;font-weight:800;color:var(--accent)">${fmt(totalRevenue)}</div>
    </div>
    <div class="glass-card" style="padding:14px 20px;flex:1;min-width:180px">
      <div style="font-size:.72rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px">Outstanding</div>
      <div style="font-size:1.5rem;font-weight:800;color:var(--amber)">${fmt(orders.filter(o=>o.status!=='completed').reduce((s,o)=>s+(o.total||0),0))}</div>
    </div>
  </div>` + orders.map((o, i) => {
    const c = DB.customers().find(x => x.id === o.customerId);
    const v = DB.vehicles().find(x => x.id === o.vehicleId);
    const invNum = 'INV-' + String(i + 1).padStart(4, '0');
    return `<div class="data-card">
      <div class="data-card-info">
        <div class="data-card-name">${invNum} — ${c ? c.first + ' ' + c.last : 'Unknown'}</div>
        <div class="data-card-sub">${v ? v.year + ' ' + v.make + ' ' + v.model : '—'} · ${fmtDate(o.created)}</div>
      </div>
      <span class="badge badge-${o.status}">${o.status.replace('-', ' ')}</span>
      <div style="font-weight:800;font-size:1.05rem;color:var(--accent)">${fmt(o.total)}</div>
      <button class="btn-ghost btn-sm" onclick="printInvoice('${o.id}',${i + 1})">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" width="13" height="13"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
        Print
      </button>
    </div>`;
  }).join('');
}

document.querySelectorAll('#invoice-tabs .filter-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('#invoice-tabs .filter-tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active'); invoiceFilter = tab.dataset.ifilter; renderInvoices();
  });
});
document.getElementById('invoice-search').addEventListener('input', e => { invoiceSearch = e.target.value.trim(); renderInvoices(); });

function printInvoice(id, num) {
  const o = DB.orders().find(x => x.id === id);
  const c = DB.customers().find(x => x.id === o?.customerId);
  const v = DB.vehicles().find(x => x.id === o?.vehicleId);
  const s = getSettings();
  const invNum = 'INV-' + String(num).padStart(4, '0');
  const w = window.open('', '_blank');
  if (!w) { toast('Pop-up blocked — allow pop-ups to print invoices', 'error'); return; }
  w.document.write(`<!DOCTYPE html><html><head><title>${invNum}</title>
  <style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:'Segoe UI',sans-serif;max-width:680px;margin:40px auto;color:#111;padding:0 20px}
  .header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:32px;padding-bottom:20px;border-bottom:2px solid #22C55E}
  .shop-name{font-size:1.4rem;font-weight:800;color:#111}.shop-info{font-size:.8rem;color:#666;margin-top:4px}
  .inv-title{font-size:1.8rem;font-weight:800;color:#22C55E}.inv-num{font-size:.85rem;color:#666}
  .section{margin-bottom:20px}.section-title{font-size:.72rem;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#999;margin-bottom:8px}
  .info-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}.info-box{background:#f9f9f9;border-radius:6px;padding:10px 14px}
  .info-label{font-size:.72rem;color:#999;margin-bottom:2px}.info-val{font-size:.9rem;font-weight:600}
  table{width:100%;border-collapse:collapse;margin:12px 0}th,td{padding:9px 12px;text-align:left;border-bottom:1px solid #eee}
  th{background:#f5f5f5;font-size:.72rem;text-transform:uppercase;letter-spacing:.05em;color:#888}
  .right{text-align:right}.totals{display:flex;flex-direction:column;align-items:flex-end;gap:4px;margin-top:12px}
  .total-row{display:flex;gap:40px;justify-content:flex-end;font-size:.875rem;color:#555}
  .total-final{font-size:1.1rem;font-weight:800;color:#111;border-top:2px solid #111;padding-top:6px;margin-top:4px}
  .footer{margin-top:40px;padding-top:16px;border-top:1px solid #eee;font-size:.78rem;color:#999;text-align:center}
  @media print{body{margin:0}}</style></head><body>
  <div class="header">
    <div><div class="shop-name">${s.name}</div><div class="shop-info">${[s.phone,s.email,s.address].filter(Boolean).join(' · ')}</div></div>
    <div style="text-align:right"><div class="inv-title">${invNum}</div><div class="inv-num">Date: ${fmtDate(o.created)}</div></div>
  </div>
  <div class="section"><div class="info-grid">
    <div class="info-box"><div class="info-label">Bill To</div><div class="info-val">${c ? c.first + ' ' + c.last : '—'}</div><div style="font-size:.82rem;color:#666;margin-top:2px">${c?.phone || ''}</div></div>
    <div class="info-box"><div class="info-label">Vehicle</div><div class="info-val">${v ? v.year + ' ' + v.make + ' ' + v.model : '—'}</div><div style="font-size:.82rem;color:#666;margin-top:2px">${v?.plate || ''}</div></div>
  </div></div>
  ${o.desc ? `<div class="section"><div class="section-title">Description</div><div style="background:#f9f9f9;border-radius:6px;padding:10px 14px;font-size:.88rem">${o.desc}</div></div>` : ''}
  <table><tr><th>Item / Service</th><th class="right">Qty</th><th class="right">Unit Price</th><th class="right">Total</th></tr>
  ${(o.lines || []).map(l => `<tr><td>${l.desc || '—'}</td><td class="right">${l.qty || 1}</td><td class="right">${fmt(l.price || 0)}</td><td class="right">${fmt((l.qty || 1) * (l.price || 0))}</td></tr>`).join('')}
  </table>
  <div class="totals">
    <div class="total-row"><span>Subtotal</span><span>${fmt(o.subtotal || 0)}</span></div>
    <div class="total-row"><span>Tax (${s.tax}%)</span><span>${fmt(o.tax || 0)}</span></div>
    <div class="total-row total-final"><span>Total Due</span><span>${fmt(o.total || 0)}</span></div>
  </div>
  ${o.notes ? `<div class="section" style="margin-top:20px"><div class="section-title">Notes</div><div style="font-size:.84rem;color:#555">${o.notes}</div></div>` : ''}
  <div class="footer">Thank you for your business! — ${s.name}${s.phone ? ' · ' + s.phone : ''}</div>
  <script>window.onload=()=>window.print()<\/script></body></html>`);
}

/* ── APPOINTMENTS ── */
function fmtTime(t) {
  if (!t) return '';
  const [h, m] = t.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${ampm}`;
}

function renderAppointments() {
  const all = [...DB.appointments()].sort((a, b) => {
    const da = a.date + ' ' + a.time, db = b.date + ' ' + b.time;
    return da.localeCompare(db);
  });
  const list = document.getElementById('appt-list');
  if (!all.length) {
    list.innerHTML = `<div class="empty-state"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg><p>No appointments scheduled.</p></div>`;
    return;
  }
  const today = new Date().toISOString().slice(0, 10);
  let lastDate = '';
  list.innerHTML = all.map(a => {
    const c = DB.customers().find(x => x.id === a.customerId);
    const v = DB.vehicles().find(x => x.id === a.vehicleId);
    const isToday = a.date === today;
    const isPast = a.date < today;
    let header = '';
    if (a.date !== lastDate) {
      lastDate = a.date;
      const d = new Date(a.date + 'T00:00:00');
      const label = isToday ? 'Today' : d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
      header = `<div style="font-size:.75rem;font-weight:700;color:${isToday ? 'var(--accent)' : 'var(--text-muted)'};text-transform:uppercase;letter-spacing:.06em;margin:${lastDate === a.date ? '0' : '12px'} 0 8px;${isPast ? 'opacity:.5' : ''}">${label}</div>`;
    }
    return header + `<div class="appt-card${isToday ? ' appt-today' : ''}" style="margin-bottom:8px;opacity:${isPast && !isToday ? '.55' : '1'}">
      <div class="appt-time-block">
        <div class="appt-time">${fmtTime(a.time)}</div>
        <div class="appt-date-text">${new Date(a.date + 'T00:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric'})}</div>
      </div>
      <div class="appt-info">
        <div class="appt-reason">${a.reason}</div>
        <div class="appt-who">${c ? c.first + ' ' + c.last : 'Walk-in'}${v ? ' · ' + v.year + ' ' + v.make + ' ' + v.model : ''}</div>
        ${a.notes ? `<div style="font-size:.75rem;color:var(--text-dim);margin-top:2px">${a.notes}</div>` : ''}
      </div>
      <div style="display:flex;gap:6px;flex-shrink:0">
        <button class="btn-ghost btn-sm" onclick="navigate('repair-orders');openROModal(null,'${a.customerId || ''}')">New RO</button>
        <button class="btn-danger" onclick="deleteAppt('${a.id}')">Delete</button>
      </div>
    </div>`;
  }).join('');
}

function openApptModal(preCustomerId = null) {
  populateCustomerSelects();
  populateServiceSelect('apptf-reason');
  document.getElementById('apptf-id').value = '';
  document.getElementById('apptf-date').value = new Date().toISOString().slice(0, 10);
  document.getElementById('apptf-time').value = '09:00';
  document.getElementById('apptf-notes').value = '';
  // reset inline panels
  ['panel-appt-customer','panel-appt-vehicle','panel-new-service'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.classList.remove('open');
  });
  const toggleApptC = document.getElementById('toggle-appt-customer');
  if (toggleApptC) toggleApptC.textContent = '+ New Customer';
  const toggleApptV = document.getElementById('toggle-appt-vehicle');
  if (toggleApptV) toggleApptV.textContent = '+ New Vehicle';
  if (preCustomerId) {
    document.getElementById('apptf-customer').value = preCustomerId;
    updateVehicleSelect('apptf-vehicle', preCustomerId);
  } else {
    document.getElementById('apptf-vehicle').innerHTML = '<option value="">Select vehicle…</option>';
  }
  openModal('appt-modal');
}

function quickAddCustomerAppt() {
  const first = (document.getElementById('qca-first').value || '').trim();
  const last = (document.getElementById('qca-last').value || '').trim();
  const phone = (document.getElementById('qca-phone').value || '').trim();
  if (!first && !last) { toast('Enter at least a first or last name', 'error'); return; }
  const c = { id: uid(), first: first || 'Unknown', last: last || '', phone, email: '', notes: '', created: Date.now() };
  const customers = DB.customers(); customers.push(c); DB.save('customers', customers);
  populateCustomerSelects();
  document.getElementById('apptf-customer').value = c.id;
  updateVehicleSelect('apptf-vehicle', c.id);
  ['qca-first','qca-last','qca-phone'].forEach(id => document.getElementById(id).value = '');
  document.getElementById('panel-appt-customer').classList.remove('open');
  document.getElementById('toggle-appt-customer').textContent = '+ New Customer';
  toast(`Customer ${c.first} ${c.last} added`);
}

function quickAddVehicleAppt() {
  const plate = (document.getElementById('qva-plate').value || '').trim().toUpperCase();
  const year = (document.getElementById('qva-year').value || '').trim();
  const make = (document.getElementById('qva-make').value || '').trim();
  const model = (document.getElementById('qva-model').value || '').trim();
  if (!plate && !make) { toast('Enter at least a plate or make', 'error'); return; }
  const customerId = document.getElementById('apptf-customer').value || null;
  const v = { id: uid(), customerId, plate, year, make, model, color: '', vin: '', mileage: 0, nextService: 0, serviceNotes: '', created: Date.now() };
  const vehicles = DB.vehicles(); vehicles.push(v); DB.save('vehicles', vehicles);
  updateVehicleSelect('apptf-vehicle', customerId, v.id);
  ['qva-plate','qva-year','qva-make','qva-model'].forEach(id => document.getElementById(id).value = '');
  document.getElementById('panel-appt-vehicle').classList.remove('open');
  document.getElementById('toggle-appt-vehicle').textContent = '+ New Vehicle';
  toast(`Vehicle added & selected`);
}

document.getElementById('apptf-customer').addEventListener('change', e => updateVehicleSelect('apptf-vehicle', e.target.value));

document.getElementById('appt-form').addEventListener('submit', e => {
  e.preventDefault();
  const appt = {
    id: document.getElementById('apptf-id').value || uid(),
    customerId: document.getElementById('apptf-customer').value,
    vehicleId: document.getElementById('apptf-vehicle').value,
    date: document.getElementById('apptf-date').value,
    time: document.getElementById('apptf-time').value,
    reason: document.getElementById('apptf-reason').value.trim(),
    notes: document.getElementById('apptf-notes').value.trim(),
    created: Date.now(),
  };
  const all = DB.appointments();
  const idx = all.findIndex(x => x.id === appt.id);
  if (idx >= 0) all[idx] = appt; else all.push(appt);
  DB.save('appointments', all);
  closeModal('appt-modal'); renderAppointments(); renderDashboard();
  toast('Appointment booked');
});

async function deleteAppt(id) {
  const ok = await confirm('Delete Appointment', 'Remove this appointment?');
  if (!ok) return;
  const snapshot = DB.appointments();
  DB.save('appointments', DB.appointments().filter(a => a.id !== id));
  renderAppointments(); renderDashboard();
  toast('Appointment deleted', 'error', () => { DB.save('appointments', snapshot); renderAppointments(); renderDashboard(); toast('Undo successful'); });
}

/* ── PLATE SCANNER ── */
document.getElementById('tab-camera').addEventListener('click', () => {
  document.getElementById('tab-camera').classList.add('active');
  document.getElementById('tab-manual').classList.remove('active');
  document.getElementById('camera-panel').style.display = '';
  document.getElementById('manual-panel').style.display = 'none';
});
document.getElementById('tab-manual').addEventListener('click', () => {
  document.getElementById('tab-manual').classList.add('active');
  document.getElementById('tab-camera').classList.remove('active');
  document.getElementById('manual-panel').style.display = '';
  document.getElementById('camera-panel').style.display = 'none';
});

document.getElementById('start-camera-btn').addEventListener('click', async () => {
  try {
    cameraStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 } } });
    document.getElementById('scanner-video').srcObject = cameraStream;
    document.getElementById('start-camera-btn').style.display = 'none';
    document.getElementById('capture-btn').style.display = '';
    document.getElementById('ocr-status').textContent = 'Camera ready — position plate in the frame and capture';
  } catch {
    toast('Camera access denied or unavailable.', 'error');
  }
});

document.getElementById('capture-btn').addEventListener('click', async () => {
  const video = document.getElementById('scanner-video');
  const canvas = document.getElementById('scan-canvas');
  canvas.width = video.videoWidth || 640;
  canvas.height = video.videoHeight || 480;
  canvas.getContext('2d').drawImage(video, 0, 0);

  document.getElementById('ocr-status').textContent = 'Analyzing image…';
  document.getElementById('capture-btn').disabled = true;

  // Crop the plate region (center strip) for better OCR accuracy
  const cropCanvas = document.createElement('canvas');
  const cw = canvas.width, ch = canvas.height;
  const cx = Math.floor(cw * 0.2), cy = Math.floor(ch * 0.38);
  const cWidth = Math.floor(cw * 0.6), cHeight = Math.floor(ch * 0.24);
  cropCanvas.width = cWidth; cropCanvas.height = cHeight;
  cropCanvas.getContext('2d').drawImage(canvas, cx, cy, cWidth, cHeight, 0, 0, cWidth, cHeight);

  try {
    if (typeof Tesseract !== 'undefined') {
      const result = await Tesseract.recognize(cropCanvas, 'eng', {
        tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-',
      });
      const raw = result.data.text.replace(/[^A-Z0-9\-]/gi, '').trim().toUpperCase();
      const plateMatch = raw.match(/[A-Z0-9]{2,8}/g);
      const detected = plateMatch ? plateMatch.sort((a, b) => b.length - a.length)[0] : null;
      if (detected && detected.length >= 3) {
        document.getElementById('detected-plate-text').textContent = detected;
        document.getElementById('plate-result-bar').style.display = 'flex';
        document.getElementById('use-plate-btn').onclick = () => searchPlate(detected);
        document.getElementById('ocr-status').textContent = `Detected: ${detected} — confidence ${Math.round(result.data.confidence)}%`;
      } else {
        document.getElementById('ocr-status').textContent = 'Could not read plate clearly — try again or use manual entry';
      }
    } else {
      // Tesseract not loaded — prompt manual
      document.getElementById('ocr-status').textContent = 'OCR unavailable — please use Manual Entry';
      document.getElementById('tab-manual').click();
    }
  } catch {
    document.getElementById('ocr-status').textContent = 'OCR error — please use Manual Entry';
  }
  document.getElementById('capture-btn').disabled = false;
});

document.getElementById('manual-search-btn').addEventListener('click', () => {
  const plate = document.getElementById('plate-manual-input').value.trim().toUpperCase();
  if (!plate) { toast('Enter a plate number', 'error'); return; }
  searchPlate(plate);
});
document.getElementById('plate-manual-input').addEventListener('keydown', e => {
  if (e.key === 'Enter') document.getElementById('manual-search-btn').click();
});

function searchPlate(plate) {
  const norm = normPlate(plate);
  const vehicles = DB.vehicles().filter(v => normPlate(v.plate) === norm);
  const results = document.getElementById('scanner-results');
  if (!vehicles.length) {
    results.innerHTML = `
      <div style="text-align:center;padding:32px 16px">
        <div style="font-size:2rem;font-weight:800;color:var(--accent);letter-spacing:.2em;margin-bottom:12px;font-family:monospace">${plate}</div>
        <div style="color:var(--text-muted);font-size:.9rem;margin-bottom:20px">No records found for this plate.</div>
        <div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap">
          <button class="btn-primary" onclick="prefillNewVehicle('${plate}')">Register this Vehicle</button>
          <button class="btn-ghost" onclick="navigate('customers');openCustomerModal()">Add New Customer</button>
        </div>
      </div>`;
    return;
  }
  results.innerHTML = vehicles.map(v => {
    const c = DB.customers().find(x => x.id === v.customerId);
    const orders = [...DB.orders().filter(o => o.vehicleId === v.id)].sort((a, b) => b.created - a.created);
    const totalSpent = orders.reduce((s, o) => s + (o.total || 0), 0);
    const mileageWarning = v.nextService && v.mileage && +v.mileage >= +v.nextService;
    return `<div>
      <div style="display:flex;align-items:center;gap:14px;margin-bottom:16px;padding-bottom:16px;border-bottom:1px solid var(--border)">
        <div style="font-size:1.8rem;font-weight:800;color:var(--accent);letter-spacing:.18em;font-family:monospace">${plate}</div>
        <div>
          <div style="font-weight:700;font-size:1rem">${v.year} ${v.make} ${v.model}</div>
          <div style="color:var(--text-muted);font-size:.82rem">${[v.color, v.mileage ? v.mileage.toLocaleString() + ' mi' : ''].filter(Boolean).join(' · ')}${mileageWarning ? ' <span style="color:var(--amber)">⚠ Service Due</span>' : ''}</div>
        </div>
      </div>
      ${v.serviceNotes ? `<div style="padding:10px 13px;background:rgba(245,158,11,0.08);border:1px solid rgba(245,158,11,0.2);border-radius:8px;font-size:.82rem;color:var(--amber);margin-bottom:14px">📋 ${v.serviceNotes}</div>` : ''}
      ${c ? `<div style="display:flex;align-items:center;gap:10px;padding:12px;background:var(--glass);border-radius:8px;border:1px solid var(--border);margin-bottom:14px;cursor:pointer" onclick="openCustomerDetail('${c.id}')">
        <div style="width:36px;height:36px;border-radius:50%;background:${avatarColor(c.first)};display:flex;align-items:center;justify-content:center;font-weight:700;color:#000;flex-shrink:0">${c.first[0]}${c.last[0]}</div>
        <div style="flex:1"><div style="font-weight:600;font-size:.9rem">${c.first} ${c.last}</div><div style="font-size:.78rem;color:var(--text-muted)">${c.phone}${c.email ? ' · ' + c.email : ''}</div></div>
        <div style="text-align:right"><div style="font-weight:700;color:var(--accent);font-size:.9rem">${fmt(totalSpent)}</div><div style="font-size:.7rem;color:var(--text-dim)">total spent</div></div>
      </div>` : ''}
      <div style="font-size:.75rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.05em;margin-bottom:8px">Repair History (${orders.length})</div>
      ${orders.length ? orders.slice(0, 5).map(o => `
        <div class="order-item" style="margin-bottom:6px;cursor:pointer" onclick="navigate('repair-orders');openROModal('${o.id}')">
          <div class="order-item-info">
            <div class="order-item-name">${o.desc || 'Service'}</div>
            <div class="order-item-plate">${fmtDate(o.created)}</div>
          </div>
          <span class="badge badge-${o.status}">${o.status.replace('-',' ')}</span>
          <div class="order-item-amount">${fmt(o.total)}</div>
        </div>`).join('') : '<p style="color:var(--text-dim);font-size:.84rem;margin-bottom:12px">No repair orders on file.</p>'}
      <div style="display:flex;gap:8px;margin-top:16px;flex-wrap:wrap">
        <button class="btn-primary" onclick="navigate('repair-orders');openROModal(null,'${c?.id || ''}')">New Repair Order</button>
        <button class="btn-ghost" onclick="openDVIModal('${c?.id || ''}')">New Inspection</button>
        ${c ? `<button class="btn-ghost" onclick="navigate('appointments');openApptModal('${c.id}')">Book Appointment</button>` : ''}
      </div>
    </div>`;
  }).join('');
}

function prefillNewVehicle(plate) {
  navigate('vehicles');
  openVehicleModal(null);
  setTimeout(() => { document.getElementById('vf-plate').value = normPlate(plate); }, 50);
}

/* ── EXPORT / IMPORT ── */
function openExportModal() { openModal('export-modal'); }

function exportData() {
  const data = {
    version: 1,
    exported: new Date().toISOString(),
    customers: DB.customers(),
    vehicles: DB.vehicles(),
    orders: DB.orders(),
    inspections: DB.inspections(),
    appointments: DB.appointments(),
    settings: DB.settings(),
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `shaiAI-backup-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
  toast('Backup downloaded');
}

function importData(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = evt => {
    try {
      const data = JSON.parse(evt.target.result);
      if (data.customers) { const merged = mergeById(DB.customers(), data.customers); DB.save('customers', merged); }
      if (data.vehicles) { const merged = mergeById(DB.vehicles(), data.vehicles); DB.save('vehicles', merged); }
      if (data.orders) { const merged = mergeById(DB.orders(), data.orders); DB.save('orders', merged); }
      if (data.inspections) { const merged = mergeById(DB.inspections(), data.inspections); DB.save('inspections', merged); }
      if (data.appointments) { const merged = mergeById(DB.appointments(), data.appointments); DB.save('appointments', merged); }
      if (data.settings) DB.set('settings', data.settings);
      closeModal('export-modal');
      applySettings(); refreshView(currentView); renderDashboard();
      toast('Data imported successfully');
    } catch { toast('Invalid backup file', 'error'); }
  };
  reader.readAsText(file);
  e.target.value = '';
}

function mergeById(existing, incoming) {
  const map = new Map(existing.map(x => [x.id, x]));
  incoming.forEach(x => { if (!map.has(x.id)) map.set(x.id, x); });
  return [...map.values()];
}

/* ── UTILITIES ── */
function escHtml(s) { return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

/* ── SEED DEMO ── */
function seedDemo() {
  if (DB.customers().length) return;
  const c1 = { id: uid(), first: 'James', last: 'Anderson', phone: '(555) 102-3847', email: 'james@email.com', notes: 'Prefers appointments before noon.', created: Date.now() - 8e8 };
  const c2 = { id: uid(), first: 'Maria', last: 'Gonzalez', phone: '(555) 987-6543', email: 'maria@email.com', notes: '', created: Date.now() - 5e8 };
  const c3 = { id: uid(), first: 'David', last: 'Kim', phone: '(555) 321-7890', email: 'dkim@email.com', notes: 'Fleet account.', created: Date.now() - 2e8 };
  DB.save('customers', [c1, c2, c3]);

  const v1 = { id: uid(), customerId: c1.id, year: '2018', make: 'Toyota', model: 'Camry', plate: 'TYO-4821', color: 'Silver', vin: '4T1BF1FK8EU123456', mileage: 72400, nextService: 75000, serviceNotes: 'Customer requested synthetic oil only.', created: Date.now() - 7e8 };
  const v2 = { id: uid(), customerId: c2.id, year: '2021', make: 'Honda', model: 'CR-V', plate: 'HND-9982', color: 'Blue', vin: '2HKRW2H85MH123456', mileage: 31200, nextService: 0, serviceNotes: '', created: Date.now() - 4e8 };
  const v3 = { id: uid(), customerId: c3.id, year: '2019', make: 'Ford', model: 'F-150', plate: 'FRD-1150', color: 'Black', vin: '1FTEW1EP5KFA12345', mileage: 98000, nextService: 100000, serviceNotes: 'Commercial vehicle — fleet discount applies.', created: Date.now() - 1.5e8 };
  DB.save('vehicles', [v1, v2, v3]);

  const o1 = { id: uid(), customerId: c1.id, vehicleId: v1.id, status: 'completed', priority: 'normal', desc: 'Oil change + tire rotation', lines: [{desc:'Full Synthetic Oil Change',qty:1,price:79.99},{desc:'Tire Rotation',qty:1,price:24.99}], subtotal:104.98, tax:10.50, total:115.48, created: Date.now() - 6e8, updated: Date.now() - 5.9e8 };
  const o2 = { id: uid(), customerId: c2.id, vehicleId: v2.id, status: 'in-progress', priority: 'high', desc: 'Front brake pad & rotor replacement', lines: [{desc:'Front Brake Pads',qty:1,price:89.99},{desc:'Front Rotors (pair)',qty:1,price:129.99},{desc:'Labor',qty:1.5,price:85}], subtotal:347.48, tax:34.75, total:382.23, created: Date.now() - 1e7, updated: Date.now() - 5e6 };
  const o3 = { id: uid(), customerId: c3.id, vehicleId: v3.id, status: 'open', priority: 'urgent', desc: 'Check engine light — misfire on cyl 3', lines: [{desc:'Diagnostic',qty:1,price:95},{desc:'Spark Plugs (set of 8)',qty:1,price:89.99},{desc:'Ignition Coil #3',qty:1,price:49.99},{desc:'Labor',qty:2,price:85}], subtotal:404.98, tax:40.50, total:445.48, created: Date.now() - 8e5, updated: Date.now() - 8e5 };
  DB.save('orders', [o1, o2, o3]);

  const today = new Date().toISOString().slice(0, 10);
  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  DB.save('appointments', [
    { id: uid(), customerId: c1.id, vehicleId: v1.id, date: today, time: '10:00', reason: 'Oil change follow-up check', notes: '', created: Date.now() },
    { id: uid(), customerId: c2.id, vehicleId: v2.id, date: tomorrow, time: '14:30', reason: 'Brake job pickup', notes: 'Customer will call ahead', created: Date.now() },
  ]);
}

/* ── INIT ── */
seedDemo();
applySettings();
navigate('dashboard');
