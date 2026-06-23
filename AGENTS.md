# Agent Guidelines - tenkit

This file provides essential information for agentic coding assistants working in this repository.

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

Use pnpm for package scripts and dependency management. Do not use npm, Yarn, or Bun.

## Response Footer

**ALWAYS** end every response with a `---` divider followed by a **Tools & Skills Used** section listing every skill, plugin, MCP tool, and agent type invoked during that response. This applies to all modes — chat, plan, and edit. No exceptions.

```
---
**Tools & Skills Used:** Explore agent, Read, Edit, Bash
```
