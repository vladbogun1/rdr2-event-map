"use strict";

(async function () {
  const S = window.RDR2_MAP_SETTINGS;
  const Z = window.RDR2_MAP_ZOOM;

  const map = Z.createMap("map");
  Z.addTiles(map);
  Z.fitToMap(map);
  Z.attachZoomLabel(map);

  const markers = await ForgeRP.MarkersApi.load(S.markersUrl, {
    cacheBust: new URLSearchParams(location.search).get("v") || Date.now()
  });

  const dataById = new Map(markers.map((m) => [m.id, m]));
  const treeNoById = ForgeRP.MarkerIndex.buildTreeNumbers(markers);

  const decor = new ForgeRP.DecorStore({
    cookieName: S.decor.cookieName,
    cooldownMs: S.decor.cooldownMs
  });

  decor.cleanupExpired();

  const popup = new ForgeRP.PopupTemplate({ treeNoById, decorStore: decor });

  const layer = new ForgeRP.LeafletMarkerLayer(map, Z, {
    draggable: false,
    iconFor: (m) => ForgeRP.MarkerIcons.leafletIcon({
      type: m.type,
      number: String(m.type || "tree") === "tree" ? treeNoById.get(m.id) : null,
      decorated: decor.isDecorated(m.id)
    }),
    popupFor: (m) => popup.html(m),
    onClick: (m, marker) => marker.setPopupContent(popup.html(m))
  });

  layer.render(markers);

  const scheduler = new ForgeRP.ExpiryScheduler(decor, (id) => {
    const m = dataById.get(id);
    if (!m) return;
    layer.setIcon(m);
    layer.setPopup(m);
    drawer.updateRow(id);
  });

  scheduler.scheduleAll([...decor.map.keys()]);

  document.addEventListener("click", (ev) => {
    const btn = ev.target.closest?.("[data-action='decorate']");
    if (!btn) return;

    ev.preventDefault();
    ev.stopPropagation();

    const id = btn.getAttribute("data-id") || btn.dataset.id;
    if (!id) return;

    decor.decorate(id);
    scheduler.schedule(id);

    const m = dataById.get(id);
    if (!m) return;

    layer.setIcon(m);
    layer.setPopup(m);
    drawer.updateRow(id);
  });

  const countdown = new ForgeRP.PopupCountdown(decor, (id) => {
    const m = dataById.get(id);
    if (!m) return;
    layer.setIcon(m);
    layer.setPopup(m);
    drawer.updateRow(id);
  });

  countdown.attach(map);

  const drawer = new ForgeRP.PointsDrawer({
    btnId: "pointsBtn",
    drawerId: "pointsDrawer",
    closeId: "pointsClose",
    listId: "pointsList",
    decorStore: decor,
    treeNoById,
    onFocus: (id) => focusOnMarker(id)
  });

  drawer.setMarkers(markers);

  new ForgeRP.SettingsMenu({
    wrapId: "settingsWrap",
    btnId: "settingsBtn",
    menuId: "settingsMenu",
    refreshId: "ddRefresh",
    resetId: "ddResetCooldowns",
    onRefresh: () => {
      const url = new URL(location.href);
      url.searchParams.set("v", String(Date.now()));
      location.replace(url.toString());
    },
    onReset: () => {
      const ok = confirm("Скинути всі кулдауни ялинок у цьому браузері?");
      if (!ok) return;

      scheduler.clearAll();
      decor.reset();

      for (const m of markers) {
        layer.setIcon(m);
        layer.setPopup(m);
      }

      drawer.updateAllRows();
    }
  });

  function focusOnMarker(id) {
    const m = dataById.get(id);
    if (!m) return;

    const ll = Z.xyToLatLng(map, m.x, m.y);

    const maxZ = map.getMaxZoom();
    const targetZ = Math.min(maxZ, (S.tilesMaxZoom ?? 6) + 2);

    map.flyTo(ll, targetZ, { duration: 0.6 });

    const marker = layer.get(id);
    if (marker) {
      marker.setPopupContent(popup.html(m));
      marker.openPopup();
    }
  }
})();
