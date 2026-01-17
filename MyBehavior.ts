import {
  Behavior,
  ContextManager,
  registerBehaviorRunAtDesignTime
} from "@zcomponent/core";
import { Box } from "@zcomponent/three/lib/components/meshes/Box";

/**
 * @zbehavior
 * @zparents three/Object3D/Mesh/Box
 */
export class MyBehavior extends Behavior<Box> {

  /* ────────────────────────────────────────────── */
  /* Position state                                 */
  /* ────────────────────────────────────────────── */

  private x = 0;
  private y = 0;
  private readonly Y_OFFSET = -1;
  private z = 0;

  // ✅ Safe fallback (static POI)
  private fallback: [number, number, number] = [1.5, -0.97, -0.16];

  /* ────────────────────────────────────────────── */
  /* Polling                                       */
  /* ────────────────────────────────────────────── */

  private readonly POLL_MS = 1000; // ✅ 30 seconds
  private pollTimer: number | null = null;

  constructor(
    contextManager: ContextManager,
    instance: Box
  ) {
    super(contextManager, instance);

    // Initial apply
    this._applyFromWindow();

    // Start polling
    this._startPolling();
  }

  /* ────────────────────────────────────────────── */
  /* Core logic                                     */
  /* ────────────────────────────────────────────── */

  private _applyFromWindow(): void {
    const x = Number((window as any).selectedX);
    const y = Number((window as any).selectedY);
    const z = Number((window as any).selectedZ);

    if (Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(z)) {
      this.setPosition(x, y + this.Y_OFFSET, z);
      console.log("📍 Dynamic destination set:", x, y, z);
    } else {
      this.setPosition(...this.fallback);
      console.warn("⚠ Using fallback destination:", this.fallback);
    }
  }

  /* ────────────────────────────────────────────── */
  /* Polling control                                */
  /* ────────────────────────────────────────────── */

  private _startPolling(): void {
    if (this.pollTimer) return;

    this.pollTimer = window.setInterval(() => {
      this._applyFromWindow();
    }, this.POLL_MS);

    console.log("📡 Destination polling started (30s)");
  }

  private _stopPolling(): void {
    if (!this.pollTimer) return;
    clearInterval(this.pollTimer);
    this.pollTimer = null;
  }

  /* ────────────────────────────────────────────── */
  /* Public API                                     */
  /* ────────────────────────────────────────────── */

  setPosition(x: number, y: number, z: number): void {
    this.x = x;
    this.y = y;
    this.z = z;

    this.instance.element.position.set(x, y, z);
    this.instance.element.updateMatrixWorld(true);
  }

  /* ────────────────────────────────────────────── */
  /* Cleanup                                       */
  /* ────────────────────────────────────────────── */

  dispose() {
    this._stopPolling();
    return super.dispose();
  }
}

// ✅ Enable design + runtime
registerBehaviorRunAtDesignTime(MyBehavior);