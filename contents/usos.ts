import type { PlasmoCSConfig } from "plasmo";

import cssText from "data-text:~contents/style.css";

export const config: PlasmoCSConfig = {
  matches: ["https://*.edu.pl/*"],
  run_at: "document_idle",
};

/** Escape HTML special characters to prevent XSS */
function escapeHTML(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Inject the main stylesheet only when the extension is enabled */
function injectMainCSS(): void {
  const style = document.createElement("style");
  style.id = "better-usos-main-css";
  style.textContent = cssText;
  (document.head || document.documentElement).appendChild(style);
}

const DASHBOARD_STORAGE_KEY = "better-usos-dashboard";
const STATISTICS_STORAGE_KEY = "better-usos-statistics";
const THEME_CACHE_KEY = "better-usos-theme-cache";
const BANNER_CACHE_KEY = "better-usos-banner-cache";
const ENABLED_CACHE_KEY = "better-usos-enabled";

type PaletteId = "light" | "dark";

interface BetterUsosSettings {
  enabled?: boolean;
  showBanner?: boolean;
  themeId?: PaletteId;
}

interface GradeEntry {
  name: string;
  subject: string;
  value: number;
  max: number | null;
  date: number;
  url: string;
}

interface GradeStatistics {
  defeatedCount: number;
  failCount: number;
  revealedCount: number;
  totalGrades: number;
  lastUpdated: number;
  defeatedEntries: GradeEntry[];
  failEntries: GradeEntry[];
  coins: number;
  lastFreeSpin: number;
}

const EMPTY_STATS: GradeStatistics = {
  defeatedCount: 0,
  failCount: 0,
  revealedCount: 0,
  totalGrades: 0,
  lastUpdated: 0,
  defeatedEntries: [],
  failEntries: [],
  coins: 0,
  lastFreeSpin: 0,
};

/** In-memory stats cache (loaded once from chrome.storage.local) */
let _statsCache: GradeStatistics = { ...EMPTY_STATS };
let _statsCacheReady = false;

function loadStatistics(): GradeStatistics {
  return { ..._statsCache };
}

function saveStatistics(stats: GradeStatistics): void {
  stats.lastUpdated = Date.now();
  _statsCache = { ...stats };
  try {
    chrome.storage.local.set({ [STATISTICS_STORAGE_KEY]: stats });
  } catch {
    // ignore
  }
}

async function initStatsCache(): Promise<void> {
  try {
    const res = await chrome.storage.local.get(STATISTICS_STORAGE_KEY);
    const parsed = res[STATISTICS_STORAGE_KEY];
    if (parsed && typeof parsed === "object") {
      _statsCache = { ...EMPTY_STATS, ...parsed } as GradeStatistics;
    }
  } catch {
    /* ignore */
  }
  _statsCacheReady = true;
}

function updateStatistic(
  key: "defeatedCount" | "failCount" | "revealedCount" | "coins",
  increment: number = 1,
): void {
  const stats = loadStatistics();
  stats[key] += increment;
  saveStatistics(stats);
  // Update dashboard panel if it exists
  refreshStatisticsPanel();
  refreshCoinDisplay();
}

function addGradeEntry(type: "defeated" | "fail", entry: GradeEntry): void {
  const stats = loadStatistics();
  const list = type === "defeated" ? stats.defeatedEntries : stats.failEntries;
  list.push(entry);
  saveStatistics(stats);
}

function setTotalGrades(total: number): void {
  const stats = loadStatistics();
  stats.totalGrades = Math.max(stats.totalGrades, total);
  saveStatistics(stats);
}

function refreshStatisticsPanel(): void {
  const panel = document.querySelector("#bu-stats-panel-content");
  if (!panel) return;
  const stats = loadStatistics();
  while (panel.firstChild) panel.removeChild(panel.firstChild);
  const statsHtml = buildStatsPanelHTML(stats);
  // Safe: buildStatsPanelHTML używa escapeHTML na wszystkich dynamicznych danych
  panel.insertAdjacentHTML("afterbegin", statsHtml);
  attachStatCardListeners(panel);
}

function hasFreeSpinToday(): boolean {
  const stats = loadStatistics();
  if (!stats.lastFreeSpin) return true;
  const last = new Date(stats.lastFreeSpin);
  const now = new Date();
  return (
    last.getFullYear() !== now.getFullYear() ||
    last.getMonth() !== now.getMonth() ||
    last.getDate() !== now.getDate()
  );
}

function useFreeSpinToday(): void {
  const stats = loadStatistics();
  stats.lastFreeSpin = Date.now();
  saveStatistics(stats);
}

function refreshCoinDisplay(): void {
  const coinEl = document.querySelector("#bu-slot-coins");
  if (!coinEl) return;
  const stats = loadStatistics();
  coinEl.textContent = String(stats.coins);
  // Update lever disabled state — enable if coins > 0 OR free spin available
  const lever = document.querySelector(
    "#bu-slot-pull",
  ) as HTMLButtonElement | null;
  if (lever) {
    if (stats.coins <= 0 && !hasFreeSpinToday()) {
      lever.disabled = true;
      lever.classList.add("bu-lever-disabled");
    } else {
      lever.disabled = false;
      lever.classList.remove("bu-lever-disabled");
    }
  }
}

function attachStatCardListeners(root: Element): void {
  root.querySelectorAll(".bu-stat-clickable").forEach((card) => {
    card.addEventListener("click", () => {
      const type = (card as HTMLElement).dataset.buStatType as
        | "defeated"
        | "fail";
      if (type) showStatsModal(type);
    });
  });
}

// Inline SVG icons (Lucide-style, 24x24)
const svgDefeated = `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 17.5 3 6V3h3l11.5 11.5"/><path d="M13 19l6-6"/><path d="m16 16 3.5 3.5"/><path d="m19 19 2 2"/><path d="M14.5 6.5 18 3h3v3l-3.5 3.5"/><path d="m5 14 4 4"/><path d="m7 17-2 2"/><path d="m3 21 2-2"/></svg>`;
const svgFail = `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="12" r="1"/><circle cx="15" cy="12" r="1"/><path d="M8 20v2h8v-2"/><path d="m12.5 17-.5-1-.5 1h1z"/><path d="M16 20a2 2 0 0 0 1.56-3.25 8 8 0 1 0-11.12 0A2 2 0 0 0 8 20"/></svg>`;
const svgRevealed = `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0"/><circle cx="12" cy="12" r="3"/></svg>`;
const svgClose = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;

function buildEntryListHTML(entries: GradeEntry[], emptyMsg: string): string {
  if (entries.length === 0)
    return `<div class="bu-entries-empty">${emptyMsg}</div>`;
  return entries
    .map((e) => {
      const dateStr = new Date(e.date).toLocaleDateString("pl-PL", {
        day: "numeric",
        month: "short",
        year: "numeric",
      });
      const maxStr = e.max !== null ? ` / ${e.max}` : "";
      const subject = e.subject || "Nieznany przedmiot";
      return `
      <a class="bu-entry-row" href="${escapeHTML(e.url)}" title="Przejdź do strony ocen">
        <div class="bu-entry-info">
          <span class="bu-entry-name">${escapeHTML(e.name)}</span>
          <span class="bu-entry-subject">${escapeHTML(subject)}</span>
        </div>
        <span class="bu-entry-details">
          <span class="bu-entry-score">${escapeHTML(String(e.value))}${escapeHTML(maxStr)} pkt</span>
          <span class="bu-entry-date">${escapeHTML(dateStr)}</span>
        </span>
      </a>`;
    })
    .join("");
}

function showStatsModal(type: "defeated" | "fail"): void {
  // Remove existing modal
  document.querySelector(".bu-stats-modal-overlay")?.remove();

  const stats = loadStatistics();
  const isDefeated = type === "defeated";
  const entries = isDefeated ? stats.defeatedEntries : stats.failEntries;
  const title = isDefeated ? "YOU DEFEATED" : "YOU FAILED";
  const subtitle = isDefeated
    ? `${entries.length} ocen z maksymalnym wynikiem`
    : `${entries.length} ocen z wynikiem 0`;

  const overlay = document.createElement("div");
  overlay.className = "bu-stats-modal-overlay";
  // Tworzymy modal bez innerHTML
  const modal = document.createElement("div");
  modal.className = `bu-stats-modal ${isDefeated ? "bu-modal-defeated" : "bu-modal-fail"}`;
  const header = document.createElement("div");
  header.className = "bu-modal-header";
  const headerLeft = document.createElement("div");
  const titleDiv = document.createElement("div");
  titleDiv.className = "bu-modal-title";
  titleDiv.textContent = title;
  const subtitleDiv = document.createElement("div");
  subtitleDiv.className = "bu-modal-subtitle";
  subtitleDiv.textContent = subtitle;
  headerLeft.appendChild(titleDiv);
  headerLeft.appendChild(subtitleDiv);
  const closeBtn = document.createElement("button");
  closeBtn.className = "bu-modal-close";
  closeBtn.type = "button";
  closeBtn.setAttribute("aria-label", "Zamknij");
  // Safe: static SVG only
  closeBtn.innerHTML = svgClose;
  header.appendChild(headerLeft);
  header.appendChild(closeBtn);
  modal.appendChild(header);
  const body = document.createElement("div");
  body.className = "bu-modal-body";
  // Safe: buildEntryListHTML używa escapeHTML
  body.insertAdjacentHTML("afterbegin", buildEntryListHTML(entries, isDefeated ? "Brak defeated ocen – odsłoń oceny ze sprawdzianów!" : "Brak failed ocen – tak trzymaj!"));
  modal.appendChild(body);
  overlay.appendChild(modal);

  document.body.appendChild(overlay);

  // Close on overlay click or close button
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) overlay.remove();
  });
  overlay
    .querySelector(".bu-modal-close")
    ?.addEventListener("click", () => overlay.remove());
  // Close on Escape
  const onKey = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      overlay.remove();
      document.removeEventListener("keydown", onKey);
    }
  };
  document.addEventListener("keydown", onKey);
}

function buildStatsPanelHTML(stats: GradeStatistics): string {
  const normalCount =
    stats.revealedCount - stats.defeatedCount - stats.failCount;

  return `
    <div class="bu-stats-grid">
      <div class="bu-stat-card bu-stat-defeated bu-stat-clickable" data-bu-stat-type="defeated">
        <div class="bu-stat-icon">${svgDefeated}</div>
        <div class="bu-stat-value">${stats.defeatedCount}</div>
        <div class="bu-stat-label">DEFEATED</div>
      </div>
      <div class="bu-stat-card bu-stat-fail bu-stat-clickable" data-bu-stat-type="fail">
        <div class="bu-stat-icon">${svgFail}</div>
        <div class="bu-stat-value">${stats.failCount}</div>
        <div class="bu-stat-label">FAILED</div>
      </div>
      <div class="bu-stat-card bu-stat-revealed">
        <div class="bu-stat-icon">${svgRevealed}</div>
        <div class="bu-stat-value">${stats.revealedCount}</div>
        <div class="bu-stat-label">Odsłonięte</div>
      </div>
    </div>
    ${
      stats.revealedCount > 0
        ? `
    <div class="bu-stats-bar">
      ${stats.defeatedCount > 0 ? `<div class="bu-bar-segment bu-bar-defeated" style="flex:${stats.defeatedCount}" title="Defeated: ${stats.defeatedCount}"></div>` : ""}
      ${normalCount > 0 ? `<div class="bu-bar-segment bu-bar-normal" style="flex:${normalCount}" title="Zwykłe: ${normalCount}"></div>` : ""}
      ${stats.failCount > 0 ? `<div class="bu-bar-segment bu-bar-fail" style="flex:${stats.failCount}" title="Failed: ${stats.failCount}"></div>` : ""}
    </div>
    `
        : ""
    }
    ${stats.lastUpdated > 0 ? `<div class="bu-stats-footer">Ostatnia aktualizacja: ${new Date(stats.lastUpdated).toLocaleDateString("pl-PL", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}</div>` : ""}
  `;
}

/** Set by setupDashboard so extension popup can toggle edit mode via messages */
let dashboardEditState: {
  dashboard: HTMLElement;
  persistOrder: () => void;
} | null = null;

function injectShadowStyle(
  hostSelectors: string[],
  cssContent: string,
  hostNode: Document | ShadowRoot | Element = document.body,
  useAdopted = false,
): void {
  if (hostSelectors.length === 0) {
    // useAdopted: append to adoptedStyleSheets (wins over Lit's built-in sheets)
    if (
      useAdopted &&
      hostNode instanceof ShadowRoot &&
      "adoptedStyleSheets" in hostNode
    ) {
      try {
        const sheet = new CSSStyleSheet();
        sheet.replaceSync(cssContent);
        const existing = Array.from(hostNode.adoptedStyleSheets || []);
        hostNode.adoptedStyleSheets = [...existing, sheet];
      } catch {
        /* fallback to <style> injection */
        const style = document.createElement("style");
        style.textContent = cssContent;
        hostNode.appendChild(style);
      }
    } else {
      const style = document.createElement("style");
      style.textContent = cssContent;
      hostNode.appendChild(style);
    }
    return;
  }
  const hosts = hostNode.querySelectorAll(hostSelectors[0]);
  for (const host of hosts) {
    if (host.shadowRoot) {
      injectShadowStyle(
        hostSelectors.slice(1),
        cssContent,
        host.shadowRoot,
        useAdopted,
      );
    }
  }
}

// SVG icons for edit-mode UI only
const icons = {
  edit: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`,
  check: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`,
  eye: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`,
  eyeOff: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>`,
};

type Palette = Record<string, string>;

const LIGHT_PALETTE: Palette = {
  "--usos-bg": "#f8fafc",
  "--usos-surface": "#ffffff",
  "--usos-border": "#e2e8f0",
  "--usos-border-subtle": "#f1f5f9",
  "--usos-primary": "#2563eb",
  "--usos-primary-hover": "#1d4ed8",
  "--usos-text": "#1e293b",
  "--usos-text-muted": "#64748b",
  "--usos-header-gradient": "#fafbfc",
  "--usos-border-hover": "#cbd5e1",
};

const DARK_PALETTE: Palette = {
  // Better USOS custom variables
  "--usos-bg": "#020617",
  "--usos-surface": "#0f172a",
  "--usos-border": "#1e293b",
  "--usos-border-subtle": "#111827",
  "--usos-primary": "#3b82f6",
  "--usos-primary-hover": "#60a5fa",
  "--usos-text": "#e2e8f0",
  "--usos-text-muted": "#94a3b8",
  "--usos-header-gradient": "#111827",
  "--usos-border-hover": "#334155",
  "--usos-shadow": "0 1px 3px rgba(0, 0, 0, 0.3)",
  "--usos-shadow-md": "0 4px 12px rgba(0, 0, 0, 0.3)",
  // Override USOS native variables so shadow DOM components inherit dark colors
  "--font-color": "#e2e8f0",
  "--primary": "#818cf8",
  "--on-primary": "#020617",
  "--secondary": "#fbbf24",
  "--secondary-variant": "#f59e0b",
  "--background": "#0f172a",
  "--on-background": "#e2e8f0",
  "--background-secondary": "#1e293b",
  "--on-background-secondary": "#cbd5e1",
  "--grey": "#94a3b8",
  "--border": "#334155",
  "--ok-status": "#4ade80",
  "--error": "#f87171",
  "--warning": "#fbbf24",
  "--accent-red": "#f87171",
  "--accent-blue": "#60a5fa",
  "--accent-green": "#34d399",
  "--accent-violet": "#a78bfa",
  "--font-color-reverse": "#1e293b",
  "--background-reverse": "#e2e8f0",
  // Timetable entry colors for dark mode (--bu-tt- prefix to avoid collision with shadow DOM vars)
  "--bu-tt-color-1": "rgba(52, 211, 153, 0.18)",
  "--bu-tt-color-1-border": "rgba(52, 211, 153, 0.5)",
  "--bu-tt-color-2": "rgba(251, 191, 36, 0.18)",
  "--bu-tt-color-2-border": "rgba(251, 191, 36, 0.5)",
  "--bu-tt-color-3": "rgba(96, 165, 250, 0.18)",
  "--bu-tt-color-3-border": "rgba(96, 165, 250, 0.5)",
  "--bu-tt-color-4": "rgba(167, 139, 250, 0.18)",
  "--bu-tt-color-4-border": "rgba(167, 139, 250, 0.5)",
  "--bu-tt-color-5": "rgba(163, 230, 53, 0.18)",
  "--bu-tt-color-5-border": "rgba(163, 230, 53, 0.5)",
  "--bu-tt-color-6": "rgba(253, 224, 71, 0.18)",
  "--bu-tt-color-6-border": "rgba(253, 224, 71, 0.5)",
  "--bu-tt-color-7": "rgba(148, 163, 184, 0.18)",
  "--bu-tt-color-7-border": "rgba(148, 163, 184, 0.5)",
  "--bu-tt-color-8": "rgba(251, 113, 133, 0.18)",
  "--bu-tt-color-8-border": "rgba(251, 113, 133, 0.5)",
  // timetable-day background
  "--bu-tt-day-bg": "transparent",
};

function applyPalette(id: PaletteId): void {
  const palette: Palette = id === "dark" ? DARK_PALETTE : LIGHT_PALETTE;

  const root = document.documentElement;

  // Remove all previously set palette vars before applying new ones
  const allKeys = new Set([
    ...Object.keys(LIGHT_PALETTE),
    ...Object.keys(DARK_PALETTE),
  ]);
  for (const key of allKeys) {
    if (!(key in palette)) {
      root.style.removeProperty(key);
    }
  }

  for (const [key, value] of Object.entries(palette)) {
    root.style.setProperty(key, value);
  }

  // Toggle dark mode class for overrides that can't use CSS variables
  document.body.classList.toggle("better-usos-dark", id === "dark");

  // Cache theme in localStorage for instant apply on next page load
  try {
    localStorage.setItem(THEME_CACHE_KEY, JSON.stringify({ themeId: id }));
  } catch {
    /* ignore */
  }
}

function applySettings(settings: BetterUsosSettings): void {
  const showBanner = settings.showBanner ?? true;
  document.body.classList.toggle("better-usos-hide-banner", !showBanner);
  // Cache banner setting for instant apply on next page load
  try {
    localStorage.setItem(BANNER_CACHE_KEY, JSON.stringify(showBanner));
  } catch {
    /* ignore */
  }
  // Cache enabled state
  try {
    localStorage.setItem(
      ENABLED_CACHE_KEY,
      JSON.stringify(settings.enabled ?? true),
    );
  } catch {
    /* ignore */
  }
  const themeId: PaletteId = settings.themeId === "dark" ? "dark" : "light";
  applyPalette(themeId);
}

function getFrameId(frame: Element): string {
  const el = frame as HTMLElement;
  if (el.id) return el.id;
  const titleLink = frame.querySelector('[slot="title"] a, h2[slot="title"] a');
  const href = titleLink?.getAttribute("href") ?? "";
  // Use only the href for hashing — title text changes with language
  let hash = 0;
  for (let i = 0; i < href.length; i++)
    hash = ((hash << 5) - hash + href.charCodeAt(i)) | 0;
  return `bu-${Math.abs(hash).toString(36)}`;
}

/** Column span: 2 = 1/3, 3 = 1/2, 4 = 2/3, 6 = full row */
const SPAN_OPTIONS = [2, 3, 4, 6] as const;
type SpanValue = (typeof SPAN_OPTIONS)[number];

interface DashboardState {
  order: string[];
  hidden: string[];
  /** frameId -> grid column span (2, 3, or 6) */
  spans?: Record<string, SpanValue>;
}

let _dashboardCache: DashboardState | null = null;
let _dashboardCacheReady = false;

function loadDashboardState(): DashboardState | null {
  return _dashboardCache;
}

function saveDashboardState(state: DashboardState): void {
  _dashboardCache = state;
  try {
    chrome.storage.local.set({ [DASHBOARD_STORAGE_KEY]: state });
  } catch {
    // ignore
  }
}

async function initDashboardCache(): Promise<void> {
  try {
    const res = await chrome.storage.local.get(DASHBOARD_STORAGE_KEY);
    const data = res[DASHBOARD_STORAGE_KEY] as DashboardState | undefined;
    if (data && Array.isArray(data.order) && Array.isArray(data.hidden)) {
      _dashboardCache = data;
    }
  } catch {
    /* ignore */
  }
  _dashboardCacheReady = true;
}

/** Selector matching all dashboard cards (native USOS frames + stats panel) */
const CARD_SEL = "usos-frame, .bu-stats-panel, .bu-slot-panel";

function setupDashboard(): void {
  try {
    const dashboard = document.querySelector(".local-home-table");
    if (!dashboard || !dashboard.querySelector("usos-frame")) return;

    // --- Create the statistics panel element first so it participates in ordering ---
    const stats = loadStatistics();
    const statsPanel = document.createElement("div");
    statsPanel.className = "bu-stats-panel";
    statsPanel.id = "bu-stats-frame";
    // Tworzymy panel statystyk bez innerHTML
    const statsHeader = document.createElement("div");
    statsHeader.className = "bu-stats-header";
    const statsTitle = document.createElement("span");
    statsTitle.className = "bu-stats-title";
    // Safe: static SVG only
    statsTitle.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: -3px; margin-right: 6px;"><path d="M3 3v16a2 2 0 0 0 2 2h16"/><path d="m7 11 4-4 4 4 6-6"/></svg>Statystyki ocen';
    statsHeader.appendChild(statsTitle);
    statsPanel.appendChild(statsHeader);
    const statsContent = document.createElement("div");
    statsContent.id = "bu-stats-panel-content";
    // Safe: buildStatsPanelHTML używa escapeHTML
    statsContent.insertAdjacentHTML("afterbegin", buildStatsPanelHTML(stats));
    statsPanel.appendChild(statsContent);

    // --- Create the slot machine panel ---
    const SLOT_EMOJIS = ["🍒", "🍋", "🍊", "🍇", "⭐", "💎", "7️⃣", "🔔"];
    const slotPanel = document.createElement("div");
    slotPanel.className = "bu-slot-panel";
    slotPanel.id = "bu-slot-frame";
    // Tworzymy slotPanel bez innerHTML
    const slotHeader = document.createElement("div");
    slotHeader.className = "bu-slot-header";
    const slotTitle = document.createElement("span");
    slotTitle.className = "bu-slot-title";
    // Safe: static SVG only
    slotTitle.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: -3px; margin-right: 6px;"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M12 4v16"/><path d="M2 12h20"/><circle cx="7" cy="8" r="1.5" fill="currentColor" stroke="none"/><circle cx="17" cy="8" r="1.5" fill="currentColor" stroke="none"/><circle cx="7" cy="16" r="1.5" fill="currentColor" stroke="none"/><circle cx="17" cy="16" r="1.5" fill="currentColor" stroke="none"/></svg>Jednoręki bandyta';
    slotHeader.appendChild(slotTitle);
    const coinsBadge = document.createElement("span");
    coinsBadge.className = "bu-slot-coins-badge";
    coinsBadge.title = "Monety – zdobywasz 1 za każde odsłonięcie oceny, 2 za DEFEATED";
    // Safe: static SVG only
    coinsBadge.innerHTML = '<svg class="bu-coin-icon" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10" stroke-width="2"/><path d="M12 6v12" stroke-width="1.8"/><path d="M15 9.5c0-1.1-1.3-2-3-2s-3 .9-3 2c0 1.1 1.3 2 3 2.5s3 1.4 3 2.5c0 1.1-1.3 2-3 2s-3-.9-3-2" stroke-width="1.8"/></svg>';
    const coinsSpan = document.createElement("span");
    coinsSpan.id = "bu-slot-coins";
    coinsSpan.textContent = String(stats.coins);
    coinsBadge.appendChild(coinsSpan);
    slotHeader.appendChild(coinsBadge);
    slotPanel.appendChild(slotHeader);
    const slotBody = document.createElement("div");
    slotBody.className = "bu-slot-body";
    const slotMachine = document.createElement("div");
    slotMachine.className = "bu-slot-machine";
    const reelsCol = document.createElement("div");
    reelsCol.className = "bu-slot-reels-col";
    const slotWindow = document.createElement("div");
    slotWindow.className = "bu-slot-window";
    for (let i = 0; i < 3; i++) {
      const reel = document.createElement("div");
      reel.className = "bu-slot-reel";
      reel.id = `bu-reel-${i}`;
      const reelInner = document.createElement("div");
      reelInner.className = "bu-slot-reel-inner";
      const emojiSpan = document.createElement("span");
      emojiSpan.textContent = SLOT_EMOJIS[i];
      reelInner.appendChild(emojiSpan);
      reel.appendChild(reelInner);
      slotWindow.appendChild(reel);
    }
    reelsCol.appendChild(slotWindow);
    const slotResult = document.createElement("div");
    slotResult.className = "bu-slot-result";
    slotResult.id = "bu-slot-result";
    reelsCol.appendChild(slotResult);
    slotMachine.appendChild(reelsCol);
    const leverWrap = document.createElement("div");
    leverWrap.className = "bu-slot-lever-wrap";
    const leverBtn = document.createElement("button");
    leverBtn.className = "bu-slot-lever";
    leverBtn.id = "bu-slot-pull";
    leverBtn.title = "Pociągnij!";
    const leverArm = document.createElement("div");
    leverArm.className = "bu-lever-arm";
    const leverBall = document.createElement("div");
    leverBall.className = "bu-lever-ball";
    leverArm.appendChild(leverBall);
    leverBtn.appendChild(leverArm);
    leverWrap.appendChild(leverBtn);
    slotMachine.appendChild(leverWrap);
    slotBody.appendChild(slotMachine);
    slotPanel.appendChild(slotBody);

    // --- Fullscreen confetti explosion ---
    function launchConfetti(): void {
      const CONFETTI_COUNT = 150;
      const COLORS = [
        "#d4a017",
        "#ff4444",
        "#44bb44",
        "#4488ff",
        "#ff44ff",
        "#ffaa00",
        "#00ddff",
        "#ff6600",
      ];
      const SHAPES = ["square", "rect", "circle"];
      const container = document.createElement("div");
      container.className = "bu-confetti-container";
      document.body.appendChild(container);

      interface Particle {
        el: HTMLDivElement;
        x: number;
        y: number;
        vx: number;
        vy: number;
        gravity: number;
        rotation: number;
        rotSpeed: number;
        scale: number;
        opacity: number;
        drag: number;
        wobbleSpeed: number;
        wobbleAmp: number;
        phase: number;
      }

      const particles: Particle[] = [];

      for (let i = 0; i < CONFETTI_COUNT; i++) {
        const el = document.createElement("div");
        el.className = "bu-confetti-piece";
        const color = COLORS[Math.floor(Math.random() * COLORS.length)];
        const shape = SHAPES[Math.floor(Math.random() * SHAPES.length)];
        const size = 6 + Math.random() * 8;

        el.style.backgroundColor = color;
        el.style.width = shape === "rect" ? `${size * 0.5}px` : `${size}px`;
        el.style.height = shape === "rect" ? `${size * 1.4}px` : `${size}px`;
        if (shape === "circle") el.style.borderRadius = "50%";
        else el.style.borderRadius = "2px";

        container.appendChild(el);

        // Launch from random x across screen top area
        const startX = Math.random() * window.innerWidth;
        const startY = -20 - Math.random() * 40;

        particles.push({
          el,
          x: startX,
          y: startY,
          vx: (Math.random() - 0.5) * 8,
          vy: 2 + Math.random() * 6,
          gravity: 0.12 + Math.random() * 0.08,
          rotation: Math.random() * 360,
          rotSpeed: (Math.random() - 0.5) * 15,
          scale: 0.8 + Math.random() * 0.6,
          opacity: 1,
          drag: 0.98 + Math.random() * 0.015,
          wobbleSpeed: 2 + Math.random() * 4,
          wobbleAmp: 1 + Math.random() * 3,
          phase: Math.random() * Math.PI * 2,
        });
      }

      const startTime = performance.now();
      const DURATION = 5000; // total animation time
      const FADE_START = 3500; // start fading out

      function tickConfetti(now: number) {
        const elapsed = now - startTime;
        if (elapsed > DURATION) {
          container.remove();
          return;
        }

        const fadeProgress =
          elapsed > FADE_START
            ? (elapsed - FADE_START) / (DURATION - FADE_START)
            : 0;

        for (const p of particles) {
          p.vy += p.gravity;
          p.vx *= p.drag;
          p.vy *= p.drag;
          p.x +=
            p.vx +
            Math.sin(elapsed * 0.001 * p.wobbleSpeed + p.phase) * p.wobbleAmp;
          p.y += p.vy;
          p.rotation += p.rotSpeed;
          p.opacity = 1 - fadeProgress;

          p.el.style.transform = `translate(${p.x}px, ${p.y}px) rotate(${p.rotation}deg) scale(${p.scale})`;
          p.el.style.opacity = String(p.opacity);
        }

        requestAnimationFrame(tickConfetti);
      }

      requestAnimationFrame(tickConfetti);
    }

    // Slot machine logic
    function initSlotMachine(): void {
      const lever = slotPanel.querySelector(
        "#bu-slot-pull",
      ) as HTMLElement | null;
      const reelEls = [0, 1, 2].map(
        (i) =>
          slotPanel.querySelector(
            `#bu-reel-${i} .bu-slot-reel-inner`,
          ) as HTMLElement | null,
      );
      const resultEl = slotPanel.querySelector(
        "#bu-slot-result",
      ) as HTMLElement | null;
      if (!lever || reelEls.some((r) => !r) || !resultEl) return;
      // All elements verified — safe to use
      const reels = reelEls as HTMLElement[];
      let spinning = false;
      const CELL = 64;
      const N = SLOT_EMOJIS.length; // number of symbols

      // Build the reel strip: 3 full sets of emojis so we can wrap around smoothly
      function buildReelStrip(): string {
        let html = "";
        for (let s = 0; s < 3; s++) {
          for (const emoji of SLOT_EMOJIS) {
            html += `<span>${emoji}</span>`;
          }
        }
        return html;
      }

      // Initialize reels with the strip (safe: only emojis)
      reels.forEach((reel) => {
        while (reel.firstChild) reel.removeChild(reel.firstChild);
        for (let s = 0; s < 3; s++) {
          for (const emoji of SLOT_EMOJIS) {
            const span = document.createElement("span");
            span.textContent = emoji;
            reel.appendChild(span);
          }
        }
        reel.style.transform = "translateY(0)";
      });

      // Ease-out timing function: fast start → slow stop
      function easeOut(t: number): number {
        return 1 - Math.pow(1 - t, 3);
      }

      /**
       * Animate one drum. `targetIdx` = index in SLOT_EMOJIS to land on.
       * `totalTurns` = how many full rotations (in emoji-counts) to spin.
       * Returns a promise that resolves when the reel stops.
       */
      function spinReel(
        reel: HTMLElement,
        targetIdx: number,
        totalTurns: number,
        duration: number,
      ): Promise<void> {
        return new Promise((resolve) => {
          // Total distance in emoji units: full rotations + offset to land on target
          const totalDistance = totalTurns * N + targetIdx;
          const totalPx = totalDistance * CELL;
          const startTime = performance.now();

          function tick(now: number) {
            const elapsed = now - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const easedProgress = easeOut(progress);

            // Current position in px
            const currentPx = totalPx * easedProgress;
            // Wrap around: since we have 3×N items (3 sets), wrap within that range
            const wrapPx = currentPx % (N * 3 * CELL);
            reel.style.transform = `translateY(-${wrapPx}px)`;

            if (progress < 1) {
              requestAnimationFrame(tick);
            } else {
              // Snap to exact target position
              const finalPx = targetIdx * CELL;
              reel.style.transform = `translateY(-${finalPx}px)`;
              resolve();
            }
          }

          requestAnimationFrame(tick);
        });
      }

      // Initial lever state based on coins
      refreshCoinDisplay();

      lever.addEventListener("click", () => {
        if (spinning) return;
        const currentStats = loadStatistics();
        const freeSpinAvailable = hasFreeSpinToday();
        if (currentStats.coins <= 0 && !freeSpinAvailable) {
          resultEl.textContent = "Brak monet!";
          resultEl.className = "bu-slot-result bu-slot-no-coins";
          return;
        }
        // Use free spin if available, otherwise spend a coin
        if (freeSpinAvailable) {
          useFreeSpinToday();
          refreshCoinDisplay();
        } else {
          updateStatistic("coins", -1);
        }
        spinning = true;
        lever.classList.add("bu-lever-pulled");
        resultEl.textContent = "";
        resultEl.className = "bu-slot-result";

        // Pick random target for each reel
        const targetIndices = [0, 1, 2].map(() =>
          Math.floor(Math.random() * N),
        );
        const results = targetIndices.map((i) => SLOT_EMOJIS[i]);

        // Lever animation reset
        setTimeout(() => lever.classList.remove("bu-lever-pulled"), 400);

        // Spin reels with increasing duration + number of turns (staggered stop)
        const promises = reels.map((reel, i) => {
          const turns = 3 + i * 2; // 3, 5, 7 full rotations
          const duration = 1500 + i * 800; // 1.5s, 2.3s, 3.1s
          return spinReel(reel, targetIndices[i], turns, duration);
        });

        Promise.all(promises).then(() => {
          spinning = false;
          if (results[0] === results[1] && results[1] === results[2]) {
            resultEl.textContent = "🎉 JACKPOT! +10 monet!";
            resultEl.classList.add("bu-slot-jackpot");
            updateStatistic("coins", 10);
            launchConfetti();
          } else if (
            results[0] === results[1] ||
            results[1] === results[2] ||
            results[0] === results[2]
          ) {
            resultEl.textContent = "😏 Prawie...";
            resultEl.classList.add("bu-slot-almost");
          } else {
            const msgs = [
              "Spróbuj ponownie!",
              "Następnym razem...",
              "Kręć dalej!",
              "Jeszcze raz?",
              "Nie poddawaj się!",
            ];
            resultEl.textContent =
              msgs[Math.floor(Math.random() * msgs.length)];
          }
        });
      });
    }

    const usosFrames = Array.from(
      dashboard.querySelectorAll("usos-frame"),
    ) as HTMLElement[];

    // Combine native frames + stats panel + slot machine into one list
    const frames: HTMLElement[] = [statsPanel, slotPanel, ...usosFrames];
    const state = loadDashboardState();

    // Assign ids and collect default order
    const idToFrame = new Map<string, HTMLElement>();
    const defaultOrder: string[] = [];
    for (const frame of frames) {
      const id = getFrameId(frame);
      if (!frame.id) frame.id = id;
      idToFrame.set(id, frame);
      defaultOrder.push(id);
    }

    const order =
      state?.order?.filter((id) => idToFrame.has(id)) ?? defaultOrder;
    // Add any new ids not yet in saved order (e.g. stats panel added for the first time)
    for (const id of defaultOrder) {
      if (!order.includes(id)) order.unshift(id);
    }
    const hiddenSet = new Set(state?.hidden ?? []);
    const spans = state?.spans ?? {};

    function getSpan(id: string): SpanValue {
      const s = spans[id];
      if (s && SPAN_OPTIONS.includes(s)) return s;
      // Default: stats panel = full width, others = half
      return id === "bu-stats-frame" ? 6 : 3;
    }

    function applySpan(frame: HTMLElement, span: SpanValue): void {
      frame.style.gridColumn = `span ${span}`;
      frame.dataset.buSpan = String(span);
    }

    // Build grid: visible panels first, then divider, then hidden panels at bottom
    const visibleOrder = order.filter((id) => !hiddenSet.has(id));
    const hiddenOrder = order.filter((id) => hiddenSet.has(id));

    const wrapper = document.createElement("div");
    wrapper.className = "bottom-dashboard bu-dashboard-grid";
    for (const id of visibleOrder) {
      const frame = idToFrame.get(id);
      if (!frame) continue;
      applySpan(frame, getSpan(id));
      wrapper.appendChild(frame);
    }
    const divider = document.createElement("div");
    divider.className = "bu-hidden-divider";
    divider.setAttribute("aria-hidden", "true");
    if (hiddenOrder.length > 0) {
      wrapper.appendChild(divider);
      for (const id of hiddenOrder) {
        const frame = idToFrame.get(id);
        if (!frame) continue;
        frame.classList.add("bu-hidden-card");
        applySpan(frame, getSpan(id));
        wrapper.appendChild(frame);
      }
    }
    dashboard.innerHTML = "";
    dashboard.appendChild(wrapper);

    // Hide button + width control (shown only in edit mode)
    for (const frame of frames) {
      const id = getFrameId(frame);
      const hideBtn = document.createElement("button");
      hideBtn.type = "button";
      hideBtn.className = "bu-hide-btn";
      hideBtn.setAttribute("aria-label", "Ukryj ten blok");
      hideBtn.innerHTML = hiddenSet.has(id) ? icons.eyeOff : icons.eye;
      hideBtn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        const willBeHidden = !frame.classList.contains("bu-hidden-card");
        if (willBeHidden) {
          frame.classList.add("bu-hidden-card");
          hideBtn.innerHTML = icons.eyeOff;
          if (!wrapper.contains(divider)) wrapper.appendChild(divider);
          wrapper.appendChild(frame);
        } else {
          frame.classList.remove("bu-hidden-card");
          hideBtn.innerHTML = icons.eye;
          wrapper.insertBefore(frame, divider);
          if (
            wrapper.querySelectorAll(`:is(${CARD_SEL}).bu-hidden-card`)
              .length === 0 &&
            divider.parentElement
          )
            divider.remove();
        }
        persistOrder();
      });

      const widthWrap = document.createElement("div");
      widthWrap.className = "bu-width-control";
      SPAN_OPTIONS.forEach((span) => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "bu-span-btn";
        btn.textContent =
          span === 2 ? "⅓" : span === 3 ? "½" : span === 4 ? "⅔" : "1";
        btn.title =
          span === 2
            ? "1/3 szerokości"
            : span === 3
              ? "1/2 szerokości (dwa w rzędzie)"
              : span === 4
                ? "2/3 szerokości"
                : "Pełna szerokość";
        btn.dataset.span = String(span);
        if (getSpan(id) === span) btn.classList.add("bu-span-active");
        btn.addEventListener("click", (e) => {
          e.preventDefault();
          e.stopPropagation();
          applySpan(frame, span);
          widthWrap
            .querySelectorAll(".bu-span-btn")
            .forEach((b) => b.classList.remove("bu-span-active"));
          btn.classList.add("bu-span-active");
          persistOrder();
        });
        widthWrap.appendChild(btn);
      });

      // For usos-frame: insert into the title slot; for custom panels: into the header
      const titleEl = frame.classList.contains("bu-stats-panel")
        ? frame.querySelector(".bu-stats-title")
        : frame.classList.contains("bu-slot-panel")
          ? frame.querySelector(".bu-slot-title")
          : frame.querySelector('[slot="title"], h2[slot="title"]');
      if (titleEl) {
        (titleEl as HTMLElement).style.display = "flex";
        (titleEl as HTMLElement).style.alignItems = "center";
        titleEl.appendChild(widthWrap);
        titleEl.appendChild(hideBtn);
      }
    }

    function getCurrentOrder(): string[] {
      return Array.from(wrapper.querySelectorAll(CARD_SEL)).map((f) =>
        getFrameId(f),
      );
    }

    function getHiddenIds(): string[] {
      return Array.from(
        wrapper.querySelectorAll(`:is(${CARD_SEL}).bu-hidden-card`),
      ).map((f) => getFrameId(f));
    }

    function getSpans(): Record<string, SpanValue> {
      const out: Record<string, SpanValue> = {};
      wrapper.querySelectorAll(CARD_SEL).forEach((f) => {
        const id = getFrameId(f);
        const span = (f as HTMLElement).dataset.buSpan;
        const n = span ? parseInt(span, 10) : 3;
        if (SPAN_OPTIONS.includes(n as SpanValue)) out[id] = n as SpanValue;
      });
      return out;
    }

    function persistOrder(): void {
      saveDashboardState({
        order: getCurrentOrder(),
        hidden: getHiddenIds(),
        spans: getSpans(),
      });
    }

    // Drag and drop
    let dragged: HTMLElement | null = null;
    function onDragStart(e: DragEvent): void {
      if (!dashboard.classList.contains("bu-edit-mode")) return;
      const card = (e.currentTarget as HTMLElement).closest(
        CARD_SEL,
      ) as HTMLElement;
      dragged = card;
      if (dragged) {
        dragged.classList.add("bu-dragging");
        e.dataTransfer?.setData("text/plain", getFrameId(dragged));
        e.dataTransfer!.effectAllowed = "move";
      }
    }
    function onDragEnd(): void {
      dragged?.classList.remove("bu-dragging");
      dragged = null;
    }
    function onDragOver(e: DragEvent): void {
      e.preventDefault();
      e.dataTransfer!.dropEffect = "move";
      const target = (e.target as HTMLElement).closest(CARD_SEL) as HTMLElement;
      if (!target || !dragged || target === dragged) return;
      const draggedHidden = dragged.classList.contains("bu-hidden-card");
      const targetHidden = target.classList.contains("bu-hidden-card");
      if (draggedHidden !== targetHidden) return;
      const rect = target.getBoundingClientRect();
      const mid = rect.top + rect.height / 2;
      if (e.clientY < mid) wrapper.insertBefore(dragged, target);
      else wrapper.insertBefore(dragged, target.nextSibling);
    }
    function onDrop(e: DragEvent): void {
      e.preventDefault();
      persistOrder();
    }

    for (const frame of frames) {
      frame.setAttribute("draggable", "true");
      frame.addEventListener("dragstart", onDragStart);
      frame.addEventListener("dragend", onDragEnd);
      frame.addEventListener("dragover", onDragOver);
      frame.addEventListener("drop", onDrop);
    }

    dashboardEditState = { dashboard, persistOrder };

    // Attach click handlers for stat cards
    attachStatCardListeners(statsPanel);

    // Initialize slot machine
    initSlotMachine();

    // Inject icons into usos-frame title headers
    injectFrameIcons(usosFrames);
  } catch (err) {
    console.warn("[Better USOS] setupDashboard error:", err);
  }
}

/* ─── Sidebar icons ─────────────────────────────────────────── */

/** SVG icon strings for sidebar items (Lucide-style, 18×18) */
const SIDEBAR_ICON = (d: string) =>
  `<svg class="bu-sidebar-icon" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;

const SIDEBAR_ICONS: Record<string, string> = {
  // — Mój USOSweb section —
  "na skróty": SIDEBAR_ICON(
    '<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>',
  ),
  "plan zajęć": SIDEBAR_ICON(
    '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4"/><path d="M8 2v4"/><path d="M3 10h18"/>',
  ),
  "grupy zajęciowe": SIDEBAR_ICON(
    '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  ),
  "plany użytkownika": SIDEBAR_ICON(
    '<path d="M8 6h13"/><path d="M8 12h13"/><path d="M8 18h13"/><path d="M3 6h.01"/><path d="M3 12h.01"/><path d="M3 18h.01"/>',
  ),
  usosmail: SIDEBAR_ICON(
    '<path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/>',
  ),
  oświadczenia: SIDEBAR_ICON(
    '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><path d="m9 15 2 2 4-4"/>',
  ),
  "preferencje prywatności": SIDEBAR_ICON(
    '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10"/>',
  ),
  "preferencje usosweb": SIDEBAR_ICON(
    '<circle cx="12" cy="12" r="3"/><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/>',
  ),
  powiadomienia: SIDEBAR_ICON(
    '<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>',
  ),
  "mój leon": SIDEBAR_ICON(
    '<path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>',
  ),

  // — Dla studentów section —
  indeks: SIDEBAR_ICON(
    '<path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H19a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1H6.5a1 1 0 0 1 0-5H20"/>',
  ),
  "office 365": SIDEBAR_ICON(
    '<rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8"/><path d="M12 17v4"/>',
  ),
  rejestracje: SIDEBAR_ICON(
    '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/>',
  ),
  "rejestracje na egzaminy": SIDEBAR_ICON(
    '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><path d="M16 13H8"/><path d="M16 17H8"/><path d="M10 9H8"/>',
  ),
  "moje studia": SIDEBAR_ICON(
    '<path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c0 2 6 3 6 3s6-1 6-3v-5"/>',
  ),
  spotkania: SIDEBAR_ICON(
    '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  ),
  "złota kreda": SIDEBAR_ICON(
    '<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>',
  ),
  "moje zdrowie": SIDEBAR_ICON(
    '<path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>',
  ),

  // — Sub-items (Moje studia sub-section) —
  sprawdziany: SIDEBAR_ICON(
    '<path d="m9 15 2 2 4-4"/><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>',
  ),
  oceny: SIDEBAR_ICON(
    '<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>',
  ),
  podpięcia: SIDEBAR_ICON(
    '<path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48"/>',
  ),
  decyzje: SIDEBAR_ICON(
    '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><path d="M16 13H8"/><path d="M16 17H8"/>',
  ),
  "zaliczenia etapów": SIDEBAR_ICON(
    '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>',
  ),
  "grupy dziekańskie": SIDEBAR_ICON(
    '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>',
  ),
  epodania: SIDEBAR_ICON(
    '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><path d="M12 18v-6"/><path d="M9 15l3 3 3-3"/>',
  ),
  rankingi: SIDEBAR_ICON(
    '<path d="M8 6h13"/><path d="M8 12h13"/><path d="M8 18h13"/><path d="M3 6h.01"/><path d="M3 12h.01"/><path d="M3 18h.01"/>',
  ),
  stypendia: SIDEBAR_ICON(
    '<line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>',
  ),
  rozliczenia: SIDEBAR_ICON(
    '<rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/>',
  ),
  "wymiana studencka": SIDEBAR_ICON(
    '<circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>',
  ),
  ankiety: SIDEBAR_ICON(
    '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><path d="M16 13H8"/><path d="M16 17H8"/><path d="M10 9H8"/>',
  ),
  dyplomy: SIDEBAR_ICON(
    '<path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c0 2 6 3 6 3s6-1 6-3v-5"/>',
  ),
  suplementy: SIDEBAR_ICON(
    '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>',
  ),
  mlegitymacja: SIDEBAR_ICON(
    '<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/>',
  ),
  "decyzje administracyjne": SIDEBAR_ICON(
    '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><path d="m9 15 2 2 4-4"/>',
  ),
  "badania lekarskie": SIDEBAR_ICON(
    '<path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>',
  ),

  // — Dokumenty section —
  dokumenty: SIDEBAR_ICON(
    '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><path d="M16 13H8"/><path d="M16 17H8"/><path d="M10 9H8"/>',
  ),
  "kalendarz rejestracji": SIDEBAR_ICON(
    '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4"/><path d="M8 2v4"/><path d="M3 10h18"/>',
  ),
  kontakt: SIDEBAR_ICON(
    '<path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/>',
  ),

  // — Rejestracje sub-items —
  kalendarz: SIDEBAR_ICON(
    '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4"/><path d="M8 2v4"/><path d="M3 10h18"/>',
  ),
  koszyk: SIDEBAR_ICON(
    '<circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>',
  ),
  "na przedmioty": SIDEBAR_ICON(
    '<path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H19a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1H6.5a1 1 0 0 1 0-5H20"/>',
  ),
  "bezpośrednie do grup": SIDEBAR_ICON(
    '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>',
  ),
  "preferencje grup": SIDEBAR_ICON(
    '<circle cx="12" cy="12" r="3"/><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/>',
  ),

  // — Dokumenty sub-items —
  "strona główna": SIDEBAR_ICON(
    '<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>',
  ),
  apd: SIDEBAR_ICON(
    '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>',
  ),
  srs: SIDEBAR_ICON(
    '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><path d="M16 13H8"/><path d="M16 17H8"/>',
  ),
  ankieter: SIDEBAR_ICON(
    '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><path d="m9 15 2 2 4-4"/>',
  ),
  leon: SIDEBAR_ICON(
    '<path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>',
  ),
  asystent: SIDEBAR_ICON(
    '<circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/>',
  ),

  // — English translations —
  "my shortcuts": SIDEBAR_ICON(
    '<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>',
  ),
  timetable: SIDEBAR_ICON(
    '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4"/><path d="M8 2v4"/><path d="M3 10h18"/>',
  ),
  "course groups": SIDEBAR_ICON(
    '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  ),
  "user plans": SIDEBAR_ICON(
    '<path d="M8 6h13"/><path d="M8 12h13"/><path d="M8 18h13"/><path d="M3 6h.01"/><path d="M3 12h.01"/><path d="M3 18h.01"/>',
  ),
  declarations: SIDEBAR_ICON(
    '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><path d="m9 15 2 2 4-4"/>',
  ),
  "privacy preferences": SIDEBAR_ICON(
    '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10"/>',
  ),
  "usosweb preferences": SIDEBAR_ICON(
    '<circle cx="12" cy="12" r="3"/><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/>',
  ),
  notifications: SIDEBAR_ICON(
    '<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>',
  ),
  "my leon": SIDEBAR_ICON(
    '<path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>',
  ),
  index: SIDEBAR_ICON(
    '<path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H19a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1H6.5a1 1 0 0 1 0-5H20"/>',
  ),
  registrations: SIDEBAR_ICON(
    '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/>',
  ),
  "registrations for exams": SIDEBAR_ICON(
    '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><path d="M16 13H8"/><path d="M16 17H8"/><path d="M10 9H8"/>',
  ),
  "my studies": SIDEBAR_ICON(
    '<path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c0 2 6 3 6 3s6-1 6-3v-5"/>',
  ),
  meetings: SIDEBAR_ICON(
    '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  ),
  tests: SIDEBAR_ICON(
    '<path d="m9 15 2 2 4-4"/><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>',
  ),
  grades: SIDEBAR_ICON(
    '<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>',
  ),
  linkages: SIDEBAR_ICON(
    '<path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48"/>',
  ),
  decisions: SIDEBAR_ICON(
    '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><path d="M16 13H8"/><path d="M16 17H8"/>',
  ),
  promotions: SIDEBAR_ICON(
    '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>',
  ),
  "dean's groups": SIDEBAR_ICON(
    '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>',
  ),
  "e-applications": SIDEBAR_ICON(
    '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><path d="M12 18v-6"/><path d="M9 15l3 3 3-3"/>',
  ),
  rankings: SIDEBAR_ICON(
    '<path d="M8 6h13"/><path d="M8 12h13"/><path d="M8 18h13"/><path d="M3 6h.01"/><path d="M3 12h.01"/><path d="M3 18h.01"/>',
  ),
  scholarships: SIDEBAR_ICON(
    '<line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>',
  ),
  settlements: SIDEBAR_ICON(
    '<rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/>',
  ),
  "student mobility": SIDEBAR_ICON(
    '<circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>',
  ),
  surveys: SIDEBAR_ICON(
    '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><path d="M16 13H8"/><path d="M16 17H8"/><path d="M10 9H8"/>',
  ),
  diplomas: SIDEBAR_ICON(
    '<path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c0 2 6 3 6 3s6-1 6-3v-5"/>',
  ),
  supplement: SIDEBAR_ICON(
    '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>',
  ),
  "administrative decisions": SIDEBAR_ICON(
    '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><path d="m9 15 2 2 4-4"/>',
  ),
  "medical informations": SIDEBAR_ICON(
    '<path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>',
  ),
  calendar: SIDEBAR_ICON(
    '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4"/><path d="M8 2v4"/><path d="M3 10h18"/>',
  ),
  cart: SIDEBAR_ICON(
    '<circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>',
  ),
  "for courses": SIDEBAR_ICON(
    '<path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H19a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1H6.5a1 1 0 0 1 0-5H20"/>',
  ),
  "direct for groups": SIDEBAR_ICON(
    '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>',
  ),
  "group preferences": SIDEBAR_ICON(
    '<circle cx="12" cy="12" r="3"/><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/>',
  ),
  documents: SIDEBAR_ICON(
    '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><path d="M16 13H8"/><path d="M16 17H8"/><path d="M10 9H8"/>',
  ),
  "registration calendar": SIDEBAR_ICON(
    '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4"/><path d="M8 2v4"/><path d="M3 10h18"/>',
  ),
  contact: SIDEBAR_ICON(
    '<path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/>',
  ),
  "home page": SIDEBAR_ICON(
    '<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>',
  ),
  assistant: SIDEBAR_ICON(
    '<circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/>',
  ),
};

/** Map _action URL fragments → sidebar icon key (fallback when text doesn't match) */
const SIDEBAR_ACTION_ICONS: Record<string, string> = {
  "home/index": "na skróty",
  "home/plan": "plan zajęć",
  "home/grupy": "grupy zajęciowe",
  "home/plany": "plany użytkownika",
  "home/usos_mail": "usosmail",
  "home/oswiadczenia": "oświadczenia",
  preferencjePrywatnosci: "preferencje prywatności",
  preferencjeUsosweb: "preferencje usosweb",
  preferencjePowiadomien: "powiadomienia",
  "leon.pw": "mój leon",
  "dla_stud/index": "indeks",
  pw_office: "office 365",
  "rejestracja/kalendarz": "rejestracje",
  "rejestracja/koszyk": "koszyk",
  "rejestracja/przedmioty": "na przedmioty",
  "rejestracja/brdg2": "bezpośrednie do grup",
  "rejestracja/rdg2": "preferencje grup",
  "rejestracja/egzaminy": "rejestracje na egzaminy",
  sprawdziany: "sprawdziany",
  "studia/oceny": "oceny",
  "studia/podpiecia": "podpięcia",
  "studia/decyzje/": "decyzje",
  "studia/zaliczenia": "zaliczenia etapów",
  grupyDziekanskie: "grupy dziekańskie",
  listaPodan: "epodania",
  "studia/rankingi": "rankingi",
  "studia/stypendia": "stypendia",
  "studia/rozliczenia": "rozliczenia",
  "studia/wymiana": "wymiana studencka",
  "studia/ankiety": "ankiety",
  "studia/dyplomy": "dyplomy",
  "studia/suplementy": "suplementy",
  mlegitymacja: "mlegitymacja",
  pw_decyzje: "decyzje administracyjne",
  pw_badania: "badania lekarskie",
  spotkania: "spotkania",
  zlota_kreda: "złota kreda",
  centermed: "moje zdrowie",
  "news/default": "dokumenty",
  "news/rejestracje": "kalendarz rejestracji",
  "news/kontakt": "kontakt",
};

function resolveIconForLink(el: Element): string | null {
  // 1. Try matching by direct text (only own text, ignoring children)
  const ownText = Array.from(el.childNodes)
    .filter((n) => n.nodeType === Node.TEXT_NODE)
    .map((n) => n.textContent || "")
    .join("")
    .trim()
    .toLowerCase();
  if (ownText && SIDEBAR_ICONS[ownText]) return SIDEBAR_ICONS[ownText];

  // 2. Fallback: try full textContent
  const fullText = (el.textContent || "").trim().toLowerCase();
  if (fullText && SIDEBAR_ICONS[fullText]) return SIDEBAR_ICONS[fullText];

  // 3. Fallback: match by href _action URL pattern
  const href = el.getAttribute("href") || "";
  if (href) {
    for (const [fragment, iconKey] of Object.entries(SIDEBAR_ACTION_ICONS)) {
      if (href.includes(fragment)) {
        return SIDEBAR_ICONS[iconKey] || null;
      }
    }
  }

  return null;
}

function doInjectSidebarIcons(): boolean {
  const menuLeft = document.querySelector("menu-left");
  if (!menuLeft) return false;

  const links = menuLeft.querySelectorAll("a, span");
  if (links.length === 0) return false; // not ready yet

  // Remove empty li spacers from DOM
  menuLeft.querySelectorAll("li").forEach((li) => {
    if (!li.textContent?.trim() && li.children.length === 0) {
      li.remove();
    }
  });

  // Add section-header class to span-only items (e.g. "MOJE STUDIA")
  menuLeft
    .querySelectorAll(":scope > ul > li > span:not([class*='selected'])")
    .forEach((span) => {
      const li = span.closest("li");
      if (li && !li.querySelector("a")) {
        span.classList.add("bu-sidebar-section");
      }
    });

  let injected = 0;
  links.forEach((el) => {
    if (el.querySelector(".bu-sidebar-icon")) {
      injected++;
      return;
    }

    const icon = resolveIconForLink(el);
    if (icon) {
      el.insertAdjacentHTML("afterbegin", icon);
      injected++;
    }
  });
  return injected > 0;
}

function injectSidebarIcons(): void {
  // Try immediately
  if (doInjectSidebarIcons()) return;

  // Retry with escalating delays (Lit custom elements may render asynchronously)
  requestAnimationFrame(() => {
    if (doInjectSidebarIcons()) return;
    setTimeout(() => {
      if (doInjectSidebarIcons()) return;
      setTimeout(() => {
        if (doInjectSidebarIcons()) return;
        // Last resort: observe the DOM for changes in the menu-left area
        const menuLeft = document.querySelector("menu-left");
        if (!menuLeft) return;
        const observer = new MutationObserver(() => {
          if (doInjectSidebarIcons()) {
            observer.disconnect();
          }
        });
        observer.observe(menuLeft, { childList: true, subtree: true });
        // Also watch the shadow root if it exists
        if (menuLeft.shadowRoot) {
          observer.observe(menuLeft.shadowRoot, {
            childList: true,
            subtree: true,
          });
        }
        // Auto-disconnect after 5 seconds to avoid leaks
        setTimeout(() => observer.disconnect(), 5000);
      }, 500);
    }, 200);
  });
}

/** SVG icon strings for dashboard card titles (Lucide-style, 20×20) */
const ICON_SVGS = {
  linkage: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>`,
  calendar: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4"/><path d="M8 2v4"/><path d="M3 10h18"/><path d="M8 14h.01"/><path d="M12 14h.01"/><path d="M16 14h.01"/><path d="M8 18h.01"/><path d="M12 18h.01"/><path d="M16 18h.01"/></svg>`,
  tests: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><path d="m9 15 2 2 4-4"/></svg>`,
  classes: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H19a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1H6.5a1 1 0 0 1 0-5H20"/></svg>`,
  search: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>`,
  list: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 6h13"/><path d="M8 12h13"/><path d="M8 18h13"/><path d="M3 6h.01"/><path d="M3 12h.01"/><path d="M3 18h.01"/></svg>`,
  shield: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10"/></svg>`,
  settings: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>`,
  user: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`,
  star: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`,
  register: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/></svg>`,
  document: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>`,
  mail: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>`,
  bell: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>`,
  money: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>`,
  card: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>`,
  graduation: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c0 2 6 3 6 3s6-1 6-3v-5"/></svg>`,
} as const;

/** Map _action URL fragments → icon key */
const ACTION_ICON_MAP: Record<string, keyof typeof ICON_SVGS> = {
  podpiecia: "linkage",
  "home/plan": "calendar",
  sprawdziany: "tests",
  "home/grupy": "classes",
  katalog: "search",
  preferencjePrywatnosci: "shield",
  preferencjeUsosweb: "settings",
  "home/plany": "list",
  oceny: "star",
  rejestracja: "register",
  ankiet: "document",
  usos_mail: "mail",
  Powiadomien: "bell",
  stypendi: "money",
  platnosci: "card",
  dyplom: "graduation",
};

/** Map frame element id → icon key (for cards without title links) */
const FRAME_ID_ICON_MAP: Record<string, keyof typeof ICON_SVGS> = {
  "info-frame": "user",
  "plany-frame": "list",
  "katalog-frame": "search",
  "preferencje-frame": "settings",
};

function resolveFrameIcon(frame: HTMLElement): string | null {
  // 1. Try matching by frame's own id attribute
  const frameId = frame.getAttribute("id") ?? "";
  if (frameId && FRAME_ID_ICON_MAP[frameId]) {
    return ICON_SVGS[FRAME_ID_ICON_MAP[frameId]];
  }

  // 2. Try matching by _action URL in the title link
  const titleLink = frame.querySelector('[slot="title"] a, h2[slot="title"] a');
  const href = titleLink?.getAttribute("href") ?? "";
  for (const [fragment, iconKey] of Object.entries(ACTION_ICON_MAP)) {
    if (href.includes(fragment)) {
      return ICON_SVGS[iconKey];
    }
  }

  return null;
}

function injectFrameIcons(frames: HTMLElement[]): void {
  for (const frame of frames) {
    const shadow = frame.shadowRoot;
    if (!shadow) continue;

    const header = shadow.querySelector("#header") as HTMLElement | null;
    if (!header) continue;

    // Avoid double-injection
    if (header.querySelector(".bu-frame-icon")) continue;

    const svg = resolveFrameIcon(frame);
    if (!svg) continue;

    const iconSpan = document.createElement("span");
    iconSpan.className = "bu-frame-icon";
    // Safe: static SVG only
    iconSpan.innerHTML = svg;
    header.insertBefore(iconSpan, header.firstChild);
  }
}

async function run(): Promise<void> {
  try {
    // Load extension-only storage caches before anything that needs them
    await Promise.all([initStatsCache(), initDashboardCache()]);

    injectShadowStyle(
      ["main-panel"],
      `
    #page-body {
      display: flex !important;
      justify-content: center !important;
      min-height: calc(100vh - 3.5rem) !important;
    }
`,
    );

    injectShadowStyle(
      ["usos-frame"],
      `
    #header {
      background: transparent !important;
      color: var(--usos-text, #1e293b) !important;
      font-size: 1rem;
      text-decoration: none !important;
    }
    ::slotted(.datepicker-native-container) {
      display: none !important;
    }
    .bu-frame-icon {
      display: inline-flex !important;
      align-items: center !important;
      margin-right: 6px !important;
      flex-shrink: 0 !important;
    }
    .bu-frame-icon svg {
      width: 20px !important;
      height: 20px !important;
      stroke: var(--usos-primary, #3b82f6) !important;
      fill: none !important;
    }
  `,
    );

    injectShadowStyle(
      ["usos-frame", "usos-link"],
      `
     a {
      text-transform: lowercase;
      display: inline-block;
    }
     a::first-letter {
      text-transform: uppercase !important;
    }
  `,
    );

    injectShadowStyle(
      ["usos-selector", "text-field"],
      `
    #input-cont input,
    #input-cont {
      border-radius: 10px !important;
      background: var(--background, #fff) !important;
      color: var(--font-color, #1e293b) !important;
      border-color: var(--border, #DADADE) !important;
    }
    #input-cont input::placeholder {
      color: var(--grey, #4D4D4D) !important;
    }
    #suggestions {
      background: var(--background, #fff) !important;
      color: var(--font-color, #1e293b) !important;
      border-color: var(--border, #DADADE) !important;
    }
    #suggestions .item:hover,
    #suggestions .item.selected {
      background: var(--background-secondary, #EFEFF1) !important;
    }
    label {
      color: var(--font-color, #1e293b) !important;
    }
  `,
    );

    // Style select-field shadow DOM
    injectShadowStyle(
      ["select-field"],
      `
    select {
      background: var(--background, #fff) !important;
      color: var(--font-color, #1e293b) !important;
      border-color: var(--border, #DADADE) !important;
      border-radius: 10px !important;
      padding: 6px 10px !important;
    }
  `,
    );

    // Style usos-frame shadow internals for dark mode
    injectShadowStyle(
      ["usos-frame"],
      `
    :host {
      background: var(--background, #fff) !important;
      color: var(--font-color, #1e293b) !important;
    }
    #content {
      color: var(--font-color, #1e293b) !important;
    }
  `,
    );

    // Style usos-tooltip and usos-dialog shadow DOM for dark mode
    injectShadowStyle(
      ["usos-tooltip"],
      `
    :host {
      background: var(--background, #fff) !important;
      color: var(--font-color, #1e293b) !important;
      border-color: var(--border, #DADADE) !important;
    }
    .content {
      background: var(--background, #fff) !important;
      color: var(--font-color, #1e293b) !important;
    }
  `,
    );

    // Style tab-layout shadow DOM
    injectShadowStyle(
      ["tab-layout"],
      `
    :host {
      color: var(--font-color, #1e293b) !important;
    }
    .tab {
      color: var(--font-color, #1e293b) !important;
      border-color: var(--border, #DADADE) !important;
    }
    .tab.active, .tab:hover {
      color: var(--primary, #4F4C6A) !important;
    }
  `,
    );

    // Timetable – style shadow DOM (works in both light & dark via CSS vars on <html>)
    injectShadowStyle(
      ["usos-timetable"],
      `
    :host {
      color: var(--font-color, #06022E) !important;
    }
    #hours > div > div:first-child {
      color: var(--font-color, #06022E) !important;
    }
    #hours > div > div:nth-child(2)::after {
      border-color: var(--border, #DADADE) !important;
    }
    :host > div:first-child {
      border-color: var(--border, #DADADE) !important;
    }
    #timetable {
      --timetable-color-1: var(--bu-tt-color-1, #CEDED9) !important;
      --timetable-color-1-border: var(--bu-tt-color-1-border, HSL(161, 20%, 54%)) !important;
      --timetable-color-2: var(--bu-tt-color-2, #FEEFD9) !important;
      --timetable-color-2-border: var(--bu-tt-color-2-border, HSL(36, 95%, 62%)) !important;
      --timetable-color-3: var(--bu-tt-color-3, #DBE4F3) !important;
      --timetable-color-3-border: var(--bu-tt-color-3-border, HSL(218, 50%, 61%)) !important;
      --timetable-color-4: var(--bu-tt-color-4, #E1D8E4) !important;
      --timetable-color-4-border: var(--bu-tt-color-4-border, HSL(285, 18%, 57%)) !important;
      --timetable-color-5: var(--bu-tt-color-5, #E5EEBE) !important;
      --timetable-color-5-border: var(--bu-tt-color-5-border, HSL(71, 59%, 54%)) !important;
      --timetable-color-6: var(--bu-tt-color-6, #FCF5C7) !important;
      --timetable-color-6-border: var(--bu-tt-color-6-border, HSL(52, 90%, 58%)) !important;
      --timetable-color-7: var(--bu-tt-color-7, #E1E1E6) !important;
      --timetable-color-7-border: var(--bu-tt-color-7-border, HSL(240, 9%, 59%)) !important;
      --timetable-color-8: var(--bu-tt-color-8, #EDDBDF) !important;
      --timetable-color-8-border: var(--bu-tt-color-8-border, HSL(347, 33%, 59%)) !important;
    }
    #timetable > ::slotted(*) {
      border-color: var(--border, #DADADE) !important;
    }
    .pseudo-header {
      color: var(--font-color, #06022E) !important;
    }
  `,
    );

    // timetable-day – transparent bg in dark, original in light
    injectShadowStyle(
      ["timetable-day"],
      `
    :host {
      background: var(--bu-tt-day-bg, #fafafa) !important;
      border-color: var(--border, #DADADE) !important;
    }
  `,
    );

    injectShadowStyle(
      ["timetable-entry"],
      `
    :host {
      color: var(--font-color, #06022E) !important;
    }
    #przedmiot {
      color: var(--font-color, #06022E) !important;
    }
    #info {
      color: var(--font-color, #06022E) !important;
      opacity: 0.85;
    }
    #time {
      color: var(--font-color, #06022E) !important;
      opacity: 0.85;
    }
    :host usos-dialog {
      --primary: var(--background-secondary, #EFEFF1) !important;
      --on-primary: var(--font-color, #06022E) !important;
    }
  `,
    );

    // Timetable entry → usos-dialog popup styling
    injectShadowStyle(
      ["timetable-entry", "usos-dialog"],
      `
    dialog {
      background: var(--background, #fff) !important;
      color: var(--font-color, #06022E) !important;
    }
    dialog::backdrop {
      background: rgba(0, 0, 0, 0.6) !important;
    }
    #titlebar {
      background: var(--background-secondary, #EFEFF1) !important;
      color: var(--font-color, #06022E) !important;
    }
    #content {
      background: var(--background, #fff) !important;
      color: var(--font-color, #06022E) !important;
    }
    #close {
      background: var(--font-color, #06022E) !important;
    }
    #close::before {
      background: var(--background-secondary, #EFEFF1) !important;
    }
    #details {
      color: var(--font-color, #06022E) !important;
    }
    #details a {
      color: var(--primary, #818cf8) !important;
    }
  `,
    );

    // usos-dialog (standalone, e.g. export dialog) shadow DOM
    injectShadowStyle(
      ["usos-dialog"],
      `
    dialog {
      background: var(--background, #fff) !important;
      color: var(--font-color, #06022E) !important;
    }
    dialog::backdrop {
      background: rgba(0, 0, 0, 0.6) !important;
    }
    #titlebar {
      background: var(--background-secondary, #EFEFF1) !important;
      color: var(--font-color, #06022E) !important;
    }
    #content {
      background: var(--background, #fff) !important;
      color: var(--font-color, #06022E) !important;
    }
    #close {
      background: var(--font-color, #06022E) !important;
    }
    #close::before {
      background: var(--background-secondary, #EFEFF1) !important;
    }
  `,
    );

    // help-dialog shadow DOM
    injectShadowStyle(
      ["help-dialog"],
      `
    :host {
      color: var(--font-color, #06022E) !important;
    }
  `,
    );

    // app-header (school banner) – keep text white/light regardless of --on-primary
    injectShadowStyle(
      ["app-header"],
      `
    :host > div,
    .content,
    .content span {
      color: #ffffff !important;
    }
  `,
    );

    // usos-module-link-tile (Indeks page tiles) – readable colors in dark mode
    injectShadowStyle(
      ["usos-module-link-tile"],
      `
    a {
      color: inherit !important;
      text-decoration: none !important;
    }
    #icon {
      background-color: var(--font-color, #4F4C6A) !important;
    }
    #title {
      color: var(--font-color, var(--primary, #4F4C6A)) !important;
    }
    #title ::slotted(*) {
      color: var(--font-color, var(--primary, #4F4C6A)) !important;
    }
    #text {
      color: var(--on-background, #333) !important;
    }
    #text ::slotted(*) {
      color: var(--on-background, #333) !important;
    }
  `,
      document.body,
      true, // useAdopted – must win over Lit's adopted stylesheets
    );

    injectShadowStyle(
      ["menu-left"],
      `
  /* Hide empty separators */
  ::slotted(li:empty) { display: none !important; }
  `,
    );

    setupDashboard();
    // Inject icons into sidebar links
    injectSidebarIcons();
    // Collapse older semesters in "Zajęcia studenta" and similar frames
    collapseSemesters();
    // Oceny / sprawdziany – ukrywanie ocen z konfetti (uruchom, jeśli jest drzewo ocen)
    if (document.querySelector("#drzewo")) {
      await setupHiddenGrades();
    }

    document.querySelectorAll("usos-link span").forEach((el) => {
      if (el.textContent?.includes("więcej")) {
        el.textContent = "Więcej";
      }
    });

    document.querySelectorAll("usos-link").forEach((link) => {
      link.removeAttribute("icon-location");
    });

    // Apply global settings (banner visibility, theme)
    if (
      typeof chrome !== "undefined" &&
      chrome.storage &&
      chrome.storage.sync
    ) {
      chrome.storage.sync.get("betterUsosSettings", (res) => {
        const settings = (res?.betterUsosSettings ?? {}) as BetterUsosSettings;
        applySettings(settings);
      });
    }
  } catch (err) {
    console.warn("[Better USOS] run() error:", err);
  }
}

/**
 * Collapse older semesters inside usos-frame.student cards on the dashboard.
 *
 * Handles two DOM layouts:
 * A) "Zajęcia studenta": ul > li per semester, each li has
 *      span.screen-reader-only (label) + ul.lista-zajec (courses)
 * B) "Sprawdziany studenta": flat ul > li items, each li has
 *      span.note with semester code (e.g. "2025Z") + course link
 *    → we group them by code and wrap each group.
 *
 * First semester group stays expanded; the rest are collapsed behind a toggle.
 */
function collapseSemesters(): void {
  try {
    const frames = document.querySelectorAll("usos-frame.student");

    for (const frame of frames) {
      const parentUl = frame.querySelector(":scope > div > ul.no-bullets");
      if (!parentUl) continue;

      // Detect layout type
      const hasNestedLists = !!parentUl.querySelector("ul.lista-zajec");

      if (hasNestedLists) {
        collapseNestedSemesters(parentUl);
      } else {
        collapseFlatSemesters(parentUl);
      }
    }
  } catch (err) {
    console.warn("[Better USOS] collapseSemesters error:", err);
  }
}

/** Layout A – "Zajęcia studenta": each <li> is already one semester group */
function collapseNestedSemesters(parentUl: Element): void {
  const semesters = Array.from(parentUl.children).filter(
    (el): el is HTMLLIElement =>
      el.tagName === "LI" && !!el.querySelector("ul.lista-zajec"),
  );

  if (semesters.length <= 1) return;

  semesters.forEach((li, index) => {
    const srSpan = li.querySelector(
      ":scope > span.screen-reader-only",
    ) as HTMLElement | null;
    const courseList = li.querySelector(
      ":scope > ul.lista-zajec",
    ) as HTMLElement | null;
    if (!courseList) return;

    const labelText = srSpan?.textContent?.trim() || `Semestr ${index + 1}`;

    addSemesterToggle(li, courseList, labelText, index > 0);

    if (srSpan) srSpan.style.display = "none";
  });
}

/** Layout B – "Sprawdziany studenta": flat <li> list, group by span.note text */
function collapseFlatSemesters(parentUl: Element): void {
  const items = Array.from(parentUl.querySelectorAll(":scope > li"));
  if (items.length === 0) return;

  // Group items by their semester code
  const groups: { code: string; items: HTMLLIElement[] }[] = [];
  let currentCode = "";

  for (const li of items) {
    const noteEl = li.querySelector("span.note, div > span.note");
    const code = noteEl?.textContent?.trim() ?? "";
    if (code !== currentCode || groups.length === 0) {
      groups.push({ code, items: [li as HTMLLIElement] });
      currentCode = code;
    } else {
      groups[groups.length - 1].items.push(li as HTMLLIElement);
    }
  }

  if (groups.length <= 1) return;

  // Semester code → friendly name map
  const codeToLabel = (code: string): string => {
    // e.g. "2025Z" → "Semestr zimowy 2025/2026", "2026L" → "Semestr letni 2025/2026"
    const match = code.match(/^(\d{4})([ZL])$/i);
    if (!match) return code || "Inny semestr";
    const year = parseInt(match[1], 10);
    const season = match[2].toUpperCase();
    if (season === "Z") return `Semestr zimowy ${year}/${year + 1}`;
    return `Semestr letni ${year - 1}/${year}`;
  };

  // Wrap each group in a container <li> with a toggle
  for (let i = groups.length - 1; i >= 0; i--) {
    const group = groups[i];
    const wrapperLi = document.createElement("li");
    wrapperLi.className = "bu-semester-group";

    const innerUl = document.createElement("ul");
    innerUl.className = "no-bullets bu-semester-items";

    for (const item of group.items) {
      innerUl.appendChild(item);
    }

    wrapperLi.appendChild(innerUl);

    const label = codeToLabel(group.code);
    addSemesterToggle(wrapperLi, innerUl, label, i > 0);

    // Insert the wrapper where the first item of this group was
    parentUl.insertBefore(wrapperLi, parentUl.children[0] || null);
  }
}

/** Create a toggle button and optionally collapse the content */
function addSemesterToggle(
  container: HTMLElement,
  content: HTMLElement,
  label: string,
  startCollapsed: boolean,
): void {
  const header = document.createElement("button");
  header.type = "button";
  header.className = "bu-semester-toggle";
  const chevron = document.createElement("span");
  chevron.className = "bu-semester-chevron";
  chevron.textContent = startCollapsed ? "▸" : "▾";
  header.appendChild(chevron);
  header.appendChild(document.createTextNode(" " + label));
  header.title = "Kliknij, aby rozwinąć / zwinąć";

  if (startCollapsed) {
    content.classList.add("bu-collapsed");
  }

  header.addEventListener("click", () => {
    const isCollapsed = content.classList.toggle("bu-collapsed");
    chevron.textContent = isCollapsed ? "▸" : "▾";
  });

  container.insertBefore(header, content);
}

async function setupHiddenGrades(): Promise<void> {
  try {
    const container = document.querySelector("#drzewo");
    if (!container) return;

    const params = new URLSearchParams(window.location.search);
    const wezId = params.get("wez_id") ?? "unknown";
    const storageKey = `better-usos-grades-${wezId}`;

    const loadRevealed = async (): Promise<Set<number>> => {
      try {
        const res = await chrome.storage.local.get(storageKey);
        const arr = res[storageKey] as number[] | undefined;
        if (Array.isArray(arr)) return new Set(arr);
      } catch {
        /* ignore */
      }
      return new Set();
    };

    const saveRevealed = (set: Set<number>): void => {
      try {
        chrome.storage.local.set({ [storageKey]: Array.from(set) });
      } catch {
        // ignore
      }
    };

    const revealed = await loadRevealed();

    const gradeCells: HTMLElement[] = [];
    container.querySelectorAll("table.grey td").forEach((td) => {
      const strong = td.querySelector("b");
      if (!strong) return;
      const valueRaw = (strong.textContent ?? "").trim().replace(",", ".");
      if (!/^[0-9]+(\.[0-9]+)?$/.test(valueRaw)) return;
      const style = (td.getAttribute("style") ?? "").toLowerCase();
      if (!style.includes("text-align: right")) return;
      (td as HTMLElement).dataset.buGrade = valueRaw;
      gradeCells.push(td as HTMLElement);
    });

    if (gradeCells.length === 0) return;

    // Update total grades count in statistics
    setTotalGrades(gradeCells.length);

    /** Extract the human-readable name of the grade node from the row */
    const getGradeName = (cell: HTMLElement): string => {
      const row = cell.closest("tr");
      if (!row) return "Nieznana ocena";
      // The name is in the td with width: 200px
      const nameTd = row.querySelector(
        'td[style*="200px"]',
      ) as HTMLElement | null;
      if (!nameTd) return "Nieznana ocena";
      // Get text content but exclude .note spans (which contain "max ..." info)
      const clone = nameTd.cloneNode(true) as HTMLElement;
      clone.querySelectorAll(".note").forEach((n) => n.remove());
      const name = (clone.textContent ?? "").trim();
      return name || "Nieznana ocena";
    };

    const pageUrl = window.location.href;

    /** Extract subject name from the h1 on the grades page */
    const getSubjectName = (): string => {
      const h1 = document.querySelector("h1");
      if (!h1) return "Nieznany przedmiot";
      const link = h1.querySelector("a.wrhidden") as HTMLElement | null;
      if (link) return (link.textContent ?? "").trim() || "Nieznany przedmiot";
      // Fallback: try the h2 which sometimes has "2025Z Nazwa przedmiotu"
      const h2 = document.querySelector("h2");
      if (h2) {
        const h2Text = (h2.textContent ?? "").trim();
        // Strip leading semester code like "2025Z "
        const stripped = h2Text.replace(/^\d{4}[LZ]\s+/i, "");
        if (stripped) return stripped;
      }
      return "Nieznany przedmiot";
    };

    const subjectName = getSubjectName();

    const fireConfetti = (cell: HTMLElement): void => {
      const confetti = document.createElement("div");
      confetti.className = "bu-confetti";
      for (let i = 0; i < 10; i++) {
        const dot = document.createElement("span");
        dot.className = "bu-confetti-dot";
        const angle = (Math.random() - 0.5) * Math.PI;
        const distance = 20 + Math.random() * 30;
        const dx = Math.cos(angle) * distance;
        const dy = -Math.abs(Math.sin(angle) * distance);
        dot.style.setProperty("--bu-confetti-dx", `${dx.toFixed(1)}px`);
        dot.style.setProperty("--bu-confetti-dy", `${dy.toFixed(1)}px`);
        dot.style.left = `${50 + (Math.random() - 0.5) * 40}%`;
        dot.style.top = "50%";
        confetti.appendChild(dot);
      }
      cell.appendChild(confetti);
      setTimeout(() => confetti.remove(), 800);
    };

    const showYouDefeated = (): void => {
      const overlay = document.createElement("div");
      overlay.className = "bu-ds-overlay";
      const textDiv = document.createElement("div");
      textDiv.className = "bu-ds-text";
      textDiv.textContent = "YOU DEFEATED";
      overlay.appendChild(textDiv);
      document.body.appendChild(overlay);
      setTimeout(() => overlay.remove(), 1900);
    };

    const showYouFailed = (): void => {
      const overlay = document.createElement("div");
      overlay.className = "bu-ds-overlay bu-ds-fail";
      const textDiv = document.createElement("div");
      textDiv.className = "bu-ds-text";
      textDiv.textContent = "YOU FAILED";
      overlay.appendChild(textDiv);
      document.body.appendChild(overlay);
      setTimeout(() => overlay.remove(), 1900);
    };

    gradeCells.forEach((cell, index) => {
      cell.classList.add("bu-grade-cell");
      const strong = cell.querySelector("b");
      if (!strong) return;

      const gradeValue = parseFloat(
        cell.dataset.buGrade ?? strong.textContent ?? "0",
      );

      const getMaxValue = (): number | null => {
        const row = cell.closest("tr");
        if (!row) return null;
        // More robust: search whole row text, supports \"max\" and \"maks\"
        const text = (row.textContent ?? "")
          .replace(/\s+/g, " ")
          .toLowerCase()
          .replace(",", ".");
        const match = text.match(/(?:max|maks)\s*([0-9]+(?:\.[0-9]+)?)/);
        if (!match) return null;
        const parsed = parseFloat(match[1]);
        return Number.isNaN(parsed) ? null : parsed;
      };

      const maxValue = getMaxValue();
      const isPerfect =
        maxValue !== null && Math.abs(gradeValue - maxValue) < 0.005;
      const isHigh =
        !isPerfect &&
        maxValue !== null &&
        maxValue > 0 &&
        gradeValue >= maxValue * 0.9;
      const isLow =
        !isPerfect &&
        !isHigh &&
        maxValue !== null &&
        maxValue > 0 &&
        gradeValue < maxValue / 2;
      if (isPerfect) cell.dataset.buPerfect = "1";
      if (isHigh) cell.dataset.buHigh = "1";
      if (isLow) cell.dataset.buLow = "1";
      if (!isPerfect && Math.abs(gradeValue) < 0.005) cell.dataset.buZero = "1";

      const mask = document.createElement("span");
      mask.className = "bu-grade-mask";
      cell.appendChild(mask);

      const isRevealed = revealed.has(index);
      if (isRevealed) {
        cell.classList.add("bu-grade-revealed");
      } else {
        cell.classList.add("bu-grade-hidden");
      }

      cell.addEventListener("click", () => {
        // Zawsze sprawdź, czy to max / 0 / low – także po wcześniejszym odkryciu
        const maxNow = getMaxValue();
        const perfectNow =
          maxNow !== null && Math.abs(gradeValue - maxNow) < 0.005;
        const highNow =
          !perfectNow &&
          maxNow !== null &&
          maxNow > 0 &&
          gradeValue >= maxNow * 0.9;
        const lowNow =
          !perfectNow &&
          !highNow &&
          maxNow !== null &&
          maxNow > 0 &&
          gradeValue < maxNow / 2;

        if (perfectNow) cell.dataset.buPerfect = "1";
        if (highNow) cell.dataset.buHigh = "1";
        if (lowNow) cell.dataset.buLow = "1";
        if (!perfectNow && Math.abs(gradeValue) < 0.005)
          cell.dataset.buZero = "1";

        if (perfectNow) {
          showYouDefeated();
        } else if (Math.abs(gradeValue) < 0.005) {
          showYouFailed();
        }

        // Odsłanianie + confetti tylko za pierwszym razem
        if (!cell.classList.contains("bu-grade-revealed")) {
          cell.classList.remove("bu-grade-hidden");
          cell.classList.add("bu-grade-revealed");
          fireConfetti(cell);
          revealed.add(index);
          saveRevealed(revealed);

          // Update statistics + earn a slot coin
          updateStatistic("revealedCount");
          updateStatistic("coins");
          const maxNowForEntry = getMaxValue();
          const gradeName = getGradeName(cell);
          if (perfectNow) {
            updateStatistic("defeatedCount");
            updateStatistic("coins"); // bonus coin for defeated (+2 total)
            addGradeEntry("defeated", {
              name: gradeName,
              subject: subjectName,
              value: gradeValue,
              max: maxNowForEntry,
              date: Date.now(),
              url: pageUrl,
            });
          } else if (Math.abs(gradeValue) < 0.005) {
            updateStatistic("failCount");
            addGradeEntry("fail", {
              name: gradeName,
              subject: subjectName,
              value: gradeValue,
              max: maxNowForEntry,
              date: Date.now(),
              url: pageUrl,
            });
          }
        }
      });
    });

    // "Odsłoń wszystkie" button — only shown when there are hidden grades
    const hiddenCells = gradeCells.filter(
      (c) => !c.classList.contains("bu-grade-revealed"),
    );
    if (hiddenCells.length > 0) {
      const revealAllBtn = document.createElement("button");
      revealAllBtn.className = "bu-reveal-all-btn";
      revealAllBtn.textContent = `Odsłoń wszystkie (${hiddenCells.length})`;
      container.insertBefore(revealAllBtn, container.firstChild);

      revealAllBtn.addEventListener("click", () => {
        let newReveals = 0;
        gradeCells.forEach((cell, index) => {
          if (cell.classList.contains("bu-grade-revealed")) return;
          cell.classList.remove("bu-grade-hidden");
          cell.classList.add("bu-grade-revealed");
          revealed.add(index);
          newReveals++;

          // Silently update statistics (coins + counts, no overlays/confetti)
          updateStatistic("revealedCount");
          updateStatistic("coins");

          const gradeValue = parseFloat(cell.dataset.buGrade ?? "0");
          const row = cell.closest("tr");
          const rowText = (row?.textContent ?? "")
            .replace(/\s+/g, " ")
            .toLowerCase()
            .replace(",", ".");
          const maxMatch = rowText.match(
            /(?:max|maks)\s*([0-9]+(?:\.[0-9]+)?)/,
          );
          const maxVal = maxMatch ? parseFloat(maxMatch[1]) : null;
          const isPerfect =
            maxVal !== null && Math.abs(gradeValue - maxVal) < 0.005;
          const isZero = Math.abs(gradeValue) < 0.005;

          if (isPerfect) {
            cell.dataset.buPerfect = "1";
            updateStatistic("defeatedCount");
            updateStatistic("coins"); // bonus coin
            addGradeEntry("defeated", {
              name: getGradeName(cell),
              subject: subjectName,
              value: gradeValue,
              max: maxVal,
              date: Date.now(),
              url: pageUrl,
            });
          } else if (isZero) {
            cell.dataset.buZero = "1";
            updateStatistic("failCount");
            addGradeEntry("fail", {
              name: getGradeName(cell),
              subject: subjectName,
              value: gradeValue,
              max: maxVal,
              date: Date.now(),
              url: pageUrl,
            });
          } else {
            const isHigh =
              maxVal !== null && maxVal > 0 && gradeValue >= maxVal * 0.9;
            const isLow =
              maxVal !== null && maxVal > 0 && gradeValue < maxVal / 2;
            if (isHigh) cell.dataset.buHigh = "1";
            if (isLow) cell.dataset.buLow = "1";
          }
        });

        if (newReveals > 0) {
          saveRevealed(revealed);
          refreshCoinDisplay();
        }

        revealAllBtn.remove();
      });
    }
  } catch (err) {
    console.warn("[Better USOS] setupHiddenGrades error:", err);
  }
}

// Check if extension is enabled (cached for instant decision)
const isEnabled = (() => {
  try {
    const raw = localStorage.getItem(ENABLED_CACHE_KEY);
    if (raw === null) return true; // default enabled
    return JSON.parse(raw) as boolean;
  } catch {
    return true;
  }
})();

if (isEnabled) {
  // Inject stylesheet dynamically (only when enabled)
  injectMainCSS();

  // Apply cached theme instantly to avoid flash of wrong theme
  try {
    const raw = localStorage.getItem(THEME_CACHE_KEY);
    if (raw) {
      const cached = JSON.parse(raw) as { themeId?: PaletteId };
      if (cached.themeId) {
        applyPalette(cached.themeId);
      }
    }
  } catch {
    /* ignore */
  }

  // Apply cached banner visibility instantly to avoid flash
  try {
    const raw = localStorage.getItem(BANNER_CACHE_KEY);
    if (raw !== null) {
      const showBanner = JSON.parse(raw) as boolean;
      document.body.classList.toggle("better-usos-hide-banner", !showBanner);
    }
  } catch {
    /* ignore */
  }

  run();
}
// When disabled: no CSS injected, no run() called — page stays original

chrome.runtime.onMessage.addListener(
  (
    msg: {
      type: string;
      show?: boolean;
      enabled?: boolean;
      themeId?: PaletteId;
    },
    _sender: chrome.runtime.MessageSender,
    sendResponse: (
      response: { active?: boolean; hasDashboard?: boolean } | void,
    ) => void,
  ) => {
    if (msg.type === "SET_ENABLED") {
      const enabled = msg.enabled !== false;
      try {
        localStorage.setItem(ENABLED_CACHE_KEY, JSON.stringify(enabled));
      } catch {
        /* ignore */
      }
      // Reload to cleanly apply/remove all extension modifications
      window.location.reload();
      return true;
    }
    if (msg.type === "GET_DASHBOARD_EDIT_STATE") {
      const hasDashboard = !!dashboardEditState;
      const active =
        hasDashboard &&
        dashboardEditState!.dashboard.classList.contains("bu-edit-mode");
      sendResponse({ hasDashboard, active });
      return true;
    }
    if (msg.type === "TOGGLE_DASHBOARD_EDIT") {
      if (!dashboardEditState) {
        sendResponse({ active: false });
        return true;
      }
      const { dashboard, persistOrder } = dashboardEditState;
      const active = dashboard.classList.toggle("bu-edit-mode");
      if (!active) persistOrder();
      sendResponse({ active });
      return true;
    }
    if (msg.type === "SET_BANNER_VISIBILITY") {
      const show = msg.show === true;
      document.body.classList.toggle("better-usos-hide-banner", !show);
      try {
        localStorage.setItem(BANNER_CACHE_KEY, JSON.stringify(show));
      } catch {
        /* ignore */
      }
      return true;
    }
    if (msg.type === "SET_THEME") {
      const themeId: PaletteId = msg.themeId === "dark" ? "dark" : "light";
      applyPalette(themeId);
      return true;
    }
    return false;
  },
);
