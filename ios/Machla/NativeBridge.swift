import Foundation
import StoreKit
import UIKit
import UserNotifications
import WebKit

/// The whole contract between the page and this shell.
///
/// It is small on purpose. Everything Machla does — lists, products,
/// languages, authentication — is the web app's job and stays there. The
/// only things the shell can do that a browser cannot are receive Apple
/// push notifications and sell the household subscription through
/// StoreKit, so that is what it offers.
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

    /// Apple's own recommended pattern: a long-lived listener catches a
    /// transaction that finishes outside the direct purchase flow — Ask
    /// to Buy approval, a purchase restored from another device, one
    /// StoreKit re-delivers after a dropped connection. Started once,
    /// for the life of the process, same as `Transaction.updates` itself.
    private var transactionUpdatesTask: Task<Void, Never>?

    private override init() {}

    // MARK: - Wiring

    func attach(_ webView: WKWebView) {
        self.webView = webView
        startObservingTransactionUpdates()
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

        case "iap:status":
            reportSubscriptionProduct()

        case "iap:purchase":
            purchaseSubscription()

        case "iap:restore":
            restorePurchases()

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
    ///
    /// `argument` is `Any` rather than `String` so the same function
    /// serves both a bare value (a push status word, a device token) and
    /// a `[String: Any]` object (`onIapProduct`, `onIapResult`) —
    /// JSONSerialization treats an array holding either the same way,
    /// and a bridge that pastes text into JavaScript by hand is a bridge
    /// that will eventually paste something that closes the quote.
    private func send(_ callback: String, argument: Any) {
        guard let data = try? JSONSerialization.data(withJSONObject: [argument]),
              let json = String(data: data, encoding: .utf8)
        else { return }

        let script = "window.machla && window.machla.\(callback).apply(null, \(json));"
        DispatchQueue.main.async { [weak self] in
            self?.webView?.evaluateJavaScript(script)
        }
    }

    // MARK: - In-app purchase (the household subscription)
    //
    // One product, one subscription group, sold once per household —
    // see Config.subscriptionProductId and docs/architecture (App Store
    // Connect setup). The free trial is the household's own 14 days
    // from creation on the server, not a StoreKit introductory offer:
    // one mechanism rather than two that could disagree about when it
    // ends, so this product is a plain paid subscription with nothing
    // configured on the "free trial" tab in App Store Connect.
    //
    // A purchase or restore here only ever reports a verified
    // originalTransactionId back to the page — it never decides the
    // subscription is active itself. `syncAppleSubscriptionAction`
    // (lib/subscription/actions.ts) looks the transaction up with
    // Apple's own servers before writing anything to this household's
    // row, on the principle that "StoreKit verified this JWS" and "this
    // subscription is currently active" are two different questions,
    // and only Apple's servers can answer the second one right now.

    private func fetchSubscriptionProduct() async -> Product? {
        (try? await Product.products(for: [Config.subscriptionProductId]))?.first
    }

    private func reportSubscriptionProduct() {
        Task {
            guard let product = await fetchSubscriptionProduct() else { return }
            send("onIapProduct", argument: ["priceDisplay": product.displayPrice])
        }
    }

    private func purchaseSubscription() {
        Task {
            guard let product = await fetchSubscriptionProduct() else {
                send("onIapResult", argument: ["ok": false, "reason": "failed"])
                return
            }

            do {
                let result = try await product.purchase()
                switch result {
                case .success(let verification):
                    reportPurchaseVerification(verification)
                case .userCancelled:
                    send("onIapResult", argument: ["ok": false, "reason": "cancelled"])
                case .pending:
                    // Ask to Buy, or a payment method needing action —
                    // resolved later, outside this app, and picked up by
                    // startObservingTransactionUpdates() when it is.
                    send("onIapResult", argument: ["ok": false, "reason": "pending"])
                @unknown default:
                    send("onIapResult", argument: ["ok": false, "reason": "failed"])
                }
            } catch {
                send("onIapResult", argument: ["ok": false, "reason": "failed"])
            }
        }
    }

    /// Re-checks this device's own purchase history rather than trusting
    /// anything cached locally — the documented way to let someone who
    /// reinstalled, or is on a new device signed into the same Apple
    /// ID, get back into a household they (or another member) already
    /// paid for.
    private func restorePurchases() {
        Task {
            try? await AppStore.sync()

            for await result in Transaction.currentEntitlements {
                guard case .verified(let transaction) = result,
                      transaction.productID == Config.subscriptionProductId
                else { continue }

                await transaction.finish()
                send("onIapResult", argument: [
                    "ok": true,
                    "originalTransactionId": String(transaction.originalID),
                ])
                return
            }

            send("onIapResult", argument: ["ok": false, "reason": "not_found"])
        }
    }

    private func reportPurchaseVerification(_ verification: VerificationResult<Transaction>) {
        switch verification {
        case .verified(let transaction):
            Task { await transaction.finish() }
            send("onIapResult", argument: [
                "ok": true,
                "originalTransactionId": String(transaction.originalID),
            ])
        case .unverified:
            // StoreKit itself could not validate this transaction's JWS —
            // treated as a plain failure rather than forwarded anywhere,
            // since there is nothing genuine here for the server to
            // re-check with Apple.
            send("onIapResult", argument: ["ok": false, "reason": "failed"])
        }
    }

    /// Started once, in `attach(_:)`, and never cancelled — the same
    /// lifetime as the process itself, per Apple's own guidance for
    /// `Transaction.updates`.
    private func startObservingTransactionUpdates() {
        guard transactionUpdatesTask == nil else { return }
        transactionUpdatesTask = Task {
            for await result in Transaction.updates {
                guard case .verified(let transaction) = result,
                      transaction.productID == Config.subscriptionProductId
                else { continue }

                await transaction.finish()
                send("onIapResult", argument: [
                    "ok": true,
                    "originalTransactionId": String(transaction.originalID),
                ])
            }
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
