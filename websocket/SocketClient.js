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

import EventEmitter from "events";
import { createFrame } from "./FrameParser.js";
import Config from "../core/config.js";

class SocketClient extends EventEmitter {
    constructor(socket, server) {
        super();
        this.socket = socket;
        this.server = server;
        this.buffer = Buffer.alloc(0);

        this.socket.on("data", (data) => this._handleData(data));
        this.socket.on("close", () => {
            this.server._removeClient(this);
            this.emit("disconnect");
        });
        this.socket.on("error", (err) => {
            this.emit("error", err);
            this.socket.destroy();
        });
    }

    _handleData(data) {
        const maxPayloadMb = parseFloat(Config.get("MAX_WS_PAYLOAD_MB")) || 10;
        const maxPayloadBytes = maxPayloadMb * 1024 * 1024;

        if (this.buffer.length + data.length > maxPayloadBytes) {
            console.error("❌ WebSocket Error: Buffer length exceeds maximum payload size.");
            this.socket.destroy();
            return;
        }

        this.buffer = Buffer.concat([this.buffer, data]);

        while (this.buffer.length >= 2) {
            const byte1 = this.buffer[0];
            const byte2 = this.buffer[1];

            const fin = (byte1 & 0x80) === 0x80;
            const opcode = byte1 & 0x0f;
            const isMasked = (byte2 & 0x80) === 0x80;
            let payloadLen = byte2 & 0x7f;

            let headerLen = 2;
            if (payloadLen === 126) {
                if (this.buffer.length < 4) return;
                payloadLen = this.buffer.readUInt16BE(2);
                headerLen += 2;
            } else if (payloadLen === 127) {
                if (this.buffer.length < 10) return;
                const high = this.buffer.readUInt32BE(2);
                const low = this.buffer.readUInt32BE(6);
                payloadLen = (high * 0x100000000) + low;
                headerLen += 8;
            }

            if (payloadLen > maxPayloadBytes) {
                console.error("❌ WebSocket Error: Declared frame payload length exceeds limit.");
                this.socket.destroy();
                return;
            }

            let maskingKey = null;
            if (isMasked) {
                if (this.buffer.length < headerLen + 4) return;
                maskingKey = this.buffer.slice(headerLen, headerLen + 4);
                headerLen += 4;
            }

            if (this.buffer.length < headerLen + payloadLen) return;

            const payload = this.buffer.slice(headerLen, headerLen + payloadLen);
            this.buffer = this.buffer.slice(headerLen + payloadLen);

            if (isMasked && maskingKey) {
                for (let i = 0; i < payload.length; i++) {
                    payload[i] ^= maskingKey[i % 4];
                }
            }

            this._handleFrame(opcode, payload);
        }
    }

    _handleFrame(opcode, payload) {
        switch (opcode) {
            case 0x1:
                const text = payload.toString('utf8');
                let parsed = text;
                try {
                    parsed = JSON.parse(text);
                } catch (e) {}
                this.emit("message", parsed);
                break;
            case 0x8:
                this.socket.end();
                break;
            case 0x9:
                this._sendFrame(0xA, payload);
                break;
            default:
                break;
        }
    }

    _sendFrame(opcode, payload) {
        if (!this.socket.writable) return;
        const frameBuffer = createFrame(opcode, payload);
        this.socket.write(frameBuffer);
    }

    send(data) {
        this._sendFrame(0x1, data);
    }

    broadcast(data) {
        this.server.broadcast(data, this);
    }
}

export default SocketClient;
