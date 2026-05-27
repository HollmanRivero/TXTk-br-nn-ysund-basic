// TXTK.ZIP — web shim
// Definerer window.txtk basert på fetch når appen kjøres i nettleser (server.js).
// I Electron settes window.txtk allerede opp via preload.js, så vi rører ikke noe da.

if (!window.txtk) {
  const get = async (url) => {
    try {
      const r = await fetch(url);
      return await r.json();
    } catch (e) {
      return { ok: false, error: e.message };
    }
  };

  window.txtk = {
    search: (query, opts = {}) => {
      const params = new URLSearchParams({
        q: query,
        size: opts.size ?? 20,
        page: opts.page ?? 0,
      });
      return get(`/api/search?${params}`);
    },
    lookup: (orgnr) => get(`/api/lookup/${encodeURIComponent(orgnr)}`),
    roles: (orgnr) => get(`/api/roles/${encodeURIComponent(orgnr)}`),
    subunits: (orgnr) => get(`/api/subunits/${encodeURIComponent(orgnr)}`),
    openExternal: async (url) => {
      // Web-versjonen kan ikke åpne nye OS-prosesser, så vi åpner i ny fane i stedet
      if (typeof url === 'string' && /^https?:\/\//i.test(url)) {
        window.open(url, '_blank', 'noopener');
        return { ok: true };
      }
      return { ok: false };
    },
  };
}
