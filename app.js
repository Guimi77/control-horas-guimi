const STORAGE_KEY = 'controlHorasGuimi.v1';
const MIGRATION_KEY = 'controlHorasGuimi.supabaseMigrated.v1';
const SUPABASE_URL = 'https://sweybzzhxyktlimknltv.supabase.co';
const SUPABASE_KEY = 'sb_publishable_Ij2zPutXiIUF3bdgI_tPWg_tTRg-JjW';
const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const $ = id => document.getElementById(id);
let entries = loadLocalEntries();
let cursor = new Date();
let editingId = null;
let currentUser = null;

function loadLocalEntries() {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return Array.isArray(stored) ? stored : [];
  } catch {
    return [];
  }
}
function persistLocal() { localStorage.setItem(STORAGE_KEY, JSON.stringify(entries)); }
function clearLocalForNewUser(userId) {
  entries = [];
  persistLocal();
  localStorage.setItem(MIGRATION_KEY, userId);
  render();
}
function setSync(text, state = '') {
  const el = $('syncStatus');
  el.textContent = text;
  el.className = `sync-pill${state ? ` ${state}` : ''}`;
}
function localISO(date) {
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
}
function parseISO(value) { const [y,m,d] = value.split('-').map(Number); return new Date(y,m-1,d); }
function movementBalance(entry) { return Number(entry.plus || 0) - Number(entry.minus || 0); }
function totalBalance() { return entries.reduce((total, entry) => total + movementBalance(entry), 0); }
function formatHours(value) {
  const rounded = Math.round(value * 100) / 100;
  return `${rounded > 0 ? '+' : ''}${rounded.toLocaleString('es-ES',{maximumFractionDigits:2})} h`;
}
function balanceClass(value) { return value > 0 ? 'pos' : value < 0 ? 'neg' : 'zero'; }
function escapeHtml(value='') { return String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function monthLabel(date) {
  const text = new Intl.DateTimeFormat('es-ES',{month:'long',year:'numeric'}).format(date);
  return text.charAt(0).toUpperCase() + text.slice(1);
}
function normalizeRemote(row) {
  return { id: row.id, date: row.entry_date, note: row.note || '', plus: Number(row.plus_hours || 0), minus: Number(row.minus_hours || 0) };
}

function renderBalance() {
  const total = totalBalance();
  const value = $('totalBalance');
  const card = $('balanceCard');
  const sticker = $('positiveSticker');
  value.textContent = formatHours(total);
  value.className = `big ${balanceClass(total)}`;
  card.classList.toggle('has-sticker', total > 0);
  sticker.hidden = total <= 0;
  if (total > 0) {
    card.style.background = 'linear-gradient(135deg,#f3fff8,#e5f7ed)'; card.style.borderColor = '#b7dfc8';
  } else if (total < 0) {
    card.style.background = 'linear-gradient(135deg,#fff5f4,#ffe8e6)'; card.style.borderColor = '#efc0bc';
  } else {
    card.style.background = 'linear-gradient(135deg,#f7f9fc,#eef2f6)'; card.style.borderColor = '#cfd9e5';
  }
}
function entriesForDate(date) { return entries.filter(entry => entry.date === date); }
function renderCalendar() {
  const year = cursor.getFullYear(), month = cursor.getMonth();
  $('monthTitle').textContent = monthLabel(new Date(year,month,1));
  const first = new Date(year,month,1), offset = (first.getDay()+6)%7, start = new Date(year,month,1-offset), today = localISO(new Date()), calendar = $('calendar');
  calendar.innerHTML = '';
  for (let index=0; index<42; index+=1) {
    const date = new Date(start); date.setDate(start.getDate()+index);
    const iso = localISO(date), dailyEntries = entriesForDate(iso), dailyBalance = dailyEntries.reduce((t,e)=>t+movementBalance(e),0), day = document.createElement('div');
    let entryState = '';
    if (dailyEntries.length) entryState = dailyBalance > 0 ? ' positive' : dailyBalance < 0 ? ' negative' : ' neutral-entry';
    day.className = `day${date.getMonth()!==month?' muted':''}${iso===today?' today':''}${entryState}`;
    day.setAttribute('role','button'); day.setAttribute('tabindex','0'); day.setAttribute('aria-label',iso);
    day.innerHTML = `<div class="num">${date.getDate()}</div>${dailyEntries.length?'<span class="dot"></span>':''}${dailyEntries.length?`<div class="badge ${balanceClass(dailyBalance)}">${formatHours(dailyBalance)}</div>`:''}`;
    const openDay = () => openEntryModal(iso, dailyEntries.length===1 ? dailyEntries[0].id : null);
    day.addEventListener('click',openDay); day.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();openDay();}});
    calendar.appendChild(day);
  }
}
function renderHistory() {
  const list = $('historyList'), sorted = [...entries].sort((a,b)=>b.date.localeCompare(a.date)); list.innerHTML='';
  if (!sorted.length) { list.innerHTML='<div class="empty">Aún no hay movimientos</div>'; return; }
  sorted.forEach(entry=>{
    const date=parseISO(entry.date), item=document.createElement('div'); item.className='item';
    item.innerHTML=`<div class="item-top"><span>${new Intl.DateTimeFormat('es-ES',{day:'2-digit',month:'2-digit',year:'numeric'}).format(date)}</span><span class="${balanceClass(movementBalance(entry))}">${formatHours(movementBalance(entry))}</span></div><div class="item-note">${escapeHtml(entry.note)||`+${entry.plus||0} h / -${entry.minus||0} h`}</div>`;
    item.addEventListener('click',()=>{closeHistory();openEntryModal(entry.date,entry.id);}); list.appendChild(item);
  });
}
function render(){ renderBalance(); renderCalendar(); renderHistory(); }

async function fetchRemoteEntries() {
  if (!currentUser) return;
  setSync('Sincronizando…','busy');
  const { data, error } = await sb.from('time_entries').select('id,entry_date,note,plus_hours,minus_hours').order('entry_date',{ascending:true});
  if (error) { console.error(error); setSync('Error de sincronización','error'); return; }
  entries = (data || []).map(normalizeRemote);
  persistLocal(); render(); setSync('Sincronizado','ok');
}

async function migrateLocalIfNeeded() {
  if (!currentUser || localStorage.getItem(MIGRATION_KEY) === currentUser.id) return;
  const local = loadLocalEntries();
  const { data: existing, error } = await sb.from('time_entries').select('id').limit(1);
  if (error) throw error;
  if ((!existing || existing.length===0) && local.length) {
    const rows = local.map(e=>({ user_id: currentUser.id, entry_date:e.date, note:e.note||'', plus_hours:Number(e.plus||0), minus_hours:Number(e.minus||0) }));
    const { error: insertError } = await sb.from('time_entries').insert(rows);
    if (insertError) throw insertError;
  }
  localStorage.setItem(MIGRATION_KEY,currentUser.id);
}

function showAuth(message='') {
  $('authMessage').textContent = message; $('authMessage').className='auth-message'; $('authModal').classList.add('show');
}
function hideAuth(){ $('authModal').classList.remove('show'); $('authMessage').textContent=''; }
function setAccount(user) {
  currentUser = user || null;
  $('accountBtn').hidden = !currentUser;
  $('accountBtn').textContent = 'Cuenta';
  $('accountEmail').textContent = currentUser?.email || '';
  $('addBtn').disabled = !currentUser; $('historyBtn').disabled = !currentUser;
}
async function handleSignedIn(user) {
  setAccount(user); hideAuth();
  try { await migrateLocalIfNeeded(); await fetchRemoteEntries(); }
  catch (error) { console.error(error); setSync('Error de sincronización','error'); alert('No se pudo sincronizar. Revisa la conexión e inténtalo de nuevo.'); }
}
async function login() {
  const email=$('authEmail').value.trim(), password=$('authPassword').value;
  $('authMessage').textContent='Entrando…'; $('authMessage').className='auth-message';
  const { data,error } = await sb.auth.signInWithPassword({email,password});
  if(error){$('authMessage').textContent=error.message; $('authMessage').className='auth-message error'; return;}
  await handleSignedIn(data.user);
}
async function signup() {
  const email=$('authEmail').value.trim(), password=$('authPassword').value;
  if(!email || password.length<6){$('authMessage').textContent='Introduce un email y una contraseña de al menos 6 caracteres.';$('authMessage').className='auth-message error';return;}
  $('authMessage').textContent='Creando cuenta…'; $('authMessage').className='auth-message';
  const { data,error } = await sb.auth.signUp({email,password});
  if(error){$('authMessage').textContent=error.message;$('authMessage').className='auth-message error';return;}
  if (data.user) clearLocalForNewUser(data.user.id);
  if(data.session){await handleSignedIn(data.user);} else {$('authMessage').textContent='Cuenta creada. Revisa tu email para confirmarla y después pulsa Entrar.';$('authMessage').className='auth-message ok';}
}
async function logout(){ await sb.auth.signOut(); currentUser=null; entries=[]; persistLocal(); render(); setAccount(null); setSync('Sin conectar'); $('accountModal').classList.remove('show'); showAuth(); }

function openEntryModal(date=localISO(new Date()), id=null){
  if(!currentUser){showAuth();return;}
  editingId=id; const entry=id?entries.find(item=>item.id===id):null;
  $('modalTitle').textContent=entry?'Editar movimiento':'Añadir movimiento'; $('dateInput').value=entry?.date||date; $('noteInput').value=entry?.note||''; $('plusInput').value=entry?.plus??0; $('minusInput').value=entry?.minus??0; $('deleteBtn').hidden=!entry; updatePreview(); $('entryModal').classList.add('show');
}
function closeEntryModal(){ $('entryModal').classList.remove('show'); editingId=null; }
function openHistory(){ if(!currentUser){showAuth();return;} renderHistory(); $('historyModal').classList.add('show'); }
function closeHistory(){ $('historyModal').classList.remove('show'); }
function updatePreview(){ const value=(Number($('plusInput').value)||0)-(Number($('minusInput').value)||0); $('preview').textContent=`Balance del movimiento: ${formatHours(value)}`; $('preview').className=`hint ${balanceClass(value)}`; }

async function saveEntry(){
  if(!currentUser) return showAuth();
  const date=$('dateInput').value; if(!date) return alert('Selecciona una fecha.');
  const plus=Math.max(0,Number($('plusInput').value)||0), minus=Math.max(0,Number($('minusInput').value)||0), note=$('noteInput').value.trim();
  if(plus===0&&minus===0&&!note) return alert('Introduce horas o una nota.');
  setSync('Guardando…','busy');
  let error;
  if(editingId){ ({error}=await sb.from('time_entries').update({entry_date:date,note,plus_hours:plus,minus_hours:minus}).eq('id',editingId)); }
  else { ({error}=await sb.from('time_entries').insert({user_id:currentUser.id,entry_date:date,note,plus_hours:plus,minus_hours:minus})); }
  if(error){console.error(error);setSync('Error al guardar','error');return alert('No se pudo guardar.');}
  cursor=parseISO(date); closeEntryModal(); await fetchRemoteEntries();
}
async function deleteEntry(){
  if(!editingId||!confirm('¿Eliminar este movimiento?')) return;
  setSync('Eliminando…','busy');
  const {error}=await sb.from('time_entries').delete().eq('id',editingId);
  if(error){console.error(error);setSync('Error al eliminar','error');return alert('No se pudo eliminar.');}
  closeEntryModal(); await fetchRemoteEntries();
}

$('addBtn').addEventListener('click',()=>openEntryModal());
$('historyBtn').addEventListener('click',openHistory); $('historyClose').addEventListener('click',closeHistory);
$('prevBtn').addEventListener('click',()=>{cursor=new Date(cursor.getFullYear(),cursor.getMonth()-1,1);renderCalendar();});
$('nextBtn').addEventListener('click',()=>{cursor=new Date(cursor.getFullYear(),cursor.getMonth()+1,1);renderCalendar();});
$('todayBtn').addEventListener('click',()=>{cursor=new Date();renderCalendar();});
$('cancelBtn').addEventListener('click',closeEntryModal); $('saveBtn').addEventListener('click',saveEntry); $('deleteBtn').addEventListener('click',deleteEntry);
$('plusInput').addEventListener('input',updatePreview); $('minusInput').addEventListener('input',updatePreview);
$('positiveSticker').addEventListener('error',function(){this.hidden=true;$('balanceCard').classList.remove('has-sticker');});
$('entryModal').addEventListener('click',event=>{if(event.target===$('entryModal'))closeEntryModal();});
$('historyModal').addEventListener('click',event=>{if(event.target===$('historyModal'))closeHistory();});
$('loginBtn').addEventListener('click',login); $('signupBtn').addEventListener('click',signup);
$('authPassword').addEventListener('keydown',event=>{if(event.key==='Enter')login();});
$('accountBtn').addEventListener('click',()=>{$('accountModal').classList.add('show');});
$('accountClose').addEventListener('click',()=>{$('accountModal').classList.remove('show');});
$('logoutBtn').addEventListener('click',logout);

async function init(){
  render(); setAccount(null); setSync('Comprobando…','busy');
  const { data: { session } } = await sb.auth.getSession();
  if(session?.user) await handleSignedIn(session.user); else { entries=[]; render(); setSync('Sin conectar'); showAuth(); }
  sb.auth.onAuthStateChange(async (event,sessionNow)=>{
    if(event==='SIGNED_IN'&&sessionNow?.user&&sessionNow.user.id!==currentUser?.id) await handleSignedIn(sessionNow.user);
    if(event==='SIGNED_OUT'){entries=[];render();setAccount(null);setSync('Sin conectar');showAuth();}
  });
  window.addEventListener('focus',()=>{ if(currentUser) fetchRemoteEntries(); });
}
init();
