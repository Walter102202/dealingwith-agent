import type { AgResponsiveLayoutCandidate } from 'ag-studio';
import { describe, expect, it } from 'vitest';
import { twoColumnLayout } from './responsive.js';

const widget = (
  xTrack: number,
  yTrack: number,
  xSpan: number,
  ySpan: number,
  min = { xSpan: 4, ySpan: 6 },
): AgResponsiveLayoutCandidate => ({ layout: { xTrack, yTrack, xSpan, ySpan }, minSize: min });

describe('twoColumnLayout', () => {
  it('pairs narrow widgets and gives wide ones the full width', () => {
    // Overview: three charts side by side, then a full-width table.
    const layouts = [
      widget(0, 0, 9, 18),
      widget(9, 0, 8, 18),
      widget(17, 0, 7, 18),
      widget(0, 18, 24, 24),
    ];
    expect(twoColumnLayout(layouts, { columns: 24, rows: undefined })).toEqual([
      { xTrack: 0, yTrack: 0, xSpan: 12, ySpan: 18 },
      { xTrack: 12, yTrack: 0, xSpan: 12, ySpan: 18 },
      { xTrack: 0, yTrack: 18, xSpan: 24, ySpan: 18 },
      { xTrack: 0, yTrack: 36, xSpan: 24, ySpan: 24 },
    ]);
  });

  it('pairs only within a desktop row, so an odd one out takes the full width', () => {
    // Agent channel: three KPI tiles, three charts, then the table.
    const layouts = [
      widget(0, 0, 8, 8),
      widget(8, 0, 8, 8),
      widget(16, 0, 8, 8),
      widget(0, 8, 9, 18),
      widget(9, 8, 8, 18),
      widget(17, 8, 7, 18),
      widget(0, 26, 24, 22),
    ];
    expect(twoColumnLayout(layouts, { columns: 24, rows: undefined })).toEqual([
      { xTrack: 0, yTrack: 0, xSpan: 12, ySpan: 8 },
      { xTrack: 12, yTrack: 0, xSpan: 12, ySpan: 8 },
      { xTrack: 0, yTrack: 8, xSpan: 24, ySpan: 8 },
      { xTrack: 0, yTrack: 16, xSpan: 12, ySpan: 18 },
      { xTrack: 12, yTrack: 16, xSpan: 12, ySpan: 18 },
      { xTrack: 0, yTrack: 34, xSpan: 24, ySpan: 18 },
      { xTrack: 0, yTrack: 52, xSpan: 24, ySpan: 22 },
    ]);
  });

  it('follows reading order and returns layouts in the order it was given', () => {
    const layouts = [widget(0, 20, 24, 10), widget(12, 0, 12, 8), widget(0, 0, 12, 8)];
    expect(twoColumnLayout(layouts, { columns: 24, rows: undefined })).toEqual([
      { xTrack: 0, yTrack: 8, xSpan: 24, ySpan: 10 },
      { xTrack: 12, yTrack: 0, xSpan: 12, ySpan: 8 },
      { xTrack: 0, yTrack: 0, xSpan: 12, ySpan: 8 },
    ]);
  });

  it('keeps a widget at least its minimum height and full width when half is too narrow', () => {
    const layouts = [widget(0, 0, 8, 4, { xSpan: 14, ySpan: 9 })];
    expect(twoColumnLayout(layouts, { columns: 24, rows: undefined })).toEqual([
      { xTrack: 0, yTrack: 0, xSpan: 24, ySpan: 9 },
    ]);
  });

  it('starts the next row below the taller of a pair', () => {
    const layouts = [widget(0, 0, 8, 8), widget(8, 0, 8, 20), widget(0, 20, 24, 10)];
    const [, , table] = twoColumnLayout(layouts, { columns: 24, rows: undefined });
    expect(table?.yTrack).toBe(20);
  });
});
