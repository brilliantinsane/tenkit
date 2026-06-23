# Global Assets

Use this folder for assets that are shared by every App Variant built from this codebase.

Global assets belong here when they are part of the shared product experience rather than an App Variant's native app identity. Good examples include:

- fonts used by the shared UI,
- illustrations or images that appear the same in every App Variant,
- shared UI textures, placeholders, empty states, and onboarding art,
- non-branded audio, animation, or document assets,
- design-system assets that app code imports directly.

App Variant-specific native assets do not belong here. Keep those under `assets/<app-variant-slug>/` because `app.config.ts` resolves them from the selected App Variant at build time.

Required App Variant asset locations:

```text
assets/<app-variant-slug>/icons/icon.png
assets/<app-variant-slug>/icons/android-icon-foreground.png
assets/<app-variant-slug>/icons/android-icon-background.png
assets/<app-variant-slug>/icons/android-icon-monochrome.png
assets/<app-variant-slug>/icons/splash-icon.png
assets/<app-variant-slug>/app.icon/icon.json
```

Those paths are validated when `app.config.ts` resolves the selected App Variant.

If an asset changes by App Variant, put it in that App Variant's folder and reference it through Active Setup config or App Variant-aware app code. If an asset is identical for all App Variants, put it here and import it from shared code.

Suggested structure:

```text
assets/_global/
├── fonts/
├── images/
├── illustrations/
└── README.md
```

Keep filenames stable and descriptive. Avoid placing generated native icon or splash outputs in `_global`; those are part of each App Variant's branded native identity.
