import Foundation

/// The only text this shell owns.
///
/// Everything a user reads in Machla comes from `locales/*.json` and is
/// rendered by the web app — except the one screen that exists precisely
/// because the web app could not be reached. It would be a poor joke for
/// the app that speaks twelve languages to fall back to English at the
/// only moment it has to speak for itself.
///
/// Keyed off the *device* language rather than the app's own language
/// picker: the picker's answer lives in a cookie inside the web view,
/// which by definition has not loaded when this screen is showing.
enum Strings {
    private static let offlineTitle: [String: String] = [
        "en": "No connection",
        "ar": "لا يوجد اتصال",
        "hi": "कोई कनेक्शन नहीं",
        "ur": "کوئی کنکشن نہیں",
        "ne": "इन्टरनेट छैन",
        "si": "සම්බන්ධතාවයක් නැත",
        "te": "కనెక్షన్ లేదు",
        "fil": "Walang koneksyon",
        "id": "Tidak ada koneksi",
        "am": "ግንኙነት የለም",
        "fr": "Pas de connexion",
        "fon": "Ganjɛ ɖé ǎ",
    ]

    private static let retry: [String: String] = [
        "en": "Try again",
        "ar": "أعد المحاولة",
        "hi": "फिर कोशिश करें",
        "ur": "دوبارہ کوشش کریں",
        "ne": "पुनः प्रयास गर्नुहोस्",
        "si": "නැවත උත්සාහ කරන්න",
        "te": "మళ్లీ ప్రయత్నించండి",
        "fil": "Subukan muli",
        "id": "Coba lagi",
        "am": "እንደገና ይሞክሩ",
        "fr": "Réessayer",
        "fon": "Tɛ́n kpɔ́n ɖevo",
    ]

    static var offlineTitleText: String { lookup(offlineTitle) }
    static var retryText: String { lookup(retry) }

    /// The device may report "ar-KW" or "pt-BR"; the table is keyed by
    /// language alone, and anything it does not carry falls back to
    /// English rather than showing a missing key.
    private static func lookup(_ table: [String: String]) -> String {
        let preferred = Locale.preferredLanguages.first ?? "en"
        let language = preferred.split(separator: "-").first.map(String.init) ?? "en"
        return table[language] ?? table["en"]!
    }
}
