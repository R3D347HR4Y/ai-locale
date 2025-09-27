#!/usr/bin/env node

/**
 * Individual Format Test Runner
 *
 * Usage: node tests/run-format-test.js [format-name]
 *
 * Examples:
 *   node tests/run-format-test.js json
 *   node tests/run-format-test.js xml
 *   node tests/run-format-test.js ts
 *   node tests/run-format-test.js strings
 *   node tests/run-format-test.js yaml
 */

const path = require("path");
const chalk = require("chalk");
const { BaseFormatTest } = require("./test-runner");

async function runFormatTest(formatName) {
  const testFile = path.join(__dirname, "formats", `${formatName}.test.js`);

  try {
    console.log(chalk.cyan(`🧪 Running ${formatName} format tests...\n`));

    const FormatTest = require(testFile);
    const test = new FormatTest();

    const testMethods = Object.getOwnPropertyNames(
      Object.getPrototypeOf(test)
    ).filter(
      (method) =>
        method.startsWith("test") && typeof test[method] === "function"
    );

    let passed = 0;
    let failed = 0;
    const results = [];

    for (const method of testMethods) {
      const testName = method
        .replace("test", "")
        .replace(/([A-Z])/g, " $1")
        .trim();

      try {
        await test[method]();
        console.log(chalk.green(`✅ ${testName}`));
        passed++;
        results.push({ name: testName, passed: true });
      } catch (error) {
        console.log(chalk.red(`❌ ${testName}: ${error.message}`));
        failed++;
        results.push({ name: testName, passed: false, error: error.message });
      }
    }

    console.log(chalk.cyan(`\n📊 ${formatName} Test Results`));
    console.log(chalk.cyan("=================="));
    console.log(chalk.blue(`Total tests: ${passed + failed}`));
    console.log(chalk.green(`Passed: ${passed}`));
    console.log(chalk.red(`Failed: ${failed}`));

    const successRate = Math.round((passed / (passed + failed)) * 100);
    const statusColor =
      successRate === 100
        ? chalk.green
        : successRate >= 80
        ? chalk.yellow
        : chalk.red;
    console.log(statusColor(`Success rate: ${successRate}%`));

    if (failed > 0) {
      console.log(chalk.red("\n❌ Failed tests:"));
      results
        .filter((result) => !result.passed)
        .forEach((result) => {
          console.log(chalk.red(`   • ${result.name}: ${result.error}`));
        });
    }
  } catch (error) {
    console.log(chalk.red(`❌ Failed to load test: ${error.message}`));
    console.log(chalk.yellow(`Make sure the test file exists: ${testFile}`));
  }
}

// Get format name from command line arguments
const formatName = process.argv[2];

if (!formatName) {
  console.log(
    chalk.yellow("Usage: node tests/run-format-test.js [format-name]")
  );
  console.log(chalk.yellow("Available formats: json, xml, ts, strings, yaml"));
  process.exit(1);
}

runFormatTest(formatName).catch(console.error);
