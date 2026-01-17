const WebSocket = require('ws');
const fetch = require('node-fetch');

const wss = new WebSocket.Server({ port: process.env.PORT || 8080 });

// Store connected clients: Map<email, WebSocket>
const clients = new Map();

// ORDS Endpoint
const ORDS_URL = "https://g3cb3b1c0924a5d-rho2ag4cklj4nhpl.adb.ap-hyderabad-1.oraclecloudapps.com/ords/ng/ar/nodes";

const PORT = process.env.PORT || 8080;
console.log(`WebSocket server started on port ${PORT}`);

wss.on('connection', (ws) => {
    console.log('New client connected');
    let userEmail = null;

    ws.on('message', async (message) => {
        try {
            const data = JSON.parse(message);

            // Handle different message types
            switch (data.type) {
                case 'register':
                    if (data.email) {
                        userEmail = data.email.toLowerCase().trim();
                        clients.set(userEmail, ws);
                        console.log(`Registered user: ${userEmail}`);
                    }
                    break;

                case 'update_location':
                    if (userEmail) {
                        // Broadcast to all other connected clients
                        const updateMsg = JSON.stringify({
                            type: 'position_update',
                            email: userEmail,
                            position: data.position,
                            floor: data.floor,
                            timestamp: new Date().toISOString()
                        });

                        wss.clients.forEach((client) => {
                            if (client !== ws && client.readyState === WebSocket.OPEN) {
                                client.send(updateMsg);
                            }
                        });

                        // Persist to ORDS (fire and forget, or handle error if critical)
                        postToORDS(data, userEmail).catch(err => console.error("ORDS Error:", err));
                    }
                    break;

                case 'ping':
                    ws.send(JSON.stringify({ type: 'pong' }));
                    break;
            }
        } catch (error) {
            console.error('Error processing message:', error);
        }
    });

    ws.on('close', () => {
        if (userEmail) {
            clients.delete(userEmail);
            console.log(`User disconnected: ${userEmail}`);
        }
    });
});

async function postToORDS(data, email) {
    const payload = {
        node_name: data.name || email.split('@')[0],
        floor_no: data.floor || 1,
        pos_x: Number(data.position.x),
        pos_y: Number(data.position.y),
        pos_z: Number(data.position.z),
        static_ids: "AR_SESSION",
        created_by: email
    };

    const response = await fetch(ORDS_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
    });

    if (!response.ok) {
        throw new Error(`Failed to post to ORDS: ${response.statusText}`);
    }
}
