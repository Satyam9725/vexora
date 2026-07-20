import Vexora from "../Vexora.js";
import { run as runRouterTests } from "./router.test.js";
import { run as runCacheTests } from "./cache.test.js";
import { run as runValidatorTests } from "./validator.test.js";
import { run as runSessionTests } from "./session.test.js";
import { run as runHelperTests } from "./helper.test.js";
import { run as runStaticTests } from "./static.test.js";
import { run as runCsrfTests } from "./csrf.test.js";
import { run as runMailTests } from "./mail.test.js";
import { run as runHttpClientTests } from "./http_client.test.js";
import { run as runIpBlockingTests } from "./ip_block.test.js";
import { run as runSuspiciousBlockTests } from "./suspicious_block.test.js";
import { run as runBehaviorAnalyzerTests } from "./behavior_analyzer.test.js";
import { run as runCaptchaTests } from "./recaptcha.test.js";
import { run as runQueueTests } from "./queue.test.js";
import { run as runSchedulerTests } from "./scheduler.test.js";
import { run as runUploadTests } from "./upload.test.js";

async function main() {
    console.log("==========================================");
    console.log("VEXORA FRAMEWORK INTEGRATED TEST RUNNER");
    console.log("==========================================\n");

    try {
        await runRouterTests();
        await runCacheTests();
        await runValidatorTests();
        await runSessionTests();
        await runHelperTests();
        await runStaticTests();
        await runCsrfTests();
        await runMailTests();
        await runHttpClientTests();
        await runIpBlockingTests();
        await runSuspiciousBlockTests();
        await runBehaviorAnalyzerTests();
        await runCaptchaTests();
        await runQueueTests();
        await runSchedulerTests();
        await runUploadTests();

        console.log("==========================================");
        console.log("🎉 ALL VEXORA FRAMEWORK TESTS PASSED SUCCESFULLY!");
        console.log("==========================================");
        setTimeout(() => process.exit(0), 100);
    } catch (err) {
        console.error("\n❌ Test execution failed with error:", err);
        process.exit(1);
    }
}

main();
