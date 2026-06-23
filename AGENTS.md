# Autosign Agent Notes

## Release asset naming

Keep the repository source filenames stable:

- `autoSign.js`
- `README.md`
- `CHANGELOG.md`

When publishing GitHub Release assets, use versioned filenames so downloaded files are easy to identify:

- `autosign-vX.Y.Z.js`
- `autosign-vX.Y.Z-readme.md`
- `autosign-vX.Y.Z-changelog.md`

For pre-release versions, keep the full tag in the filename:

- `autosign-v1.1.8-beta.js`

Do not commit these versioned release files back into the source tree unless explicitly requested. Generate them from the release tag or release commit during publishing.

## User guide image for v1.1.8 and later

Starting with `v1.1.8`, each recommended release should include a user guide image asset:

- `autosign-vX.Y.Z-guide.png`

The image must be generated with Codex image generation / img2.0 capability, not hand-built with local drawing scripts. The image should be a user-facing Chinese infographic that covers:

- main script features
- changes in the current version
- common problems and troubleshooting
- installation and update guidance

Use clear, non-sensitive visuals. Do not include real account data, business documents, internal URLs, cookies, tokens, or screenshots that expose private information.

For `v1.1.8`, the guide image should highlight:

- more reliable batch signature list refresh
- safer file switching on the signature page
- clearer running status messages
- log export for troubleshooting
- Tampermonkey update advice: delete the old manually installed script before adding the new one, or use Tampermonkey update when installed through GreasyFork
