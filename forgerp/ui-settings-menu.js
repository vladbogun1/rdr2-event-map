"use strict";

(function (w) {
  class SettingsMenu {
    constructor({ wrapId, btnId, menuId, refreshId, resetId, onRefresh, onReset }) {
      this.wrap = document.getElementById(wrapId);
      this.btn = document.getElementById(btnId);
      this.menu = document.getElementById(menuId);
      this.ddRefresh = document.getElementById(refreshId);
      this.ddReset = document.getElementById(resetId);

      this.onRefresh = onRefresh;
      this.onReset = onReset;

      if (!this.wrap || !this.btn || !this.menu) return;

      this.btn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.toggle();
      });

      document.addEventListener("click", (e) => {
        if (!this.wrap.contains(e.target)) this.close();
      });

      document.addEventListener("keydown", (e) => {
        if (e.key === "Escape") this.close();
      });

      this.ddRefresh?.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.close();
        this.onRefresh?.();
      });

      this.ddReset?.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.close();
        this.onReset?.();
      });
    }

    open() {
      this.menu.hidden = false;
      this.btn.setAttribute("aria-expanded", "true");
    }

    close() {
      this.menu.hidden = true;
      this.btn.setAttribute("aria-expanded", "false");
    }

    toggle() {
      this.menu.hidden ? this.open() : this.close();
    }
  }

  w.ForgeRP = w.ForgeRP || {};
  w.ForgeRP.SettingsMenu = SettingsMenu;
})(window);
