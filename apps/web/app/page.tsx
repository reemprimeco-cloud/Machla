import { branding } from "@/lib/branding";
import { LOCALES } from "@/lib/i18n/config";
import { getMessages } from "@/lib/i18n/messages";

// Phase 1 "basic responsive shell" placeholder. Real screens — language
// picker, phone/OTP login, worker categories, household dashboard — start
// in Phase 2/3/6/7. This page only proves branding, Tailwind, and the
// locale-file loader are wired together end to end.
export default function HomePage() {
  const messages = getMessages("en");

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-8 px-6 py-16 text-center">
      <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-brand text-brand-foreground shadow-sm">
        <span className="text-3xl font-semibold">H</span>
      </div>

      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">{branding.name}</h1>
        <p className="text-base text-neutral-600">{messages.app.tagline}</p>
      </div>

      <div className="w-full rounded-2xl border border-neutral-200 p-5 text-sm text-neutral-600">
        <p className="font-medium text-neutral-800">{messages.common.comingSoon}</p>
        <p className="mt-1">
          Phase 1 — Project Setup. Language selection, phone + OTP sign-in,
          and the worker/household experiences arrive in later phases.
        </p>
      </div>

      <ul className="flex w-full flex-wrap justify-center gap-2">
        {LOCALES.map((locale) => (
          <li
            key={locale.code}
            dir={locale.direction}
            className="rounded-full border border-neutral-200 px-3 py-1 text-sm text-neutral-700"
          >
            {locale.nativeName}
          </li>
        ))}
      </ul>
    </main>
  );
}
