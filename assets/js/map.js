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

	// WS-HMB-MAP-MARKERS: Marken-Pin als data-URI. online=true → Mint, sonst Lila.
	var MARKER_MINT = "#18bdc5", MARKER_PURPLE = "#693e7e";
	function pinIcon(online) {
		var color = online ? MARKER_MINT : MARKER_PURPLE;
		var svg = '<svg xmlns="http://www.w3.org/2000/svg" width="28" height="40" viewBox="0 0 28 40">'
			+ '<path d="M14 0C6.27 0 0 6.27 0 14c0 10.5 14 26 14 26s14-15.5 14-26C28 6.27 21.73 0 14 0z" '
			+ 'fill="' + color + '" stroke="#ffffff" stroke-width="2"/>'
			+ '<circle cx="14" cy="14" r="5" fill="#ffffff"/></svg>';
		return {
			url: "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(svg),
			scaledSize: new google.maps.Size(28, 40),
			anchor: new google.maps.Point(14, 40),
		};
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
			var sOnline = el.getAttribute("data-online") === "1";
			var sm = new google.maps.Marker({ position: { lat: lat, lng: lng }, map: smap, icon: pinIcon(sOnline) });
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

		var markerData = [];        // [{marker, loc}] — für den Filter (WS-HMB-FINDER-UX)
		var clusterer = null;

		function plot(locs) {
			var markers = [];
			var bounds = new google.maps.LatLngBounds();
			(locs || []).forEach(function (loc) {
				if (loc.lat == null || loc.lng == null) return;
				var pos = { lat: Number(loc.lat), lng: Number(loc.lng) };
				var m = new google.maps.Marker({ position: pos, title: loc.title || "", icon: pinIcon(loc.online === true) });
				m.addListener("click", function () {
					if (typeof window.hmbSelectLocation === "function") {
						window.hmbSelectLocation(loc.slug);
					} else {
						info.setContent(popupHtml(loc)); info.open(map, m);
					}
				});
				if (loc.slug) window.hmbMarkers[loc.slug] = m;
				markers.push(m);
				markerData.push({ marker: m, loc: loc });
				bounds.extend(pos);
			});
			if (window.markerClusterer && markerClusterer.MarkerClusterer) {
				clusterer = new markerClusterer.MarkerClusterer({ map: map, markers: markers });
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

		// WS-HMB-FINDER-UX: Filter wirkt auf die Marker (Cluster neu aufbauen).
		// mode: 'all' | 'online' | 'onsite' (online_onsite matcht beide).
		window.hmbFilterMarkers = function (mode) {
			var visible = markerData.filter(function (d) {
				if (mode === "online") return d.loc.online === true;
				if (mode === "onsite") return d.loc.onsite === true;
				return true;
			});
			if (clusterer) {
				clusterer.clearMarkers();
				clusterer.addMarkers(visible.map(function (d) { return d.marker; }));
			} else {
				markerData.forEach(function (d) { d.marker.setMap(null); });
				visible.forEach(function (d) { d.marker.setMap(map); });
			}
		};

		var inline = inlineLocations();
		if (inline) { plot(inline); return; }
		var url = el.getAttribute("data-locations-url") || "/content/locations.json";
		fetch(url).then(function (r) { return r.json(); }).then(plot).catch(function (e) {
			if (window.console) console.error("hmb-map: locations load failed", e);
		});
	};

	// WS-HMB-FINDER-UX: Karte auf ein Geocoder-Viewport (LatLngBounds) zoomen;
	// Fallback: Center + Zoom. Von finder.js im Geocoder-Callback aufgerufen.
	window.hmbFitBounds = function (viewport, center) {
		if (!window.hmbMap) return;
		if (viewport) { window.hmbMap.fitBounds(viewport); }
		else if (center) { window.hmbMap.setCenter(center); window.hmbMap.setZoom(12); }
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
