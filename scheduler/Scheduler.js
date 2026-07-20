import Config from "../core/config.js";

class Scheduler {
  constructor() {
    this.tasks = [];
    this.timer = null;
    this.tickCount = 0;
    this.lastCheckedMinute = -1;
  }

  /**
   * Schedules a task to run periodically based on a cron expression
   * 
   * @param {string} cronExpression - Standard 5-field cron pattern (minute hour day-of-month month day-of-week)
   * @param {Function} handler - Asynchronous or synchronous task function
   */
  schedule(cronExpression, handler) {
    if (typeof handler !== "function") {
      throw new Error("Task handler must be a function.");
    }
    const isSecondInterval = /^\d+$/.test(cronExpression.trim());
    this.tasks.push({
      expression: cronExpression,
      handler,
      isSecondInterval,
      intervalSeconds: isSecondInterval ? parseInt(cronExpression.trim(), 10) : 0
    });
  }

  /**
   * Starts the background scheduler loop
   */
  start() {
    if (this.timer) return;
    this.lastCheckedMinute = -1;
    this.timer = setInterval(() => this._tick(), 1000);
    if (this.timer && typeof this.timer.unref === "function") {
      this.timer.unref();
    }
  }

  /**
   * Stops the background scheduler loop
   */
  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  /**
   * Restarts the background scheduler loop
   */
  restart() {
    this.stop();
    this.start();
  }

  /**
   * Clears all registered tasks
   */
  clear() {
    this.tasks = [];
    this.tickCount = 0;
    this.lastCheckedMinute = -1;
  }

  /**
   * Execute check for matching cron tasks
   */
  _tick(targetDate = new Date()) {
    this.tickCount++;
    const currentMinute = targetDate.getMinutes();
    const shouldRunMinuteCron = currentMinute !== this.lastCheckedMinute;

    if (shouldRunMinuteCron) {
      this.lastCheckedMinute = currentMinute;
    }

    for (const task of this.tasks) {
      if (task.isSecondInterval) {
        if (this.tickCount % task.intervalSeconds === 0) {
          Promise.resolve(task.handler()).catch(err => {
            console.error(`❌ Second Interval Task [${task.expression}] execution failed:`, err);
          });
        }
      } else if (shouldRunMinuteCron) {
        if (this._match(task.expression, targetDate)) {
          Promise.resolve(task.handler()).catch(err => {
            console.error(`❌ Cron Job [${task.expression}] execution failed:`, err);
          });
        }
      }
    }
  }

  /**
   * Checks if a cron expression matches the given Date
   */
  _match(expression, date) {
    const parts = expression.trim().split(/\s+/);
    if (parts.length !== 5) return false;

    const current = {
      minute: date.getMinutes(),
      hour: date.getHours(),
      dayOfMonth: date.getDate(),
      month: date.getMonth() + 1, // Month is 0-indexed in JS Dates
      dayOfWeek: date.getDay()   // Sunday = 0
    };

    return this._matchField(parts[0], current.minute) &&
           this._matchField(parts[1], current.hour) &&
           this._matchField(parts[2], current.dayOfMonth) &&
           this._matchField(parts[3], current.month) &&
           this._matchField(parts[4], current.dayOfWeek, true);
  }

  /**
   * Verifies if a field pattern matches a date field value
   */
  _matchField(pattern, value, isDayOfWeek = false) {
    if (pattern === "*") return true;

    // Lists (e.g., 1,2,5)
    if (pattern.includes(",")) {
      return pattern.split(",").some(p => this._matchField(p, value, isDayOfWeek));
    }

    // Step intervals (e.g., */5)
    const stepMatch = pattern.match(/^\*\/(\d+)$/);
    if (stepMatch) {
      const step = parseInt(stepMatch[1], 10);
      return value % step === 0;
    }

    // Ranges (e.g., 1-5)
    const rangeMatch = pattern.match(/^(\d+)-(\d+)$/);
    if (rangeMatch) {
      let start = parseInt(rangeMatch[1], 10);
      let end = parseInt(rangeMatch[2], 10);
      if (isDayOfWeek) {
        if (start === 7) start = 0;
        if (end === 7) end = 0;
      }
      return value >= start && value <= end;
    }

    // Exact value match
    let matchVal = parseInt(pattern, 10);
    if (isDayOfWeek && matchVal === 7) {
      matchVal = 0;
    }
    return matchVal === value;
  }
}

export default new Scheduler();
