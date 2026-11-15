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

**PREP ONLY — NOT LAUNCHED.** The launch spends real SOL on mainnet and
happens only after Arsha's explicit go-ahead. `LAUNCH.json` still holds
placeholders until the real mint + create signature exist. See `COIN.md`
for the full launch preview (wallet, balance, exact SOL cost).

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
