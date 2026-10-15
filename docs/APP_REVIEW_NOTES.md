# App Review notes (paste into App Store Connect → App Review Information → Notes)

Control Your PC is a remote-control client for the user's own computer. It has no accounts, no servers of ours, and collects no data.

**Why there is no login to test with.** The app connects directly to a small program that the user installs on their own Mac. That program is reachable only over the user's private Tailscale network (a VPN between the user's own devices), so it cannot be reached from the public internet or from a review device. There is nothing on our side to log in to.

**Subscription.** The app is a yearly auto-renewing subscription ($9.99 per year) with a 3-day free trial, sold through In-App Purchase and managed by RevenueCat. The paywall shows the price, trial and renewal terms, has Restore Purchases, and links to Terms of Use and Privacy Policy. You can complete the purchase in the sandbox as usual.

**Demo mode.** The paywall has a "Try the demo (no Mac needed)" button. It opens a built-in sample desktop that shows pinch to zoom, two-finger pan, trackpad mode and the text box, so every gesture can be tried without a Mac or a purchase.

**How to review it.**
1. Demo video (the full flow, about 90 seconds): [VIDEO URL]
2. A live session: we can keep a Mac running and add a reviewer device to the Tailscale network on request. Reply in App Store Connect or write to kmages+support@gmail.com and we will respond within a few hours.
3. With your own Mac: download the free Mac program from https://kmages.github.io/phonetopcremote/ (Download for Mac), unzip, run ./install.sh, then enter the address it prints (name ending in .ts.net) into the app.

**What the app does natively.** It stores the user's Mac address on the device, keeps the screen awake while a session is open, shows clear errors and a retry when the Mac cannot be reached, and refuses to navigate to any address other than the one the user entered. The viewer itself is served by the user's own Mac, over HTTPS inside their private network. The app does not download or run code from us.

**Features the user sees in a session:** pinch to zoom and two-finger pan, trackpad mode (move, tap, right-click, drag, scroll), a text box for sending typed or pasted text to the Mac, and a toolbar of modifier and arrow keys. It reconnects automatically when the user returns to the app, so they are not asked to sign in again.

**Permissions.** None. No camera, microphone, location, contacts or photos. Encryption: only standard HTTPS/WSS (exempt).

**Data.** Nothing is collected or sent to us. See the privacy policy: https://kmages.github.io/phonetopcremote/privacy/.
