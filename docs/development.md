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

Visual Studio Community can remain installed for general Windows development, but VS Code is the primary editor for this Go and vanilla TypeScript workspace.
