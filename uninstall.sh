#!/bin/bash
# Removes the macremote background service and the Tailscale publishing. Leaves the folder in place.
LABEL=com.macremote
TS="$(command -v tailscale || echo /Applications/Tailscale.app/Contents/MacOS/Tailscale)"
launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null
rm -f "$HOME/Library/LaunchAgents/$LABEL.plist"
"$TS" serve --https=443 off 2>/dev/null
echo "macremote stopped and removed. Delete this folder to remove it completely."
