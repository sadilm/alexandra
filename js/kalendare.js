document.addEventListener('DOMContentLoaded', async () => {

    let reservationsChata = [];
    let reservationsApartman = [];

    await new Promise(resolve => setTimeout(resolve, 50));

    /**
     * Normalizuje datum na půlnoc, aby se porovnávaly pouze dny, měsíce a roky.
     * @param {Date} date Datum, které se má normalizovat.
     * @returns {Date} Normalizované datum.
     */
    function normalizeDate(date) {
        const d = new Date(date);
        d.setHours(0, 0, 0, 0);
        return d;
    }

    /**
     * Zkontroluje, zda je dané datum v rozsahu rezervací.
     * @param {Date} date Datum, které se má zkontrolovat.
     * @param {Array} reservations Pole rezervací.
     * @returns {string|null} "reserved" pokud je datum rezervované, jinak null.
     */
    function isReserved(date, reservations) {
        const normalizedDate = normalizeDate(date);
        for (let i = 0; i < reservations.length; i++) {
            const start = normalizeDate(reservations[i].start);
            const end = normalizeDate(reservations[i].end);
            if (normalizedDate >= start && normalizedDate <= end) {
                return 'reserved';
            }
        }
        return null;
    }

    /**
     * Zkontroluje, zda je dané datum začátek rezervace.
     * @param {Date} date Datum, které se má zkontrolovat.
     * @param {Array} reservations Pole rezervací.
     * @returns {string|null} "start-of-reservation" pokud je datum začátek, jinak null.
     */
    function isStartOfReservation(date, reservations) {
        const normalizedDate = normalizeDate(date);
        for (let i = 0; i < reservations.length; i++) {
            const start = normalizeDate(reservations[i].start);
            if (normalizedDate.getTime() === start.getTime()) {
                return 'start-of-reservation';
            }
        }
        return null;
    }

    /**
     * Zkontroluje, zda je dané datum konec rezervace.
     * @param {Date} date Datum, které se má zkontrolovat.
     * @param {Array} reservations Pole rezervací.
     * @returns {string|null} "end-of-reservation" pokud je datum konec, jinak null.
     */
    function isEndOfReservation(date, reservations) {
        const normalizedDate = normalizeDate(date);
        for (let i = 0; i < reservations.length; i++) {
            const end = normalizeDate(reservations[i].end);
            if (normalizedDate.getTime() === end.getTime()) {
                return 'end-of-reservation';
            }
        }
        return null;
    }

    /**
     * Vykreslí kalendář pro daný rok a měsíc, typ a index kalendáře.
     * @param {number} year Aktuální rok.
     * @param {number} month Aktuální měsíc (0-11).
     * @param {string} type Typ objektu (chata, apartman).
     * @param {number} index Index kalendáře pro určení HTML elementu.
     */
    function renderCalendar(year, month, type, index) {
        const calendarEl = document.getElementById(`calendar-${type}-${index}`);
        const monthYearEl = document.getElementById(`month-year-${type}-${index}`);
        const reservations = type === 'chata' ? reservationsChata : reservationsApartman;

        const date = new Date(year, month);
        const firstDayOfMonth = new Date(year, month, 1);
        const lastDayOfMonth = new Date(year, month + 1, 0);
        const daysInMonth = lastDayOfMonth.getDate();

        // Nastavení hlavičky kalendáře
        const monthNames = ['Leden', 'Únor', 'Březen', 'Duben', 'Květen', 'Červen', 'Červenec', 'Srpen', 'Září', 'Říjen', 'Listopad', 'Prosinec'];
        monthYearEl.textContent = `${monthNames[month]} ${year}`;

        // Vytvoření buňek pro dny
        let calendarHtml = '<table><thead><tr><th>Po</th><th>Út</th><th>St</th><th>Čt</th><th>Pá</th><th>So</th><th>Ne</th></tr></thead><tbody><tr>';
        
        let startDay = firstDayOfMonth.getDay() === 0 ? 6 : firstDayOfMonth.getDay() - 1;

        // Prázdné buňky na začátku měsíce
        for (let i = 0; i < startDay; i++) {
            calendarHtml += '<td></td>';
        }

        // Buňky pro dny v měsíci
        for (let i = 1; i <= daysInMonth; i++) {
            const day = new Date(year, month, i);
            const today = new Date();
            const isToday = false; //day.getFullYear() === today.getFullYear() && day.getMonth() === today.getMonth() && day.getDate() === today.getDate();
            
            const reservedClass = isReserved(day, reservations);
            const startClass = isStartOfReservation(day, reservations);
            const endClass = isEndOfReservation(day, reservations);

            const classes = [reservedClass, startClass, endClass].filter(Boolean).join(' ');

            calendarHtml += `<td class="${classes} ${isToday ? 'today' : ''}">${i}</td>`;
            
            if ((startDay + i) % 7 === 0) {
                calendarHtml += '</tr><tr>';
            }
        }
        
        // Uzavření řádku a tabulky
        while ((startDay + daysInMonth) % 7 !== 0) {
            calendarHtml += '<td></td>';
            startDay++;
        }
        calendarHtml += '</tr></tbody></table>';
        
        calendarEl.innerHTML = calendarHtml;
    }

    /**
     * Vykreslí všechny tři kalendáře pro danou nemovitost.
     * @param {string} type Typ nemovitosti (chata, apartman).
     * @param {number} year Aktuální rok.
     * @param {number} month Aktuální měsíc.
     */
    function renderThreeMonths(type, year, month) {
        for (let i = 0; i < 3; i++) {
            const nextMonth = month + i;
            const nextYear = year + Math.floor(nextMonth / 12);
            const currentMonth = nextMonth % 12;
            renderCalendar(nextYear, currentMonth, type, i);
        }
    }

    let currentYearChata = new Date().getFullYear();
    let currentMonthChata = new Date().getMonth();
    let currentYearApartman = new Date().getFullYear();
    let currentMonthApartman = new Date().getMonth();

    // Načtení dat z JSON souboru
    fetch('data/obsazenost.json')
        .then(response => response.json())
        .then(data => {
            reservationsChata = data.chata.map(res => ({
                start: new Date(res.start),
                end: new Date(res.end)
            }));
            reservationsApartman = data.apartman.map(res => ({
                start: new Date(res.start),
                end: new Date(res.end)
            }));

            // Vykreslení kalendářů po načtení dat
            if (document.getElementById('calendar-chata-0')) {
                renderThreeMonths('chata', currentYearChata, currentMonthChata);
            }
            if (document.getElementById('calendar-apartman-0')) {
                renderThreeMonths('apartman', currentYearApartman, currentMonthApartman);
            }
        })
        .catch(error => console.error('Chyba při načítání dat o obsazenosti:', error));

    // Funkce pro změnu měsíce
    if (document.getElementById('prev-chata')) {
        document.getElementById('prev-chata').addEventListener('click', () => {
            currentMonthChata--;
            if (currentMonthChata < 0) {
                currentMonthChata = 11;
                currentYearChata--;
            }
            renderThreeMonths('chata', currentYearChata, currentMonthChata);
        });
    }

    if (document.getElementById('next-chata')) {
        document.getElementById('next-chata').addEventListener('click', () => {
            currentMonthChata++;
            if (currentMonthChata > 11) {
                currentMonthChata = 0;
                currentYearChata++;
            }
            renderThreeMonths('chata', currentYearChata, currentMonthChata);
        });
    }

    if (document.getElementById('prev-apartman')) {
        document.getElementById('prev-apartman').addEventListener('click', () => {
            currentMonthApartman--;
            if (currentMonthApartman < 0) {
                currentMonthApartman = 11;
                currentYearApartman--;
            }
            renderThreeMonths('apartman', currentYearApartman, currentMonthApartman);
        });
    }

    if (document.getElementById('next-apartman')) {
        document.getElementById('next-apartman').addEventListener('click', () => {
            currentMonthApartman++;
            if (currentMonthApartman > 11) {
                currentMonthApartman = 0;
                currentYearApartman++;
            }
            renderThreeMonths('apartman', currentYearApartman, currentMonthApartman);
        });
    }
});

