# Publishing

Packages are public and scoped:

- `@talkwallet/chart-core`
- `@talkwallet/chart-web`
- `tradingcandle-react-native`

`@talkwallet/chart-webview` is private. Its HTML is inlined into `tradingcandle-react-native` at build time. `@talkwallet/chart-core` is bundled into that package, so the published React Native chart does not depend on it.

## One-time setup

1. Create the npm scope `talkwallet` (or rename the `name` fields before you publish).
2. Enable 2FA on the npm account. For publishes, use an automation token or approve the prompt from the CLI.
3. Add the repository secret `NPM_TOKEN` (Automation token) for the GitHub Actions release job. Do not commit the token.

## Check the tarball before publishing

```bash
pnpm install
pnpm build
pnpm test
pnpm --filter @talkwallet/chart-core exec npm pack --dry-run
pnpm --filter @talkwallet/chart-web exec npm pack --dry-run
pnpm --filter tradingcandle-react-native exec npm pack --dry-run
```

`npm pack --dry-run` prints the files that would be uploaded. Confirm `dist` types are present and that `tradingcandle-react-native` does not list `klinecharts` or `@talkwallet/chart-core` as a dependency. The chart script is already inside the published JavaScript.

## Log in and publish

```bash
npm login
pnpm changeset
pnpm version-packages
pnpm release
```

`pnpm release` runs `pnpm build` and then `changeset publish`, which runs `npm publish --access public` for each changed public package.

To publish the current `0.1.0` without a changeset:

```bash
pnpm build
pnpm --filter @talkwallet/chart-core publish --access public
pnpm --filter @talkwallet/chart-web publish --access public
pnpm --filter tradingcandle-react-native publish --no-git-checks
```

Publish core before web, and web before native, if you publish by hand. npm will not upload a package whose workspace dependency is still `workspace:*`; Changesets rewrites those versions during `version-packages`. If you publish by hand from a workspace, pnpm replaces `workspace:*` with the current version.

## Versioning

```bash
pnpm changeset
pnpm version-packages
```

That updates versions, writes `CHANGELOG.md`, and opens a release pull request when the GitHub Action runs on `main`. Merging that pull request publishes, using `NPM_TOKEN`.
