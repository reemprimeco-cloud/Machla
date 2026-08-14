import SwiftUI

@main
struct MachlaApp: App {
    @UIApplicationDelegateAdaptor(AppDelegate.self) private var appDelegate
    @StateObject private var loadState = LoadState()

    var body: some Scene {
        WindowGroup {
            ZStack {
                // Painted edge to edge so the status bar and the strip
                // under the home indicator are the page's own background
                // rather than black. The web view itself stays inside the
                // safe area — the app's bottom tab bar is a tap target,
                // and putting it under the home indicator would make it
                // one the user cannot reliably hit.
                Color(Config.backgroundColor)
                    .ignoresSafeArea()

                WebAppView(state: loadState)

                if loadState.failed {
                    OfflineView { NotificationCenter.default.post(name: .machlaRetry, object: nil) }
                }
            }
            // The app is light-only by decision, and a web view cannot
            // inherit a dark appearance it has no styles for: leaving
            // this out gives dark-mode users white text on white.
            .preferredColorScheme(.light)
        }
    }
}

extension Notification.Name {
    static let machlaRetry = Notification.Name("machla.retry")
}

/// Shown when the site cannot be reached at all.
///
/// The web app has its own offline page (app/offline), which is the one
/// people will normally see — it is served by the service worker and can
/// still show the app's shell. This is the case that page cannot cover:
/// nothing has loaded, so there is no app to show anything.
struct OfflineView: View {
    let retry: () -> Void

    var body: some View {
        VStack(spacing: 20) {
            Image("AppLogo")
                .resizable()
                .scaledToFit()
                .frame(width: 72, height: 72)
                .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))

            Text(Strings.offlineTitleText)
                .font(.title3.weight(.semibold))
                .foregroundStyle(.primary)

            Button(action: retry) {
                Text(Strings.retryText)
                    .font(.body.weight(.semibold))
                    .frame(minWidth: 160, minHeight: 48)
            }
            .buttonStyle(.borderedProminent)
            .tint(Color(red: 0xE0 / 255, green: 0x1B / 255, blue: 0x6A / 255))
        }
        .padding(32)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Color(Config.backgroundColor))
    }
}
