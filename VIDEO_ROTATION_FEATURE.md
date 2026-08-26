# 影片自動旋轉功能說明

## 功能概述

此功能針對手機和平板裝置，能自動偵測影片方向並優化全螢幕體驗。

## 主要特性

### 1. 自動偵測影片方向
- 影片載入後（`loadedmetadata` 事件），自動讀取 `video.videoWidth` 和 `video.videoHeight`
- 判斷影片是直立（portrait）還是橫向（landscape）

### 2. 自動旋轉直立影片
- 如果 `videoHeight > videoWidth`（直立影片），自動用 CSS `transform: rotate(90deg)` 旋轉 90 度
- 在全螢幕模式下，調整容器寬高（交換 `width` 和 `height`）讓影片填滿螢幕
- 如果是橫向影片（`videoWidth >= videoHeight`），維持原樣不動

### 3. 手動旋轉按鈕
- 在控制列右側（全螢幕按鈕前）新增旋轉按鈕
- 使用者可以手動切換旋轉角度：0° → 90° → 180° → 270° → 0°
- 手動旋轉後會停用自動旋轉功能

### 4. 響應式支援
- **手機/平板**：完整支援自動偵測和手動旋轉
- **桌面**：不顯示旋轉按鈕，不啟用旋轉功能
- 全螢幕和非全螢幕情況都有對應的樣式處理

## 檔案變更清單

### 新增檔案
1. `components/player/hooks/useVideoRotation.ts` - 影片旋轉邏輯的 React Hook

### 修改檔案
1. `components/player/DesktopVideoPlayer.tsx`
   - 引入 `useVideoRotation` 和 `useIsMobile`
   - 在影片容器外層包裝旋轉容器
   - 套用旋轉相關的樣式

2. `components/player/hooks/useDesktopPlayerState.ts`
   - 新增 `videoRotation` 狀態

3. `components/player/desktop/DesktopControlsWrapper.tsx`
   - 新增 `videoRotation` prop 並傳遞給控制列

4. `components/player/desktop/DesktopControls.tsx`
   - 新增 `videoRotation` 介面定義

5. `components/player/desktop/DesktopRightControls.tsx`
   - 新增旋轉按鈕（僅在手機/平板顯示）
   - 按鈕顯示當前旋轉角度並可觸發旋轉

6. `components/ui/icons/utility-icons.tsx`
   - 新增 `RotateScreen` 圖示（目前使用 `RefreshCw` 作為旋轉按鈕圖示）

## 使用方式

### 自動旋轉
1. 在手機或平板上開啟影片
2. 如果影片是直立方向，播放器會自動旋轉 90 度
3. 進入全螢幕模式時，影片會完整填滿螢幕

### 手動旋轉
1. 點擊控制列右側的旋轉按鈕（RefreshCw 圖示）
2. 每次點擊會旋轉 90 度
3. 按鈕的 tooltip 會顯示當前旋轉角度

## 技術細節

### CSS Transform
- 使用 `transform: rotate()` 進行旋轉
- 平滑過渡動畫：`transition: transform 0.3s ease-in-out`

### 全螢幕處理
- 旋轉 90° 或 270° 時：
  - 全螢幕：`width: 100vh`, `height: 100vw`（交換尺寸）
  - 非全螢幕：保持 `width: 100%`, `height: 100%`

### 裝置偵測
- 使用 `useIsMobile()` hook 判斷是否為手機/平板
- 只在手機/平板裝置啟用旋轉功能

## 測試建議

1. **直立影片測試**
   - 載入直立影片，確認自動旋轉 90 度
   - 進入/退出全螢幕，確認尺寸調整正確

2. **橫向影片測試**
   - 載入橫向影片，確認不會自動旋轉
   - 手動旋轉按鈕仍可正常運作

3. **手動旋轉測試**
   - 點擊旋轉按鈕，確認每次旋轉 90 度
   - 確認旋轉循環：0° → 90° → 180° → 270° → 0°

4. **裝置測試**
   - 桌面瀏覽器：不顯示旋轉按鈕
   - 手機瀏覽器：顯示旋轉按鈕且功能正常
   - 平板瀏覽器：顯示旋轉按鈕且功能正常

## 後續優化建議

1. 可以加入「重置旋轉」功能
2. 可以記憶使用者的旋轉偏好（localStorage）
3. 可以針對不同影片比例（16:9, 4:3, 1:1 等）優化顯示
4. 可以加入螢幕方向鎖定功能（配合 Screen Orientation API）
