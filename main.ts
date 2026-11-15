// makefun-coin-promo-01 entrypoint (Node 22, standard library only, no network).
//
// The entry is the coin itself: MakeFun Beacon ($BEACON), launched on pump.fun
// from the agent wallet linked to @hewes-net. The house reads the coin as
// pump.fun shows it (logo, name, ticker, description, website) and hands that
// to the judge. This program only copies LAUNCH.json from the repository root
// to /output/LAUNCH.json, where the gate reads it. Nothing it writes is judged.
//
// LAUNCH.json currently holds placeholders: it is filled with the real mint
// and create signature only after the coin is launched (DO NOT LAUNCH without
// Arsha's explicit go-ahead — launching spends real SOL on mainnet).
//
// Run locally the way the grader does:
//   mkdir -p out && MAKEFUN_BOT_DIR=. MAKEFUN_OUTPUT_DIR=out node main.ts

// Validate LAUNCH.json before copying, so a bad mint/signature fails loudly
// here instead of silently passing the gate: mint must be base58, 32-44 chars
// decoding to 32 bytes; create_signature base58, 64-88 chars decoding to
// 64 bytes (signature) or 32 bytes (key). Placeholders fail this check on
// purpose — the starter is invalid until the real coin is launched.
import { copyFileSync, mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const BOT_DIR = process.env.MAKEFUN_BOT_DIR ?? '/bot';
const OUTPUT_DIR = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
const BASE58 = /^[1-9A-HJ-NP-Za-z]+$/;
const BASE58_ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

function base58Decode(s: string): Uint8Array {
  let n = 0n;
  for (const ch of s) {
    const i = BASE58_ALPHABET.indexOf(ch);
    if (i < 0) throw new Error(`not base58: ${ch}`);
    n = n * 58n + BigInt(i);
  }
  const bytes: number[] = [];
  while (n > 0n) {
    bytes.unshift(Number(n & 0xffn));
    n >>= 8n;
  }
  let leading = 0;
  for (const ch of s) {
    if (ch === '1') leading++;
    else break;
  }
  return new Uint8Array([...Array(leading).fill(0), ...bytes]);
}

const raw = readFileSync(join(BOT_DIR, 'LAUNCH.json'), 'utf8');
const launch = JSON.parse(raw) as { mint?: unknown; create_signature?: unknown };
const mint = typeof launch.mint === 'string' ? launch.mint : '';
const createSignature =
  typeof launch.create_signature === 'string' ? launch.create_signature : '';

if (!BASE58.test(mint) || mint.length < 32 || mint.length > 44 || base58Decode(mint).length !== 32) {
  console.error('LAUNCH.json mint is not a base58 Solana address (32-44 chars, 32 bytes)');
  process.exit(1);
}
if (!BASE58.test(createSignature) || createSignature.length < 32 || createSignature.length > 88) {
  console.error('LAUNCH.json create_signature is not a base58 signature (32-88 chars)');
  process.exit(1);
}
const sigBytes = base58Decode(createSignature).length;
if (sigBytes !== 64 && sigBytes !== 32) {
  console.error('LAUNCH.json create_signature does not decode to 64 bytes (signature) or 32 bytes (key)');
  process.exit(1);
}

console.log(`mint: ${mint}`);
console.log(`create_signature: ${createSignature}`);

mkdirSync(OUTPUT_DIR, { recursive: true });
try {
  copyFileSync(join(BOT_DIR, 'LAUNCH.json'), join(OUTPUT_DIR, 'LAUNCH.json'));
} catch (err) {
  console.error(`LAUNCH.json could not be copied from ${BOT_DIR}: ${(err as Error).message}`);
  process.exit(1);
}
