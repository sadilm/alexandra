async function displayCalendar(elementId, type) {
    const calendarContainer = document.getElementById(elementId);
    
    // Načteme data z JSON souboru
    try {
        const response = await fetch('data/obsazenost.json');
        if (!response.ok) {
            throw new Error('Nepodařilo se načíst soubor obsazenost.json');
        }
        const data = await response.json();
        const reservations = data[type];

        if (!calendarContainer) {
            console.error('Element pro kalendář nebyl nalezen.');
            return;
        }

        const today = new Date();
        let currentMonth = today.getMonth();
        let currentYear = today.getFullYear();

        function renderCalendar() {
            calendarContainer.innerHTML = '';
            const monthName = new Date(currentYear, currentMonth).toLocaleString('cs-CZ', { month: 'long' });
            const year = currentYear;
            
            const header = document.createElement('div');
            header.classList.add('calendar-header');
            header.innerHTML = `
                <button onclick="changeMonth(-1)">Předchozí</button>
                <h3>${monthName} ${year}</h3>
                <button onclick="changeMonth(1)">Další</button>
            `;
            calendarContainer.appendChild(header);

            const table = document.createElement('table');
            table.innerHTML = `
                <thead>
                    <tr>
                        <th>Po</th><th>Út</th><th>St</th><th>Čt</th><th>Pá</th><th>So</th><th>Ne</th>
                    </tr>
                </thead>
                <tbody></tbody>
            `;
            calendarContainer.appendChild(table);

            const body = table.querySelector('tbody');
            const firstDay = (new Date(currentYear, currentMonth, 1).getDay() + 6) % 7;
            const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();

            let day = 1;
            for (let i = 0; i < 6; i++) {
                const row = document.createElement('tr');
                for (let j = 0; j < 7; j++) {
                    const cell = document.createElement('td');
                    if (i === 0 && j < firstDay) {
                        cell.classList.add('empty');
                    } else if (day <= daysInMonth) {
                        const date = new Date(currentYear, currentMonth, day);

                        // Kontrola obsazenosti
                        const isReserved = reservations.some(res => {
                            const start = new Date(res.start);
                            const end = new Date(res.end);
                            return date >= start && date <= end;
                        });

                        cell.textContent = day;
                        if (isReserved) {
                            cell.classList.add('reserved');
                        }
                        
                        if (date.toDateString() === today.toDateString()) {
                            cell.classList.add('today');
                        }

                        day++;
                    }
                    row.appendChild(cell);
                }
                body.appendChild(row);
                if (day > daysInMonth) break;
            }
        }

        // Funkce pro změnu měsíce
        window.changeMonth = (delta) => {
            currentMonth += delta;
            if (currentMonth < 0) {
                currentMonth = 11;
                currentYear--;
            } else if (currentMonth > 11) {
                currentMonth = 0;
                currentYear++;
            }
            renderCalendar();
        };

        renderCalendar();

    } catch (error) {
        console.error('Chyba při načítání dat o obsazenosti:', error);
        if (calendarContainer) {
            calendarContainer.innerHTML = '<p style="color: red;">Nepodařilo se načíst kalendář obsazenosti. Zkontrolujte, zda je soubor "obsazenost.json" ve složce "data".</p>';
        }
    }
}