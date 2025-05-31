import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import * as logger from "./index"

// Mock console to capture output
let consoleOutput: string[] = []
let consoleError: string[] = []

const originalWrite = process.stdout.write
const originalErrorWrite = process.stderr.write

function setupMocks() {
	consoleOutput = []
	consoleError = []

	// @ts-ignore
	process.stdout.write = (chunk: string | Uint8Array) => {
		if (chunk instanceof Uint8Array) {
			consoleOutput.push(Buffer.from(chunk).toString())
		} else {
			consoleOutput.push(chunk.toString())
		}
		return true
	}

	// @ts-ignore
	process.stderr.write = (chunk: string | Uint8Array) => {
		if (chunk instanceof Uint8Array) {
			consoleError.push(Buffer.from(chunk).toString())
		} else {
			consoleError.push(chunk.toString())
		}
		return true
	}
}

function teardownMocks() {
	process.stdout.write = originalWrite
	process.stderr.write = originalErrorWrite
}

beforeEach(() => {
	setupMocks()
})

afterEach(() => {
	teardownMocks()
})

describe("Log level constants", () => {
	test("should have correct values", () => {
		expect(logger.DEBUG).toBe(-4)
		expect(logger.INFO).toBe(0)
		expect(logger.WARN).toBe(4)
		expect(logger.ERROR).toBe(8)
	})

	test("should export level constants", () => {
		expect(logger.DEBUG).toBe(-4)
		expect(logger.INFO).toBe(0)
		expect(logger.WARN).toBe(4)
		expect(logger.ERROR).toBe(8)
	})
})

describe("Basic logging functions", () => {
	test("info should log to stdout", () => {
		logger.info("test message")

		expect(consoleOutput).toHaveLength(1)
		expect(consoleError).toHaveLength(0)
		expect(consoleOutput[0]).toContain(" INFO test message\n")
	})

	test("warn should log to stderr", () => {
		logger.warn("test warning")

		expect(consoleOutput).toHaveLength(0)
		expect(consoleError).toHaveLength(1)
		expect(consoleError[0]).toContain(" WARN test warning\n")
	})

	test("error should log to stderr", () => {
		logger.error("test error")

		expect(consoleOutput).toHaveLength(0)
		expect(consoleError).toHaveLength(1)
		expect(consoleError[0]).toContain(" ERROR test error\n")
	})

	test("debug should log to stdout when level is set", () => {
		logger.setDefaultLogLevel(logger.DEBUG)
		logger.debug("test debug")

		expect(consoleOutput).toHaveLength(1)
		expect(consoleError).toHaveLength(0)
		expect(consoleOutput[0]).toContain(" DEBUG test debug\n")
	})

	test("debug should not log when level is too high", () => {
		logger.setDefaultLogLevel(logger.INFO)
		logger.debug("test debug")

		expect(consoleOutput).toHaveLength(0)
		expect(consoleError).toHaveLength(0)
	})
})

describe("Log level filtering", () => {
	test("should respect minimum log level", () => {
		logger.setDefaultLogLevel(logger.WARN)

		logger.debug("debug message")
		logger.info("info message")
		logger.warn("warn message")
		logger.error("error message")

		expect(consoleOutput).toHaveLength(0)
		expect(consoleError).toHaveLength(2)
		expect(consoleError[0]).toContain(" WARN warn message\n")
		expect(consoleError[1]).toContain(" ERROR error message\n")
	})

	test("should allow all levels when set to DEBUG", () => {
		logger.setDefaultLogLevel(logger.DEBUG)

		logger.debug("debug message")
		logger.info("info message")
		logger.warn("warn message")
		logger.error("error message")

		expect(consoleOutput).toHaveLength(2)
		expect(consoleError).toHaveLength(2)
	})
})

describe("Structured attributes", () => {
	test("should log simple attributes", () => {
		logger.info("test message", { userId: "123", count: 42 })

		expect(consoleOutput).toHaveLength(1)
		const output = consoleOutput[0]
		expect(output).toContain(" INFO test message ")
		expect(output).toContain("userId=123")
		expect(output).toContain("count=42")
	})

	test("should handle string attributes", () => {
		logger.info("test", { message: "hello world", empty: "" })

		const output = consoleOutput[0]
		expect(output).toContain("message=hello world")
		expect(output).toContain("empty=")
	})

	test("should handle number attributes", () => {
		logger.info("test", {
			integer: 42,
			float: 3.14,
			negative: -100,
			zero: 0,
			infinity: Number.POSITIVE_INFINITY,
			negInfinity: Number.NEGATIVE_INFINITY,
			nan: Number.NaN
		})

		const output = consoleOutput[0]
		expect(output).toContain("integer=42")
		expect(output).toContain("float=3.14")
		expect(output).toContain("negative=-100")
		expect(output).toContain("zero=0")
		expect(output).toContain("infinity=Infinity")
		expect(output).toContain("negInfinity=-Infinity")
		expect(output).toContain("nan=NaN")
	})

	test("should handle boolean attributes", () => {
		logger.info("test", { isTrue: true, isFalse: false })

		const output = consoleOutput[0]
		expect(output).toContain("isTrue=true")
		expect(output).toContain("isFalse=false")
	})

	test("should handle null and undefined", () => {
		logger.info("test", { nullValue: null, undefinedValue: undefined })

		const output = consoleOutput[0]
		expect(output).toContain("nullValue=null")
		expect(output).toContain("undefinedValue=undefined")
	})

	test("should handle array attributes", () => {
		logger.info("test", {
			numbers: [1, 2, 3],
			strings: ["a", "b", "c"],
			mixed: [1, "two", true, null],
			empty: []
		})

		const output = consoleOutput[0]
		expect(output).toContain("numbers=[1,2,3]")
		expect(output).toContain("strings=[a,b,c]")
		expect(output).toContain("mixed=[1,two,true,null]")
		expect(output).toContain("empty=[]")
	})

	test("should handle object attributes", () => {
		logger.info("test", {
			user: { id: 123, name: "John" },
			empty: {},
			nested: { level1: { level2: "deep" } }
		})

		const output = consoleOutput[0]
		expect(output).toContain('user={"id":123,"name":John}')
		expect(output).toContain("empty={}")
		expect(output).toContain('nested={"level1":{"level2":deep}}')
	})

	test("should handle BigInt attributes", () => {
		logger.info("test", { bigNumber: BigInt("9007199254740991") })

		const output = consoleOutput[0]
		expect(output).toContain("bigNumber=9007199254740991")
	})

	test("should handle function and symbol attributes", () => {
		const testFunc = () => {}
		const testSymbol = Symbol("test")

		logger.info("test", { func: testFunc, sym: testSymbol })

		const output = consoleOutput[0]
		expect(output).toContain("func=")
		expect(output).toContain("sym=Symbol(test)")
	})

	test("should handle objects with custom toString", () => {
		const customObj = {
			toString() {
				return "CustomToString"
			}
		}

		const errorObj = new Error("Test error")
		const dateObj = new Date("2023-01-01T12:00:00Z")

		logger.info("test", { custom: customObj, error: errorObj, date: dateObj })

		const output = consoleOutput[0]
		expect(output).toContain("custom=CustomToString")
		expect(output).toContain("error=Error: Test error")
		expect(output).toContain("date=")
	})
})

describe("Timestamp formatting", () => {
	test("should include timestamp in output", () => {
		logger.info("test message")

		const output = consoleOutput[0]
		// Check for timestamp pattern: YYYY/MM/DD HH:MM:SS
		expect(output).toMatch(/^\d{4}\/\d{2}\/\d{2} \d{2}:\d{2}:\d{2} INFO/)
	})

	test("should have consistent timestamp format across multiple logs", () => {
		logger.info("message 1")
		logger.info("message 2")

		expect(consoleOutput).toHaveLength(2)

		// Both should start with valid timestamp
		expect(consoleOutput[0]).toMatch(/^\d{4}\/\d{2}\/\d{2} \d{2}:\d{2}:\d{2}/)
		expect(consoleOutput[1]).toMatch(/^\d{4}\/\d{2}\/\d{2} \d{2}:\d{2}:\d{2}/)
	})
})

describe("Output format", () => {
	test("should end with newline", () => {
		logger.info("test message")

		expect(consoleOutput[0]).toEndWith("\n")
	})

	test("should format basic message correctly", () => {
		logger.info("test message")

		const output = consoleOutput[0]
		expect(output).toMatch(/^\d{4}\/\d{2}\/\d{2} \d{2}:\d{2}:\d{2} INFO test message\n$/)
	})

	test("should format message with attributes correctly", () => {
		logger.info("test message", { key: "value" })

		const output = consoleOutput[0]
		expect(output).toMatch(/^\d{4}\/\d{2}\/\d{2} \d{2}:\d{2}:\d{2} INFO test message key=value\n$/)
	})

	test("should separate multiple attributes with spaces", () => {
		logger.info("test", { a: 1, b: 2, c: 3 })

		const output = consoleOutput[0]
		expect(output).toContain("a=1 b=2 c=3")
	})
})

describe("Edge cases and error handling", () => {
	test("should handle empty message", () => {
		logger.info("")

		const output = consoleOutput[0]
		expect(output).toMatch(/^\d{4}\/\d{2}\/\d{2} \d{2}:\d{2}:\d{2} INFO \n$/)
	})

	test("should handle very long messages", () => {
		const longMessage = "a".repeat(10000)
		logger.info(longMessage)

		expect(consoleOutput).toHaveLength(1)
		expect(consoleOutput[0]).toContain("INFO")
		expect(consoleOutput[0]).toEndWith("\n")
	})

	test("should handle circular object references", () => {
		const circular: { name: string; self?: unknown } = { name: "test" }
		circular.self = circular

		// This will cause a stack overflow, which is expected behavior
		// The library prioritizes performance over circular reference protection
		expect(() => {
			logger.info("test", { circular })
		}).toThrow()
	})

	test("should handle unicode characters", () => {
		logger.info("test message", {
			emoji: "🚀",
			chinese: "你好",
			math: "π ≈ 3.14"
		})

		const output = consoleOutput[0]
		expect(output).toContain("emoji=🚀")
		expect(output).toContain("chinese=你好")
		expect(output).toContain("math=π ≈ 3.14")
	})

	test("should handle attributes with special characters", () => {
		logger.info("test", {
			quotes: 'contains "quotes"',
			newlines: "line1\nline2",
			tabs: "before\tafter"
		})

		const output = consoleOutput[0]
		expect(output).toContain('quotes=contains "quotes"')
		expect(output).toContain("newlines=line1\nline2")
		expect(output).toContain("tabs=before\tafter")
	})

	test("should handle nested arrays and objects", () => {
		logger.info("test", {
			nested: {
				array: [{ id: 1 }, { id: 2 }],
				object: {
					meta: {
						tags: ["a", "b", "c"]
					}
				}
			}
		})

		const output = consoleOutput[0]
		expect(output).toContain("nested=")
		expect(output).toContain('"array":[')
		expect(output).toContain('"tags":[a,b,c]')
	})
})

describe("Performance characteristics", () => {
	test("should handle many attributes efficiently", () => {
		const manyAttrs: Record<string, unknown> = {}
		for (let i = 0; i < 100; i++) {
			manyAttrs[`key${i}`] = `value${i}`
		}

		const start = performance.now()
		logger.info("test", manyAttrs)
		const end = performance.now()

		expect(consoleOutput).toHaveLength(1)
		expect(end - start).toBeLessThan(100) // Should be fast
	})

	test("should handle rapid logging", () => {
		const start = performance.now()

		for (let i = 0; i < 100; i++) {
			logger.info(`message ${i}`, { iteration: i })
		}

		const end = performance.now()

		expect(consoleOutput).toHaveLength(100)
		expect(end - start).toBeLessThan(1000) // Should complete in reasonable time
	})

	test("stress test", () => {
		const start = performance.now()

		for (let i = 0; i < 100; i++) {
			logger.info(`Message ${i}`, { count: i, type: "stress" })
			logger.warn(`Warning ${i}`, { level: "stress" })
			logger.error(`Error ${i}`, { critical: true })
		}

		const end = performance.now()

		expect(consoleOutput).toHaveLength(100)
		expect(consoleError).toHaveLength(200) // 100 warns + 100 errors
		expect(end - start).toBeLessThan(1000) // Should complete in reasonable time
	})

	test("mixed streams", () => {
		logger.info("info message")
		logger.warn("warn message")
		logger.error("error message")

		// Check that appropriate streams were used
		expect(consoleOutput.length).toBe(1)
		expect(consoleError.length).toBe(2)
	})
})

describe("Integration scenarios", () => {
	test("should work with real-world logging scenario", () => {
		// Simulate a web application scenario

		// Request received
		logger.info("Request received", {
			method: "POST",
			path: "/api/users",
			ip: "192.168.1.1",
			userAgent: "Mozilla/5.0"
		})

		// Processing
		logger.debug("Validating user data", { userId: "user-123" })

		// Database operation
		logger.info("Database query executed", {
			query: "INSERT INTO users",
			duration: 45.2,
			rowsAffected: 1
		})

		// Warning
		logger.warn("Rate limit approaching", {
			userId: "user-123",
			requestCount: 95,
			limit: 100
		})

		// Error scenario
		const error = new Error("Database connection timeout")
		logger.error("Request failed", {
			error: error,
			userId: "user-123",
			statusCode: 500
		})

		// Check that appropriate streams were used
		expect(consoleOutput.length).toBeGreaterThan(0)
		expect(consoleError.length).toBeGreaterThan(0)
	})
})
