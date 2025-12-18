"use strict";

(function (w) {
  const Utils = {
    byId(id) {
      return document.getElementById(id);
    },

    escapeHtml(str) {
      return String(str).replace(/[&<>"']/g, (c) =>
        ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
      );
    },

    cssEscape(v) {
      return String(v).replace(/"/g, '\\"');
    },

    formatLeft(ms) {
      ms = Math.max(0, ms);
      const totalSec = Math.floor(ms / 1000);
      const h = Math.floor(totalSec / 3600);
      const mm = Math.floor((totalSec % 3600) / 60);
      const s = totalSec % 60;
      const pad = (n) => String(n).padStart(2, "0");
      return `${pad(h)}:${pad(mm)}:${pad(s)}`;
    },

    makeId() {
      return (crypto?.randomUUID?.() || `id_${Date.now()}_${Math.random().toString(16).slice(2)}`);
    },

    downloadJson(obj, filename) {
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
  };

  w.ForgeRP = w.ForgeRP || {};
  w.ForgeRP.Utils = Utils;
})(window);
