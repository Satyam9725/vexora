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

class Validator {
    constructor(data, rules) {
        this.data = data || {};
        this.rules = rules || {};
        this.errors = {};
    }

    static make(data, rules) {
        const validator = new Validator(data, rules);
        validator.validate();
        return validator;
    }

    validate() {
        for (const [field, ruleString] of Object.entries(this.rules)) {
            const rules = ruleString.split('|');
            const value = this.data[field];

            for (const rule of rules) {
                // Determine if there are parameters, e.g., max:10
                const [ruleName, param] = rule.split(':');
                
                // Format method name (e.g., 'required' -> 'validateRequired')
                const methodName = 'validate' + ruleName.charAt(0).toUpperCase() + ruleName.slice(1).replace(/_/g, '');
                
                if (typeof this[methodName] === 'function') {
                    this[methodName](field, value, param);
                }
            }
        }
    }

    _addError(field, message) {
        if (!this.errors[field]) {
            this.errors[field] = [];
        }
        this.errors[field].push(message);
    }

    // --- Validation Methods ---

    validateRequired(field, value) {
        if (value === null || value === undefined || value === '') {
            this._addError(field, `The ${field} field is required.`);
        }
    }

    validateEmail(field, value) {
        if (value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value))) {
            this._addError(field, `The ${field} must be a valid email address.`);
        }
    }

    validateInteger(field, value) {
        if (value && !Number.isInteger(Number(value))) {
            this._addError(field, `The ${field} must be an integer.`);
        }
    }

    validateString(field, value) {
        if (value && typeof value !== 'string') {
            this._addError(field, `The ${field} must be a string.`);
        }
    }

    validateMin(field, value, param) {
        if (!value) return;
        const min = Number(param);
        if (typeof value === 'string' && value.length < min) {
            this._addError(field, `The ${field} must be at least ${min} characters.`);
        } else if (typeof value === 'number' && value < min) {
            this._addError(field, `The ${field} must be at least ${min}.`);
        }
    }

    validateMax(field, value, param) {
        if (!value) return;
        const max = Number(param);
        if (typeof value === 'string' && value.length > max) {
            this._addError(field, `The ${field} must not be greater than ${max} characters.`);
        } else if (typeof value === 'number' && value > max) {
            this._addError(field, `The ${field} must not be greater than ${max}.`);
        }
    }

    // --- Accessors ---

    fails() {
        return Object.keys(this.errors).length > 0;
    }

    getErrors() {
        return this.errors;
    }
}

export default Validator;
