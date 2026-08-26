(() => {
  const $ = (id) => document.getElementById(id);
  let buses = [];
  const esc = (v) => String(v ?? '').replace(/[&<>\"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c]));
  const notify = (text, ok = false) => { if (typeof message === 'function') message(text, ok); };
  async function loadBuses() {
    const { data, error } = await sb.from('buses').select('id,bus_number,driver_name,driver_phone,active').order('bus_number');
    if (error) return notify(error.message);
    buses = data || [];
    render();
  }
  function ensureView() {
    if ($('busAdmin')) return;
    const main = document.querySelector('.admin-main'); if (!main) return;
    const nav = document.createElement('div'); nav.className = 'admin-tabs';
    nav.innerHTML = '<button id="accountsTab" class="primary" type="button">Accounts</button><button id="busesTab" class="secondary" type="button">Buses</button>';
    main.prepend(nav);
    const accountNodes = [...main.children];
    const section = document.createElement('section'); section.id = 'busAdmin'; section.hidden = true;
    section.innerHTML = '<section class="head"><div><span class="eyebrow">FLEET CONTROL</span><h1>Buses</h1><p>Register and manage the buses available to Safar Link schedules.</p></div><button id="newBusAdmin" class="primary" type="button">+ Add bus</button></section><section class="panel"><div class="panel-head"><strong>Registered buses</strong><input id="busSearchAdmin" placeholder="Search buses…"></div><div class="table-wrap"><table><thead><tr><th>Bus number</th><th>Driver</th><th>Driver number</th><th>Status</th><th></th></tr></thead><tbody id="busRowsAdmin"></tbody></table></div></section>';
    main.appendChild(section);
    $('accountsTab').onclick = () => toggle(false); $('busesTab').onclick = () => toggle(true); $('newBusAdmin').onclick = () => openBus(); $('busSearchAdmin').oninput = render;
    if ($('addBusHeader')) $('addBusHeader').onclick = () => { toggle(true); openBus(); };
    window.__safarAccountNodes = accountNodes;
  }
  function toggle(show) {
    const bus = $('busAdmin'); if (!bus) return;
    window.__safarAccountNodes?.forEach(el => { if (el !== bus) el.hidden = show; });
    bus.hidden = !show; $('accountsTab').className = show ? 'secondary' : 'primary'; $('busesTab').className = show ? 'primary' : 'secondary';
    if (show) loadBuses();
  }
  function render() {
    const rows = $('busRowsAdmin'); if (!rows) return;
    const q = ($('busSearchAdmin')?.value || '').toLowerCase();
    const list = buses.filter(b => [b.bus_number,b.driver_name,b.driver_phone].some(v => String(v||'').toLowerCase().includes(q)));
    rows.innerHTML = list.length ? list.map(b => `<tr><td><strong>${esc(b.bus_number)}</strong></td><td>${esc(b.driver_name)}</td><td>${esc(b.driver_phone || '—')}</td><td><span class="pill">${b.active ? 'Active' : 'Inactive'}</span></td><td><button class="secondary" type="button" data-edit-bus="${b.id}">Edit</button> <button class="secondary" type="button" data-delete-bus="${b.id}">Delete</button></td></tr>`).join('') : '<tr><td colspan="5">No buses registered.</td></tr>';
  }
  function openBus(bus = null) {
    let modal = $('busAdminModal');
    if (!modal) { modal = document.createElement('div'); modal.id='busAdminModal'; modal.className='modal'; modal.hidden=true; modal.innerHTML='<section class="modal-card"><button class="close" id="busCloseAdmin" type="button">×</button><span class="eyebrow">FLEET</span><h2 id="busTitleAdmin">Register bus</h2><form id="busFormAdmin"><input id="busIdAdmin" type="hidden"><label>Bus number<input id="busNumberAdmin" required></label><label>Driver name<input id="driverNameAdmin" required></label><label>Driver number<input id="driverPhoneAdmin" inputmode="tel"></label><button class="primary" type="submit">Save bus</button></form></section>'; document.body.appendChild(modal); $('busCloseAdmin').onclick=()=>modal.hidden=true; $('busFormAdmin').onsubmit=saveBus; }
    $('busTitleAdmin').textContent = bus ? 'Edit bus' : 'Register bus'; $('busIdAdmin').value=bus?.id||''; $('busNumberAdmin').value=bus?.bus_number||''; $('driverNameAdmin').value=bus?.driver_name||''; $('driverPhoneAdmin').value=bus?.driver_phone||''; modal.hidden=false; $('busNumberAdmin').focus();
  }
  async function saveBus(e) { e.preventDefault(); const id=$('busIdAdmin').value; const row={bus_number:$('busNumberAdmin').value.trim(),driver_name:$('driverNameAdmin').value.trim(),driver_phone:$('driverPhoneAdmin').value.trim()||null,active:true}; const r=id?await sb.from('buses').update(row).eq('id',id):await sb.from('buses').insert(row); if(r.error)return notify(r.error.message); $('busAdminModal').hidden=true; await loadBuses(); notify(id?'Bus updated.':'Bus registered.',true); }
  document.addEventListener('click', async e => { const edit=e.target.closest('[data-edit-bus]'); if(edit){openBus(buses.find(b=>b.id===edit.dataset.editBus));return;} const del=e.target.closest('[data-delete-bus]'); if(del){const b=buses.find(x=>x.id===del.dataset.deleteBus);if(!b||!confirm(`Delete bus ${b.bus_number}?`))return;const {error}=await sb.from('buses').delete().eq('id',b.id);if(error)return notify(error.message);await loadBuses();notify('Bus deleted.',true);} });
  window.__safarBusAdmin = { ensureView, loadBuses, openBus };
  const boot = setInterval(() => { if (window.supabase && typeof sb !== 'undefined' && $('dashboard')) { clearInterval(boot); ensureView(); } }, 100);
})();
