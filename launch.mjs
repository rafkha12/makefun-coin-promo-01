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

// --- metadata upload: pump.fun IPFS first, catbox fallback (GHOST's path) ---
async function uploadMetadata(imageUrl) {
  const meta = { name: NAME, symbol: SYMBOL, description: DESCRIPTION, image: imageUrl, website: WEBSITE };
  const imgBytes = readFileSync(IMAGE);
  const form = new FormData();
  form.append('name', NAME);
  form.append('symbol', SYMBOL);
  form.append('description', DESCRIPTION);
  form.append('website', WEBSITE);
  form.append('file', new File([imgBytes], 'beacon-logo.png', { type: 'image/png' }));
  try {
    const r = await fetch('https://pump.fun/api/ipfs', { method: 'POST', body: form });
    const j = await r.json();
    if (r.ok && j.metadataUri) return j.metadataUri;
    console.log('pump.fun IPFS failed, falling back to catbox:', r.status, JSON.stringify(j).slice(0, 200));
  } catch (e) {
    console.log('pump.fun IPFS error, falling back to catbox:', e.message);
  }
  const up = new FormData();
  up.append('reqtype', 'fileupload');
  up.append('fileToUpload', new File([imgBytes], 'beacon-logo.png', { type: 'image/png' }));
  const r2 = await fetch('https://catbox.moe/user/api.php', { method: 'POST', body: up });
  const imgUrl = (await r2.text()).trim();
  if (!r2.ok || !imgUrl.startsWith('https://')) throw new Error(`catbox image upload failed: ${r2.status} ${imgUrl.slice(0, 200)}`);
  const meta2 = { ...meta, image: imgUrl };
  const up2 = new FormData();
  up2.append('reqtype', 'fileupload');
  up2.append('fileToUpload', new File([JSON.stringify(meta2)], 'beacon-metadata.json', { type: 'application/json' }));
  const r3 = await fetch('https://catbox.moe/user/api.php', { method: 'POST', body: up2 });
  const metaUrl = (await r3.text()).trim();
  if (!r3.ok || !metaUrl.startsWith('https://')) throw new Error(`catbox metadata upload failed: ${r3.status} ${metaUrl.slice(0, 200)}`);
  return metaUrl;
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

const metadataUri = SEND ? await uploadMetadata('') : 'https://example.invalid/beacon-metadata.json';
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
const metaRes = await fetch(metadataUri);
const metaJson = await metaRes.json();
console.log('metadata reads back:', JSON.stringify(metaJson));
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
