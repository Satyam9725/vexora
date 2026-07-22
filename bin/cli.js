#!/usr/bin/env node

globalThis.__vexora_cli_executed = true;
import executeCommand from "../command.js";

const args = process.argv.slice(2);
executeCommand(args);
