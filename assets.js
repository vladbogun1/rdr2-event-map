"use strict";

(function (w) {
  const Assets = {
    async getVersion() {
      try {
        const r = await fetch("./version.json?t=" + Date.now(), { cache: "no-store" });
        const j = await r.json();
        return j?.v || "1";
      } catch {
        return "1";
      }
    },

    applyCssVersion(v) {
      const links = document.querySelectorAll('link[rel="stylesheet"][href^="./"]');
      links.forEach((l) => {
        const u = new URL(l.getAttribute("href"), location.href);
        u.searchParams.set("v", v);
        l.href = u.toString();
      });
      try { localStorage.setItem("forgerp_asset_version", v); } catch {}
    },

    loadScript(src, v) {
      return new Promise((ok, bad) => {
        const s = document.createElement("script");
        const hasQ = src.includes("?");
        s.src = src + (hasQ ? "&" : "?") + "v=" + encodeURIComponent(v);
        s.onload = ok;
        s.onerror = bad;
        document.body.appendChild(s);
      });
    },

    async loadScripts(list, v) {
      for (const src of list) await Assets.loadScript(src, v);
    }
  };

  w.ForgeRP = w.ForgeRP || {};
  w.ForgeRP.Assets = Assets;
})(window);
