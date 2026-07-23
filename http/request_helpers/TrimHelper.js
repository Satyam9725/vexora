/**
 * ==========================================================
 * Vexora Framework - Trim Helper
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

export function trimValue(value) {
    if (typeof value === 'string') {
        return value.trim();
    }
    if (Array.isArray(value)) {
        return value.map(v => trimValue(v));
    }
    if (value !== null && typeof value === 'object') {
        const trimmed = {};
        for (const key in value) {
            trimmed[key] = trimValue(value[key]);
        }
        return trimmed;
    }
    return value;
}
