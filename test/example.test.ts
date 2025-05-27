import { expect, test, describe, beforeEach, afterEach, spyOn } from "bun:test";
import * as slog from "../src/index";

// Example usage patterns that users can reference
describe("slog library examples", () => {
  let stdoutSpy: any;
  let stderrSpy: any;
  let outputs: string[] = [];

  beforeEach(() => {
    outputs = [];
    
    stdoutSpy = spyOn(process.stdout, "write").mockImplementation((data: any) => {
      outputs.push(Buffer.from(data).toString());
      return true;
    });
    
    stderrSpy = spyOn(process.stderr, "write").mockImplementation((data: any) => {
      outputs.push(Buffer.from(data).toString());
      return true;
    });
    
    slog.setDefaultLogLevel(slog.INFO);
    slog.setDefaultAttributes({});
  });

  afterEach(() => {
    stdoutSpy.mockRestore();
    stderrSpy.mockRestore();
  });

  test("Basic usage example", () => {
    // Basic logging
    slog.info("Application started");
    slog.warn("This is a warning");
    slog.error("Something went wrong");

    expect(outputs).toHaveLength(3);
    expect(outputs[0]).toContain("INFO Application started");
    expect(outputs[1]).toContain("WARN This is a warning");
    expect(outputs[2]).toContain("ERROR Something went wrong");
  });

  test("Structured logging example", () => {
    // Structured logging with attributes
    slog.info("User logged in", {
      userId: "12345",
      username: "john_doe",
      ip: "192.168.1.100",
      userAgent: "Mozilla/5.0",
      timestamp: Date.now()
    });

    expect(outputs).toHaveLength(1);
    const output = outputs[0];
    expect(output).toContain("User logged in");
    expect(output).toContain("userId=12345");
    expect(output).toContain("username=john_doe");
    expect(output).toContain("ip=192.168.1.100");
  });

  test("Web API logging example", () => {
    // Set up service-wide defaults
    slog.setDefaultAttributes({
      service: "user-api",
      version: "1.2.3",
      environment: "production"
    });

    // Request logging
    slog.info("HTTP request received", {
      method: "POST",
      path: "/api/users",
      contentLength: 1024,
      correlationId: "req-abc-123"
    });

    // Business logic logging
    slog.info("User validation successful", {
      userId: "user-456",
      validationTime: 12.5,
      correlationId: "req-abc-123"
    });

    // Database operation
    slog.info("Database query executed", {
      query: "SELECT * FROM users WHERE id = ?",
      params: ["user-456"],
      duration: 25.3,
      rowCount: 1,
      correlationId: "req-abc-123"
    });

    // Response logging
    slog.info("HTTP response sent", {
      statusCode: 200,
      contentLength: 512,
      duration: 45.8,
      correlationId: "req-abc-123"
    });

    expect(outputs).toHaveLength(4);
    outputs.forEach(output => {
      expect(output).toContain("service=user-api");
      expect(output).toContain("version=1.2.3");
      expect(output).toContain("environment=production");
    });
  });

  test("Error handling and debugging example", () => {
    slog.setDefaultLogLevel(slog.DEBUG);

    try {
      // Simulate some operation
      slog.debug("Starting database operation", { operation: "user-update" });
      
      // Simulate an error
      throw new Error("Database connection timeout");
      
    } catch (error) {
      slog.error("Operation failed", {
        error: error,
        operation: "user-update",
        retryCount: 0,
        timestamp: Date.now()
      });
      
      // Log recovery attempt
      slog.warn("Attempting retry", {
        operation: "user-update",
        retryCount: 1,
        backoffMs: 1000
      });
    }

    expect(outputs.length).toBeGreaterThan(1);
    expect(outputs.some(output => output.includes("DEBUG"))).toBe(true);
    expect(outputs.some(output => output.includes("ERROR") && output.includes("Database connection timeout"))).toBe(true);
  });

  test("Performance monitoring example", () => {
    const startTime = performance.now();
    
    // Simulate some work
    const workTime = 10; // ms
    
    slog.info("Performance metrics", {
      operation: "data-processing",
      recordsProcessed: 1000,
      duration: workTime,
      throughput: 1000 / workTime,
      memoryUsage: process.memoryUsage().heapUsed,
      cpuTime: process.cpuUsage()
    });

    expect(outputs).toHaveLength(1);
    const output = outputs[0];
    expect(output).toContain("Performance metrics");
    expect(output).toContain("recordsProcessed=1000");
    expect(output).toContain("duration=10");
  });

  test("Configuration and level management example", () => {
    // Start with INFO level
    slog.setDefaultLogLevel(slog.INFO);
    
    slog.debug("This won't appear");
    slog.info("This will appear");
    
    // Switch to DEBUG level for troubleshooting
    slog.setDefaultLogLevel(slog.DEBUG);
    
    slog.debug("Now this appears");
    slog.info("This still appears");
    
    // Switch to ERROR level for production
    slog.setDefaultLogLevel(slog.ERROR);
    
    slog.debug("This won't appear");
    slog.info("This won't appear");
    slog.warn("This won't appear");
    slog.error("Only this appears");

    // Should have: 1 info + 1 debug + 1 info + 1 error = 4 total
    expect(outputs).toHaveLength(4);
    expect(outputs[0]).toContain("INFO This will appear");
    expect(outputs[1]).toContain("DEBUG Now this appears");
    expect(outputs[2]).toContain("INFO This still appears");
    expect(outputs[3]).toContain("ERROR Only this appears");
  });

  test("Complex data structures example", () => {
    const complexData = {
      user: {
        id: 12345,
        profile: {
          name: "John Doe",
          email: "john@example.com",
          preferences: {
            theme: "dark",
            notifications: {
              email: true,
              sms: false,
              push: true
            }
          }
        }
      },
      session: {
        id: "sess_abc123",
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 3600000).toISOString(),
        permissions: ["read", "write", "admin"]
      },
      metadata: {
        requestId: "req_xyz789",
        traceId: "trace_def456",
        tags: ["user-action", "profile-update", "audit"]
      }
    };

    slog.info("Complex operation completed", complexData);

    expect(outputs).toHaveLength(1);
    const output = outputs[0];
    expect(output).toContain("Complex operation completed");
    expect(output).toContain('"id":12345');
    expect(output).toContain('"name":John Doe');
    expect(output).toContain('"permissions":[read,write,admin]');
  });

  test("High-frequency logging example", () => {
    // Simulate high-frequency events (like in a game loop or data processing)
    const events = 100;
    
    const start = performance.now();
    
    for (let i = 0; i < events; i++) {
      if (i % 10 === 0) {
        slog.info("Batch processed", {
          batchId: Math.floor(i / 10),
          itemsProcessed: 10,
          totalProcessed: i + 10
        });
      }
      
      if (Math.random() < 0.1) { // 10% chance of warning
        slog.warn("Processing delay detected", {
          itemId: i,
          expectedTime: 1,
          actualTime: 2.5
        });
      }
    }
    
    const end = performance.now();
    
    slog.info("Processing complete", {
      totalItems: events,
      totalTime: end - start,
      throughput: events / (end - start),
      logsGenerated: outputs.length
    });

    // Should be efficient even with many log calls
    expect(end - start).toBeLessThan(100); // Should complete quickly
    expect(outputs.length).toBeGreaterThan(10); // Should have generated logs
  });
}); 