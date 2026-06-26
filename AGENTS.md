# Autosign Agent Notes

## Project Scope

This repository maintains the Autosign Tampermonkey userscript for PMS electronic signature workflows.

Keep the repository focused on source code, user-facing documentation, release notes, and project maintenance notes. Do not commit real business documents, screenshots with private data, account information, cookies, tokens, exported logs, browser cache, videos, or local-only test data.

## Core Files

Keep these source filenames stable:

- `autoSign.js`
- `README.md`
- `CHANGELOG.md`
- `AGENTS.md`

The real script version is the `@version` value in the userscript header of `autoSign.js`.

## Change Principles

- Prefer the existing script structure and local helper functions.
- Keep changes scoped to the current issue; avoid unrelated refactors.
- Before changing automation flow, consider all affected pages: todo page, batch signature page, and signature page.
- Be especially careful with run/stop state, cross-page state sync, popup handling, timed refresh, batch selection, and file switching.
- Do not reintroduce a page execution lock that blocks normal handoff between PMS pages.
- Do not clear all page timeouts globally; avoid interfering with PMS page timers.
- Do not use real business data in examples or tests.

## Testing

After changing `autoSign.js`, run at least:

```powershell
node --check .\autoSign.js
```

If the change touches logic covered by local tests, run the related `tests/*.test.js` files as well.

Local tests can be used for regression checks, but release assets should not include test files unless the user explicitly requests it.

## Versioning

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

Formal recommended releases can include a Chinese feature and usage guide image.

Guide image requirements:

- Generate with img2.0.
- Explain installation, update, running, settings, common issues, and version changes for both new and existing users.
- Do not include real accounts, business files, internal URLs, cookies, tokens, or sensitive screenshots.
- Beta versions do not require a guide image.

## Git Workflow

- Use `main` as the default maintenance branch for release-ready project state.
- Avoid keeping misleading old working branch names.
- Do not delete, reset, overwrite, or revert user changes without explicit confirmation.
- Before publishing, confirm the local branch and `origin/main` state are understood.
