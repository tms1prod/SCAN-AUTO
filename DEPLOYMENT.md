# Auto Scan deployment

## Web and installable PWA

1. Run `npm ci` to install the exact versions recorded in `package-lock.json`.
2. Run `npm run build` to create the deployable static app in `www/`.
3. Publish the contents of `www/` to a host that serves HTTPS. The service worker enables the cached shell and offline reopening after the first visit.

## Android wrapper

1. Install Android Studio, a supported JDK, and the Android SDK.
2. Set a unique reverse-domain `appId` in `capacitor.config.json` before publishing.
3. Run `npx cap add android`, then `npm run cap:sync` and `npx cap open android`.
4. In Android Studio, create a signed Android App Bundle (AAB), test it on physical devices, and upload it through Google Play Console.

## iOS wrapper

1. On a Mac with Xcode installed, run `npx cap add ios`, then `npm run cap:sync` and `npx cap open ios`.
2. Configure the bundle identifier, signing team, app icons, privacy details, and App Store listing in Xcode/App Store Connect.
3. Test on physical iPhones and submit a signed archive through App Store Connect.

## Release blockers to resolve

- This workspace currently has no Android SDK/JDK and no Xcode; signed store builds cannot be produced here.
- The current OBD connection uses Web Serial, which is not available in the packaged iOS/Android WebView. A native OBD transport/plugin and testing with the exact adapters to be sold are required before mobile store release. Bluetooth Classic, BLE, and USB are different transports and are not interchangeable.
- The registration field is local vehicle identification only. A plate lookup requires an authorized provider/API and a backend; do not scrape restricted registration databases.
- Review the generated Android icon/splash assets and create the final iOS asset catalog, a public privacy policy and support contact. Complete store disclosures and verify account/data deletion before submitting. Native permissions, signing keys, and store accounts must be owned by the publisher.
- Subscriptions are not implemented. Add a secure backend and Apple/Google in-app purchase flows before advertising or selling a paid plan.

Never commit signing keys, service credentials, or private customer documents.