// ── Storage helpers ──
const DB = {
  get: k => JSON.parse(localStorage.getItem('shai_' + k) || '[]'),
  set: (k, v) => localStorage.setItem('shai_' + k, JSON.stringify(v)),
  customers: () => DB.get('customers'),
  vehicles: () => DB.get('vehicles'),
  orders: () => DB.get('orders'),
  inspections: () => DB.get('inspections'),
  saveCustomers: v => DB.set('customers', v),
  saveVehicles: v => DB.set('vehicles', v),
  saveOrders: v => DB.set('orders', v),
  saveInspections: v => DB.set('inspections', v),
};

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const fmt = n => '$' + (+n).toFixed(2);
const fmtDate = d => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

const COLORS = ['#22C55E','#3B82F6','#A855F7','#F59E0B','#EF4444','#06B6D4','#EC4899'];
const avatarColor = str => COLORS[str.charCodeAt(0) % COLORS.length];

function toast(msg, type = 'success') {
  const t = document.createElement('div');
  t.className = 'toast ' + type;
  t.textContent = msg;
  document.getElementById('toast-container').appendChild(t);
  setTimeout(() => { t.style.animation = 'toastOut 0.3s ease forwards'; setTimeout(() => t.remove(), 300); }, 3000);
}

// ── Navigation ──
let currentView = 'dashboard';
let cameraStream = null;

function navigate(view) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  const el = document.getElementById('view-' + view);
  if (el) { el.classList.add('active'); currentView = view; }
  const nav = document.querySelector(`.nav-item[data-view="${view}"]`);
  if (nav) nav.classList.add('active');
  if (view !== 'scanner' && cameraStream) { cameraStream.getTracks().forEach(t => t.stop()); cameraStream = null; }
  refreshView(view);
}

function refreshView(view) {
  if (view === 'dashboard') renderDashboard();
  if (view === 'customers') renderCustomers();
  if (view === 'vehicles') renderVehicles();
  if (view === 'repair-orders') renderOrders();
  if (view === 'inspections') renderInspections();
  if (view === 'invoices') renderInvoices();
}

// ── Modal helpers ──
function openModal(id) { document.getElementById(id).classList.add('open'); }
function closeModal(id) { document.getElementById(id).classList.remove('open'); }

document.addEventListener('click', e => {
  const mc = e.target.closest('.modal-close');
  if (mc) closeModal(mc.dataset.modal);
  const mb = e.target.closest('.modal-backdrop');
  if (mb && mb === e.target) closeModal(mb.id);
});

// ── Sidebar / nav ──
document.querySelectorAll('.nav-item').forEach(item => {
  item.addEventListener('click', e => {
    e.preventDefault();
    navigate(item.dataset.view);
    if (window.innerWidth <= 768) document.getElementById('sidebar').classList.remove('open');
  });
});

document.getElementById('menu-toggle').addEventListener('click', () => {
  document.getElementById('sidebar').classList.toggle('open');
});

document.querySelectorAll('.qa-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    navigate(btn.dataset.view);
    if (btn.dataset.action === 'new') {
      if (btn.dataset.view === 'customers') openCustomerModal();
      if (btn.dataset.view === 'repair-orders') openROModal();
      if (btn.dataset.view === 'inspections') openDVIModal();
    }
  });
});

document.querySelectorAll('.link-btn[data-view]').forEach(b => {
  b.addEventListener('click', () => navigate(b.dataset.view));
});

document.getElementById('quick-add-btn').addEventListener('click', () => {
  navigate('repair-orders');
  openROModal();
});

// ── DASHBOARD ──
function renderDashboard() {
  const orders = DB.orders();
  const customers = DB.customers();
  const inspections = DB.inspections();
  const open = orders.filter(o => o.status !== 'completed');
  const revenue = orders.filter(o => o.status === 'completed').reduce((s, o) => s + (o.total || 0), 0);

  document.getElementById('stat-open').textContent = open.length;
  document.getElementById('stat-customers').textContent = customers.length;
  document.getElementById('stat-revenue').textContent = fmt(revenue);
  document.getElementById('stat-inspections').textContent = inspections.length;
  document.getElementById('ro-badge').textContent = open.length;

  const list = document.getElementById('recent-orders-list');
  const recent = [...orders].sort((a, b) => b.created - a.created).slice(0, 5);
  if (!recent.length) {
    list.innerHTML = `<div class="empty-state"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg><p>No repair orders yet</p></div>`;
    return;
  }
  list.innerHTML = recent.map(o => {
    const c = DB.customers().find(x => x.id === o.customerId);
    const v = DB.vehicles().find(x => x.id === o.vehicleId);
    return `<div class="order-item">
      <div class="order-item-info">
        <div class="order-item-name">${c ? c.first + ' ' + c.last : 'Unknown'}</div>
        <div class="order-item-plate">${v ? (v.year + ' ' + v.make + ' ' + v.model + ' · ' + (v.plate || '—')) : '—'}</div>
      </div>
      <span class="badge badge-${o.status}">${o.status.replace('-', ' ')}</span>
      <div class="order-item-amount">${fmt(o.total || 0)}</div>
    </div>`;
  }).join('');
}

// ── CUSTOMERS ──
function renderCustomers(filter = '') {
  const all = DB.customers().filter(c =>
    !filter || (c.first + ' ' + c.last + ' ' + c.phone).toLowerCase().includes(filter.toLowerCase())
  );
  const list = document.getElementById('customers-list');
  if (!all.length) {
    list.innerHTML = `<div class="empty-state"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="9" cy="7" r="4"/><path d="M3 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2"/></svg><p>No customers found</p></div>`;
    return;
  }
  list.innerHTML = all.map(c => {
    const vehicles = DB.vehicles().filter(v => v.customerId === c.id);
    const orders = DB.orders().filter(o => o.customerId === c.id);
    const initials = (c.first[0] || '') + (c.last[0] || '');
    return `<div class="data-card" data-id="${c.id}" onclick="openCustomerDetail('${c.id}')">
      <div class="data-card-avatar" style="background:${avatarColor(c.first)};color:#000">${initials}</div>
      <div class="data-card-info">
        <div class="data-card-name">${c.first} ${c.last}</div>
        <div class="data-card-sub">${c.phone} · ${vehicles.length} vehicle${vehicles.length !== 1 ? 's' : ''} · ${orders.length} order${orders.length !== 1 ? 's' : ''}</div>
      </div>
      <div class="data-card-actions">
        <button class="btn-ghost btn-sm" onclick="event.stopPropagation();editCustomer('${c.id}')">Edit</button>
        <button class="btn-danger" onclick="event.stopPropagation();deleteCustomer('${c.id}')">Delete</button>
      </div>
    </div>`;
  }).join('');
}

document.getElementById('customer-search').addEventListener('input', e => renderCustomers(e.target.value));
document.getElementById('new-customer-btn').addEventListener('click', openCustomerModal);

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

function editCustomer(id) {
  const c = DB.customers().find(x => x.id === id);
  if (c) openCustomerModal(c);
}

function deleteCustomer(id) {
  if (!confirm('Delete this customer and all their data?')) return;
  DB.saveCustomers(DB.customers().filter(c => c.id !== id));
  DB.saveVehicles(DB.vehicles().filter(v => v.customerId !== id));
  DB.saveOrders(DB.orders().filter(o => o.customerId !== id));
  renderCustomers();
  renderDashboard();
  toast('Customer deleted');
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
  DB.saveCustomers(customers);
  closeModal('customer-modal');
  renderCustomers();
  renderDashboard();
  toast(idx >= 0 ? 'Customer updated' : 'Customer added');
});

function openCustomerDetail(id) {
  const c = DB.customers().find(x => x.id === id);
  if (!c) return;
  const vehicles = DB.vehicles().filter(v => v.customerId === id);
  const orders = DB.orders().filter(o => o.customerId === id);
  document.getElementById('cd-name').textContent = c.first + ' ' + c.last;
  document.getElementById('customer-detail-body').innerHTML = `
    <div class="cd-meta">
      <div class="cd-avatar" style="background:${avatarColor(c.first)};color:#000">${c.first[0]}${c.last[0]}</div>
      <div class="cd-info">
        <div class="cd-name">${c.first} ${c.last}</div>
        <div class="cd-phone">${c.phone}${c.email ? ' · ' + c.email : ''}</div>
      </div>
    </div>
    ${c.notes ? `<div style="color:var(--text-muted);font-size:.85rem;margin-bottom:16px;padding:10px 14px;background:var(--glass);border-radius:8px;border:1px solid var(--border)">${c.notes}</div>` : ''}
    <div style="display:flex;gap:10px;margin-bottom:16px">
      <button class="btn-primary btn-sm" onclick="closeModal('customer-detail-modal');editCustomer('${id}')">Edit Customer</button>
      <button class="btn-ghost btn-sm" onclick="closeModal('customer-detail-modal');navigate('repair-orders');openROModal(null,'${id}')">New Repair Order</button>
      <button class="btn-ghost btn-sm" onclick="closeModal('customer-detail-modal');openVehicleModal('${id}')">Add Vehicle</button>
    </div>
    <div class="cd-section-title">Vehicles (${vehicles.length})</div>
    ${vehicles.length ? vehicles.map(v => `
      <div class="data-card" style="margin-bottom:8px;cursor:default">
        <div class="data-card-info">
          <div class="data-card-name">${v.year || ''} ${v.make || ''} ${v.model || ''}</div>
          <div class="data-card-sub">${v.color ? v.color + ' · ' : ''}${v.mileage ? v.mileage.toLocaleString() + ' mi · ' : ''}VIN: ${v.vin || '—'}</div>
        </div>
        <span class="plate-badge">${v.plate || 'No plate'}</span>
      </div>`).join('') : '<p style="color:var(--text-dim);font-size:.85rem">No vehicles registered.</p>'}
    <div class="cd-section-title">Repair Orders (${orders.length})</div>
    ${orders.length ? orders.map(o => {
      const v = DB.vehicles().find(x => x.id === o.vehicleId);
      return `<div class="order-item" style="margin-bottom:8px">
        <div class="order-item-info">
          <div class="order-item-name">${o.desc || 'Repair Order'}</div>
          <div class="order-item-plate">${v ? v.year + ' ' + v.make + ' ' + v.model : '—'} · ${fmtDate(o.created)}</div>
        </div>
        <span class="badge badge-${o.status}">${o.status.replace('-',' ')}</span>
        <div class="order-item-amount">${fmt(o.total || 0)}</div>
      </div>`;
    }).join('') : '<p style="color:var(--text-dim);font-size:.85rem">No repair orders.</p>'}
  `;
  openModal('customer-detail-modal');
}

// ── VEHICLES ──
function renderVehicles(filter = '') {
  const all = DB.vehicles().filter(v =>
    !filter || (v.plate + ' ' + v.make + ' ' + v.model + ' ' + v.year).toLowerCase().includes(filter.toLowerCase())
  );
  const list = document.getElementById('vehicles-list');
  if (!all.length) {
    list.innerHTML = `<div class="empty-state"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M5 17H3a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v7a2 2 0 0 1-2 2h-2"/><circle cx="7" cy="17" r="2"/><circle cx="17" cy="17" r="2"/></svg><p>No vehicles found</p></div>`;
    return;
  }
  list.innerHTML = all.map(v => {
    const c = DB.customers().find(x => x.id === v.customerId);
    const orders = DB.orders().filter(o => o.vehicleId === v.id);
    return `<div class="data-card">
      <div class="data-card-avatar" style="background:var(--bg3);color:var(--text-muted)">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="22" height="22"><path d="M5 17H3a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v7a2 2 0 0 1-2 2h-2"/><circle cx="7" cy="17" r="2"/><circle cx="17" cy="17" r="2"/></svg>
      </div>
      <div class="data-card-info">
        <div class="data-card-name">${v.year || ''} ${v.make || ''} ${v.model || ''} <span class="plate-badge" style="margin-left:8px">${v.plate || 'No plate'}</span></div>
        <div class="data-card-sub">${c ? c.first + ' ' + c.last : 'No owner'} · ${v.color || ''} · ${v.mileage ? v.mileage.toLocaleString() + ' mi' : ''} · ${orders.length} order${orders.length !== 1 ? 's' : ''}</div>
      </div>
      <div class="data-card-actions">
        <button class="btn-ghost btn-sm" onclick="openVehicleModal('${v.customerId}','${v.id}')">Edit</button>
        <button class="btn-danger" onclick="deleteVehicle('${v.id}')">Delete</button>
      </div>
    </div>`;
  }).join('');
}

document.getElementById('vehicle-search').addEventListener('input', e => renderVehicles(e.target.value));

function openVehicleModal(customerId, vehicleId = null) {
  const v = vehicleId ? DB.vehicles().find(x => x.id === vehicleId) : null;
  document.getElementById('vehicle-modal-title').textContent = v ? 'Edit Vehicle' : 'Add Vehicle';
  document.getElementById('vf-id').value = v?.id || '';
  document.getElementById('vf-customer-id').value = customerId;
  document.getElementById('vf-year').value = v?.year || '';
  document.getElementById('vf-make').value = v?.make || '';
  document.getElementById('vf-model').value = v?.model || '';
  document.getElementById('vf-plate').value = v?.plate || '';
  document.getElementById('vf-color').value = v?.color || '';
  document.getElementById('vf-vin').value = v?.vin || '';
  document.getElementById('vf-mileage').value = v?.mileage || '';
  openModal('vehicle-modal');
}

function deleteVehicle(id) {
  if (!confirm('Delete this vehicle?')) return;
  DB.saveVehicles(DB.vehicles().filter(v => v.id !== id));
  renderVehicles();
  toast('Vehicle deleted');
}

document.getElementById('vehicle-form').addEventListener('submit', e => {
  e.preventDefault();
  const id = document.getElementById('vf-id').value || uid();
  const vehicles = DB.vehicles();
  const idx = vehicles.findIndex(v => v.id === id);
  const vehicle = {
    id,
    customerId: document.getElementById('vf-customer-id').value,
    year: document.getElementById('vf-year').value,
    make: document.getElementById('vf-make').value.trim(),
    model: document.getElementById('vf-model').value.trim(),
    plate: document.getElementById('vf-plate').value.trim().toUpperCase(),
    color: document.getElementById('vf-color').value.trim(),
    vin: document.getElementById('vf-vin').value.trim(),
    mileage: +document.getElementById('vf-mileage').value || 0,
    created: idx >= 0 ? vehicles[idx].created : Date.now(),
  };
  if (idx >= 0) vehicles[idx] = vehicle; else vehicles.push(vehicle);
  DB.saveVehicles(vehicles);
  closeModal('vehicle-modal');
  renderVehicles();
  toast(idx >= 0 ? 'Vehicle updated' : 'Vehicle added');
});

// ── REPAIR ORDERS ──
let roFilter = 'all';

function renderOrders() {
  let all = DB.orders();
  if (roFilter !== 'all') all = all.filter(o => o.status === roFilter);
  all = [...all].sort((a, b) => b.created - a.created);
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
        <div class="data-card-name">${c ? c.first + ' ' + c.last : 'Unknown'} ${v ? '— ' + v.year + ' ' + v.make + ' ' + v.model : ''}</div>
        <div class="data-card-sub">${o.desc || 'No description'} · ${fmtDate(o.created)}</div>
      </div>
      <span class="badge badge-${o.priority || 'normal'}">${o.priority || 'normal'}</span>
      <span class="badge badge-${o.status}">${o.status.replace('-', ' ')}</span>
      <div style="font-weight:700;color:var(--accent);white-space:nowrap">${fmt(o.total || 0)}</div>
      <div class="data-card-actions">
        <button class="btn-danger" onclick="event.stopPropagation();deleteOrder('${o.id}')">Delete</button>
      </div>
    </div>`;
  }).join('');
}

document.querySelectorAll('.filter-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    roFilter = tab.dataset.filter;
    renderOrders();
  });
});

document.getElementById('new-ro-btn').addEventListener('click', () => openROModal());

function deleteOrder(id) {
  if (!confirm('Delete this repair order?')) return;
  DB.saveOrders(DB.orders().filter(o => o.id !== id));
  renderOrders();
  renderDashboard();
  toast('Order deleted');
}

let lineItems = [];

function openROModal(id = null, preCustomerId = null) {
  const o = id ? DB.orders().find(x => x.id === id) : null;
  document.getElementById('ro-modal-title').textContent = o ? 'Edit Repair Order' : 'New Repair Order';
  document.getElementById('rof-id').value = o?.id || '';
  lineItems = o?.lines ? [...o.lines] : [];

  // populate customer select
  const cSel = document.getElementById('rof-customer');
  cSel.innerHTML = '<option value="">Select customer…</option>' +
    DB.customers().map(c => `<option value="${c.id}" ${(o?.customerId === c.id || preCustomerId === c.id) ? 'selected' : ''}>${c.first} ${c.last}</option>`).join('');

  updateVehicleSelect(o?.customerId || preCustomerId, o?.vehicleId);

  document.getElementById('rof-status').value = o?.status || 'open';
  document.getElementById('rof-priority').value = o?.priority || 'normal';
  document.getElementById('rof-desc').value = o?.desc || '';
  document.getElementById('rof-notes').value = o?.notes || '';
  renderLineItems();
  openModal('ro-modal');
}

function updateVehicleSelect(customerId, selectedVehicleId = null) {
  const vSel = document.getElementById('rof-vehicle');
  const vehicles = DB.vehicles().filter(v => v.customerId === customerId);
  vSel.innerHTML = '<option value="">Select vehicle…</option>' +
    vehicles.map(v => `<option value="${v.id}" ${v.id === selectedVehicleId ? 'selected' : ''}>${v.year} ${v.make} ${v.model} (${v.plate || 'no plate'})</option>`).join('');
}

document.getElementById('rof-customer').addEventListener('change', e => {
  updateVehicleSelect(e.target.value);
});

function renderLineItems() {
  const container = document.getElementById('line-items');
  container.innerHTML = lineItems.map((li, i) => `
    <div class="line-item">
      <input type="text" placeholder="Service / Part" value="${li.desc || ''}" oninput="lineItems[${i}].desc=this.value">
      <input type="number" placeholder="Qty" value="${li.qty || 1}" min="1" oninput="lineItems[${i}].qty=+this.value;calcTotal()">
      <input type="number" placeholder="Price" value="${li.price || ''}" step="0.01" oninput="lineItems[${i}].price=+this.value;calcTotal()">
      <button type="button" class="line-item-del" onclick="removeLine(${i})">×</button>
    </div>
  `).join('');
  calcTotal();
}

function removeLine(i) { lineItems.splice(i, 1); renderLineItems(); }

document.getElementById('add-line-btn').addEventListener('click', () => {
  lineItems.push({ desc: '', qty: 1, price: 0 });
  renderLineItems();
});

function calcTotal() {
  const subtotal = lineItems.reduce((s, l) => s + (l.qty || 1) * (l.price || 0), 0);
  const tax = subtotal * 0.1;
  document.getElementById('ro-subtotal').textContent = fmt(subtotal);
  document.getElementById('ro-tax').textContent = fmt(tax);
  document.getElementById('ro-total').textContent = fmt(subtotal + tax);
}

document.getElementById('ro-form').addEventListener('submit', e => {
  e.preventDefault();
  const id = document.getElementById('rof-id').value || uid();
  const orders = DB.orders();
  const idx = orders.findIndex(o => o.id === id);
  const subtotal = lineItems.reduce((s, l) => s + (l.qty || 1) * (l.price || 0), 0);
  const order = {
    id,
    customerId: document.getElementById('rof-customer').value,
    vehicleId: document.getElementById('rof-vehicle').value,
    status: document.getElementById('rof-status').value,
    priority: document.getElementById('rof-priority').value,
    desc: document.getElementById('rof-desc').value.trim(),
    notes: document.getElementById('rof-notes').value.trim(),
    lines: [...lineItems],
    subtotal,
    tax: subtotal * 0.1,
    total: subtotal * 1.1,
    created: idx >= 0 ? orders[idx].created : Date.now(),
  };
  if (idx >= 0) orders[idx] = order; else orders.push(order);
  DB.saveOrders(orders);
  closeModal('ro-modal');
  renderOrders();
  renderDashboard();
  toast(idx >= 0 ? 'Order updated' : 'Repair order created');
});

// ── INSPECTIONS ──
const DVI_ITEMS = {
  exterior: ['Body Condition', 'Glass / Windshield', 'Lights – Front', 'Lights – Rear', 'Wipers'],
  underhood: ['Engine Oil', 'Coolant Level', 'Brake Fluid', 'Power Steering Fluid', 'Belts & Hoses', 'Battery'],
  brakes: ['Front Brake Pads', 'Rear Brake Pads', 'Rotors', 'Tire Tread – FL', 'Tire Tread – FR', 'Tire Tread – RL', 'Tire Tread – RR', 'Tire Pressure'],
  interior: ['Horn', 'Seat Belts', 'A/C & Heat', 'Check Engine Light', 'Warning Lights'],
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
    const issues = Object.values(insp.results || {}).filter(r => r === 'critical').length;
    const attention = Object.values(insp.results || {}).filter(r => r === 'attention').length;
    return `<div class="data-card">
      <div class="data-card-info">
        <div class="data-card-name">${c ? c.first + ' ' + c.last : 'Unknown'} — ${v ? v.year + ' ' + v.make + ' ' + v.model : 'Unknown vehicle'}</div>
        <div class="data-card-sub">${fmtDate(insp.created)}${issues ? ' · <span style="color:var(--red)">' + issues + ' critical</span>' : ''}${attention ? ' · <span style="color:var(--amber)">' + attention + ' need attention</span>' : ''}</div>
      </div>
      <button class="btn-danger" onclick="deleteInspection('${insp.id}')">Delete</button>
    </div>`;
  }).join('');
}

function deleteInspection(id) {
  if (!confirm('Delete this inspection?')) return;
  DB.saveInspections(DB.inspections().filter(i => i.id !== id));
  renderInspections();
  toast('Inspection deleted');
}

document.getElementById('new-dvi-btn').addEventListener('click', openDVIModal);

function openDVIModal() {
  dviState = {};
  document.getElementById('dvif-id').value = '';
  document.getElementById('dvif-notes').value = '';
  const cSel = document.getElementById('dvif-customer');
  cSel.innerHTML = '<option value="">Select…</option>' +
    DB.customers().map(c => `<option value="${c.id}">${c.first} ${c.last}</option>`).join('');
  document.getElementById('dvif-vehicle').innerHTML = '<option value="">Select…</option>';

  Object.entries(DVI_ITEMS).forEach(([section, items]) => {
    document.getElementById('dvi-' + section).innerHTML = items.map(item => `
      <div class="dvi-item">
        <span class="dvi-item-label">${item}</span>
        <div class="dvi-status-btns">
          <button type="button" class="dvi-btn" data-val="ok" data-item="${item}" onclick="setDVI('${item}','ok',this)">OK</button>
          <button type="button" class="dvi-btn" data-val="attention" data-item="${item}" onclick="setDVI('${item}','attention',this)">Attention</button>
          <button type="button" class="dvi-btn" data-val="critical" data-item="${item}" onclick="setDVI('${item}','critical',this)">Critical</button>
        </div>
      </div>
    `).join('');
  });
  openModal('dvi-modal');
}

function setDVI(item, val, btn) {
  dviState[item] = val;
  btn.closest('.dvi-status-btns').querySelectorAll('.dvi-btn').forEach(b => b.classList.remove('selected'));
  btn.classList.add('selected');
}

document.getElementById('dvif-customer').addEventListener('change', e => {
  const vehicles = DB.vehicles().filter(v => v.customerId === e.target.value);
  document.getElementById('dvif-vehicle').innerHTML = '<option value="">Select…</option>' +
    vehicles.map(v => `<option value="${v.id}">${v.year} ${v.make} ${v.model}</option>`).join('');
});

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
  const all = DB.inspections();
  all.push(insp);
  DB.saveInspections(all);
  closeModal('dvi-modal');
  renderInspections();
  renderDashboard();
  toast('Inspection saved');
});

// ── INVOICES ──
function renderInvoices() {
  const orders = [...DB.orders()].sort((a, b) => b.created - a.created);
  const list = document.getElementById('invoices-list');
  if (!orders.length) {
    list.innerHTML = `<div class="empty-state"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg><p>No invoices yet — create a repair order first.</p></div>`;
    return;
  }
  list.innerHTML = orders.map((o, i) => {
    const c = DB.customers().find(x => x.id === o.customerId);
    const v = DB.vehicles().find(x => x.id === o.vehicleId);
    return `<div class="data-card">
      <div class="data-card-info">
        <div class="data-card-name">INV-${String(i + 1).padStart(4, '0')} — ${c ? c.first + ' ' + c.last : 'Unknown'}</div>
        <div class="data-card-sub">${v ? v.year + ' ' + v.make + ' ' + v.model : '—'} · ${fmtDate(o.created)}</div>
      </div>
      <span class="badge badge-${o.status}">${o.status.replace('-', ' ')}</span>
      <div style="font-weight:800;font-size:1.1rem;color:var(--accent)">${fmt(o.total || 0)}</div>
      <button class="btn-ghost btn-sm" onclick="printInvoice('${o.id}',${i + 1})">Print / PDF</button>
    </div>`;
  }).join('');
}

function printInvoice(id, num) {
  const o = DB.orders().find(x => x.id === id);
  const c = DB.customers().find(x => x.id === o?.customerId);
  const v = DB.vehicles().find(x => x.id === o?.vehicleId);
  const w = window.open('', '_blank');
  w.document.write(`<!DOCTYPE html><html><head><title>Invoice INV-${String(num).padStart(4,'0')}</title>
  <style>body{font-family:sans-serif;max-width:600px;margin:40px auto;color:#111}h1{font-size:1.5rem}table{width:100%;border-collapse:collapse;margin:16px 0}td,th{padding:8px 12px;text-align:left;border-bottom:1px solid #eee}th{background:#f5f5f5;font-size:.75rem;text-transform:uppercase}.total{font-weight:700;font-size:1.1rem}</style>
  </head><body>
  <h1>Invoice INV-${String(num).padStart(4,'0')}</h1>
  <p><strong>Date:</strong> ${fmtDate(o.created)}</p>
  <p><strong>Customer:</strong> ${c ? c.first + ' ' + c.last : '—'} · ${c?.phone || ''}</p>
  <p><strong>Vehicle:</strong> ${v ? v.year + ' ' + v.make + ' ' + v.model + ' (' + (v.plate || 'no plate') + ')' : '—'}</p>
  <p><strong>Description:</strong> ${o.desc || '—'}</p>
  <table><tr><th>Item</th><th>Qty</th><th>Unit Price</th><th>Total</th></tr>
  ${(o.lines || []).map(l => `<tr><td>${l.desc||'—'}</td><td>${l.qty||1}</td><td>${fmt(l.price||0)}</td><td>${fmt((l.qty||1)*(l.price||0))}</td></tr>`).join('')}
  </table>
  <p>Subtotal: ${fmt(o.subtotal||0)}</p>
  <p>Tax (10%): ${fmt(o.tax||0)}</p>
  <p class="total">Total: ${fmt(o.total||0)}</p>
  <script>window.print();<\/script></body></html>`);
}

// ── PLATE SCANNER ──
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
    cameraStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
    document.getElementById('scanner-video').srcObject = cameraStream;
    document.getElementById('start-camera-btn').style.display = 'none';
    document.getElementById('capture-btn').style.display = '';
  } catch {
    toast('Camera access denied or not available.', 'error');
  }
});

document.getElementById('capture-btn').addEventListener('click', () => {
  const video = document.getElementById('scanner-video');
  const canvas = document.getElementById('scan-canvas');
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  canvas.getContext('2d').drawImage(video, 0, 0);
  // Simulate OCR result — in production integrate Tesseract.js or a plate API
  const mockPlates = ['ABC-1234', 'XYZ-5678', 'TRK-9900', 'CAR-0042'];
  const detected = mockPlates[Math.floor(Math.random() * mockPlates.length)];
  document.getElementById('detected-plate-text').textContent = detected;
  document.getElementById('plate-result-bar').style.display = 'flex';
  document.getElementById('use-plate-btn').onclick = () => searchPlate(detected);
});

document.getElementById('manual-search-btn').addEventListener('click', () => {
  const plate = document.getElementById('plate-manual-input').value.trim().toUpperCase();
  if (!plate) { toast('Enter a plate number', 'error'); return; }
  searchPlate(plate);
});

function searchPlate(plate) {
  const vehicles = DB.vehicles().filter(v => v.plate && v.plate.replace(/\s/g,'').toUpperCase() === plate.replace(/\s/g,'').toUpperCase());
  const results = document.getElementById('scanner-results');
  if (!vehicles.length) {
    results.innerHTML = `
      <div style="text-align:center;padding:32px">
        <div style="font-size:1.5rem;font-weight:800;color:var(--accent);letter-spacing:.15em;margin-bottom:16px">${plate}</div>
        <div style="color:var(--text-muted);margin-bottom:20px">No records found for this plate.</div>
        <button class="btn-primary" onclick="prefillNewVehicle('${plate}')">Register this vehicle</button>
      </div>`;
    return;
  }
  results.innerHTML = vehicles.map(v => {
    const c = DB.customers().find(x => x.id === v.customerId);
    const orders = DB.orders().filter(o => o.vehicleId === v.id);
    const inspections = DB.inspections().filter(i => i.vehicleId === v.id);
    return `
      <div>
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:16px;padding-bottom:16px;border-bottom:1px solid var(--border)">
          <div style="font-size:1.6rem;font-weight:800;color:var(--accent);letter-spacing:.15em">${plate}</div>
          <div>
            <div style="font-weight:600">${v.year} ${v.make} ${v.model}</div>
            <div style="color:var(--text-muted);font-size:.85rem">${v.color || ''} · ${v.mileage ? v.mileage.toLocaleString() + ' mi' : ''}</div>
          </div>
        </div>
        ${c ? `<div style="display:flex;align-items:center;gap:10px;margin-bottom:16px;padding:12px;background:var(--glass);border-radius:8px;border:1px solid var(--border)">
          <div style="width:36px;height:36px;border-radius:50%;background:${avatarColor(c.first)};display:flex;align-items:center;justify-content:center;font-weight:700;color:#000">${c.first[0]}${c.last[0]}</div>
          <div><div style="font-weight:600">${c.first} ${c.last}</div><div style="font-size:.8rem;color:var(--text-muted)">${c.phone}</div></div>
          <button class="btn-ghost btn-sm" style="margin-left:auto" onclick="openCustomerDetail('${c.id}')">View Profile</button>
        </div>` : ''}
        <div style="font-size:.8rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.05em;margin-bottom:8px">Repair History (${orders.length})</div>
        ${orders.length ? orders.sort((a,b)=>b.created-a.created).map(o => `
          <div class="order-item" style="margin-bottom:8px">
            <div class="order-item-info">
              <div class="order-item-name">${o.desc || 'Service'}</div>
              <div class="order-item-plate">${fmtDate(o.created)}</div>
            </div>
            <span class="badge badge-${o.status}">${o.status.replace('-',' ')}</span>
            <div class="order-item-amount">${fmt(o.total||0)}</div>
          </div>`).join('') : '<p style="color:var(--text-dim);font-size:.85rem;margin-bottom:12px">No repair orders on file.</p>'}
        <div style="display:flex;gap:8px;margin-top:16px;flex-wrap:wrap">
          <button class="btn-primary" onclick="navigate('repair-orders');openROModal(null,'${c?.id||''}')">New Repair Order</button>
          <button class="btn-ghost" onclick="openDVIModal()">New Inspection</button>
        </div>
      </div>`;
  }).join('');
}

function prefillNewVehicle(plate) {
  const customers = DB.customers();
  if (!customers.length) {
    toast('Add a customer first, then attach this vehicle.', 'error');
    navigate('customers');
    openCustomerModal();
    return;
  }
  navigate('vehicles');
  openVehicleModal(customers[0].id);
  document.getElementById('vf-plate').value = plate;
}

// ── GLOBAL SEARCH ──
document.getElementById('global-search').addEventListener('input', e => {
  const q = e.target.value.trim();
  if (!q) return;
  const customers = DB.customers().filter(c => (c.first+' '+c.last+' '+c.phone).toLowerCase().includes(q.toLowerCase()));
  const vehicles = DB.vehicles().filter(v => (v.plate+' '+v.make+' '+v.model).toLowerCase().includes(q.toLowerCase()));
  if (customers.length) { navigate('customers'); document.getElementById('customer-search').value = q; renderCustomers(q); }
  else if (vehicles.length) { navigate('vehicles'); document.getElementById('vehicle-search').value = q; renderVehicles(q); }
});

// ── SEED DEMO DATA (first load only) ──
function seedDemo() {
  if (DB.customers().length) return;
  const c1 = { id: uid(), first: 'James', last: 'Anderson', phone: '(555) 102-3847', email: 'james@email.com', notes: 'Prefers appointment before noon.', created: Date.now() - 8e8 };
  const c2 = { id: uid(), first: 'Maria', last: 'Gonzalez', phone: '(555) 987-6543', email: 'maria@email.com', notes: '', created: Date.now() - 5e8 };
  DB.saveCustomers([c1, c2]);

  const v1 = { id: uid(), customerId: c1.id, year: '2018', make: 'Toyota', model: 'Camry', plate: 'TYO-4821', color: 'Silver', vin: '1HGBH41JXMN109186', mileage: 72400, created: Date.now() - 7e8 };
  const v2 = { id: uid(), customerId: c2.id, year: '2021', make: 'Honda', model: 'CR-V', plate: 'HND-9982', color: 'Blue', vin: '2HKRW2H85MH123456', mileage: 31200, created: Date.now() - 4e8 };
  DB.saveVehicles([v1, v2]);

  const o1 = { id: uid(), customerId: c1.id, vehicleId: v1.id, status: 'completed', priority: 'normal', desc: 'Oil change + tire rotation', lines: [{desc:'Oil Change',qty:1,price:49.99},{desc:'Tire Rotation',qty:1,price:24.99}], subtotal:74.98, tax:7.50, total:82.48, created: Date.now() - 6e8 };
  const o2 = { id: uid(), customerId: c2.id, vehicleId: v2.id, status: 'in-progress', priority: 'high', desc: 'Brake pad replacement – front', lines: [{desc:'Front Brake Pads',qty:1,price:89.99},{desc:'Labor',qty:1,price:60}], subtotal:149.99, tax:15.00, total:164.99, created: Date.now() - 1e7 };
  DB.saveOrders([o1, o2]);
}

// ── INIT ──
seedDemo();
navigate('dashboard');
