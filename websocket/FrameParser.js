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

export function createFrame(opcode, payload) {
    let payloadBuffer;
    if (typeof payload === "string") {
        payloadBuffer = Buffer.from(payload, "utf8");
    } else if (Buffer.isBuffer(payload)) {
        payloadBuffer = payload;
    } else {
        payloadBuffer = Buffer.from(JSON.stringify(payload), "utf8");
    }

    const len = payloadBuffer.length;
    let header;

    if (len < 126) {
        header = Buffer.alloc(2);
        header[0] = 0x80 | opcode;
        header[1] = len;
    } else if (len <= 65535) {
        header = Buffer.alloc(4);
        header[0] = 0x80 | opcode;
        header[1] = 126;
        header.writeUInt16BE(len, 2);
    } else {
        header = Buffer.alloc(10);
        header[0] = 0x80 | opcode;
        header[1] = 127;
        const high = Math.floor(len / 0x100000000);
        const low = len % 0x100000000;
        header.writeUInt32BE(high, 2);
        header.writeUInt32BE(low, 6);
    }

    return Buffer.concat([header, payloadBuffer]);
}
