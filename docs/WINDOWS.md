# Windows support: plan

The server only proxies a WebSocket to a VNC port (`VNC_HOST`/`VNC_PORT`), so it is not Mac-specific. Windows needs a VNC server, an installer and a few UI changes. Nothing in the Mac path should change.

## What differs

| | macOS (today) | Windows |
|---|---|---|
| Screen server | Built-in Screen Sharing on :5900 | **None built in.** Install TightVNC or UltraVNC (free, GPL) |
| Auth to the VNC server | Mac username + password (Apple auth) | VNC password only (no username) |
| Run at login | launchd agent | Scheduled task ("At log on") or a service via NSSM |
| Installer | `install.sh` | `install.ps1` |
| Modifier keys | Ctrl, Opt, ⌘ | Ctrl, Alt, Win |

Windows Home has no Remote Desktop host, so RDP is not an option for most users. VNC works on every edition.

## Work items

1. **`install.ps1`**: mirror `install.sh`. Check Node 20+, Tailscale connected and a VNC server listening on 5900 (offer to install TightVNC with `winget install GlavSoft.TightVNC`). Prompt for the web password, register a scheduled task running `node src/server.js` with `MACREMOTE_PASSWORD`, run `tailscale serve --bg --https=443 http://127.0.0.1:8080` and print the address. Add `uninstall.ps1`.
2. **Sign-in form**: Windows VNC has no username. Show the username field only for Apple auth, or make it optional. Today `credentials` always sends one. Check what noVNC does with a password-only server (VNC auth asks for `password` only).
3. **Toolbar**: detect the host OS (server reports it on `/session`, or the user picks it once) and show Opt/⌘ or Alt/Win. Add Ctrl+Alt+Del as a button: Windows cannot receive it as a normal keystroke, and TightVNC needs the VNC "send Ctrl-Alt-Del" action (`rfb.sendCtrlAltDel()`).
4. **Keyboard layer**: verify keysyms for AltGr, Win and the text box on Windows. `sendText` uses X keysyms, which TightVNC maps correctly for Latin text. Test non-ASCII.
5. **Display**: multi-monitor Windows setups expose one big framebuffer. Test scaling and pinch zoom on ultrawide and dual-screen.
6. **UAC and the lock screen**: VNC servers running as a user cannot interact with UAC prompts or the lock screen. TightVNC as a **service** can. The installer should set it up as a service and explain this.
7. **Mobile app**: no change. It only wraps the URL.
8. **Docs and store listing**: add a Windows section to the README. Once Windows works, change the subtitle to "Remote screen for Mac and Windows".

## Risks

- **Security**: a VNC password is weak (8 characters max for classic VNC auth). The only protection is that it is reachable via Tailscale alone, so state it plainly in the docs and never suggest port-forwarding.
- **Support burden**: VNC server install and firewall prompts will be the top support issue. Budget for good docs.
- **Licensing**: don't bundle TightVNC (GPL). Link to it or use winget so you don't take on its license obligations.

## Suggested order

Prove it manually first: install TightVNC on a Windows machine, run `MACREMOTE_PASSWORD=x VNC_PORT=5900 node src/server.js`, sign in, and log what breaks (items 2-4). Only then write the installer.
