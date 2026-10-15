#!/bin/bash
# One-command installer: ./install.sh
# Safe to re-run (it replaces the previous install). Undo with ./uninstall.sh.
set -euo pipefail

LABEL=com.macremote
DIR="$(cd "$(dirname "$0")" && pwd)"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
PORT=8080

say()  { printf '\n\033[1m%s\033[0m\n' "$*"; }
fail() { printf '\n\033[31m✗ %s\033[0m\n' "$*" >&2; exit 1; }
ok()   { printf '  \033[32m✓\033[0m %s\n' "$*"; }

[ "$(uname)" = Darwin ] || fail "macremote runs on a Mac."

say "1/5  Checking requirements"
NODE="$(command -v node || true)"
[ -z "$NODE" ] && for p in /opt/homebrew/bin/node /usr/local/bin/node; do [ -x "$p" ] && NODE="$p" && break; done
[ -n "$NODE" ] || fail "Node.js 20+ is missing. Install it with:  brew install node   (or https://nodejs.org)"
[ "$("$NODE" -p 'process.versions.node.split(".")[0]')" -ge 20 ] || fail "Node 20+ is required (found $("$NODE" -v)). Run:  brew upgrade node"
ok "Node $("$NODE" -v)"

TS="$(command -v tailscale || true)"
[ -z "$TS" ] && [ -x /Applications/Tailscale.app/Contents/MacOS/Tailscale ] && TS=/Applications/Tailscale.app/Contents/MacOS/Tailscale
[ -n "$TS" ] || fail "Tailscale is missing. Install it from https://tailscale.com/download, sign in, then re-run ./install.sh"
"$TS" status >/dev/null 2>&1 || fail "Tailscale isn't connected. Open the Tailscale app, sign in, then re-run ./install.sh"
ok "Tailscale connected"

nc -z 127.0.0.1 5900 2>/dev/null || fail "Screen Sharing is off. Turn it on: System Settings → General → Sharing → Screen Sharing (allow your user), then re-run ./install.sh"
ok "Screen Sharing is on"

say "2/5  Choosing a password for the web app"
echo "  This is what you type on your phone. (Your Mac login is asked for separately.)"
PW="${MACREMOTE_PASSWORD:-}"
if [ -z "$PW" ] && [ -t 0 ]; then
  read -r -s -p "  Password (press Return to generate one): " PW; echo
fi
GENERATED=0
if [ -z "$PW" ]; then PW="$(LC_ALL=C tr -dc 'a-z0-9' </dev/urandom | head -c 12)"; GENERATED=1; fi
case "$PW" in *[\<\>\&\"]*) fail "Please avoid the characters < > & \" in the password." ;; esac

say "3/5  Installing dependencies"
(cd "$DIR" && npm install --omit=dev --silent) || fail "npm install failed"
ok "Done"

say "4/5  Starting macremote (and at every login)"
mkdir -p "$HOME/Library/LaunchAgents"
launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null || true
sed -e "s#/opt/homebrew/bin/node#$NODE#" -e "s#/Users/YOU/macremote#$DIR#g" -e "s#CHANGE-ME#$PW#" \
  "$DIR/launchd/$LABEL.plist" > "$PLIST"
chmod 600 "$PLIST"
plutil -lint "$PLIST" >/dev/null || fail "Couldn't write a valid launch agent."
launchctl bootstrap "gui/$(id -u)" "$PLIST"
for _ in 1 2 3 4 5 6 7 8 9 10; do nc -z 127.0.0.1 $PORT 2>/dev/null && break; sleep 1; done
nc -z 127.0.0.1 $PORT 2>/dev/null || fail "The server didn't start. See /tmp/macremote.log"
ok "Running"

say "5/5  Publishing over Tailscale (private to your devices)"
if ! "$TS" serve status 2>/dev/null | grep -q "127.0.0.1:$PORT"; then
  "$TS" serve --bg --https=443 "http://127.0.0.1:$PORT" >/dev/null 2>&1 \
    || fail "tailscale serve failed. Enable HTTPS in your Tailscale admin console (DNS → HTTPS Certificates), then re-run."
fi
URL="$("$TS" serve status 2>/dev/null | grep -o 'https://[^ ]*' | head -1)"
ok "Published"

say "All set."
echo "  On your phone (with Tailscale on):  ${URL:-https://<your-mac>.<tailnet>.ts.net}"
[ "$GENERATED" = 1 ] && echo "  Password:                          $PW   (save it now)"
echo "  Then Share → Add to Home Screen."
echo
echo "  Tip: stop the Mac sleeping while you're away (System Settings → Battery → Options)."
echo "  Problems? tail /tmp/macremote.log"
