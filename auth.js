import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-app.js";
import {
  getAuth, onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword,
  sendEmailVerification, sendPasswordResetEmail, updateProfile, signOut,
  multiFactor, getMultiFactorResolver, TotpMultiFactorGenerator
} from "https://www.gstatic.com/firebasejs/11.0.2/firebase-auth.js";
import { firebaseConfig } from "./firebase-config.js";

const DASHBOARD_URL = "dashboard.html";
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const msgBox = $("#msg");

let auth = null, pendingResolver = null, totpSecret = null, pollTimer = null, resendTimer = null;

/* ---------- UI helpers ---------- */
function show(name) {
  $$("[data-panel]").forEach(p => { p.hidden = p.dataset.panel !== name; });
  clearMsg();
  clearInterval(pollTimer);
  if (name === "verify") pollTimer = setInterval(checkVerified, 5000);
  const first = $(`[data-panel="${name}"] input:not([type=checkbox])`);
  if (first) setTimeout(() => first.focus(), 50);
}
function showTab(tab) { show(tab === "signup" ? "signup" : "login"); history.replaceState(null, "", tab === "signup" ? "?tab=signup" : location.pathname); }
function setMsg(text, type = "error") { msgBox.textContent = text; msgBox.className = `auth-alert ${type}`; msgBox.hidden = false; }
function clearMsg() { msgBox.hidden = true; }
function busy(form, on) {
  const b = form.querySelector('button[type="submit"]');
  if (!b) return;
  b.disabled = on;
  if (on) { b.dataset.label = b.textContent; b.textContent = "Please wait…"; } else if (b.dataset.label) b.textContent = b.dataset.label;
}

const ERRORS = {
  "auth/invalid-email": "That email address doesn't look right.",
  "auth/invalid-credential": "Incorrect email or password.",
  "auth/wrong-password": "Incorrect email or password.",
  "auth/user-not-found": "Incorrect email or password.",
  "auth/email-already-in-use": "An account with this email already exists. Try logging in.",
  "auth/weak-password": "Choose a stronger password.",
  "auth/too-many-requests": "Too many attempts. Wait a few minutes and try again.",
  "auth/network-request-failed": "Network problem. Check your connection and try again.",
  "auth/invalid-verification-code": "That code is wrong or has expired. Try the latest one.",
  "auth/requires-recent-login": "For your security, please log in again.",
  "auth/operation-not-allowed": "This sign-in option isn't switched on in Firebase yet (see setup notes: Email/Password and TOTP 2FA)."
};
const errText = e => ERRORS[e.code] || "Something went wrong. Please try again.";

/* ---------- Config check ---------- */
const configured = firebaseConfig.apiKey && !firebaseConfig.apiKey.startsWith("YOUR_");
if (!configured) {
  $("#configBanner").hidden = false;
  $$("form button[type=submit]").forEach(b => b.disabled = true);
} else {
  auth = getAuth(initializeApp(firebaseConfig));
}

/* ---------- Navigation between panels ---------- */
$$("[data-tab]").forEach(b => b.addEventListener("click", () => showTab(b.dataset.tab)));
$$("[data-go]").forEach(b => b.addEventListener("click", () => { pendingResolver = null; show(b.dataset.go); }));
$$("[data-signout]").forEach(b => b.addEventListener("click", async () => { if (auth) await signOut(auth); showTab("login"); }));
$$(".pw-toggle").forEach(b => b.addEventListener("click", () => {
  const input = b.previousElementSibling, hidden = input.type === "password";
  input.type = hidden ? "text" : "password";
  b.setAttribute("aria-label", hidden ? "Hide password" : "Show password");
  b.firstElementChild.className = hidden ? "fa-regular fa-eye-slash" : "fa-regular fa-eye";
}));
showTab(new URLSearchParams(location.search).get("tab"));

/* ---------- Routing after auth state changes ---------- */
async function route(user) {
  if (!user) return;
  if (!user.emailVerified) {
    $("#verifyEmail").textContent = user.email;
    show("verify");
    return;
  }
  if (multiFactor(user).enrolledFactors.length === 0) { await startEnroll(user); return; }
  location.replace(DASHBOARD_URL);
}
if (auth) onAuthStateChanged(auth, user => { if (user) route(user); });

/* ---------- Sign up ---------- */
$("#signupForm").addEventListener("submit", async e => {
  e.preventDefault();
  if (!auth) return;
  const name = $("#signupName").value.trim(), email = $("#signupEmail").value.trim(), pw = $("#signupPassword").value;
  if (name.length < 2) return setMsg("Please enter your full name.");
  if (pw.length < 10 || !/[A-Za-z]/.test(pw) || !/\d/.test(pw)) return setMsg("Password needs at least 10 characters, with letters and numbers.");
  if (!$("#signupTerms").checked) return setMsg("Please confirm you are 18+ and accept the terms.");
  busy(e.target, true);
  try {
    const cred = await createUserWithEmailAndPassword(auth, email, pw);
    await updateProfile(cred.user, { displayName: name });
    await sendEmailVerification(cred.user);
    $("#verifyEmail").textContent = cred.user.email;
    show("verify");
  } catch (err) { setMsg(errText(err)); }
  busy(e.target, false);
});

/* ---------- Log in (with 2FA challenge) ---------- */
$("#loginForm").addEventListener("submit", async e => {
  e.preventDefault();
  if (!auth) return;
  busy(e.target, true);
  try {
    await signInWithEmailAndPassword(auth, $("#loginEmail").value.trim(), $("#loginPassword").value);
  } catch (err) {
    if (err.code === "auth/multi-factor-auth-required") {
      pendingResolver = getMultiFactorResolver(auth, err);
      show("challenge");
    } else setMsg(errText(err));
  }
  busy(e.target, false);
});

$("#challengeForm").addEventListener("submit", async e => {
  e.preventDefault();
  if (!pendingResolver) return show("login");
  const code = $("#challengeCode").value.trim();
  if (!/^\d{6}$/.test(code)) return setMsg("Enter the 6-digit code from your app.");
  busy(e.target, true);
  try {
    const hint = pendingResolver.hints.find(h => h.factorId === TotpMultiFactorGenerator.FACTOR_ID);
    const assertion = TotpMultiFactorGenerator.assertionForSignIn(hint.uid, code);
    await pendingResolver.resolveSignIn(assertion);
    pendingResolver = null; // onAuthStateChanged now redirects
  } catch (err) { setMsg(errText(err)); }
  busy(e.target, false);
});

/* ---------- Forgot password ---------- */
$("#forgotForm").addEventListener("submit", async e => {
  e.preventDefault();
  if (!auth) return;
  busy(e.target, true);
  try { await sendPasswordResetEmail(auth, $("#forgotEmail").value.trim()); } catch (err) { if (err.code === "auth/invalid-email") { busy(e.target, false); return setMsg(errText(err)); } }
  // Same message either way, so the form can't be used to discover which emails have accounts.
  setMsg("If an account exists for that email, a reset link is on its way.", "success");
  busy(e.target, false);
});

/* ---------- Email verification ---------- */
async function checkVerified() {
  const user = auth && auth.currentUser;
  if (!user) return;
  try {
    await user.reload();
    if (auth.currentUser.emailVerified) {
      await auth.currentUser.getIdToken(true); // refresh token so MFA enrolment is allowed
      route(auth.currentUser);
    }
  } catch { /* ignore, next poll will retry */ }
}
$("#verifyCheck").addEventListener("click", async () => {
  await checkVerified();
  if (auth.currentUser && !auth.currentUser.emailVerified) setMsg("Not verified yet. Open the link in your email first.");
});
$("#verifyResend").addEventListener("click", async e => {
  const btn = e.currentTarget, user = auth.currentUser;
  if (!user || btn.disabled) return;
  try {
    await sendEmailVerification(user);
    setMsg("Verification email sent again.", "success");
    let s = 60; btn.disabled = true;
    clearInterval(resendTimer);
    resendTimer = setInterval(() => { btn.textContent = `Resend in ${--s}s`; if (s <= 0) { clearInterval(resendTimer); btn.disabled = false; btn.textContent = "Resend email"; } }, 1000);
  } catch (err) { setMsg(errText(err)); }
});

/* ---------- 2FA enrolment (authenticator app) ---------- */
async function startEnroll(user) {
  show("enroll");
  try {
    const session = await multiFactor(user).getSession();
    totpSecret = await TotpMultiFactorGenerator.generateSecret(session);
    const uri = totpSecret.generateQrCodeUrl(user.email, "NovusFX");
    $("#secretKey").textContent = totpSecret.secretKey;
    const qr = $("#qr"); qr.innerHTML = "";
    if (window.QRCode) new QRCode(qr, { text: uri, width: 168, height: 168 });
  } catch (err) {
    if (err.code === "auth/requires-recent-login") { await signOut(auth); showTab("login"); }
    setMsg(errText(err));
  }
}
$("#enrollForm").addEventListener("submit", async e => {
  e.preventDefault();
  const user = auth.currentUser, code = $("#enrollCode").value.trim();
  if (!user || !totpSecret) return;
  if (!/^\d{6}$/.test(code)) return setMsg("Enter the 6-digit code from your app.");
  busy(e.target, true);
  try {
    await multiFactor(user).enroll(TotpMultiFactorGenerator.assertionForEnrollment(totpSecret, code), "Authenticator app");
    location.replace(DASHBOARD_URL);
  } catch (err) { setMsg(errText(err)); }
  busy(e.target, false);
});
