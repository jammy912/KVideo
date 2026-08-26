/**
 * Traditional -> Simplified Chinese conversion using opencc-js.
 * Imports the t2cn-only entry point instead of the package root (which
 * bundles every conversion direction's dictionary, ~1MB) to keep the
 * Vercel Edge Function under its 1MB size limit.
 */

import type { ConverterOptions } from 'opencc-js';
// @ts-expect-error -- opencc-js only ships types for the package root; this
// subpath exists at runtime (see dist/esm/t2cn.js) but has no declaration file.
import { Converter } from 'opencc-js/t2cn';

const typedConverter = Converter as (options: ConverterOptions) => (text: string) => string;

let t2sConverter: ((text: string) => string) | null = null;

function getT2SConverter() {
  if (!t2sConverter) {
    t2sConverter = typedConverter({ from: 'tw', to: 'cn' });
  }
  return t2sConverter;
}

/**
 * Convert Traditional Chinese to Simplified Chinese (comprehensive).
 * Used for search query normalization.
 */
export function traditionalToSimplified(text: string): string {
  return getT2SConverter()(text);
}
