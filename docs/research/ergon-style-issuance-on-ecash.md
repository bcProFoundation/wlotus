# Feasibility: Ergon-style (energy-pegged) issuance via eminer/Spedn on eCash

**Verdict:** A **true Ergon-style elastic, energy-cost-pegged currency on eCash is feasible as a redesigned mineable token**, but **not** by reusing Mist v1 as-is, and **not** as a USD-pegged stablecoin. Pegging mint volume to **eCash chain difficulty** from a covenant is **not possible** without oracles or a consensus hard fork. The closest workable path is an **ALP (or SLP) minting-baton covenant** whose **own** PoW difficulty drives mint amount (Ergon’s proportional-reward idea, applied to the token’s hashrate).

**Correction:** CashTokens are **BCH-native**, not available on eCash without a hard fork. On eCash use **ALP** (preferred) or legacy SLP/eToken. See also `docs/alp-token-burn-on-ecash.md` for intentional burn suitability.

---

## 1. What each piece actually is

| Name | Role in this evaluation |
|------|-------------------------|
| **eminer** (`mminer`) | Off-chain miner for Mist/Maze-style **PoW-minted SLP tokens** on BCH, governed by **Spedn** covenants |
| **Spedn / “SPDN”** | BCH Script DSL used to compile mint covenants (`spedn/slp-miner-reward-v*.spedn`). There is **no SPDN currency** in this repo |
| **Mist v1** | Fixed token PoW difficulty + scheduled reward reduction + CLTV sync (~1 mint per host block) |
| **Ergon (XRG)** | Separate PoW chain (`Bitcoin-Static`) where **native coinbase ∝ block difficulty**, with Moore/Koomey decay (~2.3y half-life). Marketed as **stable MoE pegged to mining energy cost**, not a fiat stablecoin |
| **eCash (XEC)** | Host chain; custom assets via **ALP** (preferred) or legacy SLP/eToken — **not** CashTokens (BCH-only). Script/covenants cannot read `nBits`/chain work |

Ergon’s design goal (from [prop-reward.pdf](https://ergon.moe/prop-reward.pdf)):

> Block reward shall be a linear function of the current block mining difficulty … peg the price to the expenses of miners … reflecting average cost of electricity … won’t be an investment.

That is **elastic base money**, not USDT/USDC-style collateralized or oracle-pegged stables.

---

## 2. Why Mist v1 cannot produce Ergon-like stability

Production contract (`spedn/slp-miner-reward-v1.spedn`):

1. **Fixed** leading-zero PoW difficulty  
2. **Predetermined** mint: `initialMintAmount / (floor(height/interval) + 1)`  
3. **CLTV** forces mint pacing ≈ host block rate  

Economic effect:

- Issuance schedule is **planned**, like Bitcoin/Mist scarcity toward ~21M  
- Extra hashrate only races for the **same** fixed reward; it does **not** mint more units  
- Unit value is **not** tethered to energy cost; demand shocks move price freely  

Ergon’s feedback loop requires the opposite:

```
price ↑ → mining profitable → hashrate ↑ → difficulty ↑ → coins/block ↑ → supply meets demand → price → cost
price ↓ → miners leave → difficulty ↓ → coins/block ↓ → scarcity supports price → cost
```

Mist breaks that loop at “hashrate ↑ → coins/block ↑”.

Experimental `v2` only retunes **token** difficulty from **baton satoshi value** (collateralized difficulty tiers). It still does not implement `mint ∝ difficulty` with a proper DAA.

---

## 3. Can a covenant read eCash difficulty?

**No.** Native introspection (BCH/eCash) exposes values, locking bytecode, token category/amount/commitment, locktime, etc. It does **not** expose parent header `nBits`, chain work, or network hashrate.

Therefore:

| Approach | Feasible without hard fork? |
|----------|-----------------------------|
| Mint amount = f(eCash `nBits`) inside a covenant | **No** (no on-chain signal) |
| Oracle feeds eCash difficulty into the covenant | Technically yes; **destroys** Ergon’s “no oracle” property |
| Hard-fork eCash `GetBlockSubsidy` like Ergon/Lotus | Consensus change; not a token project |
| Mint amount = f(**token’s own** PoW difficulty + DAA) | **Yes** — best token-layer analogue |

Lotus (`lotusd`) already experiments with **difficulty-based native subsidy** (`enableDifficultyBasedSubsidy`, logarithmic in difficulty). That is related economically but is a **different chain’s base coin**, not an eCash token, and not Ergon’s linear proportional reward.

---

## 4. Workable design: Ergon-like mineable ALP token on eCash

### 4.1 Core rules (token-layer analogue)

Treat the minting baton covenant as a mini-Ergon:

1. **Own PoW** on each mint (hash of preimage ‖ nonce meets current difficulty `D`)  
2. **DAA** on `D` targeting a wall-clock mint rate (e.g. N successful mints per day), using timestamps / host locktime carefully  
3. **Proportional mint:** `mintAmount = floor(c(t) * work(D))`  
4. **Moore decay on `c(t)`** (daily multiplicative factor ≈ Ergon’s `99918/100000` for ~2.3y half-life), stored or derived from mint height  
5. **Singleton mint baton** (ALP mint baton; close/burn when fixed supply is desired)

Then, with DAA holding mint *rate* roughly constant:

- Higher token hashrate → higher `D` → **more coins per mint** → coins/time ∝ hashrate  
- Work per coin stays roughly constant after Moore correction  
- Price is pulled toward **marginal energy cost of token PoW** (plus eCash fees)

That matches Ergon’s *mechanism*, with the important caveat that security of the **ledger** is still XEC miners’ PoW; token miners only pay for **issuance rights**.

### 4.2 Why ALP > legacy SLP on eCash

| | Legacy SLP / eToken | ALP on eCash |
|--|---------------------|--------------|
| Encoding | Big-endian, single OP_RETURN | Little-endian, **eMPP** multi-section |
| Intentional burn | Possible; exact burns often awkward | First-class `alpBurn` in `ecash-lib` |
| Indexing | Chronik | Chronik (default token index) |
| CashTokens | N/A on eCash | N/A on eCash (BCH-only) |

Recommend **ALP + Chronik + ecash-lib** on eCash. Use eminer only as a **reference** for PoW-mint UX if pursuing Ergon-like issuance—not as a drop-in deploy. For temple burns, see `docs/alp-token-burn-on-ecash.md`.

### 4.3 Critical design choices vs Mist

| Mist v1 | Needed for Ergon-like token |
|---------|-----------------------------|
| Fixed difficulty | Adjustable `D` in NFT commitment / redeem state |
| Reward from height schedule only | `mint ∝ D` (+ Moore factor) |
| CLTV ≈ 1 mint / host block | **Do not** hard-cap mint rate independent of hashrate; use DAA instead (CLTV may still bound abuse) |
| Race wastes excess work with no issuance effect | Excess work raises future `D` / issuance |

Without removing the “fixed reward per host block” pattern, the energy peg **cannot** form.

### 4.4 What this is *not*

- **Not a USD stablecoin.** Equilibrium is ~energy (and hardware) cost per unit, which moves with electricity markets and ASIC efficiency estimation error.  
- **Not soft-pegged to XEC.** XEC remains scarce/deflationary base; the token is a second asset.  
- **Not “stable” in the CeFi sense.** Expect oscillations; Ergon’s paper relies on speculative damping and miner mobility across SHA-256d coins. A low-liquidity token will be noisier than Ergon mainnet.  
- **Not secured by token hashrate.** Double-spend safety is still eCash consensus; token PoW only governs mint fairness.

---

## 5. Alternative paths (ranked)

### A. Token-layer Ergon analogue (recommended research path)

- **Scope:** New ALP token + minting covenant + miner (Chronik / `ecash-lib`)  
- **Pros:** No eCash hard fork; permissionless; closest to “stablecoin possible” in Ergon’s meaning  
- **Cons:** Bootstrap hashrate/liquidity; DAA and Moore params are hard; SLP eminer not reusable as-is  
- **Invasiveness:** New contracts + miner; optional Lixi/Local-eCash listing later  

### B. Oracle-linked mint to eCash difficulty

- **Pros:** Couples issuance to host-chain work  
- **Cons:** Trusted/federated oracle; fails Ergon’s no-oracle thesis; attack surface  

### C. eCash consensus change (native proportional subsidy)

- **Pros:** Cleanest Ergon clone for base money  
- **Cons:** Social/consensus cost; changes XEC economics for everyone; out of scope for eminer  

### D. Keep Mist schedule, call it “stable”

- **Pros:** Already built  
- **Cons:** Economically false; fixed emission ≠ energy peg  

### E. Fiat-backed or overcollateralized USD stable on eCash

- Separate product (custody, legal, oracles, liquidations), likely ALP or custodial. eminer/Ergon issuance theory does not deliver this.

---

## 6. Risks and open problems

1. **DAA design** under baton races, selfish minting, and timestamp manipulation  
2. **Moore parameter error** → long-run inflation or deflation vs energy (Ergon’s own caveat)  
3. **Fee drag:** every mint pays XEC fees; at low token price, issuance stalls even when “should” expand  
4. **Hash algorithm:** token PoW is typically sha256d of preimage+nonce (CPU/GPU), while Ergon assumes ASIC SHA-256d mobility vs Bitcoin—elastic response `α` may be weaker  
5. **Early unfairness:** fixed early `D` can still over-mint before DAA warms up; need genesis difficulty and maybe dampened early `c(t)`  
6. **Regulatory / naming:** “stablecoin” implies fiat peg to many users; prefer “energy-elastic cash” / “Ergon-style token” in product language  
7. **SLP on eCash** is legacy; building on SLP today is a dead-end for new issuance  

---

## 7. Suggested next steps (if pursuing)

1. Specify covenant rules: state layout (height, `D`, last-mtime), mint formula, DAA, Moore factor, baton conservation  
2. Prototype ALP mint baton + PoW covenant on chipnet; property-test mint amounts vs `D`  
3. Minimal miner: solve PoW, submit mint, track baton UTXO via Chronik  
4. Parameter study: target mint interval, `c(0)`, decay τ, min/max `D`  
5. Explicitly **non-goals** for v1: USD peg, XEC peg, cross-chain bridges  

---

## 8. Bottom line

| Question | Answer |
|----------|--------|
| Can eminer/Spedn launch an Ergon-**like** currency on eCash? | **Yes, with a new covenant design** (proportional mint to **token** difficulty + DAA + Moore decay), preferably as **ALP** |
| Can Mist v1 parameters alone do it? | **No** — fixed difficulty + scheduled emission is anti-Ergon |
| Can mint track **eCash** difficulty trustlessly? | **No** from script alone |
| Does that yield a **USD stablecoin**? | **No** — at best an **energy-cost-elastic** unit of account |
| Is a fiat stablecoin “possible” on eCash? | Yes via **other** designs (reserves/collateral/oracles), unrelated to Ergon/eminer |

**Most honest framing:** use eminer as prior art for **decentralized PoW mint batons**, then implement Ergon’s proportional-reward economics as an **ALP** token on eCash so a **stable (energy-pegged) medium of exchange** can be attempted—not a dollar stablecoin, and not a config tweak of Mist.
