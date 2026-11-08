import { studioTheme } from 'ag-studio';

const TEXT_FONT = '"IBM Plex Sans", "Segoe UI", system-ui, sans-serif';
const DISPLAY_FONT = '"Fraunces", Georgia, serif';

/**
 * AG Studio themed with the product tokens of `src/styles.css`: paper canvas,
 * pine accent, IBM Plex Sans, Fraunces for widget titles. Built on
 * `studioTheme` (not `createStudioTheme()`) so the icon set, buttons and
 * inputs keep their parts.
 */
export const dashboardTheme = studioTheme.withParams({
  fontFamily: TEXT_FONT,
  fontSize: 13,
  textColor: '#16211c',
  backgroundColor: '#ffffff',
  borderColor: '#d8ddd6',
  accentColor: '#0e6b52',
  studioCanvasBackgroundColor: '#f5f6f2',
  studioCanvasFontFamily: TEXT_FONT,
  studioCanvasMinWidth: 640,
  studioPanelWidth: 200,
  studioWidgetBackgroundColor: '#ffffff',
  studioWidgetBorder: { width: 1, color: '#d8ddd6' },
  studioWidgetBorderRadius: 8,
  studioWidgetPadding: 8,
  studioWidgetTitleFontFamily: DISPLAY_FONT,
  studioWidgetTitleFontSize: 18,
  studioWidgetTitleFontWeight: '500',
  studioWidgetTitleTextColor: '#16211c',
  studioWidgetSubtitleTextColor: '#5b665f',
  studioToggleButtonActiveBackgroundColor: '#0e6b52',
  studioToggleButtonActiveBorderColor: '#0e6b52',
  studioToggleButtonActiveColor: '#0e6b52',
  chartFontFamily: TEXT_FONT,
  chartAccentColor: '#0e6b52',
  chartTextColor: '#16211c',
  chartSubtleTextColor: '#5b665f',
  chartAxisLabelColor: '#5b665f',
  chartGridLineColor: '#e6eae4',
  chartAxisLineColor: '#d8ddd6',
  gridRowBorder: { width: 1, color: '#d8ddd6' },
  gridHeaderRowBorder: { width: 2, color: '#16211c' },
});
