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
    selectedId: null,
  };

  const $ = (id) => document.getElementById(id);
  const elCount = $("count");
  const elList = $("list");

  const f = {
    id: $("mId"),
    name: $("mName"),
    type: $("mType"),
    note: $("mNote"),
    x: $("mX"),
    y: $("mY"),
  };

  const esc = (s) => (s ?? "").toString().replace(/[&<>"']/g, (c) => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
  }[c]));

  function uid(){
    // short-ish random id
    return Math.random().toString(16).slice(2) + "-" + Date.now().toString(16);
  }

  function typeLabel(t){
    return ({tree:"🌲 tree", rare:"⭐ rare", done:"✅ done", other:"📍 other"}[t] || t);
  }

  function setSelected(id){
    state.selectedId = id;
    const m = state.markers.find(x => x.id === id) || null;

    if (!m){
      f.id.value = "";
      f.name.value = "";
      f.type.value = "tree";
      f.note.value = "";
      f.x.value = "";
      f.y.value = "";
      return;
    }

    f.id.value = m.id;
    f.name.value = m.name || "";
    f.type.value = m.type || "tree";
    f.note.value = m.note || "";
    f.x.value = m.x;
    f.y.value = m.y;

    // focus map
    const ll = map.unproject([m.x, m.y], MAX_ZOOM);
    map.setView(ll, Math.min(MAX_ZOOM, Math.max(map.getZoom(), MAX_ZOOM-0.5)), { animate:true });
  }

  function upsertLeafletMarker(m){
    let lm = state.leafletMarkers.get(m.id);
    const ll = map.unproject([m.x, m.y], MAX_ZOOM);
    if (!lm){
      lm = L.marker(ll, { icon: icons[m.type] || icons.other, draggable:true, keyboard:false });
      lm.on("click", () => setSelected(m.id));
      lm.on("dragend", () => {
        const p = map.project(lm.getLatLng(), MAX_ZOOM);
        m.x = Math.round(p.x);
        m.y = Math.round(p.y);
        if (state.selectedId === m.id){
          f.x.value = m.x;
          f.y.value = m.y;
        }
        renderList();
      });
      lm.addTo(map);
      state.leafletMarkers.set(m.id, lm);
    } else {
      lm.setLatLng(ll);
      lm.setIcon(icons[m.type] || icons.other);
    }
  }

  function removeLeafletMarker(id){
    const lm = state.leafletMarkers.get(id);
    if (lm){
      map.removeLayer(lm);
      state.leafletMarkers.delete(id);
    }
  }

  function renderList(){
    elCount.textContent = String(state.markers.length);

    // keep markers synced
    for (const m of state.markers) upsertLeafletMarker(m);

    const ids = new Set(state.markers.map(m => m.id));
    for (const [id] of state.leafletMarkers){
      if (!ids.has(id)) removeLeafletMarker(id);
    }

    elList.innerHTML = state.markers
      .slice()
      .sort((a,b)=>(a.name||"").localeCompare(b.name||""))
      .map(m => `
        <div class="item" data-id="${esc(m.id)}" style="${m.id===state.selectedId ? "outline:2px solid rgba(176,69,42,.5)" : ""}">
          <div class="item__title">${esc(m.name || "Без названия")}</div>
          <div class="item__meta">
            <span class="tag">${typeLabel(m.type)}</span>
            <span class="muted">x:${m.x} y:${m.y}</span>
          </div>
        </div>
      `).join("");

    for (const node of elList.querySelectorAll(".item")){
      node.addEventListener("click", () => setSelected(node.getAttribute("data-id")));
    }
  }

  function persistDraft(){
    try{
      localStorage.setItem("rdr2_markers_draft", JSON.stringify(state.markers));
    }catch{}
  }

  function loadDraft(){
    try{
      const raw = localStorage.getItem("rdr2_markers_draft");
      if (!raw) return null;
      const data = JSON.parse(raw);
      if (Array.isArray(data)) return data;
      return null;
    }catch{
      return null;
    }
  }

  async function loadMarkers(){
    // try draft first
    const draft = loadDraft();
    if (draft){
      state.markers = draft;
      renderList();
      return;
    }

    try{
      const res = await fetch("./markers.json", { cache: "no-store" });
      if (!res.ok) throw new Error("HTTP "+res.status);
      const data = await res.json();
      state.markers = Array.isArray(data) ? data : [];
    }catch(e){
      console.warn("Failed to load markers.json", e);
      state.markers = [];
    }
    renderList();
  }

  function exportJSON(){
    const jsonText = JSON.stringify(state.markers, null, 2);
    const blob = new Blob([jsonText], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "markers.json";
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      URL.revokeObjectURL(a.href);
      a.remove();
    }, 0);
  }

  async function copyJSON(){
    const jsonText = JSON.stringify(state.markers, null, 2);
    try{
      await navigator.clipboard.writeText(jsonText);
      alert("JSON скопирован в буфер обмена ✅");
    }catch{
      alert("Не получилось скопировать. Используй Export.");
    }
  }

  function importJSONFile(file){
    const reader = new FileReader();
    reader.onload = () => {
      try{
        const data = JSON.parse(String(reader.result || "[]"));
        if (!Array.isArray(data)) throw new Error("Not array");
        // normalize
        state.markers = data.map(m => ({
          id: String(m.id || uid()),
          name: String(m.name || ""),
          type: String(m.type || "tree"),
          note: String(m.note || ""),
          x: Number.isFinite(m.x) ? m.x : 0,
          y: Number.isFinite(m.y) ? m.y : 0,
        }));
        state.selectedId = null;
        persistDraft();
        renderList();
        alert("Импортировано ✅");
      }catch(e){
        alert("Ошибка импорта JSON: " + e.message);
      }
    };
    reader.readAsText(file);
  }

  // Map click -> add
  map.on("click", (e) => {
    const p = map.project(e.latlng, MAX_ZOOM);
    const m = {
      id: uid(),
      name: "Новая метка",
      type: "tree",
      note: "",
      x: Math.round(p.x),
      y: Math.round(p.y),
    };
    state.markers.push(m);
    persistDraft();
    renderList();
    setSelected(m.id);
  });

  // Form bindings
  function updateSelected(patch){
    const m = state.markers.find(x => x.id === state.selectedId);
    if (!m) return;
    Object.assign(m, patch);
    persistDraft();
    upsertLeafletMarker(m);
    renderList();
  }

  f.name.addEventListener("input", () => updateSelected({ name: f.name.value }));
  f.type.addEventListener("change", () => updateSelected({ type: f.type.value }));
  f.note.addEventListener("input", () => updateSelected({ note: f.note.value }));

  $("btnDelete").addEventListener("click", () => {
    const id = state.selectedId;
    if (!id) return;
    const m = state.markers.find(x => x.id === id);
    if (!m) return;
    if (!confirm(`Удалить метку "${m.name || id}"?`)) return;
    state.markers = state.markers.filter(x => x.id !== id);
    state.selectedId = null;
    persistDraft();
    renderList();
    setSelected(null);
  });

  $("btnNew").addEventListener("click", () => {
    state.selectedId = null;
    setSelected(null);
  });

  $("btnExport").addEventListener("click", exportJSON);
  $("btnCopy").addEventListener("click", copyJSON);
  $("fileImport").addEventListener("change", (e) => {
    const file = e.target.files && e.target.files[0];
    if (file) importJSONFile(file);
    e.target.value = "";
  });

  loadMarkers();
})();
