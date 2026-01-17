export type PositionUpdate = {
    email: string;
    position: { x: number; y: number; z: number };
    floor: number;
    timestamp: string;
};

declare global {
    interface Window {
        APP_USER?: {
            name: string;
            email: string;
        };
    }
}

type MessageHandler = (data: any) => void;

export class WebSocketClient {
    private static instance: WebSocketClient;
    private ws: WebSocket | null = null;
    private handlers: Map<string, Set<MessageHandler>> = new Map();
    private reconnectInterval: number = 3000;
    private isConnected: boolean = false;

    private constructor() {
        this.connect();
    }

    public static getInstance(): WebSocketClient {
        if (!WebSocketClient.instance) {
            WebSocketClient.instance = new WebSocketClient();
        }
        return WebSocketClient.instance;
    }

    public get connected(): boolean {
        return this.isConnected;
    }

    private connect(): void {
        console.log("Connecting to WebSocket...");
        this.ws = new WebSocket('ws://localhost:8080');

        this.ws.onopen = () => {
            console.log("WebSocket Connected");
            this.isConnected = true;
            this.dispatch({ type: 'connect' });
            this.registerUser(); // Re-register if we were already logged in
        };

        this.ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                this.dispatch(data);
            } catch (err) {
                console.error("Failed to parse WS message", err);
            }
        };

        this.ws.onclose = () => {
            console.log("WebSocket disconnected, retrying...");
            this.isConnected = false;
            this.dispatch({ type: 'disconnect' });
            setTimeout(() => this.connect(), this.reconnectInterval);
        };

        this.ws.onerror = (err) => {
            console.error("WebSocket error:", err);
            this.ws?.close();
        };
    }

    public registerUser(): void {
        const email = window.APP_USER?.email;
        if (this.ws && this.ws.readyState === WebSocket.OPEN && email) {
            this.ws.send(JSON.stringify({
                type: 'register',
                email: email
            }));
        }
    }

    public sendLocationUpdate(position: { x: number; y: number; z: number }, floor: number = 1): void {
        const email = window.APP_USER?.email;
        const name = window.APP_USER?.name;

        if (this.ws && this.ws.readyState === WebSocket.OPEN && email) {
            this.ws.send(JSON.stringify({
                type: 'update_location',
                email,
                name,
                position,
                floor
            }));
        }
    }

    public on(type: string, handler: MessageHandler): void {
        if (!this.handlers.has(type)) {
            this.handlers.set(type, new Set());
        }
        this.handlers.get(type)?.add(handler);
    }

    public off(type: string, handler: MessageHandler): void {
        this.handlers.get(type)?.delete(handler);
    }

    private dispatch(data: any): void {
        const type = data.type;
        if (this.handlers.has(type)) {
            this.handlers.get(type)?.forEach(handler => handler(data));
        }
    }
}
