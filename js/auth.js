// Autentizace pro správu rezervací.
// Heslo se posílá na server (auth_check.php), kde se hashuje a porovnává s auth.json.
// Klient samotný hash hesla nikdy nezíská. Po úspěšném loginu si heslo
// pamatuje v sessionStorage, aby je mohl posílat do save endpointu.

const AUTH_STORAGE_KEY = 'alexandra_auth_session';
const AUTH_SESSION_HOURS = 8;

function isLoggedIn() {
  try {
    const raw = sessionStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) return false;
    const obj = JSON.parse(raw);
    if (!obj || !obj.expiresAt) return false;
    if (Date.now() > obj.expiresAt) {
      sessionStorage.removeItem(AUTH_STORAGE_KEY);
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

function setLoggedIn(password) {
  const expiresAt = Date.now() + AUTH_SESSION_HOURS * 60 * 60 * 1000;
  sessionStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify({ expiresAt, p: btoa(unescape(encodeURIComponent(password))) }));
}

function getStoredPassword() {
  try {
    const raw = sessionStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) return null;
    const obj = JSON.parse(raw);
    if (!obj || !obj.p) return null;
    return decodeURIComponent(escape(atob(obj.p)));
  } catch { return null; }
}

function logout() {
  sessionStorage.removeItem(AUTH_STORAGE_KEY);
  updateAuthUI();
  if (typeof onLogout === 'function') onLogout();
}

async function attemptLogin(password) {
  if (!password) return { ok: false, message: 'Zadejte heslo.' };
  try {
    const res = await fetch('auth_check.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password })
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.ok) {
      setLoggedIn(password);
      return { ok: true };
    }
    return { ok: false, message: data.error || 'Nesprávné heslo.' };
  } catch (e) {
    console.error('[auth] Chyba volání auth_check.php:', e);
    return { ok: false, message: 'Server nedostupný. Zkontrolujte připojení nebo backend.' };
  }
}

function showLoginModal() {
  const modal = document.getElementById('login-modal');
  if (!modal) return;
  const err = document.getElementById('login-error');
  const input = document.getElementById('login-password');
  if (err) err.textContent = '';
  if (input) { input.value = ''; }
  modal.style.display = 'flex';
  setTimeout(() => input && input.focus(), 50);
}

function closeLoginModal() {
  const modal = document.getElementById('login-modal');
  if (modal) modal.style.display = 'none';
}

async function handleLoginSubmit(ev) {
  if (ev) ev.preventDefault();
  const input = document.getElementById('login-password');
  const err = document.getElementById('login-error');
  if (!input) return;
  const result = await attemptLogin(input.value);
  if (result.ok) {
    closeLoginModal();
    updateAuthUI();
    if (typeof onLogin === 'function') onLogin();
  } else {
    if (err) err.textContent = result.message;
  }
}

function updateAuthUI() {
  const loggedIn = isLoggedIn();
  document.body.classList.toggle('is-authenticated', loggedIn);

  const loginBtn = document.getElementById('auth-login-btn');
  const logoutBtn = document.getElementById('auth-logout-btn');
  if (loginBtn) loginBtn.style.display = loggedIn ? 'none' : 'inline-flex';
  if (logoutBtn) logoutBtn.style.display = loggedIn ? 'inline-flex' : 'none';

  // Zobrazit/skrýt sekce vyžadující přihlášení
  document.querySelectorAll('[data-auth-required]').forEach(el => {
    el.style.display = loggedIn ? '' : 'none';
  });
}

// Globální zachycení kliknutí na auth tlačítka (delegace - menu může být injektováno dynamicky)
document.addEventListener('click', (e) => {
  if (e.target.closest('#auth-login-btn')) {
    e.preventDefault();
    showLoginModal();
  } else if (e.target.closest('#auth-logout-btn')) {
    e.preventDefault();
    logout();
  } else if (e.target.closest('#login-cancel')) {
    e.preventDefault();
    closeLoginModal();
  } else if (e.target.closest('#login-submit')) {
    handleLoginSubmit(e);
  }
});

document.addEventListener('keydown', (e) => {
  const modal = document.getElementById('login-modal');
  if (!modal || modal.style.display !== 'flex') return;
  if (e.key === 'Escape') closeLoginModal();
  if (e.key === 'Enter' && document.activeElement && document.activeElement.id === 'login-password') {
    handleLoginSubmit(e);
  }
});

function injectLoginModal() {
  if (document.getElementById('login-modal')) return;
  const html = `
  <div id="login-modal" class="modal login-modal" role="dialog" aria-modal="true" aria-labelledby="login-title">
    <div class="modal-content login-modal-content">
      <span class="close" id="login-close-x" aria-label="Zavřít">&times;</span>
      <h3 id="login-title">Přihlášení správce</h3>
      <p class="login-help">Zadejte heslo pro správu rezervací. Heslo zná pouze majitel.</p>
      <form id="login-form" autocomplete="off" onsubmit="return false;">
        <label for="login-password" class="login-label">Heslo</label>
        <input type="password" id="login-password" autocomplete="current-password" placeholder="Vaše heslo" />
        <p id="login-error" class="login-error" role="alert"></p>
        <div class="login-actions">
          <button type="button" id="login-cancel" class="btn btn-secondary">Zrušit</button>
          <button type="submit" id="login-submit" class="btn btn-primary">Přihlásit se</button>
        </div>
      </form>
    </div>
  </div>`;
  const wrap = document.createElement('div');
  wrap.innerHTML = html;
  document.body.appendChild(wrap.firstElementChild);
  document.getElementById('login-close-x')?.addEventListener('click', closeLoginModal);
}

document.addEventListener('DOMContentLoaded', () => {
  injectLoginModal();
  // Lehce zpožděno - počkat, až se zaktualizuje menu (fetch v rezervace.js / menu)
  setTimeout(updateAuthUI, 100);
  setTimeout(updateAuthUI, 500);
});
