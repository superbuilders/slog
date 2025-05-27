import { expect, test, describe, beforeEach, afterEach, spyOn } from "bun:test";
import * as slog from "./index";

// Mock process.stdout and process.stderr to capture output
let stdoutSpy: any;
let stderrSpy: any;
let stdoutWrites: Uint8Array[] = [];
let stderrWrites: Uint8Array[] = [];

beforeEach(() => {
  // Reset state
  stdoutWrites = [];
  stderrWrites = [];
  
  // Mock process.stdout.write and process.stderr.write to capture raw bytes
  stdoutSpy = spyOn(process.stdout, "write").mockImplementation((data: any) => {
    stdoutWrites.push(new Uint8Array(data));
    return true;
  });
  
  stderrSpy = spyOn(process.stderr, "write").mockImplementation((data: any) => {
    stderrWrites.push(new Uint8Array(data));
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

function bufferToString(buffer: Uint8Array): string {
  return Buffer.from(buffer).toString();
}

describe("Buffer management", () => {
  const BUFFER_SIZE = 8192; // Internal buffer size from the library
  
  test("should handle messages that fit within buffer", () => {
    const message = "Short message";
    slog.info(message);
    
    expect(stdoutWrites).toHaveLength(1);
    const output = bufferToString(stdoutWrites[0]);
    expect(output).toContain(message);
    expect(output).toEndWith("\n");
  });

  test("should handle very long messages gracefully", () => {
    // Create a message that's much larger than the buffer
    const longMessage = "A".repeat(BUFFER_SIZE * 2);
    
    slog.info(longMessage);
    
    expect(stdoutWrites).toHaveLength(1);
    const output = bufferToString(stdoutWrites[0]);
    
    // Output should be truncated but still end with newline
    expect(output).toEndWith("\n");
    expect(output.length).toBeLessThanOrEqual(BUFFER_SIZE);
    expect(output).toContain("INFO");
  });

  test("should handle large attributes that exceed buffer", () => {
    const largeAttributes: Record<string, unknown> = {};
    
    // Create enough attributes to exceed buffer size
    for (let i = 0; i < 1000; i++) {
      largeAttributes[`key${i}`] = `This is a very long value that takes up space in the buffer ${i}`.repeat(10);
    }
    
    slog.info("Message with large attributes", largeAttributes);
    
    expect(stdoutWrites).toHaveLength(1);
    const output = bufferToString(stdoutWrites[0]);
    
    // Should be truncated but still end with newline
    expect(output).toEndWith("\n");
    expect(output.length).toBeLessThanOrEqual(BUFFER_SIZE);
    expect(output).toContain("INFO");
    expect(output).toContain("Message with large attributes");
  });

  test("should preserve newline even when buffer is full", () => {
    // Create a message that exactly fills the buffer (minus newline)
    const exactMessage = "A".repeat(BUFFER_SIZE - 50); // Leave some room for timestamp and level
    
    slog.info(exactMessage);
    
    expect(stdoutWrites).toHaveLength(1);
    const output = bufferToString(stdoutWrites[0]);
    
    // Must always end with newline, even if truncated
    expect(output).toEndWith("\n");
    expect(output.length).toBeLessThanOrEqual(BUFFER_SIZE);
  });

  test("should handle maximum buffer usage efficiently", () => {
    // Test the boundary condition where we approach buffer limits
    const nearMaxMessage = "X".repeat(BUFFER_SIZE - 100);
    
    const start = performance.now();
    slog.info(nearMaxMessage, { extra: "data" });
    const end = performance.now();
    
    expect(stdoutWrites).toHaveLength(1);
    const output = bufferToString(stdoutWrites[0]);
    
    expect(output).toEndWith("\n");
    expect(output).toContain("INFO");
    expect(end - start).toBeLessThan(50); // Should still be fast
  });

  test("should handle rapid buffer usage correctly", () => {
    // Rapidly log messages to test buffer reuse
    const messages = Array.from({ length: 100 }, (_, i) => `Message ${i}`);
    
    for (const message of messages) {
      slog.info(message, { index: messages.indexOf(message) });
    }
    
    expect(stdoutWrites).toHaveLength(100);
    
    // Each message should be properly formatted
    stdoutWrites.forEach((buffer, index) => {
      const output = bufferToString(buffer);
      expect(output).toContain(`Message ${index}`);
      expect(output).toContain(`index=${index}`);
      expect(output).toEndWith("\n");
    });
  });

  test("should handle zero-length writes correctly", () => {
    // Test edge case with empty strings
    slog.info("", {});
    
    expect(stdoutWrites).toHaveLength(1);
    const output = bufferToString(stdoutWrites[0]);
    
    expect(output).toMatch(/^\d{4}\/\d{2}\/\d{2} \d{2}:\d{2}:\d{2} INFO \n$/);
  });

  test("should handle buffer overflow with nested objects", () => {
    // Create deeply nested objects that will cause large serialization
    const createNestedObject = (depth: number): any => {
      if (depth === 0) {
        return "leaf_value_" + "x".repeat(100);
      }
      return {
        level: depth,
        data: "y".repeat(50),
        nested: createNestedObject(depth - 1),
        array: Array.from({ length: 10 }, (_, i) => `item_${i}_${"z".repeat(20)}`)
      };
    };
    
    const deepObject = createNestedObject(20);
    
    slog.info("Deep nested object test", { deep: deepObject });
    
    expect(stdoutWrites).toHaveLength(1);
    const output = bufferToString(stdoutWrites[0]);
    
    expect(output).toEndWith("\n");
    expect(output.length).toBeLessThanOrEqual(BUFFER_SIZE);
    expect(output).toContain("INFO");
    expect(output).toContain("Deep nested object test");
  });

  test("should handle binary-like data in buffer", () => {
    // Test with data that might contain problematic bytes
    const binaryData = {
      nullBytes: "\x00\x01\x02\x03",
      highBytes: "\xFF\xFE\xFD\xFC",
      mixed: "normal\x00binary\xFF\xFE",
      controlChars: "\t\r\n\b\f"
    };
    
    slog.info("Binary data test", binaryData);
    
    expect(stdoutWrites).toHaveLength(1);
    const output = stdoutWrites[0];
    
    // Should not crash and should produce valid output
    expect(output.length).toBeGreaterThan(0);
    expect(output[output.length - 1]).toBe(10); // Last byte should be newline (ASCII 10)
  });

  test("should maintain buffer integrity across multiple writes", () => {
    // Test that buffer doesn't leak data between writes
    slog.info("First message", { secret: "confidential" });
    const firstOutput = bufferToString(stdoutWrites[0]);
    
    slog.info("Second message", { public: "visible" });
    const secondOutput = bufferToString(stdoutWrites[1]);
    
    // Second message should not contain data from first message
    expect(secondOutput).not.toContain("confidential");
    expect(secondOutput).not.toContain("secret");
    expect(secondOutput).toContain("visible");
    expect(secondOutput).toContain("public");
  });

  test("should handle buffer with unicode characters efficiently", () => {
    // Unicode characters can take multiple bytes, testing buffer accounting
    const unicodeMessage = "Test with unicode: 🚀 émojis ñ and açcénts 中文 العربية";
    const unicodeAttrs = {
      field1: "🌟⭐️✨💫",
      field2: "Iñtërnâtiônàlizætiøn",
      field3: "这是一个测试",
      field4: "مرحبا",
      field5: "Привет"
    };
    
    slog.info(unicodeMessage, unicodeAttrs);
    
    expect(stdoutWrites).toHaveLength(1);
    const output = bufferToString(stdoutWrites[0]);
    
    expect(output).toContain(unicodeMessage);
    expect(output).toEndWith("\n");
  });

  test("should handle maximum attribute count", () => {
    // Test with many small attributes to stress the attribute handling
    const manyAttrs: Record<string, unknown> = {};
    for (let i = 0; i < 500; i++) {
      manyAttrs[`attr${i}`] = i;
    }
    
    slog.info("Many attributes test", manyAttrs);
    
    expect(stdoutWrites).toHaveLength(1);
    const output = bufferToString(stdoutWrites[0]);
    
    expect(output).toEndWith("\n");
    expect(output).toContain("Many attributes test");
    // Should contain at least some of the attributes (may be truncated)
    expect(output).toContain("attr0=0");
  });

  test("should handle exact buffer boundary conditions", () => {
    // Test logging at exactly buffer size boundaries
    const sizes = [
      BUFFER_SIZE - 1,
      BUFFER_SIZE,
      BUFFER_SIZE + 1,
      BUFFER_SIZE * 2
    ];
    
    sizes.forEach(size => {
      stdoutWrites = [];
      const message = "A".repeat(Math.max(0, size - 100)); // Account for timestamp/level overhead
      
      slog.info(message);
      
      expect(stdoutWrites).toHaveLength(1);
      const output = bufferToString(stdoutWrites[0]);
      
      expect(output).toEndWith("\n");
      expect(output.length).toBeLessThanOrEqual(BUFFER_SIZE);
    });
  });
}); 