# Publish tradingcandle-react-native

Package page: https://www.npmjs.com/package/tradingcandle-react-native

Account: https://www.npmjs.com/~vknpms

The name is unscoped. Do not pass `--access public`. That flag is only for scoped names such as `@vknpms/something`.

`0.1.0` is already published. npm will reject the same version. Bump the version before you publish again.

## 1. Log in

```bash
npm login
npm whoami
```

`whoami` must print `vknpms`.

This account has no authenticator app. Publishing needs a granular access token with "bypass 2FA" and permission to publish packages. Create it at https://www.npmjs.com/settings/vknpms/tokens. Do not commit the token. Delete the token file after the publish.

## 2. Build


```bash
pnpm install
pnpm --filter tradingcandle-react-native build
```

## 3. Bump the version

In `packages/native/package.json`, change `"version": "0.1.0"` to the next version, for example `0.1.1`.

## 4. Check the tarball

```bash
pnpm --filter tradingcandle-react-native exec npm pack --dry-run
```

The list should include `dist/index.js`, `dist/index.cjs`, `dist/index.d.ts`, `chart.html`, `README.md`, and `PUBLISH.md`. It should not list `@talkwallet/chart-core` or `klinecharts` under dependencies.

## 5. Publish

```bash
pnpm --filter tradingcandle-react-native publish --no-git-checks
```

A successful publish prints `+ tradingcandle-react-native@0.1.1`.

If npm returns `E403` and asks for two-factor authentication, the login token cannot publish. Use the granular token from step 1. If npm returns `E401`, that token was revoked. Create a new one.

## 6. Confirm

```bash
npm view tradingcandle-react-native version
```

The registry can take a few seconds. A `404` right after publish often clears on a second try.

Install in an app with:

```bash
npm install tradingcandle-react-native react-native-webview
```
