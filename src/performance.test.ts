import { test, describe, beforeEach, afterEach, spyOn } from "bun:test";
import * as logger from "./index";

// Mock process.stdout and process.stderr to prevent console output during benchmarks
beforeEach(() => {
  const mockWrite = () => true;
  // @ts-ignore
  process.stdout.write = mockWrite;
  // @ts-ignore
  process.stderr.write = mockWrite;
});

// Mock output to avoid I/O overhead during benchmarks
let stdoutSpy: any;
let stderrSpy: any;

beforeEach(() => {
  stdoutSpy = spyOn(process.stdout, "write").mockImplementation(() => true);
  stderrSpy = spyOn(process.stderr, "write").mockImplementation(() => true);
  logger.setDefaultLogLevel(logger.INFO);
});

afterEach(() => {
  stdoutSpy.mockRestore();
  stderrSpy.mockRestore();
});

// Benchmark runner inspired by Go's benchmark approach
function benchmark(name: string, fn: () => void, durationMs: number = 3000): void {
  test(`Benchmark: ${name}`, () => {
    // Warmup
    for (let i = 0; i < 1000; i++) {
      fn();
    }
    
    // Reset spies after warmup
    stdoutSpy.mockClear();
    stderrSpy.mockClear();
    
    // Actual benchmark
    const startTime = performance.now();
    let operations = 0;
    
    while (performance.now() - startTime < durationMs) {
      fn();
      operations++;
    }
    
    const endTime = performance.now();
    const duration = endTime - startTime;
    const opsPerSec = (operations / duration) * 1000;
    const nsPerOp = (duration * 1_000_000) / operations;
    
    console.log(`${name}:`);
    console.log(`  ${operations.toLocaleString()} ops in ${duration.toFixed(1)}ms`);
    console.log(`  ${opsPerSec.toFixed(0)} ops/sec`);
    console.log(`  ${nsPerOp.toFixed(0)} ns/op`);
    console.log("");
  });
}

describe("slog Benchmarks", () => {
  benchmark("SimpleMessage", () => {
    logger.info("Simple log message");
  });

  benchmark("MessageWithSingleAttribute", () => {
    logger.info("User action", { userId: "12345" });
  });

  benchmark("MessageWithMultipleAttributes", () => {
    logger.info("Request processed", {
      userId: "12345",
      method: "POST",
      path: "/api/users",
      status: 200,
      duration: 45.2
    });
  });

  benchmark("MessageWithNestedObject", () => {
    logger.info("User created", {
      user: {
        id: "12345",
        name: "John Doe",
        email: "john@example.com",
        role: "admin"
      },
      timestamp: Date.now()
    });
  });

  benchmark("MessageWithArray", () => {
    logger.info("Batch processed", {
      items: ["item1", "item2", "item3", "item4", "item5"],
      count: 5,
      success: true
    });
  });

  benchmark("MessageWithComplexObject", () => {
    logger.info("Complex operation", {
      user: {
        id: 12345,
        profile: {
          name: "John Doe",
          preferences: {
            theme: "dark",
            notifications: ["email", "sms"],
            settings: {
              autoSave: true,
              timeout: 30
            }
          }
        }
      },
      request: {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "authorization": "Bearer token123"
        },
        body: {
          action: "update",
          fields: ["name", "email", "role"]
        }
      },
      metadata: {
        traceId: "abc-123-def-456",
        timestamp: Date.now(),
        version: "1.2.3"
      }
    });
  });

  benchmark("MessageWithLargeArray", () => {
    logger.info("Large dataset processed", {
      items: Array.from({ length: 100 }, (_, i) => `item-${i}`),
      metadata: {
        total: 100,
        processed: Date.now()
      }
    });
  });

  benchmark("ErrorWithStackTrace", () => {
    const error = new Error("Something went wrong");
    logger.error("Operation failed", {
      error: error,
      userId: "12345",
      operation: "data-export",
      context: {
        retryCount: 2,
        lastAttempt: Date.now()
      }
    });
  });

  benchmark("DebugMessage", () => {
    logger.debug("Debug information", {
      function: "processData",
      line: 42,
      variables: {
        x: 10,
        y: 20,
        result: 30
      }
    });
  });

  benchmark("WarnMessage", () => {
    logger.warn("Performance warning", {
      operation: "database-query",
      duration: 1250,
      threshold: 1000,
      query: "SELECT * FROM users WHERE active = 1"
    });
  });

  benchmark("MessageWithUnicode", () => {
    logger.info("International message", {
      emoji: "🚀🌟💻",
      chinese: "你好世界",
      japanese: "こんにちは",
      arabic: "مرحبا",
      message: "测试消息 with émojis 🎉"
    });
  });

  benchmark("MessageWithNumbers", () => {
    logger.info("Metrics update", {
      cpu: 78.5,
      memory: 1024.7,
      disk: 89.2,
      network: 45.1,
      timestamp: Date.now(),
      uptime: 3600.5,
      requests: 10000,
      errors: 0
    });
  });

  benchmark("MessageWithBooleans", () => {
    logger.info("Feature flags", {
      featureA: true,
      featureB: false,
      featureC: true,
      experimental: false,
      beta: true,
      production: true
    });
  });

  benchmark("MessageWithNullValues", () => {
    logger.info("Sparse data", {
      userId: "12345",
      email: "user@example.com",
      phone: null,
      address: undefined,
      avatar: null,
      lastLogin: Date.now()
    });
  });

  benchmark("LevelFiltering_Disabled", () => {
    logger.setDefaultLogLevel(logger.ERROR);
    // These should be filtered out (early return)
    logger.debug("This won't be processed", { data: "ignored" });
  });

  benchmark("LevelFiltering_Enabled", () => {
    logger.setDefaultLogLevel(logger.DEBUG);
    logger.debug("This will be processed", { data: "included" });
  });

  benchmark("VeryLongMessage", () => {
    const longMessage = "A".repeat(1000);
    logger.info(longMessage, {
      type: "stress-test",
      length: 1000
    });
  });

  benchmark("ManySmallAttributes", () => {
    const attrs: Record<string, string> = {};
    for (let i = 0; i < 50; i++) {
      attrs[`key${i}`] = `value${i}`;
    }
    logger.info("Many attributes", attrs);
  });

  benchmark("DeepNestedObject", () => {
    const createDeepObject = (depth: number): any => {
      if (depth === 0) return "leaf";
      return {
        level: depth,
        data: `level-${depth}`,
        nested: createDeepObject(depth - 1),
        array: [1, 2, 3]
      };
    };

    logger.info("Deep nesting test", {
      deep: createDeepObject(10),
      metadata: "test"
    });
  });

  // Pre-generate random choices outside benchmark timing
  const mixedLogChoices: number[] = [];
  for (let i = 0; i < 10000; i++) {
    mixedLogChoices.push(Math.floor(Math.random() * 4));
  }
  let mixedLogChoiceIndex = 0;

  benchmark("MixedLogLevels", () => {
    const choice = mixedLogChoices[mixedLogChoiceIndex % mixedLogChoices.length];
    mixedLogChoiceIndex++;
    
    if (choice === 0) {
      logger.debug("Debug message", { level: "debug" });
    } else if (choice === 1) {
      logger.info("Info message", { level: "info" });
    } else if (choice === 2) {
      logger.warn("Warn message", { level: "warn" });
    } else {
      logger.error("Error message", { level: "error" });
    }
  });
}); 