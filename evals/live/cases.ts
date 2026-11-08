import type { ExpectedClassification } from '../graders/classification.js';

export type EvalCase = {
  /** Fixture file name under `evals/scenarios/fixtures/`, for the report line. */
  id: string;
  /** The demo request text, verbatim from spec section 6. */
  text: string;
  expected: ExpectedClassification;
  /** Whether the paid additional C4 must be in the project scope before this request runs. */
  afterFirstPayment: boolean;
};

/** The five demo requests of spec section 6, in the order the video uses them. */
export const CASES: readonly EvalCase[] = [
  {
    id: '01-web-monday-summary',
    text: 'I need a per-branch view and a summary email every Monday.',
    expected: { included: ['C1'], rules: ['S2.report'], needsInfo: false },
    afterFirstPayment: false,
  },
  {
    id: '02-agent-amazon-source',
    text: 'Add our Amazon sales as a second source, no rush.',
    expected: { included: [], rules: ['S3.base', 'S3.per_source'], needsInfo: false },
    afterFirstPayment: true,
  },
  {
    id: '03-agent-sales-drop-alert',
    text: "Alert me by email when any branch's daily sales drop more than 20%.",
    expected: { included: [], rules: ['S2.alert'], needsInfo: false },
    afterFirstPayment: true,
  },
  {
    id: '04-already-covered',
    text: 'Send the Monday summary to our regional managers too.',
    expected: { included: ['C4'], rules: [], needsInfo: false },
    afterFirstPayment: true,
  },
  {
    id: '05-needs-info',
    text: 'Make the dashboard load faster.',
    expected: { included: [], rules: [], needsInfo: true },
    afterFirstPayment: true,
  },
];
