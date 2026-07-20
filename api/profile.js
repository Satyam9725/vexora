// A. Success Response (HTTP 200)
// Automatically appends: { "status": true, "message": "...", "data": {...}, "execution_time": "1.24ms" }
Vexora.Response.success({ id: 1, name: "Satyam" }, "Profile loaded successfully!");

// B. Error Response with custom HTTP Code (HTTP 401)
// Automatically appends: { "status": false, "message": "...", "data": null, "execution_time": "0.85ms" }
// Vexora.Response.error("Invalid password!", 401);

// C. Custom formatted JSON output
// Vexora.Response.json(true, "Custom message", { score: 99 }, 202);