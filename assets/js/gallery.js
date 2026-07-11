/* HMB Galerie-Karussell (WS-HMB-GALLERY-DISPLAY).
 * Center/Peek-Slider auf CSS scroll-snap; JS ergaenzt ‹ ›-Pfeile, Punkte-
 * Indikator und Tastaturbedienung (‹ ›). Respektiert prefers-reduced-motion.
 * Progressive Enhancement: ohne JS bleibt der Track nativ wischbar.
 */
(function () {
	"use strict";

	function initOne(root) {
		var track = root.querySelector(".gallery-track");
		if (!track) return;
		var slides = Array.prototype.slice.call(track.querySelectorAll(".gallery-slide"));
		if (slides.length < 2) return;   // 1 Bild → keine Pfeile/Punkte

		var reduce = window.matchMedia
			&& window.matchMedia("(prefers-reduced-motion: reduce)").matches;
		var current = 0;

		// ‹ ›-Pfeile
		var prev = document.createElement("button");
		prev.type = "button"; prev.className = "gallery-nav gallery-prev";
		prev.setAttribute("aria-label", "Vorheriges Bild"); prev.innerHTML = "‹";
		var next = document.createElement("button");
		next.type = "button"; next.className = "gallery-nav gallery-next";
		next.setAttribute("aria-label", "Nächstes Bild"); next.innerHTML = "›";
		root.appendChild(prev);
		root.appendChild(next);

		// Punkte-Indikator
		var dotsWrap = document.createElement("div");
		dotsWrap.className = "gallery-dots";
		dotsWrap.setAttribute("role", "tablist");
		dotsWrap.setAttribute("aria-label", "Galerie-Navigation");
		var dots = slides.map(function (s, k) {
			var d = document.createElement("button");
			d.type = "button"; d.className = "gallery-dot"; d.setAttribute("role", "tab");
			d.setAttribute("aria-label", "Bild " + (k + 1));
			d.addEventListener("click", function () { go(k); });
			dotsWrap.appendChild(d);
			return d;
		});
		root.appendChild(dotsWrap);

		function go(n) {
			current = Math.max(0, Math.min(slides.length - 1, n));
			var s = slides[current];
			// Slide-Mitte auf Track-Mitte zentrieren (scrollIntoform inline:center
			// zentriert horizontale Overflow-Container nicht zuverlässig).
			var left = s.offsetLeft + s.clientWidth / 2 - track.clientWidth / 2;
			track.scrollTo({ left: left, behavior: reduce ? "auto" : "smooth" });
		}

		function nearestIndex() {
			var mid = track.scrollLeft + track.clientWidth / 2;
			var best = 0, bestD = Infinity;
			slides.forEach(function (s, k) {
				var c = s.offsetLeft + s.clientWidth / 2;
				var d = Math.abs(c - mid);
				if (d < bestD) { bestD = d; best = k; }
			});
			return best;
		}

		function sync() {
			current = nearestIndex();
			dots.forEach(function (d, k) {
				var on = k === current;
				d.classList.toggle("is-active", on);
				d.setAttribute("aria-selected", on ? "true" : "false");
			});
			prev.disabled = current === 0;
			next.disabled = current === slides.length - 1;
		}

		prev.addEventListener("click", function () { go(current - 1); });
		next.addEventListener("click", function () { go(current + 1); });

		var raf = null;
		track.addEventListener("scroll", function () {
			if (raf) return;
			raf = window.requestAnimationFrame(function () { raf = null; sync(); });
		});

		// Tastatur ‹ ›
		root.tabIndex = 0;
		root.addEventListener("keydown", function (e) {
			if (e.key === "ArrowLeft") { e.preventDefault(); go(current - 1); }
			else if (e.key === "ArrowRight") { e.preventDefault(); go(current + 1); }
		});

		root.classList.add("is-enhanced");
		sync();
	}

	function init() {
		Array.prototype.forEach.call(
			document.querySelectorAll(".gallery-carousel"), initOne);
	}

	if (document.readyState === "loading") {
		document.addEventListener("DOMContentLoaded", init);
	} else {
		init();
	}
})();
