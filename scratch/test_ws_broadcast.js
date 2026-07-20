import assert from "assert";
import EventEmitter from "events";
import initWebSocket from "../websocket/WebSocketServer.js";
import SocketClient from "../websocket/SocketClient.js";

class MockSocket extends EventEmitter {
    constructor() {
        super();
        this.writable = true;
        this.written = [];
    }
    write(data) {
        this.written.push(data);
    }
    destroy() {
        this.writable = false;
        this.emit("close");
    }
}

async function testBroadcast() {
    const mockServer = new EventEmitter();
    const wss = initWebSocket(mockServer);

    const socket1 = new MockSocket();
    const socket2 = new MockSocket();
    const socket3 = new MockSocket();

    // Trigger upgrades
    mockServer.emit("upgrade", { headers: { upgrade: "websocket", "sec-websocket-key": "dGhlIHNhbXBsZSBub25jZQ==" } }, socket1, Buffer.alloc(0));
    mockServer.emit("upgrade", { headers: { upgrade: "websocket", "sec-websocket-key": "dGhlIHNhbXBsZSBub25jZQ==" } }, socket2, Buffer.alloc(0));
    mockServer.emit("upgrade", { headers: { upgrade: "websocket", "sec-websocket-key": "dGhlIHNhbXBsZSBub25jZQ==" } }, socket3, Buffer.alloc(0));

    assert.strictEqual(wss.clients.size, 3, "Should have 3 connected clients");

    // Fetch clients
    const clients = Array.from(wss.clients);
    const client1 = clients[0];
    const client2 = clients[1];
    const client3 = clients[2];

    // Clear initial handshake write buffers
    socket1.written = [];
    socket2.written = [];
    socket3.written = [];

    // Test client1 broadcasting to others
    client1.broadcast("Hello room!");

    assert.strictEqual(socket1.written.length, 0, "Sender should not receive the broadcast");
    assert.ok(socket2.written.length > 0, "Client 2 should receive the broadcast");
    assert.ok(socket3.written.length > 0, "Client 3 should receive the broadcast");

    console.log("✅ WebSocket Broadcast test passed!");
    process.exit(0);
}

testBroadcast().catch(console.error);
