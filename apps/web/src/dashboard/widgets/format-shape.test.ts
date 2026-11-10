import type { AgFormatShapeParams } from 'ag-studio';
import { describe, expect, it, vi } from 'vitest';
import { budgetMeterDefinition } from './budget/definition.js';
import { KEEP_FORMAT_GUIDANCE, shapeBuilder } from './format-shape.js';
import { kpiTileDefinition } from './kpi/definition.js';
import { quotesTableDefinition } from './quotes-table/definition.js';

/**
 * A stand-in for Studio's shape builder that records what is declared. The
 * real builder only exists inside a running Studio; the browser check covers
 * Studio parsing these shapes, this covers what they declare.
 */
interface Recorded {
  kind: string;
  fields?: Record<string, Recorded>;
  values?: readonly string[];
  optional?: boolean;
  description?: string;
}
const recorded = (r: Recorded): Recorded & { optional: () => Recorded } =>
  Object.assign({ ...r }, { optional: () => ({ ...r, optional: true }) }) as Recorded & {
    optional: () => Recorded;
  };
const describe_ = (opts?: { description?: string }) =>
  opts?.description ? { description: opts.description } : {};
const recorder = {
  object: (fields: Record<string, Recorded>, opts?: { description?: string }) =>
    recorded({ kind: 'object', fields, ...describe_(opts) }),
  boolean: (opts?: { description?: string }) => recorded({ kind: 'boolean', ...describe_(opts) }),
  string: (opts?: { description?: string }) => recorded({ kind: 'string', ...describe_(opts) }),
  number: (opts?: { description?: string }) => recorded({ kind: 'number', ...describe_(opts) }),
  enum: (values: readonly string[], opts?: { description?: string }) =>
    recorded({ kind: 'enum', values, ...describe_(opts) }),
};

function studioApi() {
  const defineAiCommand = vi.fn((factory: (s: typeof recorder) => unknown) => factory(recorder));
  return { api: { defineAiCommand }, defineAiCommand };
}

const params = (api: object) => ({ api, context: undefined }) as unknown as AgFormatShapeParams;

function declared(definition: { formatShape?: (p: AgFormatShapeParams) => unknown }) {
  const { api } = studioApi();
  return definition.formatShape?.(params(api)) as unknown as Recorded;
}

const styleOf = (shape: Recorded) => shape.fields?.style?.fields ?? {};

describe('shapeBuilder', () => {
  it('takes the builder Studio hands to defineAiCommand, once per Studio', () => {
    const { api, defineAiCommand } = studioApi();
    const core = api as unknown as Parameters<typeof shapeBuilder>[0];
    expect(shapeBuilder(core)).toBe(recorder);
    expect(shapeBuilder(core)).toBe(recorder);
    expect(defineAiCommand).toHaveBeenCalledOnce();
  });

  it('fails loudly when Studio hands over no builder', () => {
    const api = { defineAiCommand: () => undefined } as unknown as Parameters<
      typeof shapeBuilder
    >[0];
    expect(() => shapeBuilder(api)).toThrow('AG Studio did not provide a shape builder');
  });
});

describe('custom widget format shapes', () => {
  it.each([
    ['quotes-table', quotesTableDefinition],
    ['agent-budget', budgetMeterDefinition],
    ['kpi-tile', kpiTileDefinition],
  ] as const)('%s keeps Studio titles, card and cross filter, all optional', (_id, definition) => {
    const shape = declared(definition);
    expect(shape.optional).toBe(true);
    expect(Object.keys(shape.fields ?? {})).toEqual([
      'title',
      'subtitle',
      'caption',
      'widget',
      'crossFilter',
      'triggerCrossFilter',
      'style',
    ]);
    expect(Object.keys(shape.fields?.widget?.fields ?? {})).toEqual([
      'backgroundColor',
      'borderRadius',
      'borderEnabled',
      'borderWidth',
      'borderColor',
    ]);
    expect(Object.keys(shape.fields?.title?.fields ?? {})).toEqual([
      'enabled',
      'text',
      'typography',
      'color',
      'textAlign',
      'wrapping',
    ]);
    expect(shape.fields?.crossFilter?.values).toEqual(['highlight', 'filter', 'none']);
    for (const option of Object.values(styleOf(shape))) {
      expect(option.optional).toBe(true);
      expect(option.description).toBeTruthy();
    }
    expect(definition.ai?.configuration).toContain(KEEP_FORMAT_GUIDANCE);
  });

  it('declares the quotes table options the table honours', () => {
    const style = styleOf(declared(quotesTableDefinition));
    expect(Object.keys(style)).toEqual(['totalRow', 'density']);
    expect(style.density?.values).toEqual(['comfortable', 'compact']);
  });

  it('declares the budget meter options the meter honours', () => {
    expect(Object.keys(styleOf(declared(budgetMeterDefinition)))).toEqual([
      'showBar',
      'showPerPurchase',
      'showStatus',
      'showExpires',
    ]);
  });

  it('declares the KPI tile options the tile honours', () => {
    const style = styleOf(declared(kpiTileDefinition));
    expect(Object.keys(style)).toEqual(['valueSize', 'showCount', 'countOne', 'countMany']);
    expect(style.valueSize?.values).toEqual(['compact', 'regular', 'large']);
  });
});
