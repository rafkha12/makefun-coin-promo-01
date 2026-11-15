# MakeFun Beacon ($BEACON) — launch preview + result

**Status: LAUNCHED 2026-11-15 ~14:20 WIB (07:20 UTC), create-only.**
Mint `7Xd5QCRwBQi1tMqr1EXEWenemk1xAZxYw4D8qzskfJHh`, create signature
`4h8sQeWFD7HtCrnVgiC1i4pgbVGpasSr1pL947Q3fmR6NPuRnNtTG5pXRmQZyRSQK6vpzxrMJXWKAaV6nofwdCD2`,
finalized slot 469643572. Spent **0.017792763 SOL** (0.032227237 →
0.014434474) — the preview's ~0.0078 SOL estimate was wrong; see
"Actual cost" below. Full verified record in `launch-result.json`.

## The coin

- **Name:** MakeFun Beacon
- **Ticker:** $BEACON
- **Website (metadata + pump.fun):** https://make.fun/bounty/makefun-coin-promo-01
- **Logo:** `assets/beacon-logo.png` (original, generated for this entry)
  - Magenta/white lighthouse beaming glowing cyan `{ }` code brackets
    across a navy night sky, gold coin glinting in the beam, no text.
  - 1600 x 1600 px = 2,560,000 pixels (< 16,000,000 limit)
  - 833,017 bytes (< 5,242,880 limit)
  - sha256: daba0d697145022add83017a807d4513c62a88296ae72e50af3d0f970e0cf8a7
- **Concept:** make.fun is the beacon — it shines a light out to every
  builder and AI agent on Solana: see a bounty, ship a program, climb the
  board. The lighthouse *is* make.fun's job, so the promotion is the coin's
  idea, not a line tacked on. Deliberately NOT a ghost: the last bounty's
  field was 24/27 ghost copies, and the house coins already cover ghost
  rocket, cowboy robot, goblin laptop, haunted leaderboard and payday robot.

## Description (exact text for pump.fun metadata)

```
Follow the light. Build. Win.
This coin is our entry for the make.fun bounty: https://make.fun/bounty/makefun-coin-promo-01
make.fun is where people and their AI agents build real programs, enter paid competitions (bounties) and get scored and ranked in the open.
$BEACON is that light: a lighthouse beaming code out to every builder on Solana. See a bounty, ship a program, climb the board. Tap the website to reach the bounty page and build your own.
```

Checks: contains `make.fun/bounty/makefun-coin-promo-01` as the full
https URL ✓, says the coin is for this bounty ✓, explains what make.fun
is ✓. ~430 characters (< 4,000 limit).

## Metadata JSON (uploaded at launch)

```json
{
  "name": "MakeFun Beacon",
  "symbol": "BEACON",
  "description": "Follow the light. Build. Win.\nThis coin is our entry for the make.fun bounty: https://make.fun/bounty/makefun-coin-promo-01\nmake.fun is where people and their AI agents build real programs, enter paid competitions (bounties) and get scored and ranked in the open.\n$BEACON is that light: a lighthouse beaming code out to every builder on Solana. See a bounty, ship a program, climb the board. Tap the website to reach the bounty page and build your own.",
  "image": "<uploaded logo URL>",
  "website": "https://make.fun/bounty/makefun-coin-promo-01"
}
```

## Wallet + balance (checked 2026-11-15 ~13:57 WIB, RPC getBalance)

- **Wallet (agent wallet, linked to @hewes-net):**
  `EfsoDHVSge9UoDzh6Ti5JEzhDM8bSECq1KTyRiRSZWq7`
- **Balance now:** 32,227,237 lamports = **0.032227237 SOL**
  (unchanged since the GHOST launch; no SOL spent since)
- **Window:** opens 2026-11-15T06:00:00Z, deadline 2026-11-17T06:00:00Z
  (2026-11-17 13:00 WIB). Launch must be inside it.

## Exact SOL cost (from the proven GHOST launch)

GHOST (2026-11-14): balance 0.05002 → 0.032227237 SOL,
**spent 0.017792763 SOL total** = 0.01 SOL first buy + ~0.007792763 SOL
create rent + fees. The create itself (hand-built pump.fun create
instruction, program `6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P`)
cost ~0.0078 SOL; the buy was separate. The bounty judges the coin as
launched — price, trades and holders are never judged — so no buy is
required.

- **Option A (recommended): create-only, no first buy — ~0.0078 SOL.**
  Balance after ≈ 0.0244 SOL. Leaves plenty for a prize-claim fee
  (~0.0035 SOL) if the coin wins.
- **Option B (like GHOST): create + 0.01 SOL first buy — ~0.0178 SOL.**
  Balance after ≈ 0.0144 SOL. Still funded, no top-up needed.
- **Either way: NO top-up needed.** Balance 0.0322 SOL covers both.

## Actual cost (correction — read this, the preview above was wrong)

The launch spent **0.017792763 SOL** for create-only — the preview's
~0.0078 SOL figure was my error: I had decomposed GHOST's 0.017792763
as "0.01 buy + 0.0078 fees", but GHOST had NO buy (MEMORY.md says so)
— its create alone cost exactly 0.017792763, and BEACON's create cost
the identical figure to the lamport. The pump.fun create (mint +
bonding-curve + metadata rent + fees) is deterministic at 0.017792763
SOL. Balance after is 0.014434474 SOL, still comfortably above the
~0.0035 SOL a prize claim would need. No further spend is planned.

## Launch flow (proven GHOST path, adapted)

1. Fresh mint keypair (new, never reused).
2. Upload `assets/beacon-logo.png` + metadata JSON. First try
   pump.fun `/api/ipfs`; GHOST's run hit 500s there, so the fallback is
   catbox upload (image + metadata JSON), exactly as GHOST used
   (`https://files.catbox.moe/88frns.json` pattern).
3. Build the hand-built pump.fun `create` instruction (same program,
   PDAs and discriminator as `create-handbuilt.mjs`), simulate first.
   `--send` only: sign with agent wallet + mint, send, wait for
   finalised, verify on-chain (pump program in logs, mint's oldest tx
   is the create, metadata reads back).
4. Write the real `LAUNCH.json` (`mint` + `create_signature`) and
   `launch-result.json`, re-run `main.ts`, re-check, then report to
   Arsha. Submit happens only from the main chat after the repo is on
   GitHub.

`launch.mjs` in this repo is that prepared script. Default run is
dry-run (simulate only, no send). It sends NOTHING without `--send`,
and `--send` is only run after Arsha approves.
