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

  fetch(jsonUrl)
    .then(res => res.json())
    .then(data => {
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
    });

  fetch('footer.html')
    .then(res => res.text())
    .then(html => {
      document.getElementById('footer').innerHTML = html;
    });

  loadCalendar('chata');
  loadCalendar('apartman');
});
