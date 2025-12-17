"use strict";

(function () {
  const getSettings = () => window.RDR2_MAP_SETTINGS;

  function refZoom() {
    const s = getSettings();
    return s.tilesMaxZoom ?? s.viewMaxZoom ?? 0;
  }

  function buildTileUrlTemplate() {
    const s = getSettings();
    return `${s.tilesPath}/{z}/{x}/{y}.${s.tileExt}`;
  }

  function createMap(containerId) {
    const s = getSettings();

    const map = L.map(containerId, {
      crs: L.CRS.Simple,
      minZoom: s.minZoom,
      maxZoom: s.viewMaxZoom ?? s.tilesMaxZoom,
      zoomSnap: 0.25,
      zoomDelta: 0.25,
      wheelPxPerZoomLevel: 120,
      preferCanvas: true
    });
    return map;
  }

  function getBounds(map) {
    const s = getSettings();
    const rz = refZoom();
    const southWest = map.unproject([0, s.height], rz);
    const northEast = map.unproject([s.width, 0], rz);
    return L.latLngBounds(southWest, northEast);
  }

  function addTiles(map) {
    const s = getSettings();
    const bounds = getBounds(map);

    const layer = L.tileLayer(buildTileUrlTemplate(), {
      noWrap: true,
      bounds,

      minNativeZoom: 0,
      maxNativeZoom: s.tilesMaxZoom,                 // тайли реально до цього
      minZoom: s.minZoom,
      maxZoom: s.viewMaxZoom ?? s.tilesMaxZoom,      // але зумити можна вище

      keepBuffer: 2,
      updateWhenZooming: false
    });

    layer.addTo(map);
    return layer;
  }

  function fitToMap(map) {
    const bounds = getBounds(map);
    map.fitBounds(bounds, { padding: [20, 20] });
    map.setMaxBounds(bounds.pad(0.2));
  }

  function xyToLatLng(map, x, y) {
    return map.unproject([x, y], refZoom());
  }

  function latLngToXy(map, latlng) {
    const p = map.project(latlng, refZoom());
    return { x: Math.round(p.x), y: Math.round(p.y) };
  }

  // Індикатор масштабу всередині блоку +/-
  function attachZoomLabel(map) {
    const s = getSettings();
    const base = refZoom(); // 1:1 з оригіналом саме на tilesMaxZoom
    const zoomContainer = map.zoomControl?.getContainer?.();
    if (!zoomContainer) return;

    // не дублюємо
    if (zoomContainer.querySelector(".leaflet-control-zoom-level")) return;

    const el = document.createElement("div");
    el.className = "leaflet-control-zoom-level";
    zoomContainer.appendChild(el);

    const fmtScale = (v) => {
      if (v >= 10) return v.toFixed(0);
      if (v >= 1) return v.toFixed(2);
      return v.toFixed(3);
    };

    const update = () => {
      const z = map.getZoom();
      const scale = Math.pow(2, z - base); // відносно 1:1 на base
      el.textContent = `z ${z.toFixed(2)} · ×${fmtScale(scale)}`;
      el.title = `Поточний зум: ${z.toFixed(2)}\nМасштаб відносно оригіналу (на z=${base}): ×${fmtScale(scale)}\nТайли є до z=${s.tilesMaxZoom}, далі — оверзум`;
    };

    map.on("zoom zoomend", update);
    update();
  }

  window.RDR2_MAP_ZOOM = {
    createMap,
    addTiles,
    fitToMap,
    getBounds,
    xyToLatLng,
    latLngToXy,
    attachZoomLabel
  };
})();
