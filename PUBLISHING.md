# Publishing

Packages are public and unscoped:

- `tradingcandle-core`
- `tradingcandle-web`
- `tradingcandle-react-native`

`tradingcandle-webview` is private. Its HTML is inlined into `tradingcandle-react-native` at build time. `tradingcandle-core` is bundled into that package, so the published React Native chart does not depend on it.

## One-time setup

1. Enable 2FA on the npm account. For publishes, use an automation token or approve the prompt from the CLI.
2. Add the repository secret `NPM_TOKEN` (Automation token) for the GitHub Actions release job. Do not commit the token.

## Check the tarball before publishing

```bash
pnpm install
pnpm build
pnpm test
pnpm --filter tradingcandle-core exec npm pack --dry-run
pnpm --filter tradingcandle-web exec npm pack --dry-run
pnpm --filter tradingcandle-react-native exec npm pack --dry-run
```

`npm pack --dry-run` prints the files that would be uploaded. Confirm `dist` types are present and that `tradingcandle-react-native` does not list `klinecharts` or `tradingcandle-core` as a dependency. The chart script is already inside the published JavaScript.

## Log in and publish

```bash
npm login
pnpm changeset
pnpm version-packages
pnpm release
```

`pnpm release` runs `pnpm build` and then `changeset publish`. These package names are unscoped, so do not pass `--access public`.

To publish the current `0.1.0` without a changeset:

```bash
pnpm build
pnpm --filter tradingcandle-core publish --no-git-checks
pnpm --filter tradingcandle-web publish --no-git-checks
pnpm --filter tradingcandle-react-native publish --no-git-checks
```

Publish core before web, and web before native, if you publish by hand. npm will not upload a package whose workspace dependency is still `workspace:*`; Changesets rewrites those versions during `version-packages`. If you publish by hand from a workspace, pnpm replaces `workspace:*` with the current version.

## Versioning

```bash
pnpm changeset
pnpm version-packages
```

That updates versions, writes `CHANGELOG.md`, and opens a release pull request when the GitHub Action runs on `main`. Merging that pull request publishes, using `NPM_TOKEN`.
