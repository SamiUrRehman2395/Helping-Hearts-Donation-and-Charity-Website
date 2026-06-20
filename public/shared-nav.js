/* ════════════════════════════════════════════════════════════
   HELPING HEARTS — Shared Auth & Nav System
   One script, included identically on every page.
   ════════════════════════════════════════════════════════════ */

// ── Inject mobile-friendly CSS for the auth area (self-contained) ──
(function injectAuthAreaStyles() {
  const style = document.createElement('style');
  style.textContent = `
    #hh-auth-area { list-style: none; }
    @media (max-width: 768px) {
      #hh-auth-area { width: 100%; padding: 12px 20px; }
      #hh-profile-btn { margin: 0 auto; }
      #hh-profile-dropdown { position: static !important; box-shadow: none !important; border: none !important; margin-top: 10px; width: 100%; }
      #hh-auth-area a[href="auth.html"] { width: 100%; justify-content: center; margin: 0; }
    }
  `;
  document.head.appendChild(style);
})();

// ── Auth state helpers ──────────────────────────────────────
function hhGetToken() { return localStorage.getItem('hh_token'); }
function hhGetUser() {
  try { return JSON.parse(localStorage.getItem('hh_user') || 'null'); }
  catch(e) { return null; }
}
function hhIsLoggedIn() { return !!hhGetToken(); }

function hhLogout() {
  if (!confirm('Are you sure you want to logout?')) return;
  localStorage.removeItem('hh_token');
  localStorage.removeItem('hh_user');
  window.location.href = 'helpingheart.html';
}

// ── Smart Donate routing ────────────────────────────────────
// Call this from any Donate button's onclick. Always checks
// CURRENT login state at click time (never stale).
function hhGoToDonate(event, campaignName) {
  if (event) event.preventDefault();
  const dest = campaignName
    ? `donate.html?campaign=${encodeURIComponent(campaignName)}`
    : 'donate.html';
  if (hhIsLoggedIn()) {
    window.location.href = dest;
  } else {
    window.location.href = `auth.html?redirect=${encodeURIComponent(dest)}`;
  }
}

// ── Build the profile icon + dropdown in the nav ────────────
function hhRenderAuthNav() {
  const nav = document.querySelector('nav');
  if (!nav) return;
  const ul = nav.querySelector('ul');
  if (!ul) return;

  // Remove any previous auth-area we may have rendered (avoids duplicates)
  const existing = document.getElementById('hh-auth-area');
  if (existing) existing.remove();

  const li = document.createElement('li');
  li.id = 'hh-auth-area';
  li.style.position = 'relative';

  if (hhIsLoggedIn()) {
    const user = hhGetUser() || {};
    const initials = `${(user.first_name||'?')[0]||'?'}${(user.last_name||'')[0]||''}`.toUpperCase();
    const avatarUrl = user.avatar_url;

    li.innerHTML = `
      <button id="hh-profile-btn" type="button" style="
        width:40px;height:40px;border-radius:50%;border:2px solid var(--main-color,#96BF8A);
        background:${avatarUrl ? `url('${avatarUrl}') center/cover` : 'linear-gradient(135deg,#96BF8A,#2ecc71)'};
        color:#fff;font-weight:700;font-size:0.85rem;cursor:pointer;
        display:flex;align-items:center;justify-content:center;
        font-family:'Poppins',sans-serif;padding:0;">
        ${avatarUrl ? '' : initials}
      </button>
      <div id="hh-profile-dropdown" style="
        display:none;position:absolute;top:50px;right:0;background:#fff;
        border-radius:12px;box-shadow:0 8px 30px rgba(0,0,0,0.15);
        min-width:200px;overflow:hidden;z-index:300;border:1px solid #eee;">
        <div style="padding:14px 16px;border-bottom:1px solid #f0f0f0;">
          <div style="font-weight:700;font-size:0.9rem;color:#333;">${user.first_name || ''} ${user.last_name || ''}</div>
          <div style="font-size:0.78rem;color:#888;margin-top:2px;">${user.email || ''}</div>
        </div>
        <a href="profile.html" style="display:flex;align-items:center;gap:8px;padding:12px 16px;color:#333;text-decoration:none;font-size:0.88rem;font-weight:600;">👤 My Profile</a>
        <a href="#" id="hh-logout-link" style="display:flex;align-items:center;gap:8px;padding:12px 16px;color:#e74c3c;text-decoration:none;font-size:0.88rem;font-weight:600;border-top:1px solid #f5f5f5;">🚪 Logout</a>
      </div>
    `;
    ul.appendChild(li);

    const btn = document.getElementById('hh-profile-btn');
    const dropdown = document.getElementById('hh-profile-dropdown');
    btn.addEventListener('click', function(e) {
      e.stopPropagation();
      dropdown.style.display = dropdown.style.display === 'block' ? 'none' : 'block';
    });
    document.addEventListener('click', function() {
      dropdown.style.display = 'none';
    });
    document.getElementById('hh-logout-link').addEventListener('click', function(e) {
      e.preventDefault();
      hhLogout();
    });

  } else {
    li.innerHTML = `<a href="auth.html" style="
      display:flex;align-items:center;gap:6px;padding:8px 16px;
      border:2px solid var(--main-color,#96BF8A);border-radius:8px;
      color:var(--main-color,#96BF8A);font-weight:700;text-decoration:none;font-size:0.9rem;">
      👤 Login
    </a>`;
    ul.appendChild(li);
  }
}

// ── Rewire ALL Donate buttons/links on the page ─────────────
function hhWireDonateButtons() {
  // Catches any link whose href starts with donate.html, regardless of class name
  // (donate-btn, cta-btn-white, btn-donate-card, modal-donate-btn, cta-btn, etc.)
  document.querySelectorAll('a[href^="donate.html"], a[href*="auth.html?redirect=donate"]').forEach(function(a) {
    if (a.dataset.hhWired) return;
    a.dataset.hhWired = '1';
    const campaignMatch = a.getAttribute('href') && a.getAttribute('href').match(/campaign=([^&]+)/);
    const campaignName = campaignMatch ? decodeURIComponent(campaignMatch[1]) : null;
    a.addEventListener('click', function(e) {
      hhGoToDonate(e, campaignName);
    });
  });
}

// ── Run on every page load ──────────────────────────────────
document.addEventListener('DOMContentLoaded', function() {
  hhRenderAuthNav();
  hhWireDonateButtons();
});
