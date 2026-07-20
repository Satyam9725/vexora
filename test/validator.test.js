import assert from "assert";
import Validator from "../utils/Validator.js";

export async function run() {
    console.log("👉 Running Validator Tests...");

    const data = {
        username: "satyam",
        email: "satyam.ku9725@gmail.com",
        age: 26
    };

    // Valid inputs check
    const val1 = Validator.make(data, {
        username: "required|string|min:4",
        email: "required|email",
        age: "required|integer|min:18"
    });
    assert.ok(!val1.fails(), "Valid inputs should not fail");

    // Invalid inputs check (missing fields)
    const val2 = Validator.make({ age: 15 }, {
        username: "required|string",
        age: "required|integer|min:18"
    });
    assert.ok(val2.fails(), "Invalid inputs should fail");
    
    const errors = val2.getErrors();
    assert.ok(errors.username, "Should report missing username error");
    assert.ok(errors.age, "Should report age constraint error");

    console.log("✅ Validator Tests Passed.\n");
}
