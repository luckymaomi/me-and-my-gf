(function () {
  "use strict";

  var map = null;
  var marker = null;
  var accuracyCircle = null;
  var watchId = null;
  var lastLat = null;
  var lastLng = null;
  var lastAddress = "";
  var geoTimer = null;
  var geoSeq = 0;
  var lastGeoAt = 0;

  var els = {
    status: document.getElementById("status"),
    btnCopy: document.getElementById("btnCopy"),
    meta: document.getElementById("meta"),
    metaAddr: document.getElementById("metaAddr"),
    metaLat: document.getElementById("metaLat"),
    metaLng: document.getElementById("metaLng"),
    metaAcc: document.getElementById("metaAcc"),
    metaAlt: document.getElementById("metaAlt"),
    metaMove: document.getElementById("metaMove"),
  };

  function setStatus(text, kind) {
    els.status.textContent = text;
    els.status.classList.remove("is-error", "is-ok");
    if (kind) els.status.classList.add(kind);
  }

  function initMap() {
    map = L.map("map", {
      zoomControl: true,
      attributionControl: true,
    }).setView([35.0, 105.0], 4);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map);

    setTimeout(function () {
      map.invalidateSize();
    }, 80);
  }

  function copyText() {
    if (lastLat == null || lastLng == null) return "";
    var lines = [
      "纬度：" + lastLat.toFixed(6),
      "经度：" + lastLng.toFixed(6),
    ];
    if (lastAddress) lines.push(lastAddress);
    return lines.join("\n");
  }

  function scheduleReverse(lat, lng) {
    if (geoTimer) window.clearTimeout(geoTimer);
    geoTimer = window.setTimeout(function () {
      void reverseGeocode(lat, lng);
    }, 700);
  }

  async function reverseGeocode(lat, lng) {
    var wait = Math.max(0, 1100 - (Date.now() - lastGeoAt));
    if (wait) await new Promise(function (r) { window.setTimeout(r, wait); });

    var seq = ++geoSeq;
    els.metaAddr.textContent = "查地址…";
    try {
      var url =
        "https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=" +
        encodeURIComponent(lat) +
        "&lon=" +
        encodeURIComponent(lng) +
        "&zoom=18&addressdetails=1&accept-language=zh-CN";
      var res = await fetch(url, {
        headers: {
          Accept: "application/json",
        },
      });
      lastGeoAt = Date.now();
      if (seq !== geoSeq) return;
      if (!res.ok) throw new Error("地址查询失败");
      var data = await res.json();
      // 原样使用 Nominatim 返回的 display_name，不做重排/拼接
      lastAddress = String((data && data.display_name) || "").trim();
      els.metaAddr.textContent = lastAddress || "无地址";
      els.btnCopy.disabled = false;
    } catch (e) {
      if (seq !== geoSeq) return;
      lastAddress = "";
      els.metaAddr.textContent = "地址未取到";
      els.btnCopy.disabled = false;
    }
  }

  function applyFix(fix) {
    var c = fix.coords;
    var lat = c.latitude;
    var lng = c.longitude;
    var acc = c.accuracy;

    lastLat = lat;
    lastLng = lng;

    els.meta.hidden = false;
    els.metaLat.textContent = lat.toFixed(6);
    els.metaLng.textContent = lng.toFixed(6);
    els.metaAcc.textContent = acc != null ? "±" + Math.round(acc) + " m" : "—";
    els.metaAlt.textContent =
      c.altitude != null && !Number.isNaN(c.altitude)
        ? Math.round(c.altitude) + " m" + (c.altitudeAccuracy != null ? "（±" + Math.round(c.altitudeAccuracy) + "）" : "")
        : "—";
    var moveBits = [];
    if (c.heading != null && !Number.isNaN(c.heading)) moveBits.push(Math.round(c.heading) + "°");
    if (c.speed != null && !Number.isNaN(c.speed)) moveBits.push((c.speed * 3.6).toFixed(1) + " km/h");
    els.metaMove.textContent = moveBits.length ? moveBits.join(" · ") : "—";
    els.btnCopy.disabled = false;

    var zoom = acc != null && acc < 50 ? 17 : acc != null && acc < 200 ? 15 : 13;
    map.setView([lat, lng], Math.max(map.getZoom(), zoom));

    if (!marker) {
      marker = L.marker([lat, lng]).addTo(map);
    } else {
      marker.setLatLng([lat, lng]);
    }

    if (accuracyCircle) {
      accuracyCircle.setLatLng([lat, lng]);
      accuracyCircle.setRadius(acc || 0);
    } else if (acc != null) {
      accuracyCircle = L.circle([lat, lng], {
        radius: acc,
        color: "#38bdf8",
        weight: 2,
        fillColor: "#38bdf8",
        fillOpacity: 0.12,
      }).addTo(map);
    }

    setStatus("跟踪中 · ±" + (acc != null ? Math.round(acc) : "?") + " m", "is-ok");
    scheduleReverse(lat, lng);
  }

  function onError(err) {
    var msg = "定位失败";
    if (err && err.code === 1) msg = "未允许位置权限";
    else if (err && err.code === 2) msg = "暂时无法获取位置";
    else if (err && err.code === 3) msg = "定位超时";
    else if (err && err.message) msg = err.message;
    setStatus(msg, "is-error");
  }

  function startWatch() {
    if (!navigator.geolocation) {
      setStatus("浏览器不支持定位", "is-error");
      return;
    }
    if (watchId != null) return;
    setStatus("定位中…");
    watchId = navigator.geolocation.watchPosition(applyFix, onError, {
      enableHighAccuracy: true,
      timeout: 20000,
      maximumAge: 0,
    });
  }

  function stopWatch() {
    if (watchId != null && navigator.geolocation) {
      navigator.geolocation.clearWatch(watchId);
      watchId = null;
    }
  }

  async function onCopy() {
    var text = copyText();
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setStatus("已复制", "is-ok");
    } catch (e) {
      setStatus("复制失败", "is-error");
    }
  }

  function bindThemeToggle() {
    var btn = document.querySelector("[data-theme-toggle]");
    if (!btn || !window.ThemeController) return;
    function sync() {
      var dark = document.documentElement.dataset.theme === "dark";
      btn.setAttribute("aria-pressed", dark ? "true" : "false");
      btn.setAttribute("aria-label", dark ? "切换到日间模式" : "切换到暗夜模式");
      btn.title = btn.getAttribute("aria-label");
    }
    sync();
    btn.addEventListener("click", function () {
      window.ThemeController.toggleTheme();
      sync();
      if (map) setTimeout(function () { map.invalidateSize(); }, 50);
    });
    window.addEventListener("me-and-my-gf:themechange", sync);
  }

  initMap();
  bindThemeToggle();
  els.btnCopy.addEventListener("click", function () {
    void onCopy();
  });
  startWatch();
  window.addEventListener("beforeunload", stopWatch);
  document.addEventListener("visibilitychange", function () {
    if (document.hidden) return;
    if (map) map.invalidateSize();
  });
})();
