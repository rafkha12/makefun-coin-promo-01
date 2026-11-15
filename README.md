# MakeFun Beacon ($BEACON) — makefun-coin-promo-01

A real coin on pump.fun that sells make.fun to pump.fun's traders, made and
launched by an agent. An AI judge compares the coins two at a time on
creativity, how well they promote make.fun, and packaging. Top 50 share
$1,000 (1st $150). Deadline 2026-11-17T06:00:00Z (13:00 WIB).

## The coin

- **Name:** MakeFun Beacon
- **Ticker:** $BEACON
- **Website:** https://make.fun/bounty/makefun-coin-promo-01
- **Logo:** `assets/beacon-logo.png` — original art, generated for this entry:
  a magenta-and-white lighthouse beaming glowing cyan code brackets `{ }`
  across a navy night sky, a gold coin glinting in the beam. 1600x1600,
  833,017 bytes, no text. No ghost, no copied mascot.
- **Concept:** make.fun is the beacon. It shines a light out to every builder
  and AI agent on Solana: see a bounty, ship a program, climb the board.
  The lighthouse *is* make.fun's job, so the promotion is the coin's idea,
  not a line tacked on.

## Description (as launched on pump.fun)

> Follow the light. Build. Win.
> This coin is our entry for the make.fun bounty: https://make.fun/bounty/makefun-coin-promo-01
> make.fun is where people and their AI agents build real programs, enter paid competitions (bounties) and get scored and ranked in the open.
> $BEACON is that light: a lighthouse beaming code out to every builder on Solana. See a bounty, ship a program, climb the board. Tap the website to reach the bounty page and build your own.

## Status

**LAUNCHED 2026-11-15 ~14:20 WIB (07:20 UTC).** Create-only, no buy.

- **Mint:** `7Xd5QCRwBQi1tMqr1EXEWenemk1xAZxYw4D8qzskfJHh`
- **Create signature:** `4h8sQeWFD7HtCrnVgiC1i4pgbVGpasSr1pL947Q3fmR6NPuRnNtTG5pXRmQZyRSQK6vpzxrMJXWKAaV6nofwdCD2`
- **Links:** https://pump.fun/coin/7Xd5QCRwBQi1tMqr1EXEWenemk1xAZxYw4D8qzskfJHh ·
  https://solscan.io/tx/4h8sQeWFD7HtCrnVgiC1i4pgbVGpasSr1pL947Q3fmR6NPuRnNtTG5pXRmQZyRSQK6vpzxrMJXWKAaV6nofwdCD2
- **Finalized:** slot 469643572, block time 2026-11-15T07:20:26Z, tx err null,
  pump program in logs, mint's only tx is the create, mint account exists.
- **Metadata:** https://files.catbox.moe/gi44bp.json — read back via the
  browser (name MakeFun Beacon, symbol BEACON, description + website as
  designed, image https://files.catbox.moe/jn9dbp.png). The pump.fun coin
  page loads showing MakeFun Beacon ($BEACON).
- **Cost correction:** spent **0.017792763 SOL** (balance 0.032227237 →
  0.014434474), NOT the ~0.0078 SOL in the preview. The preview estimate
  was wrong: it assumed GHOST's 0.0178 included a 0.01 SOL buy, but GHOST
  had no buy — its create alone cost exactly 0.017792763, and BEACON's
  create cost the identical figure, confirming the create is deterministic.
  Balance after (0.0144 SOL) still covers a prize-claim fee (~0.0035 SOL).
- **Launch hiccups (all recovered):** first --send died at upload
  (pump.fun IPFS terminated, catbox ECONNRESET, 0 spent); launch.mjs v2
  added retries + a curl route and the retry's catbox upload succeeded on
  attempt 2. The script then crashed on the flaky metadata read-back
  fetch AFTER the tx finalized, before writing its result files —
  launch-result.json was reconstructed from stdout + independent RPC and
  browser verification (see its `note` field), and the read-back is now
  warning-only in launch.mjs.
- **Still to do:** main chat creates the GitHub repo, pushes, submits
  (deadline 2026-11-17T06:00:00Z). `.makefun/owner.json` with the agent
  wallet is already in the repo so the first submit is not refused for
  repo_not_owned (the mistake that killed the btc-cent entry).

## The program

`main.ts` (Node 22, standard library only) copies `LAUNCH.json` to
`/output/LAUNCH.json`. That is all it does — the house reads the coin itself.

Run it locally:

    mkdir -p out && MAKEFUN_BOT_DIR=. MAKEFUN_OUTPUT_DIR=out node main.ts

## Launch plan

`launch.mjs` is the prepared launch script (proven flow from the
coin-launch-01 GHOST launch, adapted: new name/ticker/description, new
logo, website set, create-only option costed). It is NOT run until Arsha
approves. It uploads the logo + metadata to pump.fun IPFS, builds the
create transaction, simulates it, signs with the agent wallet, sends it,
waits for finality, verifies on-chain, and writes `launch-result.json` +
the real `LAUNCH.json`.
