# Vision — WLotus as burnable white lotus

**One-line thesis:**  
WLotus is the burnable white lotus — offered **in memory of the dead**, and as **dana** to the living: real wealth sacrificed for the community, not paper sold.

Live test UI: https://test.wlotus.org

---

## Dual meaning of one burn

Burning WLotus is a single act with two gifts:

| Layer | Cultural frame | What the burn does |
|-------|----------------|--------------------|
| **White lotus (hoa sen trắng)** | In Vietnamese culture, white lotus is the flower given in memorial — purity, farewell, cầu siêu for the dead | Dedication **in memory of someone** |
| **Dana / bố thí (đàn na)** | Generosity without keeping — wealth released for others | Tokens are **destroyed**; circulating supply shrinks; **no seller receives the offering** |

```
Burn WLotus
   ├── Memorial  →  for the dead   (sen trắng)
   └── Dana      →  for everybody  (wealth given up, not transferred)
```

The product is neither “only a funeral app” nor “only a charity app.” It is both at once.

---

## Vs vàng mã (joss paper)

Traditional **vàng mã** shares the memorial intent: offerings for the departed. Commercially, most of the cash goes to **makers and sellers** of paper goods.

| | Vàng mã | Burn WLotus |
|--|---------|-------------|
| Intent | Memorial / ritual gift | Memorial + dana |
| What leaves the giver | Money → shop | Tokens → **destroyed on-chain** |
| Who captures value | Paper industry | **Nobody** — supply is gone |
| Rebirth of supply | N/A | PoW remint (permissionless work) |

**Brand claim:** same *spirit* as memorial offering culture; harder *economics* than paper ritual commerce. Burning WLotus is **sacrificing own wealth for the sake of the community**.

---

## Brand architecture

| Layer | Name | Role |
|-------|------|------|
| **App title (human)** | **White Lotus** | Primary display name — flower + memorial meaning |
| **Short / domain / tech** | **wLotus** / ticker **WLOTUS** | `wlotus.org`, tickers, repo, code |
| Logo | White lotus flower (B&W mark) | Icon only — botanical motif, not a temple mark |
| Visual theme | **Black & white** | Monochrome UI; white lotus on black |
| The act | **Offer / Burn** | One gesture, two gifts |
| Memorial | Dedication / memory | Why VN already understands sen trắng |
| Dana | Generosity language (later: category) | Why the burn is for *everyone* |
| Issuance | Dual mint (2 atoms) | 1 burn + 1 desk keep for vault top-up sales |
| Tiers (later) | Prayer first; Candle / Flower later | Scale of sacrifice |

**Launch economics (decision):** ship **wLotus** (mint 108 → 1 prayer + 107 temple mala) and **Golden Lotus** (permissionless, premine, event burns) — see [ECONOMICS_WLOTUS_GLOTUS.md](./ECONOMICS_WLOTUS_GLOTUS.md). Prayer dryruns remain the technical lineage.

**Anti-farm / presence:** **1/107 + XEC fees** beat commercial remint even when energy ≈ 0; official Offer adds a **soft pray timer** so attention stays the ritual tax. Token hashrate does not secure the ledger (eCash does) — § *Product intent* in that economics doc.

Resale of **same-origin** desk Prayer for profit is fine — liquidity for vault top-up, not a bug.

### App title options

| Title | Pros | Cons |
|-------|------|------|
| **White Lotus** (recommended) | Matches flower + VN memorial; clear | HBO show association in English SEO |
| **wLotus** | Domain-native; coined | Balanced casing; ticker stays **WLOTUS** |
| **White Lotus Offerings** | Clarifies the act | Longer |
| **Lotus Offer** | Secular, action-led | Weaker “white” memorial cue |
| **Sen Trắng** | Perfect VN | Weak globally |

**Recommendation:** ship as **wLotus** (UI short brand); ticker **WLOTUS**; optional long form *White Lotus*. Subtitle: *Offer · Remember · Give.*

### Messaging

**Hero (secular, true):**  
*Offer a white lotus. Remember someone. Give something up for all.*

**Deeper:**  
*Unlike vàng mã, nothing is sold back into the market — the burn is the gift.*

### Branding choices (do / don’t)

**Do**

- Claim the Vietnamese white-lotus memorial reading on purpose
- Widen it with dana: memorial *and* community sacrifice
- **wLotus** as app title; **WLOTUS** ticker; domain `wlotus.org`
- Black & white theme; white lotus flower as logo icon
- Dual-mint desk keep for later vault sales (unmixed origin preferred)
- Use dana / bố thí as meaning language, not a forced primary rename

**Don’t**

- Use **Temple**, **Pagoda**, or sectarian house-of-worship framing (religion conflict risk)
- Soften into spa / wellness vibe that erases death and dana
- Market only as “token burn for scarcity”
- Rename the primary brand to bare **Dana** early (SEA e-wallet / wallet collisions)
- Frame the product as the HBO series — ritual offering, not luxury satire

**IP note (non-legal):** a white lotus *flower* as a natural motif is ordinary symbolism; avoid copying third-party logos or “The White Lotus” show artwork. Distinct B&W mark + memorial/offering copy.

---

## Cycle (issuance ↔ offering)

```
PoW remint (effort) → WLotus exists in the world
        ↓
Devotee burns (memorial + dana) → wealth destroyed, merit public
        ↓
Flower can bloom again via permissionless remint
```

- **Cumulative burned** = spiritual / public ledger  
- **Circulating supply** = secondary to the offering story  
- **PoW** = rebirth through work, not discretionary mint authority  

Technical rails: [PROPOSAL.md](./PROPOSAL.md) · [ECONOMICS.md](./ECONOMICS.md) · [ARCHITECTURE.md](./ARCHITECTURE.md)

---

## Product surface

| Surface | Role today |
|---------|------------|
| `apps/web` | Offer / burn UI (Prayer dryrun; XEC fees) |
| Memorial metadata | EMPP / app-side dedication beside ALP `BURN` |
| Postage (later) | Sponsor fees so offering is not gated on holding XEC |

The website is the white lotus act for Vietnamese culture: give (burn) WLotus in memorial of the dead — and by burning one’s own wealth, give dana to everybody.
