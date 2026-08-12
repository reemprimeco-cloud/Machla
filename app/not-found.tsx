import { HomeLink, MessageScreen } from "@/components/ui/States";
import { getMessages } from "@/lib/i18n/messages";
import { DEFAULT_LOCALE } from "@/lib/i18n/config";
import { cookies } from "next/headers";
import { LOCALE_COOKIE_NAME } from "@/lib/i18n/cookie";
import { isSupportedLocale } from "@/lib/i18n/config";

/** 404. Read as a Server Component so the copy is localized on first
 * paint, the same way the root layout resolves direction. */
export default async function NotFound() {
  const cookieStore = await cookies();
  const cookieLocale = cookieStore.get(LOCALE_COOKIE_NAME)?.value;
  const locale = cookieLocale && isSupportedLocale(cookieLocale) ? cookieLocale : DEFAULT_LOCALE;
  const messages = getMessages(locale);

  return (
    <MessageScreen
      glyph="🔍"
      title={messages.state.notFoundTitle}
      hint={messages.state.notFoundHint}
      action={<HomeLink />}
    />
  );
}
