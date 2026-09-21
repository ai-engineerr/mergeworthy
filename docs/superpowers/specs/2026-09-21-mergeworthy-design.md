# Mergeworthy — design

Open-source demo: rank a public repository's open pull requests by review-readiness using TypeSafe Jev.

## Problem

Maintainers are buried in low-effort and machine-generated PRs; deciding whether one is worth reading costs
review time. Jev returns fast, typed, calibrated judgments and cannot generate text, so it can triage without
inventing anything.

## Flow

1. User enters `owner/repo`. The server fetches up to 20 open PRs, each PR's files, and any CONTRIBUTING file.
2. One Jev call per PR, all in parallel, each carrying every question over the same bounded state (fan-out).
3. Code applies policy to the raw probabilities and streams NDJSON (`meta`, `result`, `done`, `failed`).
4. The UI shows a ranked queue and, per PR, each check's probability against the two gates.

## Judgments (Jev)

Six Noul checks (describes change, matches diff, testing evidence, follows CONTRIBUTING when present, focused,
low value) and one Score (review effort, 4 levels).

## Policy (code)

A check's problem probability is at least 0.6 for "possible" and at least 0.85 for "confident". Low-value is only
a verdict when confident. Any missing or off-schema answer fails closed to "unchecked". Suggested comments are
assembled from fixed sentences. Ranking: verdict, then fewest failed checks, then least effort.

## Boundaries

- Never comments, labels or closes. Judges the contribution, not the author. Reads text only.
- Keys stay server-side. Only `TYPESAFE_API_KEY` is required; `GITHUB_TOKEN` is optional.
- Inputs bounded per PR to control cost and latency; the file list is always complete.

## Out of scope for v1

Accuracy benchmark against merged/closed PRs, GitHub Action, posting comments, private repositories.
