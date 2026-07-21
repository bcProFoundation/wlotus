# Prayer bootstrap economics (phone mine → server mint)

Design under evaluation for **starting with Prayer only** (`dPRAYER` dryrun).  
**Superseded as launch product path** by [ECONOMICS_WLOTUS_GLOTUS.md](./ECONOMICS_WLOTUS_GLOTUS.md) (WLotus 100/1+99 + Golden Lotus).  
This page remains the phone-fee / bits working sheet from the Prayer bootstrap.  
Canonical vision: [VISION.md](./VISION.md). Ladder overview: [ECONOMICS.md](./ECONOMICS.md).

## Proposed flow

```
Phone (user)                    Server                         Chain
─────────────                   ──────                         ─────
Mine PoW a few minutes    →     receive solution
                                pay ~5.46 XEC fee
                                remint baton (mint **2** atoms)
                                      ├─ 1 atom → burn (offering / memorial + dana)
                                      └─ 1 atom → inventory (sell later to non-miners)
```

- **Miner** gets the ritual: presence (PoW time) + burn in memorial / dana.  
- **Server** pays the eCash fee and keeps **1** Prayer as fee compensation / desk inventory.  
- Buyers who will not mine purchase inventory Prayer and burn themselves.

## Price inputs

| Input | Value |
|-------|--------|
| Remint / mint fee | **5.46 XEC** (eCash miners) |
| XEC spot (stated) | **$10 / 1M XEC** → `$1e-5` / XEC |
| XEC future (assumption) | **$50 / 1M XEC** → `$5e-5` / XEC |
| Phone hashrate (repo UX) | **~150 kH/s** SHA256d-class (`UX_PHONE_HASHRATE_H_S`) |
| Phone power (accounting) | **~2.5 W** while hashing (order-of-magnitude) |
| Residential elec. | **~$0.12 / kWh** |

### Fee in USD

| XEC price | Fee (5.46 XEC) |
|-----------|----------------|
| $10 / 1M | **~$0.000055** |
| $50 / 1M | **~$0.000273** |

## Difficulty: energy-match vs UX (“a few minutes”)

### A — Match phone **energy $** to future fee ($0.000273)

At ~2.5 W × 150 kH/s × $0.12/kWh → ~`$5.6e-13` / hash.

| Target | Result |
|--------|--------|
| Hashes ≈ fee / $/hash | ~`2^28.9` |
| Bits | **~29** |
| Wall time @ 150 kH/s | **~37 minutes** — longer than “a few minutes” |

ASIC-electricity match to the same fee (repo ASIC sheet) would be **~49 bits** — absurd for phones; ignore for Prayer.

### B — Target **wall-clock** “a few minutes” (recommended for Prayer)

| Phone time | E[hashes] @ 150 kH/s | Bits (approx) | Phone energy $ |
|------------|----------------------|---------------|----------------|
| 30 s | ~4.5e6 | **~22** | ~$0.0000025 |
| 1 min | ~9e6 | **~23** | ~$0.000005 |
| **2 min** | ~1.8e7 | **~24** | ~$0.00001 |
| 3 min | ~2.7e7 | **~25** | ~$0.000015 |
| 5 min | ~4.5e7 | **~25–26** | ~$0.000025 |

**Finding:** On a phone, **fee ≫ electricity**. You cannot peg Prayer “value” to phone energy without forcing ~30–40 min mines. Prayer PoW should be a **presence / intention tax** (minutes), not an energy MoE. Live dryrun **24 bits** ≈ **~2 min** on the repo phone model — already in band.

Whole-byte Script constraint (`bits % 8 == 0`) → prefer **24** (or **32** if you want harder UX).

## Inventory / 2-mint economics

Each successful remint:

| Output | Who | Economic role |
|--------|-----|----------------|
| +2 Prayer minted | — | Gross issuance |
| −1 burned | Offering | Memorial + dana (destroyed) |
| +1 to server | Desk | Cost basis **= 5.46 XEC** (fee paid once per remint) |

**Floor for secondary market (non-miner buyers):**

| XEC regime | Cost basis / inventory token |
|------------|------------------------------|
| $10 / 1M | ~**$0.000055** |
| $50 / 1M | ~**$0.000273** |

That is **dust in USD** — intentional for ritual Prayer. Markup can fund postage / ops; the product is not priced as MoE store-of-value (that’s Candle / Flower later).

Net supply per remint: **+1** circulating (inventory) after burn, not +2. Burn rate of offerings can later absorb inventory if desk sells into burns.

## Desk origin / on-chain provenance

ALP atoms of one `tokenId` are **amount-fungible**, but **UTXO history is still traceable**. A Prayer UTXO can be walked back through spends to the remint (or genesis) that created those atoms — explorers and indexers can do this.

**What actually breaks clean origin:** **merging** — when atoms from different mint lineages are combined into one UTXO, that output is a **mixed-origin** bag. You still know the *set* of ancestors, but you can no longer attribute “this one atom” to a single desk remint without extra accounting.

| Situation | Provenance |
|-----------|------------|
| Desk keep UTXO never merged with foreign Prayer | Easy: walk UTXO → remint tx → WLotus server mint |
| Buyer receives a **single-origin** desk UTXO (no merge) | Still easy to prove desk lineage |
| User merges desk Prayer with Prayer from elsewhere | Mixed-origin UTXO; pure “desk-only” claims fail |
| Vault requires desk origin | Accept UTXOs whose **entire** token ancestry is desk remints (or reject mixed) |

**Operational rule for a clean desk market:**

1. Server keep outputs stay in a **desk wallet** that does not merge with non-desk Prayer.  
2. Sales send **unmixed** desk UTXOs (or split from unmixed desk parents).  
3. Vault / “instant burn” credit: allow deposits only if ancestry is **100% desk-origin** (indexer walk); reject mixed UTXOs.  
4. Users may merge in their own wallets freely — those coins simply won’t qualify as pure desk inventory for vault top-up.

Farmers who never receive the keep atom (app path = burn only) never hold desk-origin stock unless they **buy** an unmixed desk UTXO.

**Resale:** buyers may resell same-origin desk coins for profit — allowed. That liquidity feeds vault top-up. Mixed-origin UTXOs may simply fail vault eligibility.

## Who pays what

| Party | Pays | Receives |
|-------|------|----------|
| Phone user | Time, battery, attention | Burned offering (memorial + dana) |
| Server | 5.46 XEC / remint (+ infra) | 1 Prayer inventory |
| eCash miners | — | 5.46 XEC fee |
| Non-mining buyer | XEC (or fiat) for inventory token | 1 Prayer to burn |

Fairness check: miner does **not** receive the retained token. That is coherent **if** UX sells “I offered / remembered,” not “I earned a coin.” Do not imply mining yields tradable Prayer unless you change the split.

## Evaluation (verdict)

### What works

1. **Fee as spam filter** — even at $50/M XEC, fee is still tiny USD but real XEC; stops free infinite mint spam.  
2. **Phone minutes as ritual** — 2–5 min @ ~24–26 bits matches “mine with your phone.”  
3. **2-mint / 1-burn / 1-desk** — clean accounting: fee payer (server) is compensated in inventory; offering is real destruction.  
4. **Vs vàng mã** — still holds: burned atom is not sold back; desk token is *new* inventory from remint, not recycling the offering.  
5. **Prayer-only start** — defers Candle/Flower economic peg until demand exists.

### Risks / design tensions

| Risk | Detail | Mitigation |
|------|--------|------------|
| **Trust** | Server submits remint; user trusts burn+inventory honesty | Publish txids; optional user-side verify burn outpoint; later permissionless remint |
| **Hashrate variance** | Real phones may be ≪ 150 kH/s (JS/WASM) | Measure on target devices; tune bits; show progress ETA |
| **Moore tip** | Bits rise over years → phone mine lengthens | Bootstrap base for “few minutes *now*”; communicate calendar; or separate easy Prayer covenant |
| **Desk dump** | Inventory sold cheap → undercuts “I mined for this” feeling | Soft peg near fee; limit sales; prefer burn-path UX |
| **Origin mixing** | Merging desk + non-desk Prayer into one UTXO blurs pure desk lineage | Keep desk UTXOs unmixed; vault accepts only single-origin desk ancestry |
| **Miner resentment** | User pays time, server keeps token | Copy: token retained = fee coverage; your gift is the burn |
| **Mint=2 vs dryrun mint=1** | Covenant / genesis params must change | New Prayer bootstrap deployment; don’t overload old dryrun economics silently |
| **Energy ≠ fee** | Matching energy to fee ⇒ ~29 bits (~37 min) | **Do not** use energy-match for Prayer; use UX bits |

### Recommended parameters (bootstrap)

| Param | Recommendation |
|-------|----------------|
| Product | Prayer only (`dPRAYER`) |
| Bits | **24** (whole-byte) |
| Mint atoms / remint | **2** (live dual-mint dryrun) |
| Split | **1 burn + 1 server inventory** |
| Fee | **~5.46 XEC** (server-paid via mint API) |
| Client | Mobile-first web / later native app — **no browser wallet yet** |
| Rate limit | **2 offers / day / installId** |
| Token USD peg | **None** — cost basis ≈ fee; ritual product |
| Secondary price | Soft floor ≈ 5.46 XEC; optional small desk markup |
| Candle / Flower | Offline until Prayer loop is proven |

Live dual-mint token: see `deployments/mainnet-dryrun-prayer.json`.

### One-line economic thesis

**Prayer is priced in attention (phone minutes) + a dust XEC fee; the retained atom reimburses the fee payer; the burned atom is the white-lotus offering (memorial + dana). It is not an energy-backed MoE — and should not be.**

### Launch alignment (wLotus mala)

Canonical anti-farm + presence write-up: [ECONOMICS_WLOTUS_GLOTUS.md](./ECONOMICS_WLOTUS_GLOTUS.md) § *Product intent*.

| Intent | Mechanism |
|--------|-----------|
| Anti-farm vs commercial remint | **1/107** temple split + XEC fees (sponsored Offer always wins on fee math even if energy ≈ 0) |
| Attention / ritual length | Soft timer `VITE_MIN_PRAY_MS` (default ~60s) **after remint**, before memorial burn; cancel skips burn |
| Not token security | PoW does not secure the ledger; **eCash** does. Bits ≈ **24** for participation, not 32 “to harden” WLOTUS |

Recompute fee tables anytime with `npm run pricing` (ladder still uses mint=1 Prayer UX bits today; update `pricing.ts` when mint=2 bootstrap is adopted).
