# Contributing to Mergeworthy

Thanks for helping. Mergeworthy ranks a repository's open pull requests by review-readiness, so it would be
odd if our own PRs skipped the checks it makes. The bar below is the same one it applies.

## Set up

You need Node 22.15 or newer (24 recommended) and a [TypeSafe](https://docs.typesafe.ai) API key.

```bash
npm install
cp .env.example .env.local   # add TYPESAFE_API_KEY; GITHUB_TOKEN is optional
npm run dev                  # http://localhost:3000
```

Before you open a PR, all three of these must pass. CI runs the same ones.

```bash
npm run lint
npm run check    # assertions over verdict logic, ranking and input bounds
npm run build
```

## What a good PR looks like

- **One focused change.** Unrelated fixes go in separate PRs.
- **A description that says what and why**, not just what the diff already shows.
- **Evidence it works.** New verdict logic needs an assertion in `scripts/check.ts`. A behaviour change needs a
  note on how you verified it, ideally a scan against a real repository.
- **No secrets.** Never commit `.env.local` or paste a key into an issue or PR.

## Design rules

These keep the project honest, so PRs that break them will be asked to change.

1. **Jev judges, code decides.** Questions ask what is true of a PR. Thresholds, ranking and fail-closed
   behaviour live in `src/helper/gate.ts` and `src/constants/gateConstants.ts`, and are unit-checked.
2. **Nothing is generated.** Suggested comments are assembled from fixed sentences in `gateConstants.ts`. Do not
   add free-text generation about someone's contribution.
3. **Fail closed.** A missing or off-schema answer is "Look" and is counted. It must never read as a clean PR.
4. **Read-only.** Mergeworthy never comments on, labels or closes anything. A change that acts on a repository
   needs an issue and a discussion first.
5. **Judge the contribution, not the author.** No "AI-generated" detection and no scoring by who sent it.
6. **Strings and numbers live in `src/constants/`.** No hardcoded copy or thresholds in components.

Code style: TypeScript with typed params and returns, double quotes, semicolons, `undefined` over `null`, small
single-purpose modules, and CSS Modules next to the component.

## Adding a check

1. Add the id to `CheckId` in `src/interfaces/gateInterfaces.ts`.
2. Add the question to `CHECKS` in `src/constants/gateConstants.ts`. Ask **one** narrow yes/no judgment, and write
   both `criteria` outcomes as concrete situations. Set `healthyWhenTrue` to match the wording. Add the fixed
   `ask` sentence a maintainer would send.
3. Add its label and failing text to `CHECK_TEXT` in `src/constants/text.ts`.
4. Run `npm run check`. It builds its fixtures from `CHECKS`, so your new check is exercised automatically. Add an
   assertion for any special rule.
5. Scan a real repository and read the verdicts before you open the PR. Model output is a claim to test.

## Reporting bugs and ideas

Open an issue with the repository you scanned, what you expected and what you saw. For a wrong verdict, include
the PR number so it can be reproduced. Security problems go through [SECURITY.md](SECURITY.md), not a public issue.
