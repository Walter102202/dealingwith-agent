import type { BudgetMeterDefinition } from '../types.js';
import { BudgetMeterComp } from './BudgetMeter.js';

const ICON =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M2 11.5a6 6 0 0 1 12 0"/><path d="M8 11.5 10.5 7"/></svg>';

/**
 * "Agent budget": a meter of what the client's AI agent has spent of its
 * mandate (spec 7.4). Reads the `mandates` source; amounts are cents.
 */
export const budgetMeterDefinition: BudgetMeterDefinition = {
  id: 'agent-budget',
  label: 'Agent budget',
  icon: ICON,
  dataMapping: {
    spent: {
      type: 'field',
      supportedRoles: ['numeric'],
      requires: { cardinality: 'one' },
      required: true,
      aiDescription: 'Amount the agent has spent, in integer cents.',
    },
    limit: {
      type: 'field',
      supportedRoles: ['numeric'],
      requires: { cardinality: 'one' },
      required: true,
      aiDescription: 'Total the agent may spend, in integer cents.',
    },
    perPurchase: {
      type: 'field',
      supportedRoles: ['numeric'],
      requires: { cardinality: 'one' },
      aiDescription: 'Largest single purchase the agent may make, in integer cents.',
    },
    expires: {
      type: 'field',
      supportedRoles: ['temporal'],
      requires: { cardinality: 'one' },
    },
    status: {
      type: 'field',
      supportedRoles: ['category'],
      requires: { cardinality: 'one' },
    },
  },
  form: (params) =>
    params.createDefaults({
      dataMappingItems: [
        { key: 'spent', label: 'Spent' },
        { key: 'limit', label: 'Limit' },
        { key: 'perPurchase', label: 'Per purchase' },
        { key: 'expires', label: 'Expires' },
        { key: 'status', label: 'Status' },
      ],
    }),
  comp: BudgetMeterComp,
  defaultSize: { width: 360, height: 280 },
  minSize: { width: 240, height: 200 },
  ai: {
    description: 'A meter of what an AI agent has spent of its mandate and what is left.',
    usage: 'Use to show the client agent budget. Map spent and limit to the mandates source.',
  },
};
