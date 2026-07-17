# Evaluation: ALP for intentional token burn on eCash (temple / White Lotus)

**Verdict: Yes — ALP is suitable and currently the right token layer for a burn-as-respect product on eCash.** Prefer ALP over legacy SLP. Do not plan on CashTokens (those are BCH-native; eCash would need a hard fork). TBP (Token Burn *Protection*) is a different problem and is largely unnecessary on eCash.

**Supply policy correction:** A **fixed supply is a poor fit** for Eastern memorial / rebirth symbolism. When every token is burned, offerings cannot continue. Prefer a **perpetual mint baton** so tokens can be **reborn** as new offerings are made. Track **cumulative burned** (merit) separately from **circulating** supply.

---

## 1. Correction: CashTokens vs ALP on eCash

| Protocol | Chain | Role |
|----------|-------|------|
| **CashTokens** | Bitcoin Cash (BCH) | Consensus-native tokens; **not** available on eCash without a hard fork |
| **SLP / eToken** | eCash (legacy) | OP_RETURN meta-protocol; Chronik-indexed |
| **ALP (Augmented Ledger Protocol)** | eCash | SLP successor (`SLP2` LokadID over **eMPP**); Chronik-indexed; intentional **BURN** supported in `ecash-lib` |

Earlier guidance that recommended CashTokens for eCash was wrong. For eCash apps, **ALP is the modern token path**.

Official ALP spec: [bitcoin-abc `doc/standards/alp.md`](https://github.com/Bitcoin-ABC/bitcoin-abc/blob/master/doc/standards/alp.md) (also published on ecashbuilders Notion).

---

## 2. What the linked TBP page is (and is not)

[Token burn protection (TBP)](https://ecashbuilders.notion.site/Token-burn-protection-TBP-protocol-14e9edc6e92f80abbb36ec1ca70adfe9) is about **accidental** burns: non-token wallets spending SLP/ALP UTXOs as plain sats and destroying tokens.

The same page states:

> This spec is only intended to be deployed on blockchains where non-token wallets are common. **eCash (XEC) wallets are already very aware of tokens, so this spec is not needed there.**

So for a temple on eCash:

- **TBP ≠ intentional offering burn**
- You do **not** need TBP to ship incense/flower burns
- You **do** need intentional burn encoding + indexing (ALP + Chronik + wallet UX)

---

## 3. Does ALP support intentional burns?

**Yes.**

1. **Protocol design:** ALP SEND verifies `∑ inputs ≥ ∑ outputs`. Destroying the difference is a burn (same family as SLP). ALP also defines an explicit **BURN** section type (envisioned in the spec; implemented in tooling).
2. **`ecash-lib`:** `alpBurn(tokenId, tokenType, burnAtoms)` builds intentional burn pushdata.
3. **`ecash-wallet` / Cashtab path:** ALP standard tokens support GENESIS / MINT / SEND / **BURN**. ALP can burn an exact amount and keep change in one flow; SLP often needs chained txs for exact intentional burns.
4. **Chronik:** Default token index covers **SLP and ALP**, with safety checks so XEC-only apps do not accidentally spend token UTXOs.

For a memorial offering, a burn tx can also carry **extra eMPP pushdata** (temple id, person id, offering type) beside the ALP BURN/SEND section — something SLP’s single-OP_RETURN monopoly made awkward.

---

## 4. Fit for “online temple / White Lotus” burns

| Requirement | ALP fit |
|-------------|---------|
| Intentional, attributable destruction of value | Strong — explicit burn + Chronik history |
| Branded offering token (e.g. White Lotus) | Strong — GENESIS with ticker/name/url/data |
| Regenerative / rebirth supply (never “runs out”) | Strong — keep mint baton(s) alive; ALP allows multiple batons |
| Metadata: who / which temple / flower vs incense | Strong — eMPP multi-section + app OP_RETURN |
| Wallet / indexer support on eCash | Strong — Chronik + Cashtab/`ecash-lib` stack |
| Consensus enforcement like CashTokens | **No** — still indexer rules; trust Chronik + wallet discipline |
| Accidental burn by random XEC wallet | Low risk on eCash (token-aware ecosystem); still educate users |

**Recommended token policy for offerings (rebirth / regenerative)**

Do **not** close the mint baton. ALP was explicitly improved over SLP to allow **multiple mint batons** and ongoing `MINT` while a baton input is present ([ALP spec](https://ecashbuilders.notion.site/ALP-a862a4130877448387373b9e6a93dd97)).

Preferred cycle:

```
devotee pays XEC (or holds tokens)
        ↓
   ALP MINT (rebirth) — baton stays alive
        ↓
   ALP BURN as offering + memorial metadata
        ↓
 cumulative burned ↑   circulating can stay small
```

Practical variants (pick one trust model):

| Model | How rebirth works | Trust | Spiritual fit |
|-------|-------------------|-------|----------------|
| **A. Mint-at-offering (recommended v1)** | App/temple holds baton; each offering mints then burns (or mints to user who burns) | Temple/app key | Simple “reborn when remembered” |
| **B. Multi-temple batons** | ALP multi-baton: one baton per temple/region | Each temple | Federated White Lotus network |
| **C. Permissionless PoW remint** | Mist/eminer-style covenant on the baton; anyone remints by work | Rules in script | Strongest “no earthly owner”; harder to build — see §8 |
| **D. Burn-coupled remint** | Policy remints in proportion to recent burns / demand | Policy + baton custody or covenant | Closest to Lotus founder economics |

Product metrics to show in the temple UI:

- **Cumulative offerings burned** (never shrinks) — the spiritual ledger  
- **Circulating tokens** (can be near zero) — not the point of the ritual  
- **Alive mint baton(s)** — proof the flower can bloom again  

**Alternative (even simpler):** burn **native XEC** with OP_RETURN memorial tags (closest to current Lotus Temple XPI burns). Use ALP when you want a **named sacred token** with an explicit rebirth (mint) story.

---

## 5. ALP vs other burn options on eCash

| Approach | Pros | Cons |
|----------|------|------|
| **ALP intentional burn** | Branded token; exact burn; eMPP metadata; maintained stack | Meta-protocol; need Chronik; mint policy discipline |
| **Legacy SLP burn** | Older ecosystem familiarity | Worse endian/overflow/ghost-output footguns; weaker multi-protocol; exact burns harder |
| **Burn XEC only** | Simplest UX; max liquidity; no token mint politics | No separate “White Lotus” unit; offering is just cash |
| **CashTokens** | Consensus-native | **Not on eCash** without hard fork |
| **New L1 (White Lotus chain)** | Full monetary control | Ops burden; liquidity cold start |

---

## 6. Risks / implementation notes

1. **Indexer dependency:** Invalid ALP sections are discarded by indexers; consensus still moves the sats. Always build with Chronik validation before broadcast.
2. **Mint baton custody:** An open baton is *required* for rebirth, but whoever holds it can inflate supply. Mitigations: mint-only-at-offering (no free airdrops), rate limits, multi-sig/temple federation, or later a PoW/covenant baton (model C).
3. **OP_RETURN size:** Practical ALP output count is capped (~29 under current policy); fine for burns (usually 0–1 token change outputs).
4. **UX:** Cashtab users can hold/burn ALP; in-app temple wallet should use `ecash-lib` / `ecash-wallet` rather than hand-rolled SLP.
5. **Do not confuse TBP with product burns:** TBP is accidental-burn *prevention* for non-token chains; your product needs intentional burn *expression*.

---

## 7. Bottom line

**ALP is suitable — and is the best current eCash token protocol — for building intentional token burns for a White Lotus / online temple.**

Ship path:

1. Genesis an ALP token **with mint baton(s) kept alive** (rebirth enabled).  
2. Offering flow = intentional `BURN` (+ memorial metadata); supply reborn via mint-at-offering **or** PoW remint (§8).  
3. Index with Chronik; show **cumulative burned** as the temple’s eternal record.  
4. Skip TBP, CashTokens, fixed-supply, and a new L1 unless requirements change.

---

## 8. Feasibility: permissionless PoW remint covenant (model C)

**Verdict: Feasible.** The pattern is already proven (Mist/eminer on BCH SLP). On eCash it is **somewhat easier** (native introspection, Chronik, `ecash-lib`, Agora already speaks ALP) but still a **non-trivial covenant + miner project**, not a config tweak.

### 8.1 How it would work

```
GENESIS (open mint baton)
    → send baton UTXO to PoW covenant P2SH
         ↓
anyone finds nonce: hash(preimage‖nonce) meets difficulty
         ↓
covenant allows spend only if outputs are exactly:
  [0] eMPP OP_RETURN with ALP MINT (fixed/rules-based amount)
  [1] minted tokens → miner (or temple pool)
  [2] baton → next covenant address (state+1, baton never dies)
         ↓
devotees acquire tokens (miner sale / Agora / temple) → BURN as offering
```

Spiritual reading: **work recreates the flower; burn offers it; the baton is the eternal root.**

### 8.2 Why this is realistic on eCash

| Ingredient | Status |
|------------|--------|
| PoW mint baton covenant | Proven: Mist `slp-miner-reward-v1.spedn` + eminer |
| Enforce tx shape in Script | Proven on BCH; eCash has **native introspection** (cleaner than Mist’s preimage parsing) |
| ALP MINT encoding | Spec + `alpMint()` in `ecash-lib` |
| Indexer | Chronik indexes ALP mint batons / burns |
| ALP + covenant precedent | `ecash-agora` already builds ALP-aware covenant scripts |
| Miner port | Rewrite eminer off BCHD/SLP onto Chronik + `ecash-lib` (moderate effort) |

ALP’s **multiple mint batons** also help: e.g. one PoW baton (permissionless rebirth) + one temple baton (bootstrap / emergency) without a hard fork.

### 8.3 Issuance tiers (prefer frequency elasticity over `mint ∝ D`)

Ergon needs `coins/block ∝ D` because its DAA keeps **blocks/time** ~constant. An ALP remint can keep **coins/remint** fixed and let **remints/time ∝ hashrate** instead — same coins/time elasticity, simpler covenant.

| Tier | Design | Feasibility |
|------|--------|-------------|
| **Canonical** | Fixed `D`, base `M₀`, Moore `δ=99918/100000` on wall-time, **`N≥2` parallel PoW batons**, no 1-mint/host-block CLTV | **High** — simpler than Mist+full Ergon `mint∝D` |
| **Optional** | Temple bootstrap baton (retire later) | Easy |
| **Usually skip** | Token DAA + `mint ∝ work(D)` | Only if remint-rate design proves insufficient |

**Moore constant:** use Ergon’s **post-fix** daily factor [`99918/100000`](https://github.com/Ergon-moe/Bitcoin-Static/blob/2e8d5f7635c899cc99e71f06dedbe72b3ff7f07b/src/validation.cpp#L978) (~2.3y half-life). Do **not** use pre-fix `99826/100000` (~1.1y).

Do **not** copy Mist’s CLTV sync if you want Ergon-like flow: that freezes remints/time ≈ host blocks/time and kills hashrate→issuance elasticity.

### 8.4 Product flow (PoW ↔ burn)

Permissionless mint does **not** mint straight into a devotee’s incense burn. Typical loop:

1. Miner wins remint → receives fresh tokens  
2. Liquidity: sell on **Agora** / P2P / temple desk for XEC  
3. Devotee burns tokens (or temple burns on their behalf with metadata)

So the temple app still needs: burn UX, Chronik watchers, and a path to acquire tokens. PoW only replaces **who is allowed to create** supply.

### 8.5 Main risks

1. **Baton race:** First valid spend wins (same as Mist); wasted work for losers. Multi-baton mitigates serialization.  
2. **Script / ALP byte exactness:** Covenant must match Chronik’s ALP parse exactly or minted tokens look invalid to wallets.  
3. **Unaudited Script:** Mist warned its contracts were unaudited; treat White Lotus covenant as security-critical.  
4. **Fee + hashrate cold start:** Early miners need XEC for fees; low token demand → low hashrate → slow rebirth (acceptable if temple also keeps a secondary baton).  
5. **Economic griefing:** If mint reward ≫ burn demand, circulating dump; tune `D` and `M` (not host-block CLTV pacing).  
6. **Moore clock:** decay on eCash time/height, not token mint height.  
7. **Not L1 consensus:** Rules live in the covenant + indexer, not eCash consensus (acceptable and normal for ALP).

### 8.6 Build estimate (engineering shape, not calendar)

Must build:

1. CashScript / hand-asm covenant: PoW + ALP MINT eMPP template + baton recursion  
2. Genesis + baton handoff tool  
3. Chronik-based miner (eminer spiritual successor)  
4. Temple burn + cumulative-burn indexer  
5. Acquisition path (Agora listing or in-app swap)

Can defer: `mint ∝ D` DAA, multi-token, mobile miner GPU stack.

### 8.7 Recommendation

| Question | Answer |
|----------|--------|
| Is permissionless PoW remint feasible on eCash ALP? | **Yes** |
| Closest prior art | Mist/eminer + eCash Agora/ALP tooling |
| Right covenant economics | Fixed `D` + `M(t)=M₀·(99918/100000)^k` + **`N≥2` parallel batons** + no Mist 1/block CLTV (**not** required `mint ∝ D`) |
| Ship temple before PoW? | **Yes** — mint-at-offering (model A) validates burn UX; swap baton into PoW covenant later |
| Better than forking a White Lotus L1? | **Yes** — same rebirth idea, far less ops |

### 8.8 Ritual economics: vàng mã and why Ergon-like remint fits

Vietnamese **vàng mã** (votive paper) is a useful model: people spend real wealth on symbolic offerings and burn them so the act is irreversible. The point is **sacrifice**, not accumulating a scarce collectible.

| Burn design | What happens to “wealth” | Ritual reading |
|-------------|--------------------------|----------------|
| Fixed-supply token burn | Remaining **holders** get richer (deflation) | Closer to destroying stock to pump bags |
| Custodial remint (temple baton) | Temple can recreate supply | Rebirth works, but an earthly mint owner remains |
| **Ergon-like / PoW remint** | Burn opens room for **new work** to remint; unit tends toward energy/effort cost | Sacrifice dissipates embodied effort; flower can bloom again through labor |

**Why this is desirable for a communal ritual**

1. **Purer sacrifice:** Elastic remint dampens the “I burn so my bags moon” loop. Non-burning holders are not the main beneficiaries.  
2. **Rebirth without a priest-minter:** Permissionless PoW is the on-chain analogue of “the offering can always return through effort.”  
3. **Shared ledger of merit:** Cumulative burns are a public commons (temple memory), even if circulating supply stays elastic.  
4. **Optional monetary commons:** In the Lotus-founder two-loop view, burns are a **demand sink** that helps stabilize the unit for *everyone who uses it*—holders and non-holders alike—without oracles.

**Careful with “energy is infinite ⇒ non-holders benefit”**

Energy is **not** infinite; if it were free, the sacrifice would be empty. The meaningful claim is closer to:

- Each burned token represents **effort already spent** (at mint).  
- Remint requires **new effort**, so the ritual cycle continually draws real work into the commons.  
- Non-holders benefit if the token is a **shared medium** (stable unit, public merit record, temple economy)—not merely because joules are unlimited.

### 8.9 Lotus `log(D)` vs `sqrt(D)` vs Ergon — and the “scarce community” temptation

Lotus today pays `R ≈ a·log(D)` (`lotusd` `GetBlockSubsidy`). That is **highly inelastic**: difficulty can rise a lot while issuance barely expands. So ritual burns behave like Bitcoin burns — **holders capture most of the scarcity**. Lotus Temple’s experience matches the math.

Elasticity of issuance to work (higher = burns refill faster, holders gain less):

```
log(D)  <  sqrt(D)  <  D¹ (Ergon linear)
 Lotus     Shammah     energy-proportional
           proposal
```

Shammah’s move toward **sublinear work-coupled** emission (e.g. √-like / `γ ∈ (0,1)` in the 2026 papers) is partly the same concern: make supply answer work and burn demand, not just enrich bags. It is **closer to Ergon than Lotus v1**, but still **less elastic than Ergon** (sublinear by design, for Lyapunov stability / manipulation resistance).

| Goal | Prefer |
|------|--------|
| Fast speculative community / NGU | Scarcer / `log`-like (Lotus-shaped) |
| Vàng mã sacrifice + rebirth + commons | **Ergon-like `mint ∝ work`** |
| Fork fairness (“energy can’t be counted twice”) | **Ergon-like** (strongest) |

**Opinion for White Lotus temple:** do **not** choose scarcity to “build community quicker.” That community is mostly holders; you already saw burns serve them more than the wider commons. Build community with **ritual UX, Vietnamese brand, multi-temple, cumulative merit** — and let issuance stay **Ergon-like** so sacrifice stays clean.

Bootstrap without fake scarcity: slightly higher early PoW mint that still requires work, Agora liquidity, temple-desk acquisition — not a hard cap.
