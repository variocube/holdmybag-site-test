/* HMB Standort-Detail — Video-Facade (Klick-to-load, DSGVO) + Copy-Coords.
 * WS-HMB-STANDORT-BUILD H3. Self-hosted .mp4/.webm → <video>; YouTube → nocookie.
 * Kein Auto-Embed: nichts lädt fremd, bevor der/die Nutzer:in klickt. */
(function () {
	"use strict";

	function ytId(url) {
		var m = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{6,})/);
		return m ? m[1] : null;
	}

	function activateVideo(btn) {
		var url = btn.getAttribute("data-video") || "";
		if (!/^https?:\/\//.test(url)) return;   // nur http(s)
		var wrap = document.createElement("div");
		wrap.className = "video-embed";
		var yt = ytId(url);
		if (yt) {
			var f = document.createElement("iframe");
			f.src = "https://www.youtube-nocookie.com/embed/" + encodeURIComponent(yt) + "?autoplay=1&rel=0";
			f.title = "Video";
			f.allow = "accelerometer; autoplay; encrypted-media; picture-in-picture";
			f.allowFullscreen = true;
			f.loading = "lazy";
			wrap.appendChild(f);
		} else {
			var v = document.createElement("video");
			v.src = url; v.controls = true; v.autoplay = true; v.preload = "none";
			v.setAttribute("playsinline", "");
			wrap.appendChild(v);
		}
		btn.parentNode.replaceChild(wrap, btn);
	}

	function onClick(ev) {
		var vf = ev.target.closest ? ev.target.closest(".video-facade") : null;
		if (vf) { activateVideo(vf); return; }
		var cp = ev.target.closest ? ev.target.closest(".copybtn") : null;
		if (cp && cp.getAttribute("data-copy")) {
			var txt = cp.getAttribute("data-copy");
			if (navigator.clipboard) {
				navigator.clipboard.writeText(txt).then(function () {
					var old = cp.textContent; cp.textContent = "✓";
					setTimeout(function () { cp.textContent = old; }, 1200);
				}).catch(function () {});
			}
		}
	}

	document.addEventListener("click", onClick);
})();
