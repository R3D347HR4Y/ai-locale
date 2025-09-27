#!/usr/bin/env node

/**
 * i18n Format Testing Suite
 *
 * This testing suite allows contributors to easily test new i18n file formats
 * by implementing test cases that verify parsing, generation, and validation.
 */

const fs = require("fs");
const path = require("path");
const chalk = require("chalk");
const fileParser = require("../src/utils/fileParser");

class FormatTestSuite {
  constructor() {
    this.results = [];
    this.fixturesDir = path.join(__dirname, "fixtures");
    this.formatsDir = path.join(__dirname, "formats");
  }

  /**
   * Run all format tests
   */
  async runAllTests() {
    console.log(chalk.cyan("🧪 Running i18n Format Testing Suite\n"));

    const formatTests = this.discoverFormatTests();

    if (formatTests.length === 0) {
      console.log(
        chalk.yellow(
          "No format tests found. Create test files in tests/formats/"
        )
      );
      return;
    }

    for (const testFile of formatTests) {
      await this.runFormatTest(testFile);
    }

    this.printSummary();
  }

  /**
   * Discover all format test files
   */
  discoverFormatTests() {
    if (!fs.existsSync(this.formatsDir)) {
      return [];
    }

    return fs
      .readdirSync(this.formatsDir)
      .filter((file) => file.endsWith(".test.js"))
      .map((file) => path.join(this.formatsDir, file));
  }

  /**
   * Run a single format test
   */
  async runFormatTest(testFile) {
    const formatName = path.basename(testFile, ".test.js");
    console.log(chalk.blue(`\n📁 Testing ${formatName} format...`));

    try {
      const FormatTest = require(testFile);
      const test = new FormatTest();

      const result = {
        format: formatName,
        tests: [],
        passed: 0,
        failed: 0,
        total: 0,
      };

      // Run all test methods
      const testMethods = Object.getOwnPropertyNames(
        Object.getPrototypeOf(test)
      ).filter(
        (method) =>
          method.startsWith("test") && typeof test[method] === "function"
      );

      for (const method of testMethods) {
        const testResult = await this.runSingleTest(test, method, formatName);
        result.tests.push(testResult);
        result.total++;

        if (testResult.passed) {
          result.passed++;
        } else {
          result.failed++;
        }
      }

      this.results.push(result);
      this.printFormatResult(result);
    } catch (error) {
      console.log(chalk.red(`❌ Failed to load test: ${error.message}`));
      this.results.push({
        format: formatName,
        error: error.message,
        passed: 0,
        failed: 1,
        total: 1,
      });
    }
  }

  /**
   * Run a single test method
   */
  async runSingleTest(testInstance, methodName, formatName) {
    const testName = methodName
      .replace("test", "")
      .replace(/([A-Z])/g, " $1")
      .trim();

    try {
      await testInstance[methodName]();
      return {
        name: testName,
        passed: true,
        error: null,
      };
    } catch (error) {
      return {
        name: testName,
        passed: false,
        error: error.message,
      };
    }
  }

  /**
   * Print results for a single format
   */
  printFormatResult(result) {
    if (result.error) {
      console.log(chalk.red(`❌ ${result.format}: ${result.error}`));
      return;
    }

    const status = result.failed === 0 ? "✅" : "⚠️";
    console.log(
      chalk.green(
        `${status} ${result.format}: ${result.passed}/${result.total} tests passed`
      )
    );

    if (result.failed > 0) {
      result.tests
        .filter((test) => !test.passed)
        .forEach((test) => {
          console.log(chalk.red(`   ❌ ${test.name}: ${test.error}`));
        });
    }
  }

  /**
   * Print overall summary
   */
  printSummary() {
    console.log(chalk.cyan("\n📊 Test Summary"));
    console.log(chalk.cyan("================"));

    const totalFormats = this.results.length;
    const totalTests = this.results.reduce(
      (sum, result) => sum + result.total,
      0
    );
    const totalPassed = this.results.reduce(
      (sum, result) => sum + result.passed,
      0
    );
    const totalFailed = this.results.reduce(
      (sum, result) => sum + result.failed,
      0
    );

    console.log(chalk.blue(`Formats tested: ${totalFormats}`));
    console.log(chalk.blue(`Total tests: ${totalTests}`));
    console.log(chalk.green(`Passed: ${totalPassed}`));
    console.log(chalk.red(`Failed: ${totalFailed}`));

    const successRate =
      totalTests > 0 ? Math.round((totalPassed / totalTests) * 100) : 0;
    const statusColor =
      successRate === 100
        ? chalk.green
        : successRate >= 80
        ? chalk.yellow
        : chalk.red;
    console.log(statusColor(`Success rate: ${successRate}%`));
  }
}

/**
 * Base class for format tests
 */
class BaseFormatTest {
  constructor() {
    this.fixturesDir = path.join(__dirname, "fixtures");
    this.fileParser = fileParser;
  }

  /**
   * Load a fixture file
   */
  loadFixture(filename) {
    const filePath = path.join(this.fixturesDir, filename);
    if (!fs.existsSync(filePath)) {
      throw new Error(`Fixture file not found: ${filename}`);
    }
    return fs.readFileSync(filePath, "utf8");
  }

  /**
   * Assert that two values are equal
   */
  assertEqual(actual, expected, message) {
    if (actual !== expected) {
      throw new Error(`${message}. Expected: ${expected}, Got: ${actual}`);
    }
  }

  /**
   * Assert that a value is truthy
   */
  assertTrue(value, message) {
    if (!value) {
      throw new Error(`${message}. Expected truthy value, got: ${value}`);
    }
  }

  /**
   * Assert that a value is falsy
   */
  assertFalse(value, message) {
    if (value) {
      throw new Error(`${message}. Expected falsy value, got: ${value}`);
    }
  }

  /**
   * Assert that an object has a property
   */
  assertHasProperty(obj, property, message) {
    if (!(property in obj)) {
      throw new Error(`${message}. Object missing property: ${property}`);
    }
  }

  /**
   * Assert that an array has a specific length
   */
  assertLength(array, expectedLength, message) {
    if (array.length !== expectedLength) {
      throw new Error(
        `${message}. Expected length: ${expectedLength}, Got: ${array.length}`
      );
    }
  }

  /**
   * Assert that a string contains a substring
   */
  assertContains(str, substring, message) {
    if (!str.includes(substring)) {
      throw new Error(`${message}. String does not contain: ${substring}`);
    }
  }

  /**
   * Create a test fixture directory structure
   */
  createFixtureStructure(formatName) {
    const fixtureDir = path.join(this.fixturesDir, formatName);
    if (!fs.existsSync(fixtureDir)) {
      fs.mkdirSync(fixtureDir, { recursive: true });
    }
    return fixtureDir;
  }

  /**
   * Write a test fixture file
   */
  writeFixture(formatName, filename, content) {
    const fixtureDir = this.createFixtureStructure(formatName);
    const filePath = path.join(fixtureDir, filename);
    fs.writeFileSync(filePath, content, "utf8");
    return filePath;
  }
}

// Export for use in test files
module.exports = {
  FormatTestSuite,
  BaseFormatTest,
};

// Run tests if this file is executed directly
if (require.main === module) {
  const suite = new FormatTestSuite();
  suite.runAllTests().catch(console.error);
}
