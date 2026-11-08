import { AppError } from '../../lib/errors.js';

type PricingErrorCode = 'unknown_rule' | 'unknown_scope_ref' | 'excluded_scope_ref';
export class PricingError extends AppError {
  declare readonly code: PricingErrorCode;
  readonly ref: string;
  constructor(code: PricingErrorCode, ref: string) {
    const messages = {
      unknown_rule: `Rule "${ref}" does not exist in the catalog`,
      unknown_scope_ref: `Scope clause "${ref}" does not exist in this project`,
      excluded_scope_ref: `Scope clause "${ref}" is excluded from the contracted scope and cannot be marked as included`,
    };
    super(code, messages[code], { status: 422 });
    this.ref = ref;
  }
}
