// Auto-Generated Vexora Auth Login API Route
// Target Table: 'user' [Driver: mysql]

const dbKey = "mysql";
const username = req.body?.username || req.body?.email;
const password = req.body?.password;

if (!username || !password) {
  return Vexora.Response.error("Username/Email and Password are required!", 400);
}

try {
  // Fetch user record from database
  const user = await Vexora.fetch(dbKey, "SELECT * FROM user WHERE email = ? OR username = ?", [username, username]);
  if (!user) {
    return Vexora.Response.error("Invalid credentials! User not found.", 401);
  }

  // Verify password using Bcrypt
  const isValid = await Vexora.Bcrypt.compare(password, user.password || "");
  if (!isValid) {
    return Vexora.Response.error("Invalid credentials! Password incorrect.", 401);
  }

  // Generate Session Token
  const token = Vexora.TokenVault.create({ id: user.id || user._id, email: user.email });

  delete user.password; // Hide password in response
  return Vexora.Response.success({ token, user }, "Login successful!");
} catch (err) {
  return Vexora.Response.error("Login failed: " + err.message, 500);
}
