import Vexora from "./Vexora.js";

console.log("Attempting to modify Vexora.start...");

try {
  // This should throw an error and crash the app
  Vexora.start = function() {
    console.log("App Hacked!");
  };
} catch (error) {
  console.error("SUCCESS! Caught error when trying to modify:", error.message);
}

console.log("\nAttempting to add a new property to Vexora...");
try {
  Vexora.hackedProperty = "hacked";
} catch (error) {
  console.error("SUCCESS! Caught error when trying to add property:", error.message);
}
