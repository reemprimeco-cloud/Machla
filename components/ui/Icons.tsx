/**
 * The shared line-icon set for every piece of app chrome — notification
 * bell, favorite heart, basket, search, and the rest of the action/status
 * icons scattered through the worker and household screens. All emoji
 * (2026-09-25: "غير اي ايموجي بالبرنامج الى صوره حقيقيه من تصميمنا").
 *
 * One drawing style throughout, matching the family HomeTabBar.tsx
 * started (HomeGlyph/BellGlyph/AccountGlyph): 24×24 viewBox at 23×23,
 * stroke width 1.9, round caps and joins, `currentColor` so a glyph
 * always matches its button's text color (active/inactive, RTL, dark
 * mode) without a second prop. Product/category catalog icons
 * (`products.icon`, `categories.icon`) are untouched — those are
 * database content, not app chrome, and stay emoji on purpose
 * (11-product-catalog-architecture.md: a big familiar glyph reads faster
 * than an image for a low-literacy shopper).
 */

type IconProps = { className?: string };

const BASE = {
  width: 23,
  height: 23,
  viewBox: "0 0 24 24",
  fill: "none" as const,
  "aria-hidden": true,
  focusable: false as const,
};

export function BellIcon({ className }: IconProps) {
  return (
    <svg {...BASE} className={className}>
      <path
        d="M12 3a5 5 0 00-5 5v3.2c0 .8-.3 1.5-.9 2.1L5 14.5h14l-1.1-1.2a3 3 0 01-.9-2.1V8a5 5 0 00-5-5z"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <path d="M10 17.5a2 2 0 004 0" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
    </svg>
  );
}

export function HomeIcon({ className }: IconProps) {
  return (
    <svg {...BASE} className={className}>
      <path
        d="M3 10.5L12 3l9 7.5V20a1 1 0 01-1 1h-5v-6H9v6H4a1 1 0 01-1-1z"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function HeartIcon({ filled = false, className }: IconProps & { filled?: boolean }) {
  return (
    <svg {...BASE} className={className}>
      <path
        d="M12 20s-7.5-4.6-10-9.2C.6 7.7 2.1 4.5 5.3 4c2-.3 3.9.6 5.2 2.4l1.5 2 1.5-2c1.3-1.8 3.2-2.7 5.2-2.4 3.2.5 4.7 3.7 3.3 6.8C19.5 15.4 12 20 12 20z"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinejoin="round"
        fill={filled ? "currentColor" : "none"}
      />
    </svg>
  );
}

export function BasketIcon({ className }: IconProps) {
  return (
    <svg {...BASE} className={className}>
      <path
        d="M4.5 9.5h15l-1.3 9.1a2 2 0 01-2 1.7H7.8a2 2 0 01-2-1.7L4.5 9.5z"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinejoin="round"
      />
      <path d="M3.5 9.5h17" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
      <path d="M8.5 9.5L9.8 5a2.4 2.4 0 014.4 0l1.3 4.5" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M9.5 13v4M14.5 13v4" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
    </svg>
  );
}

export function SearchIcon({ className }: IconProps) {
  return (
    <svg {...BASE} className={className}>
      <circle cx="10.5" cy="10.5" r="6.5" stroke="currentColor" strokeWidth="1.9" />
      <path d="M19.5 19.5L15.3 15.3" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
    </svg>
  );
}

export function TrashIcon({ className }: IconProps) {
  return (
    <svg {...BASE} className={className}>
      <path d="M4.5 6.5h15" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
      <path
        d="M6.5 6.5l.8 12.2a2 2 0 002 1.8h5.4a2 2 0 002-1.8l.8-12.2"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinejoin="round"
      />
      <path d="M9.5 6.5V4.3a1 1 0 011-1h3a1 1 0 011 1v2.2" stroke="currentColor" strokeWidth="1.9" strokeLinejoin="round" />
      <path d="M10.2 10v7M13.8 10v7" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
    </svg>
  );
}

export function CloseIcon({ className }: IconProps) {
  return (
    <svg {...BASE} className={className}>
      <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
    </svg>
  );
}

export function CheckIcon({ className }: IconProps) {
  return (
    <svg {...BASE} className={className}>
      <path d="M5 12.5l4.5 4.5L19 7" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function CheckCircleIcon({ className }: IconProps) {
  return (
    <svg {...BASE} className={className}>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.9" />
      <path d="M8 12.3l2.6 2.6L16.3 9" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function CameraIcon({ className }: IconProps) {
  return (
    <svg {...BASE} className={className}>
      <path
        d="M4 8.5a1.5 1.5 0 011.5-1.5h2l1-1.8a1 1 0 01.9-.5h5.2a1 1 0 01.9.5l1 1.8h2A1.5 1.5 0 0120 8.5v9A1.5 1.5 0 0118.5 19h-13A1.5 1.5 0 014 17.5v-9z"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="13" r="3.4" stroke="currentColor" strokeWidth="1.9" />
    </svg>
  );
}

export function LinkIcon({ className }: IconProps) {
  return (
    <svg {...BASE} className={className}>
      <path
        d="M9.5 14.5l5-5M10 8.5l1.3-1.3a3.2 3.2 0 014.5 4.5L14.5 13M14 15.5l-1.3 1.3a3.2 3.2 0 01-4.5-4.5L9.5 11"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function ChatIcon({ className }: IconProps) {
  return (
    <svg {...BASE} className={className}>
      <path
        d="M4 12a8 8 0 1113.9 5.4L20 20l-3-1.2A8 8 0 014 12z"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function MailIcon({ className }: IconProps) {
  return (
    <svg {...BASE} className={className}>
      <rect x="3.5" y="5.5" width="17" height="13" rx="1.6" stroke="currentColor" strokeWidth="1.9" />
      <path d="M4.5 6.5l7.5 6.3 7.5-6.3" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function LockIcon({ className }: IconProps) {
  return (
    <svg {...BASE} className={className}>
      <rect x="5.5" y="11" width="13" height="9" rx="1.8" stroke="currentColor" strokeWidth="1.9" />
      <path d="M8 11V7.5a4 4 0 018 0V11" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
      <circle cx="12" cy="15.3" r="1.3" fill="currentColor" />
    </svg>
  );
}

export function PersonIcon({ className }: IconProps) {
  return (
    <svg {...BASE} className={className}>
      <circle cx="12" cy="8" r="3.6" stroke="currentColor" strokeWidth="1.9" />
      <path d="M4.5 20c1.2-3.7 4-5.5 7.5-5.5s6.3 1.8 7.5 5.5" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
    </svg>
  );
}

export function WarningIcon({ className }: IconProps) {
  return (
    <svg {...BASE} className={className}>
      <path
        d="M12 4l9 15.5H3L12 4z"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinejoin="round"
      />
      <path d="M12 10v4" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
      <circle cx="12" cy="16.7" r="1" fill="currentColor" />
    </svg>
  );
}

export function SignalOffIcon({ className }: IconProps) {
  return (
    <svg {...BASE} className={className}>
      <path d="M4 4l16 16" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
      <path
        d="M6 15.5a10 10 0 0112.8-1.2M9 18.4a5.6 5.6 0 016.2.4"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="20.3" r="1.2" fill="currentColor" />
    </svg>
  );
}

export function InstallIcon({ className }: IconProps) {
  return (
    <svg {...BASE} className={className}>
      <path d="M12 3.5v11" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
      <path d="M8 11l4 4 4-4" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4.5 16v2.5a2 2 0 002 2h11a2 2 0 002-2V16" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function EyeIcon({ className }: IconProps) {
  return (
    <svg {...BASE} className={className}>
      <path
        d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="12" r="2.6" stroke="currentColor" strokeWidth="1.9" />
    </svg>
  );
}

export function ListIcon({ className }: IconProps) {
  return (
    <svg {...BASE} className={className}>
      <rect x="3.5" y="5" width="4" height="4" rx="1" stroke="currentColor" strokeWidth="1.9" />
      <path d="M10.5 7h10" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
      <rect x="3.5" y="15" width="4" height="4" rx="1" stroke="currentColor" strokeWidth="1.9" />
      <path d="M10.5 17h10" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
    </svg>
  );
}

export function LeafIcon({ className }: IconProps) {
  return (
    <svg {...BASE} className={className}>
      <path
        d="M5 19c-1-7 3-13 14-14 1 11-5 15-14 14z"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinejoin="round"
      />
      <path d="M6 18c3-4 7-7 12-12" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
    </svg>
  );
}

export function ChevronIcon({ className }: IconProps) {
  return (
    <svg {...BASE} className={className}>
      <path d="M9 5l7 7-7 7" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
