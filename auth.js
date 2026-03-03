/**
 * DNA RADIO // THE SECRET
 * Auth Module - login, register, recovery, admin console
 * Exports: initAuth, isLoggedIn, getCurrentUser, isAdmin
 */

const CGI_BIN = '__CGI_BIN__';
const SESSION_COOKIE = 'dna_session';
const COOKIE_MAX_AGE = 60 * 60 * 24 * 30;

const SECURITY_QUESTIONS = [
  'What was the name of your first pet?',
  'What street did you grow up on?',
  'What was your childhood nickname?',
  "What is your mother's maiden name?",
  'What was the make of your first car?',
  'What city were you born in?',
  'What was the name of your elementary school?',
  'What is the name of the town where your parents met?',
  'What was the first concert you attended?',
  "What is your oldest sibling's middle name?",
];

const ARCHETYPE_TREES = {
  hacker:     { tiers: ['Script Kiddie','Phisher','Hacker','Black Hat','Zero-Day Architect','Ghost in the Machine'], at: [0,2,5,10,20,50] },
  burglar:    { tiers: ['Trespasser','Prowler','Burglar','Safecracker','Phantom Thief'], at: [0,2,5,20,50] },
  thief:      { tiers: ['Pickpocket','Shoplifter','Thief','Cat Burglar','Master Thief'], at: [0,2,5,20,50] },
  fence:      { tiers: ['Pawnbroker','Middleman','Fence','Black Market Dealer','Shadow Broker'], at: [0,2,5,20,50] },
  robber:     { tiers: ['Mugger','Stick-Up Artist','Armed Robber','Heist Planner','Criminal Mastermind'], at: [0,2,5,20,50] },
  conartist:  { tiers: ['Grifter','Hustler','Con Artist','Identity Thief','Social Engineer'], at: [0,2,5,20,50] },
  dealer:     { tiers: ['Runner','Street Dealer','Supplier','Drug Lord','Cartel Boss'], at: [0,2,5,20,50] },
  mobster:    { tiers: ['Thug','Enforcer','Capo','Underboss','Godfather'], at: [0,2,5,20,50] },
  accountant: { tiers: ['Bookkeeper','Embezzler','Money Launderer','Offshore Banker','Corporate Criminal'], at: [0,2,5,20,50] },
};

let _currentUser = null;
let _gateCallback = null;

let _cookiesAvailable = true;

function setCookie(name, value, maxAge) {
  if (!_cookiesAvailable) return;
  try {
    document.cookie = `${name}=${encodeURIComponent(value)};max-age=${maxAge};path=/;SameSite=Lax`;
  } catch (e) {
    _cookiesAvailable = false;
    console.warn('[Auth] Cookies unavailable in this context');
  }
}

function getCookie(name) {
  if (!_cookiesAvailable) return null;
  try {
    const match = document.cookie.match(new RegExp('(?:^|;\\s*)' + name + '=([^;]*)'));
    return match ? decodeURIComponent(match[1]) : null;
  } catch (e) {
    _cookiesAvailable = false;
    console.warn('[Auth] Cookies unavailable in this context');
    return null;
  }
}

function deleteCookie(name) {
  if (!_cookiesAvailable) return;
  try {
    document.cookie = `${name}=;max-age=0;path=/;SameSite=Lax`;
  } catch (e) {
    _cookiesAvailable = false;
  }
}

export function isLoggedIn() { return _currentUser !== null; }
export function getCurrentUser() { return _currentUser ? { ..._currentUser } : null; }
export function isAdmin() { return _currentUser ? !!_currentUser.is_admin : false; }

export async function initAuth(onPassGate) {
  _gateCallback = onPassGate;

  const overlay = document.getElementById('auth-overlay');
  if (!overlay) return;

  _ensureAuthToast();

  const savedToken = getCookie(SESSION_COOKIE);
  if (savedToken) {
    try {
      const data = await _apiGet(`/user?session=${encodeURIComponent(savedToken)}`);
      if (data.success && data.user) {
        _currentUser = data.user;
        _currentUser._session = savedToken;
        _hideOverlay();
        _updateStatusBarUser();
        _maybeShowAdminButton();
        if (_gateCallback) _gateCallback();
        return;
      }
    } catch (e) {
      deleteCookie(SESSION_COOKIE);
    }
  }

  _showGate();
}

function _showOverlay(html) {
  const overlay = document.getElementById('auth-overlay');
  overlay.innerHTML = html;
  overlay.classList.remove('hidden');
}

function _hideOverlay() {
  const overlay = document.getElementById('auth-overlay');
  overlay.classList.add('hidden');
}

function _showGate() {
  const html = `
    <div class="auth-gate">
      <div>
        <div class="auth-gate-logo">DNA RADIO<br><span style="font-size:0.55em;font-weight:300;letter-spacing:0.5em;color:rgba(0,229,255,0.6)">// THE SECRET</span></div>
      </div>
      <div class="auth-gate-tagline">
        You are about to enter a frequency few have found.<br>
        <strong>Create a handle to track your evolution</strong> - or slip in as a ghost.<br>
        <span style="font-size:10px;color:rgba(255,255,255,0.25)">No account required. Password is always optional.</span>
      </div>
      <div class="auth-gate-buttons">
        <button class="auth-btn auth-btn-primary" id="gate-login-btn">LOGIN / REGISTER</button>
        <button class="auth-btn auth-btn-ghost" id="gate-guest-btn">ENTER AS GUEST</button>
      </div>
      <div style="font-size:9px;color:rgba(255,255,255,0.15);letter-spacing:0.1em;margin-top:-16px">
        GUEST MODE: ANONYMOUS // NO TRACKING
      </div>
    </div>
  `;
  _showOverlay(html);

  document.getElementById('gate-login-btn').addEventListener('click', _showLogin);
  document.getElementById('gate-guest-btn').addEventListener('click', _enterAsGuest);
}

function _enterAsGuest() {
  _hideOverlay();
  if (_gateCallback) _gateCallback();
}

function _showLogin() {
  const html = `
    <div class="auth-panel">
      <div class="corner-tl"></div>
      <div class="corner-br"></div>
      <div class="auth-panel-title">ACCESS TERMINAL</div>
      <div class="auth-panel-sub">IDENTIFY YOURSELF // OR CREATE A NEW IDENTITY</div>
      <div class="auth-field">
        <label class="auth-label" for="login-username">HANDLE</label>
        <input class="auth-input" type="text" id="login-username" placeholder="your handle..." autocomplete="username" autocapitalize="none" spellcheck="false" />
      </div>
      <div class="auth-field">
        <label class="auth-label" for="login-password">PASSWORD <span class="opt-tag">(optional)</span></label>
        <input class="auth-input" type="password" id="login-password" placeholder="leave blank if you set none" autocomplete="current-password" />
      </div>
      <div class="auth-error" id="login-error"></div>
      <button class="auth-btn auth-btn-primary" id="login-submit-btn" style="width:100%;margin-top:8px">LOGIN</button>
      <div class="auth-links">
        <button class="auth-link" id="login-to-register">CREATE ACCOUNT</button>
        <button class="auth-link" id="login-to-recover">FORGOT ACCESS?</button>
        <button class="auth-link" id="login-to-gate" style="margin-left:auto;color:rgba(255,255,255,0.2)">BACK</button>
      </div>
    </div>
  `;
  _showOverlay(html);

  document.getElementById('login-submit-btn').addEventListener('click', _doLogin);
  document.getElementById('login-to-register').addEventListener('click', _showRegister);
  document.getElementById('login-to-recover').addEventListener('click', _showRecover);
  document.getElementById('login-to-gate').addEventListener('click', _showGate);
  document.getElementById('login-username').addEventListener('keydown', e => { if (e.key === 'Enter') _doLogin(); });
  document.getElementById('login-password').addEventListener('keydown', e => { if (e.key === 'Enter') _doLogin(); });
}

async function _doLogin() {
  const usernameEl = document.getElementById('login-username');
  const passwordEl = document.getElementById('login-password');
  const errorEl = document.getElementById('login-error');
  const btn = document.getElementById('login-submit-btn');

  const username = usernameEl.value.trim();
  const password = passwordEl.value;

  if (!username) { _showFieldError(errorEl, 'HANDLE REQUIRED TO LOGIN'); return; }

  _setLoading(btn, true);
  errorEl.classList.remove('visible');

  try {
    const body = { username };
    if (password) body.password = password;
    const data = await _apiPost('/login', body);

    if (!data.success) {
      _showFieldError(errorEl, data.error || 'ACCESS DENIED');
      _setLoading(btn, false);
      return;
    }

    setCookie(SESSION_COOKIE, data.session_token, COOKIE_MAX_AGE);
    _currentUser = data.user;
    _currentUser._session = data.session_token;

    if (data.evolved) {
      _hideOverlay();
      await _showEvolutionAnimation(data.old_name, data.user.display_name, data.user.archetype, data.tier);
    } else {
      _hideOverlay();
    }

    _updateStatusBarUser();
    _maybeShowAdminButton();
    if (_gateCallback) _gateCallback();

  } catch (e) {
    _showFieldError(errorEl, 'CONNECTION ERROR // TRY AGAIN');
    _setLoading(btn, false);
  }
}

function _showRegister() {
  const questionsHtml = SECURITY_QUESTIONS.map((q) =>
    `<option value="${escHtml(q)}">${escHtml(q)}</option>`
  ).join('');

  const html = `
    <div class="auth-panel" style="max-width:460px;">
      <div class="corner-tl"></div>
      <div class="corner-br"></div>
      <div class="auth-panel-title">NEW IDENTITY</div>
      <div class="auth-panel-sub">REGISTRATION // ALL FIELDS OPTIONAL</div>
      <div class="auth-field">
        <label class="auth-label" for="reg-username">CHOOSE A HANDLE <span class="opt-tag">(or get one assigned)</span></label>
        <input class="auth-input" type="text" id="reg-username" placeholder="leave blank for auto-generated handle..." autocomplete="off" autocapitalize="none" spellcheck="false" />
      </div>
      <div class="auth-field">
        <label class="auth-label" for="reg-password">SET A PASSWORD <span class="opt-tag">(optional)</span></label>
        <input class="auth-input" type="password" id="reg-password" placeholder="leave blank to skip" autocomplete="new-password" />
      </div>
      <div class="auth-field">
        <label class="auth-label" for="reg-email">EMAIL <span class="opt-tag">(optional)</span></label>
        <input class="auth-input" type="email" id="reg-email" placeholder="recovery email..." autocomplete="email" />
      </div>
      <div class="auth-field">
        <label class="auth-label" for="reg-phone">PHONE <span class="opt-tag">(optional - US NUMBER ONLY)</span></label>
        <input class="auth-input" type="tel" id="reg-phone" placeholder="10-digit US number..." autocomplete="tel" />
        <div class="auth-error" id="reg-phone-error"></div>
        <div class="auth-hint">Any format accepted - 10 US digits (no 0/1 area codes)</div>
      </div>
      <div class="auth-divider"></div>
      <div class="auth-field">
        <label class="auth-label" for="reg-sq">SECURITY QUESTION <span class="opt-tag">(optional)</span></label>
        <select class="auth-select" id="reg-sq">
          <option value="">- select a question -</option>
          ${questionsHtml}
        </select>
      </div>
      <div class="auth-field">
        <label class="auth-label" for="reg-sa">SECURITY ANSWER <span class="opt-tag">(optional)</span></label>
        <input class="auth-input" type="text" id="reg-sa" placeholder="not case-sensitive" autocomplete="off" autocapitalize="none" />
        <div class="auth-warn" id="reg-sa-warn">Special characters may cause issues with recovery. Consider a simpler answer.</div>
        <div class="auth-hint">Not case-sensitive</div>
      </div>
      <div class="auth-error" id="reg-error"></div>
      <div id="reg-success-wrap"></div>
      <button class="auth-btn auth-btn-primary" id="reg-submit-btn" style="width:100%;margin-top:8px">REGISTER</button>
      <div class="auth-links">
        <button class="auth-link" id="reg-to-login">ALREADY HAVE A HANDLE? LOGIN</button>
        <button class="auth-link" id="reg-to-gate" style="margin-left:auto;color:rgba(255,255,255,0.2)">BACK</button>
      </div>
    </div>
  `;
  _showOverlay(html);

  document.getElementById('reg-submit-btn').addEventListener('click', _doRegister);
  document.getElementById('reg-to-login').addEventListener('click', _showLogin);
  document.getElementById('reg-to-gate').addEventListener('click', _showGate);
  document.getElementById('reg-phone').addEventListener('blur', () => _validatePhone());
  document.getElementById('reg-phone').addEventListener('input', () => _validatePhone());
  document.getElementById('reg-sa').addEventListener('input', e => {
    const warnEl = document.getElementById('reg-sa-warn');
    if (/[^a-zA-Z0-9\s]/.test(e.target.value)) warnEl.classList.add('visible');
    else warnEl.classList.remove('visible');
  });
}

function _validatePhone() {
  const val = document.getElementById('reg-phone').value.trim();
  const errEl = document.getElementById('reg-phone-error');
  if (!val) { errEl.classList.remove('visible'); return true; }
  const digits = val.replace(/[\s\-\.\(\)\+]/g, '');
  const normalized = digits.startsWith('1') && digits.length === 11 ? digits.slice(1) : digits;
  if (normalized.length !== 10) { _showFieldError(errEl, 'Only US numbers accepted (10 digits)'); return false; }
  if (normalized[0] === '0' || normalized[0] === '1') { _showFieldError(errEl, 'Only US numbers accepted'); return false; }
  errEl.classList.remove('visible');
  return true;
}

function _normalizePhone(val) {
  if (!val) return '';
  const digits = val.replace(/[\s\-\.\(\)\+]/g, '');
  return digits.startsWith('1') && digits.length === 11 ? digits.slice(1) : digits;
}

async function _doRegister() {
  const btn = document.getElementById('reg-submit-btn');
  const errorEl = document.getElementById('reg-error');
  const successWrap = document.getElementById('reg-success-wrap');

  errorEl.classList.remove('visible');
  if (!_validatePhone()) return;

  const username = document.getElementById('reg-username').value.trim();
  const password = document.getElementById('reg-password').value;
  const email = document.getElementById('reg-email').value.trim();
  const rawPhone = document.getElementById('reg-phone').value.trim();
  const phone = rawPhone ? _normalizePhone(rawPhone) : '';
  const sq = document.getElementById('reg-sq').value;
  const sa = document.getElementById('reg-sa').value.trim();

  const body = {};
  if (username) body.username = username;
  if (password) body.password = password;
  if (email) body.email = email;
  if (phone) body.phone = phone;
  if (sq) body.security_question = sq;
  if (sa) body.security_answer = sa;

  _setLoading(btn, true);

  try {
    const data = await _apiPost('/register', body);
    if (!data.success) {
      _showFieldError(errorEl, data.error || 'REGISTRATION FAILED');
      _setLoading(btn, false);
      return;
    }

    setCookie(SESSION_COOKIE, data.session_token, COOKIE_MAX_AGE);
    _currentUser = data.user;
    _currentUser._session = data.session_token;

    btn.style.display = 'none';
    successWrap.innerHTML = _buildArchetypeReveal(data.user);

    setTimeout(() => {
      _hideOverlay();
      _updateStatusBarUser();
      _maybeShowAdminButton();
      if (_gateCallback) _gateCallback();
    }, 3500);

  } catch (e) {
    _showFieldError(errorEl, 'CONNECTION ERROR // TRY AGAIN');
    _setLoading(btn, false);
  }
}

function _buildArchetypeReveal(user) {
  const archetype = user.archetype || 'hacker';
  const tierName = user.display_name || 'Unknown';
  const handle = user.username || 'Ghost';
  const treeLabel = archetype.charAt(0).toUpperCase() + archetype.slice(1);
  return `
    <div class="auth-archetype-reveal">
      <div class="arch-reveal-label">ARCHETYPE ASSIGNED</div>
      <div class="arch-reveal-tree">${escHtml(treeLabel)} Path</div>
      <div class="arch-reveal-name">${escHtml(tierName)}</div>
      <div class="arch-reveal-handle">HANDLE: <span>${escHtml(handle)}</span></div>
    </div>
  `;
}

function _showRecover() {
  const html = `
    <div class="auth-panel">
      <div class="corner-tl"></div>
      <div class="corner-br"></div>
      <div class="auth-panel-title">RECOVER ACCESS</div>
      <div class="auth-panel-sub">IDENTIFY VIA AN ALTERNATE METHOD</div>
      <div class="auth-field">
        <label class="auth-label" for="rec-username">HANDLE</label>
        <input class="auth-input" type="text" id="rec-username" placeholder="your handle..." autocomplete="username" autocapitalize="none" spellcheck="false" />
      </div>
      <div class="auth-tabs">
        <button class="auth-tab active" data-method="security_question">SECURITY Q</button>
        <button class="auth-tab" data-method="email">EMAIL</button>
        <button class="auth-tab" data-method="phone">PHONE</button>
      </div>
      <div id="rec-method-fields">${_recoveryMethodHtml('security_question')}</div>
      <div class="auth-error" id="rec-error"></div>
      <div class="auth-success-msg" id="rec-success"></div>
      <button class="auth-btn auth-btn-primary" id="rec-submit-btn" style="width:100%;margin-top:8px">VERIFY IDENTITY</button>
      <div class="auth-links">
        <button class="auth-link" id="rec-to-login">BACK TO LOGIN</button>
      </div>
    </div>
  `;
  _showOverlay(html);

  document.querySelectorAll('.auth-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      document.getElementById('rec-method-fields').innerHTML = _recoveryMethodHtml(tab.dataset.method);
    });
  });

  document.getElementById('rec-submit-btn').addEventListener('click', _doRecover);
  document.getElementById('rec-to-login').addEventListener('click', _showLogin);
}

function _recoveryMethodHtml(method) {
  if (method === 'security_question') {
    return `<div class="auth-field"><label class="auth-label" for="rec-sq-answer">SECURITY ANSWER</label><input class="auth-input" type="text" id="rec-sq-answer" placeholder="your answer (not case-sensitive)" autocomplete="off" autocapitalize="none" /><div class="auth-hint">Not case-sensitive</div></div>`;
  } else if (method === 'email') {
    return `<div class="auth-field"><label class="auth-label" for="rec-email">EMAIL ON FILE</label><input class="auth-input" type="email" id="rec-email" placeholder="email used during registration..." autocomplete="email" /></div>`;
  } else {
    return `<div class="auth-field"><label class="auth-label" for="rec-phone">US PHONE ON FILE</label><input class="auth-input" type="tel" id="rec-phone" placeholder="US phone number on file..." autocomplete="tel" /><div class="auth-hint">Enter the number you registered with</div></div>`;
  }
}

async function _doRecover() {
  const btn = document.getElementById('rec-submit-btn');
  const errorEl = document.getElementById('rec-error');
  const successEl = document.getElementById('rec-success');

  errorEl.classList.remove('visible');
  successEl.classList.remove('visible');

  const username = document.getElementById('rec-username').value.trim();
  if (!username) { _showFieldError(errorEl, 'HANDLE REQUIRED'); return; }

  const activeTab = document.querySelector('.auth-tab.active');
  const method = activeTab ? activeTab.dataset.method : 'security_question';

  let answer = '';
  if (method === 'security_question') {
    const ans = document.getElementById('rec-sq-answer');
    answer = ans ? ans.value.trim() : '';
  } else if (method === 'email') {
    const em = document.getElementById('rec-email');
    answer = em ? em.value.trim() : '';
  } else {
    const ph = document.getElementById('rec-phone');
    answer = ph ? _normalizePhone(ph.value.trim()) : '';
  }

  if (!answer) { _showFieldError(errorEl, 'ANSWER REQUIRED'); return; }

  _setLoading(btn, true);

  try {
    const data = await _apiPost('/recover', { username, method, answer });
    if (!data.success) {
      _showFieldError(errorEl, data.error || 'VERIFICATION FAILED');
      _setLoading(btn, false);
      return;
    }
    _setLoading(btn, false);
    _showResetPassword(username, data.reset_token);
  } catch (e) {
    _showFieldError(errorEl, 'CONNECTION ERROR // TRY AGAIN');
    _setLoading(btn, false);
  }
}

function _showResetPassword(username, resetToken) {
  const html = `
    <div class="auth-panel">
      <div class="corner-tl"></div>
      <div class="corner-br"></div>
      <div class="auth-panel-title">SET NEW PASSWORD</div>
      <div class="auth-panel-sub">OPTIONAL // LEAVE BLANK TO REMOVE PASSWORD</div>
      <div class="auth-field">
        <label class="auth-label" for="reset-pw">NEW PASSWORD <span class="opt-tag">(optional)</span></label>
        <input class="auth-input" type="password" id="reset-pw" placeholder="new password (or leave blank)..." autocomplete="new-password" />
      </div>
      <div class="auth-error" id="reset-error"></div>
      <div class="auth-success-msg" id="reset-success"></div>
      <button class="auth-btn auth-btn-primary" id="reset-submit-btn" style="width:100%;margin-top:8px">CONFIRM</button>
    </div>
  `;
  _showOverlay(html);

  document.getElementById('reset-submit-btn').addEventListener('click', async () => {
    const btn = document.getElementById('reset-submit-btn');
    const errorEl = document.getElementById('reset-error');
    const successEl = document.getElementById('reset-success');
    const newPw = document.getElementById('reset-pw').value;

    _setLoading(btn, true);
    errorEl.classList.remove('visible');

    try {
      const body = { username, reset_token: resetToken };
      if (newPw) body.new_password = newPw;
      const data = await _apiPost('/reset-password', body);

      if (!data.success) {
        _showFieldError(errorEl, data.error || 'RESET FAILED');
        _setLoading(btn, false);
        return;
      }

      successEl.textContent = 'PASSWORD UPDATED // REDIRECTING TO LOGIN...';
      successEl.classList.add('visible');
      btn.disabled = true;
      setTimeout(_showLogin, 2000);
    } catch (e) {
      _showFieldError(errorEl, 'CONNECTION ERROR // TRY AGAIN');
      _setLoading(btn, false);
    }
  });
}

async function _showEvolutionAnimation(oldName, newName, archetype, tier) {
  return new Promise(resolve => {
    const evoEl = document.getElementById('evolution-overlay') || _createEvoOverlay();
    const tree = ARCHETYPE_TREES[archetype];
    let tierIndex = 0;
    let tierProgress = 0;

    if (tree) {
      tierIndex = tree.tiers.indexOf(newName);
      if (tierIndex < 0) tierIndex = 0;
      tierProgress = ((tierIndex + 1) / tree.tiers.length) * 100;
    }

    evoEl.innerHTML = `
      <div class="evo-old-name" id="evo-old">${escHtml(oldName || '...')}</div>
      <div class="evo-flash"></div>
      <div class="evo-new-name" id="evo-new"></div>
      <div class="evo-tier-bar-wrap">
        <div class="evo-tier-label">EVOLUTION PROGRESS</div>
        <div class="evo-tier-track"><div class="evo-tier-fill" id="evo-bar" style="width:0%"></div></div>
        <div class="evo-tier-label" id="evo-tier-txt" style="color:rgba(0,229,255,0.7);margin-top:4px">${escHtml(newName)}</div>
      </div>
      <div class="evo-complete">EVOLUTION COMPLETE</div>
    `;

    evoEl.classList.add('active');

    let typed = '';
    setTimeout(() => {
      const nameEl = document.getElementById('evo-new');
      let i = 0;
      const typeTimer = setInterval(() => {
        if (!document.getElementById('evo-new')) { clearInterval(typeTimer); return; }
        typed += (newName[i] || '');
        document.getElementById('evo-new').textContent = typed;
        i++;
        if (i >= newName.length) clearInterval(typeTimer);
      }, 80);
    }, 600);

    setTimeout(() => {
      const bar = document.getElementById('evo-bar');
      if (bar) bar.style.width = tierProgress + '%';
    }, 900);

    setTimeout(() => {
      evoEl.style.transition = 'opacity 0.6s ease';
      evoEl.style.opacity = '0';
      setTimeout(() => {
        evoEl.classList.remove('active');
        evoEl.style.opacity = '';
        evoEl.style.transition = '';
        resolve();
      }, 600);
    }, 4500);
  });
}

function _createEvoOverlay() {
  const el = document.createElement('div');
  el.id = 'evolution-overlay';
  document.body.appendChild(el);
  return el;
}

function _updateStatusBarUser() {
  if (!_currentUser) return;
  const statusBar = document.getElementById('status-bar');
  if (!statusBar) return;
  const existing = document.getElementById('status-user-info');
  if (existing) existing.remove();
  const infoEl = document.createElement('span');
  infoEl.id = 'status-user-info';
  infoEl.className = 'visible';
  infoEl.innerHTML = `
    <span class="sep" style="opacity:0.4">//</span>
    AGENT: <span class="agent-name">${escHtml(_currentUser.display_name || _currentUser.username)}</span>
    <span class="sep" style="opacity:0.4">//</span>
    RANK: <span class="agent-rank">${escHtml((_currentUser.display_name || '').toUpperCase())}</span>
  `;
  statusBar.appendChild(infoEl);
}

function _maybeShowAdminButton() {
  if (!_currentUser || !_currentUser.is_admin) return;
  let btn = document.getElementById('admin-trigger');
  if (!btn) {
    btn = document.createElement('button');
    btn.id = 'admin-trigger';
    document.body.appendChild(btn);
  }
  btn.textContent = 'ADMIN';
  btn.title = 'Admin Console';
  btn.classList.add('visible');
  btn.addEventListener('click', _toggleAdminConsole);
  _ensureAdminOverlay();
}

function _ensureAdminOverlay() {
  if (document.getElementById('admin-overlay')) return;
  const overlay = document.createElement('div');
  overlay.id = 'admin-overlay';
  overlay.innerHTML = `
    <div class="admin-panel">
      <div class="admin-header">
        <div class="admin-title">ADMIN CONSOLE</div>
        <button class="admin-close" id="admin-close-btn">X</button>
      </div>
      <div class="admin-body" id="admin-body"><div style="font-size:10px;color:rgba(0,229,255,0.3)">LOADING...</div></div>
    </div>
  `;
  document.body.appendChild(overlay);
  document.getElementById('admin-close-btn').addEventListener('click', _toggleAdminConsole);
  overlay.addEventListener('click', e => { if (e.target === overlay) _toggleAdminConsole(); });
}

function _toggleAdminConsole() {
  const overlay = document.getElementById('admin-overlay');
  if (!overlay) return;
  if (overlay.classList.contains('active')) overlay.classList.remove('active');
  else { overlay.classList.add('active'); _loadAdminContent(); }
}

async function _loadAdminContent() {
  const body = document.getElementById('admin-body');
  if (!body) return;
  body.innerHTML = `<div style="font-size:10px;color:rgba(0,229,255,0.3)">LOADING...</div>`;

  try {
    const session = _currentUser ? _currentUser._session : getCookie(SESSION_COOKIE);
    const data = await _apiGet(`/admin/users?session=${encodeURIComponent(session)}`);
    if (!data.success) { body.innerHTML = `<div style="color:var(--magenta)">ACCESS DENIED</div>`; return; }
    const users = data.users || [];
    body.innerHTML = _buildAdminUI(users);
    _wireAdminControls(users, session);
  } catch (e) {
    body.innerHTML = `<div style="color:var(--magenta)">ERROR: ${escHtml(e.message)}</div>`;
  }
}

function _buildAdminUI(users) {
  const rows = users.map(u => `
    <tr>
      <td>${escHtml(u.username)}</td>
      <td>${escHtml(u.display_name || '-')}</td>
      <td>${escHtml(u.archetype || '-')}</td>
      <td>${u.tier !== undefined ? u.tier : '-'}</td>
      <td>${u.login_count || 0}</td>
      <td>${u.last_login ? _formatDate(u.last_login) : '-'}</td>
      <td>${u.is_admin ? '<span class="u-admin-badge">ADMIN</span>' : ''}</td>
    </tr>
  `).join('');

  const userOptions = users.map(u =>
    `<option value="${escHtml(u.username)}">${escHtml(u.username)}${u.is_admin ? ' *' : ''}</option>`
  ).join('');

  return `
    <div class="admin-section">
      <div class="admin-section-title">PLAYBACK CONTROL</div>
      <div class="admin-playback">
        <button class="admin-pb-btn" data-action="skip_prev">PREV</button>
        <button class="admin-pb-btn" data-action="play">PLAY</button>
        <button class="admin-pb-btn" data-action="pause">PAUSE</button>
        <button class="admin-pb-btn" data-action="skip_next">NEXT</button>
      </div>
      <div class="admin-reset-msg" id="admin-pb-msg"></div>
    </div>
    <div class="admin-section">
      <div class="admin-section-title">REGISTERED AGENTS (${users.length})</div>
      <div style="overflow-x:auto">
        <table class="admin-user-table">
          <thead><tr><th>HANDLE</th><th>DISPLAY</th><th>ARCHETYPE</th><th>TIER</th><th>LOGINS</th><th>LAST SEEN</th><th></th></tr></thead>
          <tbody>${rows || '<tr><td colspan="7">NO AGENTS</td></tr>'}</tbody>
        </table>
      </div>
    </div>
    <div class="admin-section">
      <div class="admin-section-title">RESET AGENT PASSWORD</div>
      <div class="admin-reset-row">
        <div class="auth-field" style="min-width:140px">
          <label class="auth-label">AGENT</label>
          <select class="admin-user-select" id="admin-reset-user"><option value="">- select -</option>${userOptions}</select>
        </div>
        <div class="auth-field" style="flex:1">
          <label class="auth-label">NEW PASSWORD <span class="opt-tag">(optional)</span></label>
          <input class="auth-input" type="password" id="admin-reset-pw" placeholder="blank = remove password" />
        </div>
        <button class="auth-btn auth-btn-sm auth-btn-ghost" id="admin-reset-btn">RESET</button>
      </div>
      <div class="admin-reset-msg" id="admin-reset-msg"></div>
    </div>
  `;
}

function _wireAdminControls(users, session) {
  document.querySelectorAll('.admin-pb-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const action = btn.dataset.action;
      const msgEl = document.getElementById('admin-pb-msg');
      try {
        const data = await _apiPost('/admin/set-track', { session_token: session, action });
        if (msgEl) {
          msgEl.className = 'admin-reset-msg ' + (data.success ? 'ok' : 'err');
          msgEl.textContent = data.success ? `${action.toUpperCase()} SENT` : (data.error || 'FAILED');
          setTimeout(() => { if (msgEl) msgEl.textContent = ''; }, 2500);
        }
      } catch (e) {
        if (msgEl) { msgEl.className = 'admin-reset-msg err'; msgEl.textContent = 'CONNECTION ERROR'; }
      }
    });
  });

  const resetBtn = document.getElementById('admin-reset-btn');
  if (resetBtn) {
    resetBtn.addEventListener('click', async () => {
      const userEl = document.getElementById('admin-reset-user');
      const pwEl = document.getElementById('admin-reset-pw');
      const msgEl = document.getElementById('admin-reset-msg');
      const username = userEl ? userEl.value : '';
      const newPw = pwEl ? pwEl.value : '';
      if (!username) { if (msgEl) { msgEl.className = 'admin-reset-msg err'; msgEl.textContent = 'SELECT AN AGENT'; } return; }
      try {
        const data = await _apiPost('/reset-password', { username, reset_token: session, new_password: newPw || undefined, admin_session: session });
        if (msgEl) {
          msgEl.className = 'admin-reset-msg ' + (data.success ? 'ok' : 'err');
          msgEl.textContent = data.success ? 'PASSWORD RESET OK' : (data.error || 'FAILED');
          setTimeout(() => { if (msgEl) msgEl.textContent = ''; }, 3000);
        }
        if (pwEl) pwEl.value = '';
      } catch (e) {
        if (msgEl) { msgEl.className = 'admin-reset-msg err'; msgEl.textContent = 'CONNECTION ERROR'; }
      }
    });
  }
}

function _formatDate(ts) {
  if (!ts) return '-';
  try {
    const d = new Date(typeof ts === 'number' ? ts * 1000 : ts);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } catch (e) { return ts; }
}

function _ensureAuthToast() {
  if (document.getElementById('auth-toast')) return;
  const el = document.createElement('div');
  el.id = 'auth-toast';
  el.className = 'auth-toast';
  document.body.appendChild(el);
}

let _toastTimer = null;
function _authToast(msg) {
  const el = document.getElementById('auth-toast');
  if (!el) return;
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => el.classList.remove('show'), 2800);
}

function _showFieldError(el, msg) {
  if (!el) return;
  el.textContent = msg;
  el.classList.add('visible');
}

function _setLoading(btn, loading) {
  if (!btn) return;
  btn.disabled = loading;
  if (loading) { btn.dataset.origText = btn.textContent; btn.textContent = 'PROCESSING...'; }
  else { btn.textContent = btn.dataset.origText || btn.textContent; }
}

function escHtml(str) {
  if (typeof str !== 'string') return str != null ? String(str) : '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

async function _apiPost(route, body) {
  const url = `${CGI_BIN}/users.py${route}`;
  const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  if (!res.ok) { let errBody = {}; try { errBody = await res.json(); } catch (e) {} throw new Error(errBody.error || `HTTP ${res.status}`); }
  return res.json();
}

async function _apiGet(route) {
  const url = `${CGI_BIN}/users.py${route}`;
  const res = await fetch(url);
  if (!res.ok) { let errBody = {}; try { errBody = await res.json(); } catch (e) {} throw new Error(errBody.error || `HTTP ${res.status}`); }
  return res.json();
}