# Proposal: White Lotus on eCash

**Build White Lotus as an Ergon-like ALP token on eCash first. Do not launch an L1 unless the token proves ritual demand and outgrows eCash rails.**

Live params: [STATUS.md](./STATUS.md) · [SPEC.md](./SPEC.md) · [ECONOMICS.md](./ECONOMICS.md) · [VISION.md](./VISION.md).

**Update (2026-08):** this note chose ALP on eCash and a mala remint. The launch split later recut **1/107 → 102/6** (live, tag `v26.8.0`).

## Decision

| Option | Role |
|--------|------|
| **A. White Lotus on eCash (ALP + PoW remint)** | **Primary — ship this** |
| **B. White Lotus L1 (eCash/Ergon-style fork)** | Contingency only — after product-market fit |

Ritual need (vàng mã–style memorial sacrifice + dana + rebirth) is satisfied by **issuance rules**, not by owning a blockchain. eCash already gives maintenance, Chronik, wallets, and Agora.

| Criterion | ALP on eCash | New L1 |
|-----------|--------------|--------|
| Work-elastic issuance | Remint frequency ∝ hashrate (+ Moore) | Subsidy ∝ difficulty (+ Moore) |
| Memorial burn + rebirth | `alpBurn` + perpetual batons | Native burn + subsidy |
| Ops | App + covenant + miner | Full node, miners, explorers forever |
| Users | XEC → desk/Agora → burn | Need exchange liquidity for a new coin |
| Time to product | Much shorter | Much longer |

Consider an L1 **only if** burn volume and cultural adoption are sustained, eCash fees/policy block the ritual, and you accept permanent chain ops.

## Phases

| Phase | Deliverable | Status |
|-------|-------------|--------|
| **0** | Spec + MooreTip temple covenant + clock | done |
| **1** | `dWLOTUS` dryrun + Offer UI + mint-api | **live** |
| **2** | Live `WLOTUS` genesis + prod deploy | **live** (102/6, `v26.8.0`) |
| **3** | Agora / desk liquidity + public burn explorer | open |
| **4** | `GLOTUS` genesis | open |
| **5** | Revisit L1 only with evidence | later |

## Non-goals (v1)

USD stablecoin · fixed max supply · Lotus-style `log(D)` subsidy · Ergon’s obsolete Moore factor `99826/100000` · Mist-style 1-mint-per-host-block CLTV · launching an L1 to “build community faster” · multi-tier product ladder (retired).

**One line:** White Lotus = ALP on eCash, parallel PoW remint batons, mala mint **108 → 102+6**, Moore calendar bits, burn as memorial + dana. GLOTUS is the economic companion. L1 only after the ritual works.
