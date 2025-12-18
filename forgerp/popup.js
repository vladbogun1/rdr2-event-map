"use strict";

(function (w) {
  const { escapeHtml, formatLeft } = w.ForgeRP.Utils;

  class PopupTemplate {
    constructor({ treeNoById, decorStore }) {
      this.treeNoById = treeNoById;
      this.decor = decorStore;
    }

    html(m) {
      const type = String(m?.type || "tree");
      const no = type === "tree" ? this.treeNoById.get(m.id) : null;

      const nameBase = escapeHtml(m?.name || "Мітка");
      const name = no ? `#${no} ${nameBase}` : nameBase;

      const note = m?.note ? `<div class="popup-note">${escapeHtml(m.note)}</div>` : "";
      const left = this.decor.timeLeftMs(m.id);

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
  }

  w.ForgeRP = w.ForgeRP || {};
  w.ForgeRP.PopupTemplate = PopupTemplate;
})(window);
