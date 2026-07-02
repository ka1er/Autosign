# Autosign Agent Notes

## Project Scope

This repository maintains the Autosign Tampermonkey userscript for PMS electronic signature workflows.

Keep the repository focused on source code, user-facing documentation, release notes, and project maintenance notes. Do not commit real business documents, screenshots with private data, account information, cookies, tokens, exported logs, browser cache, videos, or local-only test data.

## Local Codex Memory

`AGENTS.md` is the operating memory and rulebook for AI agents (Codex, Claude Code, etc.) on this project. It is checked into the repository root so AI tools automatically pick up project conventions when working in the repo.

## Core Files

Keep these source filenames stable:

- `autoSign.js`
- `README.md`
- `CHANGELOG.md`

The real script version is the `@version` value in the userscript header of `autoSign.js`.

## Change Principles

- Prefer the existing script structure and local helper functions.
- Keep changes scoped to the current issue; avoid unrelated refactors.
- Before changing automation flow, consider all affected pages: todo page, batch signature page, and signature page.
- Be especially careful with run/stop state, cross-page state sync, popup handling, timed refresh, batch selection, and file switching.
- Do not reintroduce a page execution lock that blocks normal handoff between PMS pages.
- Do not clear all page timeouts globally; avoid interfering with PMS page timers.
- Do not use real business data in examples or tests.

## Versioning

- Treat `main` as the user-facing stable line. If GreasyFork or another public installer syncs from GitHub, assume it may sync from `main`.
- Put untested workflow changes and beta builds on a beta branch, such as `beta/1.1.9`, instead of committing them directly to `main`.
- Publish beta GitHub releases from the matching beta branch/tag when possible. Do not merge beta work into `main` until the user confirms it is stable enough for ordinary users.
- When a beta becomes stable, update the version and release notes for the formal version, merge the beta branch into `main`, then publish the normal release.
- Stable, business-tested builds should be published as normal releases.
- Untested or newly adjusted workflow logic should be published as beta first.
- Small fixes found during the same beta testing phase should stay in the current beta version/release unless the user asks for a new version number.
- Beta releases do not need a feature introduction image.
- Formal recommended releases should include clear, user-facing release notes.
- Write `CHANGELOG.md` in plain user language. Avoid overly technical descriptions unless they help troubleshooting.

## Release Assets

Release assets should include separate files:

- `autoSign.js`
- `README.md`
- `CHANGELOG.md`

Do not publish only a zip archive. Do not commit generated release copies back into the source tree unless the user explicitly asks.

## Guide Images

Formal recommended releases must include a Chinese feature and usage guide image, and `README.md` must link to the current formal version's guide image.

Guide image requirements:

- Generate with img2.0.
- Keep the visual style and layout consistent with the previous formal guide image unless the user explicitly asks for a redesign.
- Explain installation, update, running, settings, common issues, and version changes for both new and existing users.
- Do not include real accounts, business files, internal URLs, cookies, tokens, or sensitive screenshots.
- Beta versions do not require a guide image.
- After publishing a formal release, upload the guide image to that release with a versioned filename such as `autosign-v1.1.9-guide.png`, then update the README homepage image link to the same version.

## Git Workflow

- Use `main` as the default maintenance branch for release-ready project state.
- Use `beta/<version>` branches for beta testing work that should not be exposed through `main`.
- Before making or uploading beta changes, confirm the current branch is the intended beta branch, not `main`.
- Before publishing a normal release or anything that GreasyFork may sync, confirm the current branch is `main` and the build has been business-tested.
- Avoid keeping misleading old working branch names.
- Do not delete, reset, overwrite, or revert user changes without explicit confirmation.
- Before publishing, confirm the local branch and `origin/main` state are understood.

