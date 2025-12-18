"use strict";

(function (w) {
  const { formatLeft } = w.ForgeRP.Utils;

  class PopupCountdown {
    constructor(decorStore, onExpired) {
      this.decor = decorStore;
      this.onExpired = onExpired;
    }

    attach(map) {
      map.on("popupopen", (e) => this._start(e.popup));
      map.on("popupclose", (e) => this._stop(e.popup));
    }

    _start(popup) {
      this._stop(popup);

      const tick = () => {
        const root = popup.getElement?.();
        if (!root) return;

        const remEl = root.querySelector(".popup-remaining");
        if (!remEl) return;

        const id = remEl.getAttribute("data-id");
        if (!id) return;

        const left = this.decor.timeLeftMs(id);
        if (left <= 0) {
          this._stop(popup);
          this.onExpired?.(id);
          return;
        }

        remEl.textContent = `Залишилось: ${formatLeft(left)}`;
      };

      tick();
      popup._decorInterval = setInterval(tick, 1000);
    }

    _stop(popup) {
      const t = popup?._decorInterval;
      if (t) clearInterval(t);
      if (popup) popup._decorInterval = null;
    }
  }

  w.ForgeRP = w.ForgeRP || {};
  w.ForgeRP.PopupCountdown = PopupCountdown;
})(window);
