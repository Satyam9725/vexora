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

import http from "node:http";
import Response from "./Response.js";

class Http {
  Server(callback) {
    return http.createServer((req, res) => {
      callback(req, new Response(res));
    });
  }

  createServer(callback) {
    return this.Server(callback);
  }

  create(callback) {
    return this.Server(callback);
  }

  /**
   * Send HTTP requests to external/internal URLs (GET, POST, DELETE, etc.)
   */
  async request(method, url, options = {}) {
    const { headers = {}, body, query, timeout, ...rest } = options;

    let targetUrl = url;
    if (query && typeof query === 'object') {
      const q = new URLSearchParams(query).toString();
      if (q) {
        targetUrl += (url.includes('?') ? '&' : '?') + q;
      }
    }

    const config = {
      method: method.toUpperCase(),
      headers: { ...headers },
      ...rest
    };

    if (body !== undefined) {
      if (typeof body === 'object') {
        config.body = JSON.stringify(body);
        if (!config.headers['Content-Type'] && !config.headers['content-type']) {
          config.headers['Content-Type'] = 'application/json';
        }
      } else {
        config.body = body;
      }
    }

    let timeoutId;
    if (timeout) {
      const controller = new AbortController();
      config.signal = controller.signal;
      timeoutId = setTimeout(() => controller.abort(), timeout);
    }

    try {
      const res = await fetch(targetUrl, config);
      if (timeoutId) clearTimeout(timeoutId);

      const contentType = res.headers.get('content-type') || '';
      let data;
      if (contentType.includes('application/json')) {
        data = await res.json();
      } else {
        data = await res.text();
      }

      return {
        status: res.status,
        statusText: res.statusText,
        headers: Object.fromEntries(res.headers.entries()),
        ok: res.ok,
        data
      };
    } catch (err) {
      if (timeoutId) clearTimeout(timeoutId);
      throw err;
    }
  }

  get(url, options = {}) {
    return this.request('GET', url, options);
  }

  post(url, data, options = {}) {
    return this.request('POST', url, { ...options, body: data });
  }

  put(url, data, options = {}) {
    return this.request('PUT', url, { ...options, body: data });
  }

  patch(url, data, options = {}) {
    return this.request('PATCH', url, { ...options, body: data });
  }

  delete(url, options = {}) {
    return this.request('DELETE', url, options);
  }
}

export default new Http();
