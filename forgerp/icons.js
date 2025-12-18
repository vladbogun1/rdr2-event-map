"use strict";

(function (w) {
  class MarkerIcons {
    static leafletIcon({ type, number, decorated }) {
      const t = String(type || "tree");
      const emoji = t === "tree" ? "🌲" : "📍";
      const cls = decorated ? "marker-bubble decorated" : "marker-bubble";
      const numHtml = number ? `<span class="marker-num">#${number}</span>` : "";

      return L.divIcon({
        className: "rdr2-marker",
        html: `<div class="${cls}">${emoji}${numHtml}</div>`,
        iconSize: [28, 28],
        iconAnchor: [14, 14]
      });
    }
  }

  w.ForgeRP = w.ForgeRP || {};
  w.ForgeRP.MarkerIcons = MarkerIcons;
})(window);
