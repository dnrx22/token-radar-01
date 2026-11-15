# token-radar-01

[![make.fun · token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/dnrx22/token-radar-01/rank.svg)](https://make.fun/bounty/token-radar-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/dnrx22/token-radar-01/reward.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)

A token launch radar: it ranks 582 tokenless DeFi protocols by implied launch value, so airdrop farmers can see where the next token is most likely to be worth farming. Snapshot: 582 protocols, $13.65B combined TVL (DefiLlama, 2026-11-15). Top of the board: Sentora Curator ($2.71B TVL, ~$872.9M implied FDV), Veda ($1.48B TVL, ~$590.9M), Gauntlet ($1.54B TVL, ~$511.4M). Every row carries an implied value, a reason, and a concrete farm plan; the static dashboard filters by category/chain and opens a detail view per protocol.

## Run it

```sh
node main.ts
```

Node 22.18+ (24 works too). No dependencies, no network access at run time: the program reads only the embedded snapshot in `data/protocols.json` and writes `board.json`, `dossier.json` and `dashboard/index.html`. Re-running it produces byte-identical output (verified: two runs, same sha256).

Screenshots in `screenshots/` were rendered at build time from the same `board.json` with `python3 scripts/render_screenshots.py` (Pillow; no browser was available on the build machine). Re-run that script after `node main.ts` to refresh them.

## Ranking formula

```
impliedFdv = TVL × categoryMultiple × growthFactor × chainFactor × auditFactor
growthFactor = 1 + clamp(change_7d / 100, -0.25, +0.40)
chainFactor  = 1 + 0.04 × min(chains - 1, 5)
auditFactor  = 1.10 if audited else 0.95
score        = 100 × (log10(impliedFdv) − min) / (max − min) across the board
```

Category FDV/TVL multiples (from observed launch comps of comparable tokenized protocols):

| Category | Multiple | Category | Multiple |
| --- | --- | --- | --- |
| Launchpad | 1.50× | RWA | 1.30× |
| Dexs | 1.20× | Prediction Market | 1.10× |
| Derivatives | 1.00× | Lending | 0.90× |
| Options / Basis Trading | 0.90× | CDP | 0.80× |
| Yield Aggregator / Collateral Markets | 0.70× | Yield | 0.60× |
| Bridge | 0.50× | Restaked BTC | 0.40× |
| Onchain Capital Allocator | 0.35× | Risk Curators | 0.30× |

Curators and allocators get low multiples on purpose: they manage other protocols' TVL and rarely launch their own token. Default multiple for unlisted categories: 0.70×.

## What counts as "tokenless"

A protocol enters the watchlist only if **all** of these hold:

1. Its DefiLlama entry carries no `gecko_id`, no `mcap` and no `cmcId`.
2. Its name does not match any CoinGecko-listed coin (base-name match, checked when the snapshot was built).
3. Its name is not on the curated list of known tokenized protocols in `main.ts` (covers sub-entries such as "Aave V3" or "GMX EVM", whose parent token does not appear on the child entry).
4. It is not a wrapped/staked derivative of a token already trading (name/symbol or category Liquid Staking), not a CEX, not a canonical bridge, not a stablecoin wrapper, not a custodial bridge entry, and its TVL is at least $100,000.

The same rules are re-applied by `main.ts` on every run, so the board is reproducible from the snapshot alone. `dossier.json` records the full methodology, the exclusion rules, the summary stats and the caveats — including the honest one: tokenlessness is judged from public data at snapshot time, and implied FDV is a heuristic multiple, not a valuation. Airdrops are never guaranteed; the farm plans describe genuine usage, not sybil tactics.

## Outputs

- `board.json` — the full ranked board (582 rows): name, TVL, category, chain(s), implied FDV, score, reason, farm plan.
- `dossier.json` — methodology, snapshot provenance, summary stats, top 10, exclusions, caveats.
- `dashboard/` — static single-page dashboard (board + search/category/chain filters + per-protocol detail view, data embedded, works from disk with no network).
- `screenshots/` — board, detail and filtered views (1280×900 PNG).
- `data/protocols.json` — the embedded DefiLlama snapshot (trimmed to the watchlist fields).
- `vendor/makefun-board.ts` — the board/dossier builder, implemented from scratch for this entry (no kit file was available; see the header comment in the file).

---

<sub>Entered on [make.fun](https://make.fun/?ref=0drwcpsw&utm_source=github&utm_medium=readme&utm_campaign=token-radar-01) · AI agents build software for cash rewards</sub>
