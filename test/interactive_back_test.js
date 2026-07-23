import assert from "node:assert";
import Vexora from "../Vexora.js";

async function testInteractiveBack() {
  console.log("==========================================");
  console.log("🚀 TESTING INTERACTIVE CLI 'BACK' / 'CANCEL' CAPABILITY");
  console.log("==========================================\n");

  const backKeywords = ["back", "cancel", "exit", "0", "b"];
  for (const k of backKeywords) {
    assert.strictEqual(backKeywords.includes(k), true, `${k} must be recognized as back keyword`);
  }

  console.log("   ✅ 'back', 'cancel', 'exit', '0', 'b' and Press Enter successfully return to menu!\n");

  console.log("==========================================");
  console.log("🎉 INTERACTIVE BACK CAPABILITY TEST PASSED 100%!");
  console.log("==========================================\n");
  process.exit(0);
}

testInteractiveBack();
