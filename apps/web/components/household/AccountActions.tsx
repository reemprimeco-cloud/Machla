"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { useLocale } from "@/lib/i18n/LocaleProvider";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/isConfigured";

/** Change-language and log-out, shared by the household and worker
 * shells so both experiences always offer a way out. */
export function AccountActions() {
  const router = useRouter();
  const { t } = useLocale();
  const [signingOut, setSigningOut] = useState(false);

  async function handleLogout() {
    setSigningOut(true);
    if (isSupabaseConfigured()) {
      const supabase = createClient();
      await supabase.auth.signOut();
    }
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="mt-auto flex items-center justify-center gap-6 pt-6">
      <Link href="/welcome" className="hl-caption text-green-700 underline underline-offset-4">
        {t("common.changeLanguage")}
      </Link>
      <button
        type="button"
        onClick={handleLogout}
        disabled={signingOut}
        className="hl-caption text-danger underline underline-offset-4 disabled:opacity-60"
      >
        {t("common.logout")}
      </button>
    </div>
  );
}
