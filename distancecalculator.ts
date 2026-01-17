import { Component, ContextManager, Observable, Event } from "@zcomponent/core";
import { useOverlay, useOnBeforeRender } from "@zcomponent/core";
import { useCamera } from "@zcomponent/three";

interface ConstructorProps {
  enabled?: boolean;
  updateFrequency?: number;
}

interface Destination {
  id: string;
  name: string;
  category: string;
  position: [number, number, number] | (() => [number, number, number]);
}


/**
 * @zcomponent
 */
export class DistanceCalculator extends Component<ConstructorProps> {
  private _overlay: HTMLDivElement | null = null;
  private _distanceUI: HTMLDivElement | null = null;
  private _currentTarget: Destination | null = null;
  private _userPosition: [number, number, number] = [0, 0, 0];
  private _isVisible = false;
  private _updateCounter = 0;
  private _targetUpdateFrequency = 60;
  private _arrivalTimeout: ReturnType<typeof setTimeout> | null = null;

  public currentDistance = new Observable<number>(0);
  public targetDestination = new Observable<string>("");
  public isCalculating = new Observable<boolean>(false);
  public onDistanceUpdate = new Event<[number, string]>();

  constructor(contextManager: ContextManager, constructorProps: ConstructorProps) {
    super(contextManager, constructorProps);

    this._targetUpdateFrequency = constructorProps?.updateFrequency ?? 60;

    if (constructorProps?.enabled ?? true) {
      this._createUI();
      this._setupUpdateLoop();
    }

    // expose globally so destination buttons can call it
    (window as any).DistanceCalculator = this;
  }

  /* ---------------- UI ---------------- */

  private _createUI(): void {
    const overlay = useOverlay(this.contextManager);

    this.register(overlay, (overlayElement) => {
      if (!overlayElement) return;
      this._overlay = overlayElement;
      this._createDistanceInterface();
    });
  }

  private _createDistanceInterface(): void {
    if (!this._overlay) return;

    this._distanceUI = document.createElement("div");
    this._distanceUI.id = "distance-calculator-ui";
    this._distanceUI.style.cssText = this._getDistanceCalculatorCSS();

    this._resetToDistanceUI();
    this._distanceUI.style.display = "none";

    this._overlay.appendChild(this._distanceUI);
  }

  private _getDistanceCalculatorCSS(): string {
    return `
      position: fixed;
      bottom: 120px;
      left: 50%;
      transform: translateX(-50%) translateY(10px);
      background: rgba(59,130,246,0.2);
      border: 1px solid rgba(59,130,246,0.4);
      backdrop-filter: blur(20px);
      border-radius: 20px;
      padding: 14px 28px;
      color: white;
      z-index: 1000;
      opacity: 0;
      transition: all 0.3s ease;
    `;
  }

  private _resetToDistanceUI(): void {
    if (!this._distanceUI) return;

    this._distanceUI.innerHTML = `
      <div style="display:inline-flex;flex-wrap:nowrap;white-space:nowrap;align-items:center;gap:12px;">
            <svg width="18" height="18" viewBox="0 0 24 24"
           fill="none" stroke="white" stroke-width="2">
        <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13z"/>
        <circle cx="12" cy="9" r="2.5" fill="white"/>
      </svg>
        <span class="destination-name-disp"></span>
        <span class="distance-number">0.0</span>
        <span class="distance-unit">m</span>
      </div>
    `;
  }

  /* ---------------- UPDATE LOOP ---------------- */

  private _setupUpdateLoop(): void {
    this.register(useOnBeforeRender(this.contextManager), () => {
      if (!this._isVisible || !this._currentTarget) return;
      this._updateDistance();
    });
  }

  private _updateDistance(): void {
    if (!this._currentTarget) return;

    this._getUserPosition();

const targetPosition =
  typeof this._currentTarget.position === "function"
    ? this._currentTarget.position()
    : this._currentTarget.position;

const distance = this._calculateDistance(
  this._userPosition,
  targetPosition
);


    // update color based on distance
    this._updateUIColor(distance);

    // reached destination
    if (distance <= 0.5) {
      this._showArrivalMessage();

      if (this._arrivalTimeout) clearTimeout(this._arrivalTimeout);
      this._arrivalTimeout = setTimeout(() => {
        this.clearTarget();
      }, 3000);

      return;
    }

    this._updateDistanceDisplay(distance);
  }

  /* ---------------- POSITION ---------------- */

  private _getUserPosition(): void {
    const camera = useCamera(this.contextManager).value;
    if (!camera) return;

    this._userPosition = [
      camera.position.x,
      camera.position.y,
      camera.position.z
    ];
  }

  private _calculateDistance(
    a: [number, number, number],
    b: [number, number, number]
  ): number {
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const dz = b[2] - a[2];
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }

  /* ---------------- COLOR LOGIC ---------------- */

  private _updateUIColor(distance: number): void {
    if (!this._distanceUI) return;

    // FAR → BLUE
    if (distance > 2) {
      this._distanceUI.style.background = "rgba(59,130,246,0.2)";
      this._distanceUI.style.borderColor = "rgba(59,130,246,0.4)";
    }
    // MID → YELLOW
    else if (distance > 0.5) {
      this._distanceUI.style.background = "rgba(234,179,8,0.2)";
      this._distanceUI.style.borderColor = "rgba(234,179,8,0.4)";
    }
    // NEAR / REACHED → GREEN
    else {
      this._distanceUI.style.background = "rgba(34,197,94,0.2)";
      this._distanceUI.style.borderColor = "rgba(34,197,94,0.4)";
    }
  }

  /* ---------------- UI UPDATE ---------------- */

  private _updateDistanceDisplay(distance: number): void {
    if (!this._distanceUI || !this._currentTarget) return;

    this._distanceUI.querySelector(".distance-number")!.textContent =
      distance.toFixed(1);
    this._distanceUI.querySelector(".distance-unit")!.textContent = "m";
    this._distanceUI.querySelector(".destination-name-disp")!.textContent =
      this._currentTarget.name;
  }

  private _showArrivalMessage(): void {
    if (!this._distanceUI) return;

    this._distanceUI.innerHTML = `
      <div style="font-weight:700;font-size:16px;">
        Destination Reached
      </div>
    `;
  }

  /* ---------------- VISIBILITY ---------------- */

  private _showDistanceCalculator(): void {
    if (!this._distanceUI) return;

    this._isVisible = true;
    this._distanceUI.style.display = "block";

    requestAnimationFrame(() => {
      this._distanceUI!.style.opacity = "1";
      this._distanceUI!.style.transform =
        "translateX(-50%) translateY(0)";
    });
  }

  private _hideDistanceCalculator(): void {
    if (!this._distanceUI) return;

    this._isVisible = false;
    this._distanceUI.style.opacity = "0";
    this._distanceUI.style.transform =
      "translateX(-50%) translateY(10px)";

    setTimeout(() => {
      if (this._distanceUI) this._distanceUI.style.display = "none";
    }, 300);
  }

  /* ---------------- PUBLIC API ---------------- */

  public setTarget(destinationId: string): void {
    const destinations: Destination[] = [
      {
        id: "7b155ce59cc44f4699fe21d6860a84a4",
        name: "Water",
        category: "Water",
        position: [-2.30, -0.35, 0.91]
      },

      {
        id: "213dceaa5a164dfcb87aa16c954f721a",
        name: "Auditorium",
        category: "Auditorium",
        position: [11.71,-0.36,3.69]
      },
{
  id: "5389fd36a79640a0a1bd31f8c8bcd31e",
  name: window.selectedUser?.name 
     ?? window.selectedUser?.email 
     ?? "Dynamic Destination",
  category: "Sofa",
  position: () => [
    window.selectedX ?? 0,
    window.selectedY ?? 0,
    window.selectedZ ?? 0,
  ],
},

      		

    ];

    const destination = destinations.find(d => d.id === destinationId);
    if (!destination) return;

    // clear previous arrival state
    if (this._arrivalTimeout) {
      clearTimeout(this._arrivalTimeout);
      this._arrivalTimeout = null;
    }

    this._currentTarget = destination;

    // reset UI so old "Destination Reached" never leaks
    this._resetToDistanceUI();

    this._showDistanceCalculator();
  }

  public clearTarget(): void {
    this._currentTarget = null;
    this._hideDistanceCalculator();
  }
}
