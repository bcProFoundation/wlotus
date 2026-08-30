import { createPwaReloadGate } from '../apps/web/src/lib/pwaReloadGate.js';

describe('pwaReloadGate', () => {
  it('reloads on controllerchange when idle', () => {
    const gate = createPwaReloadGate();
    expect(gate.onControllerChange()).toBe('reload');
  });

  it('does not reload or poll during an offering', () => {
    const gate = createPwaReloadGate();
    gate.setOffering(true);
    expect(gate.onControllerChange()).toBe('noop');
    expect(gate.onCheck()).toBe('noop');
  });

  it('defers the reload until the next check after the offering', () => {
    const gate = createPwaReloadGate();
    gate.setOffering(true);
    expect(gate.onControllerChange()).toBe('noop');
    gate.setOffering(false);
    expect(gate.onCheck()).toBe('reload');
    expect(gate.onCheck()).toBe('check');
  });

  it('polls normally when idle and nothing is pending', () => {
    const gate = createPwaReloadGate();
    expect(gate.onCheck()).toBe('check');
  });

  it('keeps blocking if a follow-up offering starts before the deferred check', () => {
    const gate = createPwaReloadGate();
    gate.setOffering(true);
    expect(gate.onControllerChange()).toBe('noop');
    gate.setOffering(false);
    gate.setOffering(true);
    expect(gate.onCheck()).toBe('noop');
    gate.setOffering(false);
    expect(gate.onCheck()).toBe('reload');
  });
});
