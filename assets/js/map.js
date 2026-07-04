/* HMB Standorte-Karte (HMB-MAP-GOOGLE / H4) — Google Maps JS API.
 *
 * #hmb-map: data-mode = "full" | "single".
 *  - full   → Daten bevorzugt inline aus #hmb-locations (Finder/SEO), sonst
 *             fetch(data-locations-url). Marker + MarkerClusterer. Marker-Klick
 *             ruft window.hmbSelectLocation(slug) (Side-Panel, finder.js) statt
 *             InfoWindow, falls definiert — sonst InfoWindow-Fallback.
 *  - single → ein Marker aus data-lat/lng/title (Detailseite).
 * gestureHandling:'cooperative' → Ein-Finger-Wisch scrollt die Seite, die Karte
 * reagiert erst auf Zwei-Finger/Strg (kein Scroll-Trap auf Mobile).
 * Consent-gegated + nur mit Key geladen (siehe _macros/map.html); Callback
 * window.hmbInitMap. Exponiert window.hmbMap / window.hmbMarkers (slug→Marker)
 * + Event 'hmb:map-ready' für finder.js.
 */
(function () {
	"use strict";

	function escapeHtml(s) {
		return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) {
			return { "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;" }[c];
		});
	}

	function detailBase() {
		return location.pathname.indexOf("/en/") === 0 ? "/en/location/" : "/standort/";
	}

	function popupHtml(loc) {
		var html = "<strong>" + escapeHtml(loc.title) + "</strong>";
		if (loc.city) html += "<br>" + escapeHtml(loc.city);
		if (loc.slug) {
			html += "<br><a href=\"" + detailBase() + encodeURIComponent(loc.slug) + "/\">Details</a>";
		}
		return html;
	}

	function inlineLocations() {
		var el = document.getElementById("hmb-locations");
		if (!el) return null;
		try { return JSON.parse(el.textContent || "[]"); } catch (_) { return null; }
	}

	window.hmbInitMap = function () {
		var el = document.getElementById("hmb-map");
		if (!el || !(window.google && google.maps)) return;
		var mode = el.getAttribute("data-mode");
		var common = { gestureHandling: "cooperative" };

		if (mode === "single") {
			var lat = parseFloat(el.getAttribute("data-lat"));
			var lng = parseFloat(el.getAttribute("data-lng"));
			if (isNaN(lat) || isNaN(lng)) return;
			var smap = new google.maps.Map(el, Object.assign({ center: { lat: lat, lng: lng }, zoom: 15 }, common));
			var sm = new google.maps.Marker({ position: { lat: lat, lng: lng }, map: smap });
			var title = el.getAttribute("data-title");
			if (title) {
				var iw = new google.maps.InfoWindow({ content: escapeHtml(title) });
				sm.addListener("click", function () { iw.open(smap, sm); });
			}
			return;
		}

		// full
		var map = new google.maps.Map(el, Object.assign({ center: { lat: 48.5, lng: 13.5 }, zoom: 5 }, common));
		window.hmbMap = map;
		window.hmbMarkers = {};
		var info = new google.maps.InfoWindow();

		function plot(locs) {
			var markers = [];
			var bounds = new google.maps.LatLngBounds();
			(locs || []).forEach(function (loc) {
				if (loc.lat == null || loc.lng == null) return;
				var pos = { lat: Number(loc.lat), lng: Number(loc.lng) };
				var m = new google.maps.Marker({ position: pos, title: loc.title || "" });
				m.addListener("click", function () {
					if (typeof window.hmbSelectLocation === "function") {
						window.hmbSelectLocation(loc.slug);
					} else {
						info.setContent(popupHtml(loc)); info.open(map, m);
					}
				});
				if (loc.slug) window.hmbMarkers[loc.slug] = m;
				markers.push(m);
				bounds.extend(pos);
			});
			if (window.markerClusterer && markerClusterer.MarkerClusterer) {
				new markerClusterer.MarkerClusterer({ map: map, markers: markers });
			} else {
				markers.forEach(function (m) { m.setMap(map); });
			}
			if (markers.length) {
				map.fitBounds(bounds);
				google.maps.event.addListenerOnce(map, "bounds_changed", function () {
					if (map.getZoom() > 12) map.setZoom(12);
				});
			}
			document.dispatchEvent(new CustomEvent("hmb:map-ready"));
		}

		var inline = inlineLocations();
		if (inline) { plot(inline); return; }
		var url = el.getAttribute("data-locations-url") || "/content/locations.json";
		fetch(url).then(function (r) { return r.json(); }).then(plot).catch(function (e) {
			if (window.console) console.error("hmb-map: locations load failed", e);
		});
	};

	// Von finder.js aufrufbar: Karte auf einen Standort zentrieren.
	window.hmbPanTo = function (slug) {
		var m = window.hmbMarkers && window.hmbMarkers[slug];
		if (m && window.hmbMap) {
			window.hmbMap.panTo(m.getPosition());
			if (window.hmbMap.getZoom() < 12) window.hmbMap.setZoom(13);
		}
	};
})();
