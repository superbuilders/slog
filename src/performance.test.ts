import { expect, test, describe, beforeEach, afterEach, spyOn } from "bun:test";
import * as slog from "./index";

// Mock output to avoid console spam during benchmarks
let stdoutSpy: any;
let stderrSpy: any;

beforeEach(() => {
  stdoutSpy = spyOn(process.stdout, "write").mockImplementation(() => true);
  stderrSpy = spyOn(process.stderr, "write").mockImplementation(() => true);
  slog.setDefaultLogLevel(slog.INFO);
  slog.setDefaultAttributes({});
});

afterEach(() => {
  stdoutSpy.mockRestore();
  stderrSpy.mockRestore();
});

describe("Performance benchmarks", () => {
  test("should handle simple info logging efficiently", () => {
    const iterations = 10000;
    
    const start = performance.now();
    for (let i = 0; i < iterations; i++) {
      slog.info("Simple log message");
    }
    const end = performance.now();
    
    const duration = end - start;
    const logsPerMs = iterations / duration;
    
    console.log(`Simple logging: ${iterations} logs in ${duration.toFixed(2)}ms (${logsPerMs.toFixed(0)} logs/ms)`);
    
    expect(stdoutSpy).toHaveBeenCalledTimes(iterations);
    expect(duration).toBeLessThan(1000); // Should complete in under 1 second
  });

  test("should handle structured logging efficiently", () => {
    const iterations = 5000;
    
    const start = performance.now();
    for (let i = 0; i < iterations; i++) {
      slog.info("Structured log message", {
        iteration: i,
        userId: `user-${i}`,
        timestamp: Date.now(),
        success: i % 2 === 0,
        duration: Math.random() * 100
      });
    }
    const end = performance.now();
    
    const duration = end - start;
    const logsPerMs = iterations / duration;
    
    console.log(`Structured logging: ${iterations} logs in ${duration.toFixed(2)}ms (${logsPerMs.toFixed(0)} logs/ms)`);
    
    expect(stdoutSpy).toHaveBeenCalledTimes(iterations);
    expect(duration).toBeLessThan(2000); // Should complete in under 2 seconds
  });

  test("should handle complex object serialization efficiently", () => {
    const iterations = 1000;
    const complexObject = {
      user: {
        id: 12345,
        name: "John Doe",
        email: "john@example.com",
        preferences: {
          theme: "dark",
          notifications: true,
          features: ["feature1", "feature2", "feature3"]
        }
      },
      request: {
        method: "POST",
        path: "/api/users/12345",
        headers: {
          "content-type": "application/json",
          "user-agent": "TestClient/1.0"
        },
        body: {
          action: "update",
          fields: ["name", "email"]
        }
      },
      metadata: {
        trace_id: "abc-123-def-456",
        span_id: "789-xyz",
        timestamp: Date.now()
      }
    };
    
    const start = performance.now();
    for (let i = 0; i < iterations; i++) {
      slog.info("Complex object logging", complexObject);
    }
    const end = performance.now();
    
    const duration = end - start;
    const logsPerMs = iterations / duration;
    
    console.log(`Complex object logging: ${iterations} logs in ${duration.toFixed(2)}ms (${logsPerMs.toFixed(0)} logs/ms)`);
    
    expect(stdoutSpy).toHaveBeenCalledTimes(iterations);
    expect(duration).toBeLessThan(5000); // Should complete in under 5 seconds
  });

  test("should handle array serialization efficiently", () => {
    const iterations = 1000;
    const arrays = {
      numbers: Array.from({ length: 100 }, (_, i) => i),
      strings: Array.from({ length: 50 }, (_, i) => `item-${i}`),
      mixed: [1, "two", true, null, { id: 123 }, [1, 2, 3]],
      nested: [
        { users: [{ id: 1, name: "Alice" }, { id: 2, name: "Bob" }] },
        { products: [{ sku: "A123", price: 29.99 }, { sku: "B456", price: 19.99 }] }
      ]
    };
    
    const start = performance.now();
    for (let i = 0; i < iterations; i++) {
      slog.info("Array logging", arrays);
    }
    const end = performance.now();
    
    const duration = end - start;
    const logsPerMs = iterations / duration;
    
    console.log(`Array logging: ${iterations} logs in ${duration.toFixed(2)}ms (${logsPerMs.toFixed(0)} logs/ms)`);
    
    expect(stdoutSpy).toHaveBeenCalledTimes(iterations);
    expect(duration).toBeLessThan(10000); // Should complete in under 10 seconds
  });

  test("should handle default attributes efficiently", () => {
    const iterations = 5000;
    
    slog.setDefaultAttributes({
      service: "performance-test",
      version: "1.0.0",
      environment: "test",
      node_id: "node-12345",
      region: "us-west-2"
    });
    
    const start = performance.now();
    for (let i = 0; i < iterations; i++) {
      slog.info("Message with default attributes", {
        request_id: `req-${i}`,
        user_id: `user-${i % 100}`,
        action: "test"
      });
    }
    const end = performance.now();
    
    const duration = end - start;
    const logsPerMs = iterations / duration;
    
    console.log(`Default attributes logging: ${iterations} logs in ${duration.toFixed(2)}ms (${logsPerMs.toFixed(0)} logs/ms)`);
    
    expect(stdoutSpy).toHaveBeenCalledTimes(iterations);
    expect(duration).toBeLessThan(2000); // Should complete in under 2 seconds
  });

  test("should handle mixed log levels efficiently", () => {
    const iterations = 10000;
    
    slog.setDefaultLogLevel(slog.DEBUG);
    
    const start = performance.now();
    for (let i = 0; i < iterations; i++) {
      switch (i % 4) {
        case 0:
          slog.debug("Debug message", { iteration: i });
          break;
        case 1:
          slog.info("Info message", { iteration: i });
          break;
        case 2:
          slog.warn("Warning message", { iteration: i });
          break;
        case 3:
          slog.error("Error message", { iteration: i });
          break;
      }
    }
    const end = performance.now();
    
    const duration = end - start;
    const logsPerMs = iterations / duration;
    
    console.log(`Mixed levels logging: ${iterations} logs in ${duration.toFixed(2)}ms (${logsPerMs.toFixed(0)} logs/ms)`);
    
    expect(stdoutSpy.mock.calls.length + stderrSpy.mock.calls.length).toBe(iterations);
    expect(duration).toBeLessThan(1500); // Should complete in under 1.5 seconds
  });

  test("should handle level filtering efficiently", () => {
    const iterations = 20000;
    
    // Set level to ERROR, so only error messages should be processed
    slog.setDefaultLogLevel(slog.ERROR);
    
    const start = performance.now();
    for (let i = 0; i < iterations; i++) {
      // Only 1/4 of these should actually be processed
      switch (i % 4) {
        case 0:
          slog.debug("Debug message", { iteration: i });
          break;
        case 1:
          slog.info("Info message", { iteration: i });
          break;
        case 2:
          slog.warn("Warning message", { iteration: i });
          break;
        case 3:
          slog.error("Error message", { iteration: i });
          break;
      }
    }
    const end = performance.now();
    
    const duration = end - start;
    const logsPerMs = iterations / duration;
    
    console.log(`Level filtering: ${iterations} calls in ${duration.toFixed(2)}ms (${logsPerMs.toFixed(0)} calls/ms)`);
    
    // Only error messages should have been logged
    expect(stderrSpy).toHaveBeenCalledTimes(iterations / 4);
    expect(stdoutSpy).toHaveBeenCalledTimes(0);
    expect(duration).toBeLessThan(500); // Should be very fast due to early returns
  });

  test("should handle unicode characters efficiently", () => {
    const iterations = 1000;
    const unicodeText = {
      emoji: "🚀🌟💻🔥⭐️🎉🎯🔑💡🌍",
      chinese: "你好世界，这是一个测试消息",
      japanese: "こんにちは世界、これはテストメッセージです",
      arabic: "مرحبا بالعالم، هذه رسالة اختبار",
      cyrillic: "Привет мир, это тестовое сообщение",
      mathematical: "∑ ∫ ∂ ∇ ∞ ≈ ≠ ≤ ≥ ± √ ∴ ∵ ∝",
      symbols: "♠ ♣ ♥ ♦ ♪ ♫ ☀ ☁ ☂ ☃ ❄ ⚡ ✓ ✗ ⚠ ⚙"
    };
    
    const start = performance.now();
    for (let i = 0; i < iterations; i++) {
      slog.info("Unicode test message", unicodeText);
    }
    const end = performance.now();
    
    const duration = end - start;
    const logsPerMs = iterations / duration;
    
    console.log(`Unicode logging: ${iterations} logs in ${duration.toFixed(2)}ms (${logsPerMs.toFixed(0)} logs/ms)`);
    
    expect(stdoutSpy).toHaveBeenCalledTimes(iterations);
    expect(duration).toBeLessThan(5000); // Should complete in under 5 seconds
  });

  test("memory usage should remain stable during intensive logging", () => {
    const iterations = 1000;
    
    // Force garbage collection if available
    if (global.gc) {
      global.gc();
    }
    
    const initialMemory = process.memoryUsage();
    
    for (let i = 0; i < iterations; i++) {
      slog.info("Memory test message", {
        iteration: i,
        data: {
          array: Array.from({ length: 10 }, (_, j) => `item-${j}`),
          object: { key1: "value1", key2: "value2", key3: "value3" },
          number: Math.random() * 1000,
          boolean: i % 2 === 0
        }
      });
    }
    
    // Force garbage collection if available
    if (global.gc) {
      global.gc();
    }
    
    const finalMemory = process.memoryUsage();
    const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
    
    console.log(`Memory increase: ${(memoryIncrease / 1024 / 1024).toFixed(2)} MB for ${iterations} logs`);
    
    expect(stdoutSpy).toHaveBeenCalledTimes(iterations);
    // Memory increase should be reasonable (less than 10MB for 1000 logs)
    expect(memoryIncrease).toBeLessThan(10 * 1024 * 1024);
  });
}); 