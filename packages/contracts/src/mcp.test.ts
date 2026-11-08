import { describe, expect, test } from 'vitest';
import { AcceptQuoteInputSchema, MCP_TOOL_NAMES, RequestQuoteInputSchema } from './mcp.js';

describe('MCP tool inputs', () => {
  test('exposes the eight tools of the spec', () => {
    expect(MCP_TOOL_NAMES).toEqual([
      'list_services',
      'get_project',
      'request_quote',
      'answer_questions',
      'get_quote',
      'accept_quote',
      'get_payment',
      'get_mandate',
    ]);
  });

  test('request_quote needs non-empty text of at most 2000 characters', () => {
    expect(RequestQuoteInputSchema.safeParse({ text: '' }).success).toBe(false);
    expect(RequestQuoteInputSchema.safeParse({ text: 'x'.repeat(2001) }).success).toBe(false);
    expect(
      RequestQuoteInputSchema.parse({
        projectId: '5b4b6a1e-0d7e-4a51-9f2a-2d3b1c8e9a10',
        text: 'Add our Amazon sales as a second source, no rush.',
      }).text,
    ).toMatch(/Amazon/);
  });

  test('accept_quote requires the version the client saw', () => {
    expect(
      AcceptQuoteInputSchema.safeParse({ quoteId: '5b4b6a1e-0d7e-4a51-9f2a-2d3b1c8e9a20' }).success,
    ).toBe(false);
    expect(
      AcceptQuoteInputSchema.parse({ quoteId: '5b4b6a1e-0d7e-4a51-9f2a-2d3b1c8e9a20', version: 2 })
        .version,
    ).toBe(2);
  });
});

describe('RequestQuoteInputSchema', () => {
  test('accepts a serviceId for a fixed-price storefront purchase', () => {
    const parsed = RequestQuoteInputSchema.parse({
      text: 'Buy Analytics dashboard build',
      serviceId: 'a0000000-0000-4000-8000-000000000011',
    });
    expect(parsed.serviceId).toBe('a0000000-0000-4000-8000-000000000011');
  });

  test('text alone is still enough', () => {
    expect(RequestQuoteInputSchema.parse({ text: 'Make it faster' }).serviceId).toBeUndefined();
  });
});
