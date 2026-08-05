# Fix: session.parentBurnTxid

`App.tsx` temple-specials UI reads `session.parentBurnTxid` for Cúng / story panel.
Session state must include:

```ts
parentBurnTxid?: string;
```

and `setSession({ ..., parentBurnTxid })` in `onOffer`.

Without this, TypeScript fails and runtime can throw when accessing the field.

Apply full App wiring:

```bash
patch -p1 < patches/temple-specials/App.tsx.patch
# or artifacts/temple-specials-remaining.patch
```
