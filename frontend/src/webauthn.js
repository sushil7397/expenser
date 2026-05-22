// Browser-side WebAuthn helpers. Talk to the Django /api/webauthn endpoints.

import { api } from "./api.js";

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

function assertSupported() {
  if (!window.isSecureContext) {
    throw new Error(
      "Fingerprint login needs HTTPS or localhost. This page isn't on a secure origin."
    );
  }
  if (!navigator.credentials || !window.PublicKeyCredential) {
    throw new Error("This browser doesn't support WebAuthn.");
  }
}

export async function registerFingerprint({ label = "Fingerprint" } = {}) {
  assertSupported();
  const { challenge_token, options } = await api("/webauthn/register/begin/", {
    method: "POST",
    body: {},
  });
  options.challenge = b64urlToBuf(options.challenge);
  options.user.id = b64urlToBuf(options.user.id);
  (options.excludeCredentials || []).forEach((c) => { c.id = b64urlToBuf(c.id); });

  const cred = await navigator.credentials.create({ publicKey: options });
  const credential = {
    id: cred.id,
    rawId: bufToB64url(cred.rawId),
    type: cred.type,
    response: {
      clientDataJSON: bufToB64url(cred.response.clientDataJSON),
      attestationObject: bufToB64url(cred.response.attestationObject),
    },
  };
  return api("/webauthn/register/finish/", {
    method: "POST",
    body: { challenge_token, credential, label },
  });
}

// Returns { token, user } on success — the AuthProvider can swap it in.
export async function signInWithFingerprint(username) {
  assertSupported();
  if (!username) throw new Error("Enter your username first.");

  const { challenge_token, options } = await api("/webauthn/login/begin/", {
    method: "POST",
    body: { username },
    auth: false,
  });
  options.challenge = b64urlToBuf(options.challenge);
  (options.allowCredentials || []).forEach((c) => { c.id = b64urlToBuf(c.id); });

  const a = await navigator.credentials.get({ publicKey: options });
  const credential = {
    id: a.id,
    rawId: bufToB64url(a.rawId),
    type: a.type,
    response: {
      clientDataJSON: bufToB64url(a.response.clientDataJSON),
      authenticatorData: bufToB64url(a.response.authenticatorData),
      signature: bufToB64url(a.response.signature),
      userHandle: a.response.userHandle ? bufToB64url(a.response.userHandle) : null,
    },
  };
  return api("/webauthn/login/finish/", {
    method: "POST",
    body: { challenge_token, credential },
    auth: false,
  });
}
