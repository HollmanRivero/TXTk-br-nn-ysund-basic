// TXTK.ZIP — web server
// Express-server som speiler IPC-handlerne fra main.js til HTTP-endepunkter.
// Brukes for å kjøre appen som webapp (browser) i tillegg til Electron-versjonen.

const express = require('express');
const https = require('node:https');
const path = require('node:path');

const app = express();
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0'; // 0.0.0.0 lar WSL/Docker eksponere porten

// --- Brønnøysund API helper (samme logikk som main.js) ----------------------
const BRREG_HOST = 'data.brreg.no';
const BRREG_BASE = '/enhetsregisteret/api';

function brregFetch(pathSuffix) {
  return new Promise((resolve) => {
    const options = {
      hostname: BRREG_HOST,
      path: BRREG_BASE + pathSuffix,
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'TXTK.ZIP/1.0 (web server)',
      },
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => {
        if (res.statusCode === 404) {
          return resolve({ ok: false, status: 404, error: 'Ikke funnet' });
        }
        if (res.statusCode >= 400) {
          return resolve({ ok: false, status: res.statusCode, error: `HTTP ${res.statusCode}` });
        }
        try {
          resolve({ ok: true, status: res.statusCode, data: JSON.parse(body) });
        } catch {
          resolve({ ok: false, status: res.statusCode, error: 'Ugyldig JSON' });
        }
      });
    });

    req.on('error', (err) => resolve({ ok: false, status: 0, error: err.message }));
    req.setTimeout(15000, () => {
      req.destroy();
      resolve({ ok: false, status: 0, error: 'Tidsavbrudd' });
    });

    req.end();
  });
}

function validOrgnr(value) {
  return /^\d{9}$/.test(String(value || '').replace(/\s/g, ''));
}

// --- API --------------------------------------------------------------------
app.get('/api/search', async (req, res) => {
  const { q, size = 20, page = 0 } = req.query;
  if (!q || !String(q).trim()) {
    return res.json({ ok: false, error: 'Tomt søk' });
  }
  const result = await brregFetch(
    `/enheter?navn=${encodeURIComponent(String(q).trim())}&size=${size}&page=${page}`
  );
  res.json(result);
});

app.get('/api/lookup/:orgnr', async (req, res) => {
  if (!validOrgnr(req.params.orgnr)) {
    return res.json({ ok: false, error: 'Organisasjonsnummer må være 9 siffer' });
  }
  const orgnr = req.params.orgnr.replace(/\s/g, '');
  res.json(await brregFetch(`/enheter/${orgnr}`));
});

app.get('/api/roles/:orgnr', async (req, res) => {
  if (!validOrgnr(req.params.orgnr)) {
    return res.json({ ok: false, error: 'Organisasjonsnummer må være 9 siffer' });
  }
  const orgnr = req.params.orgnr.replace(/\s/g, '');
  res.json(await brregFetch(`/enheter/${orgnr}/roller`));
});

app.get('/api/subunits/:orgnr', async (req, res) => {
  if (!validOrgnr(req.params.orgnr)) {
    return res.json({ ok: false, error: 'Organisasjonsnummer må være 9 siffer' });
  }
  const orgnr = req.params.orgnr.replace(/\s/g, '');
  res.json(await brregFetch(`/underenheter?overordnetEnhet=${orgnr}&size=50`));
});

// --- Helse-sjekk (for Render og liknende) -----------------------------------
app.get('/health', (_req, res) => res.json({ ok: true, uptime: process.uptime() }));

// --- Statiske filer ---------------------------------------------------------
// Server src/ som rot. index.html lastes automatisk på "/".
app.use(express.static(path.join(__dirname, 'src')));

// --- Start ------------------------------------------------------------------
app.listen(PORT, HOST, () => {
  console.log(`TXTK.ZIP web kjører på http://localhost:${PORT}`);
  if (HOST === '0.0.0.0') {
    console.log(`Tilgjengelig fra andre maskiner på samme nettverk via http://<din-ip>:${PORT}`);
  }
});
