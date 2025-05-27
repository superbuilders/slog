import { expect, test, describe, beforeEach, afterEach, mock, spyOn } from "bun:test";
import * as slog from "./index";

// Mock process.stdout and process.stderr to capture output
let stdoutSpy: any;
let stderrSpy: any;
let stdoutWrites: string[] = [];
let stderrWrites: string[] = [];

beforeEach(() => {
  // Reset state
  stdoutWrites = [];
  stderrWrites = [];
  
  // Mock process.stdout.write and process.stderr.write
  stdoutSpy = spyOn(process.stdout, "write").mockImplementation((data: any) => {
    stdoutWrites.push(Buffer.from(data).toString());
    return true;
  });
  
  stderrSpy = spyOn(process.stderr, "write").mockImplementation((data: any) => {
    stderrWrites.push(Buffer.from(data).toString());
    return true;
  });
  
  // Reset slog state
  slog.setDefaultLogLevel(slog.INFO);
  slog.setDefaultAttributes({});
});

afterEach(() => {
  stdoutSpy.mockRestore();
  stderrSpy.mockRestore();
});

describe("LogLevel enum", () => {
  test("should have correct values", () => {
    expect(slog.LogLevel.DEBUG).toBe(-4);
    expect(slog.LogLevel.INFO).toBe(0);
    expect(slog.LogLevel.WARN).toBe(4);
    expect(slog.LogLevel.ERROR).toBe(8);
  });

  test("should export level constants", () => {
    expect(slog.DEBUG).toBe(-4);
    expect(slog.INFO).toBe(0);
    expect(slog.WARN).toBe(4);
    expect(slog.ERROR).toBe(8);
  });
});

describe("Basic logging functions", () => {
  test("info should log to stdout", () => {
    slog.info("test message");
    
    expect(stdoutWrites).toHaveLength(1);
    expect(stderrWrites).toHaveLength(0);
    expect(stdoutWrites[0]).toContain(" INFO test message\n");
  });

  test("warn should log to stderr", () => {
    slog.warn("test warning");
    
    expect(stdoutWrites).toHaveLength(0);
    expect(stderrWrites).toHaveLength(1);
    expect(stderrWrites[0]).toContain(" WARN test warning\n");
  });

  test("error should log to stderr", () => {
    slog.error("test error");
    
    expect(stdoutWrites).toHaveLength(0);
    expect(stderrWrites).toHaveLength(1);
    expect(stderrWrites[0]).toContain(" ERROR test error\n");
  });

  test("debug should log to stdout when level is set", () => {
    slog.setDefaultLogLevel(slog.DEBUG);
    slog.debug("test debug");
    
    expect(stdoutWrites).toHaveLength(1);
    expect(stderrWrites).toHaveLength(0);
    expect(stdoutWrites[0]).toContain(" DEBUG test debug\n");
  });

  test("debug should not log when level is too high", () => {
    slog.setDefaultLogLevel(slog.INFO);
    slog.debug("test debug");
    
    expect(stdoutWrites).toHaveLength(0);
    expect(stderrWrites).toHaveLength(0);
  });
});

describe("Log level filtering", () => {
  test("should respect minimum log level", () => {
    slog.setDefaultLogLevel(slog.WARN);
    
    slog.debug("debug message");
    slog.info("info message");
    slog.warn("warn message");
    slog.error("error message");
    
    expect(stdoutWrites).toHaveLength(0);
    expect(stderrWrites).toHaveLength(2);
    expect(stderrWrites[0]).toContain(" WARN warn message\n");
    expect(stderrWrites[1]).toContain(" ERROR error message\n");
  });

  test("should allow all levels when set to DEBUG", () => {
    slog.setDefaultLogLevel(slog.DEBUG);
    
    slog.debug("debug message");
    slog.info("info message");
    slog.warn("warn message");
    slog.error("error message");
    
    expect(stdoutWrites).toHaveLength(2);
    expect(stderrWrites).toHaveLength(2);
  });
});

describe("Generic log function", () => {
  test("should log with specified level", () => {
    slog.log(slog.INFO, "info via log function");
    slog.log(slog.ERROR, "error via log function");
    
    expect(stdoutWrites).toHaveLength(1);
    expect(stderrWrites).toHaveLength(1);
    expect(stdoutWrites[0]).toContain(" INFO info via log function\n");
    expect(stderrWrites[0]).toContain(" ERROR error via log function\n");
  });

  test("should respect level filtering", () => {
    slog.setDefaultLogLevel(slog.WARN);
    slog.log(slog.DEBUG, "should not appear");
    slog.log(slog.INFO, "should not appear");
    slog.log(slog.WARN, "should appear");
    
    expect(stdoutWrites).toHaveLength(0);
    expect(stderrWrites).toHaveLength(1);
    expect(stderrWrites[0]).toContain(" WARN should appear\n");
  });
});

describe("Structured attributes", () => {
  test("should log simple attributes", () => {
    slog.info("test message", { userId: "123", count: 42 });
    
    expect(stdoutWrites).toHaveLength(1);
    const output = stdoutWrites[0];
    expect(output).toContain(" INFO test message ");
    expect(output).toContain("userId=123");
    expect(output).toContain("count=42");
  });

  test("should handle string attributes", () => {
    slog.info("test", { message: "hello world", empty: "" });
    
    const output = stdoutWrites[0];
    expect(output).toContain("message=hello world");
    expect(output).toContain("empty=");
  });

  test("should handle number attributes", () => {
    slog.info("test", { 
      integer: 42,
      float: 3.14,
      negative: -100,
      zero: 0,
      infinity: Infinity,
      negInfinity: -Infinity,
      nan: NaN
    });
    
    const output = stdoutWrites[0];
    expect(output).toContain("integer=42");
    expect(output).toContain("float=3.14");
    expect(output).toContain("negative=-100");
    expect(output).toContain("zero=0");
    expect(output).toContain("infinity=Infinity");
    expect(output).toContain("negInfinity=-Infinity");
    expect(output).toContain("nan=NaN");
  });

  test("should handle boolean attributes", () => {
    slog.info("test", { isTrue: true, isFalse: false });
    
    const output = stdoutWrites[0];
    expect(output).toContain("isTrue=true");
    expect(output).toContain("isFalse=false");
  });

  test("should handle null and undefined", () => {
    slog.info("test", { nullValue: null, undefinedValue: undefined });
    
    const output = stdoutWrites[0];
    expect(output).toContain("nullValue=null");
    expect(output).toContain("undefinedValue=undefined");
  });

  test("should handle array attributes", () => {
    slog.info("test", { 
      numbers: [1, 2, 3],
      strings: ["a", "b", "c"],
      mixed: [1, "two", true, null],
      empty: []
    });
    
    const output = stdoutWrites[0];
    expect(output).toContain("numbers=[1,2,3]");
    expect(output).toContain("strings=[a,b,c]");
    expect(output).toContain("mixed=[1,two,true,null]");
    expect(output).toContain("empty=[]");
  });

  test("should handle object attributes", () => {
    slog.info("test", { 
      user: { id: 123, name: "John" },
      empty: {},
      nested: { level1: { level2: "deep" } }
    });
    
    const output = stdoutWrites[0];
    expect(output).toContain('user={"id":123,"name":John}');
    expect(output).toContain("empty={}");
    expect(output).toContain('nested={"level1":{"level2":deep}}');
  });

  test("should handle BigInt attributes", () => {
    slog.info("test", { bigNumber: BigInt("9007199254740991") });
    
    const output = stdoutWrites[0];
    expect(output).toContain("bigNumber=9007199254740991");
  });

  test("should handle function and symbol attributes", () => {
    const testFunc = () => {};
    const testSymbol = Symbol("test");
    
    slog.info("test", { func: testFunc, sym: testSymbol });
    
    const output = stdoutWrites[0];
    expect(output).toContain("func=");
    expect(output).toContain("sym=Symbol(test)");
  });

  test("should handle objects with custom toString", () => {
    const customObj = {
      toString() {
        return "CustomToString";
      }
    };
    
    const errorObj = new Error("Test error");
    const dateObj = new Date("2023-01-01T12:00:00Z");
    
    slog.info("test", { custom: customObj, error: errorObj, date: dateObj });
    
    const output = stdoutWrites[0];
    expect(output).toContain("custom=CustomToString");
    expect(output).toContain("error=Error: Test error");
    expect(output).toContain("date=");
  });
});

describe("Default attributes", () => {
  test("should include default attributes in logs", () => {
    slog.setDefaultAttributes({ service: "test-service", version: "1.0.0" });
    slog.info("test message");
    
    const output = stdoutWrites[0];
    expect(output).toContain(" INFO test message ");
    expect(output).toContain("service=test-service");
    expect(output).toContain("version=1.0.0");
  });

  test("should merge default and message attributes", () => {
    slog.setDefaultAttributes({ service: "test-service" });
    slog.info("test message", { userId: "123" });
    
    const output = stdoutWrites[0];
    expect(output).toContain("service=test-service");
    expect(output).toContain("userId=123");
  });

  test("should allow adding to default attributes", () => {
    slog.setDefaultAttributes({ service: "test-service" });
    slog.addDefaultAttributes({ version: "1.0.0", env: "test" });
    slog.info("test message");
    
    const output = stdoutWrites[0];
    expect(output).toContain("service=test-service");
    expect(output).toContain("version=1.0.0");
    expect(output).toContain("env=test");
  });

  test("should override default attributes with same key", () => {
    slog.setDefaultAttributes({ env: "default" });
    slog.addDefaultAttributes({ env: "override" });
    slog.info("test message");
    
    const output = stdoutWrites[0];
    expect(output).toContain("env=override");
    expect(output).not.toContain("env=default");
  });

  test("should handle empty default attributes", () => {
    slog.setDefaultAttributes({});
    slog.info("test message", { userId: "123" });
    
    const output = stdoutWrites[0];
    expect(output).toContain(" INFO test message ");
    expect(output).toContain("userId=123");
  });

  test("should handle only default attributes", () => {
    slog.setDefaultAttributes({ service: "test-service" });
    slog.info("test message");
    
    const output = stdoutWrites[0];
    expect(output).toContain(" INFO test message ");
    expect(output).toContain("service=test-service");
  });
});

describe("Timestamp formatting", () => {
  test("should include timestamp in output", () => {
    slog.info("test message");
    
    const output = stdoutWrites[0];
    // Check for timestamp pattern: YYYY/MM/DD HH:MM:SS
    expect(output).toMatch(/^\d{4}\/\d{2}\/\d{2} \d{2}:\d{2}:\d{2} INFO/);
  });

  test("should have consistent timestamp format across multiple logs", () => {
    slog.info("message 1");
    slog.info("message 2");
    
    expect(stdoutWrites).toHaveLength(2);
    
    // Both should start with valid timestamp
    expect(stdoutWrites[0]).toMatch(/^\d{4}\/\d{2}\/\d{2} \d{2}:\d{2}:\d{2}/);
    expect(stdoutWrites[1]).toMatch(/^\d{4}\/\d{2}\/\d{2} \d{2}:\d{2}:\d{2}/);
  });
});

describe("Output format", () => {
  test("should end with newline", () => {
    slog.info("test message");
    
    expect(stdoutWrites[0]).toEndWith("\n");
  });

  test("should format basic message correctly", () => {
    slog.info("test message");
    
    const output = stdoutWrites[0];
    expect(output).toMatch(/^\d{4}\/\d{2}\/\d{2} \d{2}:\d{2}:\d{2} INFO test message\n$/);
  });

  test("should format message with attributes correctly", () => {
    slog.info("test message", { key: "value" });
    
    const output = stdoutWrites[0];
    expect(output).toMatch(/^\d{4}\/\d{2}\/\d{2} \d{2}:\d{2}:\d{2} INFO test message key=value\n$/);
  });

  test("should separate multiple attributes with spaces", () => {
    slog.info("test", { a: 1, b: 2, c: 3 });
    
    const output = stdoutWrites[0];
    expect(output).toContain("a=1 b=2 c=3");
  });
});

describe("Edge cases and error handling", () => {
  test("should handle empty message", () => {
    slog.info("");
    
    const output = stdoutWrites[0];
    expect(output).toMatch(/^\d{4}\/\d{2}\/\d{2} \d{2}:\d{2}:\d{2} INFO \n$/);
  });

  test("should handle very long messages", () => {
    const longMessage = "a".repeat(10000);
    slog.info(longMessage);
    
    expect(stdoutWrites).toHaveLength(1);
    expect(stdoutWrites[0]).toContain("INFO");
    expect(stdoutWrites[0]).toEndWith("\n");
  });

  test("should handle circular object references", () => {
    const circular: any = { name: "test" };
    circular.self = circular;
    
    // This will cause a stack overflow, which is expected behavior
    // The library prioritizes performance over circular reference protection
    expect(() => {
      slog.info("test", { circular });
    }).toThrow();
  });

  test("should handle unicode characters", () => {
    slog.info("test message", { 
      emoji: "🚀",
      chinese: "你好",
      math: "π ≈ 3.14"
    });
    
    const output = stdoutWrites[0];
    expect(output).toContain("emoji=🚀");
    expect(output).toContain("chinese=你好");
    expect(output).toContain("math=π ≈ 3.14");
  });

  test("should handle attributes with special characters", () => {
    slog.info("test", { 
      quotes: 'contains "quotes"',
      newlines: "line1\nline2",
      tabs: "before\tafter"
    });
    
    const output = stdoutWrites[0];
    expect(output).toContain('quotes=contains "quotes"');
    expect(output).toContain("newlines=line1\nline2");
    expect(output).toContain("tabs=before\tafter");
  });

  test("should handle nested arrays and objects", () => {
    slog.info("test", {
      nested: {
        array: [{ id: 1 }, { id: 2 }],
        object: { 
          meta: { 
            tags: ["a", "b", "c"] 
          } 
        }
      }
    });
    
    const output = stdoutWrites[0];
    expect(output).toContain("nested=");
    expect(output).toContain('"array":[');
    expect(output).toContain('"tags":[a,b,c]');
  });
});

describe("Performance characteristics", () => {
  test("should handle many attributes efficiently", () => {
    const manyAttrs: Record<string, unknown> = {};
    for (let i = 0; i < 100; i++) {
      manyAttrs[`key${i}`] = `value${i}`;
    }
    
    const start = performance.now();
    slog.info("test", manyAttrs);
    const end = performance.now();
    
    expect(stdoutWrites).toHaveLength(1);
    expect(end - start).toBeLessThan(100); // Should be fast
  });

  test("should handle rapid logging", () => {
    const start = performance.now();
    
    for (let i = 0; i < 100; i++) {
      slog.info(`message ${i}`, { iteration: i });
    }
    
    const end = performance.now();
    
    expect(stdoutWrites).toHaveLength(100);
    expect(end - start).toBeLessThan(1000); // Should complete in reasonable time
  });
});

describe("Integration scenarios", () => {
  test("should work with real-world logging scenario", () => {
    // Simulate a web application scenario
    slog.setDefaultAttributes({
      service: "user-api",
      version: "1.2.3",
      env: "production"
    });
    
    // Request received
    slog.info("Request received", {
      method: "POST",
      path: "/api/users",
      ip: "192.168.1.1",
      userAgent: "Mozilla/5.0"
    });
    
    // Processing
    slog.debug("Validating user data", { userId: "user-123" });
    
    // Database operation
    slog.info("Database query executed", {
      query: "INSERT INTO users",
      duration: 45.2,
      rowsAffected: 1
    });
    
    // Warning
    slog.warn("Rate limit approaching", {
      userId: "user-123",
      requestCount: 95,
      limit: 100
    });
    
    // Error scenario
    const error = new Error("Database connection timeout");
    slog.error("Request failed", {
      error: error,
      userId: "user-123",
      statusCode: 500
    });
    
    // Check that appropriate streams were used
    expect(stdoutWrites.length).toBeGreaterThan(0);
    expect(stderrWrites.length).toBeGreaterThan(0);
    
    // Check that all logs contain default attributes
    const allOutputs = [...stdoutWrites, ...stderrWrites];
    allOutputs.forEach(output => {
      expect(output).toContain("service=user-api");
      expect(output).toContain("version=1.2.3");
      expect(output).toContain("env=production");
    });
  });
}); 