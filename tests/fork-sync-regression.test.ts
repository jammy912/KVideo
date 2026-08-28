/**
 * Fork-sync regression guards.
 *
 * Every test here corresponds to a bug that actually shipped and cost real
 * debugging time (see FORK-SYNC-GUIDELINE.md). They exist so that a future
 * upstream sync which silently reverts one of these fixes fails `npm test`
 * instead of reaching production.
 *
 * Two kinds of test live here:
 *   1. Pure-logic tests — exercise extracted helpers directly.
 *   2. Source-invariant tests — read the source file and assert a critical
 *      guard is still present. Ugly, but these bugs live in React components
 *      whose behaviour cannot be reproduced without a DOM, and a sync that
 *      rewrites the file is exactly the scenario we need to catch.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { generateShowIdentifier } from '@/lib/store/history-store';
import { traditionalToSimplified } from '@/lib/utils/chinese-convert';
import { hasMinimumMatch } from '@/lib/utils/search';
import {
  discoveredSourcesFor,
  videoDiscoveryKey,
} from '@/lib/player/source-list-utils';

const repoRoot = process.cwd();
const readSource = (rel: string) => readFileSync(join(repoRoot, rel), 'utf8');

// ---------------------------------------------------------------------------
// 第四節第 8 點：videoData 未跟上 URL 時，前一部片的 vod_id 被寫進新紀錄
// ---------------------------------------------------------------------------

test('history write is guarded against videoData lagging behind the URL', () => {
  // Reproduces the guard in app/player/page.tsx. Keep this in step with it.
  const shouldWrite = (videoData: { vod_id?: unknown } | null, urlVideoId: string) => {
    if (!videoData) return false;
    if (videoData.vod_id != null && String(videoData.vod_id) !== String(urlVideoId)) {
      return false;
    }
    return true;
  };

  // The exact production failure: URL已切到新片，videoData 還是前一部。
  assert.equal(shouldWrite({ vod_id: 96798 }, '99999'), false,
    'stale videoData must not be written under the new URL id');

  // Normal cases must still write.
  assert.equal(shouldWrite({ vod_id: 99999 }, '99999'), true);
  assert.equal(shouldWrite({ vod_id: '99999' }, 99999 as unknown as string), true,
    'numeric/string ids from different sources must compare equal');
  assert.equal(shouldWrite({}, '99999'), true,
    'sources that omit vod_id keep the previous behaviour');
  assert.equal(shouldWrite(null, '99999'), false);
});

test('player page still contains the vod_id/URL consistency guard', () => {
  const src = readSource('app/player/page.tsx');
  assert.match(
    src,
    /String\(videoData\.vod_id\)\s*!==\s*String\(videoId\)/,
    'the vod_id guard was removed — history records will be cross-contaminated ' +
    '(FORK-SYNC-GUIDELINE 第四節第 8 點)'
  );
});

test('player remounts the video player when the video changes', () => {
  const src = readSource('app/player/page.tsx');
  assert.match(
    src,
    /key=\{discoveryKey\}/,
    'key={discoveryKey} was removed — switching videos leaves the previous ' +
    'hls.js instance playing (FORK-SYNC-GUIDELINE 第〇節)'
  );
});

// ---------------------------------------------------------------------------
// 第四節第 3/4/5 點：showIdentifier 正規化
// ---------------------------------------------------------------------------

test('showIdentifier normalises Traditional to Simplified', () => {
  // webhtv (Android) 存繁體、網頁端來源多為簡體，兩邊必須收斂到同一個 key。
  assert.equal(generateShowIdentifier('媽咪'), generateShowIdentifier('妈咪'));
  assert.equal(generateShowIdentifier('靈魂伴侶'), generateShowIdentifier('灵魂伴侣'));
  // 大小寫與空白也要正規化。
  assert.equal(generateShowIdentifier('  Foo  '), generateShowIdentifier('foo'));
  // 不同節目不能碰撞。
  assert.notEqual(generateShowIdentifier('媽咪'), generateShowIdentifier('爸比'));
});

test('history store bumps persist version when identifier algorithm changes', () => {
  const src = readSource('lib/store/history-store.ts');
  const version = src.match(/version:\s*(\d+)/)?.[1];
  assert.ok(version, 'persist version not found');
  assert.ok(
    Number(version) >= 3,
    'persist version must stay >= 3: identifiers written by older versions use a ' +
    'different algorithm and will never match (FORK-SYNC-GUIDELINE 第四節第 4 點)'
  );
  assert.match(
    src,
    /migrate:/,
    'migrate was removed — persisted identifiers will not be recomputed'
  );
});

test('identifier algorithm is defined in exactly one place', () => {
  // 重套自訂功能時最常見的錯誤是複製一份算法，之後兩邊分歧。
  const files = [
    'app/player/page.tsx',
    'components/player/VideoPlayer.tsx',
    'components/history/HistoryItem.tsx',
  ];
  for (const f of files) {
    assert.doesNotMatch(
      readSource(f), /`title:\$\{/,
      `${f} inlines the identifier algorithm instead of importing ` +
      'generateShowIdentifier (FORK-SYNC-GUIDELINE 第四節第 5 點)'
    );
  }
});

// ---------------------------------------------------------------------------
// 第四節第 2 點：繁體搜尋前後端都要轉
// ---------------------------------------------------------------------------

test('Traditional search query is converted before client-side relevance filtering', () => {
  // 後端用簡體查到的結果，前端若拿未轉換的繁體去比對會被全數濾掉。
  assert.equal(hasMinimumMatch('妈咪的英雄男友', '媽咪'), false,
    'precondition: raw Traditional query does not match Simplified titles');
  assert.equal(
    hasMinimumMatch('妈咪的英雄男友', traditionalToSimplified('媽咪')), true,
    'converted query must match'
  );

  // Check the CALL, not merely the import: an upstream rewrite that keeps the
  // import but stops calling it is exactly how this broke once before.
  assert.match(
    readSource('lib/hooks/useSearchAction.ts'),
    /traditionalToSimplified\s*\(/,
    'useSearchAction no longer calls traditionalToSimplified — the backend ' +
    'queries in Simplified while the client filters with the raw Traditional ' +
    'query, so every result is discarded (FORK-SYNC-GUIDELINE 第四節第 2 點)'
  );
});

test('chinese-convert imports the t2cn subpath, not the package root', () => {
  // 主入口會把所有方向的字典打包進來(~1.1MB)，撞破 Vercel Edge 1MB 上限。
  const src = readSource('lib/utils/chinese-convert.ts');
  assert.match(src, /from\s+'opencc-js\/t2cn'/,
    'must import opencc-js/t2cn (FORK-SYNC-GUIDELINE 第四節第 1 點)');
  // Only real import statements count — this file's own comments mention the
  // package root, and a `from 'opencc-js/t2cn'` must not trip the check either.
  const rootImports = src
    .split('\n')
    .filter((line) => /^\s*import\b/.test(line))
    .filter((line) => /from\s+'opencc-js'/.test(line));
  assert.deepEqual(rootImports, [],
    'importing the package root pulls in every dictionary and breaks deployment');
});

// ---------------------------------------------------------------------------
// 第四節第 7 點：SPA 重用導致跨影片殘留
// ---------------------------------------------------------------------------

test('discovered sources are scoped to the video they were fetched for', () => {
  const a = videoDiscoveryKey('siteA', '111');
  const b = videoDiscoveryKey('siteB', '222');
  const discovered = { forVideo: a, sources: [{ source: 'x' }, { source: 'y' }] };

  assert.deepEqual(discoveredSourcesFor(discovered, a), discovered.sources);
  assert.deepEqual(discoveredSourcesFor(discovered, b), [],
    'results from a previous video must not leak into the next one');
  assert.deepEqual(discoveredSourcesFor(null, a), []);
});

test('discovery key distinguishes the same id on different sources', () => {
  // 同一個 videoId 在不同站點是不同的片。
  assert.notEqual(videoDiscoveryKey('siteA', '143401'), videoDiscoveryKey('siteB', '143401'));
  assert.notEqual(videoDiscoveryKey(null, null), videoDiscoveryKey('siteA', '1'));
});

test('background source discovery re-runs for each video', () => {
  const src = readSource('app/player/page.tsx');
  // 一個永不重置的 boolean 會讓第二支影片起直接 early-return。
  assert.doesNotMatch(
    src, /fetchedSourcesRef\s*=\s*useRef\(false\)/,
    'fetchedSourcesRef must hold a key, not a boolean, or discovery never ' +
    're-runs after the first video (FORK-SYNC-GUIDELINE 第四節第 7 點)'
  );
});
