# @superbuilders/slog

High-performance structured logging library inspired by Go's slog.

## Features

- **Zero-allocation byte buffer operations** for maximum performance
- **Structured logging** with key-value attributes  
- **Automatic toString() handling** for objects with custom toString methods
- **Configurable log levels** and default attributes
- **Optimized timestamp caching** to minimize date formatting overhead
- **Built for Node.js and Bun** with ESNext targeting

## Installation

```bash
npm install @superbuilders/slog
# or
bun add @superbuilders/slog
```

## Quick Start

```typescript
import * as slog from '@superbuilders/slog'

// Basic logging
slog.info("user logged in", { userId: "123", ip: "192.168.1.1" })
slog.error("database connection failed", { error: err })

// Set log level
slog.setDefaultLogLevel(slog.DEBUG)

// Set default attributes for all logs
slog.setDefaultAttributes({ service: "api", version: "1.0.0" })
```

## API Reference

### Log Levels

```typescript
import { LogLevel, DEBUG, INFO, WARN, ERROR } from '@superbuilders/slog'

// Available levels (lower numbers = more verbose)
LogLevel.DEBUG  // -4
LogLevel.INFO   // 0  (default)
LogLevel.WARN   // 4
LogLevel.ERROR  // 8

// Convenient constants
DEBUG   // Same as LogLevel.DEBUG
INFO    // Same as LogLevel.INFO
WARN    // Same as LogLevel.WARN  
ERROR   // Same as LogLevel.ERROR
```

### Logging Functions

```typescript
// Level-specific functions
slog.debug("debug message", { key: "value" })
slog.info("info message", { key: "value" })
slog.warn("warning message", { key: "value" })
slog.error("error message", { key: "value" })

// Generic log function
slog.log(LogLevel.INFO, "message", { key: "value" })
```

### Configuration

```typescript
// Set minimum log level
slog.setDefaultLogLevel(LogLevel.WARN) // Only WARN and ERROR will be output

// Set default attributes (replaces existing)
slog.setDefaultAttributes({ 
  service: "api",
  version: "1.0.0" 
})

// Add default attributes (merges with existing)
slog.addDefaultAttributes({ 
  environment: "production",
  region: "us-east-1" 
})
```

## Performance Features

### Zero-Allocation Design
- Uses pre-allocated byte buffers to avoid garbage collection pressure
- Direct ASCII byte writing for common string operations
- Optimized object serialization with custom toString() detection

### Timestamp Caching
- Caches formatted timestamps to avoid repeated date formatting
- Sub-second precision with efficient updates

### Smart Serialization
- Fast path for arrays and common object types
- Automatic detection and use of custom toString() methods (Error objects, Date, etc.)
- Handles special number cases (NaN, Infinity) efficiently

## Output Format

```
2024/05/27 10:15:30 INFO user logged in userId=123 ip=192.168.1.1
2024/05/27 10:15:31 ERROR database connection failed error=Connection timeout
```

## Advanced Usage

### Custom Error Handling
```typescript
try {
  await riskyOperation()
} catch (error) {
  // Error objects automatically use toString()
  slog.error("operation failed", { error, userId: "123" })
}
```

### Structured Data
```typescript
slog.info("user action", {
  userId: "123",
  action: "purchase", 
  items: ["item1", "item2"],
  metadata: { 
    source: "mobile",
    version: "2.1.0" 
  }
})
```

### Performance Monitoring
```typescript
const start = Date.now()
await longRunningOperation()
const duration = Date.now() - start

slog.info("operation completed", { 
  operation: "data_export",
  duration,
  recordCount: 1500
})
```

## TypeScript Support

Full TypeScript support with comprehensive type definitions:

```typescript
import * as slog from '@superbuilders/slog'
import type { LogLevel } from '@superbuilders/slog'

// Type-safe attribute objects
interface UserAttributes {
  userId: string
  email: string
  role: 'admin' | 'user'
}

const attrs: UserAttributes = {
  userId: "123",
  email: "user@example.com", 
  role: "admin"
}

slog.info("user created", attrs)
```

## License

MIT

## Contributing

Contributions welcome! Please ensure all changes maintain the zero-allocation performance characteristics.
