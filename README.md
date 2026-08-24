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
- `content/` — active-package configuration plus organization packages and media
- `deploy/` — Linux service and kiosk configuration
- `scripts/` — development, packaging, and deployment helpers
- `docs/` — architecture and operator notes

## Daily development

Open the repository in VS Code and press **F5**. Vite starts on port `5175`, Microsoft Edge opens the kiosk, and saved frontend changes refresh automatically.

F5 loads `content/active-package.json`, which selects `ctg-ga` by default.

## Organization packages

Engage Core contains navigation, session handling, kiosk controls, event logging, and package validation. Organization identity, theme, visitor copy, media, and calls to action live under `content/packages/<package-id>`.

The production service selects a package with `CTG_ENGAGE_PACKAGE`. The same offline build contains every installed package, so changing from `ctg-ga` to the internal `alg-demo` proof does not require an application-code change or a rebuild.

`alg-demo` is an internal architectural proof using public American Legion Gaming information. It is visibly labeled as a proof of concept and must not be presented as an official ALG product without their approval.

See `docs/organization-packages.md` for the package contract and switching procedure.

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

## Restart or shut down ExpoPi at an event

1. Press and hold the **CTG Engage** wordmark in the upper-left corner for four seconds.
2. On the operator screen, press and hold **Hold to restart** or **Hold to shut down** for three seconds.
3. After a restart, wait for Engage to return automatically. After a shutdown, wait for the display to go black and the green activity light to stop blinking.
4. Use the inline power switch only after a completed shutdown.

The installer grants the isolated `ctg-engage` service account only the system restart and power-off actions. The operator screen uses a runtime token and is available only from the locally served kiosk.

## Field-test events

The production kiosk records anonymous interaction events locally in `/var/lib/ctg-engage/interaction-events.jsonl`. Events contain the active package ID, a random session identifier, screen and choice IDs, elapsed time, and reset reason. They do not contain names, accounts, free text, or network identifiers. The log is capped at 5 MiB with one rotated backup and is never transmitted by Engage.
