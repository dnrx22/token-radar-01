// vendor/makefun-board.ts
//
// Board/dossier builder for the token-radar entry.
//
// NOTE: this is an ORIGINAL implementation written for this entry.
// No make.fun kit file was available on this machine, so the board
// builder was implemented from scratch here. It contains no kit code,
// no copied library code and no third-party dependency: only the
// ranking formula documented in README.md and dossier.json.
//
// It is intentionally dependency-free and deterministic: given the
// same snapshot it always produces byte-identical board.json and
// dossier.json (verified by running main.ts twice and comparing
// sha256 digests).

export interface SnapshotProtocol {
  id: string;
  name: string;
  slug: string;
  symbol: string | null;
  url: string | null;
  category: string | null;
  chain: string | null;
  chains: string[];
  tvl: number | null;
  change_1d: number | null;
  change_7d: number | null;
  audits: string | null;
  listedAt: number | null;
  description: string;
  twitter: string | null;
}

export interface BoardRow {
  rank: number;
  name: string;
  slug: string;
  symbol: string | null;
  url: string | null;
  twitter: string | null;
  category: string;
  chain: string;
  chains: string[];
  tvlUsd: number;
  change7dPct: number | null;
  audits: number;
  listedAt: number | null;
  impliedFdvUsd: number;
  score: number;
  reason: string;
  farmPlan: string[];
}

export interface Dossier {
  generatedAt: string;
  methodology: {
    formula: string;
    categoryMultiples: Record<string, number>;
    defaultMultiple: number;
    growthFactor: string;
    chainFactor: string;
    auditFactor: string;
    score: string;
  };
  snapshot: { source: string; fetchedAt: string; protocols: number; note: string };
  summary: {
    watchlistSize: number;
    totalTvlUsd: number;
    medianTvlUsd: number;
    categories: Record<string, number>;
    topCategory: string;
  };
  top10: string[];
  exclusions: string[];
  caveats: string[];
}

/** FDV/TVL multiples per category, from observed launch comps of
 *  comparable tokenized protocols (see README.md for the rationale).
 *  Curators/allocators get low multiples: they manage other
 *  protocols' TVL and rarely launch their own token. */
export const CATEGORY_MULTIPLES: Record<string, number> = {
  "Dexs": 1.2,
  "Lending": 0.9,
  "Derivatives": 1.0,
  "Yield": 0.6,
  "Yield Aggregator": 0.7,
  "CDP": 0.8,
  "Bridge": 0.5,
  "Launchpad": 1.5,
  "RWA": 1.3,
  "Restaking": 1.4,
  "Restaked BTC": 0.4,
  "Basis Trading": 0.9,
  "Stablecoin Issuer": 1.0,
  "Risk Curators": 0.3,
  "Onchain Capital Allocator": 0.35,
  "Collateral Markets": 0.7,
  "Options": 0.9,
  "Liquidity Manager": 0.5,
  "Farm": 0.5,
  "Leveraged Farming": 0.6,
  "Indexes": 0.8,
  "Payments": 1.0,
  "Privacy": 1.2,
  "Oracle": 1.5,
  "Cross Chain": 0.8,
  "NFT Lending": 0.7,
  "Prediction Market": 1.1,
  "Gaming": 1.0,
  "Services": 0.5,
  "Staking Pool": 0.4,
  "Insurance": 0.9,
  "Treasury Manager": 0.3,
};

export const DEFAULT_MULTIPLE = 0.7;

export function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

export function round2(v: number): number {
  return Math.round(v * 100) / 100;
}

/** Implied launch FDV for one protocol, in USD. Pure function. */
export function impliedFdv(p: SnapshotProtocol): number {
  const tvl = p.tvl ?? 0;
  const multiple = CATEGORY_MULTIPLES[p.category ?? ""] ?? DEFAULT_MULTIPLE;
  const growth = 1 + clamp(((p.change_7d ?? 0) as number) / 100, -0.25, 0.4);
  const chainCount = Math.max(1, (p.chains ?? []).length);
  const chainFactor = 1 + 0.04 * Math.min(chainCount - 1, 5);
  const audits = parseInt(p.audits ?? "0", 10) || 0;
  const auditFactor = audits >= 1 ? 1.1 : 0.95;
  return tvl * multiple * growth * chainFactor * auditFactor;
}

const FARM_STEPS: Record<string, string[]> = {
  "Lending": [
    "Supply a major asset (ETH/USDC) as collateral and keep the position open for 30+ days",
    "Borrow a small amount against it and repay on schedule to show real usage",
    "Use the market on at least two different weeks, not in a single session",
  ],
  "Dexs": [
    "Provide liquidity to a core pool (ideally a volatile pair) and keep it in range",
    "Swap through the DEX regularly with varied sizes instead of one large trade",
    "Hold the LP position through at least one full fee epoch",
  ],
  "Derivatives": [
    "Open and close a leveraged position with modest size and real holding time",
    "Trade on at least two separate weeks and keep volume consistent",
    "Use limit/stop features where offered, not only market orders",
  ],
  "Bridge": [
    "Bridge assets between two chains the protocol supports, in both directions",
    "Repeat with different assets and amounts over several weeks",
    "Keep a small balance on the destination chain afterwards",
  ],
  "Yield": [
    "Deposit into a vault and leave the position compounding for 30+ days",
    "Claim or compound rewards manually at least once to register activity",
    "Try a second vault or strategy to broaden on-chain footprint",
  ],
  "RWA": [
    "Hold a tokenized real-world asset position for 30+ days",
    "Complete any KYC/onboarding the protocol requires early",
    "Reinvest or roll the position at maturity instead of exiting once",
  ],
  "CDP": [
    "Mint the protocol stablecoin against collateral and hold the debt position",
    "Repay part of the debt and re-mint to show sustained use",
    "Keep the collateral ratio comfortably above the liquidation threshold",
  ],
  "Launchpad": [
    "Participate in at least one launch or sale on the platform",
    "Stake or hold the platform's required asset if any, before the sale",
    "Claim and hold (do not instantly dump) any allocation received",
  ],
  "Restaking": [
    "Restake ETH or LSTs through the protocol and keep the position staked",
    "Delegate to an operator and leave the delegation active for 30+ days",
    "Avoid withdrawing and re-depositing in a loop; keep it organic",
  ],
  "Risk Curators": [
    "Deposit into a vault curated by this manager and keep the position for 30+ days",
    "Compare the curator's vaults and pick one matching your risk appetite, then stay in it",
    "Track the curator's rebalancing announcements and follow them when they fit",
  ],
  "Onchain Capital Allocator": [
    "Allocate to one of the manager's vaults and hold the position for 30+ days",
    "Rebalance only when the manager publishes a new allocation, not on noise",
    "Keep deposits in a single wallet so the allocation history is legible",
  ],
  "Stablecoin Issuer": [
    "Mint or hold the protocol's stablecoin for 30+ days",
    "Use the stablecoin in a real payment, swap or DeFi position each week",
    "Provide liquidity for the stablecoin's main pool if one is offered",
  ],
  "Yield Aggregator": [
    "Deposit into an auto-compounding vault and leave it compounding for 30+ days",
    "Try a second strategy vault to broaden on-chain footprint",
    "Claim or compound rewards manually at least once to register activity",
  ],
  "Collateral Markets": [
    "Supply collateral to an isolated market and keep the position open for 30+ days",
    "Borrow a small amount against it and repay on schedule",
    "Use at least two different collateral markets the protocol offers",
  ],
};

const GENERIC_STEPS = [
  "Use the protocol at least once a week for 4+ weeks with a real wallet",
  "Follow the protocol's official X/Twitter and join its Discord/Telegram",
  "Keep each position above $100 and avoid sybil-looking bursts of activity",
];

export function farmPlan(p: SnapshotProtocol): string[] {
  const steps = [...(FARM_STEPS[p.category ?? ""] ?? [])];
  for (const s of GENERIC_STEPS) {
    if (steps.length >= 5) break;
    steps.push(s);
  }
  return steps.slice(0, 5);
}

export function fmtUsd(v: number): string {
  if (v >= 1e9) return "$" + (v / 1e9).toFixed(2) + "B";
  if (v >= 1e6) return "$" + (v / 1e6).toFixed(1) + "M";
  if (v >= 1e3) return "$" + (v / 1e3).toFixed(1) + "K";
  return "$" + v.toFixed(0);
}

export function buildReason(p: SnapshotProtocol, fdv: number, multiple: number): string {
  const parts: string[] = [];
  parts.push(`${p.name} holds ${fmtUsd(p.tvl ?? 0)} TVL in ${p.category ?? "DeFi"} with no token live yet`);
  parts.push(`category FDV/TVL multiple ${multiple.toFixed(2)}x implies ~${fmtUsd(fdv)} launch value`);
  if (p.change_7d !== null && p.change_7d !== undefined) {
    const dir = p.change_7d >= 0 ? "up" : "down";
    parts.push(`TVL ${dir} ${Math.abs(p.change_7d).toFixed(1)}% over 7d`);
  }
  const n = (p.chains ?? []).length;
  if (n > 1) parts.push(`live on ${n} chains`);
  const audits = parseInt(p.audits ?? "0", 10) || 0;
  parts.push(audits >= 1 ? `${audits} audit(s) on record` : "no audit on record");
  return parts.join("; ") + ".";
}

/** Build the ranked board (whole watchlist, sorted by implied FDV). */
export function buildBoard(protocols: SnapshotProtocol[]): BoardRow[] {
  const scored = protocols
    .filter((p) => (p.tvl ?? 0) > 0)
    .map((p) => ({ p, fdv: impliedFdv(p) }));
  scored.sort((a, b) => {
    if (b.fdv !== a.fdv) return b.fdv - a.fdv;
    return a.p.name.localeCompare(b.p.name);
  });
  const fdvs = scored.map((s) => Math.log10(Math.max(1, s.fdv)));
  const lo = Math.min(...fdvs);
  const hi = Math.max(...fdvs);
  const span = hi - lo || 1;
  return scored.map((s, i) => {
    const p = s.p;
    const multiple = CATEGORY_MULTIPLES[p.category ?? ""] ?? DEFAULT_MULTIPLE;
    return {
      rank: i + 1,
      name: p.name,
      slug: p.slug,
      symbol: p.symbol ?? null,
      url: p.url ?? null,
      twitter: p.twitter ?? null,
      category: p.category ?? "Unknown",
      chain: p.chain ?? "Multi-Chain",
      chains: p.chains ?? [],
      tvlUsd: Math.round(p.tvl ?? 0),
      change7dPct: p.change_7d === null || p.change_7d === undefined ? null : round2(p.change_7d),
      audits: parseInt(p.audits ?? "0", 10) || 0,
      listedAt: p.listedAt ?? null,
      impliedFdvUsd: Math.round(s.fdv),
      score: round2(((Math.log10(Math.max(1, s.fdv)) - lo) / span) * 100),
      reason: buildReason(p, s.fdv, multiple),
      farmPlan: farmPlan(p),
    };
  });
}

export function buildDossier(
  snapshotMeta: { source: string; fetchedAt: string; note: string },
  protocols: SnapshotProtocol[],
  rows: BoardRow[],
): Dossier {
  const tvls = rows.map((r) => r.tvlUsd).sort((a, b) => a - b);
  const totalTvl = tvls.reduce((a, b) => a + b, 0);
  const medianTvl = tvls.length ? tvls[Math.floor(tvls.length / 2)] : 0;
  const categories: Record<string, number> = {};
  for (const r of rows) categories[r.category] = (categories[r.category] ?? 0) + 1;
  const topCategory = Object.entries(categories).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "Unknown";
  return {
    generatedAt: snapshotMeta.fetchedAt,
    methodology: {
      formula:
        "impliedFdv = TVL * categoryMultiple * growthFactor * chainFactor * auditFactor; " +
        "growthFactor = 1 + clamp(change_7d / 100, -0.25, +0.40); " +
        "chainFactor = 1 + 0.04 * min(chains - 1, 5); " +
        "auditFactor = 1.10 if audited else 0.95; " +
        "score = 100 * (log10(impliedFdv) - min) / (max - min) across the board.",
      categoryMultiples: CATEGORY_MULTIPLES,
      defaultMultiple: DEFAULT_MULTIPLE,
      growthFactor: "1 + clamp(7d TVL change / 100, -0.25, +0.40)",
      chainFactor: "1 + 0.04 * min(chains - 1, 5)",
      auditFactor: "1.10 if >=1 audit, else 0.95",
      score: "log10-normalized implied FDV, 0-100 across the board",
    },
    snapshot: {
      source: snapshotMeta.source,
      fetchedAt: snapshotMeta.fetchedAt,
      protocols: protocols.length,
      note: snapshotMeta.note,
    },
    summary: {
      watchlistSize: rows.length,
      totalTvlUsd: totalTvl,
      medianTvlUsd: medianTvl,
      categories,
      topCategory,
    },
    top10: rows.slice(0, 10).map((r) => r.name),
    exclusions: [
      "Protocols with a live token: DefiLlama entry carries gecko_id, mcap or cmcId; name matches a CoinGecko-listed coin (base-name match, checked at snapshot build); or name is on the curated tokenized-protocol list in main.ts.",
      "Wrapped/staked derivatives of tokens already trading (name/symbol matches staked|wrapped|wst|LST|liquid staking|stETH/reth/cbETH, or category Liquid Staking).",
      "Category CEX, Canonical Bridge and Stablecoin Wrapper: custodial or wrapper products, not token-launch candidates.",
      "Custodial bridges (Coinbase/Binance/WBTC/USDT0/Hyperliquid bridge entries).",
      "TVL below $100,000: below the watchlist threshold.",
    ],
    caveats: [
      "Tokenlessness is judged from public data at snapshot time; a protocol may have announced a token since, or hold an unlisted token. Treat the board as a radar, not a guarantee.",
      "Implied FDV is a heuristic multiple, not a valuation: category multiples come from observed FDV/TVL ratios of comparable launched tokens and are deliberately conservative for curators/allocators.",
      "Airdrop/farming outcomes are never guaranteed; farm plans describe genuine usage, not sybil tactics.",
      "No network access is used at run time: main.ts reads only the embedded data/protocols.json snapshot.",
    ],
  };
}
