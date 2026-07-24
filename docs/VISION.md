# Vision — WLotus as burnable white lotus

**One-line thesis:**  
WLotus is the burnable white lotus — offered **in memory of the dead**, and as **dana** to the living: real wealth sacrificed for the community, not paper sold.

| Site | URL |
|------|-----|
| Test | https://test.wlotus.org (`dWLOTUS`) |
| Prod | https://wlotus.org (`WLOTUS`) |

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
| **App title (human)** | **White Lotus** / **wLotus** | Primary display name — flower + memorial meaning |
| **Ticker / domain** | **WLOTUS** · `wlotus.org` | Tech identity |
| **Economic companion** | **Golden Lotus** / ticker **GLOTUS** | Event burns & later commerce |
| **Family (later)** | **LotusHeart** | Family-oriented; may use off-chain data — not WLotus |
| Logo | White lotus flower (B&W mark) | Botanical motif |
| Visual theme | **Black & white** | Monochrome UI |
| The act | **Offer / Burn** | One gesture, two gifts |
| Issuance | Mint **108** → **1** miner + **107** temple | One mala per remint |

**Launch economics:** ship **wLotus** first; **GLOTUS** when the economic layer is ready — [ECONOMICS_WLOTUS_GLOTUS.md](./ECONOMICS_WLOTUS_GLOTUS.md).

**Data policy:** WLotus memorial / altar content is **on-chain only** (star-linked DANA burns). Indexes mirror the chain; they are not a second truth. Off-chain stores are for **LotusHeart**, not WLotus — see [ALTAR.md](./ALTAR.md).

**Anti-farm / presence:** **1/107 + XEC fees** beat commercial remint even when energy ≈ 0; official Offer adds a **soft pray timer** so attention stays the ritual tax. Token hashrate does not secure the ledger (eCash does).

Desk inventory (107/108) may be sold or gifted for vault top-up / non-miners — liquidity for offerings, not a bug.

### App title options

| Title | Pros | Cons |
|-------|------|------|
| **White Lotus** | Matches flower + VN memorial; clear | HBO show association in English SEO |
| **wLotus** | Domain-native; coined | Balanced casing; ticker stays **WLOTUS** |
| **White Lotus Offerings** | Clarifies the act | Longer |
| **Sen Trắng** | Perfect VN | Weak globally |

**Recommendation:** ship as **wLotus**; ticker **WLOTUS**; optional long form *White Lotus*. Subtitle: *Offer · Remember · Give.*

### Messaging

**Hero:**  
*Offer a white lotus. Remember someone. Give something up for all.*

**Deeper:**  
*Unlike vàng mã, nothing is sold back into the market — the burn is the gift.*

### Branding choices (do / don’t)

**Do**

- Claim the Vietnamese white-lotus memorial reading on purpose
- Widen it with dana: memorial *and* community sacrifice
- **wLotus** as app title; **WLOTUS** ticker; domain `wlotus.org`
- Black & white theme; white lotus flower as logo icon
- Use dana / bố thí as meaning language, not a forced primary rename

**Don’t**

- Use **Temple**, **Pagoda**, or sectarian house-of-worship framing as the primary brand (ops may still say “temple desk” internally)
- Soften into spa / wellness vibe that erases death and dana
- Market only as “token burn for scarcity”
- Rename the primary brand to bare **Dana** early (SEA e-wallet collisions)
- Frame the product as the HBO series — ritual offering, not luxury satire

**IP note (non-legal):** a white lotus *flower* as a natural motif is ordinary symbolism; avoid copying third-party logos or “The White Lotus” show artwork.

---

## Cycle (issuance ↔ offering)

```
PoW remint (effort) → WLotus exists in the world
        ↓
Devotee burns (memorial + dana) → wealth destroyed, merit public
        ↓
Lotus can bloom again via permissionless remint
```

- **Cumulative burned** = spiritual / public ledger
- **Circulating supply** = secondary to the offering story
- **PoW** = rebirth through work, not discretionary mint authority

Technical rails: [PROPOSAL.md](./PROPOSAL.md) · [ECONOMICS_WLOTUS_GLOTUS.md](./ECONOMICS_WLOTUS_GLOTUS.md) · [ARCHITECTURE.md](./ARCHITECTURE.md)

---

## Product surface

| Surface | Role |
|---------|------|
| `apps/web` | Offer / burn UI (XEC fees; mint-api remint) |
| Memorial metadata | EMPP / app-side dedication beside ALP `BURN` |
| Postage (later) | Sponsor fees so offering is not gated on holding XEC |

The website is the white lotus act: give (burn) WLotus in memorial of the dead — and by burning one’s own wealth, give dana to everybody.
