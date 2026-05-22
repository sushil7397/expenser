// Browser-side WebAuthn helpers. Talks to the Django endpoints in webauthn_views.py.
//
// Two flows:
//   - registerFingerprint({label}) — call after the user is already logged in.
//   - signInWithFingerprint({username}) — call from the login screen.
//
// Both require a "Secure Context": HTTPS, or http://localhost / 127.0.0.1.
// On plain HTTP from a remote IP, navigator.credentials will be undefined.

(function () {
  function b64urlToBuf(s) {
    s = s.replace(/-/g, "+").replace(/_/g, "/");
    while (s.length % 4) s += "=";
    const bin = atob(s);
    const buf = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
    return buf.buffer;
  }

  function bufToB64url(buf) {
    const bytes = new Uint8Array(buf);
    let s = "";
    for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
    return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }

  function getCsrf() {
    const m = document.cookie.match(/csrftoken=([^;]+)/);
    return m ? m[1] : "";
  }

  function checkSupport() {
    if (!window.isSecureContext) {
      throw new Error(
        "Fingerprint login needs a secure connection (HTTPS or localhost). " +
        "This site is on plain HTTP, so the browser won't expose biometrics."
      );
    }
    if (!navigator.credentials || !window.PublicKeyCredential) {
      throw new Error("This browser doesn't support WebAuthn.");
    }
  }

  async function postJSON(url, body) {
    const res = await fetch(url, {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json", "X-CSRFToken": getCsrf() },
      body: JSON.stringify(body || {}),
    });
    if (!res.ok) {
      let detail = "";
      try { detail = (await res.json()).error || ""; } catch (e) {}
      throw new Error(detail || `Server returned ${res.status}`);
    }
    return res.json();
  }

  window.registerFingerprint = async function ({ label } = {}) {
    checkSupport();
    const opts = await postJSON("/webauthn/register/begin/", {});

    opts.challenge = b64urlToBuf(opts.challenge);
    opts.user.id = b64urlToBuf(opts.user.id);
    (opts.excludeCredentials || []).forEach((c) => { c.id = b64urlToBuf(c.id); });

    const cred = await navigator.credentials.create({ publicKey: opts });
    const payload = {
      id: cred.id,
      rawId: bufToB64url(cred.rawId),
      type: cred.type,
      response: {
        clientDataJSON: bufToB64url(cred.response.clientDataJSON),
        attestationObject: bufToB64url(cred.response.attestationObject),
      },
      label: label || "Fingerprint",
    };
    return postJSON("/webauthn/register/finish/", payload);
  };

  window.signInWithFingerprint = async function ({ username }) {
    checkSupport();
    if (!username) throw new Error("Enter your username first.");

    const opts = await postJSON("/webauthn/login/begin/", { username });
    opts.challenge = b64urlToBuf(opts.challenge);
    (opts.allowCredentials || []).forEach((c) => { c.id = b64urlToBuf(c.id); });

    const assertion = await navigator.credentials.get({ publicKey: opts });
    const payload = {
      id: assertion.id,
      rawId: bufToB64url(assertion.rawId),
      type: assertion.type,
      response: {
        clientDataJSON: bufToB64url(assertion.response.clientDataJSON),
        authenticatorData: bufToB64url(assertion.response.authenticatorData),
        signature: bufToB64url(assertion.response.signature),
        userHandle: assertion.response.userHandle
          ? bufToB64url(assertion.response.userHandle)
          : null,
      },
    };
    const result = await postJSON("/webauthn/login/finish/", payload);
    if (result.ok && result.redirect) window.location.href = result.redirect;
    return result;
  };
})();
