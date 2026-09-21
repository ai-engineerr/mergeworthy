import type { CheckId, NoulQuestion, ScoreQuestion } from "@/interfaces/gateInterfaces";

/** The v1 HTTP contract, called directly: https://docs.typesafe.ai/api.md */
export const JEV_ENDPOINT = "https://api.typesafe.ai/v1/systemone";
export const JEV_MODEL = "jev-latest";
/** $0.042 per million input tokens; output is not metered. */
export const JEV_INPUT_COST_PER_TOKEN = 0.042 / 1_000_000;

/** 429 and 529 are documented as retryable; gateway errors are retried the same way. */
export const RETRYABLE_STATUSES: ReadonlySet<number> = new Set([429, 500, 502, 503, 504, 529]);
export const MAX_ATTEMPTS = 5;
export const BACKOFF_BASE_MS = 400;
export const BACKOFF_MAX_MS = 10_000;
export const BACKOFF_JITTER = 0.25;

export const GITHUB_API = "https://api.github.com";
export const GITHUB_API_VERSION = "2022-11-28";
export const CONTRIBUTING_PATHS: readonly string[] = ["CONTRIBUTING.md", ".github/CONTRIBUTING.md", "docs/CONTRIBUTING.md"];

/** Bounds on what Jev reads per PR. Tokens are the cost, and cost is what makes a per-PR check viable. */
export const MAX_PULLS = 20;
export const MAX_CONTRIBUTING_CHARS = 4_000;
export const MAX_DESCRIPTION_CHARS = 3_000;
export const MAX_DIFF_FILES = 12;
export const MAX_PATCH_CHARS = 1_500;
export const MAX_REPO_INPUT_CHARS = 200;
export const NO_CONTRIBUTING = "This project has no CONTRIBUTING file.";
export const NO_DESCRIPTION = "(no description)";

/**
 * Policy lives here, in code, not inside the model. A check's "problem" is the
 * probability that it is failing; these numbers say when that is worth acting on.
 */
export const GATE = { confident: 0.85, possible: 0.6 } as const;
/** A PR is only called low-value when the model is confident, never on a hunch. */
export const LOW_VALUE_GATE = GATE.confident;

export interface Check {
  id: CheckId;
  /** True when "yes" is the healthy answer, so a problem is 1 minus the answer. */
  healthyWhenTrue: boolean;
  /** Only asked when the project has a CONTRIBUTING file to judge against. */
  needsContributing?: boolean;
  question: NoulQuestion;
  /** The sentence a maintainer would send. Fixed text: nothing here is generated. */
  ask?: string;
}

export const CHECKS: readonly Check[] = [
  {
    id: "describesChange",
    healthyWhenTrue: true,
    question: {
      type: "noul",
      instructions:
        "Does `pullRequest.description` say specifically what this pull request changes and why the change is needed?",
      criteria: {
        true: "It states the concrete change and the reason for it, in terms specific to this pull request.",
        false: "It is empty, a placeholder, or generic text that would fit any pull request."
      }
    },
    ask: "Could you add a short description of what this changes and why it is needed?"
  },
  {
    id: "matchesDiff",
    healthyWhenTrue: true,
    question: {
      type: "noul",
      instructions:
        "Does `pullRequest.description` accurately match the changes in `diff`? Every change it claims should appear in the diff, and the diff should not contain substantial changes the description never mentions.",
      criteria: {
        true: "The description and the diff agree.",
        false: "The description claims changes the diff does not contain, or the diff contains changes the description never mentions."
      }
    },
    ask: "The description and the diff do not line up. Could you update the description, or split out the changes it does not mention?"
  },
  {
    id: "testingEvidence",
    healthyWhenTrue: true,
    question: {
      type: "noul",
      instructions:
        "Do `diff` or `pullRequest.description` show that the change was tested, either through added or updated tests or a stated way it was verified, or is it a change that needs no tests, such as documentation?",
      criteria: {
        true: "It adds or updates tests, says how it was verified, or is a change that needs no tests.",
        false: "It changes behaviour with no test changes and no account of how it was checked."
      }
    },
    ask: "Could you add or update tests, or say how you verified this?"
  },
  {
    id: "followsContributing",
    healthyWhenTrue: true,
    needsContributing: true,
    question: {
      type: "noul",
      instructions: "Does this pull request follow the process and requirements set out in `contributing`?",
      criteria: {
        true: "It meets the contribution requirements that can be judged from the title, description and diff.",
        false: "It clearly skips a requirement in `contributing`, such as a required format, linked issue or template."
      }
    },
    ask: "This may not follow the project's contributing guide. Could you check CONTRIBUTING.md and update the PR?"
  },
  {
    id: "focused",
    healthyWhenTrue: true,
    question: {
      type: "noul",
      instructions: "Does this pull request do one focused thing, rather than mixing unrelated changes?",
      criteria: {
        true: "All of the changes serve a single purpose.",
        false: "It mixes changes that could be reviewed and merged independently."
      }
    },
    ask: "Could you split the unrelated changes into separate pull requests?"
  },
  {
    id: "lowValue",
    healthyWhenTrue: false,
    question: {
      type: "noul",
      instructions:
        "Is this pull request a trivial or cosmetic change with no clear benefit to the project, such as whitespace or wording churn, or a change that only adds noise for reviewers?",
      criteria: {
        true: "The change has no clear benefit: cosmetic churn, wording swaps or noise.",
        false: "The change fixes, adds or documents something a user or maintainer would care about."
      }
    }
  }
];

export const EFFORT_QUESTION_ID = "reviewEffort";

/** Ordered levels, described as situations: a Score is only as good as its rubric. */
export const EFFORT_QUESTION: ScoreQuestion = {
  type: "score",
  instructions: "How much reviewer time would this pull request take to review properly?",
  criteria: [
    "Tiny: a few lines or a documentation fix that can be reviewed in minutes",
    "Small: one focused change that a reviewer can hold in their head",
    "Substantial: several files or logic that needs real understanding of the surrounding code",
    "Large: cross-cutting or architectural, needing careful attention from more than one reviewer"
  ]
};

export const COMMENT_GREETING = "Thanks for the contribution! A few things would help reviewers:";

/** How the ranked queue orders verdicts. Unchecked sits above low-value: a human should look at it. */
export const VERDICT_RANK: Record<"ready" | "changes" | "unchecked" | "lowValue", number> = {
  ready: 0,
  changes: 1,
  unchecked: 2,
  lowValue: 3
};

export const SAMPLE_REPOS: string[] = ["expressjs/express", "psf/requests", "sindresorhus/got"];
