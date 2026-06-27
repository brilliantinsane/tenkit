# Agent Guidelines - tenkit

This file is the operating contract for agentic coding assistants working in this repository. Keep it specific to Tenkit. Prefer concrete repo rules over generic advice.

## Project Snapshot

Tenkit is an open source pnpm monorepo for helping people quickly start multi-tenant Expo projects.

- `apps/playground` is the runnable Expo Playground. It proves Setup Types, App Variants, Runtime Tenants, Scaffold, Build Preparation, native assets, and runtime bootstrap behavior in a real app.
- `packages/template-generator` is the open source Template generation package. It currently exposes local proof commands while Tenkit sorts out and verifies Templates before the public CLI and create entrypoints exist.
- Public CLI, npm create entrypoints, web builder, publishing, and release automation are future product surfaces unless the current task explicitly scopes them. Local Template proof commands are temporary scaffolding for that future path.

## Non-Negotiables

- Use `pnpm` for package scripts and dependency management. Do not use npm, Yarn, Bun, or ad-hoc package manager commands.
- Expo has changed. Before writing Expo code, read the exact versioned docs at `https://docs.expo.dev/versions/v56.0.0/`.
- Preserve Tenkit domain language. Do not collapse App Variant, Runtime Tenant, Setup Type, Example, Starter Data, Scaffold, Template, Playground, Active Setup, and Build Preparation into generic "tenant/template/app" wording.
- Do not introduce public CLI, create entrypoint, web builder, npm publishing, trusted publishing, or release automation unless explicitly requested.
- Do not mutate the Playground while proving Template generation, and do not treat the Playground as generated output.
- Do not add broad fallbacks to hide broken behavior. Prefer fixing the underlying behavior. Use fallbacks only at external/runtime boundaries where malformed input is expected and the fallback is explicit.

## Commands

Install dependencies:

```bash
pnpm install
```

Playground commands from the workspace root:

```bash
pnpm start
pnpm test
pnpm typecheck
pnpm lint
pnpm tenkit
```

Template generator commands:

```bash
pnpm template-generator:test
pnpm template-generator:typecheck
pnpm verify:generated-white-label
pnpm generate:white-label-proof -- --target ../tenkit-white-label-proof
```

Expo config smoke checks:

```bash
APP_VARIANT_SLUG=first-tenant pnpm -F playground exec expo config --type public
```

Formatting:

```bash
pnpm format
npx prettier --write <files>
```

When a command is impractical because of local environment state, record the exact reason in the final response.

## Architecture Rules

When a request adopts, replaces, or follows an architecture, pattern, reference implementation, or durable boundary, treat the task as system design work before treating it as file editing.

Before editing, state:

- the boundary being changed,
- the invariants the new design must preserve,
- the scope where those invariants apply,
- and, when a reference is named, which responsibilities from the reference are being adopted, adapted, deferred, or rejected.

During implementation:

- apply chosen conventions consistently across the affected scope,
- do not introduce mixed conventions unless the split is intentional and explained,
- and ask before taking a local shortcut that weakens the adopted architecture.

Before finishing:

- verify behavior and consistency across the whole affected scope, not only touched files,
- and create or update architecture documentation for durable boundary changes unless explicitly told not to.

Tenkit-specific boundaries:

- The Playground proves behavior in a real Expo app.
- Scaffold changes the Playground's Active Setup.
- Template generation creates a separate generated project.
- Generated apps are the validation target for Template work.
- Build Preparation selects an App Variant and prepares native project state.
- Runtime Tenant selection remains runtime behavior unless intentionally projected into `extra.activeSetup`.

## TypeScript Rules

- Keep strict TypeScript clean. Do not silence errors with `any`, broad casts, or ignored diagnostics.
- Prefer `unknown` over `any` for untrusted or runtime-shaped values, then narrow explicitly.
- Validate unknown runtime/config data at module boundaries.
- Use `as const`, discriminated unions, and `satisfies` for domain literals and setup definitions.
- Prefer precise exported types where they encode a contract; keep local implementation types local.
- Throw `Error` objects with actionable messages. Do not throw strings.
- Avoid type assertions unless narrowing is not practical. If an assertion is needed, keep it close to the validation that makes it true.
- Do not encode generated TypeScript source as opaque strings when templates or structured data are the actual boundary.

## Expo And React Native Rules

- Use Expo SDK 56 docs and installed package versions as the source of truth.
- Dynamic Expo config must remain deterministic and synchronous.
- App Variant native identity belongs in setup data and config resolution: name, slug, scheme, bundle ID, package name, native assets, theme, and EAS project.
- EAS Project IDs are public identifiers. Do not treat them as secrets, and do not move them into EAS environment variables.
- `APP_VARIANT_SLUG` selects an App Variant for config/build preparation. Do not use it as a Runtime Tenant selector.
- Runtime Tenant records and Capability Profiles should not be dumped wholesale into Expo `extra`.
- For Expo Router React Navigation theme APIs on SDK 56, import from `expo-router/react-navigation`.
- Keep native asset validation aligned with config references. If config references an asset path, tests or generated verification must prove the asset exists.

## Theming Rules

- Playground and generated Templates use the same unified theme structure:
  - `src/theme/config.ts`
  - `src/theme/colors.ts`
  - `src/theme/ThemeContext.tsx`
- `ColorsProvider` owns component color tokens via `useColors()`, `useTheme()`, and `useBrand()`.
- React Navigation `ThemeProvider` is a separate provider and should be wired from `getNavigationTheme(...)`.
- Brand/accent comes from active setup data, usually the active App Variant's `theme.accent`.
- Components should consume semantic tokens and brand tokens. Do not add one-off color systems, hardcoded accent lookups, or platform color calls inside ordinary components.
- The theme boundary owns colors and brand only. Do not expand it into spacing, radius, typography, persistence, or design-system state unless explicitly scoped.

## Template Generator Rules

- Template source lives under `packages/template-generator/templates`.
- Generated text files use `.hbs`; emitted files drop the `.hbs` suffix.
- Static and binary files copy without rendering.
- Dotfiles may use portable source names such as `_gitignore`, `_claude`, and `_vscode`; the generator maps them to dotfile names.
- Escape literal Handlebars syntax as `\{{` when a template file needs to output `{{ ... }}`.
- Use `pathe` for path manipulation inside the generator package.
- Use `fs-extra` for filesystem work inside the generator package.
- Keep generation pure: it returns a sorted flat `VirtualFileTree`.
- Template layers must not silently overwrite the same output path. If `shared/` and a selected Template both want the same file, first choose one owner. Add an explicit override boundary only when the override is intentional, documented, and tested.
- Keep writing separate: the writer owns path validation, overwrite behavior, and filesystem persistence.
- Writer changes need negative tests for unsafe paths, duplicate normalized paths, overwrite behavior, and target-folder safety.
- Generated-output proof must run against a fresh generated app folder, not the Playground.
- Verification should cover generated project shape, dependency installation where practical, TypeScript, and Expo config evaluation.
- Local Template proof commands may intentionally model future create-CLI behavior by writing files, installing dependencies, and initializing an initial git snapshot where possible. Convenience failures in install or git setup must not hide generation errors or mutate the Playground.
- Future generated Setup Type Templates should be siblings of `white-label/`. Do not introduce a durable `base-expo` layer unless a new architecture decision explicitly adopts it.

## Code Organization

- Keep logic near its domain:
  - setup models in `apps/playground/src/setup-types`
  - active setup data in `apps/playground/src/active-setup`
  - runtime hooks in `apps/playground/src/hooks`
  - app UI in `apps/playground/src/app` and `apps/playground/src/components`
  - Playground CLI scripts in `apps/playground/scripts`
  - Template generation in `packages/template-generator/src`
  - Template source in `packages/template-generator/templates`
- Prefer existing local patterns over new abstractions.
- Add an abstraction only when it protects a real boundary, reduces meaningful duplication, or makes a cross-cutting invariant testable.
- Keep functions focused. Extract complex conditionals into named booleans or helper functions.
- Do not add barrel files. Existing `index.ts` files are compatibility or package entrypoints only; avoid expanding them into grab-bag re-export hubs.
- Keep tests close to the behavior they protect.
- Search sibling modules before adding new helpers, hooks, components, or utilities. Reuse or extend the local pattern when one exists.
- Avoid grab-bag modules that mix setup validation, filesystem work, CLI prompts, UI state, logging, and formatting.
- Prefer deleting code or clarifying the existing boundary over adding compatibility wrappers.

## Naming Conventions

Use domain names literally and consistently:

- `AppVariant` for build-time native application identity.
- `RuntimeTenant` for the runtime business or venue context.
- `SetupType` for the relationship model.
- `Example` for opt-in verified references.
- `StarterData` for editable placeholder source facts.
- `Scaffold` for the local operation that changes the Playground's Active Setup.
- `Template` for standalone project-generation source/output.
- `Playground` for the runnable app inside the monorepo.
- `ActiveSetup` for the setup currently installed in the Playground.
- `BuildPreparation` for App Variant-specific native preparation.

Avoid vague aliases:

- Do not use "tenant" when the concept is App Variant or Runtime Tenant.
- Do not use "template" when the concept is Setup Type, Example, or Scaffold.
- Do not use "app" when the concept is App Variant, Playground, or generated app.

Code naming:

- Component and type symbols: `PascalCase`.
- Functions, variables, and local constants: `camelCase`.
- True global constants: `SCREAMING_SNAKE_CASE`.
- Files: prefer `kebab-case`. Framework-required names such as Expo routes (`_layout.tsx`, `index.tsx`) and config files (`app.config.ts`, `eslint.config.js`) are exceptions.
- Prefer responsibility-bearing names such as `resolveAppVariantConfig`, `validateRuntimeTenantAccess`, `writeProject`, and `generateWhiteLabelAppsProject`.
- Avoid `data`, `item`, `config`, `result`, and `value` when the scope is not tiny or the domain meaning is knowable.

## Clean Code Review Rules

- New helpers, wrappers, types, files, comments, effects, memos, fallbacks, adapters, or abstractions must earn their place: they should protect a real boundary, remove meaningful duplication, encode a domain invariant, improve clarity, or make behavior easier to verify. If they do not, inline them, delete them, rename them, or make the existing boundary clearer.
- Search before claiming a new helper, component, hook, or pattern is needed.
- Flag duplicated logic and custom implementations of behavior the codebase already has.
- Keep domain-specific logic close to its domain unless cross-domain reuse is proven.
- Avoid helper slop: tiny wrappers, vague `utils` modules, or extracted private logic with no reusable meaning.
- Avoid type slop: exported one-off types, custom result shapes, or annotations where inference is clearer.
- Avoid comment slop: obvious comments, comments defending awkward code, and stale requirement narration.
- Avoid memo/effect slop in React. Derive values during render unless there is a measured or structural reason not to.
- Keep fixes proportional. Do not introduce architecture, docs, or comments unless they remove ambiguity for future maintainers.

## Testing Rules

- Behavior changes require tests.
- Bug fixes should include a regression test that would fail without the fix.
- Template changes must verify generated output, not only Template source text.
- Dynamic Expo config changes should run an Expo config evaluation.
- Build Preparation and CLI behavior should be tested through planning/runtime boundaries rather than shelling out where possible.
- Keep tests deterministic. Avoid relying on local EAS login state, network state, or machine-specific paths.
- If a practical verification command cannot run, record the limitation and reason.

## Security And Safety

- Never commit secrets, tokens, credentials, local `.env.local`, EAS auth state, cookies, or private machine paths.
- Do not log secrets, environment values, command text that may contain secrets, full file paths, stdout/stderr with user data, or raw external responses unless explicitly safe.
- Validate generated file paths before writing to disk.
- Do not use `eval`, dynamic code execution, or unsafe template evaluation.
- Avoid `dangerouslySetInnerHTML` and direct DOM mutation unless explicitly required and reviewed.
- Do not add network calls to generation or verification unless the task explicitly requires them.
- For generated projects, keep `.env.example` committed and `.env.local` ignored.

## Git And Worktree Safety

- The worktree may contain user or other-agent changes. Do not revert, delete, or overwrite changes you did not make.
- Before destructive commands such as `git reset`, `git checkout --`, `git restore`, `git clean`, or `rm -rf`, show the affected paths and ask for explicit approval.
- If asked to revert your own changes, do it surgically by file/hunk. Do not reset the whole worktree.
- Before commit readiness, run:
  - `git status --short`
  - relevant tests/typechecks
  - `git diff --check`
- Call out untracked package directories, generated output, ignored local artifacts, and local environment issues separately.

## Commit Convention

Follow conventional commits: `category(scope): message`

Categories:

- `feat` - New features
- `fix` - Bug fixes
- `refactor` - Code changes that are not fixes or features
- `docs` - Documentation changes
- `build` - Build/dependency changes
- `test` - Test changes
- `ci` - CI/CD configuration
- `chore` - Other changes

Examples:

- `feat(template-generator): add white label proof verification`
- `fix(playground): validate app variant asset paths`
- `docs(adr): record unified theming boundary`

## Response Footer

**ALWAYS** end every response with a `---` divider followed by a **Tools & Skills Used** section listing every skill, plugin, MCP tool, and agent type invoked during that response. This applies to all modes - chat, plan, and edit. No exceptions.

```text
---
**Tools & Skills Used:** Explore agent, Read, Edit, Bash
```
