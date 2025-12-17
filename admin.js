// admin.js
"use strict";

(async function () {
  const S = window.RDR2_MAP_SETTINGS;
  const Z = window.RDR2_MAP_ZOOM;

  const map = Z.createMap("map");
  Z.addTiles(map);
  Z.fitToMap(map);
  Z.attachZoomLabel(map);

  const markersLayer = L.layerGroup().addTo(map);

  // UI
  const listEl = document.getElementById("list");
  const nameEl = document.getElementById("name");
  const typeEl = document.getElementById("type");
  const noteEl = document.getElementById("note");
  const deleteBtn = document.getElementById("deleteBtn");
  const exportBtn = document.getElementById("exportBtn");
  const importInput = document.getElementById("importInput");
  const saveDraftBtn = document.getElementById("saveDraftBtn");
  const loadDraftBtn = document.getElementById("loadDraftBtn");
  const countBadge = document.getElementById("countBadge");
  const xyBadge = document.getElementById("xyBadge");
  const statusBox = document.getElementById("statusBox");

  let markers = await loadMarkersOrEmpty();
  let selectedId = markers[0]?.id ?? null;

  renderAll();
  syncEditor();
  setStatus("Готово. Клікни по карті, щоб додати мітку.");

  // Додати мітку по кліку
  map.on("click", (e) => {
    const { x, y } = Z.latLngToXy(map, e.latlng);
    const m = { id: makeId(), name: "Ялинка", type: "tree", note: "", x, y };
    markers.push(m);
    selectedId = m.id;
    renderAll();
    syncEditor();
    setStatus("Додано мітку. Не забудь Export JSON.");
  });

  // Координати під курсором
  map.on("mousemove", (e) => {
    const p = Z.latLngToXy(map, e.latlng);
    xyBadge.textContent = `x: ${p.x}, y: ${p.y}`;
  });

  // Прив’язки редактора
  nameEl.addEventListener("input", () => {
    const m = current(); if (!m) return;
    m.name = nameEl.value;
    renderList();
    highlightList();
  });

  typeEl.addEventListener("change", () => {
    const m = current(); if (!m) return;
    m.type = typeEl.value;
    renderAll(); // оновити іконку
  });

  noteEl.addEventListener("input", () => {
    const m = current(); if (!m) return;
    m.note = noteEl.value;
  });

  deleteBtn.onclick = () => {
    const m = current(); if (!m) return;
    markers = markers.filter(x => x.id !== m.id);
    selectedId = markers[0]?.id ?? null;
    renderAll();
    syncEditor();
    setStatus("Мітку видалено.");
  };

  exportBtn.onclick = () => {
    downloadJson(markers, "markers.json");
    setStatus("markers.json завантажено. Додай у репозиторій та зроби commit.");
  };

  importInput.onchange = async () => {
    const file = importInput.files?.[0];
    if (!file) return;
    const data = JSON.parse(await file.text());
    if (!Array.isArray(data)) return;
    markers = data;
    selectedId = markers[0]?.id ?? null;
    renderAll();
    syncEditor();
    setStatus("Імпортовано markers.json.");
  };

  saveDraftBtn.onclick = () => {
    localStorage.setItem("rdr2_markers_draft", JSON.stringify(markers));
    setStatus("Чернетку збережено в браузері.");
  };

  loadDraftBtn.onclick = () => {
    const raw = localStorage.getItem("rdr2_markers_draft");
    if (!raw) return setStatus("Чернетку не знайдено.");
    const data = JSON.parse(raw);
    if (!Array.isArray(data)) return setStatus("Чернетка пошкоджена.");
    markers = data;
    selectedId = markers[0]?.id ?? null;
    renderAll();
    syncEditor();
    setStatus("Чернетку завантажено.");
  };

  // ---------- render ----------
  function renderAll() {
    markersLayer.clearLayers();

    for (const m of markers) {
      const ll = Z.xyToLatLng(map, m.x, m.y);

      const leafletMarker = L.marker(ll, {
        icon: iconFor(m.type || "tree"),
        draggable: true
      });

      leafletMarker.on("click", () => {
        selectedId = m.id;
        syncEditor();
        highlightList();
      });

      leafletMarker.on("dragend", (ev) => {
        const xy = Z.latLngToXy(map, ev.target.getLatLng());
        m.x = xy.x;
        m.y = xy.y;
        if (selectedId === m.id) syncEditor();
      });

      leafletMarker.addTo(markersLayer);
    }

    renderList();
    highlightList();
    countBadge.textContent = `Мітки: ${markers.length}`;
  }

  function renderList() {
    listEl.innerHTML = "";
    markers.forEach((m, idx) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "list-btn";
      btn.dataset.id = m.id;
      btn.textContent = `${idx + 1}. ${m.name || "Мітка"} (${m.type || "tree"})`;
      btn.onclick = () => {
        selectedId = m.id;
        syncEditor();
        highlightList();
        map.setView(Z.xyToLatLng(map, m.x, m.y), Math.max(1, map.getZoom()));
      };
      listEl.appendChild(btn);
    });
  }

  function highlightList() {
    for (const btn of listEl.querySelectorAll(".list-btn")) {
      btn.classList.toggle("active", btn.dataset.id === selectedId);
    }
  }

  function syncEditor() {
    const m = current();
    deleteBtn.disabled = !m;

    if (!m) {
      nameEl.value = "";
      typeEl.value = "tree";
      noteEl.value = "";
      return;
    }

    nameEl.value = m.name || "";
    typeEl.value = m.type || "tree";
    noteEl.value = m.note || "";
  }

  function current() {
    return markers.find(m => m.id === selectedId) || null;
  }

  // ---------- helpers ----------
  function iconFor(type) {
    const html = type === "tree" ? "🌲" : "📍";
    return L.divIcon({
      className: "rdr2-marker",
      html: `<div style="
        width:24px;height:24px;border-radius:12px;
        display:flex;align-items:center;justify-content:center;
        background:rgba(43,29,18,.85);
        border:1px solid rgba(185,137,69,.55);
        box-shadow:0 6px 16px rgba(0,0,0,.35);
        font-size:14px;
      ">${html}</div>`,
      iconSize: [24, 24],
      iconAnchor: [12, 12]
    });
  }

  async function loadMarkersOrEmpty() {
    try {
      const res = await fetch(S.markersUrl, { cache: "no-store" });
      if (!res.ok) return [];
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    } catch {
      return [];
    }
  }

  function makeId() {
    return (crypto?.randomUUID?.() || `id_${Date.now()}_${Math.random().toString(16).slice(2)}`);
  }

  function downloadJson(obj, filename) {
    const blob = new Blob([JSON.stringify(obj, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function setStatus(text) {
    statusBox.textContent = text;
  }
})();
