// Compatibility shim — replaced by multi-provider AI client (src/clients/ai.ts).
// Import from ai.ts directly for new code.
export { chatComplete, hasAI, aiProviderStatus } from './ai';
/** @deprecated use chatComplete() from ./ai */
export const openai = null;
/** @deprecated */
export const OPENAI_MODEL = '';