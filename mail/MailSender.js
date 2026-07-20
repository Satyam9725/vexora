"use strict";

/**
 * ==========================================================
 * Vexora Framework - Native Zero-Dependency SMTP Mail Client
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

import net from "node:net";
import tls from "node:tls";
import Config from "../core/config.js";

class MailSender {
  /**
   * Send an email via SMTP natively using TCP / TLS sockets.
   * 
   * @param {Object} options Configuration & payload options
   * @returns {Promise<Object>} Verification results and logs
   */
  static async send(options = {}) {
    const host = options.host || Config.get("SMTP_HOST");
    const port = parseInt(options.port || Config.get("SMTP_PORT")) || 465;
    
    const secureVal = String(Config.get("SMTP_SECURE") || "").toLowerCase().trim();
    const isSecureDefault = secureVal === "true" || secureVal === "ssl" || secureVal === "tls" || port === 465;
    const secure = options.secure !== undefined ? options.secure : isSecureDefault;
    
    const user = options.user || Config.get("SMTP_USER");
    const pass = options.pass || Config.get("SMTP_PASS");
    
    let defaultFrom = Config.get("SMTP_FROM");
    if (!defaultFrom) {
      const fromName = Config.get("SMTP_FROM_NAME") || Config.get("FROM_NAME");
      const fromEmail = Config.get("SMTP_FROM_EMAIL") || Config.get("FROM_EMAIL") || user;
      if (fromName && fromEmail) {
        defaultFrom = `${fromName} <${fromEmail}>`;
      } else {
        defaultFrom = fromEmail || user;
      }
    }
    const from = options.from || defaultFrom || user;
    
    const to = options.to;
    const subject = options.subject || "";
    const html = options.html || "";
    const text = options.text || "";

    if (!host) {
      throw new Error("SMTP host configuration ('SMTP_HOST') is required");
    }

    if (!to) {
      throw new Error("Recipient ('to') address is required");
    }

    return new Promise((resolve, reject) => {
      let socket;
      let responseLog = [];
      let currentStep = 0; // State Machine step count
      let secureUpgrade = false;

      const sendLine = (line) => {
        socket.write(line + "\r\n");
      };

      const cleanupAndReject = (err) => {
        if (socket) {
          try { socket.destroy(); } catch {}
        }
        reject(err);
      };

      // Connect using TLS directly if secure and port 465, or net for plain/STARTTLS
      if (secure && port === 465) {
        socket = tls.connect({ host, port, rejectUnauthorized: false }, onConnect);
      } else {
        socket = net.connect({ host, port }, onConnect);
      }

      socket.setEncoding("utf8");

      function onConnect() {
        // TCP/TLS handshake finished, waiting for Greeting 220
      }

      socket.on("error", (err) => {
        cleanupAndReject(new Error(`SMTP Connection Error: ${err.message}`));
      });

      socket.on("data", (data) => {
        const lines = data.split("\r\n").filter(Boolean);
        for (const line of lines) {
          const code = parseInt(line.substring(0, 3));
          const isLastLine = line.charAt(3) !== "-";
          
          if (isLastLine) {
            handleSmtpResponse(code, line);
          }
        }
      });

      function handleSmtpResponse(code, responseText) {
        responseLog.push(responseText);

        // State Machine to process standard SMTP commands flow
        if (currentStep === 0) {
          // Greeting step: Expect 220
          if (code === 220) {
            currentStep = 1;
            sendLine(`EHLO ${host}`);
          } else {
            cleanupAndReject(new Error(`Greeting failed: ${responseText}`));
          }
        } else if (currentStep === 1) {
          // EHLO response: Expect 250
          if (code === 250) {
            // Check if STARTTLS is needed (port 587/25 secure)
            if (secure && port !== 465 && !secureUpgrade) {
              currentStep = 1.5;
              sendLine("STARTTLS");
            } else if (user && pass) {
              currentStep = 2;
              sendLine("AUTH LOGIN");
            } else {
              currentStep = 4;
              sendLine(`MAIL FROM:<${extractEmail(from)}>`);
            }
          } else {
            cleanupAndReject(new Error(`EHLO handshake failed: ${responseText}`));
          }
        } else if (currentStep === 1.5) {
          // STARTTLS upgrade: Expect 220
          if (code === 220) {
            secureUpgrade = true;
            // Upgrade existing socket connection to TLS
            const secureSocket = tls.connect({
              socket: socket,
              host: host,
              rejectUnauthorized: false
            }, () => {
              // Re-send EHLO in secure channel
              currentStep = 1;
              sendLine(`EHLO ${host}`);
            });
            secureSocket.setEncoding("utf8");

            socket.removeAllListeners("data");
            socket.removeAllListeners("error");
            socket = secureSocket;

            socket.on("data", (data) => {
              const lines = data.split("\r\n").filter(Boolean);
              for (const line of lines) {
                const code = parseInt(line.substring(0, 3));
                const isLastLine = line.charAt(3) !== "-";
                if (isLastLine) {
                  handleSmtpResponse(code, line);
                }
              }
            });

            socket.on("error", (err) => {
              cleanupAndReject(new Error(`SMTP Secure Handshake Error: ${err.message}`));
            });
          } else {
            cleanupAndReject(new Error(`STARTTLS upgrade rejected: ${responseText}`));
          }
        } else if (currentStep === 2) {
          // AUTH LOGIN: Expect 334 username challenge
          if (code === 334) {
            currentStep = 3;
            sendLine(Buffer.from(user).toString("base64"));
          } else {
            cleanupAndReject(new Error(`Auth Login command rejected: ${responseText}`));
          }
        } else if (currentStep === 3) {
          // Username submitted: Expect 334 password challenge
          if (code === 334) {
            currentStep = 3.5;
            sendLine(Buffer.from(pass).toString("base64"));
          } else {
            cleanupAndReject(new Error(`Username challenge rejected: ${responseText}`));
          }
        } else if (currentStep === 3.5) {
          // Password submitted: Expect 235 Authentication successful
          if (code === 235) {
            currentStep = 4;
            sendLine(`MAIL FROM:<${extractEmail(from)}>`);
          } else {
            cleanupAndReject(new Error(`Authentication credentials invalid: ${responseText}`));
          }
        } else if (currentStep === 4) {
          // MAIL FROM: Expect 250
          if (code === 250) {
            currentStep = 5;
            sendLine(`RCPT TO:<${extractEmail(to)}>`);
          } else {
            cleanupAndReject(new Error(`Sender address rejected: ${responseText}`));
          }
        } else if (currentStep === 5) {
          // RCPT TO: Expect 250
          if (code === 250) {
            currentStep = 6;
            sendLine("DATA");
          } else {
            cleanupAndReject(new Error(`Recipient address rejected: ${responseText}`));
          }
        } else if (currentStep === 6) {
          // DATA: Expect 354
          if (code === 354) {
            currentStep = 7;
            
            // Build RFC 2822 email headers & payload
            const boundary = `----=_Part_${Math.random().toString(36).slice(2)}`;
            let message = `From: ${from}\r\n`;
            message += `To: ${to}\r\n`;
            message += `Subject: ${subject}\r\n`;
            message += `MIME-Version: 1.0\r\n`;
            
            if (html && text) {
              message += `Content-Type: multipart/alternative; boundary="${boundary}"\r\n\r\n`;
              message += `--${boundary}\r\n`;
              message += `Content-Type: text/plain; charset=utf-8\r\n\r\n`;
              message += `${text}\r\n\r\n`;
              message += `--${boundary}\r\n`;
              message += `Content-Type: text/html; charset=utf-8\r\n\r\n`;
              message += `${html}\r\n\r\n`;
              message += `--${boundary}--\r\n`;
            } else if (html) {
              message += `Content-Type: text/html; charset=utf-8\r\n\r\n`;
              message += `${html}\r\n`;
            } else {
              message += `Content-Type: text/plain; charset=utf-8\r\n\r\n`;
              message += `${text}\r\n`;
            }

            // Terminate mail message stream with standard carriage dot Carriage-return
            message += "\r\n.\r\n";
            socket.write(message);
          } else {
            cleanupAndReject(new Error(`DATA greeting failed: ${responseText}`));
          }
        } else if (currentStep === 7) {
          // Data transfer confirmation: Expect 250
          if (code === 250) {
            currentStep = 8;
            sendLine("QUIT");
          } else {
            cleanupAndReject(new Error(`Email data sending rejected: ${responseText}`));
          }
        } else if (currentStep === 8) {
          // QUIT response: Expect 221
          socket.end();
          resolve({
            success: true,
            message: "Email sent successfully",
            log: responseLog
          });
        }
      }
    });
  }
}

function extractEmail(str) {
  const match = str.match(/<([^>]+)>/);
  return match ? match[1] : str.trim();
}

export default MailSender;
