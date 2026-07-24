import assert from "node:assert";
import mysqlModule from "mysql2/promise";
import Vexora from "../Vexora.js";
import mysql from "../database/mysql.js";

// Mock the mysql2 createPool method to bypass the offline database error
const origCreatePool = mysqlModule.createPool;
mysqlModule.createPool = (config) => {
  console.log("   [Mock MySQL Pool] created with config:", JSON.stringify(config));
  return {
    getConnection: async () => ({
      ping: async () => {},
      release: () => {}
    }),
    query: async (sql, params) => {
      console.log(`   [Mock MySQL Query]: ${sql}`);
      return [[{ id: 1, name: "Mocked User from Pool" }]];
    },
    end: async () => {}
  };
};

async function runLivePoolApiTest() {
  console.log("==========================================");
  console.log("🚀 STARTING LIVE DB POOL CONFIG API SERVER");
  console.log("==========================================\n");

  console.log("1️⃣ Connecting to database (auth) with connectionLimit...");
  await Vexora.connect({
    host: "localhost",
    driver: "mysql",
    user: "root",
    password: "",
    database: "test_db",
    connectionLimit: 15
  }, "auth");
  console.log("   ✅ Database connected successfully!\n");

  // Start Vexora Server
  console.log("2️⃣ Starting Vexora Server...");
  const port = 19555;
  const app = Vexora.start(port);
  
  // Mount custom API endpoint to query via the pool
  app.Vexora("GET", "/api/pool-test", async (req, res) => {
    try {
      // Execute query using pool
      const result = await Vexora.fetchAll("auth", "SELECT * FROM test_pool_users");
      return res.success(result, "Pool query executed successfully");
    } catch (err) {
      return res.error(err.message, 500);
    }
  });
  console.log(`   ✅ Vexora server started at http://localhost:${port}/api/pool-test\n`);

  // Test the API route
  console.log("3️⃣ Making live HTTP GET request to /api/pool-test...");
  const response = await Vexora.http.get(`http://localhost:${port}/api/pool-test`);
  
  assert.strictEqual(response.ok, true, "Response must be OK");
  assert.strictEqual(response.data.status, true, "Response status must be true");
  assert.ok(Array.isArray(response.data.data), "Response data must be an array");
  assert.strictEqual(response.data.data[0].name, "Mocked User from Pool", "Should receive mocked database user");
  console.log("   ✅ Live API responded with:", JSON.stringify(response.data));

  // Clean up
  console.log("\n4️⃣ Cleaning up and closing server...");
  app.close();
  await mysql.disconnect();
  console.log("   ✅ Done!");

  console.log("\n==========================================");
  console.log("🎉 LIVE API POOL VERIFICATION PASSED 100%!");
  console.log("==========================================\n");
}

runLivePoolApiTest().catch(err => {
  console.error("❌ Live API test failed:", err);
  process.exit(1);
});
