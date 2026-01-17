import { Component, ContextManager } from "@zcomponent/core";
import { useOverlay } from "@zcomponent/core";
import { WebSocketClient, PositionUpdate } from "./WebSocketClient";

declare global {
  interface Window {
    selectedUser?: {
      email: string;
      name: string;
      position?: { x: number; y: number; z: number };
      floor?: number;
      lastSeen?: string;
    };
    selectedX?: number;
    selectedY?: number;
    selectedZ?: number;
  }
}

interface Person {
  name: string;
  email: string;
  latestId: number;
  position: [number, number, number];
  floor?: number;
  lastSeen?: string;
}

export default class PeopleSearchUI extends Component {
  private _overlay: HTMLDivElement | null = null;
  private _findPeopleIcon: HTMLElement | null = null;
  private _peoplePanel: HTMLElement | null = null;
  private _peopleList: HTMLElement | null = null;
  private _peopleCloseBtn: HTMLElement | null = null;

  private readonly ORDS_URL =
    "https://g3cb3b1c0924a5d-rho2ag4cklj4nhpl.adb.ap-hyderabad-1.oraclecloudapps.com/ords/ng/ar/nodes";

  private readonly SHARE_UPDATE_URL =
    "https://g3cb3b1c0924a5d-rho2ag4cklj4nhpl.adb.ap-hyderabad-1.oraclecloudapps.com/ords/ng/ar/share";

  private readonly REQUEST_SEND_URL =
    "https://g3cb3b1c0924a5d-rho2ag4cklj4nhpl.adb.ap-hyderabad-1.oraclecloudapps.com/ords/ng/ar/AR_CONNECTION_REQUESTS";

  private readonly REQUESTS_GET_URL =
    "https://g3cb3b1c0924a5d-rho2ag4cklj4nhpl.adb.ap-hyderabad-1.oraclecloudapps.com/ords/ng/ar/AR_CONNECTION_REQUESTS";

  private readonly REQUEST_RESPOND_URL =
    "https://g3cb3b1c0924a5d-rho2ag4cklj4nhpl.adb.ap-hyderabad-1.oraclecloudapps.com/ords/ng/ar/AR_CONNECTION_REQUESTS";

  private readonly LATEST_POSITION_URL =
    "https://g3cb3b1c0924a5d-rho2ag4cklj4nhpl.adb.ap-hyderabad-1.oraclecloudapps.com/ords/ng/ar/locationnode";

  // Polling intervals removed

  private pendingRequests: any[] = [];
  private handledAcceptedOutgoing: Set<number> = new Set();
  private handledRejectedOutgoing: Set<number> = new Set();

  private previousPeople: Map<string, Person> = new Map();
  private connectedEmails: Set<string> = new Set();

  constructor(contextManager: ContextManager) {
    super(contextManager);
    this._createUI();
    this._setupWebSocketListeners();

    window.selectedX = 0;
    window.selectedY = 0;
    window.selectedZ = 0;
  }

  private _setupWebSocketListeners(): void {
    WebSocketClient.getInstance().on('position_update', (data: PositionUpdate) => {
      // Update selected user if matched
      if (window.selectedUser && window.selectedUser.email === data.email) {
        window.selectedX = data.position.x;
        window.selectedY = data.position.y;
        window.selectedZ = data.position.z;

        window.selectedUser.position = data.position;
        window.selectedUser.floor = data.floor;
        window.selectedUser.lastSeen = new Date(data.timestamp).toLocaleString();

        this._notifySelectedUserChanged();
        console.log(`✅ Live update for ${data.email}:`, data.position);
      }

      // Also update the list item if it exists (for last seen / floor)
      // We can optionally update the 'Person' object in 'previousPeople' map too.
      if (this.previousPeople.has(data.email)) {
        const person = this.previousPeople.get(data.email)!;
        person.position = [data.position.x, data.position.y, data.position.z];
        person.floor = data.floor;
        person.lastSeen = new Date(data.timestamp).toLocaleString();

        // If the panel is open, update the card UI
        if (this._peopleList) {
          const card = this._peopleList.querySelector(`.person-card[data-email="${data.email}"]`) as HTMLElement;
          if (card) {
            // We need to know if pending/connected to keep styling. 
            // For now, just update the meta text.
            const metaEl = card.querySelector(".person-meta");
            if (metaEl) {
              metaEl.innerHTML = `Floor ${person.floor || "?"} • Last: ${person.lastSeen}`;
            }
          }
        }
      }
    });
  }

  private _clearSelectedGlobals(): void {
    window.selectedX = 0;
    window.selectedY = 0;
    window.selectedZ = 0;
    window.selectedUser = undefined;

    this._notifySelectedUserChanged();
  }

  private _notifySelectedUserChanged(): void {
    window.dispatchEvent(new Event("selected-user-changed"));
  }

  private _createUI(): void {
    const overlay = useOverlay(this.contextManager);

    this.register(overlay, (el) => {
      if (!el) return;
      this._overlay = el;
      this._injectHTMLAndCSS();
    });
  }

  private _injectHTMLAndCSS(): void {
    if (!this._overlay) return;

    const style = document.createElement("style");
    style.textContent = `
    svg {
  display: block;
  
}
/* Global icon system */
svg {
  display: block;
  stroke: currentColor;
  fill: none;
}


      #floating-findpeople-icon {
        position: fixed;
        bottom: 74px;
        right: 16px;
        width: 44px;
        height: 44px;
        // background: rgba(44, 62, 80, 0.75);
        background:#2C3E50;
        color: #ffffff;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 8px 32px rgba(0,0,0,0.25);
        backdrop-filter: blur(12px) saturate(180%);
        -webkit-backdrop-filter: blur(12px) saturate(180%);
        border: 1px solid rgba(255,255,255,0.12);
        cursor: pointer;
        z-index: 1000;
        transition: all 0.3s ease;
      }
      #floating-findpeople-icon:hover {
        transform: scale(1.08);
        box-shadow: 0 12px 40px rgba(0,0,0,0.35);
      }
      .findpeople-icon-svg {
        width: 26px;
        height: 26px;
        stroke: #2c3e50;
        fill: none;
        stroke-width: 2.2;
        stroke-linecap: round;
      }
      .badge {
        position: absolute;
        top: -6px;
        right: -6px;
        background: #ef4444;
        color: #2C3E50;
        border-radius: 50%;
        min-width: 20px;
        height: 20px;
        font-size: 11px;
        font-weight: bold;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 2px 8px rgba(239,68,68,0.5);
      }

      #people-search-panel {
        position: fixed;
        bottom: 0;
        left: 0;
        right: 0;
        margin: 12px;
        height: 75dvh;
        max-height: 520px;
  background: rgba(255, 255, 255, 0.8);
        backdrop-filter: blur(24px) saturate(200%);
        -webkit-backdrop-filter: blur(24px) saturate(200%);
        border-radius: 24px 24px 0 0;
        border: 1px solid rgba(255,255,255,0.18);
        box-shadow: 0 -10px 40px rgba(0,0,0,0.25);
        transform: translateY(100%);
        opacity: 0;
        pointer-events: none;
        transition: all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
        z-index: 2000;
        display: flex;
        flex-direction: column;
        overflow: hidden;
      }
      #people-search-panel.active {
        transform: translateY(0);
        opacity: 1;
        pointer-events: all;
      }
      .people-header {
        padding: 16px 20px 12px;
        display: flex;
        justify-content: space-between;
        align-items: center;
        border-bottom: 1px solid rgba(255,255,255,0.12);
        flex-shrink: 0;
        background: rgba(255,255,255,0.08);
      }
      .people-title {
        font-size: 17px;
        font-weight: 700;
        color: #2c3e50;
        text-shadow: 0 1px 3px rgba(0,0,0,0.4);
      }
      .people-close {
        width: 36px;
        height: 36px;
        border-radius: 50%;
        border: none;
        background: rgba(255,255,255,0.15);
        backdrop-filter: blur(8px);
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.2s;
      }
      .people-close:hover {
        background: rgba(255,255,255,0.25);
      }
      .people-close svg {
        width: 20px;
        height: 20px;
        stroke: #2c3e50;
        stroke-width: 2.5;
      }
      .share-row {
        padding: 16px 20px;
        display: flex;
        justify-content: space-between;
        align-items: center;
        border-bottom: 1px solid rgba(255,255,255,0.12);
        font-size: 15px;
        color: #2c3e50;
        font-weight: 500;
        flex-shrink: 0;
        background: rgba(0,0,0,0.08);
      }
      .share-toggle {
        width: 52px;
        height: 28px;
        position: relative;
      }
      .share-toggle input {
        opacity: 0;
        width: 0;
        height: 0;
      }
      .share-slider {
        position: absolute;
        inset: 0;
        background: rgba(255,255,255,0.2);
        border-radius: 28px;
        transition: background 0.3s;
        border: 1px solid rgba(255,255,255,0.15);
      }
      .share-slider::before {
        content: "";
        position: absolute;
        width: 24px;
        height: 24px;
        left: 2px;
        top: 2px;
        background: white;
        border-radius: 50%;
        transition: transform 0.3s;
        box-shadow: 0 2px 8px rgba(0,0,0,0.3);
      }
      .share-toggle input:checked + .share-slider {
        background: #10b981;
      }
      .share-toggle input:checked + .share-slider::before {
        transform: translateX(24px);
      }

      .people-list {
        flex: 1;
        overflow-y: auto;
        padding: 12px 0;
      }
      .person-card {
        padding: 16px 20px;
        border-bottom: 1px solid rgba(255,255,255,0.08);
        cursor: pointer;
        transition: all 0.2s;
        background: rgba(255,255,255,0.05);
      }
      .person-card:hover {
        background: rgba(255,255,255,0.12);
      }
      .person-name {
        font-size: 15.5px;
        font-weight: 600;
        color: #2c3e50;
      }
      .person-email {
        font-size: 13px;
        color: rgba(0,0,0,0.75);
        margin-top: 3px;
      }
      .person-meta {
        font-size: 12px;
        color: rgba(76, 96, 115, 0.75);
        margin-top: 5px;
      }

      .empty-state {
        padding: 60px 20px;
        text-align: center;
        color: rgba(76, 96, 115, 0.75);
        font-size: 15px;
        line-height: 1.5;
      }
      .empty-icon {
        width: 64px;
        height: 64px;
        margin: 0 auto 16px;
        stroke: rgba(44, 62, 80, 0.75);
        stroke-width: 1.8;
        fill: none;
      }

      .requests-title {
        padding: 16px 20px;
        font-size: 15px;
        font-weight: 700;
        color: #2c3e50;
        border-bottom: 1px solid rgba(255,255,255,0.12);
        background: rgba(0,0,0,0.12);
      }
      .request-card {
        padding: 16px 20px;
        border-bottom: 1px solid rgba(255,255,255,0.08);
        background: rgba(255,255,255,0.04);
      }
      .request-from {
        font-size: 15px;
        color: #2c3e50;
        margin-bottom: 12px;
      }
      .request-buttons {
        display: flex;
        justify-content: flex-end;
        gap: 12px;
      }
      .request-buttons button {
        padding: 10px 20px;
        border: none;
        border-radius: 10px;
        font-size: 14px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s;
      }
      .accept-btn { background: #10b981; color: white; }
      .accept-btn:hover { background: #059669; }
      .reject-btn { background: #ef4444; color: white; }
      .reject-btn:hover { background: #dc2626; }

      @media (max-width: 360px) {
        #floating-findpeople-icon {
          width: 48px;
          height: 48px;
          bottom: 68px;
        }
        .findpeople-icon-svg {
          width: 24px;
          height: 24px;
        }
      }
      .path{
        COLOR: #2C3E50;
      }
    `;
    document.head.appendChild(style);

    const html = `
      <button id="floating-findpeople-icon" aria-label="Find People">
        <svg class="findpeople-icon-svg" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <circle cx="12" cy="7" r="4" stroke="currentColor" stroke-width="2.2" fill="none"/>
          <path d="M4 21c0-5 4-9 8-9s8 4 8 9" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>
        </svg>
        <span id="notification-badge" class="badge"></span>
      </button>

      <div id="people-search-panel">
        <div class="people-header">
          <div class="people-title">Find People</div>
          <button class="people-close" id="people-close-btn" aria-label="Close">
            <svg viewBox="0 0 24 24"><path d="M18 6L6 18M6 6l12 12" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/></svg>
          </button>
        </div>

        <div class="share-row">
          <span>Share my location</span>
          <label class="share-toggle">
            <input type="checkbox" id="share-toggle"/>
            <span class="share-slider"></span>
          </label>
        </div>

        <div id="requests-section" style="display: none;">
          <div class="requests-title">Incoming Connection Requests</div>
          <div id="requests-list"></div>
        </div>

        <div class="people-list" id="people-list">
          <div class="empty-state">
            <svg class="empty-icon" viewBox="0 0 24 24">
              <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
            </svg>
            Tap the button to see who is sharing their location
          </div>
        </div>
      </div>
    `;

    this._overlay.insertAdjacentHTML("beforeend", html);

    this._findPeopleIcon = this._overlay.querySelector("#floating-findpeople-icon");
    this._peoplePanel = this._overlay.querySelector("#people-search-panel");
    this._peopleList = this._overlay.querySelector("#people-list");
    this._peopleCloseBtn = this._overlay.querySelector("#people-close-btn");

    this._findPeopleIcon?.addEventListener("click", () => this._togglePanel(true));
    this._peopleCloseBtn?.addEventListener("click", () => this._togglePanel(false));
  }

  private async _togglePanel(show: boolean): Promise<void> {
    if (!this._peoplePanel || !this._findPeopleIcon) return;

    if (show) {
      this._peoplePanel.classList.add("active");
      this._findPeopleIcon.style.opacity = "0.3";
      this._findPeopleIcon.style.pointerEvents = "none";

      await this._loadPeople();
      await this._checkRequests();
    } else {
      this._peoplePanel.classList.remove("active");
      this._findPeopleIcon.style.opacity = "1";
      this._findPeopleIcon.style.pointerEvents = "auto";
    }

    if (show) {
      const outsideClickHandler = (e: MouseEvent) => {
        const target = e.target as HTMLElement;
        if (
          this._peoplePanel &&
          !this._peoplePanel.contains(target) &&
          this._findPeopleIcon &&
          !this._findPeopleIcon.contains(target)
        ) {
          this._togglePanel(false);
          document.removeEventListener("click", outsideClickHandler);
        }
      };
      setTimeout(() => document.addEventListener("click", outsideClickHandler), 100);
    }
  }

  private async _loadPeople(): Promise<void> {
    if (!this._peopleList) return;

    const toggle = document.getElementById("share-toggle") as HTMLInputElement;
    if (!toggle?.checked) {
      this._peopleList.innerHTML = `
      <div class="empty-state">
        <svg class="empty-icon" viewBox="0 0 24 24">
          <path d="M12 15v2m0 0v2m0-2h-2m2 0h2M3 21h18M5 3h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2z"/>
        </svg>
        Please turn on share to connect
      </div>
    `;
      this.previousPeople.clear();
      return;
    }

    try {
      const nodesRes = await fetch(this.ORDS_URL);
      if (!nodesRes.ok) throw new Error("Failed to load nodes");
      const nodesData = await nodesRes.json();

      if (!nodesData.items || nodesData.items.length === 0) {
        this._peopleList.innerHTML = `
        <div class="empty-state">
          <svg class="empty-icon" viewBox="0 0 24 24">
            <path d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-4a2 2 0 00-2 2v2a2 2 0 002 2h4a2 2 0 002-2v-2a2 2 0 00-2-2z"/>
          </svg>
          No data available
        </div>
      `;
        this.previousPeople.clear();
        return;
      }

      const requestsRes = await fetch(this.REQUESTS_GET_URL);
      let pendingSentTo = new Set<string>();

      if (requestsRes.ok) {
        const requestsData = await requestsRes.json();
        const currentUserEmail = (window as any).APP_USER?.email?.toLowerCase()?.trim();

        if (currentUserEmail) {
          (requestsData.items || []).forEach((req: any) => {
            if (
              req.from_email?.toLowerCase()?.trim() === currentUserEmail &&
              req.status?.toUpperCase() === "PENDING"
            ) {
              pendingSentTo.add(req.to_email?.toLowerCase()?.trim());
            }
          });
        }
      }

      const myEmail = (window as any).APP_USER?.email?.toLowerCase()?.trim() ?? "";

      const me = nodesData.items.find((i: any) => i.created_by?.toLowerCase()?.trim() === myEmail);
      this._initShareToggle(me?.share_enabled ?? "N");

      const shared = nodesData.items.filter((i: any) => i.share_enabled === "Y");

      const newPeopleMap = new Map<string, Person>();

      shared.forEach((i: any) => {
        const email = i.created_by?.toLowerCase()?.trim();
        if (!email || email === myEmail) return;

        const current = newPeopleMap.get(email);
        if (!current || Number(i.id) > current.latestId) {
          newPeopleMap.set(email, {
            name: i.node_name?.trim() || email.split("@")[0],
            email,
            latestId: Number(i.id),
            position: [Number(i.pos_x ?? 0), Number(i.pos_y ?? 0), Number(i.pos_z ?? 0)],
            floor: Number(i.floor_no ?? 0),
            lastSeen: i.created_at ? new Date(i.created_at).toLocaleString() : undefined,
          });
        }
      });

      if (!this._peoplePanel?.classList.contains("active")) {
        this.previousPeople = newPeopleMap;
        return;
      }

      this._peopleList.innerHTML = "";

      if (newPeopleMap.size === 0) {
        this._peopleList.innerHTML = `
        <div class="empty-state">
          <svg class="empty-icon" viewBox="0 0 24 24">
            <path d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/>
            <path d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/>
          </svg>
          No one is sharing location
        </div>
      `;
      } else {
        const sortedPeople = [...newPeopleMap.values()].sort((a, b) =>
          a.name.localeCompare(b.name)
        );

        sortedPeople.forEach((person) => {
          const isPending = pendingSentTo.has(person.email);
          const isConnected = this.connectedEmails.has(person.email);

          const card = this._createPersonCard(person, isPending, isConnected);
          this._peopleList!.appendChild(card);
        });
      }

      this.previousPeople = newPeopleMap;

    } catch (err) {
      console.error("Failed to load people:", err);
      this._peopleList.innerHTML = `
      <div class="empty-state" style="color:#ff6b6b;">
        <svg class="empty-icon" viewBox="0 0 24 24" style="stroke:#2c3e50;">
          <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
        </svg>
        Failed to load people<br/>
        <small>Check connection or try again later</small>
      </div>
    `;
      this.previousPeople.clear();
    }
  }

  private _createPersonCard(person: Person, isPending: boolean, isConnected: boolean): HTMLElement {
    const card = document.createElement("div");
    card.className = "person-card";
    card.setAttribute("data-email", person.email);
    card.style.opacity = (isPending || isConnected) ? "0.65" : "1";
    card.style.cursor = (isPending || isConnected) ? "default" : "pointer";

    card.innerHTML = `
      <div style="display: flex; align-items: center; justify-content: space-between; gap: 12px;">
        <div>
          <div class="person-name">${person.name}</div>
          <div class="person-email">${person.email}</div>
          // <div class="person-meta">
          //   Floor ${person.floor || "?"} • Last: ${person.lastSeen || "unknown"}
          // </div>
        </div>

        ${isConnected ? `
          <div style="
            font-size: 12px;
            color: #10b981;
            font-weight: 600;
            padding: 4px 12px;
            border-radius: 12px;
            white-space: nowrap;
            background: rgba(16,185,129,0.15);
            border: 1px solid rgba(16,185,129,0.3);
          ">
            Connected
          </div>
        ` : isPending ? `
          <div style="
            font-size: 12px;
            color: #d97706;
            font-weight: 600;
            padding: 4px 12px;
            border-radius: 12px;
            white-space: nowrap;
            background: rgba(217,119,6,0.15);
            border: 1px solid rgba(217,119,6,0.3);
          ">
            Request Pending
          </div>
        ` : ""}
      </div>
    `;

    if (!isPending && !isConnected) {
      card.addEventListener("click", async () => {
        card.innerHTML = `
          <div style="display: flex; align-items: center; justify-content: space-between; gap: 12px;">
            <div>
              <div class="person-name">${person.name}</div>
              <div class="person-email">${person.email}</div>
            </div>
            <div style="
              font-size: 12px;
              color: #d97706;
              font-weight: 600;
              padding: 4px 12px;
              border-radius: 12px;
              background: rgba(217,119,6,0.2);
            ">
              Loading...
            </div>
          </div>
        `;
        card.style.opacity = "0.65";
        card.style.cursor = "default";

        if (window.selectedUser) {
          window.selectedUser = undefined;
          this._clearSelectedGlobals();
        }

        await this._sendConnectionRequest(person.email);
        await this._loadPeople();
      });
    }

    return card;
  }

  private _updatePersonCard(card: HTMLElement, person: Person, isPending: boolean, isConnected: boolean): void {
    card.style.opacity = (isPending || isConnected) ? "0.65" : "1";
    card.style.cursor = (isPending || isConnected) ? "default" : "pointer";

    const nameEl = card.querySelector(".person-name");
    if (nameEl) nameEl.textContent = person.name;

    const emailEl = card.querySelector(".person-email");
    if (emailEl) emailEl.textContent = person.email;

    const metaEl = card.querySelector(".person-meta");
    if (metaEl) {
      metaEl.innerHTML = `Floor ${person.floor || "?"} • Last: ${person.lastSeen || "unknown"}`;
    }

    let badge = card.querySelector(".status-badge") as HTMLElement | null;

    let badgeText = "";
    let badgeColor = "";

    if (isConnected) {
      badgeText = "Connected";
      badgeColor = "#10b981";
    } else if (isPending) {
      badgeText = "Request Pending";
      badgeColor = "#d97706";
    }

    if (badgeText) {
      if (!badge) {
        badge = document.createElement("div");
        badge.className = "status-badge";
        badge.style.cssText = `
          font-size: 12px;
          font-weight: 600;
          padding: 4px 12px;
          border-radius: 12px;
          white-space: nowrap;
        `;
        card.querySelector("div[style*='display: flex']")?.appendChild(badge);
      }
      badge.textContent = badgeText;
      badge.style.color = badgeColor;
    } else if (badge) {
      badge.remove();
    }
  }

  private async _sendConnectionRequest(toEmail: string): Promise<void> {
    if (!(window as any).APP_USER?.email) {
      alert("You are not logged in.");
      return;
    }

    try {
      const res = await fetch(this.REQUEST_SEND_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          from_email: (window as any).APP_USER.email,
          to_email: toEmail
        })
      });

      if (res.ok) {
        alert(`Request sent to ${toEmail}`);
        this._showWaitingPopup(toEmail);
      } else {
        alert("Failed to send request.");
      }
    } catch (err) {
      alert("Network error.");
    }
  }

  private _showWaitingPopup(toEmail: string): void {
    const overlay = document.createElement("div");
    overlay.style.cssText = `
      position: fixed;
      inset: 0;
      background: rgba(0,0,0,0.65);
      backdrop-filter: blur(8px);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 3000;
    `;

    const popup = document.createElement("div");
    popup.style.cssText = `
      background: rgba(255,255,255,0.18);
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
      border: 1px solid rgba(255,255,255,0.25);
      border-radius: 20px;
      padding: 28px;
      width: 360px;
      max-width: 90%;
      text-align: center;
      box-shadow: 0 15px 50px rgba(0,0,0,0.5);
      color: #2c3e50;
    `;

    popup.innerHTML = `
      <svg style="width:64px;height:64px;margin-bottom:16px;fill:none;stroke:#2c3e50;stroke-width:2;stroke-linecap:round;">
        <path d="M20 6L9 17l-5-5"/>
      </svg>
      <h3 style="margin:0 0 12px;font-size:22px;">Request Sent</h3>
      <p style="margin:0 0 24px;font-size:15px;">
        Waiting for <strong>${toEmail}</strong> to accept your request.
      </p>
      <button style="
        padding: 12px 32px;
        background: rgba(255,255,255,0.25);
        color: #2c3e50;
        border: 1px solid rgba(255,255,255,0.4);
        border-radius: 12px;
        font-size: 16px;
        font-weight: 600;
        cursor: pointer;
        backdrop-filter: blur(8px);
      ">Close</button>
    `;

    popup.querySelector("button")!.onclick = () => overlay.remove();

    overlay.appendChild(popup);
    document.body.appendChild(overlay);
  }

  // ────────────────────────────────────────────────
  // The rest remains 100% unchanged — only UI was touched
  // ────────────────────────────────────────────────

  private async _checkRequests(): Promise<void> {
    if (!(window as any).APP_USER?.email) return;

    const myEmail = (window as any).APP_USER.email.toLowerCase().trim();

    try {
      const res = await fetch(this.REQUESTS_GET_URL);
      if (!res.ok) return;

      const data = await res.json();
      const allItems: any[] = data.items || [];

      const incomingPending = allItems.filter(
        (r: any) =>
          r.to_email?.toLowerCase()?.trim() === myEmail &&
          r.status?.toUpperCase() === "PENDING"
      );

      this.pendingRequests = incomingPending;
      this._updateBadge(incomingPending.length);

      if (this._peoplePanel?.classList.contains("active")) {
        this._renderRequests();
      }

      const outgoing = allItems.filter(
        (r: any) => r.from_email?.toLowerCase()?.trim() === myEmail
      );

      for (const req of outgoing) {
        const status = req.status?.toUpperCase();
        const reqId = Number(req.request_id);

        if (status === "ACCEPTED" && !this.handledAcceptedOutgoing.has(reqId)) {
          this.handledAcceptedOutgoing.add(reqId);

          const receiverEmail = req.to_email?.toLowerCase()?.trim() ?? "";
          const receiverName = req.to_user_name || receiverEmail.split("@")[0] || "Unknown";

          this.connectedEmails.add(receiverEmail);

          const nodesRes = await fetch(this.ORDS_URL);
          if (nodesRes.ok) {
            const nodesData = await nodesRes.json();
            const latestNode = (nodesData.items || [])
              .filter((n: any) => n.created_by?.toLowerCase()?.trim() === receiverEmail)
              .sort((a: any, b: any) => Number(b.id) - Number(a.id))[0];

            const x = latestNode ? Number(latestNode.pos_x ?? 0) : 0;
            const y = latestNode ? Number(latestNode.pos_y ?? 0) : 0;
            const z = latestNode ? Number(latestNode.pos_z ?? 0) : 0;

            window.selectedUser = {
              email: receiverEmail,
              name: receiverName,
              position: { x, y, z },
              floor: latestNode ? Number(latestNode.floor_no ?? 0) : undefined,
              lastSeen: latestNode?.created_at
                ? new Date(latestNode.created_at).toLocaleString()
                : undefined,
            };

            window.selectedX = x;
            window.selectedY = y;
            window.selectedZ = z;

            this._notifySelectedUserChanged();

            console.log("Outgoing accept → Globals set:", { x, y, z });
            this._showConnectedSuccessPopup(receiverName, receiverEmail);
          }
        } else if (status === "REJECTED" && !this.handledRejectedOutgoing.has(reqId)) {
          this.handledRejectedOutgoing.add(reqId);
          const receiverEmail = req.to_email?.toLowerCase()?.trim() ?? "";
          this.connectedEmails.delete(receiverEmail);
          this._showRejectedPopup(receiverEmail);
          this._clearSelectedGlobals();
        }
      }
    } catch (err) {
      console.error("Failed to check requests:", err);
    }
  }

  private async _respondRequest(requestId: string, status: "ACCEPTED" | "REJECTED"): Promise<void> {
    try {
      const res = await fetch(this.REQUEST_RESPOND_URL, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          request_id: Number(requestId),
          status: status
        })
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      console.log(`Request ${requestId} → ${status}`);

      if (status === "ACCEPTED") {
        const reqRes = await fetch(this.REQUESTS_GET_URL);
        if (reqRes.ok) {
          const reqData = await reqRes.json();
          const acceptedReq = (reqData.items || []).find((r: any) => r.request_id === Number(requestId));

          if (acceptedReq) {
            const senderEmail = acceptedReq.from_email?.toLowerCase()?.trim() ?? "";
            const senderName = acceptedReq.from_user_name || senderEmail.split("@")[0] || "Unknown";

            this.connectedEmails.add(senderEmail);

            const nodesRes = await fetch(this.ORDS_URL);
            if (nodesRes.ok) {
              const nodesData = await nodesRes.json();
              const latestNode = (nodesData.items || [])
                .filter((n: any) => n.created_by?.toLowerCase()?.trim() === senderEmail)
                .sort((a: any, b: any) => Number(b.id) - Number(a.id))[0];

              const x = latestNode ? Number(latestNode.pos_x ?? 0) : 0;
              const y = latestNode ? Number(latestNode.pos_y ?? 0) : 0;
              const z = latestNode ? Number(latestNode.pos_z ?? 0) : 0;

              window.selectedUser = {
                email: senderEmail,
                name: senderName,
                position: { x, y, z },
                floor: latestNode ? Number(latestNode.floor_no ?? 0) : undefined,
                lastSeen: latestNode?.created_at
                  ? new Date(latestNode.created_at).toLocaleString()
                  : undefined,
              };

              window.selectedX = x;
              window.selectedY = y;
              window.selectedZ = z;

              this._notifySelectedUserChanged();

              console.log("Incoming accept → Globals set:", { x, y, z });
              this._showConnectedSuccessPopup(senderName, senderEmail);
            }
          }
        }
      } else if (status === "REJECTED") {
        this._clearSelectedGlobals();
      }

      await this._checkRequests();
      await this._loadPeople();
    } catch (err) {
      console.error("Failed to respond:", err);
      alert("Failed to respond to request");
    }
  }

  private _showConnectedSuccessPopup(name: string, email: string): void {
    const user = window.selectedUser;
    const pos = user?.position;
    const floor = user?.floor;
    const lastSeen = user?.lastSeen;

    const positionText = pos
      ? `${pos.x.toFixed(3)}, ${pos.y.toFixed(3)}, ${pos.z.toFixed(3)}`
      : "unknown (no recent position)";

    const overlay = document.createElement("div");
    overlay.style.cssText = `
      position: fixed;
      inset: 0;
      background: rgba(0,0,0,0.7);
      backdrop-filter: blur(10px);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 5000;
    `;

    const popup = document.createElement("div");
    popup.style.cssText = `
      background: rgba(255,255,255,0.22);
      backdrop-filter: blur(24px);
      -webkit-backdrop-filter: blur(24px);
      border: 1px solid rgba(255,255,255,0.25);
      border-radius: 24px;
      padding: 36px;
      width: 400px;
      max-width: 92%;
      text-align: center;
      box-shadow: 0 20px 60px rgba(0,0,0,0.6);
      color: #2c3e50;
    `;

    popup.innerHTML = `
      <div style="font-size: 64px; margin-bottom: 20px;">🎉</div>
      <h2 style="margin: 0 0 20px; color: #10b981; font-size: 26px;">Connected Successfully!</h2>
      <p style="margin: 0 0 20px; font-size: 17px;">
        You are now connected to<br>
        <strong style="color: #2c3e50;">${name}</strong><br>
        <small style="color: rgba(255,255,255,0.7);">(${email})</small>
      </p>
      <p style="margin: 0 0 20px; font-size: 17px;">
        Position:<br>
        <strong style="color: #2c3e50;">${window.selectedX},${window.selectedY},${window.selectedZ}</strong>
      </p>
      <p style="margin: 0 0 24px; font-size: 15px; line-height: 1.6; color: rgba(255,255,255,0.85);">
        Latest known position:<br>
        <strong>${positionText}</strong><br>
        Floor: <strong>${floor ?? "?"}</strong> • Last seen: <strong>${lastSeen ?? "just now"}</strong>
      </p>
      <button style="
        padding: 14px 48px;
        background: rgba(16,185,129,0.9);
        color: #2c3e50;
        border: none;
        border-radius: 14px;
        font-size: 17px;
        font-weight: 600;
        cursor: pointer;
        box-shadow: 0 4px 20px rgba(16,185,129,0.4);
      ">OK</button>
    `;

    const okBtn = popup.querySelector("button")!;
    okBtn.onclick = () => overlay.remove();

    overlay.appendChild(popup);
    document.body.appendChild(overlay);

    setTimeout(() => {
      if (overlay.parentNode) overlay.remove();
    }, 8000);
  }

  private _showRejectedPopup(email: string): void {
    const overlay = document.createElement("div");
    overlay.style.cssText = `
      position: fixed;
      inset: 0;
      background: rgba(0,0,0,0.7);
      backdrop-filter: blur(10px);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 5000;
    `;

    const popup = document.createElement("div");
    popup.style.cssText = `
      background: rgba(255,255,255,0.22);
      backdrop-filter: blur(24px);
      -webkit-backdrop-filter: blur(24px);
      border: 1px solid rgba(239,68,68,0.4);
      border-radius: 24px;
      padding: 36px;
      width: 400px;
      max-width: 92%;
      text-align: center;
      box-shadow: 0 20px 60px rgba(0,0,0,0.6);
      color: #2c3e50;
    `;

    popup.innerHTML = `
      <div style="font-size: 64px; margin-bottom: 20px;">❌</div>
      <h2 style="margin: 0 0 20px; color: #ef4444; font-size: 26px;">Request Rejected</h2>
      <p style="margin: 0 0 28px; font-size: 17px;">
        Your connection request to<br>
        <strong style="color: #2c3e50;">${email}</strong><br>
        was rejected.
      </p>
      <button style="
        padding: 14px 48px;
        background: rgba(239,68,68,0.9);
        color: #2c3e50;
        border: none;
        border-radius: 14px;
        font-size: 17px;
        font-weight: 600;
        cursor: pointer;
        box-shadow: 0 4px 20px rgba(239,68,68,0.4);
      ">OK</button>
    `;

    const okBtn = popup.querySelector("button")!;
    okBtn.onclick = () => overlay.remove();

    overlay.appendChild(popup);
    document.body.appendChild(overlay);

    setTimeout(() => {
      if (overlay.parentNode) overlay.remove();
    }, 4000);

    this._clearSelectedGlobals();
  }

  private _updateBadge(count: number): void {
    const badge = this._overlay?.querySelector("#notification-badge") as HTMLElement | null;
    if (!badge) return;

    badge.textContent = count > 9 ? "9+" : count.toString();
    badge.style.display = count > 0 ? "flex" : "none";
  }

  private _renderRequests(): void {
    const section = this._overlay?.querySelector("#requests-section") as HTMLElement | null;
    const list = this._overlay?.querySelector("#requests-list") as HTMLElement | null;
    if (!section || !list) return;

    if (this.pendingRequests.length === 0) {
      section.style.display = "none";
      return;
    }

    section.style.display = "block";
    list.innerHTML = "";

    this.pendingRequests.forEach((req: any) => {
      const div = document.createElement("div");
      div.className = "request-card";
      div.innerHTML = `
        <div class="request-from"><strong>${req.from_email}</strong> wants to connect with you.</div>
        <div class="request-buttons">
          <button class="accept-btn" data-id="${req.request_id}">Accept</button>
          <button class="reject-btn" data-id="${req.request_id}">Reject</button>
        </div>
      `;

      div.querySelector(".accept-btn")?.addEventListener("click", () => {
        this._respondRequest(req.request_id.toString(), "ACCEPTED");
      });

      div.querySelector(".reject-btn")?.addEventListener("click", () => {
        this._respondRequest(req.request_id.toString(), "REJECTED");
      });

      list.appendChild(div);
    });
  }

  private _initShareToggle(value: "Y" | "N"): void {
    const toggle = document.getElementById("share-toggle") as HTMLInputElement;
    if (!toggle || !(window as any).APP_USER?.email) return;

    toggle.checked = value === "Y";
    let originalChecked = toggle.checked;

    toggle.onchange = async () => {
      const newChecked = toggle.checked;

      try {
        const response = await fetch(this.SHARE_UPDATE_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: (window as any).APP_USER.email,
            share_enabled: newChecked ? "Y" : "N",
          }),
        });

        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        originalChecked = newChecked;

        if (this._peoplePanel?.classList.contains("active")) {
          this._loadPeople();
        }
      } catch (err) {
        console.error("Failed to update share status:", err);
        toggle.checked = originalChecked;
        alert("Failed to update location sharing. Please try again.");
      }
    };
  }

  dispose() {
    if (this.pollRequestsIntervalId) clearInterval(this.pollRequestsIntervalId);
    if (this.pollPeopleIntervalId) clearInterval(this.pollPeopleIntervalId);
    if (this.pollSelectedPositionId) clearInterval(this.pollSelectedPositionId);
    return super.dispose();
  }
}