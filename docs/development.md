# Development setup

## Daily workflow

1. Open the repository folder in VS Code.
2. Run `npm run dev` from `frontend`.
3. Run `go run ./cmd/engage` from `backend`.
4. Keep content-pack changes in `content/packs` as JSON and media files.

## Run from VS Code

Open the repository folder, select **Run and Debug**, choose **Run CTG Engage kiosk**, and press **F5**. VS Code starts the frontend and opens the kiosk in Microsoft Edge. Saved frontend changes appear automatically.

The kiosk uses web files rather than WPF/XAML:

- `frontend/src/main.ts` defines the screens and interactions.
- `frontend/src/style.css` defines the visual design and responsive layout.

## Edit the default experience

Visitor-facing copy, the mission choices, the correct answer, the idle timeout, and branding paths live in `content/packs/default/experience.json`. Branding files live beside it in `content/packs/default/branding`.

The frontend validates the content pack before using it. A pack must contain two to six uniquely named choices and exactly one correct answer. If the pack is missing or invalid, CTG Engage uses its built-in fallback experience so the kiosk remains usable.

Visual Studio Community can remain installed for general Windows development, but VS Code is the primary editor for this Go and vanilla TypeScript workspace.
