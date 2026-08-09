/**
 * HomeList — Concept A "Roofline" (docs/design/BRAND.md).
 * Ported from the HomeList UI Kit. Pure SVG, no hooks/browser APIs — safe
 * to use as a Server Component.
 *
 * Two renderings of the same mark:
 *   variant="flat"  -> solid fills. Use everywhere in the UI: nav, headers,
 *                      empty states, print, anything under 128px.
 *   variant="tile"  -> gradients + bevel. App icon, splash, marketing only.
 *                      Don't use below 64px — the bevel turns to mud.
 *
 * The mark is decorative when it sits beside the wordmark — pass `title`
 * only when it stands alone as the sole identifier of the app.
 */

interface HomeListIconProps {
  size?: number;
  variant?: "flat" | "tile";
  /** Accessible name. Omit when the wordmark or an adjacent label already names it. */
  title?: string;
  className?: string;
}

const GREEN = "#1F6B57";
const CREAM = "#F6EEDF";

/** Caregiver + child. Local box: x 40-168, y 18-170. */
function Figures({ fill, opacity = 1 }: { fill: string; opacity?: number }) {
  return (
    <g fill={fill} opacity={opacity}>
      <path d="M40,170 C40,100 56,78 78,78 C100,78 116,100 116,170 Z" />
      <circle cx="78" cy="44" r="26" />
      <path d="M124,170 C124,142 132,130 146,130 C160,130 168,142 168,170 Z" />
      <circle cx="146" cy="100" r="17" />
    </g>
  );
}

export function HomeListIcon({ size = 40, variant = "flat", title, className }: HomeListIconProps) {
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
        <defs>
          <linearGradient id={`${uid}-body`} x1="0.15" y1="0" x2="0.85" y2="1">
            <stop offset="0%" stopColor="#3C9C7C" />
            <stop offset="45%" stopColor={GREEN} />
            <stop offset="100%" stopColor="#0E3D30" />
          </linearGradient>
          <linearGradient id={`${uid}-bevel`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#FFF" stopOpacity="0.40" />
            <stop offset="55%" stopColor="#FFF" stopOpacity="0.06" />
            <stop offset="100%" stopColor="#FFF" stopOpacity="0" />
          </linearGradient>
          <linearGradient id={`${uid}-roof`} x1="0" y1="0" x2="0.3" y2="1">
            <stop offset="0%" stopColor="#FFFFFF" />
            <stop offset="60%" stopColor={CREAM} />
            <stop offset="100%" stopColor="#D9C6A6" />
          </linearGradient>
        </defs>
      )}

      <rect
        width="512"
        height="512"
        rx="120"
        fill={variant === "tile" ? `url(#${uid}-body)` : GREEN}
      />
      {variant === "tile" && <rect width="512" height="512" rx="120" fill={`url(#${uid}-bevel)`} />}

      <path
        d="M56,262 L256,96 L456,262 L456,306 L256,140 L56,306 Z"
        fill={variant === "tile" ? `url(#${uid}-roof)` : CREAM}
      />

      <g transform="translate(95,178.1) scale(1.55)">
        <Figures fill={CREAM} />
      </g>

      <rect x="146" y="452" width="220" height="20" rx="10" fill={CREAM} opacity="0.55" />
    </svg>
  );
}

/** Horizontal lockup: mark + bilingual wordmark. */
export function HomeListLockup({
  size = 36,
  showArabic = true,
}: {
  size?: number;
  showArabic?: boolean;
}) {
  return (
    <span
      role="img"
      aria-label="HomeList"
      style={{ display: "inline-flex", alignItems: "center", gap: size * 0.34 }}
    >
      <HomeListIcon size={size} />
      <span style={{ display: "flex", flexDirection: "column", lineHeight: 1.05 }}>
        <span
          style={{
            fontFamily: "var(--font-latin)",
            fontWeight: 700,
            fontSize: size * 0.62,
            letterSpacing: "-0.015em",
            color: "var(--hl-ink)",
          }}
        >
          HomeList
        </span>
        {showArabic && (
          <span
            dir="rtl"
            style={{
              fontFamily: "var(--font-arabic)",
              fontWeight: 600,
              fontSize: size * 0.42,
              color: "var(--hl-green-700)",
            }}
          >
            هوم ليست
          </span>
        )}
      </span>
    </span>
  );
}

export default HomeListIcon;
