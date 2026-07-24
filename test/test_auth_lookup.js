import { routeCommands } from "../commands/routeCommands.js";
import fs from "node:fs";
import path from "node:path";

function mockPrompts(answers) {
  const queue = [...answers];
  global.mockPromptQuestion = (query, defaultValue) => {
    const ans = queue.shift();
    if (ans !== undefined) return ans;
    return defaultValue || "";
  };
}

async function testAuthConnection() {
  console.log("🧪 Testing Step 4/7 with 'auth' connection key...");
  // Step 1: auth/login
  // Step 2: 1 (POST)
  // Step 3: 1 (Login API)
  // Step 4: 2 (select 'auth' DB connection key)
  // Step 4.1 Table: 2 (user) or fallback
  // Step 4.2 Column: 1 (id) or fallback
  // Step 5: s (Save)
  // Step 7: n (Skip test)

  mockPrompts(["auth/login", "1", "1", "2", "2", "1", "s", "n"]);

  await routeCommands["create:api"].run(["create:api"]);
  global.mockPromptQuestion = null;

  const file = path.join(process.cwd(), ".api_routes", "auth", "login.js");
  if (fs.existsSync(file)) {
    console.log("✅ 'auth' DB Connection lookup fix verified! Created API file successfully.");
  } else {
    console.error("❌ Failed to create API file with 'auth' key.");
    process.exit(1);
  }
}

testAuthConnection().catch(err => {
  console.error("❌ Error:", err);
  process.exit(1);
});
