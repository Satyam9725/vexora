/**
 * ==========================================================
 * Nyvora Framework
 * ==========================================================
 *
 * @author      Satyam Kumar
 * @email       satyam.ku9725@gmail.com
 * @phone       +91 9725399936
 * @github      https://github.com/Satyam9725
 *
 * @copyright   Copyright (c) 2026 Satyam Kumar
 * @license     MIT
 *
 * ==========================================================
 */

import crypto from "crypto";
import EventEmitter from "events";
import SocketClient from "./SocketClient.js";
import Config from "../core/config.js";

const WS_MAGIC_STRING = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11";

class WebSocketServer extends EventEmitter {
    constructor(server) {
        super();
        this.clients = new Set();
        
        // Start heartbeat interval to clean up dead connections (Configurable, default 30s)
        const heartbeatInterval = parseInt(Config.get("WS_HEARTBEAT_INTERVAL")) || 30000;
        this.pingInterval = setInterval(() => {
            for (const client of this.clients) {
                if (client.isAlive === false) {
                    client.socket.destroy();
                    this.clients.delete(client);
                    continue;
                }
                client.isAlive = false;
                client.ping();
            }
        }, heartbeatInterval);

        server.on("upgrade", (req, socket, head) => {
            this._handleUpgrade(req, socket, head);
        });
        
        server.on("close", () => {
            clearInterval(this.pingInterval);
        });
    }

    _handleUpgrade(req, socket, head) {
        const upgradeHeader = (req.headers["upgrade"] || "").toLowerCase();
        if (upgradeHeader !== "websocket") {
            socket.end("HTTP/1.1 400 Bad Request\r\n\r\n");
            return;
        }

        // Security: WebSocket Origin Validation (CSWSH Prevention)
        const origin = req.headers["origin"];
        const allowedOriginsStr = Config.get("CORS_ORIGINS") || "";
        if (allowedOriginsStr) {
            const allowedOrigins = allowedOriginsStr.split(',').map(s => s.trim());
            if (origin && !allowedOrigins.includes(origin)) {
                socket.end("HTTP/1.1 403 Forbidden\r\n\r\n");
                return;
            }
        }

        const clientKey = req.headers["sec-websocket-key"];
        if (!clientKey) {
            socket.end("HTTP/1.1 400 Bad Request\r\n\r\n");
            return;
        }

        const hash = crypto.createHash("sha1").update(clientKey + WS_MAGIC_STRING).digest("base64");
        
        const responseHeaders = [
            "HTTP/1.1 101 Switching Protocols",
            "Upgrade: websocket",
            "Connection: Upgrade",
            `Sec-WebSocket-Accept: ${hash}`
        ];

        socket.write(responseHeaders.join("\r\n") + "\r\n\r\n");

        // Disable Nagle's algorithm for faster real-time message delivery
        socket.setNoDelay(true);
        socket.setKeepAlive(true, 10000);

        const client = new SocketClient(socket, this);
        this.clients.add(client);

        this.emit("connection", client, req);

        // Feed any initial data that Node's HTTP parser already read from the socket (first WebSocket frame)
        if (head && head.length > 0) {
            client._handleData(head);
        }
    }

    _removeClient(client) {
        this.clients.delete(client);
    }

    broadcast(data, excludeClient = null) {
        for (const client of this.clients) {
            if (client !== excludeClient) {
                client.send(data);
            }
        }
    }
}

export default function initWebSocket(server) {
    return new WebSocketServer(server);
}
