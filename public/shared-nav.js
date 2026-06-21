/* ════════════════════════════════════════════════════════════
   HELPING HEARTS — Shared Nav System (auth + mobile menu)
   One script, included identically on every page.
   Handles: hamburger menu, profile icon (always visible,
   outside the collapsible menu), donate button routing.
   ════════════════════════════════════════════════════════════ */

// ── Inject ALL nav-related CSS once (overrides any old per-page rules) ──
(function injectNavStyles() {
  const style = document.createElement('style');
  style.textContent = `
    nav { display:flex; align-items:center; justify-content:space-between; gap:16px; position:relative; z-index:1000 !important; }
    nav ul { display:flex; align-items:center; gap:8px; list-style:none; margin:0; padding:0; }

    /* Profile / Login area — ALWAYS visible, never hidden by hamburger */
    #hh-auth-area { display:flex; align-items:center; position:relative; flex-shrink:0; }
    #hh-profile-btn {
      width:42px; height:42px; border-radius:50%; border:2px solid var(--main-color,#96BF8A);
      cursor:pointer; display:flex; align-items:center; justify-content:center;
      font-family:'Poppins',sans-serif; font-weight:700; font-size:0.85rem; color:#fff;
      padding:0; flex-shrink:0;
    }
    #hh-profile-dropdown {
      display:none; position:absolute; top:52px; right:0; background:#fff;
      border-radius:12px; box-shadow:0 8px 30px rgba(0,0,0,0.18);
      min-width:210px; overflow:hidden; z-index:500; border:1px solid #eee;
    }
    #hh-login-btn {
      display:flex; align-items:center; gap:6px; padding:9px 18px;
      border:2px solid var(--main-color,#96BF8A); border-radius:8px;
      color:var(--main-color,#96BF8A); font-weight:700; text-decoration:none;
      font-size:0.88rem; font-family:'Poppins',sans-serif; white-space:nowrap;
    }

    /* Hamburger button — ONE consistent definition, everywhere */
    #hh-hamburger-btn {
      display:none; flex-direction:column; justify-content:center; align-items:center;
      gap:5px; width:40px; height:40px; background:none; border:none; cursor:pointer;
      padding:0; flex-shrink:0; -webkit-tap-highlight-color:transparent;
    }
    #hh-hamburger-btn span {
      display:block; width:24px; height:3px; background:#333; border-radius:3px;
      transition:transform 0.3s ease, opacity 0.3s ease; pointer-events:none;
    }
    #hh-hamburger-btn.open span:nth-child(1) { transform:translateY(8px) rotate(45deg); }
    #hh-hamburger-btn.open span:nth-child(2) { opacity:0; }
    #hh-hamburger-btn.open span:nth-child(3) { transform:translateY(-8px) rotate(-45deg); }

    #hh-nav-overlay {
      display:none; position:fixed; inset:0; background:rgba(0,0,0,0.45); z-index:399;
    }
    #hh-nav-overlay.active { display:block; }

    @media (max-width: 768px) {
      #hh-hamburger-btn { display:flex; margin-left:4px; }

      nav ul#hh-main-menu {
        display:none; position:fixed; top:0; right:0; width:min(300px,80vw); height:100vh;
        background:#fff; flex-direction:column; align-items:flex-start; gap:0;
        padding:80px 0 30px; box-shadow:-4px 0 30px rgba(0,0,0,0.15);
        z-index:450; overflow-y:auto; margin:0; pointer-events:auto;
      }
      nav ul#hh-main-menu.open { display:flex; }
      nav ul#hh-main-menu li { width:100%; pointer-events:auto; }
      nav ul#hh-main-menu li a {
        display:block; padding:14px 24px; border-radius:0; font-size:1rem;
        border-bottom:1px solid #f0f0f0; width:100%; box-sizing:border-box;
        pointer-events:auto; position:relative; z-index:1;
      }
      nav ul#hh-main-menu li a.donate-btn { margin:12px 20px; width:calc(100% - 40px); border-radius:8px; text-align:center; }
    }

    /* Close (X) button — ONLY ever visible inside the mobile slide-out panel */
    #hh-menu-close-btn { display:none; }
    @media (max-width: 768px) {
      #hh-menu-close-btn {
        display:flex; position:absolute; top:18px; right:18px; width:36px; height:36px;
        border:none; background:#f5f5f5; border-radius:50%; cursor:pointer;
        font-size:1.1rem; color:#333; z-index:460; align-items:center; justify-content:center;
      }
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

// ── Build profile icon / login button (OUTSIDE the menu <ul>) ──
function hhRenderAuthArea() {
  const nav = document.querySelector('nav');
  if (!nav) return;

  const existing = document.getElementById('hh-auth-area');
  if (existing) existing.remove();

  const area = document.createElement('div');
  area.id = 'hh-auth-area';

  if (hhIsLoggedIn()) {
    const user = hhGetUser() || {};
    const initials = `${(user.first_name||'?')[0]||'?'}${(user.last_name||'')[0]||''}`.toUpperCase();
    const avatarUrl = user.avatar_url;

    area.innerHTML = `
      <button id="hh-profile-btn" type="button" style="background:${avatarUrl ? `url('${avatarUrl}') center/cover` : 'linear-gradient(135deg,#96BF8A,#2ecc71)'};">
        ${avatarUrl ? '' : initials}
      </button>
      <div id="hh-profile-dropdown">
        <div style="padding:14px 16px;border-bottom:1px solid #f0f0f0;">
          <div style="font-weight:700;font-size:0.9rem;color:#333;">${user.first_name || ''} ${user.last_name || ''}</div>
          <div style="font-size:0.78rem;color:#888;margin-top:2px;word-break:break-all;">${user.email || ''}</div>
        </div>
        <a href="profile.html" style="display:flex;align-items:center;gap:8px;padding:12px 16px;color:#333;text-decoration:none;font-size:0.88rem;font-weight:600;">👤 My Profile</a>
        <a href="#" id="hh-logout-link" style="display:flex;align-items:center;gap:8px;padding:12px 16px;color:#e74c3c;text-decoration:none;font-size:0.88rem;font-weight:600;border-top:1px solid #f5f5f5;">🚪 Logout</a>
      </div>
    `;
    nav.appendChild(area);

    const btn = document.getElementById('hh-profile-btn');
    const dropdown = document.getElementById('hh-profile-dropdown');
    btn.addEventListener('click', function(e) {
      e.stopPropagation();
      dropdown.style.display = dropdown.style.display === 'block' ? 'none' : 'block';
    });
    document.addEventListener('click', function() { dropdown.style.display = 'none'; });
    document.getElementById('hh-logout-link').addEventListener('click', function(e) {
      e.preventDefault();
      hhLogout();
    });

  } else {
    area.innerHTML = `<a id="hh-login-btn" href="auth.html">👤 Login</a>`;
    nav.appendChild(area);
  }
}

// ── Build ONE consistent hamburger + slide-out menu ──────────
function hhRenderHamburgerMenu() {
  const nav = document.querySelector('nav');
  if (!nav) return;
  let ul = nav.querySelector('ul');
  if (!ul) return;
  ul.id = 'hh-main-menu';

  // Remove old hamburger/overlay/close-btn if present (avoids duplicates on re-render)
  document.getElementById('hh-hamburger-btn')?.remove();
  document.getElementById('hh-nav-overlay')?.remove();
  document.getElementById('hh-menu-close-btn')?.remove();
  document.querySelectorAll('.hh-hamburger').forEach(el => el.remove());
  document.querySelectorAll('.hh-nav-overlay').forEach(el => el.remove());

  const btn = document.createElement('button');
  btn.id = 'hh-hamburger-btn';
  btn.type = 'button';
  btn.setAttribute('aria-label', 'Toggle menu');
  btn.innerHTML = '<span></span><span></span><span></span>';
  nav.appendChild(btn);

  const overlay = document.createElement('div');
  overlay.id = 'hh-nav-overlay';
  document.body.appendChild(overlay);

  // Close button lives as the FIRST element inside the <ul>, but is only
  // ever shown on mobile via CSS (display:none on desktop) — see injected styles.
  const closeBtn = document.createElement('button');
  closeBtn.id = 'hh-menu-close-btn';
  closeBtn.type = 'button';
  closeBtn.setAttribute('aria-label', 'Close menu');
  closeBtn.innerHTML = '✕';
  ul.insertBefore(closeBtn, ul.firstChild);

  function openMenu() {
    ul.classList.add('open');
    overlay.classList.add('active');
    btn.classList.add('open');
    document.body.style.overflow = 'hidden';
  }
  function closeMenu() {
    ul.classList.remove('open');
    overlay.classList.remove('active');
    btn.classList.remove('open');
    document.body.style.overflow = '';
  }

  btn.addEventListener('click', function() {
    ul.classList.contains('open') ? closeMenu() : openMenu();
  });
  overlay.addEventListener('click', closeMenu);
  closeBtn.addEventListener('click', closeMenu);

  // IMPORTANT: do NOT call closeMenu() on link clicks here.
  // Doing so on 'click' (rather than letting navigation happen first)
  // can race with the browser's own navigation on mobile/WebViews,
  // which is what previously made menu links appear unresponsive.
  // The browser navigating away naturally resets all of this anyway.
}

// ── Rewire ALL Donate buttons/links on the page ─────────────
function hhWireDonateButtons() {
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
  hhRenderAuthArea();        // Profile/login button FIRST
  hhRenderHamburgerMenu();   // THEN hamburger — ends up in the corner
  hhWireDonateButtons();
});
