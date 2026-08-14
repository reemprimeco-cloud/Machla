import Foundation
import UIKit
import UserNotifications
import WebKit

/// The whole contract between the page and this shell.
///
/// It is small on purpose. Everything Machla does — lists, products,
/// languages, authentication — is the web app's job and stays there. The
/// only thing the shell can do that a browser cannot is receive Apple
/// push notifications, so that is the only thing it offers.
///
/// The channel avoids injected JavaScript entirely. The site serves a
/// strict `script-src 'self' 'nonce-…' 'strict-dynamic'` (proxy.ts), and
/// a script this app injected would carry neither the nonce nor a hash
/// the page vouches for — WebKit may refuse it, and relaxing the policy
/// to make room would trade the app's main XSS defence for packaging
/// convenience. Instead:
///
///   page  -> shell   `window.webkit.messageHandlers.machla.postMessage`
///                    is a host object WebKit installs on the window; no
///                    script is loaded, so no policy applies.
///   shell -> page    `evaluateJavaScript` is a native call, outside the
///                    document's content policy altogether.
///
/// See lib/native/bridge.ts for the same contract from the other side.
final class NativeBridge: NSObject {
    static let shared = NativeBridge()

    private weak var webView: WKWebView?
    private var deviceToken: String?

    /// Set when a notification is tapped while the app is not running.
    /// The web view reads it instead of the home page on first load, so
    /// tapping "list finished" opens that list rather than the dashboard.
    private var launchPath: String?

    private override init() {}

    // MARK: - Wiring

    func attach(_ webView: WKWebView) {
        self.webView = webView
    }

    /// The URL the web view should open now: a notification's
    /// destination if one is waiting, otherwise the app itself. Consumes
    /// the pending path, so a later launch is not sent somewhere stale.
    func takeInitialURL() -> URL {
        defer { launchPath = nil }
        guard let path = launchPath,
              let url = URL(string: path, relativeTo: Config.siteURL)
        else { return Config.siteURL }
        return url.absoluteURL
    }

    // MARK: - page -> shell

    func handle(message body: Any) {
        guard let request = body as? [String: Any],
              let type = request["type"] as? String
        else { return }

        switch type {
        case "push:status":
            // Also re-sends the device token. The page asks this as soon
            // as it mounts, which makes it the reliable moment to hand
            // over a token that arrived before there was anything on the
            // other end to receive it.
            reportStatus(includingToken: true)

        case "push:enable":
            enablePush()

        case "push:disable":
            UserDefaults.standard.set(false, forKey: Config.wantsPushKey)
            UIApplication.shared.unregisterForRemoteNotifications()
            reportStatus(includingToken: false)

        default:
            break
        }
    }

    private func enablePush() {
        UserDefaults.standard.set(true, forKey: Config.wantsPushKey)

        UNUserNotificationCenter.current()
            .requestAuthorization(options: [.alert, .badge, .sound]) { [weak self] granted, _ in
                guard let self else { return }
                if granted {
                    // Registering is a separate step from being allowed
                    // to, and it must happen on the main thread — it is
                    // what actually produces a device token, delivered
                    // to AppDelegate.
                    DispatchQueue.main.async {
                        UIApplication.shared.registerForRemoteNotifications()
                    }
                }
                self.reportStatus(includingToken: granted)
            }
    }

    // MARK: - shell -> page

    /// Registration succeeded: APNs has given this installation an
    /// address. Called at every launch while notifications are on, not
    /// only the first time, because Apple may rotate the token whenever
    /// it likes — and a rotated token that never reaches the server means
    /// an iPhone that silently stops being notified.
    func didRegister(deviceToken data: Data) {
        let token = data.map { String(format: "%02x", $0) }.joined()
        deviceToken = token
        send("onPushToken", argument: token)
    }

    func reportStatus(includingToken: Bool) {
        UNUserNotificationCenter.current().getNotificationSettings { [weak self] settings in
            guard let self else { return }
            let wants = UserDefaults.standard.bool(forKey: Config.wantsPushKey)

            let status: String
            switch settings.authorizationStatus {
            case .denied:
                status = "denied"
            case .authorized, .provisional, .ephemeral:
                // Allowed by iOS, but the user may still have turned
                // notifications off inside the app — see Config.wantsPushKey.
                status = wants ? "granted" : "off"
            default:
                status = "off"
            }

            self.send("onPushStatus", argument: status)
            if includingToken, let token = self.deviceToken {
                self.send("onPushToken", argument: token)
            }
        }
    }

    /// One-argument call into `window.machla`, guarded on the page's side
    /// existing: the web view can be showing an error page, a cold load,
    /// or a route that has not hydrated yet, and a missing callback is a
    /// normal moment rather than a failure.
    private func send(_ callback: String, argument: String) {
        // JSONSerialization rather than string interpolation: the values
        // here are a hex token and a fixed word today, but a bridge that
        // pastes text into JavaScript is a bridge that will eventually
        // paste something that closes the quote.
        guard let data = try? JSONSerialization.data(withJSONObject: [argument]),
              let json = String(data: data, encoding: .utf8)
        else { return }

        let script = "window.machla && window.machla.\(callback).apply(null, \(json));"
        DispatchQueue.main.async { [weak self] in
            self?.webView?.evaluateJavaScript(script)
        }
    }

    // MARK: - Notification taps

    /// Where a tapped notification wants to go. The payload's `url` is
    /// built by lib/push/send.ts and is always a path within this app.
    func open(notification userInfo: [AnyHashable: Any]) {
        // Must be a path, not a full URL: this is the one place external
        // input picks the address, and "https://elsewhere.example" in
        // that field would otherwise load someone else's page inside a
        // web view holding a signed-in session.
        guard let path = userInfo["url"] as? String,
              path.hasPrefix("/"), !path.hasPrefix("//"),
              let url = URL(string: path, relativeTo: Config.siteURL)
        else { return }

        guard let webView else {
            // Nothing to navigate yet — the app is launching. Hold it for
            // the web view to pick up when it is created.
            launchPath = path
            return
        }
        DispatchQueue.main.async {
            webView.load(URLRequest(url: url.absoluteURL))
        }
    }
}
