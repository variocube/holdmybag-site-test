/* HMB Hero-Slideshow (HMB-HERO).
 * Auto-Advance (6 s) + Dots + Pfeile, Pause bei Hover/Focus.
 * Respektiert prefers-reduced-motion: dann KEIN Auto-Advance (nur manuell).
 */
(function () {
	"use strict";

	function init() {
		var root = document.querySelector(".hero-slider");
		if (!root) return;
		var slides = Array.prototype.slice.call(root.querySelectorAll(".hero-slide"));
		var dots = Array.prototype.slice.call(root.querySelectorAll(".hero-dot"));
		if (slides.length < 2) return;

		var i = 0;
		var timer = null;
		var reduce = window.matchMedia
			&& window.matchMedia("(prefers-reduced-motion: reduce)").matches;

		function show(n) {
			i = (n + slides.length) % slides.length;
			slides.forEach(function (s, k) { s.classList.toggle("is-active", k === i); });
			dots.forEach(function (d, k) {
				d.classList.toggle("is-active", k === i);
				d.setAttribute("aria-selected", k === i ? "true" : "false");
			});
		}
		function stop() { if (timer) { clearInterval(timer); timer = null; } }
		function start() { if (reduce) return; stop(); timer = setInterval(function () { show(i + 1); }, 6000); }

		var prev = root.querySelector(".hero-prev");
		var next = root.querySelector(".hero-next");
		if (prev) prev.addEventListener("click", function () { show(i - 1); start(); });
		if (next) next.addEventListener("click", function () { show(i + 1); start(); });
		dots.forEach(function (d, k) { d.addEventListener("click", function () { show(k); start(); }); });

		root.addEventListener("mouseenter", stop);
		root.addEventListener("mouseleave", start);
		root.addEventListener("focusin", stop);
		root.addEventListener("focusout", start);

		show(0);
		start();
	}

	if (document.readyState === "loading") {
		document.addEventListener("DOMContentLoaded", init);
	} else {
		init();
	}
})();
