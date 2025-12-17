// app.js
"use strict";

(async function () {
  const S = window.RDR2_MAP_SETTINGS;
  const Z = window.RDR2_MAP_ZOOM;

  const map = Z.createMap("map");
  Z.addTiles(map);
  Z.fitToMap(map);
  Z.attachZoomLabel(map); // <- показує z та × біля +/-

  const markersLayer = L.layerGroup().addTo(map);

  const markers = await loadMarkers();
  renderMarkers(markers);

  async function loadMarkers() {
    try {
      const res = await fetch(S.markersUrl, { cache: "no-store" });
      if (!res.ok) return [];
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    } catch {
      return [];
    }
  }

  function iconFor(type) {
    const html = type === "tree" ? "🌲" : "📍";
    return L.divIcon({
      className: "rdr2-marker",
      html: `<div style="
        width:28px;height:28px;border-radius:14px;
        display:flex;align-items:center;justify-content:center;
        background:rgba(43,29,18,.85);
        border:1px solid rgba(185,137,69,.55);
        box-shadow:0 6px 16px rgba(0,0,0,.35);
        font-size:16px;
      ">${html}</div>`,
      iconSize: [28, 28],
      iconAnchor: [14, 14]
    });
  }

  function renderMarkers(list) {
    markersLayer.clearLayers();

    for (const m of list) {
      if (typeof m?.x !== "number" || typeof m?.y !== "number") continue;

      const ll = Z.xyToLatLng(map, m.x, m.y);
      const marker = L.marker(ll, { icon: iconFor(m.type || "tree") });

      const name = escapeHtml(m.name || "Мітка");
      const note = m.note ? `<div style="margin-top:6px;opacity:.9">${escapeHtml(m.note)}</div>` : "";
      marker.bindPopup(`<b>${name}</b>${note}`);

      marker.addTo(markersLayer);
    }
  }

  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
    );
  }
})();
