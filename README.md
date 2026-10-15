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

## Setup (on the Mac)

1. **Turn on Screen Sharing**: System Settings → General → Sharing → Screen Sharing, and allow your user. (Do not tick "VNC viewers may control screen with password".)
2. **Install Node 20+** (`brew install node`), then:
   ```sh
   git clone https://github.com/kmages/macremote && cd macremote
   npm install
   MACREMOTE_PASSWORD='pick-a-long-passphrase' npm start
   ```
   It listens on `127.0.0.1:8080` only.
3. **Install Tailscale** on the Mac and the iPhone, then publish the app over HTTPS inside your tailnet (check `tailscale serve --help` for your version's syntax):
   ```sh
   tailscale serve --bg --https=443 http://127.0.0.1:8080
   ```
4. **On the iPhone**, open `https://<your-mac>.<your-tailnet>.ts.net` in Safari, sign in, then Share → **Add to Home Screen**. Launch it from the Home Screen.
5. **Keep the Mac available**: stop it sleeping while you're away (`caffeinate -s` or Battery/Energy settings) and decide how you want the lock screen to behave. If the Mac locks itself, you'll still see its own password screen.
6. **Optional, start at login**: edit `launchd/com.macremote.plist` (paths and password), copy it to `~/Library/LaunchAgents/`, `chmod 600` it, then `launchctl load ~/Library/LaunchAgents/com.macremote.plist`.

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

## Not yet verified

These tests use a fake VNC server on Linux. **Not yet tried** against real macOS Screen Sharing or a real iPhone:

- Apple's login method (noVNC supports it, unconfirmed here).
- The on-screen keyboard and the ⌘ button, which sends Super_L (commonly Command on macOS Screen Sharing; unconfirmed).
- iOS autocorrect/dictation input, and exactly how Safari behaves when the app is backgrounded.

## Licenses

Uses noVNC (MPL-2.0; unmodified, served from `node_modules`) and `ws` (MIT). Keep their notices if you distribute this. Pick a license for this repo before sharing or selling it. Don't use Google's or VNC's names in the product name.
