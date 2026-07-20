import assert from "assert";
import Vexora from "../Vexora.js";

export async function run() {
    console.log("👉 Running Scheduler & Cron Jobs Tests...");

    try {
        // Clear tasks in scheduler
        Vexora.Scheduler.clear();

        // A. Matcher Tests
        // 1. Wildcard match (should match any date/time)
        const dateNow = new Date("2026-07-20T10:00:00Z"); // Monday, July 20, 10:00 UTC
        assert.ok(Vexora.Scheduler._match("* * * * *", dateNow), "Wildcard should match everything");

        // 2. Step intervals match (e.g. every 5 minutes)
        const date5m = new Date(dateNow);
        date5m.setMinutes(5);
        assert.ok(Vexora.Scheduler._match("*/5 * * * *", date5m), "*/5 should match 5 minutes");
        
        const date7m = new Date(dateNow);
        date7m.setMinutes(7);
        assert.ok(!Vexora.Scheduler._match("*/5 * * * *", date7m), "*/5 should not match 7 minutes");

        // 3. Lists match (e.g. minutes 1, 15, 30)
        assert.ok(Vexora.Scheduler._match("1,15,30 * * * *", new Date("2026-07-20T10:15:00")), "15 should match list '1,15,30'");
        assert.ok(!Vexora.Scheduler._match("1,15,30 * * * *", new Date("2026-07-20T10:20:00")), "20 should not match list '1,15,30'");

        // 4. Ranges match (e.g. hour 9-17)
        assert.ok(Vexora.Scheduler._match("* 9-17 * * *", new Date("2026-07-20T12:00:00")), "12:00 should match hour range 9-17");
        assert.ok(!Vexora.Scheduler._match("* 9-17 * * *", new Date("2026-07-20T18:00:00")), "18:00 should not match hour range 9-17");

        // 5. Exact match (e.g. month 7 - July)
        assert.ok(Vexora.Scheduler._match("* * * 7 *", new Date("2026-07-20T10:00:00")), "July should match month 7");
        assert.ok(!Vexora.Scheduler._match("* * * 8 *", new Date("2026-07-20T10:00:00")), "July should not match month 8");

        // 6. Sunday Match (both 0 and 7)
        const sundayDate = new Date("2026-07-19T10:00:00"); // July 19, 2026 is Sunday (day = 0)
        assert.ok(Vexora.Scheduler._match("* * * * 0", sundayDate), "Sunday should match day 0");
        assert.ok(Vexora.Scheduler._match("* * * * 7", sundayDate), "Sunday should also match day 7");

        // B. Scheduler Task Executions
        let runCount1 = 0;
        let runCount2 = 0;
        let runCountInterval1 = 0;
        let runCountInterval2 = 0;

        // Schedule task 1 (runs every minute)
        Vexora.Schedule("* * * * *", () => {
            runCount1++;
        });

        // Schedule task 2 (runs only on Sundays - day 0)
        Vexora.Schedule("* * * * 0", () => {
            runCount2++;
        });

        // Schedule task 3 (second interval: "1" second)
        Vexora.Schedule("1", () => {
            runCountInterval1++;
        });

        // Schedule task 4 (second interval: "2" seconds)
        Vexora.Schedule("2", () => {
            runCountInterval2++;
        });

        // Trigger tick 1 for a Monday (July 20, 2026 is Monday, day of week = 1)
        const mondayTick1 = new Date("2026-07-20T10:00:00"); 
        Vexora.Scheduler._tick(mondayTick1);
        assert.strictEqual(runCount1, 1, "Minute task 1 should execute on first minute match");
        assert.strictEqual(runCount2, 0, "Sunday task should not execute");
        assert.strictEqual(runCountInterval1, 1, "Interval-1 task should execute on first tick");
        assert.strictEqual(runCountInterval2, 0, "Interval-2 task should not execute on first tick (tickCount = 1)");

        // Trigger tick 2 (still same minute)
        Vexora.Scheduler._tick(mondayTick1);
        assert.strictEqual(runCount1, 1, "Minute task 1 should not execute again within the same minute");
        assert.strictEqual(runCountInterval1, 2, "Interval-1 task should execute on second tick");
        assert.strictEqual(runCountInterval2, 1, "Interval-2 task should execute on second tick (tickCount = 2)");

        // Trigger tick 3 (new minute)
        const mondayTick2 = new Date("2026-07-20T10:01:00");
        Vexora.Scheduler._tick(mondayTick2);
        assert.strictEqual(runCount1, 2, "Minute task 1 should execute on new minute roll-over");
        assert.strictEqual(runCountInterval1, 3, "Interval-1 task should execute on third tick");
        assert.strictEqual(runCountInterval2, 1, "Interval-2 task should not execute on third tick (tickCount = 3)");

        // --- C. Test restart() ---
        Vexora.Scheduler.start();
        const oldTimer = Vexora.Scheduler.timer;
        assert.ok(oldTimer, "Scheduler timer should exist after start()");
        
        Vexora.Scheduler.restart();
        const newTimer = Vexora.Scheduler.timer;
        assert.ok(newTimer, "Scheduler timer should exist after restart()");
        assert.notStrictEqual(oldTimer, newTimer, "Scheduler timer instance should have changed after restart()");

        console.log("✅ Scheduler & Cron Jobs Tests Passed.\n");
    } finally {
        Vexora.Scheduler.clear();
        Vexora.Scheduler.stop();
    }
}
