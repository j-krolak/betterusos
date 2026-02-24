# Better USOS
> [!IMPORTANT]
> Extension was 99% vibe coded. 

## Setup

```bash
npm install
```

## Development

### Chrome

```bash
npm run dev
```

Then: **chrome://extensions** → turn on "Developer mode" → "Load unpacked" → choose `build/chrome-mv3-dev`.

### Firefox

```bash
npm run dev:firefox
```

Then:

1. Open **about:debugging** in Firefox.
2. Go to **"This Firefox"** (left sidebar).
3. Click **"Load Temporary Add-on"**.
4. Open the **manifest.json** inside `build/firefox-mv2-dev` (or pick that folder if the dialog allows).

The extension will load until you close Firefox. After code changes, click **"Reload"** on the add-on card on the same page. For a clean test run with the built extension: `npx web-ext run --source-dir=./build/firefox-mv2-dev`.

## Build for production

```bash
npm run build
```

Output is in `build/` (Chrome MV3, Firefox, etc.).

## Package (zip for store)

```bash
npm run package
```

## Tech

- [Plasmo](https://docs.plasmo.com/) — extension framework
- React 18 + TypeScript (used for type-checking and future popup/options UI)
- Content script in `contents/usos.ts` runs on `https://*.edu.pl/*` and injects styles / DOM tweaks for USOS

## Project layout

- `contents/usos.ts` — content script (shadow-DOM style injection + DOM tweaks)
- `contents/style.css` — global styles for USOS pages
- `assets/icon.png` — extension icon
- Popup/options UI can be added later (React); the current Plasmo release has a known [resolution bug](https://github.com/PlasmoHQ/plasmo/issues/1040) for some setups.
