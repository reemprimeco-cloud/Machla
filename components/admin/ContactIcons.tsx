/** WhatsApp + email shortcuts next to a user/owner row on the admin
 * page — reaching someone directly (a lapsed trial, a fresh sign-up)
 * used to mean copying a phone number out by hand. wa.me needs digits
 * only, no leading "+" (phone_number is stored E.164, e.g. "+96565...").
 * Email is most accounts' one still-missing field (Phase 1 of removing
 * OTP, 20260919120000_email_password_identity.sql) — shown disabled
 * rather than omitted, so its absence reads as "no email yet", not a
 * layout glitch. */
export function ContactIcons({ phone, email }: { phone: string; email: string | null }) {
  const waNumber = phone.replace(/\D/g, "");

  return (
    <div className="flex items-center gap-2">
      <a
        href={`https://wa.me/${waNumber}`}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="راسل واتساب"
        title="واتساب"
        className="flex size-8 items-center justify-center rounded-pill bg-success-tint text-base"
      >
        <span aria-hidden>💬</span>
      </a>
      {email ? (
        <a
          href={`mailto:${email}`}
          aria-label="راسل إيميل"
          title={email}
          className="flex size-8 items-center justify-center rounded-pill bg-primary-tint text-base"
        >
          <span aria-hidden>✉️</span>
        </a>
      ) : (
        <span
          aria-hidden
          title="لا يوجد إيميل بعد"
          className="flex size-8 items-center justify-center rounded-pill bg-surface-2 text-base opacity-40"
        >
          ✉️
        </span>
      )}
    </div>
  );
}
