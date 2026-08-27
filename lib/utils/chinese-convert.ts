/**
 * Traditional -> Simplified Chinese conversion using opencc-js.
 * Imports the t2cn-only entry point instead of the package root (which
 * bundles every conversion direction's dictionary, ~1MB) to keep the
 * Vercel Edge Function under its 1MB size limit.
 */

// @ts-expect-error -- opencc-js only ships types for the package root; this
// subpath exists at runtime (see dist/esm/t2cn.js) but has no declaration file.
// A local ConverterOptions shape (instead of `import type ... from 'opencc-js'`)
// avoids any static reference to the package root, whose entry point
// (dist/esm/full.js) bundles every conversion direction's dictionary (~1MB) —
// some bundlers (Turbopack dev) don't fully elide `import type` and pull it in.
import { Converter } from 'opencc-js/t2cn';

interface ConverterOptions {
  from?: 'cn' | 'tw' | 'twp' | 'hk' | 'jp' | 't';
  to?: 'cn' | 'tw' | 'twp' | 'hk' | 'jp' | 't';
}

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
