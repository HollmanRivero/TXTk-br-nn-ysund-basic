// TXTK.ZIP — renderer
const $ = (sel) => document.querySelector(sel);
const elQuery = $('#query');
const elBtn = $('#searchBtn');
const elResults = $('#results');
const elDetail = $('#detailPane');
const elStatus = $('#status');
const elHint = $('#hint');
const tabs = document.querySelectorAll('.tab');

let currentMode = 'search';   // 'search' | 'orgnr'
let currentList = [];
let activeOrgnr = null;

// ── helpers ────────────────────────────────────────────────────
function setStatus(text, kind = '') {
  elStatus.textContent = text;
  elStatus.className = 'status ' + kind;
}

function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function fmtAddr(adr) {
  if (!adr) return '—';
  const lines = [...(adr.adresse || []), [adr.postnummer, adr.poststed].filter(Boolean).join(' ')];
  return lines.filter(Boolean).map(escapeHtml).join('<br>');
}

function flagBadges(e) {
  const out = [];
  if (e.konkurs) out.push('<span class="badge warn">KONKURS</span>');
  if (e.underAvvikling) out.push('<span class="badge warn">UNDER AVVIKLING</span>');
  if (e.underTvangsavviklingEllerTvangsopplosning) out.push('<span class="badge warn">TVANGSAVVIKLING</span>');
  if (e.registrertIMvaregisteret) out.push('<span class="badge ok">MVA</span>');
  if (e.registrertIForetaksregisteret) out.push('<span class="badge">FORETAK</span>');
  if (e.registrertIFrivillighetsregisteret) out.push('<span class="badge">FRIVILLIG</span>');
  return out.join(' ');
}

// ── tabs ───────────────────────────────────────────────────────
tabs.forEach((t) => {
  t.addEventListener('click', () => {
    tabs.forEach((x) => x.classList.remove('active'));
    t.classList.add('active');
    currentMode = t.dataset.mode;
    elQuery.placeholder = currentMode === 'orgnr'
      ? 'Skriv 9-sifret organisasjonsnummer …'
      : 'Søk virksomhet — f.eks. Equinor, Norsk Hydro …';
    elQuery.focus();
  });
});

// ── input handlers ─────────────────────────────────────────────
elBtn.addEventListener('click', runQuery);
elQuery.addEventListener('keydown', (e) => { if (e.key === 'Enter') runQuery(); });

elQuery.addEventListener('input', () => {
  // Auto-detect orgnr (9 digits)
  const cleaned = elQuery.value.replace(/\s/g, '');
  if (/^\d{9}$/.test(cleaned)) {
    elHint.textContent = 'Ser ut som et organisasjonsnummer — Enter for direkteoppslag.';
  } else {
    elHint.textContent = 'Trykk Enter for å søke. 9-sifret orgnr gir direkteoppslag.';
  }
});

async function runQuery() {
  const raw = elQuery.value.trim();
  if (!raw) return;
  const cleaned = raw.replace(/\s/g, '');
  const isOrgnr = currentMode === 'orgnr' || /^\d{9}$/.test(cleaned);

  elBtn.disabled = true;
  setStatus('Henter …', 'busy');

  try {
    if (isOrgnr) {
      const res = await window.txtk.lookup(cleaned);
      if (!res.ok) {
        renderError(res.error || 'Feil ved oppslag');
        return;
      }
      currentList = [res.data];
      renderList(currentList);
      selectOrgnr(res.data.organisasjonsnummer);
    } else {
      const res = await window.txtk.search(raw);
      if (!res.ok) {
        renderError(res.error || 'Feil ved søk');
        return;
      }
      const items = res.data?._embedded?.enheter || [];
      currentList = items;
      if (items.length === 0) {
        elResults.innerHTML = `<div class="empty"><div class="empty-mark">∅</div><div class="empty-text">Ingen treff</div></div>`;
      } else {
        renderList(items);
      }
    }
    setStatus(`${currentList.length} treff`, '');
  } catch (err) {
    renderError(err.message || String(err));
  } finally {
    elBtn.disabled = false;
  }
}

function renderError(msg) {
  setStatus('Feil', 'err');
  elResults.innerHTML = `<div class="empty"><div class="empty-mark">!</div><div class="empty-text">${escapeHtml(msg)}</div></div>`;
}

// ── list rendering ─────────────────────────────────────────────
function renderList(items) {
  elResults.innerHTML = items.map((e) => `
    <div class="result-item" data-orgnr="${escapeHtml(e.organisasjonsnummer)}">
      <div class="result-name">${escapeHtml(e.navn)}</div>
      <div class="result-meta">
        <span class="orgnr">${escapeHtml(e.organisasjonsnummer)}</span>
        <span>${escapeHtml(e.organisasjonsform?.kode || '—')}</span>
        ${e.forretningsadresse?.poststed ? `<span>${escapeHtml(e.forretningsadresse.poststed)}</span>` : ''}
      </div>
    </div>
  `).join('');

  elResults.querySelectorAll('.result-item').forEach((node) => {
    node.addEventListener('click', () => selectOrgnr(node.dataset.orgnr));
  });
}

// ── detail rendering ───────────────────────────────────────────
async function selectOrgnr(orgnr) {
  activeOrgnr = orgnr;
  elResults.querySelectorAll('.result-item').forEach((n) =>
    n.classList.toggle('active', n.dataset.orgnr === orgnr)
  );

  elDetail.innerHTML = `<div class="loading">Henter detaljer for ${escapeHtml(orgnr)} …</div>`;

  const [entRes, rolesRes, subRes] = await Promise.all([
    window.txtk.lookup(orgnr),
    window.txtk.roles(orgnr),
    window.txtk.subunits(orgnr)
  ]);

  if (!entRes.ok) {
    elDetail.innerHTML = `<div class="detail-empty">Kunne ikke hente data: ${escapeHtml(entRes.error)}</div>`;
    return;
  }
  renderDetail(entRes.data, rolesRes, subRes);
}

function renderDetail(e, rolesRes, subRes) {
  const url = e.hjemmeside ? (e.hjemmeside.startsWith('http') ? e.hjemmeside : 'https://' + e.hjemmeside) : null;

  let html = `
    <div class="detail">
      <h1>${escapeHtml(e.navn)}</h1>
      <div class="orgnr-big">ORG.NR ${escapeHtml(e.organisasjonsnummer)}</div>
      <div class="flags">${flagBadges(e)}</div>

      <div class="section">
        <h2>Grunninfo</h2>
        <dl class="kv">
          <dt>Organisasjonsform</dt>
          <dd>${escapeHtml(e.organisasjonsform?.beskrivelse || '—')} (${escapeHtml(e.organisasjonsform?.kode || '—')})</dd>
          <dt>Stiftelsesdato</dt><dd>${escapeHtml(e.stiftelsesdato || '—')}</dd>
          <dt>Registreringsdato</dt><dd>${escapeHtml(e.registreringsdatoEnhetsregisteret || '—')}</dd>
          <dt>Næringskode</dt>
          <dd>${e.naeringskode1 ? escapeHtml(e.naeringskode1.kode + ' — ' + e.naeringskode1.beskrivelse) : '—'}</dd>
          <dt>Antall ansatte</dt><dd>${e.antallAnsatte ?? '—'}</dd>
          <dt>Hjemmeside</dt>
          <dd>${url ? `<a href="#" data-ext="${escapeHtml(url)}">${escapeHtml(e.hjemmeside)}</a>` : '—'}</dd>
        </dl>
      </div>

      <div class="section">
        <h2>Adresser</h2>
        <dl class="kv">
          <dt>Forretningsadresse</dt><dd>${fmtAddr(e.forretningsadresse)}</dd>
          <dt>Postadresse</dt><dd>${fmtAddr(e.postadresse)}</dd>
        </dl>
      </div>
  `;

  // Roles
  if (rolesRes.ok && rolesRes.data?.rollegrupper?.length) {
    html += `<div class="section"><h2>Roller</h2><div class="role-list">`;
    for (const grp of rolesRes.data.rollegrupper) {
      const grpName = escapeHtml(grp.type?.beskrivelse || grp.type?.kode || 'Rollegruppe');
      for (const r of grp.roller || []) {
        const navn = r.person
          ? escapeHtml(`${r.person.navn?.fornavn || ''} ${r.person.navn?.etternavn || ''}`.trim())
          : escapeHtml(r.enhet?.navn?.[0] || r.enhet?.organisasjonsnummer || '—');
        html += `
          <div class="role">
            <div class="role-type">${grpName}<br><span class="role-desc">${escapeHtml(r.type?.beskrivelse || '')}</span></div>
            <div class="role-name">${navn}</div>
          </div>`;
      }
    }
    html += `</div></div>`;
  }

  // Subunits
  if (subRes.ok && subRes.data?._embedded?.underenheter?.length) {
    const subs = subRes.data._embedded.underenheter;
    html += `<div class="section"><h2>Underenheter (${subs.length})</h2><div class="role-list">`;
    for (const s of subs) {
      html += `
        <div class="role">
          <div class="role-type">${escapeHtml(s.organisasjonsnummer)}<br><span class="role-desc">${escapeHtml(s.organisasjonsform?.kode || '')}</span></div>
          <div class="role-name">${escapeHtml(s.navn)}</div>
        </div>`;
    }
    html += `</div></div>`;
  }

  html += `</div>`;
  elDetail.innerHTML = html;

  // External links
  elDetail.querySelectorAll('[data-ext]').forEach((a) => {
    a.addEventListener('click', (ev) => {
      ev.preventDefault();
      window.txtk.openExternal(a.dataset.ext);
    });
  });
}

// Focus on launch
elQuery.focus();
