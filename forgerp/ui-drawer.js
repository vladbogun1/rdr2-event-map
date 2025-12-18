"use strict";

(function (w) {
  const { cssEscape } = w.ForgeRP.Utils;
  const { MarkerIndex } = w.ForgeRP;

  class PointsDrawer {
    constructor({ btnId, drawerId, closeId, listId, decorStore, treeNoById, onFocus }) {
      this.btn = document.getElementById(btnId);
      this.drawer = document.getElementById(drawerId);
      this.closeBtn = document.getElementById(closeId);
      this.listEl = document.getElementById(listId);

      this.decor = decorStore;
      this.treeNoById = treeNoById;
      this.onFocus = onFocus;

      this.markers = [];
      this.tick = null;

      if (!this.btn || !this.drawer || !this.listEl) return;

      this.btn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.toggle();
      });

      this.closeBtn?.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.close();
      });

      document.addEventListener("click", (e) => {
        if (!this.drawer.hidden && !this.drawer.contains(e.target) && e.target !== this.btn) this.close();
      });

      this.drawer.addEventListener("click", (e) => {
        const item = e.target.closest?.("[data-action='focus']");
        if (!item) return;

        e.preventDefault();
        e.stopPropagation();

        const id = item.getAttribute("data-id");
        if (!id) return;

        this.close();
        this.onFocus?.(id);
      });
    }

    setMarkers(markers) {
      this.markers = markers || [];
    }

    open() {
      this.drawer.hidden = false;
      this.btn.setAttribute("aria-expanded", "true");
      this.render();
      this.startTick();
    }

    close() {
      this.drawer.hidden = true;
      this.btn.setAttribute("aria-expanded", "false");
      this.stopTick();
    }

    toggle() {
      this.drawer.hidden ? this.open() : this.close();
    }

    render() {
      const sorted = MarkerIndex.sortTreesFirst(this.markers, this.treeNoById);
      this.listEl.innerHTML = sorted.map((m) => this._itemHtml(m)).join("");
      this.updateAllRows();
    }

    updateAllRows() {
      const rows = this.listEl.querySelectorAll(".points-item[data-id]");
      rows.forEach((r) => this.updateRow(r.getAttribute("data-id")));
    }

    updateRow(id) {
      if (!id) return;

      const statusEl = this.listEl.querySelector(`.pi-status[data-id="${cssEscape(id)}"]`);
      const timeEl = this.listEl.querySelector(`.pi-time[data-id="${cssEscape(id)}"]`);
      if (!statusEl || !timeEl) return;

      const left = this.decor.timeLeftMs(id);
      if (left > 0) {
        statusEl.textContent = "✅ Прикрашено";
        statusEl.classList.add("pi-status-ok");
        statusEl.classList.remove("pi-status-free");
        timeEl.textContent = `Залишилось: ${w.ForgeRP.Utils.formatLeft(left)}`;
      } else {
        statusEl.textContent = "🟢 Доступно";
        statusEl.classList.add("pi-status-free");
        statusEl.classList.remove("pi-status-ok");
        timeEl.textContent = "";
      }
    }

    startTick() {
      this.stopTick();
      this.tick = setInterval(() => {
        if (this.drawer.hidden) return;
        this.updateAllRows();
      }, 1000);
    }

    stopTick() {
      if (this.tick) clearInterval(this.tick);
      this.tick = null;
    }

    _itemHtml(m) {
      const title = MarkerIndex.titleFor(m, this.treeNoById);
      return `
        <button class="points-item" type="button" data-action="focus" data-id="${m.id}">
          <div class="pi-top"><div>${title}</div></div>
          <div class="pi-sub">
            <span class="pi-status pi-status-free" data-id="${m.id}"></span>
            <span class="pi-time" data-id="${m.id}"></span>
          </div>
        </button>
      `;
    }
  }

  w.ForgeRP = w.ForgeRP || {};
  w.ForgeRP.PointsDrawer = PointsDrawer;
})(window);
