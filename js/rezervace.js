const calendarState = {
  chata: 0,
  apartman: 0
};

const selection = {
  type: null,
  start: null,
  end: null
};

function pad(n){ return String(n).padStart(2,'0'); }

// parsování DD.MM.YYYY -> ISO a Date
function parseEuroToISO(euro) {
  if (!euro || typeof euro !== 'string') return null;
  const parts = euro.split('.');
  if (parts.length !== 3) return null;
  const [d,m,y] = parts.map(p => p.trim());
  if (!d || !m || !y) return null;
  return `${y}-${pad(m)}-${pad(d)}`;
}
function parseEuroToDate(euro) {
  const iso = parseEuroToISO(euro);
  return iso ? new Date(iso + 'T00:00:00') : null;
}
function parseISOToDate(iso) {
  return iso ? new Date(iso + 'T00:00:00') : null;
}
// flexibilní parser: přijme "DD.MM.YYYY" nebo "YYYY-MM-DD"
function parseToDateFlexible(s) {
  if (!s) return null;
  if (typeof s !== 'string') return null;
  if (s.includes('.')) return parseEuroToDate(s);
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return parseISOToDate(s);
  return null;
}
function toISOFlexible(s) {
  if (!s) return null;
  if (s.includes('.')) return parseEuroToISO(s);
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  return null;
}

// bezpečný ISO string z lokální Date (bez toISOString posunu)
function isoFromDate(d) {
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
}
function isoToEuro(iso) {
  if (!iso) return '';
  const [y,m,d] = iso.split('-');
  return `${d}.${m}.${y}`;
}

// build sets: fully occupied days and half-occupied map (start/end půldny)
function buildReservationSets(data, type) {
  const occupiedIso = new Set();

  // starý formát: obsazeno jako pole DD.MM.YYYY
  if (Array.isArray(data.obsazeno)) {
    data.obsazeno.map(parseEuroToISO).filter(Boolean).forEach(d => occupiedIso.add(d));
  }

  // nový formát: obsazenost jako pole rozsahů {od,do} (DD.MM.YYYY)
  const reservationHalf = new Map(); // iso -> {left:true/false, right:true/false}
  if (Array.isArray(data.obsazenost)) {
    data.obsazenost.forEach(range => {
      const s = parseToDateFlexible(range.od);
      const e = parseToDateFlexible(range.do);
      if (!s || !e) return;
      const startIso = isoFromDate(new Date(s));
      const endIso = isoFromDate(new Date(e));
      // vnitřní dny - plně obsazeno
      for (let d = new Date(s); d <= e; d.setDate(d.getDate() + 1)) {
        const iso = isoFromDate(new Date(d));
        if (iso !== startIso && iso !== endIso) {
          occupiedIso.add(iso);
        }
      }
      if (startIso === endIso) {
        // jednonční rozsah považujeme za plně obsazený
        occupiedIso.add(startIso);
      } else {
        // start -> odpoledne obsazeno (pravá polovina)
        const st = reservationHalf.get(startIso) || { left: false, right: false };
        st.right = true;
        reservationHalf.set(startIso, st);
        // end -> ráno obsazeno (levá polovina)
        const en = reservationHalf.get(endIso) || { left: false, right: false };
        en.left = true;
        reservationHalf.set(endIso, en);
      }
    });
  }

  // zpracovat rezervace (unit-specifické) se stejnou logikou (půldny)
  const reservationFull = new Set();
  (data.rezervace || []).filter(r => r.unit === type).forEach(r => {
    const s = parseToDateFlexible(r.start);
    const e = parseToDateFlexible(r.end);
    if (!s || !e) return;
    const rStartIso = isoFromDate(new Date(s));
    const rEndIso = isoFromDate(new Date(e));
    for (let d = new Date(s); d <= e; d.setDate(d.getDate() + 1)) {
      const iso = isoFromDate(new Date(d));
      if (iso !== rStartIso && iso !== rEndIso) {
        reservationFull.add(iso);
        continue;
      }
      // start (pokud != end)
      if (iso === rStartIso && rStartIso !== rEndIso) {
        if (!r.startHalf) reservationFull.add(iso);
        else {
          const obj = reservationHalf.get(iso) || { left:false, right:false };
          if (r.startHalf === 'am') obj.left = true;
          if (r.startHalf === 'pm') obj.right = true;
          if (obj.left && obj.right) { reservationFull.add(iso); reservationHalf.delete(iso); }
          else reservationHalf.set(iso, obj);
        }
      }
      // end (pokud != start)
      if (iso === rEndIso && rStartIso !== rEndIso) {
        if (!r.endHalf) reservationFull.add(iso);
        else {
          const obj = reservationHalf.get(iso) || { left:false, right:false };
          if (r.endHalf === 'am') obj.left = true;
          if (r.endHalf === 'pm') obj.right = true;
          if (obj.left && obj.right) { reservationFull.add(iso); reservationHalf.delete(iso); }
          else reservationHalf.set(iso, obj);
        }
      }
      // start == end
      if (rStartIso === rEndIso) {
        const obj = reservationHalf.get(iso) || { left:false, right:false };
        if (!r.startHalf && !r.endHalf) {
          reservationFull.add(iso); reservationHalf.delete(iso);
        } else {
          if (r.startHalf === 'am' || r.endHalf === 'am') obj.left = true;
          if (r.startHalf === 'pm' || r.endHalf === 'pm') obj.right = true;
          if (obj.left && obj.right) { reservationFull.add(iso); reservationHalf.delete(iso); }
          else { reservationHalf.set(iso,obj); reservationFull.delete(iso); }
        }
      }
    }
  });

  return { occupiedIso, reservationFull, reservationHalf };
}

function changeOffset(type, delta) {
  // zajistit, že máme číslo
  calendarState[type] = (Number.isFinite(calendarState[type]) ? calendarState[type] : 0) + delta;
  console.log(`[calendar] changeOffset ${type} -> ${calendarState[type]}`);
  loadCalendar(type);
}

const LS_KEY_PREFIX = 'alexandra_local_';
function lsKey(type) { return LS_KEY_PREFIX + type; }

function getLocalReservations(type) {
  try {
    const raw = localStorage.getItem(lsKey(type));
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch { return []; }
}
function setLocalReservations(type, list) {
  localStorage.setItem(lsKey(type), JSON.stringify(list));
  updateDirtyIndicator(type);
}
function clearLocalReservations(type) {
  localStorage.removeItem(lsKey(type));
  updateDirtyIndicator(type);
}
function loadCalendar(type) {
  const containerId = type === 'chata' ? 'calendar-chata' : 'calendar-apartman';
  const jsonUrl = type === 'chata' ? 'obsazenost_chata.json' : 'obsazenost_apartman.json';
  const container = document.getElementById(containerId);
  if (!container) {
    console.warn('[calendar] container not found for', type, containerId);
    return;
  }

  const today = new Date();
  const offset = Number.isFinite(calendarState[type]) ? calendarState[type] : 0;
  console.log(`[calendar] loadCalendar ${type} offset=${offset}`);

  fetch(jsonUrl, { cache: 'no-store' })
    .then(res => res.json())
    .then(raw => {
      const data = mergeWithLocal(raw, type);
      const { occupiedIso, reservationFull, reservationHalf } = buildReservationSets(data, type);

      // blocked = fully occupied days (from obsazenost ranges and full reservation days)
      const blockedSet = new Set([...occupiedIso, ...reservationFull]);

      container.innerHTML = '';

      // vykreslíme tři po sobě jdoucí měsíce od currentMonth + offset
      for (let i = 0; i < 3; i++) {
        const monthDate = new Date(today.getFullYear(), today.getMonth() + offset + i, 1);
        const calendar = document.createElement('div');
        calendar.className = 'calendar';
        calendar.innerHTML = generateMonthHTML(monthDate, blockedSet, type);
        container.appendChild(calendar);
      }

      // aplikujeme vizuální značení půldnů (pokud Mapu, použijeme přímo; pokud pole, použijeme legacy)
      if (reservationHalf instanceof Map) {
        markReservationsHalfDays(containerId, reservationHalf);
      } else {
        markReservationsHalfDays(containerId, data.rezervace || [], type);
      }
    })
    .catch(err => {
      console.error('[calendar] Chyba načítání JSON nebo renderu:', err);
    });
}

function generateMonthHTML(date, blockedSet, type) {
  const year = date.getFullYear();
  const month = date.getMonth();
  const monthName = date.toLocaleString('cs-CZ', { month: 'long', year: 'numeric' });
  const firstDay = new Date(year, month, 1).getDay() || 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  let html = `<h3>${monthName}</h3><table><tr>`;
  const days = ['Po', 'Út', 'St', 'Čt', 'Pá', 'So', 'Ne'];
  days.forEach(d => html += `<th>${d}</th>`);
  html += '</tr><tr>';

  let day = 1;
  let cell = 1;
  for (; cell < firstDay; cell++) html += '<td></td>';

  for (; day <= daysInMonth; day++, cell++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`; // ISO
    const isBlocked = blockedSet.has(dateStr); // only full blocks
    const isStart = selection.start === dateStr;
    const isSelected = isInSelectedRange(dateStr);
    const clickAttr = isBlocked ? '' : `onclick="selectDate('${type}', '${dateStr}')"`
    const cellClass = isBlocked ? 'occupied' : isStart ? 'start' : isSelected ? 'selected' : 'available';
    html += `<td class="${cellClass}" data-date="${dateStr}" ${clickAttr}><span class="date-label">${day}</span></td>`;
    if (cell % 7 === 0) html += '</tr><tr>';
  }

  while (cell % 7 !== 1) {
    html += '<td></td>';
    cell++;
  }

  html += '</tr></table>';
  return html;
}

function isInSelectedRange(dateStr) {
  if (!selection.start || !selection.end) return false;
  return dateStr >= selection.start && dateStr <= selection.end;
}

function selectDate(type, dateStr) {
  if (!selection.start || selection.type !== type) {
    selection.start = dateStr;
    selection.end = null;
    selection.type = type;
  } else if (!selection.end) {
    if (dateStr < selection.start) {
      selection.end = selection.start;
      selection.start = dateStr;
    } else {
      selection.end = dateStr;
    }

    const jsonUrl = type === 'chata' ? 'obsazenost_chata.json' : 'obsazenost_apartman.json';
    fetch(jsonUrl)
      .then(res => res.json())
      .then(data => {
        const { occupiedIso, reservationFull } = buildReservationSets(data, type);
        const blockedSet = new Set([...occupiedIso, ...reservationFull]);

        // prohledat rozsah výběru - jen plné bloky
        let blocked = false;
        const s = new Date(selection.start + 'T00:00:00');
        const e = new Date(selection.end + 'T00:00:00');
        for (let d = new Date(s); d <= e; d.setDate(d.getDate() + 1)) {
          const iso = isoFromDate(new Date(d));
          if (blockedSet.has(iso)) {
            blocked = true;
            break;
          }
        }

        if (blocked) {
          alert('Ve vybraném rozsahu je alespoň jeden plně obsazený den. Zvolte jiný termín.');
          selection.start = null;
          selection.end = null;
          selection.type = null;
          loadCalendar(type);
        } else {
          showModal();
        }
      });
  } else {
    selection.start = dateStr;
    selection.end = null;
  }
  loadCalendar(type);
}

function showModal() {
  document.getElementById('selected-range').textContent =
    `Typ: ${selection.type}, od ${isoToEuro(selection.start)} do ${isoToEuro(selection.end)}`;
  const mailto = `mailto:info@chataalexandra.cz?subject=Rezervace ${selection.type}&body=Chci rezervovat ${selection.type} od ${isoToEuro(selection.start)} do ${isoToEuro(selection.end)}`;
  document.getElementById('mailto-link').href = mailto;
  // použít flex pro správné centrování (CSS definuje display:flex)
  document.getElementById('reservation-modal').style.display = 'flex';
}

function closeModal() {
  document.getElementById('reservation-modal').style.display = 'none';
  selection.start = null;
  selection.end = null;
  selection.type = null;
  loadCalendar('chata');
  loadCalendar('apartman');
}

// === Admin: přidávání / mazání / stahování rezervací ===

function toast(msg, kind = '') {
  let el = document.getElementById('toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'toast';
    el.className = 'toast';
    document.body.appendChild(el);
  }
  el.className = 'toast' + (kind ? ' ' + kind : '');
  el.textContent = msg;
  requestAnimationFrame(() => el.classList.add('show'));
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.remove('show'), 2800);
}

async function fetchJSON(type) {
  const url = type === 'chata' ? 'obsazenost_chata.json' : 'obsazenost_apartman.json';
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error('Nepodařilo se načíst ' + url);
  return res.json();
}

async function getCombined(type) {
  const data = await fetchJSON(type);
  const list = Array.isArray(data.obsazenost) ? data.obsazenost.slice() : [];
  const local = getLocalReservations(type);
  return { server: data, list, local };
}

function rangesOverlap(aStart, aEnd, bStart, bEnd) {
  // ISO yyyy-mm-dd string porovnání funguje lexikograficky
  return !(aEnd < bStart || bEnd < aStart);
}

async function addReservation(type, isoOd, isoDo) {
  if (!isoOd || !isoDo) { toast('Vyplňte oba termíny.', 'error'); return; }
  if (isoOd > isoDo) { toast('Datum "od" musí být dříve než "do".', 'error'); return; }

  const { list } = await getCombined(type);
  // Kontrola kolize s existující obsazeností (server + lokální)
  const all = [...list];
  for (const r of all) {
    const rOd = toISOFlexible(r.od);
    const rDo = toISOFlexible(r.do);
    if (rOd && rDo && rangesOverlap(isoOd, isoDo, rOd, rDo)) {
      toast(`Kolize s rezervací ${isoToEuro(rOd)} – ${isoToEuro(rDo)}.`, 'error');
      return;
    }
  }

  const local = getLocalReservations(type);
  local.push({ od: isoToEuro(isoOd), do: isoToEuro(isoDo) });
  setLocalReservations(type, local);
  toast('Rezervace přidána. Nezapomeňte stáhnout JSON.', 'success');
  refreshAdminLists();
  loadCalendar(type);
}

async function deleteReservation(type, source, index) {
  if (!confirm('Opravdu smazat tuto rezervaci?')) return;

  if (source === 'local') {
    const local = getLocalReservations(type);
    local.splice(index, 1);
    setLocalReservations(type, local);
    toast('Lokální rezervace smazána.', 'success');
  } else {
    // smazání ze serveru = označit pro vyřazení; uložíme do localStorage seznam "removed"
    const data = await fetchJSON(type);
    const item = (data.obsazenost || [])[index];
    if (!item) { toast('Rezervace nenalezena.', 'error'); return; }
    const removedKey = LS_KEY_PREFIX + type + '_removed';
    const removed = JSON.parse(localStorage.getItem(removedKey) || '[]');
    removed.push({ od: item.od, do: item.do });
    localStorage.setItem(removedKey, JSON.stringify(removed));
    toast('Označeno ke smazání. Stáhněte aktualizovaný JSON.', 'success');
    updateDirtyIndicator(type);
  }
  refreshAdminLists();
  loadCalendar(type);
}

function getRemovedReservations(type) {
  try {
    return JSON.parse(localStorage.getItem(LS_KEY_PREFIX + type + '_removed') || '[]');
  } catch { return []; }
}
function clearRemovedReservations(type) {
  localStorage.removeItem(LS_KEY_PREFIX + type + '_removed');
}

// Override mergeWithLocal aby zohlednil i smazání
function mergeWithLocal(data, type) {
  const local = getLocalReservations(type);
  const removed = getRemovedReservations(type);
  const isRemoved = (r) => removed.some(x => x.od === r.od && x.do === r.do);
  const filteredServer = (data.obsazenost || []).filter(r => !isRemoved(r));
  return { ...data, obsazenost: [...filteredServer, ...local] };
}

// Override updateDirtyIndicator aby brala i removed
function updateDirtyIndicator(type) {
  const el = document.querySelector(`[data-dirty="${type}"]`);
  if (!el) return;
  const has = getLocalReservations(type).length > 0 || getRemovedReservations(type).length > 0;
  el.style.display = has ? '' : 'none';
}

async function refreshAdminLists() {
  for (const type of ['chata', 'apartman']) {
    const ul = document.getElementById('admin-list-' + type);
    if (!ul) continue;
    ul.innerHTML = '';

    try {
      const data = await fetchJSON(type);
      const server = Array.isArray(data.obsazenost) ? data.obsazenost : [];
      const local = getLocalReservations(type);
      const removed = getRemovedReservations(type);
      const isRemoved = (r) => removed.some(x => x.od === r.od && x.do === r.do);

      server.forEach((r, idx) => {
        const li = document.createElement('li');
        if (isRemoved(r)) {
          li.style.opacity = '0.5';
          li.style.textDecoration = 'line-through';
        }
        li.innerHTML = `
          <span class="res-range">${r.od} – ${r.do}</span>
          <span class="res-source">${isRemoved(r) ? 'ke smazání' : 'uloženo'}</span>
        `;
        const btn = document.createElement('button');
        btn.className = 'btn-danger-small';
        btn.textContent = isRemoved(r) ? 'Obnovit' : 'Smazat';
        btn.onclick = () => {
          if (isRemoved(r)) {
            const rem = getRemovedReservations(type).filter(x => !(x.od === r.od && x.do === r.do));
            localStorage.setItem(LS_KEY_PREFIX + type + '_removed', JSON.stringify(rem));
            updateDirtyIndicator(type);
            refreshAdminLists();
            loadCalendar(type);
          } else {
            deleteReservation(type, 'server', idx);
          }
        };
        li.appendChild(btn);
        ul.appendChild(li);
      });

      local.forEach((r, idx) => {
        const li = document.createElement('li');
        li.className = 'is-local';
        li.innerHTML = `
          <span class="res-range">${r.od} – ${r.do}</span>
          <span class="res-source">nová (neuloženo)</span>
        `;
        const btn = document.createElement('button');
        btn.className = 'btn-danger-small';
        btn.textContent = 'Smazat';
        btn.onclick = () => deleteReservation(type, 'local', idx);
        li.appendChild(btn);
        ul.appendChild(li);
      });

      updateDirtyIndicator(type);
    } catch (err) {
      console.error('[admin] refresh', type, err);
    }
  }
}

async function downloadJson(type) {
  const data = await fetchJSON(type);
  const merged = mergeWithLocal(data, type);
  const cleaned = { obsazenost: merged.obsazenost };
  if (data.rezervace) cleaned.rezervace = data.rezervace;
  const json = JSON.stringify(cleaned, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = type === 'chata' ? 'obsazenost_chata.json' : 'obsazenost_apartman.json';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  toast('JSON stažen. Nahrajte jej na server a poté klikněte na "Zahodit změny".');
}

function resetLocal(type) {
  if (!confirm('Opravdu zahodit všechny neuložené změny pro ' + type + '?')) return;
  clearLocalReservations(type);
  clearRemovedReservations(type);
  refreshAdminLists();
  loadCalendar(type);
  toast('Změny zahozeny.');
}

async function saveToServer(type) {
  const password = (typeof getStoredPassword === 'function') ? getStoredPassword() : null;
  if (!password) {
    toast('Přihlášení vypršelo. Přihlaste se znovu.', 'error');
    if (typeof showLoginModal === 'function') showLoginModal();
    return;
  }

  // Sestavit aktuální stav (server + local - removed)
  let payload;
  try {
    const data = await fetchJSON(type);
    const merged = mergeWithLocal(data, type);
    payload = (merged.obsazenost || []).map(r => ({
      od: r.od.includes('-') ? isoToEuro(r.od) : r.od,
      do: r.do.includes('-') ? isoToEuro(r.do) : r.do
    }));
  } catch (e) {
    toast('Nepodařilo se načíst aktuální data.', 'error');
    return;
  }

  if (!confirm(`Uložit ${payload.length} rezervací pro ${type} na server? Soubor bude přepsán.`)) return;

  try {
    const res = await fetch('save_obsazenost.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password, unit: type, obsazenost: payload })
    });
    const result = await res.json().catch(() => ({}));
    if (res.ok && result.ok) {
      // úspěch - vyčistit lokální stav, protože server už ho má
      clearLocalReservations(type);
      clearRemovedReservations(type);
      refreshAdminLists();
      loadCalendar(type);
      toast(`Uloženo na server (${result.count} rezervací).`, 'success');
    } else {
      toast('Chyba ukládání: ' + (result.error || res.status), 'error');
    }
  } catch (e) {
    console.error('[admin] save', e);
    toast('Chyba spojení se serverem.', 'error');
  }
}

// Globální delegace pro admin akce
document.addEventListener('submit', (e) => {
  const form = e.target.closest('.admin-form');
  if (!form) return;
  e.preventDefault();
  const type = form.getAttribute('data-unit');
  const od = form.querySelector('input[name="od"]').value;
  const doD = form.querySelector('input[name="do"]').value;
  addReservation(type, od, doD).then(() => {
    form.reset();
  });
});

document.addEventListener('click', (e) => {
  const sv = e.target.closest('[data-save]');
  if (sv) { saveToServer(sv.getAttribute('data-save')); return; }
  const dl = e.target.closest('[data-download]');
  if (dl) { downloadJson(dl.getAttribute('data-download')); return; }
  const rs = e.target.closest('[data-reset]');
  if (rs) { resetLocal(rs.getAttribute('data-reset')); return; }
});

// Hooks volané z auth.js po login/logout
function onLogin() {
  refreshAdminLists();
  loadCalendar('chata');
  loadCalendar('apartman');
  toast('Přihlášení proběhlo úspěšně.', 'success');
}
function onLogout() {
  toast('Odhlášení proběhlo.');
}

// reservationHalfMap: Map(iso => {left:boolean,right:boolean}) nebo pole rezervací (zpětná kompatibilita)
function markReservationsHalfDays(calContainerId, reservationHalfMapOrArray, unit) {
  const container = document.getElementById(calContainerId);
  if (!container) return;

  // helper: aplikovat třídy na jednu buňku, ale NEODSTRAŇOVAT třídy 'start' a 'selected' ani onclick
  function applyHalfToCell(iso, obj) {
    const cell = container.querySelector(`[data-date="${iso}"]`);
    if (!cell) return;
    // pouze upravíme vizuální stav; necháme 'start'/'selected' a atribut onclick nedotčené
    // odstraníme pouze staré poloviční / occupied třídy které nastavujeme nyní
    cell.classList.remove('occupied','half-left','half-right');

    if (obj.left && obj.right) {
      cell.classList.add('occupied');
    } else if (obj.left) {
      cell.classList.add('half-left');
    } else if (obj.right) {
      cell.classList.add('half-right');
    }
  }

  // pokud byl předán Map (reservationHalf)
  if (reservationHalfMapOrArray instanceof Map) {
    reservationHalfMapOrArray.forEach((obj, iso) => {
      applyHalfToCell(iso, obj);
    });
    return;
  }

  // pokud byl předán pole rezervací (legacy) - z pole vytvoříme mapu a aplikujeme
  if (Array.isArray(reservationHalfMapOrArray)) {
    // očekáváme pole rezervací (s unit, start, end, startHalf, endHalf)
    reservationHalfMapOrArray.filter(r => !unit || r.unit === unit).forEach(r => {
      const s = parseToDateFlexible(r.start);
      const e = parseToDateFlexible(r.end);
      if (!s || !e) return;
      const rStartIso = toISOFlexible(r.start);
      const rEndIso = toISOFlexible(r.end);
      for (let d = new Date(s); d <= e; d.setDate(d.getDate() + 1)) {
        const iso = isoFromDate(new Date(d));
        // interior -> full
        if (iso !== rStartIso && iso !== rEndIso) {
          applyHalfToCell(iso, { left: true, right: true });
          continue;
        }
        // start
        if (iso === rStartIso && rStartIso !== rEndIso) {
          if (!r.startHalf) applyHalfToCell(iso, { left: true, right: true });
          else if (r.startHalf === 'am') applyHalfToCell(iso, { left: true, right: false });
          else if (r.startHalf === 'pm') applyHalfToCell(iso, { left: false, right: true });
        }
        // end
        if (iso === rEndIso && rStartIso !== rEndIso) {
          if (!r.endHalf) applyHalfToCell(iso, { left: true, right: true });
          else if (r.endHalf === 'am') applyHalfToCell(iso, { left: true, right: false });
          else if (r.endHalf === 'pm') applyHalfToCell(iso, { left: false, right: true });
        }
        // same-day
        if (rStartIso === rEndIso) {
          const left = (r.startHalf === 'am') || (r.endHalf === 'am');
          const right = (r.startHalf === 'pm') || (r.endHalf === 'pm');
          if (left && right) applyHalfToCell(iso, { left: true, right: true });
          else if (left) applyHalfToCell(iso, { left: true, right: false });
          else if (right) applyHalfToCell(iso, { left: false, right: true });
          else applyHalfToCell(iso, { left: true, right: true });
        }
      }
    });
  }
}

document.addEventListener('DOMContentLoaded', () => {
  fetch('menu.html')
    .then(res => res.text())
    .then(html => {
      document.getElementById('menu').innerHTML = html;
      if (typeof updateAuthUI === 'function') updateAuthUI();
    });

  fetch('footer.html')
    .then(res => res.text())
    .then(html => {
      document.getElementById('footer').innerHTML = html;
    });

  loadCalendar('chata');
  loadCalendar('apartman');
  refreshAdminLists();
});
