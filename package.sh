#!/bin/bash
# Builds the customer download: site/download/control-your-pc-mac.zip (no git history, tests or mobile code).
set -euo pipefail
cd "$(dirname "$0")"
VER=$(node -p "require('./package.json').version")
NAME=control-your-pc-mac
STAGE=$(mktemp -d)/$NAME
mkdir -p "$STAGE" site/download
cp -R src public launchd install.sh uninstall.sh package.json package-lock.json "$STAGE/"
cat > "$STAGE/START-HERE.txt" <<TXT
Control Your PC for Mac  (version $VER)

1. Turn on Screen Sharing: System Settings > General > Sharing > Screen Sharing.
2. Install Node 20+ (nodejs.org) and Tailscale (tailscale.com/download). Sign in to Tailscale on your Mac and phone.
3. Open Terminal in this folder and run:   ./install.sh
4. Open the address it prints on your phone.

Help: https://phonetopcremote.com/support
TXT
chmod +x "$STAGE/install.sh" "$STAGE/uninstall.sh"
rm -f "site/download/$NAME.zip"
(cd "$(dirname "$STAGE")" && zip -qr "$OLDPWD/site/download/$NAME.zip" "$NAME")
echo "built site/download/$NAME.zip ($VER)"; unzip -l "site/download/$NAME.zip" | tail -1
