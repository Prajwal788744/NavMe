import {
  Behavior,
  ContextManager,
  registerBehaviorRunAtDesignTime
} from "@zcomponent/core";
import { Box } from "@zcomponent/three/lib/components/meshes/Box";
import { WebSocketClient, PositionUpdate } from "./WebSocketClient";

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

  private readonly handleUpdate = (data: PositionUpdate) => {
    // Only update if this is the currently selected user
    if (window.selectedUser && window.selectedUser.email === data.email) {
      // Direct update from WS for smoothness
      this.setPosition(data.position.x, data.position.y + this.Y_OFFSET, data.position.z);
    }
  };

  private readonly handleUserChange = () => {
    // When selected user changes (or is cleared), apply immediately from globals
    this._applyFromWindow();
  };

  constructor(
    contextManager: ContextManager,
    instance: Box
  ) {
    super(contextManager, instance);

    // Initial apply
    this._applyFromWindow();

    // Start listening
    this._startListening();
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
  /* Event Listeners                                */
  /* ────────────────────────────────────────────── */

  private _startListening(): void {
    // Listen for live updates via WebSocket
    WebSocketClient.getInstance().on('position_update', this.handleUpdate);

    // Listen for user selection changes (from UI)
    window.addEventListener("selected-user-changed", this.handleUserChange);

    console.log("📡 WebSocket & Event listening started");
  }

  private _stopListening(): void {
    WebSocketClient.getInstance().off('position_update', this.handleUpdate);
    window.removeEventListener("selected-user-changed", this.handleUserChange);
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
    this._stopListening();
    return super.dispose();
  }
}

// ✅ Enable design + runtime
registerBehaviorRunAtDesignTime(MyBehavior);