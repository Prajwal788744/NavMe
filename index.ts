import { setPreferWebXRCamera } from "@zappar/zappar";
setPreferWebXRCamera(true);

import { initialize, useCamera } from "@zcomponent/three";
import Scene from "./Scene.zcomp";
import { started } from "@zcomponent/core";

console.log("Index.ts is running");

import { WebSocketClient } from "./WebSocketClient";

// ────────────────────────────────────────────────
// ORDS ENDPOINT (Handled by Backend now)
// ────────────────────────────────────────────────

// ────────────────────────────────────────────────
// START AR EXPERIENCE
// ────────────────────────────────────────────────
const { rootInstance, contextManager } = initialize(Scene, {}, {
  launchButton: document.getElementById("launchButton") as HTMLElement
});

// ────────────────────────────────────────────────
// GLOBAL TYPES
// ────────────────────────────────────────────────
declare global {
  interface Window {
    APP_USER?: {
      name: string;
      email: string;
    };
  }
}

// ────────────────────────────────────────────────
// USER DETAILS POPUP (shown once at startup)
// ────────────────────────────────────────────────
function showUserPopup(): Promise<void> {
  return new Promise((resolve) => {
    const overlay = document.createElement("div");
    overlay.style.cssText = `
      position: fixed;
      inset: 0;
      background: rgba(0,0,0,0.7);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 9999;
    `;

    const popup = document.createElement("div");
    popup.style.cssText = `
      background: #111;
      padding: 24px;
      border-radius: 16px;
      width: 340px;
      min-height: 260px;
      color: white;
      font-family: -apple-system, BlinkMacSystemFont, sans-serif;
      box-shadow: 0 0 30px rgba(0,0,0,0.7);
    `;

    popup.innerHTML = `
      <h3 style="margin-top:0;">Enter Details</h3>
      <input id="userName" placeholder="Your Name"
        style="width:100%;padding:8px;margin-bottom:10px;border-radius:6px;border:none;" />
      <input id="userEmail" placeholder="Email ID"
        style="width:100%;padding:8px;margin-bottom:12px;border-radius:6px;border:none;" />
      <button id="submitUser"
        style="width:100%;padding:10px;border:none;border-radius:6px;background:#2c3e50;color:#fff;font-weight:bold;">
        Continue
      </button>
    `;

    overlay.appendChild(popup);
    document.body.appendChild(overlay);

    popup.querySelector<HTMLButtonElement>("#submitUser")!.onclick = () => {
      const nameInput = popup.querySelector<HTMLInputElement>("#userName")!;
      const emailInput = popup.querySelector<HTMLInputElement>("#userEmail")!;

      if (!nameInput.value.trim() || !emailInput.value.trim()) {
        alert("Please enter both name and email");
        return;
      }

      window.APP_USER = {
        name: nameInput.value.trim(),
        email: emailInput.value.trim()
      };

      WebSocketClient.getInstance().registerUser();

      console.log("✅ App user registered:", window.APP_USER);

      document.body.removeChild(overlay);
      resolve();
    };
  });
}

// ────────────────────────────────────────────────
// STATUS DISPLAY (top-left floating panel)
// ────────────────────────────────────────────────
function createStatusDisplay() {
  const container = document.createElement("div");
  container.id = "user-status-display";
  container.style.cssText = `
    position: fixed;
    top: 12px;
    left: 12px;
    background: rgba(0,0,0,0.65);
    color: white;
    padding: 12px 16px;
    display: none !important;
    border-radius: 12px;
    font-family: monospace;
    font-size: 13px;
    z-index: 9998;
    backdrop-filter: blur(6px);
    border: 1px solid rgba(255,255,255,0.12);
    min-width: 260px;
    pointer-events: none;
  `;

  document.body.appendChild(container);
  return container;
}

function updateStatusDisplay(container: HTMLElement) {
  const appUser = window.APP_USER;
  const selected = window.selectedUser;

  const isWsConnected = WebSocketClient.getInstance().connected;

  container.innerHTML = `
  <div style="margin-bottom:6px; font-weight:bold; color:#a5b4fc;">
    Current Users:
  </div>

  <div style="margin-bottom:8px; font-size:12px;">
    <strong>System:</strong>
    ${isWsConnected
      ? '<span style="color:#10b981; font-weight:bold;">● WS Connected</span>'
      : '<span style="color:#ef4444; font-weight:bold;">● Disconnected</span>'
    }
  </div>

  <div>
    <strong>You:</strong>
    ${appUser
      ? `${appUser.name} (${appUser.email})`
      : '<span style="color:#f87171;">not set</span>'
    }
  </div>

  <div>
    <strong>Connected to:</strong>
    ${selected
      ? `${selected.name} (${selected.email})`
      : '<span style="color:#94a3b8;">null / none</span>'
    }
  </div>

  <div style="margin-top:6px; font-size:13px; color:#e5e7eb;">
    <strong>Position:</strong>
    ${selected
      ? `
          X: ${(window.selectedX ?? 0).toFixed(3)}<br/>
          Y: ${(window.selectedY ?? 0).toFixed(3)}<br/>
          Z: ${(window.selectedZ ?? 0).toFixed(3)}
        `
      : '<span style="color:#64748b;">—</span>'
    }
  </div>
`;
}

// ────────────────────────────────────────────────
// MAIN APPLICATION FLOW
// ────────────────────────────────────────────────
started(contextManager)
  .then(async () => {
    // Create and show status panel
    const statusDisplay = createStatusDisplay();

    // Initial render
    updateStatusDisplay(statusDisplay);

    // Reliable polling to detect any changes to global variables
    // (this fixes the update problem without breaking assignments)
    setInterval(() => {
      updateStatusDisplay(statusDisplay);
    }, 700);  // ~1.4 checks per second — very lightweight

    // Show login/details popup once
    await showUserPopup();

    // Refresh display after user submits details
    updateStatusDisplay(statusDisplay);

    console.log("Experience started, getting camera...");
    const cameraObservable = useCamera(contextManager);
    const camera = cameraObservable.value;

    if (!camera) {
      console.error("Camera not available yet");
      return;
    }

    console.log("Camera acquired");

    // Send position updates every 1 second
    // Send position updates every 1 second via WebSocket
    setInterval(() => {
      try {
        const appUser = window.APP_USER;
        if (!appUser?.email) return;

        // Ensure we are registered on the WS server
        // (safe to call repeatedly as it checks connection state internally, 
        //  but ideally we call it once on login. We'll add a call in showUserPopup too)
        WebSocketClient.getInstance().registerUser();

        const worldPos = camera.position;
        const x = Number(worldPos.x.toFixed(4));
        const y = Number(worldPos.y.toFixed(4));
        const z = Number(worldPos.z.toFixed(4));

        WebSocketClient.getInstance().sendLocationUpdate({ x, y, z }, 1);

        console.log("✅ Position sent via WS:", x, y, z);
      } catch (error) {
        console.error("Error sending position:", error);
      }
    }, 1000);
  })
  .catch(err => console.error("Startup error:", err));