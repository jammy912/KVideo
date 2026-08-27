import { extractNumericResolutionLabel } from '@/lib/utils/video';

export interface ResolutionBadge {
  label: string;
  color: string;
}

export interface ResolutionLike extends ResolutionBadge {
  width?: number;
  height?: number;
  origin?: 'probed' | 'played' | 'hint';
  episodeIndex?: number;
}

/**
 * Background source discovery is keyed to one video. The player page is reused
 * (not remounted) across SPA navigation, so results discovered for a previous
 * video must not be merged into the next one — doing so made every history
 * entry inherit the first-clicked video's source list.
 *
 * Returns the discovered sources only when they were gathered for the video
 * currently being played.
 */
export function discoveredSourcesFor<T>(
  discovered: { forVideo: string; sources: T[] } | null,
  currentVideoKey: string
): T[] {
  if (!discovered || discovered.forVideo !== currentVideoKey) return [];
  return discovered.sources;
}

/**
 * Key identifying which video a background discovery run belongs to. Includes
 * the source because the same id means different videos on different stations.
 */
export function videoDiscoveryKey(
  source: string | null,
  videoId: string | null
): string {
  return `${source || ''}::${videoId || ''}`;
}

export function shouldExpandForCurrentSource(
  sources: Array<{ source: string }>,
  currentSource: string,
  maxVisible = 5
): boolean {
  const currentIndex = sources.findIndex((source) => source.source === currentSource);
  return currentIndex >= maxVisible;
}

export function getSourceResolutionBadge(options: {
  isCurrent: boolean;
  currentResolution?: ResolutionLike | null;
  probedResolution?: ResolutionLike | null;
  cachedResolution?: ResolutionLike | null;
  remarks?: string;
}): ResolutionBadge | null {
  const { isCurrent, currentResolution, probedResolution, cachedResolution, remarks } = options;

  if (isCurrent && currentResolution) {
    return { label: currentResolution.label, color: currentResolution.color };
  }

  if (probedResolution) {
    return { label: probedResolution.label, color: probedResolution.color };
  }

  if (cachedResolution) {
    return { label: cachedResolution.label, color: cachedResolution.color };
  }

  return extractNumericResolutionLabel(remarks) || null;
}
