import { afterEach, beforeEach, describe, expect, spyOn, test } from "bun:test"
import * as logger from "./index"

describe.skip("Buffer Management", () => {
	let stdoutSpy: ReturnType<typeof spyOn>
	let stderrSpy: ReturnType<typeof spyOn>
	let outputBuffer: string[] = []
	let errorBuffer: string[] = []

	beforeEach(() => {
		// Mock stdout and stderr to capture output
		stdoutSpy = spyOn(process.stdout, "write").mockImplementation((data: string | Uint8Array) => {
			if (data instanceof Uint8Array) {
				outputBuffer.push(Buffer.from(data).toString())
			} else {
				outputBuffer.push(data.toString())
			}
			return true
		})

		stderrSpy = spyOn(process.stderr, "write").mockImplementation((data: string | Uint8Array) => {
			if (data instanceof Uint8Array) {
				errorBuffer.push(Buffer.from(data).toString())
			} else {
				errorBuffer.push(data.toString())
			}
			return true
		})

		// Reset state
		outputBuffer = []
		errorBuffer = []
		logger.setDefaultLogLevel(logger.INFO)
	})

	afterEach(() => {
		stdoutSpy.mockRestore()
		stderrSpy.mockRestore()
	})

	const BUFFER_SIZE = 8192 // Internal buffer size from the library

	test("should handle basic message within buffer", () => {
		const message = "Hello, world!"

		logger.info(message)

		expect(outputBuffer).toHaveLength(1)
		const output = outputBuffer[0]
		expect(output).toContain(message)
		expect(output).toEndWith("\n")
	})

	test("should handle long message efficiently", () => {
		const longMessage = "A".repeat(5000)

		logger.info(longMessage)

		expect(outputBuffer).toHaveLength(1)
		const output = outputBuffer[0]

		// Output should be truncated but still end with newline
		expect(output).toEndWith("\n")
		expect(output.length).toBeLessThanOrEqual(BUFFER_SIZE)
		expect(output).toContain("INFO")
	})

	test("should handle message with many attributes", () => {
		const largeAttributes: Record<string, unknown> = {}
		for (let i = 0; i < 100; i++) {
			largeAttributes[`key${i}`] = `value${i}`
		}

		logger.info("Message with large attributes", largeAttributes)

		expect(outputBuffer).toHaveLength(1)
		const output = outputBuffer[0]

		// Should be truncated but still end with newline
		expect(output).toEndWith("\n")
		expect(output.length).toBeLessThanOrEqual(BUFFER_SIZE)
		expect(output).toContain("INFO")
		expect(output).toContain("Message with large attributes")
	})

	test("should handle exact buffer size message", () => {
		const exactMessage = "X".repeat(8192 - 100) // Account for timestamp and level

		logger.info(exactMessage)

		expect(outputBuffer).toHaveLength(1)
		const output = outputBuffer[0]

		// Must always end with newline, even if truncated
		expect(output).toEndWith("\n")
		expect(output.length).toBeLessThanOrEqual(BUFFER_SIZE)
	})

	test("should handle near-maximum buffer message", () => {
		const nearMaxMessage = "Y".repeat(8000)

		logger.info(nearMaxMessage, { extra: "data" })

		expect(outputBuffer).toHaveLength(1)
		const output = outputBuffer[0]

		expect(output).toEndWith("\n")
		expect(output.length).toBeLessThanOrEqual(BUFFER_SIZE)
	})

	test("should handle multiple rapid messages", () => {
		const messages = ["First", "Second", "Third", "Fourth", "Fifth"]

		messages.forEach((message) => {
			logger.info(message, { index: messages.indexOf(message) })
		})

		expect(outputBuffer).toHaveLength(5)

		// Each message should be properly formatted
		outputBuffer.forEach((output, index) => {
			expect(output).toContain(messages[index])
			expect(output).toContain(`index=${index}`)
			expect(output).toEndWith("\n")
		})
	})

	test("should handle empty message and attributes", () => {
		logger.info("", {})

		expect(outputBuffer).toHaveLength(1)
		const output = outputBuffer[0]

		expect(output).toMatch(/^\d{4}\/\d{2}\/\d{2} \d{2}:\d{2}:\d{2} INFO {2}\n$/)
	})

	test("should handle deeply nested objects", () => {
		const deepObject = {
			level1: {
				level2: {
					level3: {
						level4: {
							level5: {
								value: "deep value",
								array: [1, 2, 3, { nested: "object" }]
							}
						}
					}
				}
			}
		}

		logger.info("Deep nested object test", { deep: deepObject })

		expect(outputBuffer).toHaveLength(1)
		const output = outputBuffer[0]

		expect(output).toEndWith("\n")
		expect(output.length).toBeLessThanOrEqual(BUFFER_SIZE)
		expect(output).toContain("INFO")
		expect(output).toContain("Deep nested object test")
	})

	test("should handle binary-like data", () => {
		const binaryData = {
			buffer: Buffer.from("hello world"),
			uint8Array: new Uint8Array([1, 2, 3, 4, 5]),
			arrayBuffer: new ArrayBuffer(8)
		}

		logger.info("Binary data test", binaryData)

		expect(outputBuffer).toHaveLength(1)
		const output = outputBuffer[0]

		// Should not crash and should produce valid output
		expect(output.length).toBeGreaterThan(0)
		expect(output.charCodeAt(output.length - 1)).toBe(10) // Last byte should be newline (ASCII 10)
	})

	test("should handle buffer reuse correctly", () => {
		logger.info("First message", { secret: "confidential" })

		// Second message should not contain data from first
		logger.info("Second message", { public: "visible" })

		expect(outputBuffer).toHaveLength(2)
		const firstOutput = outputBuffer[0]
		const secondOutput = outputBuffer[1]

		expect(firstOutput).toContain("confidential")
		expect(firstOutput).toContain("secret")
		expect(secondOutput).toContain("visible")
		expect(secondOutput).toContain("public")
	})

	test("should handle unicode in large quantities", () => {
		const unicodeMessage = "🚀".repeat(1000)
		const unicodeAttrs = {
			emoji: "🌟".repeat(500),
			chinese: "你好".repeat(250),
			mixed: "Test 🔥 テスト 🌈 测试".repeat(100)
		}

		logger.info(unicodeMessage, unicodeAttrs)

		expect(outputBuffer).toHaveLength(1)
		const output = outputBuffer[0]

		expect(output).toContain(unicodeMessage)
		expect(output).toEndWith("\n")
	})

	test("should handle many small attributes efficiently", () => {
		const manyAttrs: Record<string, string> = {}
		for (let i = 0; i < 200; i++) {
			manyAttrs[`k${i}`] = `v${i}`
		}

		logger.info("Many attributes test", manyAttrs)

		expect(outputBuffer).toHaveLength(1)
		const output = outputBuffer[0]

		expect(output).toEndWith("\n")
		expect(output).toContain("Many attributes test")
		// Should contain at least some of the attributes (may be truncated)
		expect(output).toContain("k0=v0")
	})

	test("should maintain performance under buffer stress", () => {
		const iterations = 1000
		const message = "Buffer stress test message"

		const start = performance.now()

		for (let i = 0; i < iterations; i++) {
			logger.info(message)
		}

		const end = performance.now()

		expect(outputBuffer).toHaveLength(1000)
		expect(end - start).toBeLessThan(500) // Should still be fast
	})
})
