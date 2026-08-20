# CTG Engage

Offline-first touchscreen experience for introducing convention visitors to Combat Tested Gaming.

The application is designed to run on iPad, Android, Linux and Windows kiosk devices.

## Stack

- Frontend: vanilla TypeScript, HTML, and CSS built with Vite
- Runtime service: Go standard library serving the complete offline build
- Content: portable JSON content packs
- Linux deployment: systemd
- Raspberry Pi kiosk browser: Chromium on Raspberry Pi OS

## Workspace

- `frontend/` — touchscreen user interface
- `backend/` — Go service and local API
- `content/` — editable content packs and media
- `deploy/` — Linux service and kiosk configuration
- `scripts/` — development, packaging, and deployment helpers
- `docs/` — architecture and operator notes

## Daily development

Open the repository in VS Code and press **F5**. Vite starts on port `5175`, Microsoft Edge opens the kiosk, and saved frontend changes refresh automatically.

## Build the ExpoPi package

```powershell
.\scripts\build-linux-arm64.ps1
```

The package is written to `out/ctg-engage-linux-arm64`. It contains the Linux ARM64 service binary, the complete offline web experience, the systemd unit, the keyring-free Chromium launcher, and the ExpoPi configuration helpers. No Node.js or Go installation is required on the kiosk.

On ExpoPi, copy the package to a temporary directory and run:

```bash
sudo bash install-expopi.sh
```

The service listens only on `http://127.0.0.1:8080`. The kiosk browser will open that local address, so the visitor experience does not depend on internet access.

After creating the restricted `ctgga` operator account, configure automatic login and kiosk startup with:

```bash
sudo bash configure-expopi-kiosk.sh
```

This disables desktop screen blanking, changes LightDM auto-login to `ctgga`, and launches Chromium from the operator's labwc autostart file using an isolated kiosk profile.
