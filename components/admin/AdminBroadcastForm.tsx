"use client";

import { useState } from "react";

import { sendAdminBroadcastAction, type AdminBroadcastAudience } from "@/lib/admin/broadcast";

/** The admin page's "communication" section — a manual push to iPhone
 * (APNs) devices, either everyone or just the owners of households whose
 * free trial lapsed without subscribing (subscriptionsLapsed — same
 * count as the "التسجيلات" stats above). Plain Arabic, no `t()`, same
 * reasoning as the rest of AdminDashboard.tsx: internal tool, not
 * customer-facing. */
export function AdminBroadcastForm({
  iosDeviceCount,
  lapsedHouseholdCount,
}: {
  iosDeviceCount: number;
  lapsedHouseholdCount: number;
}) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [audience, setAudience] = useState<AdminBroadcastAudience>("all");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setStatus("sending");
    setMessage(null);

    const result = await sendAdminBroadcastAction(title, body, audience);

    if (!result.ok) {
      setStatus("error");
      setMessage(
        result.code === "NO_DEVICES"
          ? "ما فيه أجهزة آيفون لهالفئة حالياً."
          : result.code === "INVALID_INPUT"
            ? "اكتب عنوان ونص للإشعار."
            : "الإشعارات غير مفعّلة على السيرفر حالياً.",
      );
      return;
    }

    setStatus("sent");
    setMessage(`تم الإرسال إلى ${result.sent} من ${result.total} جهاز.`);
    setTitle("");
    setBody("");
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-3 rounded-lg border border-line bg-surface p-4 shadow-sm"
    >
      <p className="hl-caption text-ink-muted">يصل فقط لأجهزة الآيفون.</p>

      <div className="flex gap-2 rounded-pill border border-line bg-surface-2 p-1">
        <button
          type="button"
          onClick={() => setAudience("all")}
          className={`hl-label flex-1 rounded-pill px-3 py-2 transition-colors duration-150 ease-hl ${
            audience === "all" ? "bg-primary text-on-primary" : "text-ink-muted"
          }`}
        >
          الجميع ({iosDeviceCount} جهاز)
        </button>
        <button
          type="button"
          onClick={() => setAudience("trial_lapsed")}
          className={`hl-label flex-1 rounded-pill px-3 py-2 transition-colors duration-150 ease-hl ${
            audience === "trial_lapsed" ? "bg-primary text-on-primary" : "text-ink-muted"
          }`}
        >
          انتهت تجربتهم ({lapsedHouseholdCount} بيت)
        </button>
      </div>

      <input
        type="text"
        placeholder="عنوان الإشعار"
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        className="hl-body min-h-11 w-full rounded-lg border border-line bg-surface-2 px-3 text-ink outline-none focus-visible:border-primary"
      />
      <textarea
        placeholder="نص الرسالة"
        value={body}
        onChange={(event) => setBody(event.target.value)}
        rows={3}
        className="hl-body w-full rounded-lg border border-line bg-surface-2 px-3 py-2 text-ink outline-none focus-visible:border-primary"
      />
      {message ? (
        <p className={`hl-caption ${status === "error" ? "text-danger" : "text-success"}`}>
          {message}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={status === "sending" || !title.trim() || !body.trim()}
        className="hl-label min-h-11 rounded-lg bg-primary px-4 text-on-primary shadow-sm disabled:opacity-60"
      >
        {status === "sending" ? "جارٍ الإرسال…" : "إرسال إلى الآيفونات"}
      </button>
    </form>
  );
}
