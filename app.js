const STORAGE_KEY = 'controlHorasGuimi.v1';
const seed = [
  ['2026-07-28', 'Arribada a les 7:00', 0.5, 0],
  ['2026-07-29', '', 0, 1],
  ['2026-07-30', 'Arribada a les 7:00', 0.5, 0],
  ['2026-08-03', 'arribada 7:00', 0.5, 0],
  ['2026-08-04', 'arribada 7:00', 0.5, 0],
  ['2026-08-05', 'arribada 7:00 / sortida 15:15', 0.5, 0],
  ['2026-08-06', 'arribada 6:45', 0.5, 1],
  ['2026-08-07', 'arribada 7:00', 0.5, 0],
  ['2026-08-10', 'arribada 7:00', 0.5, 0],
  ['2026-08-12', '', 0, 2],
  ['2026-08-13', 'arribada 7:00', 0.5, 0.5],
  ['2026-08-14', 'arribada 7:00', 0.5, 0.5],
  ['2026-08-25', '', 0.25, 0.25],
  ['2026-08-26', '', 0.5, 0],
  ['2026-08-27', '', 0.5, 0],
  ['2026-08-28', '', 0.5, 1.5],
  ['2026-08-31', '', 0.5, 0]
].map((row, index) => ({
  id: `seed-${index}`,
  date: row[0],
  note: row[1],
  plus: row[2],
  minus: row[3]
}));

const $ = id => document.getElementById(id);
let entries = loadEntries();
let cursor = new Date();
let editingId = null;

function loadEntries() {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return Array.isArray(stored) ? stored : seed;
  } catch {
    return seed;
  }
}

function persist() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
}

function localISO(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function parseISO(value) {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function movementBalance(entry) {
  return Number(entry.plus || 0) - Number(entry.minus || 0);
}

function totalBalance() {
  return entries.reduce((total, entry) => total + movementBalance(entry), 0);
}

function formatHours(value) {
  const rounded = Math.round(value * 100) / 100;
  const prefix = rounded > 0 ? '+' : '';
  return `${prefix}${rounded.toLocaleString('es-ES', { maximumFractionDigits: 2 })} h`;
}

function balanceClass(value) {
  return value > 0 ? 'pos' : value < 0 ? 'neg' : 'zero';
}

function escapeHtml(value = '') {
  return String(value).replace(/[&<>"']/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[character]);
}

function monthLabel(date) {
  const text = new Intl.DateTimeFormat('es-ES', { month: 'long', year: 'numeric' }).format(date);
  return text.charAt(0).toUpperCase() + text.slice(1);
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
    card.style.background = 'linear-gradient(135deg, #f3fff8, #e5f7ed)';
    card.style.borderColor = '#b7dfc8';
  } else if (total < 0) {
    card.style.background = 'linear-gradient(135deg, #fff5f4, #ffe8e6)';
    card.style.borderColor = '#efc0bc';
  } else {
    card.style.background = 'linear-gradient(135deg, #f7f9fc, #eef2f6)';
    card.style.borderColor = '#cfd9e5';
  }
}

function entriesForDate(date) {
  return entries.filter(entry => entry.date === date);
}

function renderCalendar() {
  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  $('monthTitle').textContent = monthLabel(new Date(year, month, 1));

  const first = new Date(year, month, 1);
  const offset = (first.getDay() + 6) % 7;
  const start = new Date(year, month, 1 - offset);
  const today = localISO(new Date());
  const calendar = $('calendar');
  calendar.innerHTML = '';

  for (let index = 0; index < 42; index += 1) {
    const date = new Date(start);
    date.setDate(start.getDate() + index);

    const iso = localISO(date);
    const dailyEntries = entriesForDate(iso);
    const dailyBalance = dailyEntries.reduce((total, entry) => total + movementBalance(entry), 0);
    const day = document.createElement('div');

    let entryState = '';
    if (dailyEntries.length) {
      entryState = dailyBalance > 0 ? ' positive' : dailyBalance < 0 ? ' negative' : ' neutral-entry';
    }

    day.className = `day${date.getMonth() !== month ? ' muted' : ''}${iso === today ? ' today' : ''}${entryState}`;
    day.setAttribute('role', 'button');
    day.setAttribute('tabindex', '0');
    day.setAttribute('aria-label', iso);
    day.innerHTML = `
      <div class="num">${date.getDate()}</div>
      ${dailyEntries.length ? '<span class="dot"></span>' : ''}
      ${dailyEntries.length ? `<div class="badge ${balanceClass(dailyBalance)}">${formatHours(dailyBalance)}</div>` : ''}
    `;

    const openDay = () => openEntryModal(iso, dailyEntries.length === 1 ? dailyEntries[0].id : null);
    day.addEventListener('click', openDay);
    day.addEventListener('keydown', event => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        openDay();
      }
    });
    calendar.appendChild(day);
  }
}

function renderHistory() {
  const list = $('historyList');
  const sorted = [...entries].sort((a, b) => b.date.localeCompare(a.date));
  list.innerHTML = '';

  if (!sorted.length) {
    list.innerHTML = '<div class="empty">Aún no hay movimientos</div>';
    return;
  }

  sorted.forEach(entry => {
    const date = parseISO(entry.date);
    const item = document.createElement('div');
    item.className = 'item';
    item.innerHTML = `
      <div class="item-top">
        <span>${new Intl.DateTimeFormat('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(date)}</span>
        <span class="${balanceClass(movementBalance(entry))}">${formatHours(movementBalance(entry))}</span>
      </div>
      <div class="item-note">${escapeHtml(entry.note) || `+${entry.plus || 0} h / -${entry.minus || 0} h`}</div>
    `;
    item.addEventListener('click', () => {
      closeHistory();
      openEntryModal(entry.date, entry.id);
    });
    list.appendChild(item);
  });
}

function render() {
  renderBalance();
  renderCalendar();
  renderHistory();
}

function openEntryModal(date = localISO(new Date()), id = null) {
  editingId = id;
  const entry = id ? entries.find(item => item.id === id) : null;
  $('modalTitle').textContent = entry ? 'Editar movimiento' : 'Añadir movimiento';
  $('dateInput').value = entry?.date || date;
  $('noteInput').value = entry?.note || '';
  $('plusInput').value = entry?.plus ?? 0;
  $('minusInput').value = entry?.minus ?? 0;
  $('deleteBtn').hidden = !entry;
  updatePreview();
  $('entryModal').classList.add('show');
}

function closeEntryModal() {
  $('entryModal').classList.remove('show');
  editingId = null;
}

function openHistory() {
  renderHistory();
  $('historyModal').classList.add('show');
}

function closeHistory() {
  $('historyModal').classList.remove('show');
}

function updatePreview() {
  const value = (Number($('plusInput').value) || 0) - (Number($('minusInput').value) || 0);
  $('preview').textContent = `Balance del movimiento: ${formatHours(value)}`;
  $('preview').className = `hint ${balanceClass(value)}`;
}

function saveEntry() {
  const date = $('dateInput').value;
  if (!date) {
    alert('Selecciona una fecha.');
    return;
  }

  const plus = Math.max(0, Number($('plusInput').value) || 0);
  const minus = Math.max(0, Number($('minusInput').value) || 0);
  const note = $('noteInput').value.trim();

  if (plus === 0 && minus === 0 && !note) {
    alert('Introduce horas o una nota.');
    return;
  }

  if (editingId) {
    const entry = entries.find(item => item.id === editingId);
    if (entry) Object.assign(entry, { date, note, plus, minus });
  } else {
    entries.push({
      id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
      date,
      note,
      plus,
      minus
    });
  }

  persist();
  cursor = parseISO(date);
  closeEntryModal();
  render();
}

function deleteEntry() {
  if (!editingId || !confirm('¿Eliminar este movimiento?')) return;
  entries = entries.filter(entry => entry.id !== editingId);
  persist();
  closeEntryModal();
  render();
}

$('addBtn').addEventListener('click', () => openEntryModal());
$('historyBtn').addEventListener('click', openHistory);
$('historyClose').addEventListener('click', closeHistory);
$('prevBtn').addEventListener('click', () => { cursor = new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1); renderCalendar(); });
$('nextBtn').addEventListener('click', () => { cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1); renderCalendar(); });
$('todayBtn').addEventListener('click', () => { cursor = new Date(); renderCalendar(); });
$('cancelBtn').addEventListener('click', closeEntryModal);
$('saveBtn').addEventListener('click', saveEntry);
$('deleteBtn').addEventListener('click', deleteEntry);
$('plusInput').addEventListener('input', updatePreview);
$('minusInput').addEventListener('input', updatePreview);
$('positiveSticker').addEventListener('error', function () {
  this.hidden = true;
  $('balanceCard').classList.remove('has-sticker');
});
$('entryModal').addEventListener('click', event => { if (event.target === $('entryModal')) closeEntryModal(); });
$('historyModal').addEventListener('click', event => { if (event.target === $('historyModal')) closeHistory(); });

render();
