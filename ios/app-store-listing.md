# App Store Connect submission packet

Every field App Store Connect asks for, written out so filling in the
form is copy-paste, not composition. Pulled from what the app actually
says about itself (`locales/en.json` `about.*`, `lib/branding.ts`,
`Machla/PrivacyInfo.xcprivacy`) rather than written fresh for this
document — so it can't drift from the truth the app tells its own users.

Why this exists as a document rather than being filled in directly:
App Store Connect requires signing in with your own Apple ID, normally
behind two-factor authentication that reaches your phone. That is
something only you can do — no assistant should ever be handed an Apple
ID password or a 2FA code, and this one won't ask for either. Everything
below is instead prepared so the actual browser session is quick.

---

## App Information

| Field | Value |
|---|---|
| **Name** | `Machlati` — see `ios/README.md` "App Store Connect" for why this differs from the app's own name |
| **Subtitle** (30 chars max) | `Shopping lists for your home` |
| **Primary language** | English (add Arabic as a second App Store localization — see below) |
| **Bundle ID** | `app.reemora.machla` |
| **SKU** | `machla-ios-1` (any string you won't reuse; not shown to users) |
| **Category** | Shopping |
| **Secondary category** | Productivity |

## Pricing and Availability

| Field | Value |
|---|---|
| **Price** | Free |
| **Availability** | Kuwait, at minimum — add other countries only if you intend to support them; a household in a country Twilio/WhatsApp OTP doesn't reach can't sign in |

## Description (4000 chars max — this is ~600)

```
Machla is a shared shopping list for your household and the person who
shops for it — connecting families with domestic workers, in any
language.

Add what your home needs. Your helper sees it grouped by category —
Dairy, Bakery, Meat & Fish, and more — browses the aisle, and checks
items off as they're bought. You get the list back exactly as it was
shopped: what was found, what wasn't, with a note on anything specific
("lactose-free", "2 litre") instead of a dozen near-identical products
to choose between.

Notifications tell you the moment a list is sent, opened, or finished —
right on your phone, not buried in an app you have to remember to open.

Once a list is done, it's done: your home screen stays clean, with
nothing left over to sort through.

This app is for the household side — it's where lists are sent from
and where notifications arrive. The person shopping for you can use
Machla from any phone, iPhone or not, through the website — no app
required on their end.

Available in 12 languages, so everyone in the household — however they
read — can use it in their own.
```

Arabic version, for the Arabic App Store localization:

```
ماچلة قائمة تسوق مشتركة بين بيتك ومن يتسوق لك — تربط العائلات بالعاملات
والعمال المنزليين، بأي لغة.

أضيفي ما يحتاجه بيتك. تشوفها العاملة مقسّمة حسب القسم — الألبان،
المخبوزات، اللحوم والدجاج والسمك، وغيرها — وتتصفح وتؤشر على كل منتج
تشتريه. تستلمين القائمة بالضبط زي ما تسوّقت: وش تم توفيره ووش لا، مع
ملاحظة على أي منتج محدد ("خالٍ من اللاكتوز"، "٢ لتر") بدل عشرات
المنتجات المتشابهة.

إشعارات تخبرك لحظة إرسال القائمة أو فتحها أو انتهائها — على جوالك
مباشرة، مو مدفونة بتطبيق لازم تتذكرين تفتحينه.

لما تنتهي القائمة، تنتهي فعلاً: صفحتك الرئيسية تضل مرتبة، بدون أي شي
معلّق تراجعينه.

هذا التطبيق لجانب البيت — منه ترسلين القائمة وتوصلك الإشعارات. أما
اللي تتسوق لك فتقدر تستخدم ماچلة من أي جوال، حتى لو مو آيفون، عن طريق
الموقع — بدون ما تحتاج تطبيق من جهتها.

متوفر بـ١٢ لغة، حتى كل فرد بالبيت — أياً كانت لغته — يستخدمه بلغته هو.
```

## Keywords (100 chars max, comma-separated, no spaces after commas)

```
shopping list,household,groceries,helper,domestic worker,family,multilingual,Kuwait,checklist
```

## URLs

| Field | Value |
|---|---|
| **Support URL** | `https://machla.reemora.app/support` — App Store Connect's Support URL field requires an http(s) link (a `mailto:` link is rejected by the form), so this is a real public page with the same contact email on it |
| **Marketing URL** | `https://machla.reemora.app` (optional — leave blank if you'd rather not) |
| **Privacy Policy URL** | `https://machla.reemora.app/privacy` — public, no account needed, served in all 12 languages |

## Age Rating questionnaire

Every question in Apple's questionnaire should be answered **No** /
**None** — the app has no violence, no mature content, no gambling, no
user-generated content visible to strangers (shopping lists are private
to a household), no unrestricted web access. Result: **4+**.

## App Privacy (the "Privacy" tab's questionnaire)

Must agree with `Machla/PrivacyInfo.xcprivacy`, which already declares
this exactly. For each data type below: **Yes, we collect this** →
**Linked to the user** → **Used for App Functionality** → **Not used
for Tracking**.

| Data type | Collected? |
|---|---|
| Phone Number | Yes — sign-in |
| Name | Yes — display name shown to household/helper |
| Photos or Videos | Yes — photographed items not in the catalogue, deleted after purchase or when the list finishes |
| Other User Content | Yes — the shopping lists themselves |
| Precise/Coarse Location | No |
| Contacts | No |
| Financial Info | No |
| Health & Fitness | No |
| Browsing/Search History | No |
| Identifiers (e.g. advertising ID) | No |
| Usage Data / Analytics | No |
| Diagnostics | No |

**Tracking**: No — answer "No" to "Do you or your third-party partners
use data collected from this app to track users?". Nothing here is used
for advertising or shared with a data broker.

## Content Rights

**"Does your app contain, show, or access third-party content?"** →
**Yes, it contains, shows, or accesses third-party content, and I have
the necessary rights.** The product catalogue includes licensed stock
photography alongside AI-generated and owner-photographed images — see
`catalog-import/images/README.md` for the licensing rules that governed
every image that made it into the catalogue. "No third-party content"
would be false.

## App Review Information

| Field | Value |
|---|---|
| **Contact email** | `reemprimeco@gmail.com` |
| **Contact phone** | your number, for Apple to reach if needed |
| **Demo account — username** | the value of `DEMO_ACCOUNT_PHONE` on Vercel. Signs in via a direct server-side bypass, not Twilio/WhatsApp/Supabase Test OTP — see `lib/auth/demoAccount.ts` and `06-auth-otp-flow.md`. Not written here on purpose (a real, owner-identifying number; this repo is public). |
| **Demo account — password** | `123456` |
| **Sign-in required** | Yes |

**Notes** (paste into the Review Notes box):

```
Machla is the iOS client for a household shopping-list service used in
Kuwait, connecting families with the domestic workers who shop for
them. Accounts, households and lists are server-side; the app is the
client for that service, not a repackaged marketing site.

The app implements native push notifications through APNs (a household
is notified when a list is sent, opened or completed) — the feature the
service is built around, and one that is not available to a website on
iOS. It also handles connectivity loss natively, in the user's own
language.

This iOS app is built for the household side of that relationship — the
person who sends the list and needs to know the moment it's shopped.
The domestic worker who does the actual shopping uses the same service
from her own phone, Android included, through the website — nothing
about the service requires her device to be an iPhone.

Sign-in is a phone number and a one-time code, normally delivered over
WhatsApp — the demo account above bypasses that and logs in directly.
It belongs to a household with a sample list already in it, so there is
something to see on first launch.

Account deletion (Guideline 5.1.1(v)) is available from inside the app:
Settings → Danger zone → Delete my account. It permanently deletes the
Supabase auth account; if the account owns a household, that household
and everything in it (lists, members, invitations) is deleted too, not
just the caller's own membership.
```

## Version Information (for build 1.0)

| Field | Value |
|---|---|
| **What's New in This Version** | `First release.` (App Store requires something here even for version 1.0) |
| **Copyright** | `2026 reemora.app` |

## Export Compliance

Already answered by `ITSAppUsesNonExemptEncryption = false` in
`Machla/Info.plist` — App Store Connect should not even ask this
question per upload. If it does: the app uses only standard HTTPS, no
proprietary encryption, so the answer is **No**.

---

## What is NOT in this document

- **`SUPABASE_SERVICE_ROLE_KEY` in Vercel.** Required for account
  deletion (Settings → Danger zone) to actually work — without it the
  app fails cleanly with "not configured" instead of partially
  deleting anything. Add it as a **server-side** environment variable
  (Production + Preview) in the Vercel project settings, the same way
  the VAPID/APNs secrets were added; never as `NEXT_PUBLIC_*`, never
  committed to the repo. Get the value from Supabase → Project
  Settings → API → service_role key.
- **Screenshots.** Need an actual running build on a Simulator or
  device — see `ios/README.md` "Screenshots" for exact sizes and what
  to capture.
- **App icon for App Store Connect.** Already built and wired into the
  Xcode project (`Machla/Assets.xcassets/AppIcon.appiconset`); Xcode
  submits it as part of the binary, nothing to upload separately here.
- **`DEMO_ACCOUNT_PHONE` in Vercel.** The demo account isn't real until
  this is set — server-side only, no `NEXT_PUBLIC_*` prefix, never
  committed to the repo. Also needs `SUPABASE_SERVICE_ROLE_KEY` (already
  covered above) since the sign-in bypass uses the admin API. See
  `ios/README.md`'s App Review notes section and
  `06-auth-otp-flow.md`.
