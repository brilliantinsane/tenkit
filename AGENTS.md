# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v56.0.0/ before writing any code.

### Commit Convention

Follow conventional commits: `category(scope): message`

Categories:

- `feat` - New features
- `fix` - Bug fixes (reference issue if applicable)
- `refactor` - Code changes that aren't fixes or features
- `docs` - Documentation changes
- `build` - Build/dependency changes
- `test` - Test changes
- `ci` - CI/CD configuration
- `chore` - Other changes

Example: `feat(components): add new prop to avatar component`

### Package Manager

Use Bun for package scripts and dependency management. Do not use npm.

## Agent skills

### Issue tracker

Issues and PRDs are tracked as gitignored local markdown under `.scratch/`. See `docs/agents/issue-tracker.md`.

### Triage labels

Use the five standard triage roles plus local lifecycle statuses for markdown issues. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context layout: read `CONTEXT.md` and relevant ADRs under `docs/adr/`. See `docs/agents/domain.md`.

## Response Footer

**ALWAYS** end every response with a `---` divider followed by a **Tools & Skills Used** section listing every skill, plugin, MCP tool, and agent type invoked during that response. This applies to all modes — chat, plan, and edit. No exceptions.

```
---
**Tools & Skills Used:** Explore agent, Read, Edit, Bash
```
