"use strict";

(async function () {
  const S = window.RDR2_MAP_SETTINGS;
  const Z = window.RDR2_MAP_ZOOM;

  const map = Z.createMap("map");
  Z.addTiles(map);
  Z.fitToMap(map);

  const markersLayer = L.layerGroup().addTo(map);

  let markers = await loadMarkersOrEmpty();
  let selectedId = null;

  const ui = buildUI();
  renderAll();

  // Добавление по клику
  map.on("click", (e) => {
    const { x, y } = Z.latLngToXy(map, e.latlng);
    const m = {
      id: makeId(),
      name: `Ёлка`,
      type: "tree",
      note: "",
      x, y
    };
    markers.push(m);
    selectedId = m.id;
    renderAll();
    syncEditor();
  });

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
    syncEditor();
  }

  function renderList() {
    ui.list.innerHTML = "";

    markers.forEach((m, idx) => {
      const row = document.createElement("button");
      row.type = "button";
      row.className = "row";
      row.textContent = `${idx + 1}. ${m.name || "Метка"} (${m.type || "tree"})`;
      row.dataset.id = m.id;
      row.onclick = () => {
        selectedId = m.id;
        syncEditor();
        highlightList();
        const ll = Z.xyToLatLng(map, m.x, m.y);
        map.setView(ll, Math.max(1, map.getZoom()));
      };
      ui.list.appendChild(row);
    });

    ui.count.textContent = `Метки: ${markers.length}`;
  }

  function highlightList() {
    for (const btn of ui.list.querySelectorAll(".row")) {
      btn.classList.toggle("active", btn.dataset.id === selectedId);
    }
  }

  function current() {
    return markers.find((m) => m.id === selectedId) || null;
  }

  function syncEditor() {
    const m = current();
    ui.deleteBtn.disabled = !m;

    if (!m) {
      ui.name.value = "";
      ui.type.value = "tree";
      ui.note.value = "";
      ui.xy.textContent = "x: —, y: —";
      return;
    }

    ui.name.value = m.name || "";
    ui.type.value = m.type || "tree";
    ui.note.value = m.note || "";
    ui.xy.textContent = `x: ${m.x}, y: ${m.y}`;
  }

  ui.name.addEventListener("input", () => {
    const m = current(); if (!m) return;
    m.name = ui.name.value;
    renderList(); highlightList();
  });

  ui.type.addEventListener("change", () => {
    const m = current(); if (!m) return;
    m.type = ui.type.value;
    renderAll(); // чтобы иконка обновилась
  });

  ui.note.addEventListener("input", () => {
    const m = current(); if (!m) return;
    m.note = ui.note.value;
  });

  ui.deleteBtn.onclick = () => {
    const m = current(); if (!m) return;
    markers = markers.filter((x) => x.id !== m.id);
    selectedId = markers[0]?.id ?? null;
    renderAll();
  };

  ui.exportBtn.onclick = () => downloadJson(markers, "markers.json");

  ui.copyBtn.onclick = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(markers, null, 2));
      ui.status.textContent = "Скопировано в буфер!";
      setTimeout(() => (ui.status.textContent = ""), 1500);
    } catch {
      ui.status.textContent = "Не удалось скопировать (браузер запретил).";
    }
  };

  ui.importInput.onchange = async () => {
    const file = ui.importInput.files?.[0];
    if (!file) return;
    const text = await file.text();
    const data = JSON.parse(text);
    if (!Array.isArray(data)) return;
    markers = data;
    selectedId = markers[0]?.id ?? null;
    renderAll();
  };

  ui.saveDraftBtn.onclick = () => {
    localStorage.setItem("rdr2_markers_draft", JSON.stringify(markers));
    ui.status.textContent = "Черновик сохранён в браузере.";
    setTimeout(() => (ui.status.textContent = ""), 1500);
  };

  ui.loadDraftBtn.onclick = () => {
    const raw = localStorage.getItem("rdr2_markers_draft");
    if (!raw) return;
    const data = JSON.parse(raw);
    if (!Array.isArray(data)) return;
    markers = data;
    selectedId = markers[0]?.id ?? null;
    renderAll();
  };

  // -------- helpers --------

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

  function buildUI() {
    // Мини-панель. Если хочешь — мы её потом стилизуем под твой "вестерн" дизайн сильнее.
    const panel = document.createElement("div");
    panel.style.cssText = `
      position:fixed; right:12px; top:12px; bottom:12px;
      width:320px; z-index:9999;
      background:rgba(43,29,18,.92);
      border:1px solid rgba(185,137,69,.35);
      border-radius:14px;
      box-shadow:0 10px 30px rgba(0,0,0,.35);
      padding:12px;
      color:#f2e4c9;
      font-family:system-ui,Segoe UI,Arial;
      overflow:auto;
    `;

    panel.innerHTML = `
      <div style="font-weight:800;margin-bottom:8px">Admin — метки</div>
      <div id="count" style="opacity:.9;margin-bottom:10px">Метки: 0</div>

      <div style="font-size:12px;opacity:.9;margin:10px 0 6px">Список</div>
      <div id="list" style="display:flex;flex-direction:column;gap:6px;margin-bottom:12px"></div>

      <div style="font-size:12px;opacity:.9;margin:10px 0 6px">Редактор</div>
      <input id="name" placeholder="Название" style="width:100%;padding:10px;border-radius:12px;border:1px solid rgba(185,137,69,.35);background:rgba(230,214,184,.08);color:#f2e4c9;outline:none" />
      <select id="type" style="margin-top:8px;width:100%;padding:10px;border-radius:12px;border:1px solid rgba(185,137,69,.35);background:rgba(230,214,184,.08);color:#f2e4c9;outline:none">
        <option value="tree">tree</option>
        <option value="pin">pin</option>
      </select>
      <textarea id="note" placeholder="Заметка" rows="3" style="margin-top:8px;width:100%;padding:10px;border-radius:12px;border:1px solid rgba(185,137,69,.35);background:rgba(230,214,184,.08);color:#f2e4c9;outline:none;resize:vertical"></textarea>
      <div id="xy" style="margin-top:8px;font-size:12px;opacity:.9">x: —, y: —</div>

      <button id="delete" style="margin-top:10px;width:100%;padding:10px;border-radius:12px;border:1px solid rgba(185,70,69,.35);background:rgba(185,70,69,.18);color:#f2e4c9;font-weight:800;cursor:pointer">Удалить</button>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:10px">
        <button id="export" style="padding:10px;border-radius:12px;border:1px solid rgba(185,137,69,.35);background:rgba(185,137,69,.18);color:#f2e4c9;font-weight:800;cursor:pointer">Export JSON</button>
        <button id="copy" style="padding:10px;border-radius:12px;border:1px solid rgba(185,137,69,.35);background:rgba(185,137,69,.10);color:#f2e4c9;font-weight:800;cursor:pointer">Copy JSON</button>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:10px">
        <button id="saveDraft" style="padding:10px;border-radius:12px;border:1px solid rgba(185,137,69,.25);background:rgba(0,0,0,.16);color:#f2e4c9;font-weight:800;cursor:pointer">Save draft</button>
        <button id="loadDraft" style="padding:10px;border-radius:12px;border:1px solid rgba(185,137,69,.25);background:rgba(0,0,0,.10);color:#f2e4c9;font-weight:800;cursor:pointer">Load draft</button>
      </div>

      <div style="margin-top:10px">
        <input id="import" type="file" accept="application/json" style="width:100%" />
      </div>

      <div id="status" style="margin-top:10px;font-size:12px;opacity:.9"></div>

      <style>
        .row{
          text-align:left;
          padding:10px;
          border-radius:12px;
          border:1px solid rgba(185,137,69,.25);
          background:rgba(0,0,0,.16);
          color:#f2e4c9;
          cursor:pointer;
        }
        .row.active{
          border-color: rgba(185,137,69,.6);
          background: rgba(185,137,69,.16);
        }
      </style>
    `;

    document.body.appendChild(panel);

    return {
      panel,
      count: panel.querySelector("#count"),
      list: panel.querySelector("#list"),
      name: panel.querySelector("#name"),
      type: panel.querySelector("#type"),
      note: panel.querySelector("#note"),
      xy: panel.querySelector("#xy"),
      deleteBtn: panel.querySelector("#delete"),
      exportBtn: panel.querySelector("#export"),
      copyBtn: panel.querySelector("#copy"),
      saveDraftBtn: panel.querySelector("#saveDraft"),
      loadDraftBtn: panel.querySelector("#loadDraft"),
      importInput: panel.querySelector("#import"),
      status: panel.querySelector("#status")
    };
  }
})();
