# CTG Engage
## Our Community — Deployed.
CTG Engage is an offline-first interactive engagement platform built for **Combat Tested Gaming** outreach, conventions, expos, and community events.
It provides a touchscreen-guided visitor experience designed to introduce people to CTG, explain available opportunities, capture contact information, and create better first conversations — even when reliable internet access is unavailable.
> **The kiosk isn’t replacing the volunteer. It’s creating a better first conversation.**
## Current Release
**CTG Engage v1.0.0** is the first production release and the software platform used by the **ExpoPi** reference appliance.
The V1 ExpoPi implementation has completed end-to-end acceptance testing for:
- Cold boot and kiosk autostart
- Chromium kiosk mode
- Touchscreen operation
- On-screen keyboard
- Offline visitor navigation
- Local contact capture and persistence
- Contact count and clear controls
- USB CSV export
- QR-based calls to action
- Controlled reboot and shutdown
See the [latest release](../../releases/latest) for downloadable packages and checksums.
## ExpoPi
**ExpoPi** is the reference appliance for CTG Engage.
The current implementation uses a Raspberry Pi-based touchscreen kiosk configured to boot directly into CTG Engage and operate as a dedicated appliance rather than a general-purpose computer.
CTG Engage itself is designed around portable web technologies so the platform can expand beyond the Raspberry Pi reference implementation over time.
## Features
- Offline-first visitor experience
- Touchscreen-focused interface
- Combat Tested Gaming content package
- Local visitor contact storage
- Explicit contact consent workflow
- USB CSV export
- QR-code calls to action
- Operator administration controls
- Automatic kiosk startup
- Local content and branding
- No continuous internet connection required
## Technology
### Frontend
- TypeScript
- HTML
- CSS
- Vite
### Backend
- Go
- Local API
- SQLite
### Content
- JSON-based content packages
- Portable branding and media assets
### Reference Deployment
- Linux
- Raspberry Pi / ARM64
- systemd
- Chromium kiosk mode
## Repository Structure
```text
backend/     Go service and local API
content/     CTG content packages, branding, and media
deploy/      Linux service and deployment configuration
docs/        Development and technical documentation
frontend/    Touchscreen user interface

Development

Frontend

cd frontend
npm install
npm run dev

Backend

In a second terminal:

cd backend
go run ./cmd/engage

Additional development notes are available in docs/development.md.

Documentation

Operator and deployment documentation is maintained in the project Wiki.

Start with:

* Quick Start
* Installing CTG Engage
* Admin Controls
* CSV Export

The Wiki is intended for kiosk operators and deployers, while repository documentation focuses on development and architecture.

CTG Engage and Engage

CTG Engage is the Combat Tested Gaming-specific implementation of the project.

Future development will extract the reusable platform components into a more generic Engage platform capable of supporting organization-specific packages, branding, content, and workflows.

CTG Engage will remain the original reference implementation of that platform.

Project Status

Production release: v1.0.0

The current production target is the ExpoPi Raspberry Pi / ARM64 appliance.

Development beyond V1 will focus on improving deployment, content packaging, organizational configuration, and portability while preserving offline-first operation.

License

CTG Engage is currently source-available proprietary software.

The repository may be viewed for evaluation and development transparency, but reuse, modification, redistribution, deployment, or commercial use is not permitted without authorization.

Combat Tested Gaming, VFW, and other organizational branding and assets remain subject to their respective ownership and usage requirements.

See LICENSE for full terms.

Licensing may be revised in a future release as the relationship between CTG Engage, the broader Engage platform, and organizational ownership is formally established.

Save that, and I’ll verify the live render before we move to the issue templates.
