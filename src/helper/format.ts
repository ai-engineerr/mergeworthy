export const formatMs = (ms: number): string => (ms >= 1000 ? `${(ms / 1000).toFixed(2)} s` : `${Math.round(ms)} ms`);

/** Per-PR costs are fractions of a cent, so they are shown to the digit that matters. */
export const formatUsd = (usd: number): string => (usd > 0 && usd < 0.0001 ? "<$0.0001" : `$${usd.toFixed(4)}`);

export const formatPercent = (probability: number): string => `${Math.round(probability * 100)}%`;
