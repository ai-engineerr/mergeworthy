# Security policy

## Reporting a vulnerability

Please do not open a public issue for a security problem. Use GitHub's private reporting instead: open the
repository's **Security** tab and choose **Report a vulnerability**. Include what you found, how to reproduce it,
and the impact you expect.

You can expect an acknowledgement within a few days. This is a small open-source project, so there is no
guaranteed fix time, but confirmed issues are prioritised.

## What is in scope

- Anything that could expose `TYPESAFE_API_KEY` or `GITHUB_TOKEN` to the browser, logs or a response.
- Input handling in `/api/gate`, including the repository name that is turned into a GitHub API path.
- Anything that would let Mergeworthy write to a repository. It is read-only by design.

## How secrets are handled

- Both keys are read server-side only, in `src/services/`. They are never sent to the browser.
- `.env.local` is gitignored. Only `.env.example`, which has no values, is committed.
- `GITHUB_TOKEN` is optional, and a token with **no scopes** is enough because only public data is read.
  Do not give it more.
- If you think a key has leaked, revoke it at the provider and create a new one. Do not just delete the commit.

## Supported versions

Only the latest commit on the default branch is supported.
