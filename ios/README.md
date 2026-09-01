# Machla for iOS

The App Store build. It is a native app whose main screen is a web view
showing `machla.reemora.app` — the same Next.js app the browser gets, so
the two can never drift apart between releases — plus the one thing a
browser on iOS cannot do from inside an app: **Apple push notifications**.

Six Swift files, no CocoaPods, no Swift packages, no third-party runtime.

| File | What it does |
|---|---|
| `Machla/MachlaApp.swift` | The app itself, and the native "no connection" screen |
| `Machla/AppDelegate.swift` | APNs registration and notification taps |
| `Machla/NativeBridge.swift` | The entire contract between the page and the shell |
| `Machla/WebAppView.swift` | The web view, and what happens around it |
| `Machla/Config.swift` | The site URL, the bundle colours, the one preference key |
| `Machla/Strings.swift` | The offline screen, in all twelve languages |

## Why not Capacitor

The site serves a strict Content-Security-Policy
(`script-src 'self' 'nonce-…' 'strict-dynamic'`, see `proxy.ts`). Every
web-to-native framework works by injecting a JavaScript bridge into the
page, and an injected script carries neither the nonce nor a hash the
page vouches for, so WebKit is entitled to refuse it. The fix would have
been to weaken the CSP — trading the app's main defence against
cross-site scripting for packaging convenience.

The bridge here uses the two channels a CSP cannot reach, because neither
is a script the page loaded:

- **page → shell**: `window.webkit.messageHandlers.machla.postMessage()`,
  a host object WebKit installs on the window itself.
- **shell → page**: `evaluateJavaScript` from Swift, a native call
  outside the document's policy entirely.

`lib/native/bridge.ts` is the same contract from the web side. Three
requests in (`push:status`, `push:enable`, `push:disable`), two callbacks
out (`onPushToken`, `onPushStatus`). That is all of it.

## Notifications, end to end

```
list sent  ->  Postgres trigger writes a notifications row
           ->  lib/push/send.ts reads it back (get_pending_pushes)
           ->  platform = 'web'  ->  Web Push  ->  browser / installed PWA
               platform = 'ios'  ->  APNs      ->  this app
```

One fan-out, two transports — so an iPhone and an Android in the same
household are never told different things about the same list. The device
token is stored as an ordinary `push_subscriptions` row with
`endpoint = 'apns://<token>'` (`supabase/migrations/20260814100000_apns_push.sql`).

---

# What only you can do

Everything above is written and committed. The rest needs an Apple
account, a Mac, and decisions that are yours.

## 1. Apple Developer Program — 99 USD/year

<https://developer.apple.com/programs/enroll/>

Enrol as an **organisation** if the app should be published under a
company name (needs a D-U-N-S number, and takes longer), or as an
**individual** if it may be published under your own name. This choice is
awkward to change later, so decide before enrolling.

Note the **Team ID** (10 characters) once you are in — you will need it
twice.

## 2. Register the App ID

Certificates, Identifiers & Profiles → Identifiers → **+**

- Bundle ID: `app.reemora.machla` — **explicit**, not wildcard. It must
  match `PRODUCT_BUNDLE_IDENTIFIER` in the Xcode project exactly, and it
  can never be changed or reused once submitted.
- Capabilities: tick **Push Notifications**. Nothing else.

## 3. Create the APNs auth key

Certificates, Identifiers & Profiles → Keys → **+**

- Name it anything; tick **Apple Push Notifications service (APNs)**.
- Download the `.p8`. **Apple lets you download it once.** Losing it
  means revoking and re-issuing.
- Note the **Key ID** (10 characters).

One key signs for every app on the team, so this is not something to
repeat per app.

## 4. Add the APNs credentials to Vercel

Project → Settings → Environment Variables, for **Production** and
**Preview**:

| Name | Value |
|---|---|
| `APNS_KEY_ID` | the Key ID from step 3 |
| `APNS_TEAM_ID` | the Team ID from step 1 |
| `APNS_BUNDLE_ID` | `app.reemora.machla` |
| `APNS_PRIVATE_KEY` | the whole `.p8` file, `BEGIN`/`END` lines included |
| `APNS_ENVIRONMENT` | `production` |

Then **redeploy** — environment variables are read at build time.

`APNS_PRIVATE_KEY` is a signing key. It goes in the server-side
environment only: never in a `NEXT_PUBLIC_*` variable, never in the
repository, never pasted into a chat window. Anyone holding it can send
notifications that appear to come from Machla.

> **The environment matters more than it looks.** A token registered by a
> build signed with a *development* profile — an Xcode run on your own
> iPhone — is only valid against the APNs **sandbox** host. TestFlight and
> App Store builds are production. Sending to the wrong host returns
> `BadDeviceToken`, which reads exactly like a stale token. If you are
> testing from Xcode, set `APNS_ENVIRONMENT=sandbox` on a Preview
> deployment and test against that.

## 5. Open the project (only needed to test on a real iPhone)

Push notifications do **not** work in the Simulator, so the one thing
you cannot do without this step is confirm the Settings toggle and a
delivered notification actually work. Releasing an upload, further
down, does **not** need this step at all — see "8. Release" below.

```bash
open ios/Machla.xcodeproj
```

Xcode → target **Machla** → **Signing & Capabilities**:

1. Tick **Automatically manage signing**.
2. Choose your **Team**. (The project ships with `DEVELOPMENT_TEAM = ""`
   because the repository is public and a Team ID is yours, not the
   code's.)
3. Confirm **Push Notifications** appears in the capability list — it
   comes from `Machla/Machla.entitlements` and should already be there.

Run it on a real iPhone, connected by cable or over the network, with
your Apple ID signed in to Xcode.

> If Xcode refuses to open the project at all, regenerate it:
> `brew install xcodegen && cd ios && xcodegen generate`. `project.yml`
> describes the same target, and the generated project replaces
> `Machla.xcodeproj` byte for byte in purpose if not in bytes.

## 6. Screenshots

App Store Connect only accepts specific exact pixel dimensions — not
whatever a real device happens to natively screenshot at (an iPhone 16
Pro Max, for instance, screenshots at 1320×2868, which the uploader
rejects). The accepted sizes as of this writing:

- **1242 × 2688** or **2688 × 1242** (portrait/landscape — the "6.5-inch" bucket)
- **1284 × 2778** or **2778 × 1284** (portrait/landscape — the "6.7-inch" bucket)

At least one set is required; App Store Connect's uploader tells you
exactly which sizes it wants if you're ever unsure — trust the live
error over any list written down here, since Apple has changed this
before.

**Screenshot from the Simulator, not a physical phone — and pick the
right model.** A real device (an iPhone 16 Pro Max, say) screenshots at
its own native resolution, 1320×2868, which the uploader rejects; there
is no in-between step of resizing it correctly. The Simulator sidesteps
this entirely, because a handful of older device models happen to
render at exactly Apple's two accepted sizes:

| Simulator device | ⌘S produces |
|---|---|
| iPhone 11 Pro Max | 1242 × 2688 |
| iPhone 14 Plus (or 13 Pro Max) | 1284 × 2778 |

Run the app on each of those two, sign in with the demo account
(`+965 10101010`, code `123456`), and ⌘S saves a already-correct PNG to
the Desktop — no cropping, no resizing, nothing to get wrong. Five or
six screens: the dashboard, a list with items, the category grid,
Settings, Notifications. Arabic screenshots are worth adding as a
separate localisation — Kuwait is the market.

No device frames, no marketing text overlaid on the first screenshot.

## 7. App Store Connect

<https://appstoreconnect.apple.com> → My Apps → **+**

- **Name**: `Machlati` (`ماچلتي`) — the App Store *listing* name, a
  field that lives entirely in App Store Connect and nowhere in this
  repository. It must be unique across the entire App Store (check
  early — it is claimed the moment you type it here), which plain
  `Machla` may not be. This is deliberately separate from the app's own
  name on the Home Screen and inside every screen (`CFBundleDisplayName`
  in `Machla/Info.plist`, still `Machla`) — a shopper searching the
  Store and someone who already has the app installed can land on two
  different words without anything in the app itself needing to change.
- **Primary language**: Arabic or English.
- **Bundle ID**: the one from step 2.
- **Category**: Shopping. Secondary: Productivity.
- **Age rating**: answer honestly; this app should come out 4+.

### Privacy

The questionnaire must agree with `Machla/PrivacyInfo.xcprivacy`, which
already declares: phone number, name, photos, and "other user content"
(the lists) — all **linked to the user**, all for **app functionality**,
**none** used for tracking.

You also need a **privacy policy URL** on a public page. Use
`https://machla.reemora.app/privacy` — it needs no account to open (App
Store Connect's field requires exactly that), is served in all twelve
languages the app ships with, and its content matches
`Machla/PrivacyInfo.xcprivacy` line for line: phone number, name, photos,
and the lists themselves, linked to the user, none of it for tracking.

### App Review notes — read this one carefully

Two things will otherwise get the app rejected:

**a. The reviewer cannot log in.** Sign-in is a phone number and a
one-time code over WhatsApp. An Apple reviewer in California has no
Kuwaiti number and will not receive it, and "could not test the app" is
an automatic rejection.

Fix it in Supabase before submitting: **Authentication → Sign In / Up →
Phone → Test OTP**. Set: `+96510101010 → 123456` — entered in the
dashboard as `96510101010=123456` (the field's own format, no leading
`+`). That number bypasses WhatsApp entirely. It deliberately starts
with `1` — no Kuwaiti carrier assigns mobile numbers in that range
(only 5/6/9), so if this Test OTP mapping is ever missing or wrong, a
stray sign-in attempt can't reach a real person's phone the way the
original demo number (`90909090`, a real Kuwaiti mobile range) could
have. Put it in the review notes as the demo account, and give it a
household with a few lists in it so there is something to see. Remove
it after approval if you would rather it did not exist.

**b. Guideline 4.2 — Minimum Functionality.** Apple rejects apps that are
"just a website in a wrapper". Say plainly what this app is and what it
does natively:

> Machla is the iOS client for a household shopping-list service used in
> Kuwait, connecting families with the domestic workers who shop for
> them. Accounts, households and lists are server-side; the app is the
> client for that service, not a repackaged marketing site.
>
> The app implements native push notifications through APNs (a household
> is notified when a list is sent, opened or completed) — the feature the
> service is built around, and one that is not available to a website on
> iOS. It also handles connectivity loss natively, in the user's own
> language.
>
> Demo account: +965 10101010, code 123456. It belongs to a household
> with sample lists.
>
> Account deletion (Guideline 5.1.1(v)) is available from inside the
> app: Settings → Danger zone → Delete my account. It permanently
> deletes the Supabase auth account; if the account owns a household,
> that household and everything in it is deleted too.

**c. Guideline 5.1.1(v) — Account deletion.** Live in Settings →
Danger zone → Delete my account (`components/household/SettingsScreen.tsx`,
`lib/auth/deleteAccount.ts`). It only works once
`SUPABASE_SERVICE_ROLE_KEY` is set in Vercel as a **server-side**
environment variable (Production + Preview) — same place the
VAPID/APNs secrets went, never as `NEXT_PUBLIC_*`, never committed.
Get the value from Supabase → Project Settings → API → service_role
key. Without it, the button fails cleanly with a "not configured"
error instead of partially deleting anything — so add it before
resubmitting, or the reviewer will hit that error.

### Export compliance

`ITSAppUsesNonExemptEncryption` is already `false` in `Info.plist`, so
this question will not be asked on every upload. That is accurate: the
app uses HTTPS and nothing else.

## 8. Release

**A new build is only needed when something in `ios/` changes.** Changes
to the web app need no App Store release at all — that is the whole
point of this app's shape: deploy to Vercel and every installed app has
it on next launch, with no review and no waiting.

When `ios/` does change, there are two ways to get a build into App
Store Connect. Use whichever fits; both produce the same kind of upload.

### Automated — no Mac needed, and the one that does not touch your Apple ID

`.github/workflows/ios-release.yml` does what Xcode's own
**Product → Archive → Distribute App** does, unattended on a macOS
GitHub Actions runner: archive, sign, export, and upload. It
authenticates with an **App Store Connect API key** — Apple's own
answer to "how does CI do this without a person sitting at Xcode
entering an Apple ID and a 2FA code" — so nobody, including any
automated assistant working on this repository, is ever handed your
Apple ID password. A leaked API key is revoked in App Store Connect in
seconds; a leaked Apple ID password is a much worse afternoon.

Generate the key **once**, in App Store Connect → **Users and Access** →
**Integrations** → **App Store Connect API** → **Generate API Key**.
Give it the **App Manager** role — narrower roles cannot create the
signing certificate and provisioning profile the first run needs.
Apple lets you download the `.p8` exactly once, same as the APNs key in
step 3; **this is a different key from that one**, same file shape,
unrelated purpose, do not reuse one for the other.

Add four repository secrets (Settings → Secrets and variables →
Actions):

| Name | Value |
|---|---|
| `APPLE_TEAM_ID` | the Team ID from step 1 |
| `APPSTORE_CONNECT_KEY_ID` | the new key's Key ID |
| `APPSTORE_CONNECT_ISSUER_ID` | that key's Issuer ID (shown next to it) |
| `APPSTORE_CONNECT_PRIVATE_KEY` | the whole `.p8` file, `BEGIN`/`END` lines included |

Then, with the app record from step 7 already created (the workflow
uploads a build into an existing app record; it does not create one):
Actions tab → **Release iOS app to App Store Connect** → **Run
workflow**. Ten or so minutes later a new build is processing in App
Store Connect under TestFlight. Every later release is the same one
click — no archive, no export, no Transporter, no Mac.

`CURRENT_PROJECT_VERSION` (the build number) is set automatically from
the CI run number, so uploads never collide on it; bump
`MARKETING_VERSION` (e.g. 1.0 → 1.1) in the Xcode project yourself when
the change is worth a new version number a user would see.

### Manual, from Xcode

Same outcome, by hand: **Product → Archive** (destination "Any iOS
Device", not a simulator) → **Distribute App** → **App Store Connect**.
Bump `MARKETING_VERSION` and `CURRENT_PROJECT_VERSION` in the target
first, the same as above.

> **"Redundant Binary Upload" / "You've already uploaded a build with
> build number 'N'."** App Store Connect refuses two uploads with the
> same `CURRENT_PROJECT_VERSION` under the same `MARKETING_VERSION`,
> forever — even a rejected or since-deleted one still counts. Target →
> **Signing & Capabilities** (or the General tab) → bump **Build** to
> anything higher than the last number you uploaded, then archive again.
> The automated release path above never hits this: it sets the build
> number from the CI run number, which only ever goes up.

### Either way, TestFlight first

On a real iPhone, before submitting for review:

- notifications arrive when the app is closed;
- tapping one opens the right list;
- the Settings toggle turns them on and off;
- signing in and staying signed in across a force-quit.

Only then submit for review. First review is typically 24–48 hours.

## Universal links (optional, later)

Not enabled, deliberately: the Associated Domains entitlement fails the
build outright unless the capability is on the App ID *and*
`https://machla.reemora.app/.well-known/apple-app-site-association`
serves the real Team ID. If it is ever wanted, all three have to happen
together — see the comment in `Machla/Machla.entitlements`.
