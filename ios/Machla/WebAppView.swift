import SwiftUI
import WebKit

/// Tracks whether the page is currently reachable, so the shell can say
/// so natively instead of showing WebKit's own "Safari cannot open the
/// page" — which names the wrong app and offers no way back.
final class LoadState: ObservableObject {
    @Published var failed = false
}

/// The web view, and the small amount of native behaviour around it.
struct WebAppView: UIViewRepresentable {
    /// Deliberately not `@ObservedObject`: this view only ever *writes*
    /// to the load state. Observing it as well would rebuild the
    /// representable — and call `updateUIView` — every time the offline
    /// screen appeared or went away, for no benefit.
    let state: LoadState

    func makeUIView(context: Context) -> WKWebView {
        let configuration = WKWebViewConfiguration()

        // The default (persistent) data store is what keeps the Supabase
        // session cookie across launches. A non-persistent one would log
        // the household out every time the app was closed.
        configuration.websiteDataStore = .default()
        configuration.allowsInlineMediaPlayback = true

        let controller = WKUserContentController()
        controller.add(context.coordinator, name: Config.bridgeName)
        configuration.userContentController = controller

        let webView = WKWebView(frame: .zero, configuration: configuration)
        webView.navigationDelegate = context.coordinator
        webView.uiDelegate = context.coordinator
        webView.allowsBackForwardNavigationGestures = true
        webView.backgroundColor = Config.backgroundColor
        webView.scrollView.backgroundColor = Config.backgroundColor
        // SwiftUI already keeps this view inside the safe area, so letting
        // the scroll view add its own inset on top would leave a second,
        // empty band under the notch.
        webView.scrollView.contentInsetAdjustmentBehavior = .never

        let refresh = UIRefreshControl()
        refresh.addTarget(context.coordinator, action: #selector(Coordinator.refresh), for: .valueChanged)
        webView.scrollView.refreshControl = refresh

        context.coordinator.webView = webView
        NativeBridge.shared.attach(webView)
        webView.load(URLRequest(url: NativeBridge.shared.takeInitialURL()))
        return webView
    }

    func updateUIView(_ webView: WKWebView, context: Context) {}

    func makeCoordinator() -> Coordinator {
        Coordinator(state: state)
    }

    final class Coordinator: NSObject, WKNavigationDelegate, WKUIDelegate, WKScriptMessageHandler {
        private let state: LoadState
        /// Weak: the web view owns its configuration, which owns the
        /// content controller, which holds this coordinator. A strong
        /// reference back would close that circle and leak the web view
        /// for the life of the process.
        weak var webView: WKWebView?

        init(state: LoadState) {
            self.state = state
            super.init()
            // The retry button lives in a sibling SwiftUI view that has
            // no way to reach this web view; a notification is the
            // shortest path between the two that does not involve
            // threading a reference through the view hierarchy.
            NotificationCenter.default.addObserver(
                self, selector: #selector(refresh), name: .machlaRetry, object: nil
            )
        }

        @objc func refresh() {
            webView?.reload()
        }

        /// Pull-to-refresh only stops spinning when the load settles, so
        /// this is called from both outcomes rather than at the moment
        /// the reload was requested.
        private func endRefreshing() {
            webView?.scrollView.refreshControl?.endRefreshing()
        }

        // MARK: - The bridge

        func userContentController(
            _ userContentController: WKUserContentController,
            didReceive message: WKScriptMessage
        ) {
            guard message.name == Config.bridgeName else { return }
            NativeBridge.shared.handle(message: message.body)
        }

        // MARK: - Navigation

        /// Anything that is not Machla opens outside Machla.
        ///
        /// A web view that will follow a link anywhere is a web view that
        /// can be pointed at a login page wearing this app's chrome, with
        /// no address bar to give it away. Safari has an address bar, and
        /// a padlock, and the user's password manager.
        func webView(
            _ webView: WKWebView,
            decidePolicyFor navigationAction: WKNavigationAction,
            decisionHandler: @escaping (WKNavigationActionPolicy) -> Void
        ) {
            guard let url = navigationAction.request.url else {
                decisionHandler(.allow)
                return
            }

            if url.host == Config.allowedHost || url.scheme == "about" || url.scheme == "blob" {
                decisionHandler(.allow)
                return
            }

            decisionHandler(.cancel)
            // tel:, mailto:, sms: and https alike — iOS picks the right
            // app, and refuses the ones it has no app for.
            UIApplication.shared.open(url)
        }

        /// `target="_blank"` has nowhere to go in a single web view, so
        /// WebKit drops it silently unless it is handled here.
        func webView(
            _ webView: WKWebView,
            createWebViewWith configuration: WKWebViewConfiguration,
            for navigationAction: WKNavigationAction,
            windowFeatures: WKWindowFeatures
        ) -> WKWebView? {
            if let url = navigationAction.request.url, navigationAction.targetFrame == nil {
                if url.host == Config.allowedHost {
                    webView.load(navigationAction.request)
                } else {
                    UIApplication.shared.open(url)
                }
            }
            return nil
        }

        func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
            endRefreshing()
            state.failed = false
        }

        func webView(
            _ webView: WKWebView,
            didFailProvisionalNavigation navigation: WKNavigation!,
            withError error: Error
        ) {
            handle(error)
        }

        func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
            handle(error)
        }

        private func handle(_ error: Error) {
            endRefreshing()
            // -999 is "a newer navigation replaced this one", which every
            // in-app link produces and none of which is a failure.
            let code = (error as NSError).code
            guard code != NSURLErrorCancelled else { return }
            state.failed = true
        }

        // MARK: - JS alert / confirm / prompt
        //
        // WKWebView does not implement these on its own: a page calling
        // window.alert/confirm/prompt with none of the three methods
        // below present just hangs — the completion handler nothing ever
        // calls, blocking that JS execution context forever. The web app
        // uses window.confirm for its two destructive actions (removing a
        // household member, deleting an account), so without this the
        // Settings screen would freeze solid the moment either was
        // tapped, indistinguishable from a real crash.

        func webView(
            _ webView: WKWebView,
            runJavaScriptAlertPanelWithMessage message: String,
            initiatedByFrame frame: WKFrameInfo,
            completionHandler: @escaping () -> Void
        ) {
            guard let presenter = Self.topViewController() else {
                completionHandler()
                return
            }
            let alert = UIAlertController(title: nil, message: message, preferredStyle: .alert)
            alert.addAction(UIAlertAction(title: Strings.okText, style: .default) { _ in
                completionHandler()
            })
            presenter.present(alert, animated: true)
        }

        func webView(
            _ webView: WKWebView,
            runJavaScriptConfirmPanelWithMessage message: String,
            initiatedByFrame frame: WKFrameInfo,
            completionHandler: @escaping (Bool) -> Void
        ) {
            guard let presenter = Self.topViewController() else {
                completionHandler(false)
                return
            }
            let alert = UIAlertController(title: nil, message: message, preferredStyle: .alert)
            alert.addAction(UIAlertAction(title: Strings.cancelText, style: .cancel) { _ in
                completionHandler(false)
            })
            alert.addAction(UIAlertAction(title: Strings.okText, style: .destructive) { _ in
                completionHandler(true)
            })
            presenter.present(alert, animated: true)
        }

        func webView(
            _ webView: WKWebView,
            runJavaScriptTextInputPanelWithPrompt prompt: String,
            defaultText: String?,
            initiatedByFrame frame: WKFrameInfo,
            completionHandler: @escaping (String?) -> Void
        ) {
            guard let presenter = Self.topViewController() else {
                completionHandler(nil)
                return
            }
            let alert = UIAlertController(title: nil, message: prompt, preferredStyle: .alert)
            alert.addTextField { $0.text = defaultText }
            alert.addAction(UIAlertAction(title: Strings.cancelText, style: .cancel) { _ in
                completionHandler(nil)
            })
            alert.addAction(UIAlertAction(title: Strings.okText, style: .default) { _ in
                completionHandler(alert.textFields?.first?.text)
            })
            presenter.present(alert, animated: true)
        }

        /// The deepest `presentedViewController` off the key window's
        /// root — where a `UIAlertController` has to be presented from,
        /// and SwiftUI's `App` gives no other handle to reach.
        private static func topViewController() -> UIViewController? {
            let scene = UIApplication.shared.connectedScenes
                .compactMap { $0 as? UIWindowScene }
                .first { $0.activationState == .foregroundActive }
            guard var top = scene?.keyWindow?.rootViewController else { return nil }
            while let presented = top.presentedViewController {
                top = presented
            }
            return top
        }
    }
}
