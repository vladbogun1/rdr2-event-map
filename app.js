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

  // ----- refresh button -----
  const refreshBtn = document.getElementById("refreshBtn");
  if (refreshBtn) {
    refreshBtn.addEventListener("click", () => {
      const url = new URL(window.location.href);
      url.searchParams.set("v", String(Date.now()));
      window.location.replace(url.toString());
    });
  }

  // ----- Decor state (cookies): id -> expiresAtMs -----
  const decor = loadDecorState(); // Map<string, number>

  // таймери завершення (щоб іконки оновлювались навіть коли попап закритий)
  const expireTimers = new Map(); // id -> timeoutId

  // ----- markers -----
  const markers = await loadMarkers();
  const markerById = new Map();           // id -> Leaflet marker
  const dataById = new Map(markers.map(m => [m.id, m])); // id -> marker data

  renderMarkers(markers);

  cleanupAndRefresh();   // прибрати протухлі одразу
  scheduleAllExpiries(); // поставити таймери для активних

  // fallback: підчищати протухлі і оновлювати іконки раз на 30 сек
  setInterval(cleanupAndRefresh, 30_000);

  // ==========================
  // ✅ Делегований клік по кнопці в попапі
  // ==========================
  document.addEventListener("click", (ev) => {
    const btn = ev.target.closest?.("[data-action='decorate']");
    if (!btn) return;

    ev.preventDefault();
    ev.stopPropagation();

    const id = btn.getAttribute("data-id") || btn.dataset.id;
    if (!id) return;

    decorate(id);
  });

  // ==========================
  // ✅ Таймер: старт/стоп на popup open/close
  // ==========================
  map.on("popupopen", (e) => {
    startPopupCountdown(e.popup);
  });

  map.on("popupclose", (e) => {
    stopPopupCountdown(e.popup);
  });

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

  function isDecorated(id) {
    const exp = decor.get(id);
    return typeof exp === "number" && exp > Date.now();
  }

  function timeLeftMs(id) {
    const exp = decor.get(id) || 0;
    return exp - Date.now();
  }

  function decorate(id) {
    // ставимо expiresAt в майбутнє і зберігаємо у cookie
    decor.set(id, Date.now() + COOLDOWN_MS);
    saveDecorState(decor);

    // важливо: поставити/оновити таймер завершення
    scheduleExpiry(id);

    const m = dataById.get(id);
    if (m) updateMarkerVisual(m);
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
      }
    }

    if (changed) saveDecorState(decor);
  }

  // ==========================
  // ✅ Expiry scheduling (оновлює іконки без попапа)
  // ==========================
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

    // +50мс щоб не впертися в рівно 0
    const t = setTimeout(() => expireNow(id), left + 50);
    expireTimers.set(id, t);
  }

  function clearExpiry(id) {
    const t = expireTimers.get(id);
    if (t) clearTimeout(t);
    expireTimers.delete(id);
  }

  function expireNow(id) {
    // якщо вже видалено — ок
    if (!decor.has(id)) return;

    decor.delete(id);
    saveDecorState(decor);
    clearExpiry(id);

    const m = dataById.get(id);
    if (m) updateMarkerVisual(m);
  }

  function iconFor(m) {
    const decorated = isDecorated(m.id);
    const emoji = (m.type || "tree") === "tree" ? "🌲" : "📍";
    const cls = decorated ? "marker-bubble decorated" : "marker-bubble";

    return L.divIcon({
      className: "rdr2-marker",
      html: `<div class="${cls}">${emoji}</div>`,
      iconSize: [28, 28],
      iconAnchor: [14, 14]
    });
  }

  function popupHtml(m) {
    const name = escapeHtml(m.name || "Мітка");
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

    // якщо попап відкритий — оновлюємо його і перезапускаємо таймер
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

  // ==========================
  // ✅ Countdown in popup (не ламається при setContent)
  // ==========================
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
