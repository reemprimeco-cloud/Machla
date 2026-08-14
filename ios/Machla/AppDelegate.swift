import UIKit
import UserNotifications

/// Push plumbing, and nothing else.
///
/// SwiftUI's `App` lifecycle handles everything a normal app would put
/// here; APNs is the exception, because registration results still arrive
/// as UIApplicationDelegate callbacks. `MachlaApp` adopts this with
/// `@UIApplicationDelegateAdaptor`.
final class AppDelegate: NSObject, UIApplicationDelegate, UNUserNotificationCenterDelegate {
    func application(
        _ application: UIApplication,
        didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?
    ) -> Bool {
        UNUserNotificationCenter.current().delegate = self

        // Re-register on every launch while notifications are on. This is
        // not the same as asking again — the permission prompt is not
        // shown — it is how the app learns about a token Apple rotated
        // while it was closed. Skipped when notifications are off so an
        // ordinary launch never touches APNs.
        if UserDefaults.standard.bool(forKey: Config.wantsPushKey) {
            application.registerForRemoteNotifications()
        }

        return true
    }

    func application(
        _ application: UIApplication,
        didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data
    ) {
        NativeBridge.shared.didRegister(deviceToken: deviceToken)
    }

    func application(
        _ application: UIApplication,
        didFailToRegisterForRemoteNotificationsWithError error: Error
    ) {
        // Nothing to do and nothing to tell the user: registration fails
        // on a device with no network, and in the Simulator, and both
        // recover by themselves on the next launch. The toggle keeps
        // reporting what iOS actually thinks.
        NativeBridge.shared.reportStatus(includingToken: false)
    }

    /// A notification arriving while Machla is the app on screen. Without
    /// this, iOS shows nothing at all — which reads as a broken
    /// notification rather than a deliberate one, especially while
    /// someone is testing whether they work.
    func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        willPresent notification: UNNotification,
        withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void
    ) {
        completionHandler([.banner, .list, .sound])
    }

    /// Tapped. The payload carries the in-app path to open — the same one
    /// the Web Push notification uses (lib/push/send.ts).
    func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        didReceive response: UNNotificationResponse,
        withCompletionHandler completionHandler: @escaping () -> Void
    ) {
        NativeBridge.shared.open(notification: response.notification.request.content.userInfo)
        completionHandler()
    }
}
