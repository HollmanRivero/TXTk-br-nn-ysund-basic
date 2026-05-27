# TXTK.ZIP

Moderne Electron-desktopklient for oppslag mot **Brønnøysundregisteret** (Enhetsregisteret).
Søk virksomheter, slå opp organisasjonsnummer, se roller og underenheter.

## Funksjoner

- 🔎 Søk virksomheter på navn (åpent API, ingen autentisering)
- 🔢 Direkte oppslag på 9-sifret organisasjonsnummer
- 👥 Hent roller (styre, daglig leder, revisor osv.)
- 🏢 List ut underenheter
- 🌙 Mørkt grensesnitt med refinert nordisk typografi (Fraunces + JetBrains Mono)
- 🔒 Sikker arkitektur: `contextIsolation`, `sandbox`, ingen `nodeIntegration` i renderer
- 📦 Bygges til `.exe` (NSIS installer + portable), `.dmg` og `.AppImage`

## Krav

- **Node.js 18+** (anbefalt 20 LTS)
- **npm** eller **yarn**
- For Windows-build på ikke-Windows: `wine` (electron-builder håndterer det stort sett selv)

## Kjør i utvikling

```bash
npm install
npm start          # vanlig kjøring
npm run dev        # med DevTools åpne
```

## Bygg `.exe` (Windows)

```bash
npm install
npm run build:win
```

Output havner i `dist/`:
- `TXTK.ZIP-1.0.0-x64.exe` — NSIS installer (med snarvei og avinstallering)
- `TXTK.ZIP-1.0.0-x64-portable.exe` — én enkelt fil, ingen installasjon

Bare portable:

```bash
npm run build:portable
```

## Bygg for andre plattformer

```bash
npm run build           # gjeldende plattform
npx electron-builder -mwl   # mac + win + linux samtidig (krever oppsett)
```

## API som brukes

Alle endepunkter under `https://data.brreg.no/enhetsregisteret/api`:

| Endepunkt | Bruk |
|---|---|
| `/enheter?navn={q}` | Navnesøk |
| `/enheter/{orgnr}` | Direkte oppslag |
| `/enheter/{orgnr}/roller` | Roller (styre, dagl. leder, …) |
| `/underenheter?overordnetEnhet={orgnr}` | Underenheter |

Åpne data — lisens: NLOD.

## Arkitektur

```
TXTK.ZIP/
├── package.json          ← electron-builder config
├── main.js               ← main-prosess + IPC + HTTPS-kall
├── preload.js            ← contextBridge → window.txtk
└── src/
    ├── index.html
    ├── styles.css
    └── renderer.js       ← UI-logikk (kjører i sandkasse)
```

API-kallene gjøres i **main-prosessen** (Node.js `https`) — ikke i renderer — slik at vi unngår CORS og holder renderer-prosessen sandkasset.

## Lisens

MIT
