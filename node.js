// server.js
const WebSocket = require('ws');
const wss = new WebSocket.Server({ port: 8080 });

const sessions = new Map();

wss.on('connection', (ws) => {
    ws.on('message', (message) => {
        const data = JSON.parse(message);
        
        switch (data.type) {
            case 'register':
                handleRegistration(ws, data);
                break;
            case 'offer':
            case 'answer':
            case 'ice-candidate':
                forwardMessage(data);
                break;
        }
    });
    
    ws.on('close', () => {
        handleDisconnection(ws);
    });
});

function handleRegistration(ws, data) {
    const { sessionId, isHost } = data;
    
    if (!sessions.has(sessionId)) {
        sessions.set(sessionId, { host: null, client: null });
    }
    
    const session = sessions.get(sessionId);
    
    if (isHost && !session.host) {
        session.host = ws;
        ws.sessionId = sessionId;
        ws.isHost = true;
        
        if (session.client) {
            notifyPeerConnected(session.client);
            notifyPeerConnected(ws);
        }
    } else if (!isHost && !session.client) {
        session.client = ws;
        ws.sessionId = sessionId;
        ws.isHost = false;
        
        if (session.host) {
            notifyPeerConnected(session.host);
            notifyPeerConnected(ws);
        }
    }
}

function forwardMessage(data) {
    const session = sessions.get(data.sessionId);
    if (!session) return;
    
    const target = data.type === 'offer' ? session.client : session.host;
    if (target && target.readyState === WebSocket.OPEN) {
        target.send(JSON.stringify(data));
    }
}

function notifyPeerConnected(ws) {
    ws.send(JSON.stringify({ type: 'peer-connected' }));
}

function handleDisconnection(ws) {
    if (!ws.sessionId) return;
    
    const session = sessions.get(ws.sessionId);
    if (!session) return;
    
    const peer = ws.isHost ? session.client : session.host;
    if (peer) {
        peer.send(JSON.stringify({ type: 'peer-disconnected' }));
    }
    
    if (ws.isHost) {
        session.host = null;
    } else {
        session.client = null;
    }
    
    if (!session.host && !session.client) {
        sessions.delete(ws.sessionId);
    }
}