"use strict";

(function (w) {
  class LeafletMarkerLayer {
    constructor(map, Z, opts) {
      this.map = map;
      this.Z = Z;
      this.opts = opts || {};
      this.layer = L.layerGroup().addTo(map);
      this.markerById = new Map();
    }

    clear() {
      this.layer.clearLayers();
      this.markerById.clear();
    }

    render(list) {
      this.clear();
      for (const m of list) this.add(m);
    }

    add(m) {
      if (!m?.id) return;
      if (typeof m?.x !== "number" || typeof m?.y !== "number") return;

      const ll = this.Z.xyToLatLng(this.map, m.x, m.y);

      const marker = L.marker(ll, {
        icon: this.opts.iconFor?.(m),
        draggable: !!this.opts.draggable
      });

      if (this.opts.popupFor) marker.bindPopup(this.opts.popupFor(m));

      if (this.opts.onClick) marker.on("click", () => this.opts.onClick(m, marker));
      if (this.opts.onDragEnd) {
        marker.on("dragend", (ev) => {
          const xy = this.Z.latLngToXy(this.map, ev.target.getLatLng());
          this.opts.onDragEnd(m, xy, marker);
        });
      }

      marker.addTo(this.layer);
      this.markerById.set(m.id, marker);
    }

    get(id) {
      return this.markerById.get(id) || null;
    }

    setIcon(m) {
      const marker = this.get(m.id);
      if (!marker) return;
      marker.setIcon(this.opts.iconFor?.(m));
    }

    setPopup(m) {
      const marker = this.get(m.id);
      if (!marker || !this.opts.popupFor) return;
      marker.setPopupContent(this.opts.popupFor(m));
    }
  }

  w.ForgeRP = w.ForgeRP || {};
  w.ForgeRP.LeafletMarkerLayer = LeafletMarkerLayer;
})(window);
