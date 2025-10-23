// Use event delegation so this works even when the menu is injected dynamically
// (menu.html is loaded via fetch). Listens on document for clicks on the
// hamburger and links.

document.addEventListener('click', function (e) {
  const toggle = e.target.closest('.nav-toggle');
  if (toggle) {
    const navList = document.getElementById('nav-list');
    if (!navList) return;
    const expanded = toggle.getAttribute('aria-expanded') === 'true';
    toggle.setAttribute('aria-expanded', String(!expanded));
    navList.classList.toggle('show');
  }

  // Close mobile menu when a link inside it is clicked
  const clickedLink = e.target.closest('#nav-list a');
  if (clickedLink) {
    const navList = document.getElementById('nav-list');
    const toggleBtn = document.querySelector('.nav-toggle');
    if (navList && navList.classList.contains('show')) {
      navList.classList.remove('show');
      if (toggleBtn) toggleBtn.setAttribute('aria-expanded', 'false');
    }
  }
});

// Accessibility: close menu on Escape
document.addEventListener('keydown', function (e) {
  if (e.key === 'Escape') {
    const navList = document.getElementById('nav-list');
    const toggleBtn = document.querySelector('.nav-toggle');
    if (navList && navList.classList.contains('show')) {
      navList.classList.remove('show');
      if (toggleBtn) toggleBtn.setAttribute('aria-expanded', 'false');
    }
  }
});
