import { branding } from "@/lib/branding";

/**
 * Machla mark — a shopping basket carrying two leaves, with an M in the
 * basket (docs/design/BRAND.md, Machla UI Kit 2026-08 refresh). Pure SVG,
 * no hooks/browser APIs — safe to use as a Server Component.
 *
 * Two renderings of the same mark:
 *   variant="flat"  -> solid leaf greens + pink cart outline. Use
 *                      everywhere in the UI: nav, headers, empty states,
 *                      print, anything under 64px — no background tile.
 *   variant="tile"  -> the full magenta-to-amber gradient, on the white
 *                      -to-pink-tint square tile. App icon, splash,
 *                      marketing only; matches app/icon.svg exactly.
 *
 * The mark is decorative when it sits beside the wordmark — pass `title`
 * only when it stands alone as the sole identifier of the app.
 */

interface MachlaIconProps {
  size?: number;
  variant?: "flat" | "tile";
  /** Accessible name. Omit when the wordmark or an adjacent label already names it. */
  title?: string;
  className?: string;
}

/** The basket + M, identical geometry in both variants — only the fills differ. */
function Mark({ uid, gradient }: { uid: string; gradient: boolean }) {
  const leafA = gradient ? `url(#${uid}-lLa)` : "#00C186";
  const leafB = gradient ? `url(#${uid}-lLb)` : "#00915B";
  const leafC = gradient ? `url(#${uid}-lRa)` : "#00C186";
  const leafD = gradient ? `url(#${uid}-lRb)` : "#00915B";
  const cart = gradient ? `url(#${uid}-cart)` : "#F5297F";
  const letter = gradient ? `url(#${uid}-letter)` : "#F5297F";

  return (
    <>
      {gradient && (
        <defs>
          <linearGradient
            id={`${uid}-cart`}
            x1="84"
            y1="436"
            x2="446"
            y2="70"
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0" stopColor="#FF00CF" />
            <stop offset=".16" stopColor="#FA1F9E" />
            <stop offset=".38" stopColor="#FA4685" />
            <stop offset=".58" stopColor="#FA6062" />
            <stop offset=".74" stopColor="#FB8A2E" />
            <stop offset=".90" stopColor="#FFA80D" />
            <stop offset="1" stopColor="#FFC400" />
          </linearGradient>
          <linearGradient
            id={`${uid}-letter`}
            x1="240"
            y1="330"
            x2="350"
            y2="240"
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0" stopColor="#FA4F73" />
            <stop offset=".55" stopColor="#FA7A5A" />
            <stop offset="1" stopColor="#FFB552" />
          </linearGradient>
          <linearGradient
            id={`${uid}-lLa`}
            x1="92"
            y1="92"
            x2="302"
            y2="200"
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0" stopColor="#00B074" />
            <stop offset="1" stopColor="#00F2D8" />
          </linearGradient>
          <linearGradient
            id={`${uid}-lLb`}
            x1="100"
            y1="100"
            x2="302"
            y2="204"
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0" stopColor="#007F4E" />
            <stop offset="1" stopColor="#00C186" />
          </linearGradient>
          <linearGradient
            id={`${uid}-lRa`}
            x1="414"
            y1="22"
            x2="316"
            y2="196"
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0" stopColor="#00F0E6" />
            <stop offset="1" stopColor="#00B4A8" />
          </linearGradient>
          <linearGradient
            id={`${uid}-lRb`}
            x1="406"
            y1="34"
            x2="316"
            y2="196"
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0" stopColor="#00A6B0" />
            <stop offset="1" stopColor="#00707E" />
          </linearGradient>
        </defs>
      )}

      {/* Two leaves. */}
      <path
        d="M302,200 C222,214 136,182 92,92 C182,60 272,102 302,200 Z"
        fill={leafA}
      />
      <path
        d="M302,200 C222,214 136,182 92,92 C190,118 264,150 302,200 Z"
        fill={leafB}
      />
      <path
        d="M316,196 C300,116 336,54 414,22 C438,102 400,166 316,196 Z"
        fill={leafC}
      />
      <path
        d="M316,196 C300,116 336,54 414,22 C362,96 326,148 316,196 Z"
        fill={leafD}
      />

      {/* Basket outline. */}
      <path
        d="M74,208 L142,200"
        stroke={cart}
        strokeWidth="26"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <path
        d="M140,200 L424,192 L410,352 L186,360 Z"
        stroke={cart}
        strokeWidth="26"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <path
        d="M182,382 L404,368"
        stroke={cart}
        strokeWidth="26"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <circle
        cx="258"
        cy="424"
        r="27"
        stroke={cart}
        strokeWidth="26"
        fill="none"
      />
      <circle
        cx="378"
        cy="410"
        r="27"
        stroke={cart}
        strokeWidth="26"
        fill="none"
      />

      {/* The M. */}
      <path
        d="M242,336 L250,240 L296,300 L336,234 L348,326"
        stroke={letter}
        strokeWidth="32"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </>
  );
}

export function MachlaIcon({
  size = 40,
  variant = "flat",
  title,
  className,
}: MachlaIconProps) {
  const uid = variant === "tile" ? "hl-tile" : "hl-flat";
  const a11y = title
    ? { role: "img" as const, "aria-label": title }
    : { "aria-hidden": true as const, focusable: false as const };

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 512 512"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      {...a11y}
    >
      {variant === "tile" && (
        <>
          <defs>
            <linearGradient id={`${uid}-bg`} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#FFFFFF" />
              <stop offset="1" stopColor="#FFF3F8" />
            </linearGradient>
          </defs>
          <rect
            width="512"
            height="512"
            rx="114.5344"
            fill={`url(#${uid}-bg)`}
          />
        </>
      )}

      <g
        transform={
          variant === "tile"
            ? "translate(256,256) scale(0.84) translate(-256,-256)"
            : undefined
        }
      >
        <Mark uid={uid} gradient={variant === "tile"} />
      </g>
    </svg>
  );
}

/**
 * Horizontal lockup: mark + bilingual wordmark.
 *
 * Reads the name from branding.ts rather than hard-coding it — this is
 * the one component that used to hard-code "HomeList" directly, which is
 * exactly the mistake the master plan's "centralize the brand name" rule
 * exists to prevent. It surfaced during the Machla rename: everywhere
 * else already imported from branding.ts, so the rename was a one-file
 * change except here.
 */
export function MachlaLockup({
  size = 36,
  showArabic = true,
}: {
  size?: number;
  showArabic?: boolean;
}) {
  return (
    <span
      role="img"
      aria-label={branding.name}
      style={{ display: "inline-flex", alignItems: "center", gap: size * 0.34 }}
    >
      <MachlaIcon size={size} />
      <span
        style={{ display: "flex", flexDirection: "column", lineHeight: 1.05 }}
      >
        <span
          style={{
            fontFamily: "var(--font-latin)",
            fontWeight: 700,
            fontSize: size * 0.62,
            letterSpacing: "-0.015em",
            color: "var(--hl-ink)",
          }}
        >
          {branding.name}
        </span>
        {showArabic && (
          <span
            dir="rtl"
            style={{
              fontFamily: "var(--font-arabic)",
              fontWeight: 600,
              fontSize: size * 0.42,
              color: "var(--hl-primary)",
            }}
          >
            {branding.nameAr}
          </span>
        )}
      </span>
    </span>
  );
}

export default MachlaIcon;
