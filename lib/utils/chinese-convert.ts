/**
 * Chinese Text Conversion Utility
 * Converts Traditional Chinese to Simplified Chinese for search compatibility
 */
import { Converter } from 'opencc-js';

// Initialize converter instance (Traditional to Simplified)
const converter = Converter({ from: 'tw', to: 'cn' });

/**
 * Convert Traditional Chinese text to Simplified Chinese
 * @param text - Input text (may contain Traditional Chinese)
 * @returns Simplified Chinese text
 */
export function toSimplified(text: string): string {
  if (!text || typeof text !== 'string') {
    return text;
  }

  try {
    return converter(text);
  } catch (error) {
    console.error('[Chinese Convert] Conversion failed:', error);
    // Fallback to original text if conversion fails
    return text;
  }
}
