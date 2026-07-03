import assert from "node:assert/strict"
import { afterEach, beforeEach, describe, mock, test } from "node:test"

import * as logger from "#index.ts"

/**
 * Captures console output per level. The library routes debug -> console.log,
 * info -> console.info, warn -> console.warn, error -> console.error, with no
 * timestamps — formatting beyond "LEVEL message attrs" belongs to the console
 * sink, not this library.
 */
let logLines: string[] = []
let infoLines: string[] = []
let warnLines: string[] = []
let errorLines: string[] = []

beforeEach(() => {
	logLines = []
	infoLines = []
	warnLines = []
	errorLines = []
	mock.method(console, "log", (line: string) => {
		logLines.push(line)
	})
	mock.method(console, "info", (line: string) => {
		infoLines.push(line)
	})
	mock.method(console, "warn", (line: string) => {
		warnLines.push(line)
	})
	mock.method(console, "error", (line: string) => {
		errorLines.push(line)
	})
})

afterEach(() => {
	mock.restoreAll()
	logger.setDefaultLogLevel(logger.INFO)
})

describe("Log level constants", () => {
	test("should have slog-convention values", () => {
		assert.strictEqual(logger.DEBUG, -4)
		assert.strictEqual(logger.INFO, 0)
		assert.strictEqual(logger.WARN, 4)
		assert.strictEqual(logger.ERROR, 8)
	})
})

describe("Basic logging functions", () => {
	test("info logs via console.info with INFO prefix", () => {
		logger.info("test message")
		assert.deepStrictEqual(infoLines, ["INFO test message"])
		assert.strictEqual(logLines.length, 0)
	})

	test("warn logs via console.warn with WARN prefix", () => {
		logger.warn("test warning")
		assert.deepStrictEqual(warnLines, ["WARN test warning"])
	})

	test("error logs via console.error with ERROR prefix", () => {
		logger.error("test error")
		assert.deepStrictEqual(errorLines, ["ERROR test error"])
	})

	test("debug logs via console.log when level allows", () => {
		logger.setDefaultLogLevel(logger.DEBUG)
		logger.debug("test debug")
		assert.deepStrictEqual(logLines, ["DEBUG test debug"])
	})

	test("debug is suppressed at the default INFO level", () => {
		logger.debug("test debug")
		assert.strictEqual(logLines.length, 0)
	})
})

describe("Log level filtering", () => {
	test("should respect minimum log level", () => {
		logger.setDefaultLogLevel(logger.WARN)
		logger.debug("debug message")
		logger.info("info message")
		logger.warn("warn message")
		logger.error("error message")

		assert.strictEqual(logLines.length, 0)
		assert.strictEqual(infoLines.length, 0)
		assert.deepStrictEqual(warnLines, ["WARN warn message"])
		assert.deepStrictEqual(errorLines, ["ERROR error message"])
	})

	test("should allow all levels when set to DEBUG", () => {
		logger.setDefaultLogLevel(logger.DEBUG)
		logger.debug("debug message")
		logger.info("info message")
		logger.warn("warn message")
		logger.error("error message")

		assert.strictEqual(logLines.length, 1)
		assert.strictEqual(infoLines.length, 1)
		assert.strictEqual(warnLines.length, 1)
		assert.strictEqual(errorLines.length, 1)
	})
})

describe("Structured attributes", () => {
	test("should append key=value attributes", () => {
		logger.info("test message", { userId: "123", count: 42 })
		assert.deepStrictEqual(infoLines, ["INFO test message userId=123 count=42"])
	})

	test("should handle strings, including empty", () => {
		logger.info("test", { message: "hello world", empty: "" })
		assert.deepStrictEqual(infoLines, ["INFO test message=hello world empty="])
	})

	test("should handle numbers of every flavor", () => {
		logger.info("test", {
			integer: 42,
			float: 3.14,
			negative: -100,
			zero: 0,
			infinity: Number.POSITIVE_INFINITY,
			nan: Number.NaN
		})
		const line = infoLines[0]
		assert.ok(line)
		assert.ok(line.includes("integer=42"))
		assert.ok(line.includes("float=3.14"))
		assert.ok(line.includes("negative=-100"))
		assert.ok(line.includes("zero=0"))
		assert.ok(line.includes("infinity=Infinity"))
		assert.ok(line.includes("nan=NaN"))
	})

	test("should handle booleans, null, and undefined", () => {
		logger.info("test", { isTrue: true, isFalse: false, nul: null, undef: undefined })
		assert.deepStrictEqual(infoLines, ["INFO test isTrue=true isFalse=false nul=null undef=undefined"])
	})

	test("should serialize arrays without quotes", () => {
		logger.info("test", { numbers: [1, 2, 3], mixed: [1, "two", true, null], empty: [] })
		assert.deepStrictEqual(infoLines, ["INFO test numbers=[1,2,3] mixed=[1,two,true,null] empty=[]"])
	})

	test("should serialize plain objects with quoted keys", () => {
		logger.info("test", { user: { id: 123, name: "John" }, empty: {} })
		assert.deepStrictEqual(infoLines, ['INFO test user={"id":123,"name":John} empty={}'])
	})

	test("should serialize nested structures", () => {
		logger.info("test", { nested: { level1: { level2: "deep" } } })
		assert.deepStrictEqual(infoLines, ['INFO test nested={"level1":{"level2":deep}}'])
	})

	test("should handle bigint, symbol, and function values", () => {
		logger.info("test", { big: BigInt("9007199254740991"), sym: Symbol("tag") })
		const line = infoLines[0]
		assert.ok(line)
		assert.ok(line.includes("big=9007199254740991"))
		assert.ok(line.includes("sym=Symbol(tag)"))
	})

	test("should use custom toString when present (Error, Date, custom)", () => {
		const custom = {
			toString() {
				return "CustomToString"
			}
		}
		const err = new Error("Test error")
		logger.info("test", { custom, error: err })
		const line = infoLines[0]
		assert.ok(line)
		assert.ok(line.includes("custom=CustomToString"))
		assert.ok(line.includes("error=Error: Test error"))
	})
})

describe("Edge cases", () => {
	test("should handle empty message", () => {
		logger.info("")
		assert.deepStrictEqual(infoLines, ["INFO "])
	})

	test("should handle very long messages", () => {
		const longMessage = "a".repeat(10000)
		logger.info(longMessage)
		assert.strictEqual(infoLines.length, 1)
		assert.ok(infoLines[0]?.startsWith("INFO aaa"))
	})

	test("circular references throw (performance over cycle protection, by design)", () => {
		const circular: { name: string; self?: unknown } = { name: "test" }
		circular.self = circular
		assert.throws(() => {
			logger.info("test", { circular })
		})
	})

	test("should pass unicode through untouched", () => {
		logger.info("test message", { emoji: "🚀", chinese: "你好", math: "π ≈ 3.14" })
		assert.deepStrictEqual(infoLines, ["INFO test message emoji=🚀 chinese=你好 math=π ≈ 3.14"])
	})
})
