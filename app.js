"use strict";

(async function () {
  const S = window.RDR2_MAP_SETTINGS;
  const Z = window.RDR2_MAP_ZOOM;

  const COOLDOWN_MS = 24 * 60 * 60 * 1000;
  const COOKIE_NAME = "forgerp_tree_decor_v1";

  const map = Z.createMap("map");
  Z.addTiles(map);
  Z.fitToMap(map);
  Z.attachZoomLabel(map);

  const markersLayer = L.layerGroup().addTo(map);

  setupSettingsMenu();

  function setupSettingsMenu() {
    const wrap = document.getElementById("settingsWrap");
    const btn = document.getElementById("settingsBtn");
    const menu = document.getElementById("settingsMenu");
    const ddRefresh = document.getElementById("ddRefresh");
    const ddReset = document.getElementById("ddResetCooldowns");

    if (!wrap || !btn || !menu) return;

    const open = () => {
      menu.hidden = false;
      btn.setAttribute("aria-expanded", "true");
    };

    const close = () => {
      menu.hidden = true;
      btn.setAttribute("aria-expanded", "false");
    };

    const toggle = () => (menu.hidden ? open() : close());

    // На мобілці краще pointerdown, щоб не було “дивних” кліків + не тягнуло карту
    btn.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      e.stopPropagation();
      toggle();
    });

    // клік/тап поза меню — закрити
    document.addEventListener("pointerdown", (e) => {
      if (!wrap.contains(e.target)) close();
    });

    // ESC — закрити
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") close();
    });

    if (ddRefresh) {
      ddRefresh.addEventListener("pointerdown", (e) => {
        e.preventDefault();
        e.stopPropagation();
        close();

        const url = new URL(window.location.href);
        url.searchParams.set("v", String(Date.now()));
        window.location.replace(url.toString());
      });
    }

    if (ddReset) {
      ddReset.addEventListener("pointerdown", (e) => {
        e.preventDefault();
        e.stopPropagation();
        close();

        const ok = confirm("Скинути всі кулдауни ялинок у цьому браузері?");
        if (!ok) return;

        resetAllCooldowns();
      });
    }
  }

  function resetAllCooldowns() {
    // очистити Map + таймери
    for (const id of expireTimers.keys()) clearExpiry(id);
    decor.clear();

    // видалити cookie повністю
    deleteCookie(COOKIE_NAME);

    // перемалювати всі маркери (стан стане “звичайний”)
    for (const m of markers) updateMarkerVisual(m);
  }

  function deleteCookie(name) {
    document.cookie = `${name}=; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Path=/; SameSite=Lax`;
  }

  // ----- Decor state (cookies): id -> expiresAtMs -----
  const decor = loadDecorState(); // Map<string, number>

  // таймери завершення (щоб іконки оновлювались навіть коли попап закритий)
  const expireTimers = new Map(); // id -> timeoutId

  // ----- markers -----
  const markers = await loadMarkers();
  const markerById = new Map();                 // id -> Leaflet marker
  const dataById = new Map(markers.map(m => [m.id, m])); // id -> marker data

  // ----- tree numbering -----
  const treeNoById = buildTreeNumbers(markers); // Map<string, number>

  renderMarkers(markers);

  cleanupAndRefresh();
  scheduleAllExpiries();

  // fallback: підчищати протухлі і оновлювати раз на 30 сек
  setInterval(cleanupAndRefresh, 30_000);

  // ✅ Делегований клік по кнопці в попапі
  document.addEventListener("click", (ev) => {
    const btn = ev.target.closest?.("[data-action='decorate']");
    if (!btn) return;

    ev.preventDefault();
    ev.stopPropagation();

    const id = btn.getAttribute("data-id") || btn.dataset.id;
    if (!id) return;

    decorate(id);
  });

  // ✅ Таймер: старт/стоп на popup open/close
  map.on("popupopen", (e) => startPopupCountdown(e.popup));
  map.on("popupclose", (e) => stopPopupCountdown(e.popup));

  // ✅ Right-side list drawer
  setupPointsDrawer();

  // ====== functions ======

  async function loadMarkers() {
    try {
      const v = new URLSearchParams(location.search).get("v") || String(Date.now());
      const res = await fetch(`${S.markersUrl}?v=${encodeURIComponent(v)}`, { cache: "no-store" });
      if (!res.ok) return [];
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    } catch {
      return [];
    }
  }

  function buildTreeNumbers(list) {
    const map = new Map();
    let n = 0;
    for (const m of list) {
      const t = String(m?.type || "tree");
      if (t === "tree" && m?.id) {
        n += 1;
        map.set(m.id, n);
      }
    }
    return map;
  }

  function isDecorated(id) {
    const exp = decor.get(id);
    return typeof exp === "number" && exp > Date.now();
  }

  function timeLeftMs(id) {
    const exp = decor.get(id) || 0;
    return exp - Date.now();
  }

  function decorate(id) {
    decor.set(id, Date.now() + COOLDOWN_MS);
    saveDecorState(decor);
    scheduleExpiry(id);

    const m = dataById.get(id);
    if (m) updateMarkerVisual(m);

    // оновити рядок у списку
    updateDrawerRow(id);
  }

  function cleanupAndRefresh() {
    const now = Date.now();
    let changed = false;

    for (const [id, exp] of decor.entries()) {
      if (!exp || exp <= now) {
        decor.delete(id);
        changed = true;

        clearExpiry(id);

        const m = dataById.get(id);
        if (m) updateMarkerVisual(m);

        updateDrawerRow(id);
      }
    }

    if (changed) saveDecorState(decor);
  }

  // ===== Expiry scheduling (оновлює іконки без попапа) =====

  function scheduleAllExpiries() {
    for (const id of decor.keys()) scheduleExpiry(id);
  }

  function scheduleExpiry(id) {
    clearExpiry(id);

    const left = timeLeftMs(id);
    if (left <= 0) {
      expireNow(id);
      return;
    }

    const t = setTimeout(() => expireNow(id), left + 50);
    expireTimers.set(id, t);
  }

  function clearExpiry(id) {
    const t = expireTimers.get(id);
    if (t) clearTimeout(t);
    expireTimers.delete(id);
  }

  function expireNow(id) {
    if (!decor.has(id)) return;

    decor.delete(id);
    saveDecorState(decor);
    clearExpiry(id);

    const m = dataById.get(id);
    if (m) updateMarkerVisual(m);

    updateDrawerRow(id);
  }

  // ===== Marker + Popup =====

  function iconFor(m) {
    const decorated = isDecorated(m.id);
    const type = String(m.type || "tree");
    const emoji = type === "tree" ? "🌲" : "📍";
    const cls = decorated ? "marker-bubble decorated" : "marker-bubble";

    const no = (type === "tree") ? treeNoById.get(m.id) : null;
    const numHtml = no ? `<span class="marker-num">#${no}</span>` : "";

    return L.divIcon({
      className: "rdr2-marker",
      html: `<div class="${cls}">${emoji}${numHtml}</div>`,
      iconSize: [28, 28],
      iconAnchor: [14, 14]
    });
  }

  function popupHtml(m) {
    const type = String(m.type || "tree");
    const no = (type === "tree") ? treeNoById.get(m.id) : null;

    const nameBase = escapeHtml(m.name || "Мітка");
    const name = no ? `#${no} ${nameBase}` : nameBase;

    const note = m.note ? `<div class="popup-note">${escapeHtml(m.note)}</div>` : "";
    const left = timeLeftMs(m.id);

    if (left <= 0) {
      return `
        <b>${name}</b>
        ${note}
        <div class="popup-actions">
          <button class="popup-btn" data-action="decorate" data-id="${m.id}">
            🎀 Прикрасити (24 год)
          </button>
        </div>
      `;
    }

    return `
      <b>${name}</b>
      ${note}
      <div class="popup-actions">
        <div class="popup-locked">
          ✅ Вже прикрашено
          <div class="popup-remaining" data-id="${m.id}">
            Залишилось: ${formatLeft(left)}
          </div>
        </div>
      </div>
    `;
  }

  function renderMarkers(list) {
    markersLayer.clearLayers();
    markerById.clear();

    for (const m of list) {
      if (!m?.id) continue;
      if (typeof m?.x !== "number" || typeof m?.y !== "number") continue;

      const ll = Z.xyToLatLng(map, m.x, m.y);
      const marker = L.marker(ll, { icon: iconFor(m) });

      marker.bindPopup(popupHtml(m));

      marker.on("click", () => marker.setPopupContent(popupHtml(m)));

      marker.addTo(markersLayer);
      markerById.set(m.id, marker);
    }
  }

  function updateMarkerVisual(m) {
    const marker = markerById.get(m.id);
    if (!marker) return;

    marker.setIcon(iconFor(m));

    if (marker.isPopupOpen && marker.isPopupOpen()) {
      const popup = marker.getPopup();
      if (popup) {
        popup.setContent(popupHtml(m));
        startPopupCountdown(popup);
      }
    } else {
      const popup = marker.getPopup();
      if (popup) popup.setContent(popupHtml(m));
    }
  }

  // ===== Countdown in popup (не ламається при setContent) =====

  function startPopupCountdown(popup) {
    stopPopupCountdown(popup);

    const tick = () => {
      const root = popup.getElement?.();
      if (!root) return;

      const remEl = root.querySelector(".popup-remaining");
      if (!remEl) return;

      const id = remEl.getAttribute("data-id");
      if (!id) return;

      const left = timeLeftMs(id);
      if (left <= 0) {
        stopPopupCountdown(popup);
        const m = dataById.get(id);
        if (m) updateMarkerVisual(m);
        return;
      }

      remEl.textContent = `Залишилось: ${formatLeft(left)}`;
    };

    tick();
    popup._decorInterval = setInterval(tick, 1000);
  }

  function stopPopupCountdown(popup) {
    const t = popup?._decorInterval;
    if (t) clearInterval(t);
    if (popup) popup._decorInterval = null;
  }

  // ===== Right-side drawer list =====

  let drawerTick = null;

  function setupPointsDrawer() {
    const btn = document.getElementById("pointsBtn");
    const drawer = document.getElementById("pointsDrawer");
    const closeBtn = document.getElementById("pointsClose");
    const listEl = document.getElementById("pointsList");

    if (!btn || !drawer || !listEl) return;

    const open = () => {
      drawer.hidden = false;
      btn.setAttribute("aria-expanded", "true");
      renderDrawerList();
      startDrawerTick();
    };

    const close = () => {
      drawer.hidden = true;
      btn.setAttribute("aria-expanded", "false");
      stopDrawerTick();
    };

    const toggle = () => (drawer.hidden ? open() : close());

    btn.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      e.stopPropagation();
      toggle();
    });

    closeBtn?.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      e.stopPropagation();
      close();
    });

    // клік поза drawer — закриває
    document.addEventListener("pointerdown", (e) => {
      if (!drawer.hidden && !drawer.contains(e.target) && e.target !== btn) close();
    });

    // кліки по елементах списку
    drawer.addEventListener("pointerdown", (e) => {
      const item = e.target.closest?.("[data-action='focus']");
      if (!item) return;

      e.preventDefault();
      e.stopPropagation();

      const id = item.getAttribute("data-id");
      if (!id) return;

      close();
      focusOnMarker(id);
    });

    function renderDrawerList() {
      // trees first, then others
      const sorted = [...markers].sort((a, b) => {
        const at = String(a?.type || "tree") === "tree" ? 0 : 1;
        const bt = String(b?.type || "tree") === "tree" ? 0 : 1;
        if (at !== bt) return at - bt;

        const an = treeNoById.get(a.id) || 999999;
        const bn = treeNoById.get(b.id) || 999999;
        return an - bn;
      });

      listEl.innerHTML = sorted.map(m => drawerItemHtml(m)).join("");
      updateAllDrawerRows();
    }

    function startDrawerTick() {
      stopDrawerTick();
      drawerTick = setInterval(() => {
        if (drawer.hidden) return;
        updateAllDrawerRows();
      }, 1000);
    }

    function stopDrawerTick() {
      if (drawerTick) clearInterval(drawerTick);
      drawerTick = null;
    }

    function updateAllDrawerRows() {
      const rows = listEl.querySelectorAll(".points-item[data-id]");
      rows.forEach(r => updateRow(r.getAttribute("data-id")));
    }

    function updateRow(id) {
      if (!id) return;

      const statusEl = listEl.querySelector(`.pi-status[data-id="${cssEscape(id)}"]`);
      const timeEl = listEl.querySelector(`.pi-time[data-id="${cssEscape(id)}"]`);

      if (!statusEl || !timeEl) return;

      const left = timeLeftMs(id);
      if (left > 0) {
        statusEl.textContent = "✅ Прикрашено";
        statusEl.classList.add("pi-status-ok");
        statusEl.classList.remove("pi-status-free");
        timeEl.textContent = `Залишилось: ${formatLeft(left)}`;
      } else {
        statusEl.textContent = "🟢 Доступно";
        statusEl.classList.add("pi-status-free");
        statusEl.classList.remove("pi-status-ok");
        timeEl.textContent = "";
      }
    }

    // expose for outer updates
    window.__updateDrawerRow = updateRow;
  }

  function updateDrawerRow(id) {
    const fn = window.__updateDrawerRow;
    if (typeof fn === "function") fn(id);
  }

  function drawerItemHtml(m) {
    const type = String(m?.type || "tree");
    const no = (type === "tree") ? treeNoById.get(m.id) : null;

    const titleBase = escapeHtml(m.name || "Мітка");
    const title = no ? `#${no} ${titleBase}` : `${type === "tree" ? "🌲" : "📍"} ${titleBase}`;

    return `
      <button class="points-item" type="button" data-action="focus" data-id="${m.id}">
        <div class="pi-top">
          <div>${title}</div>
        </div>
        <div class="pi-sub">
          <span class="pi-status pi-status-free" data-id="${m.id}"></span>
          <span class="pi-time" data-id="${m.id}"></span>
        </div>
      </button>
    `;
  }

  function focusOnMarker(id) {
    const m = dataById.get(id);
    if (!m) return;

    const ll = Z.xyToLatLng(map, m.x, m.y);

    const maxZ = map.getMaxZoom();
    const targetZ = Math.min(maxZ, (S.tilesMaxZoom ?? 6) + 2);

    map.flyTo(ll, targetZ, { duration: 0.6 });

    const marker = markerById.get(id);
    if (marker) {
      marker.setPopupContent(popupHtml(m));
      marker.openPopup();
    }
  }

  // ===== utils =====

  function formatLeft(ms) {
    ms = Math.max(0, ms);
    const totalSec = Math.floor(ms / 1000);
    const h = Math.floor(totalSec / 3600);
    const mm = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    const pad = (n) => String(n).padStart(2, "0");
    return `${pad(h)}:${pad(mm)}:${pad(s)}`;
  }

  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
    );
  }

  function cssEscape(v) {
    // мінімальний escape для атрибутного селектора
    return String(v).replace(/"/g, '\\"');
  }

  // ===== cookies (compact) =====
  // формат: id,expSec|id,expSec|...
  function loadDecorState() {
    const raw = getCookie(COOKIE_NAME);
    const map = new Map();
    if (!raw) return map;

    const decoded = safeDecode(raw);
    if (!decoded) return map;

    for (const part of decoded.split("|")) {
      const [id, expSec] = part.split(",");
      if (!id || !expSec) continue;

      const expMs = Number(expSec) * 1000;
      if (Number.isFinite(expMs)) map.set(id, expMs);
    }
    return map;
  }

  function saveDecorState(map) {
    const now = Date.now();
    const parts = [];
    for (const [id, expMs] of map.entries()) {
      if (expMs > now) parts.push(`${id},${Math.floor(expMs / 1000)}`);
    }
    setCookie(COOKIE_NAME, encodeURIComponent(parts.join("|")), 365);
  }

  function getCookie(name) {
    const m = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
    return m ? m[1] : "";
  }

  function setCookie(name, value, days) {
    const exp = new Date(Date.now() + days * 864e5).toUTCString();
    document.cookie = `${name}=${value}; Expires=${exp}; Path=/; SameSite=Lax`;
  }

  function safeDecode(v) {
    try { return decodeURIComponent(v); } catch { return ""; }
  }
})();
