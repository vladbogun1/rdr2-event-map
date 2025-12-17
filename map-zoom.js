"use strict";

(function () {
  const getSettings = () => window.RDR2_MAP_SETTINGS;

  function buildTileUrlTemplate() {
    const s = getSettings();
    return `${s.tilesPath}/{z}/{x}/{y}.${s.tileExt}`;
  }

  function createMap(containerId) {
    const s = getSettings();

    const map = L.map(containerId, {
      crs: L.CRS.Simple,
      minZoom: s.minZoom,
      maxZoom: s.maxZoom,
      zoomSnap: 0.25,
      zoomDelta: 0.25,
      wheelPxPerZoomLevel: 120,
      preferCanvas: true
    });

    return map;
  }

  function getBounds(map) {
    const s = getSettings();
    const southWest = map.unproject([0, s.height], s.maxZoom);
    const northEast = map.unproject([s.width, 0], s.maxZoom);
    return L.latLngBounds(southWest, northEast);
  }

  function addTiles(map) {
    const s = getSettings();
    const bounds = getBounds(map);

    const layer = L.tileLayer(buildTileUrlTemplate(), {
      noWrap: true,
      bounds,
      minNativeZoom: 0,
      maxNativeZoom: s.maxZoom,
      minZoom: s.minZoom,
      maxZoom: s.maxZoom,

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
    const s = getSettings();
    return map.unproject([x, y], s.maxZoom);
  }

  function latLngToXy(map, latlng) {
    const s = getSettings();
    const p = map.project(latlng, s.maxZoom);
    return { x: Math.round(p.x), y: Math.round(p.y) };
  }

  window.RDR2_MAP_ZOOM = {
    createMap,
    addTiles,
    fitToMap,
    getBounds,
    xyToLatLng,
    latLngToXy
  };
})();
