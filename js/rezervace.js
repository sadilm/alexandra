const calendarState = {
  chata: 0,
  apartman: 0
};

const selection = {
  type: null,
  start: null,
  end: null
};

function changeOffset(type, delta) {
  calendarState[type] += delta;
  loadCalendar(type);
}

function loadCalendar(type) {
  const containerId = type === 'chata' ? 'calendar-chata' : 'calendar-apartman';
  const jsonUrl = type === 'chata' ? 'obsazenost_chata.json' : 'obsazenost_apartman.json';
  const container = document.getElementById(containerId);
  const today = new Date();
  const offset = calendarState[type];

  fetch(jsonUrl)
    .then(res => res.json())
    .then(data => {
      container.innerHTML = '';
      for (let i = 0; i < 3; i++) {
        const date = new Date(today.getFullYear(), today.getMonth() + offset + i, 1);
        const calendar = document.createElement('div');
        calendar.className = 'calendar';
        calendar.innerHTML = generateMonthHTML(date, data.obsazeno, type);
        container.appendChild(calendar);
      }
    });
}

function generateMonthHTML(date, occupiedDates, type) {
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
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const isOccupied = occupiedDates.includes(dateStr);
    const isStart = selection.start === dateStr;
    const isSelected = isInSelectedRange(dateStr);
    const clickAttr = isOccupied ? '' : `onclick="selectDate('${type}', '${dateStr}')"`
    const cellClass = isOccupied ? 'occupied' : isStart ? 'start' : isSelected ? 'selected' : 'available';
    html += `<td class="${cellClass}" ${clickAttr}>${day}</td>`;
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
        const blocked = data.obsazeno.some(d => d >= selection.start && d <= selection.end);
        if (blocked) {
          alert('Ve vybraném rozsahu je alespoň jeden obsazený den. Zvolte jiný termín.');
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
    `Typ: ${selection.type}, od ${selection.start} do ${selection.end}`;
  const mailto = `mailto:info@chataalexandra.cz?subject=Rezervace ${selection.type}&body=Chci rezervovat ${selection.type} od ${selection.start} do ${selection.end}`;
  document.getElementById('mailto-link').href = mailto;
  document.getElementById('reservation-modal').style.display = 'block';
}

function closeModal() {
  document.getElementById('reservation-modal').style.display = 'none';
  selection.start = null;
  selection.end = null;
  selection.type = null;
  loadCalendar('chata');
  loadCalendar('apartman');
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
