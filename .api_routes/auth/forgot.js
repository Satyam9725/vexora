// Auto-Generated Vexora Auth Forgot Password API Route
// Target Table: 'user' [Connection: mongodb]

const dbKey = "mongodb";
const email = req.body?.email;

if (!email) {
  return Vexora.Response.error("Email address is required!", 400);
}

try {
  // Check if user exists
  const user = await Vexora.fetch(dbKey, "SELECT * FROM user WHERE email = ?", [email]);
  if (!user) {
    return Vexora.Response.error("No account found with this email address!", 404);
  }

  // Generate 15-minute Reset Token
  const resetToken = Vexora.TokenVault.create({ id: user.id || user._id, email: user.email }, "15m");

  // Send password reset email using Vexora MailSender
  await Vexora.MailSender.send({
    to: email,
    subject: "Password Reset Request",
    html: `<p>Hello ${user.title || user.name || "User"},</p><p>Your password reset token is: <strong>${resetToken}</strong></p>`
  });

  return Vexora.Response.success({ email, sent: true }, "Password reset link/token sent to your email!");
} catch (err) {
  return Vexora.Response.error("Forgot password failed: " + err.message, 500);
}
