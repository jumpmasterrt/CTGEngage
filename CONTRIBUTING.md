# Contributing to CTG Engage

Thanks for your interest in CTG Engage.

CTG Engage is currently a small, actively developed project with a production V1 release and a defined ExpoPi reference deployment. Contributions are welcome when they improve reliability, usability, documentation, deployment, or the visitor experience.

## Before You Start

For bugs, use the **Bug Report** issue template.

For new ideas or improvements, use the **Feature Request** template.

For security, privacy, visitor-data, kiosk-escape, or unauthorized-access concerns, **do not open a public issue**. Follow the instructions in [`SECURITY.md`](SECURITY.md).

## Code Contributions

For code changes:

1. Create a branch for the change.
2. Keep the change focused on one issue or purpose.
3. Test the affected functionality before submitting.
4. Update documentation when behavior, deployment, or configuration changes.
5. Open a pull request describing what changed and why.

Whenever possible, include reproduction steps for fixes and a short explanation of how the change was tested.

## Development Environment

CTG Engage currently uses:

- TypeScript, HTML, CSS, and Vite for the frontend
- Go for the backend
- SQLite for local data
- JSON-based content packages
- Linux / Raspberry Pi as the V1 reference deployment

See [`docs/development.md`](docs/development.md) for development setup details.

## Data and Security

Do not commit or include:

- Real visitor contact information
- Passwords or credentials
- API keys or access tokens
- Private configuration
- Runtime databases
- Sensitive logs containing personal information

Use test or fabricated data when reproducing issues.

## Branding and Content

CTG Engage includes Combat Tested Gaming and VFW-related branding and organization-specific content.

Do not add, replace, redistribute, or repurpose organizational branding or protected assets without authorization.

## Licensing

CTG Engage is currently source-available proprietary software.

Submitting a contribution does not grant permission to independently redistribute, deploy, relicense, commercialize, or create derivative products from CTG Engage outside the terms of the project license.

See [`LICENSE`](LICENSE) for current terms.

## Pull Request Guidance

A useful pull request should clearly state:

- What changed
- Why the change is needed
- What part of CTG Engage is affected
- How the change was tested

Small, focused changes are preferred over unrelated changes bundled into a single pull request.
