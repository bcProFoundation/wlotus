import {
  findMintBatonOutIdx,
  walkToUnspentMintBaton,
  resolveLiveMintBaton,
  matchCovenantToBaton,
  lockingScriptsEqual,
  type FollowChronik,
} from '../src/mint/followMintBaton.js';

function tx(opts: {
  txid: string;
  lockTime?: number;
  outputs: Array<{
    sats?: bigint;
    outputScript?: string;
    spentBy?: { txid: string; outIdx: number };
    token?: { tokenId: string; isMintBaton: boolean };
  }>;
}) {
  return {
    txid: opts.txid,
    lockTime: opts.lockTime ?? 0,
    outputs: opts.outputs.map(o => ({
      sats: o.sats ?? 546n,
      outputScript: o.outputScript ?? 'a91400',
      spentBy: o.spentBy,
      token: o.token,
    })),
  };
}

const TOKEN =
  'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';

describe('followMintBaton', () => {
  it('finds the mint-baton output index', () => {
    const t = tx({
      txid: '11'.repeat(32),
      outputs: [
        { token: { tokenId: TOKEN, isMintBaton: false } },
        { token: { tokenId: TOKEN, isMintBaton: true } },
      ],
    });
    expect(findMintBatonOutIdx(t as never, TOKEN)).toBe(1);
  });

  it('returns the start baton when it is still unspent', async () => {
    const start = 'bb'.repeat(32);
    const chronik: FollowChronik = {
      tx: async () =>
        tx({
          txid: start,
          lockTime: 100,
          outputs: [
            {
              outputScript: 'script-a',
              token: { tokenId: TOKEN, isMintBaton: true },
            },
          ],
        }) as never,
      tokenId: () => ({ utxos: async () => ({ tokenId: TOKEN, utxos: [] }) }),
    };
    const live = await walkToUnspentMintBaton(chronik, TOKEN, start);
    expect(live.txid).toBe(start);
    expect(live.outIdx).toBe(0);
    expect(live.hops).toBe(0);
    expect(live.creatingLockTime).toBe(100);
  });

  it('follows spentBy when an open miner remints the baton', async () => {
    const genesis = 'cc'.repeat(32);
    const minerRemint = 'dd'.repeat(32);
    const txs: Record<string, ReturnType<typeof tx>> = {
      [genesis]: tx({
        txid: genesis,
        lockTime: 50,
        outputs: [
          {
            token: { tokenId: TOKEN, isMintBaton: true },
            spentBy: { txid: minerRemint, outIdx: 0 },
          },
        ],
      }),
      [minerRemint]: tx({
        txid: minerRemint,
        lockTime: 99,
        outputs: [
          {
            outputScript: 'next-p2sh',
            token: { tokenId: TOKEN, isMintBaton: true },
          },
        ],
      }),
    };
    const chronik: FollowChronik = {
      tx: async id => txs[id.toLowerCase()] as never,
      tokenId: () => ({ utxos: async () => ({ tokenId: TOKEN, utxos: [] }) }),
    };
    const live = await walkToUnspentMintBaton(chronik, TOKEN, genesis);
    expect(live.txid).toBe(minerRemint);
    expect(live.creatingLockTime).toBe(99);
    expect(live.outputScript).toBe('next-p2sh');
    expect(live.hops).toBe(1);
  });

  it('falls back to token UTXO scan when the start tx is missing', async () => {
    const liveTx = 'ee'.repeat(32);
    const chronik: FollowChronik = {
      tx: async id => {
        if (id === liveTx) {
          return tx({
            txid: liveTx,
            lockTime: 77,
            outputs: [
              {
                outputScript: 'live',
                token: { tokenId: TOKEN, isMintBaton: true },
              },
            ],
          }) as never;
        }
        throw new Error('not found');
      },
      tokenId: () => ({
        utxos: async () => ({
          tokenId: TOKEN,
          utxos: [
            {
              outpoint: { txid: liveTx, outIdx: 0 },
              sats: 546n,
              script: 'live',
              token: { tokenId: TOKEN, isMintBaton: true },
            },
          ],
        }),
      }),
    };
    const live = await resolveLiveMintBaton(chronik, TOKEN, 'ff'.repeat(32));
    expect(live.txid).toBe(liveTx);
    expect(live.creatingLockTime).toBe(77);
  });

  it('matches covenant using creating locktime (open-miner remint)', async () => {
    const live = {
      txid: 'aa'.repeat(32),
      outIdx: 1,
      sats: 546n,
      outputScript: 'p2sh-99',
      creatingTxid: 'aa'.repeat(32),
      creatingLockTime: 99,
      hops: 1,
    };
    const matched = await matchCovenantToBaton(
      live,
      [50, 60],
      async tipLocktime => ({
        address: `addr-${tipLocktime}`,
        p2shScriptHex: `p2sh-${tipLocktime}`,
        tipLocktime,
      }),
    );
    expect(matched.tipLocktime).toBe(99);
    expect(matched.address).toBe('addr-99');
  });

  it('matches genesis handoff when creating locktime is 0', async () => {
    const live = {
      txid: 'aa'.repeat(32),
      outIdx: 0,
      sats: 546n,
      outputScript: 'a914' + 'ab'.repeat(20) + '87',
      creatingTxid: 'aa'.repeat(32),
      creatingLockTime: 0,
      hops: 0,
    };
    const matched = await matchCovenantToBaton(
      live,
      [1_700_000_000],
      async tipLocktime => ({
        address: `addr-${tipLocktime}`,
        p2shScriptHex:
          tipLocktime === 1_700_000_000
            ? 'a914' + 'ab'.repeat(20) + '87'
            : 'a914' + '00'.repeat(20) + '87',
        tipLocktime,
      }),
    );
    expect(matched.tipLocktime).toBe(1_700_000_000);
  });

  it('equates full P2SH bytecode with the 20-byte script hash', () => {
    const hash = 'ab'.repeat(20);
    expect(lockingScriptsEqual(`a914${hash}87`, hash)).toBe(true);
    expect(lockingScriptsEqual(`0xA914${hash}87`, hash)).toBe(true);
  });
});
