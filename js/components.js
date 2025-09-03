async function loadComponent(url, elementId) {
    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Nepodařilo se načíst soubor ${url}`);
        }
        const html = await response.text();
        document.getElementById(elementId).innerHTML = html;

        // Nastavíme aktivní odkaz podle aktuální URL
        const path = window.location.pathname.split('/').pop();
        const links = document.querySelectorAll('header a');
        links.forEach(link => {
            if (link.getAttribute('href') === path) {
                link.classList.add('active');
            } else if (path === '' && link.getAttribute('href') === 'index.html') {
                link.classList.add('active');
            } else {
                link.classList.remove('active');
            }
        });

    } catch (error) {
        console.error('Chyba při načítání komponenty:', error);
    }
}

function loadCalendarApartman() {
    const placeholder = document.getElementById('calendar-apartman-placeholder');
    if (placeholder) {
        fetch('../calendarApartman.html')
            .then(response => response.text())
            .then(html => {
                placeholder.innerHTML = html;
            });
    }
}

function loadCalendarChata() {
    const placeholder = document.getElementById('calendar-chata-placeholder');
    if (placeholder) {
        fetch('../calendarChata.html')
            .then(response => response.text())
            .then(html => {
                placeholder.innerHTML = html;
            });
    }
}


// Načteme header a footer po načtení stránky
document.addEventListener('DOMContentLoaded', () => {
    loadComponent('header.html', 'header-placeholder');
    loadComponent('footer.html', 'footer-placeholder');
    loadCalendarApartman();
    loadCalendarChata();
});