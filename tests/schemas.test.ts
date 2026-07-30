import { describe, expect, test } from "bun:test";
import {
	crawlRequestSchema,
	extractRequestBaseSchema,
	scrapeRequestSchema,
	searchRequestSchema,
} from "../src/schemas.js";
import type { SearchRequest } from "../src/types.js";

const requestWithoutExplicitPageCap: SearchRequest = {
	query: "example",
	processors: [{ type: "pdf" }],
};

const requests = [
	["scrape", scrapeRequestSchema, { url: "https://example.com" }],
	["extract", extractRequestBaseSchema, { url: "https://example.com", prompt: "title" }],
	["search", searchRequestSchema, { query: "example" }],
	["crawl", crawlRequestSchema, { url: "https://example.com" }],
] as const;

describe("content type and PDF processor validation", () => {
	test("request types and schemas allow the default 25-page PDF cap", () => {
		expect(searchRequestSchema.parse(requestWithoutExplicitPageCap).processors).toEqual([
			{ type: "pdf", maxPages: 25 },
		]);
		expect(searchRequestSchema.parse({ query: "example" }).processors).toBeUndefined();
	});

	for (const [name, schema, base] of requests) {
		test(`${name} accepts the documented PDF configuration`, () => {
			expect(
				schema.safeParse({
					...base,
					allowedTypes: ["application/pdf"],
					processors: [{ type: "pdf", maxPages: 10 }],
				}).success,
			).toBe(true);
		});

		test(`${name} rejects empty and duplicate arrays`, () => {
			expect(schema.safeParse({ ...base, allowedTypes: [] }).success).toBe(false);
			expect(
				schema.safeParse({
					...base,
					allowedTypes: ["application/pdf", "application/pdf"],
				}).success,
			).toBe(false);
			expect(schema.safeParse({ ...base, processors: [] }).success).toBe(false);
			expect(
				schema.safeParse({
					...base,
					processors: [
						{ type: "pdf", maxPages: 1 },
						{ type: "pdf", maxPages: 10 },
					],
				}).success,
			).toBe(false);
		});

		test(`${name} enforces the documented PDF page limits`, () => {
			for (const maxPages of [1, 500, -1]) {
				expect(schema.safeParse({ ...base, processors: [{ type: "pdf", maxPages }] }).success).toBe(
					true,
				);
			}
			for (const maxPages of [0, -2, 501, 1.5]) {
				expect(schema.safeParse({ ...base, processors: [{ type: "pdf", maxPages }] }).success).toBe(
					false,
				);
			}
		});
	}
});
