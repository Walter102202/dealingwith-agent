import type {
  AgAnyShapeSpec,
  AgCoreStudioApi,
  AgExternalShape,
  AgShape,
  AgShapeBuilder,
  AgStudioApi,
  AgWidgetDataFormat,
} from 'ag-studio';

/**
 * Format shapes for the DealingWith widgets (decision
 * 2026-11-10-custom-widget-format-shapes). A widget's `formatShape` is the
 * schema Studio's AI agents read to restyle it, and the parser Studio runs on
 * its `format` before loading it: keys the shape does not declare are dropped.
 * An assistant restyle keeps the keys it leaves out (`assistant/keep-format.ts`).
 */

const builders = new WeakMap<object, AgShapeBuilder>();

/**
 * Studio's shape builder. AG Studio 3.1.0 exports no builder of its own; it
 * hands one to every `api.defineAiCommand` factory, and `formatShape` receives
 * that API (the browser one, though typed as the core API), so the builder is
 * taken from there and the command it defines is discarded.
 */
export function shapeBuilder(api: AgCoreStudioApi): AgShapeBuilder {
  const known = builders.get(api);
  if (known) return known;
  let builder: AgShapeBuilder | undefined;
  (api as AgStudioApi).defineAiCommand((s) => {
    builder = s;
    return { input: s.object({}), execute: () => ({ success: true, value: null }) };
  });
  if (!builder) throw new Error('AG Studio did not provide a shape builder');
  builders.set(api, builder);
  return builder;
}

/** A widget title, subtitle or caption, as Studio's own widgets declare it. */
function titleShape(s: AgShapeBuilder) {
  return s.object(
    {
      enabled: s
        .boolean({
          description:
            'Whether to show it. false hides it and keeps the text; when true, also set text.',
        })
        .optional(),
      text: s.string({ description: 'The display text.' }).optional(),
      typography: s
        .object({
          fontFamily: s.string().optional(),
          fontSize: s.number().optional(),
          fontWeight: s.enum(['normal', 'bold']).optional(),
          fontStyle: s.enum(['normal', 'italic']).optional(),
        })
        .optional(),
      color: s
        .string({ description: 'CSS colour. Set only when a colour is asked for.' })
        .optional(),
      textAlign: s.enum(['left', 'center', 'right']).optional(),
      wrapping: s.boolean().optional(),
    },
    {
      description:
        'A title, subtitle or caption. Normally only enabled and text change; leave the font, colour and alignment alone unless asked.',
    },
  );
}

/** The card around a widget, as Studio's own widgets declare it; Studio draws it for every widget. */
function appearanceShape(s: AgShapeBuilder) {
  return s.object(
    {
      backgroundColor: s.string({ description: 'Card background as a CSS colour.' }).optional(),
      borderRadius: s.number({ description: 'Corner radius in pixels.' }).optional(),
      borderEnabled: s.boolean({ description: 'Whether to draw a border.' }).optional(),
      borderWidth: s.number({ description: 'Border width in pixels.' }).optional(),
      borderColor: s.string({ description: 'Border colour as a CSS colour.' }).optional(),
    },
    {
      description:
        'The card around the widget. Set only when a background, border or corner radius is asked for.',
    },
  );
}

/**
 * The whole `format` of a DealingWith widget: Studio's titles, card appearance
 * and cross-filter settings, which Studio draws and applies itself, and the
 * widget's own `style`.
 */
export function widgetFormatShape<TStyle>(
  s: AgShapeBuilder,
  style: AgShape<AgAnyShapeSpec>,
): AgExternalShape<AgWidgetDataFormat<TStyle> | undefined> {
  const title = titleShape(s);
  const shape = s
    .object(
      {
        title: title.optional(),
        subtitle: title.optional(),
        caption: title.optional(),
        widget: appearanceShape(s).optional(),
        crossFilter: s
          .enum(['highlight', 'filter', 'none'], {
            description:
              'What a click elsewhere on the page does to this widget: highlight, filter, or nothing.',
          })
          .optional(),
        triggerCrossFilter: s
          .boolean({
            description:
              'Whether a click in this widget starts a cross filter in the others. Default true.',
          })
          .optional(),
        style: style.optional(),
      },
      {
        description:
          'Visual formatting. Set only the properties the user asks for; a property left out keeps its current value.',
      },
    )
    .optional();
  // Studio infers an object's external type with an open index signature, so it
  // does not match the widget's declared format type; the keys above are that type's keys.
  return shape as unknown as AgExternalShape<AgWidgetDataFormat<TStyle> | undefined>;
}
