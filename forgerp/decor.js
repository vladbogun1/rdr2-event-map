"use strict";

(function (w) {
  class DecorStore {
    constructor({ cookieName, cooldownMs }) {
      this.cookieName = cookieName;
      this.cooldownMs = cooldownMs;
      this.map = this._load();
    }

    isDecorated(id) {
      const exp = this.map.get(id);
      return typeof exp === "number" && exp > Date.now();
    }

    timeLeftMs(id) {
      const exp = this.map.get(id) || 0;
      return exp - Date.now();
    }

    decorate(id) {
      this.map.set(id, Date.now() + this.cooldownMs);
      this._save();
    }

    cleanupExpired() {
      const now = Date.now();
      let changed = false;
      for (const [id, exp] of this.map.entries()) {
        if (!exp || exp <= now) {
          this.map.delete(id);
          changed = true;
        }
      }
      if (changed) this._save();
      return changed;
    }

    reset() {
      this.map.clear();
      this._deleteCookie();
    }

    _load() {
      const raw = this._getCookie(this.cookieName);
      const map = new Map();
      if (!raw) return map;

      let decoded = "";
      try { decoded = decodeURIComponent(raw); } catch { decoded = ""; }
      if (!decoded) return map;

      for (const part of decoded.split("|")) {
        const [id, expSec] = part.split(",");
        if (!id || !expSec) continue;
        const expMs = Number(expSec) * 1000;
        if (Number.isFinite(expMs)) map.set(id, expMs);
      }
      return map;
    }

    _save() {
      const now = Date.now();
      const parts = [];
      for (const [id, expMs] of this.map.entries()) {
        if (expMs > now) parts.push(`${id},${Math.floor(expMs / 1000)}`);
      }
      this._setCookie(this.cookieName, encodeURIComponent(parts.join("|")), 365);
    }

    _getCookie(name) {
      const m = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
      return m ? m[1] : "";
    }

    _setCookie(name, value, days) {
      const exp = new Date(Date.now() + days * 864e5).toUTCString();
      document.cookie = `${name}=${value}; Expires=${exp}; Path=/; SameSite=Lax`;
    }

    _deleteCookie() {
      document.cookie = `${this.cookieName}=; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Path=/; SameSite=Lax`;
    }
  }

  class ExpiryScheduler {
    constructor(store, onExpire) {
      this.store = store;
      this.onExpire = onExpire;
      this.timers = new Map();
    }

    schedule(id) {
      this.clear(id);

      const left = this.store.timeLeftMs(id);
      if (left <= 0) {
        this.onExpire?.(id);
        return;
      }

      const t = setTimeout(() => {
        this.clear(id);
        this.onExpire?.(id);
      }, left + 50);

      this.timers.set(id, t);
    }

    scheduleAll(ids) {
      for (const id of ids) this.schedule(id);
    }

    clear(id) {
      const t = this.timers.get(id);
      if (t) clearTimeout(t);
      this.timers.delete(id);
    }

    clearAll() {
      for (const id of this.timers.keys()) this.clear(id);
    }
  }

  w.ForgeRP = w.ForgeRP || {};
  w.ForgeRP.DecorStore = DecorStore;
  w.ForgeRP.ExpiryScheduler = ExpiryScheduler;
})(window);
