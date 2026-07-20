/* HMB Consent-Manager (HMB-K6-CONSENT) — minimaler Klaro-artiger Cookie-Banner.
 *
 * Aktiviert die consent-gegateten Scripts (``<script type="text/plain"
 * data-name="...">``) erst nach Opt-in der jeweiligen Kategorie:
 *   - Kategorie "map"   → data-name googleMaps      (Google Maps JS API)
 *   - Kategorie "stats" → data-name googleAnalytics, googleTagManager (GA4/GTM)
 * Persistiert die Wahl im Cookie (Name aus #hmb-consent[data-cookie-name],
 * z.B. hmb_consent / hmb_consent_test), 365 Tage. Widerruf via
 * window.hmbConsentOpen(). DE/EN nach <html lang>.
 */
(function () {
	"use strict";

	var CATS = {
		map:   ["googleMaps"],
		stats: ["googleAnalytics", "googleTagManager"],
	};

	var LANG = (document.documentElement.lang || "de").slice(0, 2) === "en" ? "en" : "de";
	var T = {
		de: {
			text: "Wir verwenden Cookies und externe Dienste, um die Standort-Karte (Google Maps) anzuzeigen und die Nutzung anonym zu messen (Statistik). Du entscheidest, was geladen wird.",
			map: "Karte (Google Maps)", stats: "Statistik (Google Analytics)",
			accept: "Alle akzeptieren", decline: "Nur notwendige", settings: "Einstellungen",
			save: "Auswahl speichern", revoke: "Cookie-Einstellungen",
		},
		en: {
			text: "We use cookies and external services to show the locations map (Google Maps) and to measure usage anonymously (statistics). You decide what loads.",
			map: "Map (Google Maps)", stats: "Statistics (Google Analytics)",
			accept: "Accept all", decline: "Only necessary", settings: "Settings",
			save: "Save selection", revoke: "Cookie settings",
		},
	}[LANG];

	var mount = document.getElementById("hmb-consent");
	var cookieName = (mount && mount.getAttribute("data-cookie-name")) || "hmb_consent";

	function readConsent() {
		var m = document.cookie.match(new RegExp("(?:^|; )" + cookieName + "=([^;]*)"));
		if (!m) return null;
		try { return JSON.parse(decodeURIComponent(m[1])); } catch (_) { return null; }
	}
	function writeConsent(state) {
		var val = encodeURIComponent(JSON.stringify(state));
		var exp = new Date(); exp.setFullYear(exp.getFullYear() + 1);
		document.cookie = cookieName + "=" + val + ";path=/;expires=" + exp.toUTCString() + ";SameSite=Lax";
	}

	var activated = {};
	function activateCategory(cat) {
		if (activated[cat]) return;
		activated[cat] = true;
		(CATS[cat] || []).forEach(function (name) {
			var nodes = document.querySelectorAll('script[type="text/plain"][data-name="' + name + '"]');
			nodes.forEach(function (old) {
				var s = document.createElement("script");
				if (old.src) s.src = old.src; else s.textContent = old.textContent;
				// type weglassen → wird als JS ausgeführt
				old.parentNode.insertBefore(s, old.nextSibling);
			});
		});
	}

	function apply(state) {
		Object.keys(CATS).forEach(function (cat) { if (state && state[cat]) activateCategory(cat); });
	}

	function hide() { if (mount) { mount.hidden = true; mount.innerHTML = ""; } }

	function render(current) {
		if (!mount) return;
		current = current || { map: true, stats: true };
		mount.hidden = false;
		mount.className = "hmb-consent-bar";
		mount.setAttribute("role", "dialog");
		mount.setAttribute("aria-label", T.revoke);
		mount.innerHTML =
			'<div class="hmb-consent-inner">'
			+ '<p class="hmb-consent-text">' + T.text + '</p>'
			+ '<div class="hmb-consent-cats" hidden>'
			+   '<label><input type="checkbox" data-cat="map"' + (current.map ? " checked" : "") + '> ' + T.map + '</label>'
			+   '<label><input type="checkbox" data-cat="stats"' + (current.stats ? " checked" : "") + '> ' + T.stats + '</label>'
			+ '</div>'
			+ '<div class="hmb-consent-actions">'
			+   '<button type="button" class="btn btn-primary" data-act="accept">' + T.accept + '</button>'
			+   '<button type="button" class="btn btn-ghost" data-act="decline">' + T.decline + '</button>'
			+   '<button type="button" class="btn btn-ghost" data-act="settings">' + T.settings + '</button>'
			+   '<button type="button" class="btn btn-primary" data-act="save" hidden>' + T.save + '</button>'
			+ '</div></div>';

		mount.querySelector('[data-act="accept"]').onclick = function () { decide({ map: true, stats: true }); };
		mount.querySelector('[data-act="decline"]').onclick = function () { decide({ map: false, stats: false }); };
		mount.querySelector('[data-act="settings"]').onclick = function () {
			mount.querySelector(".hmb-consent-cats").hidden = false;
			mount.querySelector('[data-act="save"]').hidden = false;
		};
		mount.querySelector('[data-act="save"]').onclick = function () {
			decide({
				map: mount.querySelector('[data-cat="map"]').checked,
				stats: mount.querySelector('[data-cat="stats"]').checked,
			});
		};
	}

	function decide(state) {
		state.v = 1;
		writeConsent(state);
		apply(state);          // aktiviert neu opted-in Kategorien sofort
		hide();
	}

	// Widerruf / Einstellungen erneut öffnen (z.B. Footer-Link).
	window.hmbConsentOpen = function () { render(readConsent() || { map: true, stats: true }); };

	// WS-HMB-MAP-CONSENT-CTA: eine Kategorie programmatisch akzeptieren (z.B. die
	// Karten-CTA „Karte aktivieren"). Merged in die bestehende Wahl, persistiert,
	// aktiviert das zugehörige Script SOFORT (kein Reload) → googleMaps lädt →
	// callback hmbInitMap. Banner (falls offen) wird geschlossen.
	window.hmbConsentAccept = function (cat) {
		var s = readConsent() || {};
		s[cat] = true; s.v = 1;
		writeConsent(s);
		apply(s);
		hide();
	};
	// Ist eine Kategorie bereits erteilt? (für die CTA-Sichtbarkeit)
	window.hmbConsentHas = function (cat) {
		var s = readConsent();
		return !!(s && s[cat]);
	};

	function init() {
		var saved = readConsent();
		if (saved) { apply(saved); }   // schon entschieden → still aktivieren, kein Banner
		else { render(); }             // erstmals → Banner zeigen
	}

	if (document.readyState === "loading") {
		document.addEventListener("DOMContentLoaded", init);
	} else {
		init();
	}
})();
