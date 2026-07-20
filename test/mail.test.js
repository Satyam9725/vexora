import assert from "assert";
import net from "node:net";
import Vexora from "../Vexora.js";

export async function run() {
    console.log("👉 Running SMTP Mailer Tests...");

    // Start a mock SMTP server locally on a random port
    const mockSmtpServer = net.createServer((socket) => {
        socket.write("220 mock.smtp.server Vexora Mailer Greeting\r\n");

        socket.on("data", (data) => {
            const lines = data.toString().split("\r\n").filter(Boolean);
            for (const line of lines) {
                if (line.startsWith("EHLO")) {
                    socket.write("250-mock.smtp.server Hello, client.com\r\n");
                    socket.write("250-AUTH LOGIN\r\n");
                    socket.write("250 HELP\r\n");
                } else if (line === "AUTH LOGIN") {
                    socket.write("334 VXNlcm5hbWU6\r\n"); // Base64 "Username:"
                } else if (line === Buffer.from("testuser").toString("base64")) {
                    socket.write("334 UGFzc3dvcmQ6\r\n"); // Base64 "Password:"
                } else if (line === Buffer.from("testpass").toString("base64")) {
                    socket.write("235 Authentication successful\r\n");
                } else if (line.startsWith("MAIL FROM:")) {
                    socket.write("250 Sender OK\r\n");
                } else if (line.startsWith("RCPT TO:")) {
                    socket.write("250 Recipient OK\r\n");
                } else if (line === "DATA") {
                    socket.write("354 Start mail input; end with <CRLF>.<CRLF>\r\n");
                } else if (line === ".") {
                    socket.write("250 Message accepted for delivery\r\n");
                } else if (line === "QUIT") {
                    socket.write("221 Closing connection\r\n");
                    socket.end();
                }
            }
        });
    });

    const port = await new Promise((resolve) => {
        mockSmtpServer.listen(0, "127.0.0.1", () => {
            resolve(mockSmtpServer.address().port);
        });
    });

    try {
        // Test sending mail using Vexora.mail (MailSender)
        const result = await Vexora.mail.send({
            host: "127.0.0.1",
            port: port,
            secure: false, // Port 465 is not used
            user: "testuser",
            pass: "testpass",
            from: "sender@example.com",
            to: "receiver@example.com",
            subject: "Test Mock Mail",
            text: "Hello from mock SMTP test",
            html: "<b>Hello from mock SMTP test</b>"
        });

        assert.ok(result.success, "Mailer should return success true");
        assert.strictEqual(result.message, "Email sent successfully", "Success message should match");
        assert.ok(result.log.some(l => l.includes("235 Authentication successful")), "Log should confirm successful login");
        assert.ok(result.log.some(l => l.includes("250 Message accepted for delivery")), "Log should confirm message delivery confirmation");

    } finally {
        mockSmtpServer.close();
    }

    console.log("✅ SMTP Mailer Tests Passed.\n");
}
