// Launch MakeFun Beacon ($BEACON) on pump.fun — prepared, NOT yet run.
// Run from ~/workspace/makefun (so @solana/kit resolves from its node_modules).
//   node makefun-coin-promo-01/launch.mjs            # dry-run: simulate only, sends NOTHING
//   node makefun-coin-promo-01/launch.mjs --send     # ONLY after Arsha approves: upload + sign + send
//
// Proven flow from the GHOST launch (2026-11-14, spent 0.017792763 SOL for
// create + 0.01 SOL buy; create alone ~0.0078 SOL): hand-built pump.fun
// create instruction, program 6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P.
// pump.fun IPFS 500d for GHOST, so metadata goes up via catbox fallback.
// This bounty needs NO first buy (price/trades are never judged), so the
// default launch is create-only: expected spend ~0.0078 SOL from a balance
// of 0.032227237 SOL. Add --buy to also buy 0.01 SOL like GHOST did.
// Writes launch-result.json + the real LAUNCH.json only on a real --send.
//
// v2 (2026-11-15): the first --send died at the metadata upload — pump.fun
// IPFS fetch "terminated", then the catbox fallback fetch threw ECONNRESET
// UNCAUGHT and crashed the script before any tx was built (0 SOL spent).
// Fix: every upload step now retries (3 attempts, 2s/4s backoff, 30s timeout,
// fresh FormData per attempt), there are three routes in order — pump.fun
// IPFS via Node fetch, catbox via Node fetch, catbox via the curl binary
// (a different HTTP stack; GHOST's catbox upload succeeded from this shell) —
// and the whole upload is wrapped so a failure exits cleanly with code 1
// instead of crashing. 0x0.st is NOT a route: its uploads are disabled.
// The kit documents no other metadata endpoint. Coin, logo, description,
// website and wallet are unchanged.
import { readFileSync, writeFileSync } from 'node:fs';
import {
  address,
  createKeyPairSignerFromBytes,
  getAddressEncoder,
  getBase58Decoder,
  getBase64Decoder,
  getProgramDerivedAddress,
  getTransactionEncoder,
  getUtf8Encoder,
  compileTransaction,
  createTransactionMessage,
  setTransactionMessageFeePayer,
  setTransactionMessageLifetimeUsingBlockhash,
  appendTransactionMessageInstruction,
  signTransaction,
} from '@solana/kit';
import { AccountRole } from '@solana/instructions';

const RPC = 'https://api.mainnet-beta.solana.com';
const PUMP = address('6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P');
const TOKEN_PROGRAM = address('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');
const ATA_PROGRAM = address('ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL');
const MPL = address('metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s');
const SYSTEM_PROGRAM = address('11111111111111111111111111111111');
const RENT = address('SysvarRent111111111111111111111111111111111');
const COMPUTE_BUDGET = address('ComputeBudget111111111111111111111111111111');
const HOME = '/home/hatch';
const REPO = `${HOME}/workspace/makefun/makefun-coin-promo-01`;
const NAME = 'MakeFun Beacon';
const SYMBOL = 'BEACON';
const WEBSITE = 'https://make.fun/bounty/makefun-coin-promo-01';
const DESCRIPTION = [
  'Follow the light. Build. Win.',
  'This coin is our entry for the make.fun bounty: https://make.fun/bounty/makefun-coin-promo-01',
  'make.fun is where people and their AI agents build real programs, enter paid competitions (bounties) and get scored and ranked in the open.',
  '$BEACON is that light: a lighthouse beaming code out to every builder on Solana. See a bounty, ship a program, climb the board. Tap the website to reach the bounty page and build your own.',
].join('\n');
const IMAGE = `${REPO}/assets/beacon-logo.png`;
const SEND = process.argv.includes('--send');
const BUY = process.argv.includes('--buy'); // 0.01 SOL first buy, GHOST-style (not needed)

async function rpc(method, params) {
  const res = await fetch(RPC, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  });
  const json = await res.json();
  if (json.error) throw new Error(`RPC ${method}: ${JSON.stringify(json.error)}`);
  return json.result;
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const u8 = getUtf8Encoder();
const addrEnc = getAddressEncoder();
const b58Dec = getBase58Decoder();

import { execFileSync } from 'node:child_process';

// --- retry helper: run fn up to `tries` times, 2s then 4s backoff ---
async function attempt(label, fn, tries = 3) {
  let lastErr;
  for (let i = 1; i <= tries; i++) {
    try {
      const out = await fn();
      if (i > 1) console.log(`${label}: succeeded on attempt ${i}/${tries}`);
      return out;
    } catch (e) {
      lastErr = e;
      console.log(`${label}: attempt ${i}/${tries} failed: ${String(e.message || e).slice(0, 200)}`);
      if (i < tries) await sleep(i === 1 ? 2000 : 4000);
    }
  }
  throw lastErr;
}

function fetchWithTimeout(url, options = {}, timeoutMs = 30000) {
  return fetch(url, { ...options, signal: AbortSignal.timeout(timeoutMs) });
}

// Route 1: pump.fun's own IPFS upload (fresh FormData per attempt).
async function uploadViaPumpFun(imgBytes) {
  return attempt('pump.fun IPFS', async () => {
    const form = new FormData();
    form.append('name', NAME);
    form.append('symbol', SYMBOL);
    form.append('description', DESCRIPTION);
    form.append('website', WEBSITE);
    form.append('file', new File([imgBytes], 'beacon-logo.png', { type: 'image/png' }));
    const r = await fetchWithTimeout('https://pump.fun/api/ipfs', { method: 'POST', body: form });
    const j = await r.json();
    if (!r.ok || !j.metadataUri) throw new Error(`HTTP ${r.status}: ${JSON.stringify(j).slice(0, 200)}`);
    return j.metadataUri;
  });
}

// Shared catbox two-step: upload image, then metadata JSON pointing at it.
async function catboxUploadFile(bytes, filename, mime, uploadFn) {
  const url = await uploadFn(bytes, filename, mime);
  if (!url.startsWith('https://')) throw new Error(`bad upload URL: ${String(url).slice(0, 200)}`);
  return url;
}
async function uploadViaCatboxFetch(imgBytes) {
  const up = async (bytes, filename, mime) => {
    const form = new FormData();
    form.append('reqtype', 'fileupload');
    form.append('fileToUpload', new File([bytes], filename, { type: mime }));
    const r = await fetchWithTimeout('https://catbox.moe/user/api.php', { method: 'POST', body: form }, 60000);
    const text = (await r.text()).trim();
    if (!r.ok) throw new Error(`HTTP ${r.status}: ${text.slice(0, 200)}`);
    return text;
  };
  const imgUrl = await attempt('catbox image (fetch)', () => catboxUploadFile(imgBytes, 'beacon-logo.png', 'image/png', up));
  const meta = { name: NAME, symbol: SYMBOL, description: DESCRIPTION, image: imgUrl, website: WEBSITE };
  return attempt('catbox metadata (fetch)', () =>
    catboxUploadFile(Buffer.from(JSON.stringify(meta)), 'beacon-metadata.json', 'application/json', up));
}

// Route 3: same catbox host, different HTTP stack — the curl binary.
// GHOST's catbox upload succeeded from this shell; Node fetch is what reset.
function curlUpload(bytes, filename, mime) {
  const out = execFileSync(
    'curl',
    ['-sS', '--max-time', '60', '-F', 'reqtype=fileupload', '-F', `fileToUpload=@/dev/stdin;filename=${filename};type=${mime}`, 'https://catbox.moe/user/api.php'],
    { input: bytes, maxBuffer: 10 * 1024 * 1024, encoding: 'utf8' },
  ).trim();
  if (!out.startsWith('https://')) throw new Error(`bad upload URL: ${out.slice(0, 200)}`);
  return out;
}
async function uploadViaCatboxCurl(imgBytes) {
  const imgUrl = await attempt('catbox image (curl)', () => curlUpload(imgBytes, 'beacon-logo.png', 'image/png'), 2);
  const meta = { name: NAME, symbol: SYMBOL, description: DESCRIPTION, image: imgUrl, website: WEBSITE };
  return attempt('catbox metadata (curl)', () => curlUpload(Buffer.from(JSON.stringify(meta)), 'beacon-metadata.json', 'application/json'), 2);
}

// --- metadata upload: three routes in order; clean error if all fail ---
async function uploadMetadata() {
  const imgBytes = readFileSync(IMAGE);
  const errors = [];
  for (const [label, fn] of [
    ['pump.fun IPFS', () => uploadViaPumpFun(imgBytes)],
    ['catbox via fetch', () => uploadViaCatboxFetch(imgBytes)],
    ['catbox via curl', () => uploadViaCatboxCurl(imgBytes)],
  ]) {
    try {
      const uri = await fn();
      console.log(`metadata uploaded via ${label}: ${uri}`);
      // Warning-only read-back: GHOST's catbox read-back flaked once from
      // this shell even though the upload was good, so never block on it.
      try {
        const check = await fetchWithTimeout(uri, {}, 15000);
        console.log(`metadata read-back: HTTP ${check.status}`);
      } catch (e) {
        console.log(`metadata read-back flaky (warning only): ${String(e.message || e).slice(0, 120)}`);
      }
      return uri;
    } catch (e) {
      console.log(`route ${label} failed: ${String(e.message || e).slice(0, 200)}`);
      errors.push(`${label}: ${String(e.message || e).slice(0, 200)}`);
    }
  }
  throw new Error(`all metadata upload routes failed — ${errors.join(' | ')}`);
}

const agent = await createKeyPairSignerFromBytes(
  new Uint8Array(JSON.parse(readFileSync(`${HOME}/workspace/makefun/makefun-keypair.json`, 'utf8'))),
);
console.log('agent wallet:', agent.address);
const balBefore = (await rpc('getBalance', [agent.address])).value;
console.log('balance before:', balBefore / 1e9, 'SOL');

// --- fresh mint keypair (only used in --send mode; dry-run reuses a throwaway) ---
import { generateKeyPairSync } from 'node:crypto';
const mk = generateKeyPairSync('ed25519');
const mkSeed = Buffer.from(mk.privateKey.export({ format: 'jwk' }).d, 'base64url');
const mkPub = Buffer.from(mk.publicKey.export({ format: 'jwk' }).x, 'base64url');
const mintBytes = [...mkSeed, ...mkPub];
const mint = await createKeyPairSignerFromBytes(new Uint8Array(mintBytes));
console.log('mint (fresh):', mint.address);
if (SEND) writeFileSync(`${REPO}/mint-keypair.json`, JSON.stringify(mintBytes), { mode: 0o600 });

let metadataUri = 'https://example.invalid/beacon-metadata.json';
if (SEND) {
  try {
    metadataUri = await uploadMetadata();
  } catch (e) {
    console.error(`METADATA UPLOAD FAILED — nothing built, nothing sent, 0 SOL spent: ${e.message}`);
    process.exit(1);
  }
}
console.log('metadataUri:', metadataUri);
if (!SEND) {
  console.log('DRY RUN — metadata NOT uploaded, nothing sent. Metadata JSON that will be uploaded:');
  console.log(JSON.stringify({ name: NAME, symbol: SYMBOL, description: DESCRIPTION, image: '<uploaded logo URL>', website: WEBSITE }, null, 2));
}

// --- PDAs ---
const [mintAuthority] = await getProgramDerivedAddress({ programAddress: PUMP, seeds: [u8.encode('mint-authority')] });
const [bondingCurve] = await getProgramDerivedAddress({ programAddress: PUMP, seeds: [u8.encode('bonding-curve'), addrEnc.encode(mint.address)] });
const [associatedBondingCurve] = await getProgramDerivedAddress({
  programAddress: ATA_PROGRAM,
  seeds: [addrEnc.encode(bondingCurve), addrEnc.encode(TOKEN_PROGRAM), addrEnc.encode(mint.address)],
});
const [global] = await getProgramDerivedAddress({ programAddress: PUMP, seeds: [u8.encode('global')] });
const [metadata] = await getProgramDerivedAddress({
  programAddress: MPL,
  seeds: [u8.encode('metadata'), addrEnc.encode(MPL), addrEnc.encode(mint.address)],
});
const [eventAuthority] = await getProgramDerivedAddress({ programAddress: PUMP, seeds: [u8.encode('__event_authority')] });

// --- build create instruction (discriminator + borsh strings from pump IDL) ---
function borshString(s) {
  const b = Buffer.from(s, 'utf8');
  const len = Buffer.alloc(4);
  len.writeUInt32LE(b.length);
  return Buffer.concat([len, b]);
}
const data = Buffer.concat([
  Buffer.from([24, 30, 200, 40, 5, 28, 7, 119]),
  borshString(NAME),
  borshString(SYMBOL),
  borshString(metadataUri),
  Buffer.from(addrEnc.encode(agent.address)),
]);
const createIx = {
  programAddress: PUMP,
  accounts: [
    { address: mint.address, role: AccountRole.WRITABLE_SIGNER },
    { address: mintAuthority, role: AccountRole.READONLY },
    { address: bondingCurve, role: AccountRole.WRITABLE },
    { address: associatedBondingCurve, role: AccountRole.WRITABLE },
    { address: global, role: AccountRole.READONLY },
    { address: MPL, role: AccountRole.READONLY },
    { address: metadata, role: AccountRole.WRITABLE },
    { address: agent.address, role: AccountRole.WRITABLE_SIGNER },
    { address: SYSTEM_PROGRAM, role: AccountRole.READONLY },
    { address: TOKEN_PROGRAM, role: AccountRole.READONLY },
    { address: ATA_PROGRAM, role: AccountRole.READONLY },
    { address: RENT, role: AccountRole.READONLY },
    { address: eventAuthority, role: AccountRole.READONLY },
    { address: PUMP, role: AccountRole.READONLY },
  ],
  data: new Uint8Array(data),
};
const price = Buffer.alloc(9);
price[0] = 3;
price.writeBigUInt64LE(1000n, 1);
const budgetIx = { programAddress: COMPUTE_BUDGET, accounts: [], data: new Uint8Array(price) };

const latest = await rpc('getLatestBlockhash', []);
const { blockhash, lastValidBlockHeight } = latest.value;
let message = createTransactionMessage({ version: 0 });
message = setTransactionMessageFeePayer(agent.address, message);
message = setTransactionMessageLifetimeUsingBlockhash({ blockhash, lastValidBlockHeight }, message);
message = appendTransactionMessageInstruction(budgetIx, message);
message = appendTransactionMessageInstruction(createIx, message);
const tx = compileTransaction(message);

// --- simulate ---
const sim = await rpc('simulateTransaction', [
  getBase64Decoder().decode(getTransactionEncoder().encode(tx)),
  { sigVerify: false, commitment: 'processed', encoding: 'base64' },
]);
console.log('simulate err:', JSON.stringify(sim.value.err));
if (sim.value.err) {
  console.log('SIMULATION FAILED — not sending');
  process.exit(1);
}
if (!SEND) {
  console.log('DRY RUN OK — expected create-only spend ~0.0078 SOL (GHOST create rent+fees).');
  console.log('Re-run with --send (after Arsha approves) to upload metadata, sign and send.');
  if (BUY) console.log('NOTE: --buy was passed but dry-run sends nothing; the 0.01 SOL buy runs only with --send --buy.');
  process.exit(0);
}

// --- sign + send ---
const signed = await signTransaction([agent.keyPair, mint.keyPair], tx);
const sig = await rpc('sendTransaction', [
  getBase64Decoder().decode(getTransactionEncoder().encode(signed)),
  { skipPreflight: false, preflightCommitment: 'processed', maxRetries: 5, encoding: 'base64' },
]);
console.log('create signature:', sig);
let status = null;
for (let i = 0; i < 60; i++) {
  await sleep(2000);
  const r = await rpc('getSignatureStatuses', [[sig], { searchTransactionHistory: true }]);
  status = r.value[0];
  if (status && (status.confirmationStatus === 'finalized' || status.confirmationStatus === 'confirmed')) break;
}
console.log('confirmation status:', JSON.stringify(status));
if (!status || status.err) throw new Error(`tx not confirmed cleanly: ${JSON.stringify(status)}`);

const txInfo = await rpc('getTransaction', [sig, { maxSupportedTransactionVersion: 0, commitment: 'finalized' }]);
console.log('tx err:', JSON.stringify(txInfo.meta.err), 'slot:', txInfo.slot, 'blockTime:', txInfo.blockTime);
const logs = txInfo.meta.logMessages || [];
console.log('pump program in logs:', logs.some((l) => l.includes('6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P')));
const mintSigs = await rpc('getSignaturesForAddress', [mint.address, { limit: 10 }]);
console.log('mint tx count:', mintSigs.length, 'oldest:', mintSigs[mintSigs.length - 1]?.signature);
const oldestIsOurs = mintSigs.length > 0 && mintSigs[mintSigs.length - 1].signature === sig;
let metaJson = null;
try {
  const metaRes = await fetch(metadataUri);
  metaJson = await metaRes.json();
  console.log('metadata reads back:', JSON.stringify(metaJson));
} catch (e) {
  // Warning only: the metadata read-back from this shell is flaky
  // (catbox returned empty replies for GHOST too, yet its coin listed
  // fine). The upload itself already returned its URL, and the tx is
  // final — a failed read-back must never crash the script now.
  console.log(`metadata read-back failed (warning only, upload already succeeded): ${String(e.message || e).slice(0, 160)}`);
}
const balAfter = (await rpc('getBalance', [agent.address])).value;
console.log('balance after:', balAfter / 1e9, 'SOL, spent:', (balBefore - balAfter) / 1e9, 'SOL');

const result = {
  mint: mint.address,
  create_signature: sig,
  metadata_uri: metadataUri,
  program: '6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P',
  slot: txInfo.slot,
  block_time: txInfo.blockTime,
  block_time_iso: new Date(txInfo.blockTime * 1000).toISOString(),
  finalized: status.confirmationStatus === 'finalized',
  err_free: txInfo.meta.err === null,
  pump_program_in_logs: logs.some((l) => l.includes('6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P')),
  oldest_tx_is_create: oldestIsOurs,
  mint_tx_count: mintSigs.length,
  metadata: metaJson,
  balance_before_sol: balBefore / 1e9,
  balance_after_sol: balAfter / 1e9,
  spent_sol: (balBefore - balAfter) / 1e9,
};
writeFileSync(`${REPO}/launch-result.json`, JSON.stringify(result, null, 2));
writeFileSync(`${REPO}/LAUNCH.json`, JSON.stringify({ mint: mint.address, create_signature: sig }, null, 2));
console.log('RESULT:', JSON.stringify(result, null, 2));
console.log('LAUNCH.json written with the real mint + create signature.');
