/**
 * High-performance structured logging library inspired by Go's slog.
 *
 * Features:
 * - Zero-allocation byte buffer operations for maximum performance
 * - Structured logging with key-value attributes
 * - Automatic toString() handling for objects with custom toString methods
 * - Configurable log levels
 * - Optimized timestamp caching
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

const BUFFER_SIZE = 8192
const logBuffer = new ArrayBuffer(BUFFER_SIZE)
const logView = new Uint8Array(logBuffer)
const encoder = new TextEncoder()

// Pre-allocated buffers for number-to-string conversion
const NUMBER_BUFFER_SIZE = 64
const numberConversionBuffer = new ArrayBuffer(NUMBER_BUFFER_SIZE)
const numberConversionView = new Uint8Array(numberConversionBuffer)
const numberDecoder = new TextDecoder()

const STATIC_BYTES = {
	DEBUG: encoder.encode(" DEBUG "),
	INFO: encoder.encode(" INFO "),
	WARN: encoder.encode(" WARN "),
	ERROR: encoder.encode(" ERROR "),
	NEWLINE: encoder.encode("\n"),
	SPACE: encoder.encode(" "),
	EQUALS: encoder.encode("="),
	SLASH: encoder.encode("/"),
	COLON: encoder.encode(":"),
	NULL: encoder.encode("null"),
	UNDEFINED: encoder.encode("undefined"),
	TRUE: encoder.encode("true"),
	FALSE: encoder.encode("false"),
	QUOTE: encoder.encode('"'),
	BRACKET_OPEN: encoder.encode("["),
	BRACKET_CLOSE: encoder.encode("]"),
	BRACE_OPEN: encoder.encode("{"),
	BRACE_CLOSE: encoder.encode("}"),
	COMMA: encoder.encode(","),
	ZERO: encoder.encode("0"),
	MINUS: encoder.encode("-"),
	DOT: encoder.encode(".")
}

const cachedTimestampBytes = new Uint8Array(19)
const cachedSecondsBytes = new Uint8Array(2)
let lastCacheTime = 0
let timestampLength = 0
let secondsLength = 0

function updateTimestampCache(): void {
	const now = Date.now()
	const timeDiff = now - lastCacheTime

	if (timeDiff >= 1000) {
		const dateObj = new Date(now)

		// Use direct arithmetic for much faster digit-to-ASCII conversion
		let pos = 0

		// Year (4 digits)
		const year = dateObj.getFullYear()
		cachedTimestampBytes[pos++] = 48 + (Math.floor(year / 1000) % 10)
		cachedTimestampBytes[pos++] = 48 + (Math.floor(year / 100) % 10)
		cachedTimestampBytes[pos++] = 48 + (Math.floor(year / 10) % 10)
		cachedTimestampBytes[pos++] = 48 + (year % 10)
		cachedTimestampBytes[pos++] = 47 // "/"

		// Month (2 digits, 1-indexed)
		const month = dateObj.getMonth() + 1
		cachedTimestampBytes[pos++] = 48 + Math.floor(month / 10)
		cachedTimestampBytes[pos++] = 48 + (month % 10)
		cachedTimestampBytes[pos++] = 47 // "/"

		// Day (2 digits)
		const day = dateObj.getDate()
		cachedTimestampBytes[pos++] = 48 + Math.floor(day / 10)
		cachedTimestampBytes[pos++] = 48 + (day % 10)
		cachedTimestampBytes[pos++] = 32 // " "

		// Hours (2 digits)
		const hours = dateObj.getHours()
		cachedTimestampBytes[pos++] = 48 + Math.floor(hours / 10)
		cachedTimestampBytes[pos++] = 48 + (hours % 10)
		cachedTimestampBytes[pos++] = 58 // ":"

		// Minutes (2 digits)
		const minutes = dateObj.getMinutes()
		cachedTimestampBytes[pos++] = 48 + Math.floor(minutes / 10)
		cachedTimestampBytes[pos++] = 48 + (minutes % 10)
		cachedTimestampBytes[pos++] = 58 // ":"

		timestampLength = pos

		// Seconds (2 digits) - separate cache for sub-second updates
		const seconds = dateObj.getSeconds()
		cachedSecondsBytes[0] = 48 + Math.floor(seconds / 10)
		cachedSecondsBytes[1] = 48 + (seconds % 10)
		secondsLength = 2

		lastCacheTime = now
	}
}

let minimumLevel: LogLevel = LogLevel.INFO

function writeBytes(target: Uint8Array, offset: number, source: Uint8Array): number {
	const remainingSpace = BUFFER_SIZE - offset
	if (remainingSpace <= 0) {
		return offset
	}

	const bytesToWrite = Math.min(source.length, remainingSpace)
	target.set(source.subarray(0, bytesToWrite), offset)
	return offset + bytesToWrite
}

function writeStringAsBytes(target: Uint8Array, offset: number, str: string): number {
	const remainingSpace = BUFFER_SIZE - offset
	if (remainingSpace <= 0) {
		return offset
	}

	// Fast path for ASCII-only strings (common case)
	let isAscii = true
	const strLength = str.length
	for (let i = 0; i < strLength; i++) {
		if (str.charCodeAt(i) > 127) {
			isAscii = false
			break
		}
	}

	if (isAscii) {
		// Direct byte writing for ASCII strings - much faster than TextEncoder
		const charsToWrite = Math.min(strLength, remainingSpace)
		for (let i = 0; i < charsToWrite; i++) {
			target[offset + i] = str.charCodeAt(i)
		}
		return offset + charsToWrite
	}

	// Fallback to TextEncoder for non-ASCII strings - truncate if needed
	const result = encoder.encodeInto(str, target.subarray(offset))
	return offset + (result.written ?? 0)
}

function writeNumberAsBytes(target: Uint8Array, offset: number, num: number): number {
	// Handle special cases
	if (Number.isNaN(num)) return writeStringAsBytes(target, offset, "NaN") // NaN check
	if (num === Number.POSITIVE_INFINITY) return writeStringAsBytes(target, offset, "Infinity")
	if (num === Number.NEGATIVE_INFINITY) return writeStringAsBytes(target, offset, "-Infinity")

	let pos = offset
	let value = num // Use local variable to avoid parameter reassignment

	// Handle negative numbers
	if (value < 0) {
		pos = writeBytes(target, pos, STATIC_BYTES.MINUS)
		value = -value
	}

	// Handle zero
	if (value === 0) {
		return writeBytes(target, pos, STATIC_BYTES.ZERO)
	}

	// Handle integers vs decimals
	if (Number.isInteger(value) && value < Number.MAX_SAFE_INTEGER) {
		// Integer path - no decimal point, zero allocation approach
		let temp = Math.floor(value)

		// Count digits first
		let digitCount = 0
		let tempCount = temp
		while (tempCount > 0) {
			digitCount++
			tempCount = Math.floor(tempCount / 10)
		}

		// Check buffer space
		if (pos + digitCount > target.length) {
			return pos // Not enough space
		}

		// Write digits from right to left
		let writePos = pos + digitCount - 1
		while (temp > 0) {
			target[writePos--] = 48 + (temp % 10)
			temp = Math.floor(temp / 10)
		}

		return pos + digitCount
	}
	// Fallback to string conversion for floats (to avoid complex decimal logic)
	
	// Use pre-allocated buffer to avoid template literal allocation
	const result = encoder.encodeInto(value.toString(), numberConversionView)
	const bytesToCopy = Math.min(result.written ?? 0, target.length - offset)
	if (bytesToCopy > 0) {
		target.set(numberConversionView.subarray(0, bytesToCopy), offset)
	}
	return offset + bytesToCopy
}

function serializeValueToBuffer(target: Uint8Array, offset: number, value: unknown): number {
	// Fast path for common null/undefined cases
	if (value === null) return writeBytes(target, offset, STATIC_BYTES.NULL)
	if (value === undefined) return writeBytes(target, offset, STATIC_BYTES.UNDEFINED)

	// Use switch for better optimization by JS engines
	const valueType = typeof value
	switch (valueType) {
		case "string":
			return writeStringAsBytes(target, offset, value as string)
		case "number":
			return writeNumberAsBytes(target, offset, value as number)
		case "boolean":
			return writeBytes(target, offset, value ? STATIC_BYTES.TRUE : STATIC_BYTES.FALSE)
		case "bigint":
			return writeStringAsBytes(target, offset, `${value}`)
		case "symbol":
			return writeStringAsBytes(target, offset, String(value))
		case "function":
			return writeStringAsBytes(target, offset, `${value}`)
		case "object": {
			// Fast path for arrays (most common object type in logs)
			if (Array.isArray(value)) {
				let pos = writeBytes(target, offset, STATIC_BYTES.BRACKET_OPEN)
				const length = value.length
				for (let i = 0; i < length; i++) {
					if (i > 0) pos = writeBytes(target, pos, STATIC_BYTES.COMMA)
					pos = serializeValueToBuffer(target, pos, value[i])
				}
				return writeBytes(target, pos, STATIC_BYTES.BRACKET_CLOSE)
			}

			// Check for custom toString (Error objects, Date, etc.)
			const valueWithToString = value as { toString?: () => string }
			const customToString = valueWithToString.toString
			if (typeof customToString === "function" && customToString !== Object.prototype.toString) {
				return writeStringAsBytes(target, offset, customToString.call(value))
			}

			// Generic object serialization - zero allocation for...in loop
			const objectValue = value as Record<string, unknown>
			let pos = writeBytes(target, offset, STATIC_BYTES.BRACE_OPEN)
			let isFirst = true
			for (const key in objectValue) {
				if (Object.hasOwn(objectValue, key)) {
					if (isFirst === false) pos = writeBytes(target, pos, STATIC_BYTES.COMMA)
					pos = writeBytes(target, pos, STATIC_BYTES.QUOTE)
					pos = writeStringAsBytes(target, pos, key)
					pos = writeBytes(target, pos, STATIC_BYTES.QUOTE)
					pos = writeBytes(target, pos, STATIC_BYTES.COLON)
					pos = serializeValueToBuffer(target, pos, objectValue[key])
					isFirst = false
				}
			}
			return writeBytes(target, pos, STATIC_BYTES.BRACE_CLOSE)
		}
		default:
			return writeStringAsBytes(target, offset, `${value}`)
	}
}

function buildAttributesToBuffer(target: Uint8Array, offset: number, attrs?: Record<string, unknown>): number {
	if (!attrs) return offset

	let pos = offset
	let isFirst = true

	// Write passed attributes only
	for (const key in attrs) {
		if (!isFirst) pos = writeBytes(target, pos, STATIC_BYTES.SPACE)
		pos = writeStringAsBytes(target, pos, key)
		pos = writeBytes(target, pos, STATIC_BYTES.EQUALS)
		pos = serializeValueToBuffer(target, pos, attrs[key])
		isFirst = false
	}

	return pos
}

function flushBuffer(length: number): void {
	const slice = logView.subarray(0, length)
	process.stderr.write(slice)
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

	updateTimestampCache()

	let pos = 0
	pos = writeBytes(logView, pos, cachedTimestampBytes.subarray(0, timestampLength))
	pos = writeBytes(logView, pos, cachedSecondsBytes.subarray(0, secondsLength))
	pos = writeBytes(logView, pos, STATIC_BYTES.DEBUG)
	pos = writeStringAsBytes(logView, pos, message)

	if (attributes) {
		pos = writeBytes(logView, pos, STATIC_BYTES.SPACE)
		pos = buildAttributesToBuffer(logView, pos, attributes)
	}

	// Always ensure we end with a newline, even if truncated
	if (pos < BUFFER_SIZE) {
		pos = writeBytes(logView, pos, STATIC_BYTES.NEWLINE)
	} else {
		// Buffer is full, overwrite last byte with newline
		const newlineByte = STATIC_BYTES.NEWLINE[0]
		if (newlineByte !== undefined) {
			logView[BUFFER_SIZE - 1] = newlineByte
		}
		pos = BUFFER_SIZE
	}

	flushBuffer(pos)
}

/**
 * Log an info message with optional structured attributes.
 * @param message The log message
 * @param attributes Optional key-value pairs for structured logging
 */
export function info(message: string, attributes?: Record<string, unknown>): void {
	if (LogLevel.INFO < minimumLevel) return

	updateTimestampCache()

	let pos = 0
	pos = writeBytes(logView, pos, cachedTimestampBytes.subarray(0, timestampLength))
	pos = writeBytes(logView, pos, cachedSecondsBytes.subarray(0, secondsLength))
	pos = writeBytes(logView, pos, STATIC_BYTES.INFO)
	pos = writeStringAsBytes(logView, pos, message)

	if (attributes) {
		pos = writeBytes(logView, pos, STATIC_BYTES.SPACE)
		pos = buildAttributesToBuffer(logView, pos, attributes)
	}

	// Always ensure we end with a newline, even if truncated
	if (pos < BUFFER_SIZE) {
		pos = writeBytes(logView, pos, STATIC_BYTES.NEWLINE)
	} else {
		// Buffer is full, overwrite last byte with newline
		const newlineByte = STATIC_BYTES.NEWLINE[0]
		if (newlineByte !== undefined) {
			logView[BUFFER_SIZE - 1] = newlineByte
		}
		pos = BUFFER_SIZE
	}

	flushBuffer(pos)
}

/**
 * Log a warning message with optional structured attributes.
 * @param message The log message
 * @param attributes Optional key-value pairs for structured logging
 */
export function warn(message: string, attributes?: Record<string, unknown>): void {
	if (LogLevel.WARN < minimumLevel) return

	updateTimestampCache()

	let pos = 0
	pos = writeBytes(logView, pos, cachedTimestampBytes.subarray(0, timestampLength))
	pos = writeBytes(logView, pos, cachedSecondsBytes.subarray(0, secondsLength))
	pos = writeBytes(logView, pos, STATIC_BYTES.WARN)
	pos = writeStringAsBytes(logView, pos, message)

	if (attributes) {
		pos = writeBytes(logView, pos, STATIC_BYTES.SPACE)
		pos = buildAttributesToBuffer(logView, pos, attributes)
	}

	// Always ensure we end with a newline, even if truncated
	if (pos < BUFFER_SIZE) {
		pos = writeBytes(logView, pos, STATIC_BYTES.NEWLINE)
	} else {
		// Buffer is full, overwrite last byte with newline
		const newlineByte = STATIC_BYTES.NEWLINE[0]
		if (newlineByte !== undefined) {
			logView[BUFFER_SIZE - 1] = newlineByte
		}
		pos = BUFFER_SIZE
	}

	flushBuffer(pos)
}

/**
 * Log an error message with optional structured attributes.
 * @param message The log message
 * @param attributes Optional key-value pairs for structured logging
 */
export function error(message: string, attributes?: Record<string, unknown>): void {
	if (LogLevel.ERROR < minimumLevel) return

	updateTimestampCache()

	let pos = 0
	pos = writeBytes(logView, pos, cachedTimestampBytes.subarray(0, timestampLength))
	pos = writeBytes(logView, pos, cachedSecondsBytes.subarray(0, secondsLength))
	pos = writeBytes(logView, pos, STATIC_BYTES.ERROR)
	pos = writeStringAsBytes(logView, pos, message)

	if (attributes) {
		pos = writeBytes(logView, pos, STATIC_BYTES.SPACE)
		pos = buildAttributesToBuffer(logView, pos, attributes)
	}

	// Always ensure we end with a newline, even if truncated
	if (pos < BUFFER_SIZE) {
		pos = writeBytes(logView, pos, STATIC_BYTES.NEWLINE)
	} else {
		// Buffer is full, overwrite last byte with newline
		const newlineByte = STATIC_BYTES.NEWLINE[0]
		if (newlineByte !== undefined) {
			logView[BUFFER_SIZE - 1] = newlineByte
		}
		pos = BUFFER_SIZE
	}

	flushBuffer(pos)
}
