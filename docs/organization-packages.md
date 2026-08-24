# Organization packages

CTG Engage is the first deployment of Engage Core. The core owns interaction behavior; an organization package owns the identity and visitor content rendered by that behavior.

```text
content/
├── active-package.json
└── packages/
    ├── ctg-ga/
    │   ├── manifest.json
    │   ├── experience.json
    │   └── branding/
    └── alg-demo/
        ├── manifest.json
        ├── experience.json
        └── branding/
```

## Selecting a package

- VS Code F5 and the Vite development server read `content/active-package.json`.
- The packaged Go service reads `CTG_ENGAGE_PACKAGE` and returns it from `/api/config`.
- ExpoPi defaults to `CTG_ENGAGE_PACKAGE=ctg-ga` in the systemd unit.
- The complete offline build includes all packages. Switching the environment setting and restarting the service changes organizations without changing or rebuilding application code.

The package identifier must use lowercase letters and numbers separated by single hyphens, such as `ctg-ga` or `alg-demo`.

## Manifest contract

`manifest.json` supplies:

- schema version and package identifier;
- display name, organization, and locale;
- the relative path to the experience JSON;
- four theme colors: background, surface, primary, and secondary.

Experience and asset paths must remain relative to the package. Absolute URLs, parent-directory traversal, query strings, and network resources are rejected. This keeps a package self-contained and offline-first.

## Scope boundary

V1 supports one active package selected by configuration. It does not include a package picker, inheritance, downloads, synchronization, a package editor, or a marketplace.

`alg-demo` exists only to prove portability against a real second organization. Its compact content is based on public American Legion Gaming material, uses a non-official demo mark, and is labeled inside the experience as an internal proof of concept. It is not an official ALG product.
