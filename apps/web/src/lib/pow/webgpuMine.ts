/**
 * Experimental WebGPU SHA256d miner (phone GPU).
 *
 * v1 constraints:
 * - Message = powPrefix || 4-byte LE nonce, total length ≤ 55 (single SHA256 block).
 *   Live challenges use 32-byte sha256-preimage prefix + 4 nonce = 36 bytes.
 * - Falls back by throwing if WebGPU unavailable or prefix too long.
 *
 * Correctness: same sha256d + meetsPowBits as clientMine / server verifyPowBits.
 */
import { fromHex, sha256d, toHex } from 'ecash-lib';
import { meetsPowBits, type MineProgress, type MineResult } from '../clientMine.js';

/** WGSL: SHA256d over prefix||nonce for messages fitting one block. */
const WGSL_SHA256D = /* wgsl */ `
struct Params {
  prefix_len: u32,
  bits: u32,
  nonce_base: u32,
  attempts: u32,
}

@group(0) @binding(0) var<storage, read> prefix: array<u32>;
@group(0) @binding(1) var<uniform> params: Params;
@group(0) @binding(2) var<storage, read_write> out_found: array<atomic<u32>>;

fn rotr(x: u32, n: u32) -> u32 { return (x >> n) | (x << (32u - n)); }

fn ch(x: u32, y: u32, z: u32) -> u32 { return (x & y) ^ ((~x) & z); }
fn maj(x: u32, y: u32, z: u32) -> u32 { return (x & y) ^ (x & z) ^ (y & z); }
fn bsig0(x: u32) -> u32 { return rotr(x, 2u) ^ rotr(x, 13u) ^ rotr(x, 22u); }
fn bsig1(x: u32) -> u32 { return rotr(x, 6u) ^ rotr(x, 11u) ^ rotr(x, 25u); }
fn ssig0(x: u32) -> u32 { return rotr(x, 7u) ^ rotr(x, 18u) ^ (x >> 3u); }
fn ssig1(x: u32) -> u32 { return rotr(x, 17u) ^ rotr(x, 19u) ^ (x >> 10u); }

const K = array<u32, 64>(
  0x428a2f98u,0x71374491u,0xb5c0fbcfu,0xe9b5dba5u,0x3956c25bu,0x59f111f1u,0x923f82a4u,0xab1c5ed5u,
  0xd807aa98u,0x12835b01u,0x243185beu,0x550c7dc3u,0x72be5d74u,0x80deb1feu,0x9bdc06a7u,0xc19bf174u,
  0xe49b69c1u,0xefbe4786u,0x0fc19dc6u,0x240ca1ccu,0x2de92c6fu,0x4a7484aau,0x5cb0a9dcu,0x76f988dau,
  0x983e5152u,0xa831c66du,0xb00327c8u,0xbf597fc7u,0xc6e00bf3u,0xd5a79147u,0x06ca6351u,0x14292967u,
  0x27b70a85u,0x2e1b2138u,0x4d2c6dfcu,0x53380d13u,0x650a7354u,0x766a0abbu,0x81c2c92eu,0x92722c85u,
  0xa2bfe8a1u,0xa81a664bu,0xc24b8b70u,0xc76c51a3u,0xd192e819u,0xd6990624u,0xf40e3585u,0x106aa070u,
  0x19a4c116u,0x1e376c08u,0x2748774cu,0x34b0bcb5u,0x391c0cb3u,0x4ed8aa4au,0x5b9cca4fu,0x682e6ff3u,
  0x748f82eeu,0x78a5636fu,0x84c87814u,0x8cc70208u,0x90befffau,0xa4506cebu,0xbef9a3f7u,0xc67178f2u
);

fn sha256_block(w0: array<u32, 16>) -> array<u32, 8> {
  var w: array<u32, 64>;
  for (var i = 0u; i < 16u; i++) { w[i] = w0[i]; }
  for (var i = 16u; i < 64u; i++) {
    w[i] = ssig1(w[i - 2u]) + w[i - 7u] + ssig0(w[i - 15u]) + w[i - 16u];
  }
  var a = 0x6a09e667u; var b = 0xbb67ae85u; var c = 0x3c6ef372u; var d = 0xa54ff53au;
  var e = 0x510e527fu; var f = 0x9b05688cu; var g = 0x1f83d9abu; var h = 0x5be0cd19u;
  for (var i = 0u; i < 64u; i++) {
    let t1 = h + bsig1(e) + ch(e, f, g) + K[i] + w[i];
    let t2 = bsig0(a) + maj(a, b, c);
    h = g; g = f; f = e; e = d + t1; d = c; c = b; b = a; a = t1 + t2;
  }
  return array<u32, 8>(
    a + 0x6a09e667u, b + 0xbb67ae85u, c + 0x3c6ef372u, d + 0xa54ff53au,
    e + 0x510e527fu, f + 0x9b05688cu, g + 0x1f83d9abu, h + 0x5be0cd19u
  );
}

fn pack_be(b0: u32, b1: u32, b2: u32, b3: u32) -> u32 {
  return (b0 << 24u) | (b1 << 16u) | (b2 << 8u) | b3;
}

fn meets_bits(h: array<u32, 8>, bits: u32) -> bool {
  let zero_bytes = bits / 8u;
  let rem = bits % 8u;
  var byte_i = 0u;
  for (var wi = 0u; wi < 8u; wi++) {
    for (var s = 0u; s < 4u; s++) {
      let shift = 24u - s * 8u;
      let b = (h[wi] >> shift) & 0xffu;
      if (byte_i < zero_bytes) {
        if (b != 0u) { return false; }
      } else if (byte_i == zero_bytes) {
        if (rem == 0u) { return true; }
        let limit = 1u << (8u - rem);
        return b < limit;
      }
      byte_i += 1u;
    }
  }
  return rem == 0u && zero_bytes >= 32u;
}

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  if (atomicLoad(&out_found[0]) != 0u) { return; }
  let idx = gid.x;
  if (idx >= params.attempts) { return; }

  let nonce = params.nonce_base + idx;
  let plen = params.prefix_len;
  // Build 64-byte padded block in registers (msg || 0x80 || zeros || bitlen)
  var msg: array<u32, 64>;
  for (var i = 0u; i < 64u; i++) { msg[i] = 0u; }

  // prefix bytes from u32 LE words in storage
  for (var i = 0u; i < plen; i++) {
    let word = prefix[i / 4u];
    let shift = (i % 4u) * 8u;
    msg[i] = (word >> shift) & 0xffu;
  }
  // LE nonce
  msg[plen + 0u] = nonce & 0xffu;
  msg[plen + 1u] = (nonce >> 8u) & 0xffu;
  msg[plen + 2u] = (nonce >> 16u) & 0xffu;
  msg[plen + 3u] = (nonce >> 24u) & 0xffu;
  let mlen = plen + 4u;
  msg[mlen] = 0x80u;
  let bitlen = mlen * 8u;
  msg[63u] = bitlen & 0xffu;
  msg[62u] = (bitlen >> 8u) & 0xffu;

  var w0: array<u32, 16>;
  for (var i = 0u; i < 16u; i++) {
    let o = i * 4u;
    w0[i] = pack_be(msg[o], msg[o + 1u], msg[o + 2u], msg[o + 3u]);
  }
  let h1 = sha256_block(w0);

  // Second SHA256 over 32-byte digest
  var msg2: array<u32, 64>;
  for (var i = 0u; i < 64u; i++) { msg2[i] = 0u; }
  for (var i = 0u; i < 8u; i++) {
    let v = h1[i];
    let o = i * 4u;
    msg2[o] = (v >> 24u) & 0xffu;
    msg2[o + 1u] = (v >> 16u) & 0xffu;
    msg2[o + 2u] = (v >> 8u) & 0xffu;
    msg2[o + 3u] = v & 0xffu;
  }
  msg2[32u] = 0x80u;
  msg2[63u] = 0x00u;
  msg2[62u] = 0x01u; // 256 bits
  var w1: array<u32, 16>;
  for (var i = 0u; i < 16u; i++) {
    let o = i * 4u;
    w1[i] = pack_be(msg2[o], msg2[o + 1u], msg2[o + 2u], msg2[o + 3u]);
  }
  let h2 = sha256_block(w1);

  if (meets_bits(h2, params.bits)) {
    let old = atomicExchange(&out_found[0], 1u);
    if (old == 0u) {
      atomicStore(&out_found[1], nonce);
    }
  }
}
`;

function getGpu(): GPU | undefined {
  return typeof navigator !== 'undefined'
    ? (navigator as Navigator & { gpu?: GPU }).gpu
    : undefined;
}

export function isWebGpuAvailable(): boolean {
  return Boolean(getGpu());
}

export async function mineWebGpu(opts: {
  powPrefixHex: string;
  bits: number;
  nonceLength?: number;
  onProgress?: (p: MineProgress) => void;
  signal?: AbortSignal;
}): Promise<MineResult & { backend: 'webgpu' }> {
  const nonceLen = opts.nonceLength ?? 4;
  if (nonceLen !== 4) {
    throw new Error('webgpu miner v1 requires 4-byte nonce');
  }
  const prefix = fromHex(opts.powPrefixHex);
  if (prefix.length + 4 > 55) {
    throw new Error('webgpu miner v1: prefix||nonce must fit one SHA256 block');
  }

  const gpu = getGpu();
  if (!gpu) throw new Error('WebGPU not available');

  const adapter = await gpu.requestAdapter();
  if (!adapter) throw new Error('WebGPU adapter unavailable');
  const device = await adapter.requestDevice();

  const attemptsPerDispatch = 65536;
  const t0 = performance.now();
  let attempts = 0;
  let nonceBase = 0;

  // Pack prefix as LE u32 words
  const prefixWords = new Uint32Array(Math.ceil(prefix.length / 4) || 1);
  for (let i = 0; i < prefix.length; i++) {
    prefixWords[i >> 2]! |= prefix[i]! << ((i & 3) * 8);
  }

  const prefixBuf = device.createBuffer({
    size: Math.max(4, prefixWords.byteLength),
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
  });
  device.queue.writeBuffer(prefixBuf, 0, prefixWords);

  const paramsBuf = device.createBuffer({
    size: 16,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });
  const outBuf = device.createBuffer({
    size: 8,
    usage:
      GPUBufferUsage.STORAGE |
      GPUBufferUsage.COPY_SRC |
      GPUBufferUsage.COPY_DST,
  });
  const readBuf = device.createBuffer({
    size: 8,
    usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,
  });

  const module = device.createShaderModule({ code: WGSL_SHA256D });
  const pipeline = device.createComputePipeline({
    layout: 'auto',
    compute: { module, entryPoint: 'main' },
  });

  try {
    for (;;) {
      if (opts.signal?.aborted) {
        throw new DOMException('Mining aborted', 'AbortError');
      }

      device.queue.writeBuffer(outBuf, 0, new Uint32Array([0, 0]));
      const params = new Uint32Array([
        prefix.length,
        opts.bits,
        nonceBase >>> 0,
        attemptsPerDispatch,
      ]);
      device.queue.writeBuffer(paramsBuf, 0, params);

      const bindGroup = device.createBindGroup({
        layout: pipeline.getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: { buffer: prefixBuf } },
          { binding: 1, resource: { buffer: paramsBuf } },
          { binding: 2, resource: { buffer: outBuf } },
        ],
      });

      const enc = device.createCommandEncoder();
      const pass = enc.beginComputePass();
      pass.setPipeline(pipeline);
      pass.setBindGroup(0, bindGroup);
      pass.dispatchWorkgroups(Math.ceil(attemptsPerDispatch / 64));
      pass.end();
      enc.copyBufferToBuffer(outBuf, 0, readBuf, 0, 8);
      device.queue.submit([enc.finish()]);

      await readBuf.mapAsync(GPUMapMode.READ);
      const view = new Uint32Array(readBuf.getMappedRange().slice(0));
      readBuf.unmap();

      attempts += attemptsPerDispatch;
      const elapsedMs = Math.max(1, Math.round(performance.now() - t0));
      opts.onProgress?.({
        attempts,
        elapsedMs,
        hashrateHps: Math.round(attempts / (elapsedMs / 1000)),
      });

      if (view[0] === 1) {
        const nonceVal = view[1]!;
        const nonce = new Uint8Array(4);
        nonce[0] = nonceVal & 0xff;
        nonce[1] = (nonceVal >>> 8) & 0xff;
        nonce[2] = (nonceVal >>> 16) & 0xff;
        nonce[3] = (nonceVal >>> 24) & 0xff;
        // CPU verify before returning
        const msg = new Uint8Array(prefix.length + 4);
        msg.set(prefix, 0);
        msg.set(nonce, prefix.length);
        const hash = sha256d(msg);
        if (!meetsPowBits(hash, opts.bits)) {
          throw new Error('webgpu miner: GPU result failed CPU verify');
        }
        return {
          nonceHex: toHex(nonce),
          attempts,
          elapsedMs,
          hashrateHps: Math.round(attempts / (elapsedMs / 1000)),
          backend: 'webgpu',
        };
      }

      nonceBase = (nonceBase + attemptsPerDispatch) >>> 0;
      if (nonceBase < attemptsPerDispatch && attempts > attemptsPerDispatch) {
        // wrapped 32-bit space — continue until abort (unlikely at UX bits)
      }
    }
  } finally {
    prefixBuf.destroy();
    paramsBuf.destroy();
    outBuf.destroy();
    readBuf.destroy();
    device.destroy?.();
  }
}
