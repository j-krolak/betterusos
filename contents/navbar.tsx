import React, { useEffect, useState } from "react";
import type {
  PlasmoCSConfig,
  PlasmoGetOverlayAnchor,
  PlasmoGetStyle,
} from "plasmo";

export const config: PlasmoCSConfig = {
  matches: ["https://*.edu.pl/*"],
  run_at: "document_idle",
  css: ["./navbar-font.css"],
};

export const getOverlayAnchor: PlasmoGetOverlayAnchor = async () =>
  document.body;

const NAVBAR_HEIGHT = "3.5rem";

export const getStyle: PlasmoGetStyle = () => {
  const style = document.createElement("style");
  style.textContent = `
    :host {
      --nav-bg: var(--usos-surface, #fff);
      --nav-border: var(--usos-border, #e5e7eb);
      --nav-text: var(--usos-text, #1e293b);
      --nav-text-secondary: var(--usos-text-muted, #64748b);
      --nav-primary: var(--usos-primary, #2563eb);
      --nav-primary-hover: var(--usos-primary-hover, #1d4ed8);
      --nav-hover-bg: rgba(128,128,128,0.08);
    }
    .bu-nav {
      position: fixed !important;
      top: 0 !important;
      left: 0 !important;
      right: 0 !important;
      z-index: 2147483646 !important;
      display: flex !important;
      align-items: center !important;
      justify-content: space-between !important;
      min-height: ${NAVBAR_HEIGHT} !important;
      padding: 0 1rem !important;
      background: var(--nav-bg) !important;
      border-bottom: 1px solid var(--nav-border) !important;
      box-shadow: 0 1px 3px rgba(0,0,0,0.06) !important;
      font-family: "Geist", system-ui, sans-serif !important;
      box-sizing: border-box !important;
    }
    .bu-nav-left { display: flex; align-items: center; gap: 0.75rem; flex: 1 1 auto; min-width: 0; }
    .bu-nav-links { display: none; align-items: center; gap: 0.25rem; }
    @media (min-width: 768px) {
      .bu-nav-links { display: flex; }
    }
    .bu-nav-link {
      display: inline-flex; align-items: center; padding: 0.5rem 0.75rem;
      border-radius: 6px; font-size: 0.9375rem; font-weight: 500; color: var(--nav-text-secondary);
      text-decoration: none; transition: background 0.15s, color 0.15s;
      position: relative;
    }
    .bu-nav-link:hover { background: var(--nav-hover-bg); color: var(--nav-text); }
    .bu-nav-link.active { background: transparent; color: var(--nav-primary); font-weight: 600; }
    .bu-nav-link.active::after {
      content: ''; position: absolute; bottom: -0.65rem; left: 0.5rem; right: 0.5rem;
      height: 2px; background: var(--nav-primary); border-radius: 2px;
    }
    .bu-nav-link.greyed { opacity: 0.6; cursor: not-allowed; pointer-events: none; }
    .bu-nav-right { display: flex; align-items: center; gap: 0.5rem; }
    .bu-icon-btn {
      display: inline-flex; align-items: center; justify-content: center;
      width: 2.25rem; height: 2.25rem; border: none; border-radius: 8px;
      background: transparent; color: var(--nav-text-secondary); cursor: pointer;
      transition: background 0.15s, color 0.15s;
    }
    .bu-icon-btn:hover { background: var(--nav-hover-bg); color: var(--nav-text); }
    .bu-user { font-size: 0.875rem; font-weight: 500; color: var(--nav-text-secondary); margin-right: 0.25rem; }
    .bu-hamburger { display: flex; align-items: center; justify-content: center; width: 2.5rem; height: 2.5rem; border: none; border-radius: 8px; background: transparent; color: var(--nav-text); cursor: pointer; }
    .bu-hamburger:hover { background: var(--nav-hover-bg); }
    @media (min-width: 768px) {
      .bu-hamburger { display: none; }
    }
    .bu-drawer {
      position: fixed; top: ${NAVBAR_HEIGHT}; left: 0; right: 0; bottom: 0;
      background: rgba(0,0,0,0.4); z-index: 2147483645;
      display: flex; flex-direction: column; padding: 1rem;
      font-family: "Geist", system-ui, sans-serif;
    }
    .bu-drawer-panel {
      background: var(--nav-bg); border-radius: 12px; padding: 1rem; max-width: 20rem; width: 100%;
      box-shadow: 0 10px 40px rgba(0,0,0,0.15);
    }
    .bu-drawer a, .bu-drawer .bu-drawer-item {
      display: flex; align-items: center; padding: 0.75rem 1rem;
      border-radius: 8px; font-size: 0.9375rem; font-weight: 500; color: var(--nav-text-secondary);
      text-decoration: none; margin-bottom: 0.25rem;
    }
    .bu-drawer a:hover, .bu-drawer .bu-drawer-item:hover { background: var(--nav-hover-bg); }
    .bu-drawer a.active { background: rgba(37,99,235,0.1); color: var(--nav-primary); }
    .bu-drawer .bu-drawer-divider { height: 1px; background: var(--nav-border); margin: 0.5rem 0; }
    .bu-login-btn {
      display: inline-flex; align-items: center; gap: 0.5rem;
      padding: 0.5rem 1rem; border-radius: 8px; font-size: 0.9375rem; font-weight: 500;
      background: var(--nav-primary); color: #fff !important; text-decoration: none;
      transition: background 0.15s, color 0.15s;
    }
    .bu-login-btn:hover { background: var(--nav-primary-hover); color: #fff !important; }
  `;
  return style;
};

// Icons as inline SVG
const IconMenu = () => (
  <svg
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <line x1="3" y1="6" x2="21" y2="6" />
    <line x1="3" y1="12" x2="21" y2="12" />
    <line x1="3" y1="18" x2="21" y2="18" />
  </svg>
);
const IconClose = () => (
  <svg
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);
const IconLogout = () => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    <polyline points="16 17 21 12 16 7" />
    <line x1="21" y1="12" x2="9" y2="12" />
  </svg>
);
const IconLanguage = () => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <circle cx="12" cy="12" r="10" />
    <line x1="2" y1="12" x2="22" y2="12" />
    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
  </svg>
);
const IconBell = () => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
    <path d="M13.73 21a2 2 0 0 1-3.46 0" />
  </svg>
);
const IconLogin = () => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
    <polyline points="10 17 15 12 10 7" />
    <line x1="15" y1="12" x2="3" y2="12" />
  </svg>
);

interface NavItem {
  href: string;
  name: string;
  selected: boolean;
  greyed: boolean;
}

function readNavData(): {
  navItems: NavItem[];
  user: string;
  loginUrl: string;
  logoutUrl: string;
  passwdUrl: string;
  langSwitchUrl: string;
} {
  const navItems: NavItem[] = [];
  const menuTop = document.querySelector("menu-top");
  if (menuTop) {
    const items =
      menuTop.querySelectorAll("menu-top-item") ||
      menuTop.shadowRoot?.querySelectorAll("menu-top-item") ||
      document.querySelectorAll("menu-top-item");
    Array.from(items).forEach((el) => {
      const href = el.getAttribute("href") || "#";
      const name = el.getAttribute("name") || "";
      navItems.push({
        href,
        name: name.charAt(0).toUpperCase() + name.slice(1).toLowerCase(),
        selected: el.hasAttribute("selected"),
        greyed: el.hasAttribute("greyed"),
      });
    });
  }
  const casBar = document.querySelector("cas-bar");
  const user = casBar?.getAttribute("logged-user") || "";
  const loginUrl = casBar?.getAttribute("login-url") || "";
  const logoutUrl = casBar?.getAttribute("logout-url") || "";
  const passwdUrl = casBar?.getAttribute("passwd-url") || "";
  const langSwitchUrl = casBar?.getAttribute("lang-switch-url") || "";
  return { navItems, user, loginUrl, logoutUrl, passwdUrl, langSwitchUrl };
}

function BetterUsosNavbar() {
  const [navItems, setNavItems] = useState<NavItem[]>([]);
  const [user, setUser] = useState("");
  const [loginUrl, setLoginUrl] = useState("");
  const [logoutUrl, setLogoutUrl] = useState("");
  const [passwdUrl, setPasswdUrl] = useState("");
  const [langSwitchUrl, setLangSwitchUrl] = useState("");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [enabled, setEnabled] = useState(() => {
    try {
      const raw = localStorage.getItem("better-usos-enabled");
      if (raw === null) return true;
      return JSON.parse(raw) as boolean;
    } catch {
      return true;
    }
  });

  const isLoggedIn = Boolean(user);

  useEffect(() => {
    if (!enabled) return;
    const data = readNavData();
    setNavItems(data.navItems);
    setUser(data.user);
    setLoginUrl(data.loginUrl);
    setLogoutUrl(data.logoutUrl);
    setPasswdUrl(data.passwdUrl);
    setLangSwitchUrl(data.langSwitchUrl);
    document.body.classList.add("better-usos-react-navbar");
    return () => {
      document.body.classList.remove("better-usos-react-navbar");
    };
  }, [enabled]);

  const handleNavClick = (
    e: React.MouseEvent<HTMLAnchorElement>,
    href: string,
    greyed: boolean,
  ) => {
    if (greyed || href.startsWith("javascript:")) {
      e.preventDefault();
      return;
    }
    if (
      typeof (
        window as unknown as { Common?: { confirmWarnings?: () => boolean } }
      ).Common?.confirmWarnings === "function"
    ) {
      if (
        !(
          window as unknown as { Common: { confirmWarnings: () => boolean } }
        ).Common.confirmWarnings()
      ) {
        e.preventDefault();
      }
    }
    setMobileOpen(false);
  };

  const triggerNotificationBell = () => {
    const bell = document.getElementById("notificationBell");
    if (bell) bell.click();
    setMobileOpen(false);
  };

  return (
    <>
      {!enabled ? null : (
        <>
          <nav className="bu-nav" role="navigation" aria-label="Główne menu">
            <div className="bu-nav-left">
              <button
                type="button"
                className="bu-hamburger"
                aria-label="Otwórz menu"
                onClick={() => setMobileOpen(true)}
              >
                <IconMenu />
              </button>
              <div className="bu-nav-links">
                {navItems.map((item) => (
                  <a
                    key={item.href + item.name}
                    className={`bu-nav-link ${item.selected ? "active" : ""} ${item.greyed ? "greyed" : ""}`}
                    href={item.greyed ? undefined : item.href}
                    onClick={(e) => handleNavClick(e, item.href, item.greyed)}
                  >
                    {item.name}
                  </a>
                ))}
              </div>
            </div>
            <div className="bu-nav-right">
              {isLoggedIn ? (
                <>
                  <button
                    type="button"
                    className="bu-icon-btn"
                    aria-label="Powiadomienia"
                    onClick={triggerNotificationBell}
                  >
                    <IconBell />
                  </button>
                  {langSwitchUrl && (
                    <a
                      href={langSwitchUrl}
                      className="bu-icon-btn"
                      aria-label="Zmień język"
                      title="Zmień język"
                      onClick={(e) => handleNavClick(e, langSwitchUrl, false)}
                    >
                      <IconLanguage />
                    </a>
                  )}
                  <span className="bu-user" title={user}>
                    {user}
                  </span>
                  {logoutUrl && (
                    <a
                      href={logoutUrl}
                      className="bu-icon-btn"
                      aria-label="Wyloguj"
                      title="Wyloguj"
                      onClick={(e) => handleNavClick(e, logoutUrl, false)}
                    >
                      <IconLogout />
                    </a>
                  )}
                </>
              ) : (
                <>
                  {langSwitchUrl && (
                    <a
                      href={langSwitchUrl}
                      className="bu-icon-btn"
                      aria-label="Zmień język"
                      title="Zmień język"
                      onClick={(e) => handleNavClick(e, langSwitchUrl, false)}
                    >
                      <IconLanguage />
                    </a>
                  )}
                  {loginUrl && (
                    <a
                      href={loginUrl}
                      className="bu-login-btn"
                      aria-label="Zaloguj się"
                      title="Zaloguj się"
                      onClick={(e) => handleNavClick(e, loginUrl, false)}
                    >
                      <IconLogin />
                      Zaloguj
                    </a>
                  )}
                </>
              )}
            </div>
          </nav>

          {mobileOpen && (
            <div
              className="bu-drawer"
              role="dialog"
              aria-label="Menu"
              onClick={() => setMobileOpen(false)}
            >
              <div
                className="bu-drawer-panel"
                onClick={(e) => e.stopPropagation()}
              >
                {navItems.map((item) => (
                  <a
                    key={item.href + item.name}
                    className={item.selected ? "active" : ""}
                    href={item.greyed ? undefined : item.href}
                    onClick={(e) => handleNavClick(e, item.href, item.greyed)}
                  >
                    {item.name}
                  </a>
                ))}
                <div className="bu-drawer-divider" />
                {isLoggedIn ? (
                  <>
                    {user && <div className="bu-drawer-item">{user}</div>}
                    {passwdUrl && (
                      <a
                        href={passwdUrl}
                        onClick={(e) => handleNavClick(e, passwdUrl, false)}
                      >
                        Zmiana hasła
                      </a>
                    )}
                    {langSwitchUrl && (
                      <a
                        href={langSwitchUrl}
                        onClick={(e) => handleNavClick(e, langSwitchUrl, false)}
                      >
                        Zmień język
                      </a>
                    )}
                    {logoutUrl && (
                      <a
                        href={logoutUrl}
                        onClick={(e) => handleNavClick(e, logoutUrl, false)}
                      >
                        Wyloguj
                      </a>
                    )}
                  </>
                ) : (
                  <>
                    {langSwitchUrl && (
                      <a
                        href={langSwitchUrl}
                        onClick={(e) => handleNavClick(e, langSwitchUrl, false)}
                      >
                        Zmień język
                      </a>
                    )}
                    {loginUrl && (
                      <a
                        href={loginUrl}
                        className="bu-login-btn"
                        onClick={(e) => handleNavClick(e, loginUrl, false)}
                      >
                        <IconLogin />
                        Zaloguj
                      </a>
                    )}
                  </>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </>
  );
}

export default BetterUsosNavbar;
