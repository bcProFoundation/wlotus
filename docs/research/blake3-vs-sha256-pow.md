# Research: BLAKE3 / EarthBucks PoW vs SHA-256 for WLotus

**Status:** evaluation (2026-07-21)  
**Question:** Is BLAKE3 (and EarthBucks-style WebGPU mining) a good fit for WLotus token PoW?  
**Related:** [ECONOMICS_WLOTUS_GLOTUS.md](../ECONOMICS_WLOTUS_GLOTUS.md), [ECONOMICS_PRAYER.md](../ECONOMICS_PRAYER.md), [CLOCK.md](../CLOCK.md)  
**Refs:** [earthbucks/blake3](https://github.com/earthbucks/blake3), [earthbucks/earthbucks](https://github.com/earthbucks/earthbucks), EarthBucks Pow5 posts

---

## Verdict (short)

| Use | Fit? |
|-----|------|
| **On-chain eCash temple covenant** (current WLotus design) | **No** — eCash Script has no `OP_BLAKE3`; redeem budget is **≤201 ops**. Inlined BLAKE3 is ~7–10k ops. |
| **Soft / desk-verified presence work** (API checks, not Script) | **Possible**, but changes trust model and breaks covenant-enforced PoW. |
| **“ASIC resistant forever” via BLAKE3 alone** | **No** — BLAKE3 is *easy* to parallelize; Alephium already has a BLAKE3 ASIC market forming. |
| **Faster phone/WebGPU hashing than SHA-256d** | **Yes** for client throughput — but that can *hurt* ritual “minutes of presence” unless bits are retargeted. |

**Recommendation:** keep **SHA-256d** for covenant-enforced WLotus (and any Golden Lotus that shares the eCash Script stack). Treat EarthBucks/Pow5 as inspiration for a *different* product lane (browser GPU games / soft challenges), not a drop-in replacement for the remint redeem.

---

## What WLotus does today

Production remints verify PoW **inside the Spedn redeem**:

```text
solhash = hash256( sha256(preimage) ‖ nonce )
leading zero bytes of solhash == bits/8
```

- Client mines in a **Web Worker** with `ecash-lib` **WASM SHA-256d**.
- Mint-api does **not** mine; it verifies the nonce against the same predicate the covenant will check.
- Whole-byte bits only (`bits % 8 == 0`) so redeem + hard next-P2SH fit eCash’s **201 non-push op** limit.

Changing the hash function ⇒ **new covenant ⇒ new token / new genesis**. Live `dWLOTUS` is already locked to SHA-256d.

---

## What EarthBucks actually does

Important: EarthBucks is **its own L1**, not an eCash ALP covenant.

| Piece | EarthBucks | WLotus (current) |
|-------|------------|------------------|
| Chain | Custom (EBX) | eCash (XEC) + ALP token |
| PoW role | **Consensus** (next block) | **Issuance gate** inside P2SH remint |
| Hash / algo | **Pow5** = BLAKE3 **+** small matrix multiplies (iterated over time) | **SHA-256d** only |
| Where mined | Browser **WebGPU** (Chrome-first; mobile GPU when available) | Browser **CPU WASM** |
| Where verified | **Server CPU** (mine operator) — not Bitcoin Script | **On-chain Script** (`OP_HASH256`) |
| ASIC story | Soft: **change the algo** when ASICs appear | None by design; Flower tier *expects* SHA-256 ASICs |

Their [`earthbucks/blake3`](https://github.com/earthbucks/blake3) package (native + WASM) is the hash primitive. The mining edge is **Pow5 + WebGPU + algo churn**, not “BLAKE3 magic ASIC resistance.”

From their own writing (Pow5 / overview):

- BLAKE3 was chosen so **commodity GPUs** can hash profitably at launch (no SHA-256 ASIC farm required for *their* consensus).
- Earlier Algo1627 needed **GPU to verify** → expensive ops; Pow5 deliberately **mines on GPU, verifies on CPU**.
- They plan to **iterate** the algo so ASICs go stale — governance/ops cost, not a cryptographic guarantee.

---

## Algorithm comparison (for our purpose)

Purpose reminder: WLotus PoW is a **presence / intention tax** (phone minutes while remembering someone), not an energy MoE. Burn is the scalable memorial path.

| Algorithm | On-chain eCash verify | Phone / web mine | ASIC posture (2026) | Notes for WLotus |
|-----------|----------------------|------------------|---------------------|------------------|
| **SHA-256d** (current) | Native (`OP_HASH256`) | WASM CPU; fine for ~minutes | Mature BTC/XEC ASICs | Fits covenant; Flower tier can share algo family |
| **BLAKE3 only** | No opcode; ~7–10k ops if inlined | Fast WASM / WebGPU | **Not resistant** — ALPH ASICs exist / emerging | Faster client ≠ better ritual; Script fit fails |
| **Pow5-like (BLAKE3 + matrix)** | Impossible in 201-op redeem | Needs WebGPU (Chrome/Android OK; iOS Safari weak historically) | Soft via algo updates | EarthBucks model; **desk must verify** or own L1 |
| **Scrypt** | No native opcode | Memory-bound; harsh on phones | ASICs exist (LTC) | Poor mobile UX |
| **Ethash / KawPow** | No | GPU + VRAM | GPU-centric; ASICs for some | Overkill; WebGPU port heavy |
| **RandomX** | No | CPU-friendly in theory | Stronger ASIC resistance | Battery/heat; no Script opcode |
| **Argon2 / memory-hard** | No | Slow by design | Harder ASICs | Clashes with “few minutes on phone” product copy |

### SHA-256d vs BLAKE3 (hash alone)

| | SHA-256d | BLAKE3 |
|--|----------|--------|
| Design goal | Conservative, ubiquitous | **Max throughput** (tree, SIMD, parallel) |
| vs SHA-256 on modern CPU | Slower without SHA-NI; with SHA-NI often competitive | Usually faster on large inputs / many cores |
| GPU friendliness | Good but ASIC-dominated economically | Excellent parallel hash; **also** ASIC-friendly long-term |
| Script on eCash | One opcode | Must emulate compression (~thousands of ops) |
| Similarity claim | — | Cryptographically different family; **not** “SHA-256 equivalent for Script” |

**Takeaway:** BLAKE3 is a great *library* hash. It is a poor *covenant* hash on eCash. It is also a weak *permanent* ASIC-resistance story.

---

## Fit to WLotus product goals

### 1. Dedication / “search time” on phones

Current copy targets ~1–10+ minutes of device work. SHA-256d WASM already does that at ~24-bit dryrun.

Switching to BLAKE3 or WebGPU **raises hashrate** → same bits finish **faster** unless difficulty rises. Faster finish can **undermine** presence/memorial UX unless bits are raised carefully (and whole-byte jumps are coarse: +8 bits = 256× harder).

GPU mining also skews toward:

- Chrome / WebGPU-capable devices  
- Flagship phones with usable GPU APIs  
- Desktop GPUs if the endpoint is open  

That fights “ordinary phone prayer” more than it helps — unless Sybil resistance is the priority over ritual time.

### 2. ASIC resistance “for now”

EarthBucks’ “for now” resistance comes from:

1. Non-SHA algo at launch  
2. **Extra GPU work** (matrix), not hash alone  
3. Willingness to **hard-fork the PoW**  

WLotus on eCash **cannot** casually hard-fork the remint predicate without a new token. Covenant PoW must stay Script-cheap forever for that genesis.

If ASICs mint WLotus too fast: product already treats that as acceptable for some tiers (see Candle/Flower notes); memorial scale is **burn**, not exclusive phone hashrate.

### 3. Temple economics (1 + 99)

Covenant must still check PoW **and** output shape under 201 ops. Any BLAKE3/Pow5 path that moves verification to mint-api makes the **desk** the PoW oracle — opposite of trust-minimized remint.

---

## Architecture options if we still want “EarthBucks-like” mining

| Option | On-chain | Client | Trust | Comment |
|--------|----------|--------|-------|---------|
| **A. Status quo** | SHA-256d | WASM Worker | Minimal | Keep for WLotus / GLotus on eCash |
| **B. Soft Pow5 challenge** | SHA-256d (or none) + optional memo | WebGPU Pow5-like | Desk verifies GPU work | Extra anti-bot layer; **not** covenant security |
| **C. Dual token** | WLotus SHA-256d; separate “play” token soft-GPU | Mixed | Split | Only if product wants browser-GPU game loop |
| **D. New L1 / side system** | N/A | Full Pow5 | Own consensus | EarthBucks clone — out of scope for eCash temple |

**Do not** attempt option “inline BLAKE3 in redeem” — exceeds op budget by ~50× and blows size limits.

---

## Practical checklist

- [x] BLAKE3 libraries exist (EarthBucks WASM/native; official BLAKE3) — **client-ready**  
- [x] EarthBucks shows WebGPU mining works in production browsers — **proven elsewhere**  
- [ ] eCash Script verifies BLAKE3 in ≤201 ops — **impossible today**  
- [ ] BLAKE3 alone = lasting ASIC resistance — **false**  
- [ ] Drop-in replace SHA-256d in live covenant — **no** (genesis immutable)

---

## Conclusion

EarthBucks’ stack is **excellent research** for browser GPU PoW on a *custom chain with server/CPU verification and algo upgrades*. For **WLotus on eCash**, the binding constraint is **on-chain SHA-256 family opcodes + 201-op redeem**, not client hashrate.

- **Keep SHA-256d** for temple remint and any economic Golden Lotus that must verify in Script.  
- **Optionally** study a *soft* WebGPU/BLAKE3 challenge as anti-spam / engagement — never as the sole mint authority.  
- Treat “ASIC resistant for now” as an **ops policy** (bits, rate limits, burn path), not a property of BLAKE3 itself.
