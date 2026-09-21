# Mergeworthy

Point it at a public GitHub repository and it ranks the open pull requests by how ready they are for review.

Maintainers are drowning in low-effort and machine-generated pull requests. Reading each one to find out whether
it is worth reading is the expensive part. Mergeworthy answers that first question quickly and cheaply, and shows its
working, so a person can spend their time on the PRs that deserve it.

Built on [TypeSafe](https://docs.typesafe.ai) Jev, a System One model: it returns typed answers with calibrated
probabilities and cannot generate text. That is the point. A tool that summarises or reviews with an LLM can
invent things about someone's contribution. Jev can only answer questions about the text it was handed.

## What it does

Enter `owner/repo` (or a github.com URL). Mergeworthy fetches the open PRs, asks Jev a handful of questions about each,
and shows a ranked queue. Click a PR to see every check, its probability of being a problem, and which gate it
crossed.

| Verdict | Meaning |
|---|---|
| **Ready** | No check crossed a threshold. |
| **Changes** | One or more checks look like problems the author can fix. A suggested comment is assembled for you. |
| **Look** | An answer was missing or off-schema, or a call failed. It is never shown as clean. |
| **Low value** | Jev is confident the change has little clear benefit. A maintainer decides what to do. |

The checks, all yes/no questions with a probability:

- Does the description say what changes and why?
- Does the description match the diff?
- Is there evidence of testing (or is it a change that needs none)?
- Does it follow the project's CONTRIBUTING file? (only asked when one exists)
- Is it one focused change?
- Is it a trivial or cosmetic change with no clear benefit?

Plus one Score: how much reviewer time it will take.

## Running it

Needs Node 22.15 or newer.

```bash
npm install
cp .env.example .env.local   # add your TYPESAFE_API_KEY
npm run dev                  # http://localhost:3000
npm run check                # assertions over the verdict logic, ranking and input bounds
```

| Variable | Required | Notes |
|---|---|---|
| `TYPESAFE_API_KEY` | Yes | Read server-side in `/api/gate`. It never reaches the browser. |
| `GITHUB_TOKEN` | No | Raises GitHub's limit from 60 to 5,000 requests an hour. A token with no scopes is enough. |

A scan of 20 PRs costs about 22 GitHub requests, so an unauthenticated session allows roughly two scans an hour.

## How it works

1. `services/github.ts` fetches the 20 most recently updated open PRs, each PR's changed files, and the first
   CONTRIBUTING file it finds.
2. `helper/pullState.ts` builds what Jev reads. Every long field is bounded (description, CONTRIBUTING, each
   patch, number of patches). The file list is always complete, so a change is never silently missing.
3. One Jev call per PR carries all of its questions at once, and all PRs run in parallel. Independent questions
   over the same state cost almost nothing extra, so this is the documented
   [speculative fan-out](https://docs.typesafe.ai/patterns/fan-out.md) shape.
4. `helper/gate.ts` turns the raw probabilities into a verdict. **The model says what is true of the PR; code says
   what to do about it.** The thresholds are constants in `constants/gateConstants.ts`: a check is "possible" at
   60% and "confident" at 85%, and a PR is only called low-value when the model is confident.
5. Anything missing or off-schema fails closed to "Look" and is counted in the footer.
6. Suggested comments are assembled from fixed sentences, one per failed check. Nothing is generated.
7. The route streams newline-delimited JSON, so PRs appear and re-rank one by one as they are judged.

## What it will not do

- It never comments, labels or closes anything. It ranks and suggests; a person decides.
- It judges the contribution, not who or what wrote it. It makes no "AI-generated" claim, which is unreliable
  and unfair to contributors who use tools well.
- It reads text only. It cannot run the tests or see CI.
- It does not replace review. It tells you where to look first.

## Measured

One sample, run on 2026-09-21 against `expressjs/express` (20 open PRs, no CONTRIBUTING file), from one machine.
Treat it as an example, not a benchmark.

| | Result |
|---|---|
| Jev latency per PR | 1.05–1.38s, with all 20 PRs in flight at once (two runs) |
| Whole scan, Jev portion | ~1.4s (the slowest PR, since they run in parallel) |
| GitHub fetch | 0.46–1.74s |
| Input per PR | ~1,000–2,300 tokens |
| Cost for 20 PRs | ~$0.0012 |
| Off-schema answers | 0 of 20 PRs, in both runs |
| Verdicts | 8 ready, 12 changes, 0 low value (both runs, same split) |

Spot-checks agreed with the verdicts: an empty-description PR was flagged for its description, and small
changes to `lib/` with no tests were flagged for missing tests. Per-PR latency here is higher than for a single
small call because 20 requests are in flight together and each state is larger.

## Known limits

- **No accuracy figure yet.** The thresholds have not been tuned on labelled data. In the sample above the
  testing check drove most of the "changes" verdicts, which may be stricter than a given project wants.
- The natural next step is a benchmark against PRs that were later merged or closed unmerged. Merged is not the
  same as good, so treat that as a proxy.
- Only the first 20 open PRs and the first 100 changed files of each are read.
- English only. Very large diffs are truncated per file.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for setup, the design rules and how to add a check. In short: keep
judgments in the questions and policy in code, keep strings in `constants/`, and add an assertion to
`scripts/check.ts` for any new verdict logic. Security issues go through [SECURITY.md](SECURITY.md).

## Licence

MIT
