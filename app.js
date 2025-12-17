(() => {
  const { W: MAP_W, H: MAP_H, MAX_ZOOM } = window.MAP_CONFIG;

  const map = L.map("map", {
    crs: L.CRS.Simple,
    minZoom: 0,
    maxZoom: MAX_ZOOM,
    zoomSnap: 0.25,
    zoomDelta: 0.5,
    wheelPxPerZoomLevel: 90,
    preferCanvas: true,
    attributionControl: false,
  });

  const bounds = L.latLngBounds(
    map.unproject([0, MAP_H], MAX_ZOOM),
    map.unproject([MAP_W, 0], MAX_ZOOM)
  );

  L.tileLayer("tiles/{z}/{x}/{y}.webp", {
    bounds,
    minZoom: 0,
    maxZoom: MAX_ZOOM,
    noWrap: true,
    updateWhenZooming: false,
    keepBuffer: 2,
  }).addTo(map);

  map.fitBounds(bounds);
  map.setMaxBounds(bounds.pad(0.02));

  const icons = {
    tree: L.divIcon({ className: "", html: '<div class="marker marker--tree">🌲</div>', iconSize: [28,28], iconAnchor:[14,14]}),
    rare: L.divIcon({ className: "", html: '<div class="marker marker--rare">⭐</div>', iconSize: [28,28], iconAnchor:[14,14]}),
    done: L.divIcon({ className: "", html: '<div class="marker marker--done">✅</div>', iconSize: [28,28], iconAnchor:[14,14]}),
    other: L.divIcon({ className: "", html: '<div class="marker">📍</div>', iconSize: [28,28], iconAnchor:[14,14]}),
  };

  const state = {
    markers: [],
    leafletMarkers: new Map(),
    filters: { tree:true, rare:true, done:true },
    search: "",
  };

  const elCount = document.getElementById("count");
  const elList = document.getElementById("list");
  const elSearch = document.getElementById("search");
  const elFTree = document.getElementById("f_tree");
  const elFRare = document.getElementById("f_rare");
  const elFDone = document.getElementById("f_done");

  const esc = (s) => (s ?? "").toString().replace(/[&<>"']/g, (c) => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
  }[c]));

  const typeLabel = (t) => ({
    tree:"🌲 ёлка",
    rare:"⭐ редкая",
    done:"✅ проверено",
    other:"📍 другое"
  }[t] || t);

  function markerPopup(m){
    const url = new URL(location.href);
    url.searchParams.set("id", m.id);
    const share = url.toString();

    return `
      <div style="min-width:220px">
        <div style="font-weight:900;font-size:14px;margin-bottom:6px">${esc(m.name || "Без названия")}</div>
        <div style="font-size:12px;opacity:.85;margin-bottom:8px">${typeLabel(m.type)}</div>
        ${m.note ? `<div style="font-size:12px;line-height:1.35;margin-bottom:10px">${esc(m.note)}</div>` : ""}
        <div style="font-size:11px;opacity:.75;margin-bottom:10px">x:${m.x} y:${m.y}</div>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <a href="${share}" target="_blank" rel="noopener">🔗 Ссылка</a>
          <a href="https://www.google.com/search?q=${encodeURIComponent((m.name||"") + " RDR2")}" target="_blank" rel="noopener">🔎 Поиск</a>
        </div>
      </div>`;
  }

  function createLeafletMarker(m){
    const ll = map.unproject([m.x, m.y], MAX_ZOOM);
    const icon = icons[m.type] || icons.other;
    const lm = L.marker(ll, { icon, keyboard: false });
    lm.bindPopup(markerPopup(m));
    lm.addTo(map);
    return lm;
  }

  function matches(m){
    const okType = !!state.filters[m.type || "tree"];
    if (!okType) return false;
    const q = state.search.trim().toLowerCase();
    if (!q) return true;
    const hay = ((m.name||"") + " " + (m.note||"")).toLowerCase();
    return hay.includes(q);
  }

  function render(){
    const visible = state.markers.filter(matches);

    elCount.textContent = String(visible.length);

    // update leaflet markers visibility
    for (const m of state.markers){
      let lm = state.leafletMarkers.get(m.id);
      if (!lm){
        lm = createLeafletMarker(m);
        state.leafletMarkers.set(m.id, lm);
      }
      const show = visible.includes(m);
      if (show){
        if (!map.hasLayer(lm)) lm.addTo(map);
        lm.setPopupContent(markerPopup(m));
      } else {
        if (map.hasLayer(lm)) map.removeLayer(lm);
      }
    }

    // list
    elList.innerHTML = visible
      .slice()
      .sort((a,b)=>(a.name||"").localeCompare(b.name||""))
      .map(m => `
        <div class="item" data-id="${esc(m.id)}">
          <div class="item__title">${esc(m.name || "Без названия")}</div>
          <div class="item__meta">
            <span class="tag">${typeLabel(m.type)}</span>
            <span class="muted">x:${m.x} y:${m.y}</span>
          </div>
        </div>
      `).join("");

    for (const node of elList.querySelectorAll(".item")){
      node.addEventListener("click", () => {
        const id = node.getAttribute("data-id");
        const m = state.markers.find(x => x.id === id);
        if (!m) return;
        const ll = map.unproject([m.x, m.y], MAX_ZOOM);
        map.setView(ll, Math.min(MAX_ZOOM, Math.max(map.getZoom(), MAX_ZOOM-0.5)), { animate:true });
        const lm = state.leafletMarkers.get(m.id);
        if (lm) lm.openPopup();
      });
    }
  }

  async function loadMarkers(){
    try{
      const res = await fetch("./markers.json", { cache: "no-store" });
      if (!res.ok) throw new Error("HTTP "+res.status);
      const data = await res.json();
      state.markers = Array.isArray(data) ? data : [];
    }catch(e){
      console.warn("Failed to load markers.json", e);
      state.markers = [];
    }
    render();

    // open marker by ?id=
    const id = new URL(location.href).searchParams.get("id");
    if (id){
      const m = state.markers.find(x => x.id === id);
      if (m){
        const ll = map.unproject([m.x, m.y], MAX_ZOOM);
        map.setView(ll, MAX_ZOOM-0.25, { animate:false });
        const lm = state.leafletMarkers.get(m.id);
        if (lm) lm.openPopup();
      }
    }
  }

  // UI
  elSearch.addEventListener("input", () => { state.search = elSearch.value || ""; render(); });
  elFTree.addEventListener("change", () => { state.filters.tree = elFTree.checked; render(); });
  elFRare.addEventListener("change", () => { state.filters.rare = elFRare.checked; render(); });
  elFDone.addEventListener("change", () => { state.filters.done = elFDone.checked; render(); });

  loadMarkers();
})();
