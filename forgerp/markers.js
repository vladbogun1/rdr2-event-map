"use strict";

(function (w) {
  const { escapeHtml } = w.ForgeRP.Utils;

  class MarkersApi {
    static async load(url, opts = {}) {
      try {
        const u = new URL(url, location.href);
        if (opts.cacheBust) u.searchParams.set("v", String(opts.cacheBust));
        const res = await fetch(u.toString(), { cache: "no-store" });
        if (!res.ok) return [];
        const data = await res.json();
        return Array.isArray(data) ? data : [];
      } catch {
        return [];
      }
    }
  }

  class MarkerIndex {
    static buildTreeNumbers(list) {
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

    static sortTreesFirst(list, treeNoById) {
      return [...list].sort((a, b) => {
        const at = String(a?.type || "tree") === "tree" ? 0 : 1;
        const bt = String(b?.type || "tree") === "tree" ? 0 : 1;
        if (at !== bt) return at - bt;

        const an = treeNoById.get(a.id) || 999999;
        const bn = treeNoById.get(b.id) || 999999;
        return an - bn;
      });
    }

    static titleFor(m, treeNoById) {
      const type = String(m?.type || "tree");
      const no = type === "tree" ? treeNoById.get(m.id) : null;
      const nameBase = escapeHtml(m?.name || "Мітка");
      return no ? `#${no} ${nameBase}` : `${type === "tree" ? "🌲" : "📍"} ${nameBase}`;
    }
  }

  w.ForgeRP = w.ForgeRP || {};
  w.ForgeRP.MarkersApi = MarkersApi;
  w.ForgeRP.MarkerIndex = MarkerIndex;
})(window);
