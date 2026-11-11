/* HMB Consent-Manager (HMB-K6-CONSENT, E-348 Variante D) — Cookie-Dialog und Karten-Platzhalter.
 *
 * Aktiviert die consent-gegateten Scripts (``<script type="text/plain"
 * data-name="...">``) erst nach Opt-in der jeweiligen Kategorie:
 *   - Kategorie "map"   → data-name googleMaps      (Google Maps JS API)
 *   - Kategorie "stats" → data-name googleAnalytics, googleTagManager (GA4/GTM)
 * Persistiert die Wahl im Cookie (Name aus #hmb-consent[data-cookie-name],
 * z.B. hmb_consent / hmb_consent_test), 365 Tage. DE/EN nach <html lang>.
 *
 * E-348 Variante D (Mock requirements-md/hmb/mock_cookie_banner_v1.1.html):
 *  - Erstbesuch: Dialog mitten auf der Seite, Seite abgedunkelt und gesperrt (``inert``)
 *    bis zur Entscheidung; „Zustimmen und weiter“ groß, „Nur notwendige Cookies“ und
 *    „Einstellungen“ als kleine Textlinks. Escape schließt NICHT; Tab bleibt im Dialog.
 *    Ausnahme: ``#hmb-consent[data-modal="0"]`` (Rechtsseiten: Impressum, Datenschutz,
 *    AGB, Cookie-Richtlinie) — dort sperrt der Dialog die Seite nicht, damit die Texte
 *    lesbar bleiben.
 *  - Karte: solange die Kategorie "map" nicht erteilt ist, zeigt JEDE Karte (``#hmb-map``)
 *    einen Platzhalter „Karte aktivieren und zustimmen“ mit Google-Hinweis; Klick setzt nur
 *    die Zustimmung „Karte“ und lädt die Karte sofort (kein Reload).
 *  - Öffentliche API: hmbConsentOpen(), hmbConsentAccept(cat), hmbConsentHas(cat);
 *    Ereignis ``hmb:consent-change`` (detail = Zustand) bei jeder Entscheidung.
 */
(function () {
	"use strict";

	var CATS = {
		map:   ["googleMaps"],
		stats: ["googleAnalytics", "googleTagManager"],
	};

	var LANG = (document.documentElement.lang || "de").slice(0, 2) === "en" ? "en" : "de";
	// Texte wie im Mock v1.1 (Variante D), DE + EN.
	var T = {
		de: {
			title: "Willkommen bei holdmybag",
			text: "Mit Deiner Zustimmung zeigen wir Dir die Standorte auf der Karte (Google Maps) und messen anonym, welche Seiten hilfreich sind. Dabei werden Daten an Google übertragen. Du kannst Deine Wahl jederzeit unter „Cookie-Einstellungen“ ändern.",
			accept: "Zustimmen und weiter", decline: "Nur notwendige Cookies",
			settings: "Einstellungen", save: "Auswahl speichern", revoke: "Cookie-Einstellungen",
			map: "Karte (Google Maps)", mapSub: "Daten gehen an Google, Cookies möglich",
			stats: "Statistik (Google Analytics)", statsSub: "misst anonym die Nutzung",
			mapText: "Die Karte kommt von Google Maps. Mit dem Klick stimmst Du den Cookies für die Karte zu, dabei werden Daten (z. B. Deine IP-Adresse) an Google übertragen.",
			mapBtn: "Karte aktivieren und zustimmen",
			priv: "Mehr in der Datenschutzerklärung", privHref: "/datenschutz/",
		},
		en: {
			title: "Welcome to holdmybag",
			text: "With your consent we show you the locations on a map (Google Maps) and measure anonymously which pages are useful. Data is sent to Google in the process. You can change your choice at any time under “Cookie settings”.",
			accept: "Agree and continue", decline: "Only necessary cookies",
			settings: "Settings", save: "Save selection", revoke: "Cookie settings",
			map: "Map (Google Maps)", mapSub: "data goes to Google, cookies possible",
			stats: "Statistics (Google Analytics)", statsSub: "measures usage anonymously",
			mapText: "The map is provided by Google Maps. By clicking you agree to the cookies for the map; data (e.g. your IP address) is sent to Google.",
			mapBtn: "Activate map and agree",
			priv: "More in the privacy policy", privHref: "/en/privacy/",
		},
	}[LANG];

	var mount = document.getElementById("hmb-consent");
	var cookieName = (mount && mount.getAttribute("data-cookie-name")) || "hmb_consent";
	// Rechtsseiten (data-modal="0"): Dialog sperrt die Seite nicht.
	var modal = !(mount && mount.getAttribute("data-modal") === "0");

	function esc(s) {
		return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;" }[c]; });
	}

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
	function has(cat) {
		var s = readConsent();
		return !!(s && s[cat]);
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

	// ---- Karten-Platzhalter an jeder Karte (#hmb-map) -------------------------------------
	function updateMapPlaceholder() {
		var el = document.getElementById("hmb-map");
		if (!el) return;
		var ph = el.querySelector(".hmb-map-ph");
		if (has("map")) {            // Zustimmung da → Platzhalter weg, die Karte lädt/ist geladen
			if (ph && ph.parentNode) ph.parentNode.removeChild(ph);
			return;
		}
		if (ph) return;
		ph = document.createElement("div");
		ph.className = "hmb-map-ph";
		ph.innerHTML = '<div class="hmb-map-ph-ic" aria-hidden="true">🗺️</div>'
			+ '<p>' + esc(T.mapText) + ' <a href="' + esc(T.privHref) + '">' + esc(T.priv) + '</a></p>'
			+ '<button type="button" class="btn btn-primary hmb-map-ph-btn">' + esc(T.mapBtn) + '</button>';
		ph.querySelector("button").addEventListener("click", function () { window.hmbConsentAccept("map"); });
		el.appendChild(ph);
	}

	function notify(state) {
		updateMapPlaceholder();
		try { document.dispatchEvent(new CustomEvent("hmb:consent-change", { detail: state })); } catch (_) { /* alte Browser */ }
	}

	// ---- Dialog -------------------------------------------------------------------------
	var inerted = [], lastFocus = null;

	function lockPage() {
		if (!modal || !mount) return;
		Array.prototype.forEach.call(document.body.children, function (el) {
			if (el === mount || el.tagName === "SCRIPT" || el.hasAttribute("inert")) return;
			el.setAttribute("inert", "");
			inerted.push(el);
		});
		document.documentElement.classList.add("hmb-consent-locked");
	}
	function unlockPage() {
		inerted.forEach(function (el) { el.removeAttribute("inert"); });
		inerted = [];
		document.documentElement.classList.remove("hmb-consent-locked");
	}

	function hide() {
		if (!mount) return;
		mount.hidden = true; mount.innerHTML = ""; mount.className = "";
		mount.removeAttribute("role"); mount.removeAttribute("aria-label");
		unlockPage();
		if (lastFocus && lastFocus.focus && document.contains(lastFocus)) { try { lastFocus.focus(); } catch (_) { /* weg */ } }
		lastFocus = null;
	}

	function focusables() {
		return Array.prototype.filter.call(mount.querySelectorAll("button, input, a[href]"), function (el) { return !el.disabled && !el.hidden; });
	}

	// Escape wird bewusst NICHT behandelt (der Dialog schließt nur durch eine Entscheidung);
	// Tab bleibt im Dialog.
	function onKeydown(e) {
		if (!modal || e.key !== "Tab") return;
		var f = focusables();
		if (!f.length) return;
		var first = f[0], last = f[f.length - 1], a = document.activeElement;
		if (e.shiftKey && (a === first || !mount.contains(a))) { e.preventDefault(); last.focus(); }
		else if (!e.shiftKey && (a === last || !mount.contains(a))) { e.preventDefault(); first.focus(); }
	}
	if (mount) mount.addEventListener("keydown", onKeydown);

	// ``showCats``: Einstellungen aufgeklappt (Karte/Statistik als Kästchen + „Auswahl speichern“).
	function render(current, showCats) {
		if (!mount) return;
		var wasOpen = !mount.hidden && mount.firstChild;
		if (!wasOpen) lastFocus = document.activeElement;
		current = current || { map: true, stats: true };
		mount.hidden = false;
		mount.className = "hmb-consent-scrim" + (modal ? "" : " hmb-consent-scrim-open");
		mount.removeAttribute("role"); mount.removeAttribute("aria-label");
		var cats = showCats
			? '<div class="hmb-consent-cats">'
			+   '<label><input type="checkbox" data-cat="map"' + (current.map ? " checked" : "") + '> <span>' + esc(T.map) + ' <span class="hmb-consent-sub">– ' + esc(T.mapSub) + '</span></span></label>'
			+   '<label><input type="checkbox" data-cat="stats"' + (current.stats ? " checked" : "") + '> <span>' + esc(T.stats) + ' <span class="hmb-consent-sub">– ' + esc(T.statsSub) + '</span></span></label>'
			+ '</div>'
			: "";
		mount.innerHTML =
			'<div class="hmb-consent-dlg" role="dialog" aria-modal="' + (modal ? "true" : "false") + '" aria-labelledby="hmb-consent-title" aria-describedby="hmb-consent-desc">'
			+ '<h2 id="hmb-consent-title">' + esc(T.title) + '</h2>'
			+ '<p id="hmb-consent-desc" class="hmb-consent-text">' + esc(T.text) + '</p>'
			+ cats
			+ '<div class="hmb-consent-actions">'
			+   '<button type="button" class="btn btn-primary hmb-consent-accept" data-act="accept">' + esc(T.accept) + '</button>'
			+   (showCats
				? '<button type="button" class="btn hmb-consent-save" data-act="save">' + esc(T.save) + '</button>'
				: '<button type="button" class="hmb-consent-link" data-act="decline">' + esc(T.decline) + '</button>'
				+ '<button type="button" class="hmb-consent-link" data-act="settings">' + esc(T.settings) + '</button>')
			+ '</div></div>';

		lockPage();
		var q = function (sel) { return mount.querySelector(sel); };
		q('[data-act="accept"]').onclick = function () { decide({ map: true, stats: true }); };
		if (q('[data-act="decline"]')) q('[data-act="decline"]').onclick = function () { decide({ map: false, stats: false }); };
		if (q('[data-act="settings"]')) q('[data-act="settings"]').onclick = function () { render(current, true); q('[data-cat="map"]').focus(); };
		if (q('[data-act="save"]')) q('[data-act="save"]').onclick = function () {
			decide({ map: q('[data-cat="map"]').checked, stats: q('[data-cat="stats"]').checked });
		};
		if (!wasOpen) { try { q('[data-act="accept"]').focus({ preventScroll: true }); } catch (_) { q('[data-act="accept"]').focus(); } }
	}

	function decide(state) {
		state.v = 1;
		writeConsent(state);
		apply(state);          // aktiviert neu opted-in Kategorien sofort
		hide();
		notify(state);
	}

	// Widerruf / Einstellungen erneut öffnen (Fußzeile „Cookie-Einstellungen“): Auswahl aufgeklappt.
	window.hmbConsentOpen = function () { render(readConsent() || { map: true, stats: true }, true); };

	// Eine Kategorie programmatisch akzeptieren (Karten-Platzhalter „Karte aktivieren und
	// zustimmen“). Merged in die bestehende Wahl, persistiert, aktiviert das zugehörige
	// Script SOFORT (kein Reload) → googleMaps lädt → callback hmbInitMap. Ein offener
	// Dialog wird geschlossen.
	window.hmbConsentAccept = function (cat) {
		var s = readConsent() || {};
		s[cat] = true; s.v = 1;
		writeConsent(s);
		apply(s);
		hide();
		notify(s);
	};
	// Ist eine Kategorie bereits erteilt?
	window.hmbConsentHas = has;

	function init() {
		var saved = readConsent();
		if (saved) { apply(saved); }   // schon entschieden → still aktivieren, kein Dialog
		else { render(); }             // erstmals → Dialog zeigen
		updateMapPlaceholder();        // an jeder Karte ohne Zustimmung: Platzhalter
	}

	if (document.readyState === "loading") {
		document.addEventListener("DOMContentLoaded", init);
	} else {
		init();
	}
})();
