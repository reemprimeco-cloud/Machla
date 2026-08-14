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

متوفر بـ١٢ لغة، حتى كل فرد بالبيت — أياً كانت لغته — يستخدمه بلغته هو.
```

## Keywords (100 chars max, comma-separated, no spaces after commas)

```
shopping list,household,groceries,helper,domestic worker,family,multilingual,Kuwait,checklist
```

## URLs

| Field | Value |
|---|---|
| **Support URL** | `mailto:reemprimeco@gmail.com` (or a support page, if one exists later) |
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

## App Review Information

| Field | Value |
|---|---|
| **Contact email** | `reemprimeco@gmail.com` |
| **Contact phone** | your number, for Apple to reach if needed |
| **Demo account — username** | `+96590909090` (registered as a Test OTP pair in Supabase — Authentication → Sign In / Up → Phone → Test OTP) |
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

Sign-in is a phone number and a one-time code, normally delivered over
WhatsApp — the demo account above bypasses that and logs in directly.
It belongs to a household with a sample list already in it, so there is
something to see on first launch.
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

- **Screenshots.** Need an actual running build on a Simulator or
  device — see `ios/README.md` "Screenshots" for exact sizes and what
  to capture.
- **App icon for App Store Connect.** Already built and wired into the
  Xcode project (`Machla/Assets.xcassets/AppIcon.appiconset`); Xcode
  submits it as part of the binary, nothing to upload separately here.
- **The Test OTP pair itself.** You still need to create it in
  Supabase (Authentication → Sign In / Up → Phone → Test OTP) before
  the demo account above is real — see `ios/README.md` step 7a.
