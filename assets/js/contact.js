/* HMB-Kontaktformular (WS-HMB-CONTACT-FORM) — rein client-seitig.
 *
 * Warum: die statische Site (holdmybag.net) hat keinen eigenen POST-Handler.
 * Ohne dieses Script macht das <form> einen nativen POST auf den statischen
 * GitHub-Pages-Host → 405. Stattdessen fangen wir submit ab und posten die
 * Felder als JSON cross-origin an den Hub (`POST /api/hmb/contact`).
 *
 * - API-Basis kommt env-abhängig aus `data-api-base` am <form> (via build.py
 *   injiziert: test→hub-test.variocube.com, prod→hub.variocube.com; leer in der
 *   Hub-Vorschau/lokal → relativ, same-origin). NICHT hier hartkodiert.
 * - Nur die vom Endpoint erwarteten Felder senden (ContactRequest ist
 *   `extra="forbid"`): name/email/subject/message/company(Honeypot)/turnstile_token.
 * - Erfolg/Fehler inline; Button während des Sendens gesperrt.
 */
(function () {
	"use strict";

	var form = document.getElementById("hmb-contact-form");
	if (!form) return;
	var msgEl = document.getElementById("hmb-contact-msg");
	var btn = form.querySelector('button[type="submit"]');

	var EN = (document.documentElement.lang || "").toLowerCase().indexOf("en") === 0
		|| location.pathname.indexOf("/en/") === 0;
	var T = EN ? {
		sending: "Sending…", send: null,
		ok: "Thank you! Your message has been sent.",
		rate: "Too many requests. Please try again later.",
		bot: "Spam check failed. Please reload the page and try again.",
		invalid: "Please check your entries and try again.",
		fail: "Sorry, something went wrong. Please try again or email office@holdmybag.net.",
	} : {
		sending: "Wird gesendet…", send: null,
		ok: "Danke! Ihre Nachricht wurde gesendet.",
		rate: "Zu viele Anfragen. Bitte versuchen Sie es später erneut.",
		bot: "Bot-Schutz-Prüfung fehlgeschlagen. Bitte laden Sie die Seite neu und versuchen Sie es erneut.",
		invalid: "Bitte prüfen Sie Ihre Eingaben und versuchen Sie es erneut.",
		fail: "Leider ist ein Fehler aufgetreten. Bitte erneut versuchen oder an office@holdmybag.net schreiben.",
	};

	function show(kind, text) {
		if (!msgEl) return;
		msgEl.hidden = false;
		msgEl.textContent = text;
		msgEl.style.color = (kind === "ok") ? "#166534" : "#b91c1c";
	}

	function turnstileToken() {
		// 1) offizielle API, 2) das von Turnstile injizierte Hidden-Input.
		try { if (window.turnstile && typeof window.turnstile.getResponse === "function") return window.turnstile.getResponse() || ""; }
		catch (_) { /* Widget evtl. noch nicht bereit */ }
		var inp = form.querySelector('[name="cf-turnstile-response"]');
		return inp ? (inp.value || "") : "";
	}

	function val(name) {
		var el = form.elements[name];
		return el ? String(el.value || "").trim() : "";
	}

	form.addEventListener("submit", function (e) {
		e.preventDefault();
		if (btn && btn.disabled) return;

		// Nur die erlaubten Felder (extra=forbid). Optionale nur mitsenden, wenn befüllt.
		var payload = {
			name: val("name"),
			email: val("email"),
			message: val("message"),
			company: val("company"),   // Honeypot — normalerweise leer
		};
		var subject = val("subject");
		if (subject) payload.subject = subject;
		var token = turnstileToken();
		if (token) payload.turnstile_token = token;

		var endpoint = (form.getAttribute("data-api-base") || "") + "/api/hmb/contact";
		if (btn) { btn.dataset.label = btn.dataset.label || btn.textContent; btn.disabled = true; btn.textContent = T.sending; }
		if (msgEl) msgEl.hidden = true;

		fetch(endpoint, {
			method: "POST",
			headers: { "Content-Type": "application/json", "Accept": "application/json" },
			body: JSON.stringify(payload),
		}).then(function (res) {
			if (res.ok) {                          // 202
				show("ok", T.ok);
				form.reset();
			} else if (res.status === 429) {
				show("error", T.rate);
			} else if (res.status === 400) {
				show("error", T.bot);
			} else if (res.status === 422) {
				show("error", T.invalid);
			} else {
				show("error", T.fail);
			}
		}).catch(function () {
			show("error", T.fail);
		}).then(function () {
			if (btn) { btn.disabled = false; btn.textContent = btn.dataset.label || btn.textContent; }
			// Turnstile-Token ist einmalig → nach jedem Versuch zurücksetzen.
			try { if (window.turnstile && typeof window.turnstile.reset === "function") window.turnstile.reset(); }
			catch (_) { /* ignore */ }
		});
	});
})();
