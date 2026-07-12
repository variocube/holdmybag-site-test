/* HMB Mobile-Navigation (WS-HMB-MOBILE-NAV).
 * Toggelt das ausklappbare Menue (#site-nav .is-open) und haelt
 * aria-expanded synchron. Ersetzt den fruehreren inline-onclick (der unter
 * der Site-CSP ``script-src 'self'`` blockiert war → in der Vorschau tot).
 * Extras: Escape schliesst, Klick ausserhalb schliesst, Link-Klick schliesst.
 */
(function () {
	"use strict";

	function init() {
		var btn = document.querySelector(".nav-toggle");
		var nav = document.getElementById("site-nav");
		if (!btn || !nav) return;

		function setOpen(open) {
			nav.classList.toggle("is-open", open);
			btn.setAttribute("aria-expanded", open ? "true" : "false");
		}
		function isOpen() { return nav.classList.contains("is-open"); }

		btn.addEventListener("click", function (e) {
			e.stopPropagation();
			setOpen(!isOpen());
		});

		// Klick ausserhalb → schliessen
		document.addEventListener("click", function (e) {
			if (isOpen() && !nav.contains(e.target) && e.target !== btn) setOpen(false);
		});

		// Escape → schliessen (Fokus zurueck auf den Button)
		document.addEventListener("keydown", function (e) {
			if (e.key === "Escape" && isOpen()) { setOpen(false); btn.focus(); }
		});

		// Auf einen Menuepunkt getippt → schliessen
		nav.addEventListener("click", function (e) {
			if (e.target.closest("a")) setOpen(false);
		});
	}

	if (document.readyState === "loading") {
		document.addEventListener("DOMContentLoaded", init);
	} else {
		init();
	}
})();
