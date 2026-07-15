/* HMB Standort-Finder (WS-HMB-STANDORT-BUILD H4) — rein client-seitig,
 * GitHub-Pages-tauglich. Datenquelle: inline #hmb-locations (JSON).
 *
 * - Filter-Chips (alle/online/onsite) → Liste.
 * - Textsuche „Ort/Stadt" → EIN google.maps.Geocoder-Call beim Absenden
 *   (inhärent consent-gegated: der Geocoder existiert erst, wenn die Maps-JS
 *   nach Consent geladen ist). Ohne Consent/Maps → Hinweis; Geolocation geht
 *   trotzdem.
 * - „In meiner Nähe" → Browser-Geolocation.
 * - Distanz per Haversine, Sortierung OHNE Radius-Deckel, Gruppen „<50 km /
 *   weiter". Load-More (Anzeige inkrementell, Suche über alle).
 * - Karten-Marker-Klick + Karten-Card-Klick füttern dasselbe Side-Panel
 *   (window.hmbSelectLocation), Karte zentriert via window.hmbPanTo.
 */
(function () {
	"use strict";

	// WS-HMB-HOME-SEARCH: Home-Such-CTA. Die Startseite hat KEINE Finder-Daten und
	// lädt KEIN Google-Maps — das Formular navigiert nur zur Standorte-Seite mit
	// ?q=, wo der Finder (unten) die Suche übernimmt. Läuft VOR dem Early-Return,
	// weil die Home die #hmb-locations/#locList-Elemente nicht hat.
	var _homeSearch = document.getElementById("hmb-home-search");
	if (_homeSearch) {
		_homeSearch.addEventListener("submit", function (e) {
			e.preventDefault();
			var inp = document.getElementById("hmb-home-search-input");
			var q = (inp && inp.value || "").trim();
			var en = location.pathname.indexOf("/en/") === 0;
			var base = en ? "/en/locations/" : "/standorte/";
			window.location.href = q ? (base + "?q=" + encodeURIComponent(q)) : base;
		});
	}

	var dataEl = document.getElementById("hmb-locations");
	var listEl = document.getElementById("locList");
	if (!dataEl || !listEl) return;   // keine Übersichtsseite

	var LOCS = [];
	try { LOCS = JSON.parse(dataEl.textContent || "[]"); } catch (_) { LOCS = []; }

	var EN = location.pathname.indexOf("/en/") === 0;
	var T = EN ? {
		near: "Nearby (< 50 km)", far: "Farther away", count: "locations",
		more: "Show more", geo_wait: "Locating…", geo_fail: "Location unavailable.",
		geo_hint: "Enable the map (accept cookies) to search by place name.",
		no_hits: "No locations match.", detail: "/en/location/",
		to_loc: "View details", book: "Book now",
		online: "Book online", onsite: "Book on-site",
		zoom_hint: "Zoom in further to see locations.",
		city_less: "− show fewer",
	} : {
		near: "In der Nähe (< 50 km)", far: "Weiter entfernt", count: "Standorte",
		more: "Weitere anzeigen", geo_wait: "Orte…", geo_fail: "Standort nicht verfügbar.",
		geo_hint: "Aktiviere die Karte (Cookies akzeptieren), um nach Ort zu suchen.",
		no_hits: "Keine Standorte gefunden.", detail: "/standort/",
		to_loc: "Details ansehen", book: "Jetzt buchen",
		// WS-HMB-DISPLAY-HYGIENE: DE-Keys ergänzt — fehlten → Badges zeigten „undefined".
		online: "Online buchbar", onsite: "Vor Ort buchbar",
		zoom_hint: "Zoomen Sie weiter rein, um Standorte zu sehen.",
		city_less: "− weniger",
	};

	// WS-HMB-FINDER-20: Liste folgt dem Karten-Ausschnitt (map idle → bounds).
	var state = { filter: "all", origin: null, bounds: null };
	var BOUNDS_LIMIT = 20;

	function esc(s) {
		return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
			return { "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[c];
		});
	}

	function haversine(a, b) {
		var R = 6371, toRad = Math.PI / 180;
		var dLat = (b.lat - a.lat) * toRad, dLng = (b.lng - a.lng) * toRad;
		var la1 = a.lat * toRad, la2 = b.lat * toRad;
		var h = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;
		return 2 * R * Math.asin(Math.sqrt(h));
	}

	function matchesFilter(loc) {
		if (state.filter === "online") return !!loc.online;
		if (state.filter === "onsite") return !!loc.onsite;
		return true;
	}

	function badges(loc) {
		var h = "";
		if (loc.online) h += '<span class="badge badge-online">🔒 ' + T.online + "</span>";
		if (loc.onsite) h += '<span class="badge badge-onsite">📱 ' + T.onsite + "</span>";
		return h;
	}

	function computed() {
		var items = LOCS.filter(matchesFilter);
		if (state.origin) {
			items.forEach(function (l) {
				l._dist = (l.lat != null && l.lng != null)
					? haversine(state.origin, { lat: l.lat, lng: l.lng }) : Infinity;
			});
			items.sort(function (a, b) { return (a._dist) - (b._dist); });
		} else {
			items.forEach(function (l) { l._dist = null; });
		}
		return items;
	}

	function card(loc) {
		var dist = (loc._dist != null && isFinite(loc._dist))
			? '<span class="dist-tag' + (loc._dist < 50 ? " near" : "") + '">' + Math.round(loc._dist) + " km</span>" : "";
		var colorCls = loc.online ? " hmb-card-online" : " hmb-card-onsite";
		var b = badges(loc);
		return '<li class="loc-card' + colorCls + '" data-slug="' + esc(loc.slug) + '">'
			+ dist
			+ '<h4><a href="' + T.detail + encodeURIComponent(loc.slug) + '/">' + esc(loc.title) + "</a></h4>"
			+ (loc.city ? '<p class="lc-city">' + esc((loc.zip ? loc.zip + " " : "") + loc.city) + "</p>" : "")
			+ (b ? '<div class="badges">' + b + "</div>" : "") + "</li>";
	}

	// WS-HMB-FINDER-20: liegt der Standort im aktuellen Karten-Ausschnitt?
	// Ohne aktive bounds (Karte noch nicht/ohne Consent geladen) zählt alles.
	function inBounds(loc) {
		var b = state.bounds;
		if (!b) return true;
		if (loc.lat == null || loc.lng == null) return false;
		return loc.lat <= b.north && loc.lat >= b.south && loc.lng <= b.east && loc.lng >= b.west;
	}

	function render() {
		var view = computed().filter(inBounds);
		var count = view.length;

		var ovc = document.getElementById("ov-count");
		if (ovc) ovc.textContent = count + " " + T.count;

		// Zu viele Standorte im Ausschnitt → Liste ausblenden, Zoom-Hinweis (ersetzt
		// die alte „24 + Weitere anzeigen"-Paginierung). Greift nur bei aktiver Karte.
		if (state.bounds && count >= BOUNDS_LIMIT) {
			listEl.innerHTML = '<li class="loc-card hmb-hint">' + T.zoom_hint + "</li>";
			return;
		}
		if (!count) { listEl.innerHTML = '<li class="loc-card hmb-hint">' + T.no_hits + "</li>"; return; }

		var html = "", lastGroup = null;
		view.forEach(function (loc) {
			if (state.origin && isFinite(loc._dist)) {
				var g = loc._dist < 50 ? "near" : "far";
				if (g !== lastGroup) { html += '<li class="list-group-head">' + (g === "near" ? T.near : T.far) + "</li>"; lastGroup = g; }
			}
			html += card(loc);
		});
		listEl.innerHTML = html;
	}

	function selectLoc(slug) {
		var loc = LOCS.filter(function (l) { return l.slug === slug; })[0];
		var panel = document.getElementById("panel");
		var empty = document.getElementById("panelEmpty");
		if (!loc || !panel) return;
		if (empty) empty.style.display = "none";
		var body = panel.querySelector(".result-card") || document.createElement("div");
		body.className = "result-card is-active";
		body.innerHTML =
			(loc.image_url ? '<div class="rc-img" style="background-image:url(\'' + esc(loc.image_url) + "')\"></div>" : '<div class="rc-img"></div>')
			+ '<div class="rc-body">'
			+ "<h3>" + esc(loc.title) + "</h3>"
			+ (loc.city ? '<p class="rc-city">' + esc((loc.zip ? loc.zip + " " : "") + loc.city) + "</p>" : "")
			+ (loc.description_short ? '<p class="rc-desc">' + esc(loc.description_short) + "</p>" : "")
			+ (loc.price_text ? '<p class="rc-price">' + esc(loc.price_text) + "</p>" : "")
			+ (badges(loc) ? '<div class="badges">' + badges(loc) + "</div>" : "")
			+ '<div class="rc-actions"><a class="btn btn-primary btn-sm" href="' + T.detail + encodeURIComponent(loc.slug) + '/">' + T.to_loc + "</a>"
			+ (loc.booking_url ? '<a class="btn btn-ghost btn-sm" href="' + esc(loc.booking_url) + '" rel="noopener" target="_blank">' + T.book + "</a>" : "")
			+ "</div></div>";
		if (!body.parentNode) panel.appendChild(body);
		panel.classList.add("sheet-open");
		if (typeof window.hmbPanTo === "function") window.hmbPanTo(slug);
	}
	window.hmbSelectLocation = selectLoc;

	// WS-HMB-FINDER-20: map.js meldet bei jedem 'idle' den sichtbaren Ausschnitt.
	window.hmbFinderBounds = function (b) {
		state.bounds = (b && typeof b.north === "number") ? b : null;
		render();
	};

	function setStatus(msg) {
		var el = document.getElementById("finderStatus");
		if (el) el.textContent = msg || "";
	}

	function applyOrigin(o, label) {
		state.origin = o; render();
		var items = computed();
		if (items.length && isFinite(items[0]._dist)) {
			setStatus((label ? label + " · " : "") + Math.round(items[0]._dist) + " km");
			selectLoc(items[0].slug);   // nächsten Treffer direkt öffnen
		}
	}

	// ---- Textsuche → Geocoder (consent-gegated via Maps-JS) ----
	function runSearch() {
		var input = document.getElementById("finderInput");
		var q = (input && input.value || "").trim();
		if (!q) return;
		if (!(window.google && google.maps && google.maps.Geocoder)) {
			setStatus(T.geo_hint);
			return;
		}
		setStatus(T.geo_wait);
		new google.maps.Geocoder().geocode({ address: q }, function (res, status) {
			if (status === "OK" && res && res[0]) {
				var g = res[0].geometry.location;
				// WS-HMB-FINDER-UX: PRIMÄR die Karte auf den Ort zoomen.
				if (typeof window.hmbFitBounds === "function") {
					window.hmbFitBounds(res[0].geometry.viewport, { lat: g.lat(), lng: g.lng() });
				}
				applyOrigin({ lat: g.lat(), lng: g.lng() }, q);   // Distanz-Sortierung sekundär
			} else { setStatus(T.geo_fail); }
		});
	}

	function useMyLocation() {
		if (!navigator.geolocation) { setStatus(T.geo_fail); return; }
		setStatus(T.geo_wait);
		navigator.geolocation.getCurrentPosition(
			function (p) { applyOrigin({ lat: p.coords.latitude, lng: p.coords.longitude }, EN ? "Near me" : "In deiner Nähe"); },
			function () { setStatus(T.geo_fail); },
			{ enableHighAccuracy: false, timeout: 8000, maximumAge: 300000 }
		);
	}

	// ---- City-Quick-Chips (nur Städte mit Lockern) ----
	// WS-HMB-CITY-CHIPS: nach Anzahl Standorte je Stadt absteigend (Tiebreak
	// alphabetisch), Top CITY_CHIPS_VISIBLE als Chips + „+ N weitere"-Aufklapper
	// für den Rest — statt willkürlichem alphabetischem Abschneiden.
	var CITY_CHIPS_VISIBLE = 8;
	function renderCityChips() {
		var box = document.getElementById("cityChips");
		if (!box) return;
		var counts = {}, order = [];
		LOCS.forEach(function (l) {
			if (!l.city) return;
			if (!counts[l.city]) { counts[l.city] = 0; order.push(l.city); }
			counts[l.city]++;
		});
		order.sort(function (a, b) { return counts[b] - counts[a] || a.localeCompare(b); });
		var html = order.map(function (c, i) {
			var extra = i >= CITY_CHIPS_VISIBLE;
			return '<button type="button" data-city="' + esc(c) + '"'
				+ (extra ? ' class="city-extra" hidden' : "") + ">" + esc(c) + "</button>";
		}).join("");
		var rest = order.length - CITY_CHIPS_VISIBLE;
		if (rest > 0) {
			var moreLabel = (EN ? "+ " + rest + " more" : "+ " + rest + " weitere");
			html += '<button type="button" class="city-more" data-city-more aria-expanded="false"'
				+ ' data-more-label="' + esc(moreLabel) + '">' + esc(moreLabel) + "</button>";
		}
		box.innerHTML = html;
	}

	// ---- Wiring ----
	function wire() {
		var form = document.getElementById("finder");
		if (form) form.addEventListener("submit", function (e) { e.preventDefault(); runSearch(); });
		var geo = document.getElementById("finderGeo");
		if (geo) geo.addEventListener("click", useMyLocation);

		// WS-HMB-FINDER-UX: BEIDE Chip-Gruppen (oben + unter der Karte) synchron —
		// alle .chip[data-filter] teilen state.filter; Klick spiegelt is-active in
		// beiden Gruppen, filtert Liste + Karten-Marker.
		function applyFilter(f) {
			state.filter = f || "all";
			document.querySelectorAll(".chip[data-filter]").forEach(function (c) {
				c.classList.toggle("is-active", c.getAttribute("data-filter") === state.filter);
			});
			render();
			if (typeof window.hmbFilterMarkers === "function") window.hmbFilterMarkers(state.filter);
		}
		document.querySelectorAll(".chip[data-filter]").forEach(function (chip) {
			chip.addEventListener("click", function () { applyFilter(chip.getAttribute("data-filter")); });
		});

		var cityBox = document.getElementById("cityChips");
		if (cityBox) cityBox.addEventListener("click", function (e) {
			// „+ N weitere" / „− weniger" — restliche Städte ein-/ausblenden.
			var more = e.target.closest("[data-city-more]");
			if (more) {
				var expanded = more.getAttribute("aria-expanded") !== "true";
				more.setAttribute("aria-expanded", String(expanded));
				cityBox.querySelectorAll(".city-extra").forEach(function (ch) { ch.hidden = !expanded; });
				more.textContent = expanded ? T.city_less : more.getAttribute("data-more-label");
				return;
			}
			var b = e.target.closest("[data-city]");
			if (!b) return;
			var input = document.getElementById("finderInput");
			if (input) input.value = b.getAttribute("data-city");
			runSearch();
		});

		listEl.addEventListener("click", function (e) {
			// Klick auf Card (aber nicht auf den Detail-Link) → Panel öffnen.
			if (e.target.closest("a")) return;
			var li = e.target.closest(".loc-card");
			if (li && li.getAttribute("data-slug")) { e.preventDefault(); selectLoc(li.getAttribute("data-slug")); }
		});

		// WS-HMB-FINDER-20: „Weitere anzeigen"-Paginierung entfällt (Bounds steuern die Liste).
		var wrap = document.getElementById("loadMoreWrap");
		if (wrap) wrap.hidden = true;

		var sheetClose = document.getElementById("sheetClose");
		if (sheetClose) sheetClose.addEventListener("click", function () {
			document.getElementById("panel").classList.remove("sheet-open");
		});
	}

	renderCityChips();
	wire();
	render();

	// WS-HMB-HOME-SEARCH (C): ?q= (von der Home-Suche) übernehmen → Feld füllen +
	// suchen. Geocoding greift nur, wenn Maps geladen (consent) — sonst Hinweis.
	try {
		var _q = new URLSearchParams(location.search).get("q");
		if (_q) {
			var _fi = document.getElementById("finderInput");
			if (_fi) _fi.value = _q;
			runSearch();
		}
	} catch (_) { /* URLSearchParams evtl. nicht verfügbar → ignorieren */ }
})();
