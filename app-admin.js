"use strict";

(async function () {
  const S = window.RDR2_MAP_SETTINGS;
  const Z = window.RDR2_MAP_ZOOM;

  const map = Z.createMap("map");
  Z.addTiles(map);
  Z.fitToMap(map);
  Z.attachZoomLabel(map);

  const ui = {
    listEl: document.getElementById("list"),
    nameEl: document.getElementById("name"),
    typeEl: document.getElementById("type"),
    noteEl: document.getElementById("note"),
    deleteBtn: document.getElementById("deleteBtn"),
    exportBtn: document.getElementById("exportBtn"),
    importInput: document.getElementById("importInput"),
    saveDraftBtn: document.getElementById("saveDraftBtn"),
    loadDraftBtn: document.getElementById("loadDraftBtn"),
    countBadge: document.getElementById("countBadge"),
    xyBadge: document.getElementById("xyBadge"),
    statusBox: document.getElementById("statusBox")
  };

  class AdminStore {
    constructor(initial) {
      this.markers = Array.isArray(initial) ? initial : [];
      this.selectedId = this.markers[0]?.id ?? null;

      this._change = [];
      this._sel = [];

      this._reindex();
    }

    onChange(fn) { this._change.push(fn); }
    onSelectionChange(fn) { this._sel.push(fn); }

    _emitChange() { for (const fn of this._change) fn(); }
    _emitSel() { for (const fn of this._sel) fn(); }

    _reindex() {
      this.treeNoById = ForgeRP.MarkerIndex.buildTreeNumbers(this.markers);
    }

    setMarkers(list) {
      this.markers = Array.isArray(list) ? list : [];
      this.selectedId = this.markers[0]?.id ?? null;
      this._reindex();
      this._emitChange();
      this._emitSel();
    }

    current() {
      return this.markers.find(m => m.id === this.selectedId) || null;
    }

    select(id) {
      this.selectedId = id;
      this._emitSel();
      this._emitChange();
    }

    add(m) {
      this.markers.push(m);
      this._reindex();
      this._emitChange();
    }

    update(id, patch) {
      const m = this.markers.find(x => x.id === id);
      if (!m) return;
      Object.assign(m, patch);
      this._reindex();
      this._emitChange();
      if (id === this.selectedId) this._emitSel();
    }

    remove(id) {
      this.markers = this.markers.filter(x => x.id !== id);
      this.selectedId = this.markers[0]?.id ?? null;
      this._reindex();
      this._emitChange();
      this._emitSel();
    }
  }

  const store = new AdminStore(await ForgeRP.MarkersApi.load(S.markersUrl));
  const layer = new ForgeRP.LeafletMarkerLayer(map, Z, {
    draggable: true,
    iconFor: (m) => ForgeRP.MarkerIcons.leafletIcon({
      type: m.type,
      number: store.treeNoById.get(m.id) || null,
      decorated: false
    }),
    onClick: (m) => store.select(m.id),
    onDragEnd: (m, xy) => store.update(m.id, { x: xy.x, y: xy.y })
  });

  store.onChange(() => renderAll());
  store.onSelectionChange(() => syncEditor());

  renderAll();
  syncEditor();
  setStatus("Ready. Click on the map to add a marker.");

  map.on("click", (e) => {
    const { x, y } = Z.latLngToXy(map, e.latlng);
    const id = ForgeRP.Utils.makeId();
    store.add({ id, name: "Ялинка", type: "tree", note: "", x, y });
    store.select(id);
    setStatus("Marker added. Don't forget Export JSON.");
  });

  map.on("mousemove", (e) => {
    const p = Z.latLngToXy(map, e.latlng);
    ui.xyBadge.textContent = `x: ${p.x}, y: ${p.y}`;
  });

  ui.nameEl.addEventListener("input", () => {
    const m = store.current();
    if (!m) return;
    store.update(m.id, { name: ui.nameEl.value });
  });

  ui.typeEl.addEventListener("change", () => {
    const m = store.current();
    if (!m) return;
    store.update(m.id, { type: ui.typeEl.value });
  });

  ui.noteEl.addEventListener("input", () => {
    const m = store.current();
    if (!m) return;
    store.update(m.id, { note: ui.noteEl.value });
  });

  ui.deleteBtn.onclick = () => {
    const m = store.current();
    if (!m) return;
    store.remove(m.id);
    setStatus("Marker deleted.");
  };

  ui.exportBtn.onclick = () => {
    ForgeRP.Utils.downloadJson(store.markers, "markers.json");
    setStatus("markers.json downloaded. Commit it to the repository.");
  };

  ui.importInput.onchange = async () => {
    const file = ui.importInput.files?.[0];
    if (!file) return;

    try {
      const data = JSON.parse(await file.text());
      if (!Array.isArray(data)) return;
      store.setMarkers(data);
      setStatus("markers.json imported.");
    } catch {
      setStatus("Import failed: invalid JSON.");
    }
  };

  ui.saveDraftBtn.onclick = () => {
    localStorage.setItem("rdr2_markers_draft", JSON.stringify(store.markers));
    setStatus("Draft saved in localStorage.");
  };

  ui.loadDraftBtn.onclick = () => {
    const raw = localStorage.getItem("rdr2_markers_draft");
    if (!raw) return setStatus("Draft not found.");

    try {
      const data = JSON.parse(raw);
      if (!Array.isArray(data)) return setStatus("Draft is corrupted.");
      store.setMarkers(data);
      setStatus("Draft loaded.");
    } catch {
      setStatus("Draft is corrupted.");
    }
  };

  function renderAll() {
    layer.render(store.markers);
    renderList();
    ui.countBadge.textContent = `Мітки: ${store.markers.length}`;
  }

  function renderList() {
    const sorted = ForgeRP.MarkerIndex.sortTreesFirst(store.markers, store.treeNoById);
    ui.listEl.innerHTML = "";

    for (const m of sorted) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "list-btn";
      btn.dataset.id = m.id;
      btn.innerHTML = ForgeRP.MarkerIndex.titleFor(m, store.treeNoById);
      btn.onclick = () => {
        store.select(m.id);
        map.setView(Z.xyToLatLng(map, m.x, m.y), Math.max(1, map.getZoom()));
      };
      ui.listEl.appendChild(btn);
    }

    for (const b of ui.listEl.querySelectorAll(".list-btn")) {
      b.classList.toggle("active", b.dataset.id === store.selectedId);
    }
  }

  function syncEditor() {
    const m = store.current();
    ui.deleteBtn.disabled = !m;

    if (!m) {
      ui.nameEl.value = "";
      ui.typeEl.value = "tree";
      ui.noteEl.value = "";
      return;
    }

    ui.nameEl.value = m.name || "";
    ui.typeEl.value = m.type || "tree";
    ui.noteEl.value = m.note || "";
  }

  function setStatus(text) {
    ui.statusBox.textContent = text;
  }
})();
