# Machla — Android app (Trusted Web Activity)

This wraps `https://machla.reemora.app` as a real Android app for the
Play Store, using Google's **Trusted Web Activity** (TWA) — the
Play-supported way to ship a PWA: the app is a thin shell that shows
your live site full-screen in Chrome, so it always reflects the current
deployment and your existing Web Push (`lib/push/*`) already works
inside it unmodified. No UI rewrite, no separate codebase to maintain.

## What's already done

- `twa-manifest.json` — the Bubblewrap config (package id, colors, icon
  URLs, start URL), generated from the live `manifest.webmanifest`.
- `../public/.well-known/assetlinks.json` — the Digital Asset Links file
  that proves `machla.reemora.app` and the Android app belong to the
  same owner. Required for the TWA to run without a Chrome address bar.
- `.github/workflows/android-twa-build.yml` — builds the signed `.aab`
  in CI (see "Why CI, not local" below).

## ⚠️ The signing key

A real production keystore has been generated (`machla-release.keystore`,
alias `machla`) and its SHA-256 fingerprint is committed in
`../public/.well-known/assetlinks.json`. The keystore file and its
password were handed to the app owner directly — **the file itself is
never committed to this repository** and does not exist anywhere in git
history. If you need to regenerate it (e.g. it was lost with no Play App
Signing enrollment to fall back on), use:

```bash
keytool -genkeypair -v \
  -keystore machla-release.keystore \
  -alias machla \
  -keyalg RSA -keysize 2048 -validity 10000 \
  -dname "CN=Machla, OU=Reemora, O=Reemora, L=Kuwait City, ST=Kuwait, C=KW"
```

Modern `keytool` forces the key password to match the store password for
PKCS12 keystores (the default type) — so `ANDROID_KEYSTORE_PASSWORD` and
`ANDROID_KEY_PASSWORD` below are the same value. Store it in a password
manager. **If you lose this key later, you cannot publish an update to an
already-published app** under the old model — which is exactly why the
next step matters.

Then get its fingerprint and put it in `../public/.well-known/assetlinks.json`,
replacing the one already there:

```bash
keytool -list -v -keystore machla-release.keystore -alias machla | grep SHA256
```

### Use Play App Signing (strongly recommended)

When you create the app in Play Console, opt into **Play App Signing**.
Google then generates and holds the certificate that actually signs
what users download; the key above becomes only an "upload key," which
Google lets you **reset** if it's ever lost or exposed — the old
non-recoverable model is what the warning above is about. After
enrolling, Play Console shows you the **App signing key certificate**
fingerprint — add that one to `assetlinks.json` too (both can coexist
in the array).

## Why CI, not a local build

Bubblewrap needs to download the Android SDK/build tools from Google's
servers on first run. The environment this project was set up in had no
network access to those servers, so the actual `.aab` couldn't be
produced there — everything up to that point (signing key, asset links,
manifest) doesn't need Android tooling and was done directly. A
GitHub-hosted Actions runner has full internet access and already has a
JDK, so `.github/workflows/android-twa-build.yml` finishes the job.
You can just as well run the commands below on your own machine if you
have normal internet access.

## Finishing the build

1. ✅ Done — the real keystore is generated and `assetlinks.json`'s
   fingerprint is committed. **Merge/deploy this branch** so the updated
   `assetlinks.json` is live on `machla.reemora.app` — Google verifies
   ownership by fetching it from the live host, not from git.
2. Add these as GitHub repo secrets (Settings → Secrets and variables →
   Actions) — the keystore file and password were sent to you directly,
   not committed here:
   - `ANDROID_KEYSTORE_BASE64` — `base64 -w0 machla-release.keystore`
   - `ANDROID_KEYSTORE_PASSWORD`
   - `ANDROID_KEY_ALIAS` — `machla`
   - `ANDROID_KEY_PASSWORD` — same value as `ANDROID_KEYSTORE_PASSWORD`
     (PKCS12 keystores require the two to match)
3. Run the "Build Android app (TWA)" workflow from the Actions tab
   (`workflow_dispatch` — manual trigger). Download the `.aab` from the
   run's artifacts.
4. **Verify the asset link before submitting** — Google's own checker:
   `https://developers.google.com/digital-asset-links/tools/generator`
   (host: `machla.reemora.app`, package: `app.reemora.machla`).

## Play Console submission checklist

- Google Play Developer account — $25 one-time.
- Upload the `.aab` from the workflow artifact.
- App icon (512×512), feature graphic (1024×500), phone screenshots —
  reuse `public/icons/icon-512.png` and screenshots of the live app.
- Privacy policy URL — required; this app collects phone numbers.
- Data Safety form — declare phone number collection (auth), no
  location or contacts access.
- Content rating questionnaire.
- Store listing description, in whichever languages you want to
  localize the *listing* (independent of the 12 in-app languages).

## Local testing without Play Console

`bubblewrap build` also produces `app-release-signed.apk` — install it
directly on an Android device or emulator with `adb install` to test
the wrapped app (including that push notifications and the camera
permission for photo items work) before submitting anything.
