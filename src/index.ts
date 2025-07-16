/**
 * High-performance structured logging library inspired by Go's slog.
 *
 * Features:
 * - Structured logging with key-value attributes
 * - Automatic toString() handling for objects with custom toString methods
 * - Configurable log levels
 *
 * Basic usage:
 * ```typescript
 * import * as logger from './slog'
 *
 * logger.info("user logged in", { userId: "123", ip: "192.168.1.1" })
 * logger.error("database connection failed", { error: err })
 * ```
 */

/**
 * Log levels following slog convention.
 * Lower numbers indicate more verbose logging.
 */
enum LogLevel {
	DEBUG = -4,
	INFO = 0,
	WARN = 4,
	ERROR = 8
}

/**
 * Convenient constants for log levels
 */
export const DEBUG = LogLevel.DEBUG
export const INFO = LogLevel.INFO
export const WARN = LogLevel.WARN
export const ERROR = LogLevel.ERROR

let minimumLevel: LogLevel = LogLevel.INFO

function serializeValue(value: unknown): string {
	// Fast path for common null/undefined cases
	if (value === null) return "null"
	if (value === undefined) return "undefined"

	// Use switch for better optimization by JS engines
	const valueType = typeof value
	switch (valueType) {
		case "string":
			return value as string
		case "number":
			return String(value)
		case "boolean":
			return value ? "true" : "false"
		case "bigint":
			return `${value}`
		case "symbol":
			return String(value)
		case "function":
			return `${value}`
		case "object": {
			// Fast path for arrays (most common object type in logs)
			if (Array.isArray(value)) {
				return `[${value.map((item) => serializeValue(item)).join(",")}]`
			}

			// Check for custom toString (Error objects, Date, etc.)
			const valueWithToString = value as { toString?: () => string }
			const customToString = valueWithToString.toString
			if (typeof customToString === "function" && customToString !== Object.prototype.toString) {
				return customToString.call(value)
			}

			// Generic object serialization
			const objectValue = value as Record<string, unknown>
			const parts: string[] = []
			for (const key in objectValue) {
				if (Object.hasOwn(objectValue, key)) {
					parts.push(`"${key}":${serializeValue(objectValue[key])}`)
				}
			}
			return `{${parts.join(",")}}`
		}
		default:
			return `${value}`
	}
}

function buildAttributes(attrs?: Record<string, unknown>): string {
	if (!attrs) return ""

	const parts: string[] = []

	// Write passed attributes only
	for (const key in attrs) {
		parts.push(`${key}=${serializeValue(attrs[key])}`)
	}

	return parts.join(" ")
}

/**
 * Set the minimum log level. Messages below this level will be ignored.
 * @param level The minimum log level to output
 */
export function setDefaultLogLevel(level: typeof DEBUG | typeof INFO | typeof WARN | typeof ERROR): void {
	minimumLevel = level
}

/**
 * Log a debug message with optional structured attributes.
 * @param message The log message
 * @param attributes Optional key-value pairs for structured logging
 */
export function debug(message: string, attributes?: Record<string, unknown>): void {
	if (LogLevel.DEBUG < minimumLevel) return

	const attrs = buildAttributes(attributes)
	const logMessage = attrs ? `DEBUG ${message} ${attrs}` : `DEBUG ${message}`
	console.log(logMessage)
}

/**
 * Log an info message with optional structured attributes.
 * @param message The log message
 * @param attributes Optional key-value pairs for structured logging
 */
export function info(message: string, attributes?: Record<string, unknown>): void {
	if (LogLevel.INFO < minimumLevel) return

	const attrs = buildAttributes(attributes)
	const logMessage = attrs ? `INFO ${message} ${attrs}` : `INFO ${message}`
	console.info(logMessage)
}

/**
 * Log a warning message with optional structured attributes.
 * @param message The log message
 * @param attributes Optional key-value pairs for structured logging
 */
export function warn(message: string, attributes?: Record<string, unknown>): void {
	if (LogLevel.WARN < minimumLevel) return

	const attrs = buildAttributes(attributes)
	const logMessage = attrs ? `WARN ${message} ${attrs}` : `WARN ${message}`
	console.warn(logMessage)
}

/**
 * Log an error message with optional structured attributes.
 * @param message The log message
 * @param attributes Optional key-value pairs for structured logging
 */
export function error(message: string, attributes?: Record<string, unknown>): void {
	if (LogLevel.ERROR < minimumLevel) return

	const attrs = buildAttributes(attributes)
	const logMessage = attrs ? `ERROR ${message} ${attrs}` : `ERROR ${message}`
	console.error(logMessage)
}

/**
 * Logger interface representing the structured logging functionality
 */
export interface Logger {
	debug(message: string, attributes?: Record<string, unknown>): void
	info(message: string, attributes?: Record<string, unknown>): void
	warn(message: string, attributes?: Record<string, unknown>): void
	error(message: string, attributes?: Record<string, unknown>): void
}
