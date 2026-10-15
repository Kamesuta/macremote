# macremote

A private web app that shows your Mac's screen on your iPhone and **reconnects by itself when you come back to it**, so you aren't asked to log in again. It stays signed in until you press **Close**.

It uses the Mac's built-in Screen Sharing (VNC) server and [noVNC](https://github.com/novnc/noVNC) in the browser. It is meant to be reached only over [Tailscale](https://tailscale.com), never the public internet.

```
iPhone (Home Screen web app)  --HTTPS over Tailscale-->  macremote (Node, on the Mac)  --localhost:5900-->  macOS Screen Sharing
```

## What "stays open" means

iOS freezes web apps in the background, so no web page can hold a live connection while you're away. What this does instead:

- Your Mac session (apps, windows) is never touched. Only the viewer reconnects.
- When you return, or the connection drops, it reconnects automatically (a fresh connection if you were away more than 3 seconds).
- Your Mac username/password are kept on the iPhone only if you tick "Keep me connected". The web sign-in cookie lasts a year.
- **Close** disconnects, forgets the saved credentials, and signs out.
- The screen is kept awake while connected (where iOS allows it).

## Install (on the Mac)

You need [Node 20+](https://nodejs.org) (`brew install node`), [Tailscale](https://tailscale.com/download) signed in on the Mac and the phone, and Screen Sharing turned on (System Settings → General → Sharing → Screen Sharing; don't tick "VNC viewers may control screen with password").

```sh
git clone https://github.com/kmages/macremote && cd macremote && ./install.sh
```

The script checks all of the above (and tells you what's missing), asks for a password, starts macremote now and at every login, publishes it privately over Tailscale, and prints the address. On the phone, open that address, sign in, then Share → **Add to Home Screen**.

Re-run `./install.sh` any time (e.g. to change the password). `./uninstall.sh` removes it. Logs: `/tmp/macremote.log`.

Keep the Mac awake while you're away (System Settings → Battery → Options). If it locks itself you'll still see its own password screen.

## Using it

- **Pinch** to zoom (up to 5×), **two fingers** to pan. The `1×` button resets.
- **Aa** opens a text box: type or paste text, **Send** types it on the Mac, **Send ↵** also presses Return.
- ⌨ opens the phone keyboard; Esc, Tab, Ctrl and the other toolbar keys sit beside it.

## Troubleshooting

| Symptom | Check |
|---|---|
| Page won't load | `launchctl list \| grep macremote`; `tail /tmp/macremote.log`; re-run `./install.sh` |
| Loads but screen won't connect | Screen Sharing is off, or enter your Mac username/password when asked |
| Address won't open on phone | Tailscale must be connected on both devices |

## Settings

| Variable | Default | |
|---|---|---|
| `MACREMOTE_PASSWORD` | required | password for the web app |
| `PORT` / `HOST` | `8080` / `127.0.0.1` | where the web app listens |
| `VNC_HOST` / `VNC_PORT` | `127.0.0.1` / `5900` | the Mac's Screen Sharing server |
| `MACREMOTE_SECURE_COOKIE` | on | set `0` only to test over plain http |
| `MACREMOTE_DIR` | `~/.macremote` | where the cookie-signing secret is stored |

## Tests

```sh
npm test         # server: auth, origin check, websocket proxy
npm run test:e2e # headless Chromium against a fake VNC server (needs Chromium; set CHROMIUM_PATH)
```

## Mobile app (Expo): TestFlight and Google Play

`mobile/` is a thin Expo app. It asks once for your Mac's `https://` address, then shows the web app full-screen in a WebView, keeps the screen awake while it's showing, and refuses to navigate away from that address. It adds nothing else: the viewer, reconnecting and sign-in all live in the web app above.

You need:
- An **Apple Developer Program** membership (paid, yearly). An Expo account alone can't submit to TestFlight.
- A **Google Play Console** developer account (one-time fee). Google says new personal accounts must run a closed test with at least 12 testers for 14 continuous days before they can publish to production. Check the current rule in Play Console.

```sh
cd mobile
npm install
npm install -g eas-cli
eas login
eas init                                   # writes your EAS project id into app.json
eas build -p ios --profile production      # or add --auto-submit to send it to TestFlight
eas submit -p ios
eas build -p android --profile production  # first upload to Play is done by hand in Play Console
```

The app needs the Mac's Tailscale **name** (like `my-mac.your-tailnet.ts.net`, shown by `tailscale serve status`), not its `100.x.x.x` number: HTTPS certificates only exist for the name.

`com.kmages.macremote` is a placeholder bundle id / package name in `mobile/app.json`; change it if it's taken. Each person still runs the Mac-side server themselves, so the app is only useful to people who have set that up.

Why a wrapper app and not a Play Store listing of the PWA itself: a Trusted Web Activity wraps one fixed public website, and here every person's server address is private and different. The Expo wrapper takes the address at runtime instead.

Not yet done: no EAS build has been run, and nothing has been installed on a phone. `npx tsc --noEmit` passes, `src/url.test.ts` passes, and `expo export` bundles for iOS and Android. Apple may question an app that is mostly a website (App Review guideline 4.2); TestFlight internal testing is the low-risk first step.

## Not yet verified

These tests use a fake VNC server on Linux. **Not yet tried** against real macOS Screen Sharing or a real iPhone:

- Apple's login method (noVNC supports it, unconfirmed here).
- The on-screen keyboard and the ⌘ button, which sends Super_L (commonly Command on macOS Screen Sharing; unconfirmed).
- iOS autocorrect/dictation input, and exactly how Safari behaves when the app is backgrounded.

## Licenses

Uses noVNC (MPL-2.0; unmodified, served from `node_modules`) and `ws` (MIT). Keep their notices if you distribute this. Pick a license for this repo before sharing or selling it. Don't use Google's or VNC's names in the product name.
