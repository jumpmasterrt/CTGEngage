# Development setup

## Daily workflow

1. Open the repository folder in VS Code.
2. Select **Run CTG Engage kiosk** and press **F5**.
3. Keep content-pack changes in `content/packs` as JSON and media files.
4. Use `.\scripts\build-linux-arm64.ps1` when a deployable ExpoPi package is needed.

## Run from VS Code

Open the repository folder, select **Run and Debug**, choose **Run CTG Engage kiosk**, and press **F5**. VS Code starts the frontend and opens the kiosk in Microsoft Edge. Saved frontend changes appear automatically.

The kiosk uses web files rather than WPF/XAML:

- `frontend/src/main.ts` defines the screens and interactions.
- `frontend/src/style.css` defines the visual design and responsive layout.

## Edit the default experience

Visitor-facing copy, the opening exchange, discovery topics, idle timeout, and branding paths live in `content/packs/default/experience.json`. Branding files live beside it in `content/packs/default/branding`.

The frontend validates the schema-version 4 content pack before using it. It checks the Yes and No opening branches, discovery topics and chapters, required copy, unique identifiers, assets, and a positive idle timeout. If the pack is missing or invalid, CTG Engage uses its built-in fallback experience so the kiosk remains usable.

## Runtime verification

The Go service serves the production frontend and the copied content pack as one offline application. After building the frontend, run it locally from `backend` with:

```powershell
$env:CTG_ENGAGE_WEB = '..\frontend\dist'
go run .\cmd\engage
```

Open `http://127.0.0.1:8080` and verify `http://127.0.0.1:8080/api/health` returns `{"status":"ok"}`.

The production kiosk includes a touch-only operator shutdown. Hold the upper-left CTG Engage wordmark for four seconds, then hold the shutdown control for three seconds. The backend validates a same-origin runtime token before asking `systemd-logind` for a clean power-off. ExpoPi's installer supplies a polkit rule restricted to that one action for the `ctg-engage` service account.

Visual Studio Community can remain installed for general Windows development, but VS Code is the primary editor for this Go and vanilla TypeScript workspace.
