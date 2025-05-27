# slog Test Suite

This document describes the comprehensive test suite for the slog high-performance structured logging library.

## Overview

The test suite consists of 72 tests across 4 test files, covering all aspects of the library including:
- Core functionality and API
- Performance characteristics  
- Buffer management
- Edge cases and error handling
- Real-world usage examples

## Test Files

### `src/index.test.ts` - Core Functionality Tests (40 tests)
The main test suite covering all public APIs and core functionality:

- **LogLevel enum tests**: Validates log level values and constants
- **Basic logging functions**: Tests `debug()`, `info()`, `warn()`, `error()` functions
- **Log level filtering**: Ensures proper level-based filtering
- **Generic log function**: Tests the main `log()` function
- **Structured attributes**: Comprehensive tests for all data types
- **Default attributes**: Tests global attribute management
- **Timestamp formatting**: Validates timestamp generation
- **Output format**: Tests log output structure
- **Edge cases**: Unicode, special characters, empty values
- **Integration scenarios**: Real-world usage patterns

### `src/performance.test.ts` - Performance Benchmarks (9 tests)
Performance-focused tests that measure and validate the high-performance characteristics:

- **Simple logging**: 10,000 logs benchmarked (target: >2000 logs/ms)
- **Structured logging**: 5,000 complex logs (target: >100 logs/ms)
- **Complex object serialization**: 1,000 deep objects (target: >50 logs/ms)
- **Array serialization**: Large array handling
- **Default attributes**: Performance with global attributes
- **Mixed log levels**: Performance across all levels
- **Level filtering**: Efficiency of early returns
- **Unicode handling**: Performance with multi-byte characters
- **Memory stability**: Memory usage validation

### `src/buffer.test.ts` - Buffer Management Tests (13 tests)
Tests focused on the internal 8192-byte buffer management:

- **Buffer boundaries**: Tests at exact buffer limits
- **Truncation behavior**: Handling of oversized messages
- **Newline preservation**: Ensures output always ends with newline
- **Buffer reuse**: Rapid sequential logging
- **Unicode in buffers**: Multi-byte character handling
- **Binary data**: Handling of special bytes and control characters
- **Buffer integrity**: No data leakage between operations

### `test/example.test.ts` - Real-World Examples (8 tests)
Practical usage examples that serve as documentation:

- **Basic usage**: Simple logging patterns
- **Structured logging**: Key-value attribute patterns
- **Web API logging**: HTTP request/response logging
- **Error handling**: Exception and debugging patterns
- **Performance monitoring**: Metrics logging
- **Configuration management**: Log level management
- **Complex data structures**: Deep object and array logging
- **High-frequency logging**: Performance in tight loops

## Running Tests

### All Tests
```bash
bun test
```

### Watch Mode (auto-rerun on file changes)
```bash
bun test:watch
```

### Specific Test Categories
```bash
# Performance tests only
bun test:performance

# Buffer management tests only
bun test:buffer

# Example/documentation tests only
bun test:examples
```

### CI/CD Integration
```bash
# Generate JUnit XML report for CI systems
bun test:ci
```

### Coverage Report
```bash
bun test:coverage
```

## Test Features

### Comprehensive Mocking
- All tests mock `process.stdout.write` and `process.stderr.write`
- Output is captured and validated without console spam
- Tests can inspect exact byte-level output

### Performance Validation
- All performance tests include time constraints
- Memory usage is monitored and validated
- Throughput metrics are displayed during test runs

### Real Output Testing
- Tests validate actual log format and structure
- Timestamp format validation with regex patterns
- Byte-level buffer content verification

### Edge Case Coverage
- Unicode character handling
- Buffer overflow scenarios
- Circular reference detection
- Special character escaping
- Memory boundary testing

## Test Output Examples

### Successful Test Run
```
bun test v1.2.10 (db2e7d7f)

src/index.test.ts:
✓ LogLevel enum > should have correct values [0.04ms]
✓ Basic logging functions > info should log to stdout [0.83ms]
...

Simple logging: 10000 logs in 4.48ms (2234 logs/ms)
✓ Performance benchmarks > should handle simple info logging efficiently [5.47ms]
...

72 pass
0 fail
532 expect() calls
Ran 72 tests across 4 files. [145.00ms]
```

### Performance Benchmarks
The performance tests display real metrics:
- **Simple logging**: >2000 logs/ms
- **Structured logging**: >100 logs/ms  
- **Complex objects**: >50 logs/ms
- **Level filtering**: >5000 calls/ms (early return optimization)

## Test Coverage Areas

### ✅ Fully Covered
- All public API functions
- All log levels and filtering
- All data type serialization
- Buffer management and truncation
- Performance characteristics
- Default attribute handling
- Error conditions and edge cases

### 🔍 Test Insights
- **String optimization**: The library doesn't quote simple strings in JSON for performance
- **Circular references**: Will cause stack overflow (performance over safety trade-off)
- **Buffer efficiency**: 8192-byte buffer is reused efficiently
- **Memory stability**: No memory leaks during intensive logging

## Adding New Tests

When adding features to slog, ensure tests cover:

1. **Functionality**: Does it work as expected?
2. **Performance**: Does it maintain performance characteristics?
3. **Edge cases**: How does it handle invalid/extreme inputs?
4. **Buffer impact**: Does it affect buffer management?
5. **Examples**: Can users understand how to use it?

### Test Structure
```typescript
import { expect, test, describe, beforeEach, afterEach, spyOn } from "bun:test";
import * as slog from "./index";

describe("Feature name", () => {
  let stdoutSpy: any;
  
  beforeEach(() => {
    stdoutSpy = spyOn(process.stdout, "write").mockImplementation(() => true);
    slog.setDefaultLogLevel(slog.INFO);
    slog.setDefaultAttributes({});
  });

  afterEach(() => {
    stdoutSpy.mockRestore();
  });

  test("should do something", () => {
    // Test implementation
  });
});
```

## Continuous Integration

The test suite is designed for CI/CD pipelines:
- Fast execution (typically <200ms)
- No external dependencies
- Deterministic results
- JUnit XML output support
- Memory leak detection
- Performance regression detection

Use `bun test:ci` for automated testing environments. 