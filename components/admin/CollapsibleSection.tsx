/** Plain <details>/<summary> — no client JS needed for the collapse
 * itself, keeps /admin/photos' growing list of sections (PENDING,
 * global search, per-category browser) from all being open and long at
 * once. */
export function CollapsibleSection({
  title,
  subtitle,
  defaultOpen = false,
  children,
}: {
  title: string;
  subtitle?: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  return (
    <details open={defaultOpen} className="group rounded-lg border border-line bg-surface">
      <summary className="hl-label flex cursor-pointer list-none items-center justify-between px-3 py-2.5 text-ink marker:content-none">
        <span>{title}</span>
        <span className="text-ink-muted transition-transform group-open:rotate-180">▾</span>
      </summary>
      <div className="flex flex-col gap-2 border-t border-line px-3 py-3">
        {subtitle ? <p className="hl-caption text-ink-muted">{subtitle}</p> : null}
        {children}
      </div>
    </details>
  );
}
