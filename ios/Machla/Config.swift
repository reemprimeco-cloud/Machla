import Foundation
import UIKit

/// Everything about this shell that could differ between one build and
/// another, in one place — because the rest of the app is deliberately
/// dull, and this is the only file anyone should need to edit to point it
/// somewhere else.
enum Config {
    /// The live app. This shell has no copy of the site: it is the same
    /// Next.js app the browser gets, which is what keeps the App Store
    /// build from drifting behind the web one between releases.
    static let siteURL = URL(string: "https://machla.reemora.app")!

    /// Links to anywhere else open outside the app. Comparing hosts is
    /// what decides that, so it must match `siteURL`'s host exactly.
    static let allowedHost = "machla.reemora.app"

    /// The name the page addresses this shell by:
    /// `window.webkit.messageHandlers.machla.postMessage(...)`.
    /// Must equal HANDLER_NAME in lib/native/bridge.ts.
    static let bridgeName = "machla"

    /// --hl-bg from app/globals.css. Painted behind the web view so the
    /// status bar and the area under the home indicator match the page
    /// instead of showing black while it loads.
    static let backgroundColor = UIColor(
        red: 0xF7 / 255, green: 0xF8 / 255, blue: 0xFA / 255, alpha: 1
    )

    /// Whether the user has asked for notifications *in this app*. iOS
    /// tracks its own permission, but permission is not preference: once
    /// granted it survives the user turning notifications off in
    /// Settings > Notifications inside Machla, and without somewhere to
    /// record that the toggle would spring straight back on.
    static let wantsPushKey = "machla.wantsPush"
}
