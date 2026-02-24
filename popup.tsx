import React, { useEffect, useState } from "react";

type PaletteId = "light" | "dark";

interface PopupSettings {
  enabled: boolean;
  showBanner: boolean;
  themeId: PaletteId;
}

function getDefaultSettings(): PopupSettings {
  return {
    enabled: true,
    showBanner: true,
    themeId: "light",
  };
}

/* ---- Inline SVG icons ---- */
const IconSun = () => (
  <svg
    width="15"
    height="15"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <circle cx="12" cy="12" r="5" />
    <line x1="12" y1="1" x2="12" y2="3" />
    <line x1="12" y1="21" x2="12" y2="23" />
    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
    <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
    <line x1="1" y1="12" x2="3" y2="12" />
    <line x1="21" y1="12" x2="23" y2="12" />
    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
    <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
  </svg>
);
const IconMoon = () => (
  <svg
    width="15"
    height="15"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
  </svg>
);
const IconImage = () => (
  <svg
    width="15"
    height="15"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
    <circle cx="8.5" cy="8.5" r="1.5" />
    <polyline points="21 15 16 10 5 21" />
  </svg>
);

/* ---- Toggle switch component ---- */
function Toggle({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => !disabled && onChange(!checked)}
      style={{
        position: "relative",
        width: 40,
        height: 22,
        borderRadius: 999,
        border: "none",
        background: checked ? "#2563eb" : "#d1d5db",
        cursor: disabled ? "not-allowed" : "pointer",
        transition: "background 0.2s",
        flexShrink: 0,
        opacity: disabled ? 0.5 : 1,
        padding: 0,
      }}
    >
      <span
        style={{
          position: "absolute",
          top: 2,
          left: checked ? 20 : 2,
          width: 18,
          height: 18,
          borderRadius: 999,
          background: "#fff",
          boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
          transition: "left 0.2s",
        }}
      />
    </button>
  );
}

/* ---- Theme pill selector ---- */
function ThemePills({
  value,
  onChange,
  disabled,
}: {
  value: PaletteId;
  onChange: (v: PaletteId) => void;
  disabled?: boolean;
}) {
  const options: { id: PaletteId; label: string; icon: React.ReactNode }[] = [
    { id: "light", label: "Jasny", icon: <IconSun /> },
    { id: "dark", label: "Ciemny", icon: <IconMoon /> },
  ];
  return (
    <div style={{ display: "flex", gap: 6 }}>
      {options.map((o) => {
        const active = value === o.id;
        return (
          <button
            type="button"
            key={o.id}
            onClick={() => !disabled && onChange(o.id)}
            disabled={disabled}
            style={{
              flex: 1,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
              padding: "7px 0",
              borderRadius: 8,
              border: active ? "1.5px solid #2563eb" : "1.5px solid #e2e8f0",
              background: active ? "rgba(37,99,235,0.08)" : "transparent",
              color: active ? "#2563eb" : "#64748b",
              fontSize: 12.5,
              fontWeight: 600,
              cursor: disabled ? "not-allowed" : "pointer",
              transition: "all 0.15s",
              opacity: disabled ? 0.45 : 1,
              fontFamily: "inherit",
            }}
          >
            {o.icon}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/* ---- Main popup ---- */
function Popup() {
  const [editActive, setEditActive] = useState<boolean | null>(null);
  const [hasDashboard, setHasDashboard] = useState(false);
  const [settings, setSettings] = useState<PopupSettings>(getDefaultSettings);

  // Load dashboard edit state
  useEffect(() => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tab = tabs[0];
      if (!tab?.id) {
        setHasDashboard(false);
        setEditActive(null);
        return;
      }
      chrome.tabs.sendMessage(
        tab.id,
        { type: "GET_DASHBOARD_EDIT_STATE" },
        (
          response: { hasDashboard?: boolean; active?: boolean } | undefined,
        ) => {
          if (chrome.runtime.lastError || response === undefined) {
            setHasDashboard(false);
            setEditActive(null);
            return;
          }
          setHasDashboard(response.hasDashboard ?? false);
          setEditActive(response.active ?? false);
        },
      );
    });
  }, []);

  // Load global settings
  useEffect(() => {
    if (!chrome.storage?.sync) return;
    chrome.storage.sync.get("betterUsosSettings", (res) => {
      const raw = (res?.betterUsosSettings ?? {}) as Record<string, unknown>;
      setSettings((prev) => ({
        enabled: typeof raw.enabled === "boolean" ? raw.enabled : prev.enabled,
        showBanner:
          typeof raw.showBanner === "boolean"
            ? raw.showBanner
            : prev.showBanner,
        themeId:
          raw.themeId === "light" || raw.themeId === "dark"
            ? raw.themeId
            : prev.themeId,
      }));
    });
  }, []);

  /* ---- helpers ---- */
  const persist = (next: PopupSettings) => {
    setSettings(next);
    chrome.storage?.sync?.set({ betterUsosSettings: next });
  };

  const withTab = (cb: (id: number) => void) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.id) cb(tabs[0].id);
    });
  };

  const sendToTab = (msg: Record<string, unknown>) =>
    withTab((id) => chrome.tabs.sendMessage(id, msg));

  /* ---- handlers ---- */
  const handleEnabled = (enabled: boolean) => {
    const next = { ...settings, enabled };
    persist(next);
    sendToTab({ type: "SET_ENABLED", enabled });
  };

  const handleBanner = (showBanner: boolean) => {
    const next = { ...settings, showBanner };
    persist(next);
    sendToTab({ type: "SET_BANNER_VISIBILITY", show: showBanner });
  };

  const handleTheme = (themeId: PaletteId) => {
    const next = { ...settings, themeId };
    persist(next);
    sendToTab({ type: "SET_THEME", themeId });
  };

  const handleToggleEdit = () => {
    withTab((tabId) => {
      chrome.tabs.sendMessage(
        tabId,
        { type: "TOGGLE_DASHBOARD_EDIT" },
        (response: { active?: boolean } | undefined) => {
          if (response !== undefined) setEditActive(response.active ?? false);
        },
      );
    });
  };

  const off = !settings.enabled;

  return (
    <div
      style={{
        width: 300,
        fontFamily: '"Segoe UI", system-ui, -apple-system, sans-serif',
        fontSize: 13,
        color: "#1e293b",
        background: "#fff",
      }}
    >
      {/* ---- Header ---- */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "14px 16px 10px",
          borderBottom: "1px solid #f1f5f9",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span
            style={{ fontSize: 15, fontWeight: 700, letterSpacing: "-0.02em" }}
          >
            Better USOS
          </span>
          <span
            style={{
              fontSize: 10.5,
              fontWeight: 500,
              color: "#94a3b8",
              background: "#f1f5f9",
              borderRadius: 4,
              padding: "1px 5px",
            }}
          >
            v1.0
          </span>
        </div>
        <Toggle checked={settings.enabled} onChange={handleEnabled} />
      </div>

      {/* ---- Body ---- */}
      <div
        style={{
          padding: "10px 16px 14px",
          display: "flex",
          flexDirection: "column",
          gap: 10,
        }}
      >
        {/* ---- Appearance section ---- */}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <span
            style={{
              fontSize: 10.5,
              fontWeight: 600,
              color: "#94a3b8",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
            }}
          >
            Wygląd
          </span>

          {/* Theme */}
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <ThemePills
              value={settings.themeId}
              onChange={handleTheme}
              disabled={off}
            />
          </div>

          {/* Banner */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 10,
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 7,
                fontSize: 12.5,
                fontWeight: 500,
                color: off ? "#94a3b8" : "#334155",
              }}
            >
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: 26,
                  height: 26,
                  borderRadius: 6,
                  background: "#f1f5f9",
                  color: "#64748b",
                  flexShrink: 0,
                  opacity: off ? 0.45 : 1,
                }}
              >
                <IconImage />
              </span>
              Baner uczelni
            </div>
            <Toggle
              checked={settings.showBanner}
              onChange={handleBanner}
              disabled={off}
            />
          </div>
        </div>

        <div style={{ height: 1, background: "#f1f5f9", margin: "2px 0" }} />

        {/* ---- Dashboard section ---- */}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <span
            style={{
              fontSize: 10.5,
              fontWeight: 600,
              color: "#94a3b8",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
            }}
          >
            Dashboard
          </span>

          {hasDashboard && !off ? (
            <>
              <p
                style={{
                  fontSize: 11.5,
                  color: "#94a3b8",
                  lineHeight: 1.45,
                  margin: 0,
                }}
              >
                {editActive
                  ? "Tryb edycji włączony — przeciągnij karty, zmień szerokość, ukryj bloki."
                  : "Zmień kolejność i rozmiar kart na stronie Na skróty."}
              </p>
              <button
                type="button"
                onClick={handleToggleEdit}
                style={{
                  width: "100%",
                  padding: "9px 14px",
                  border: "1.5px solid",
                  borderColor: editActive ? "#64748b" : "#2563eb",
                  borderRadius: 8,
                  background: editActive ? "#64748b" : "#2563eb",
                  color: "#fff",
                  fontSize: 12.5,
                  fontWeight: 600,
                  cursor: "pointer",
                  transition: "all 0.15s",
                  fontFamily: "inherit",
                }}
              >
                {editActive ? "Zakończ edycję" : "Edytuj układ"}
              </button>
            </>
          ) : (
            <p
              style={{
                fontSize: 11.5,
                color: "#94a3b8",
                lineHeight: 1.45,
                margin: 0,
              }}
            >
              {off
                ? "Włącz rozszerzenie, aby edytować dashboard."
                : "Otwórz stronę Na skróty w USOSweb, aby edytować układ."}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

export default Popup;
