# 測試影片旋轉功能

## 如何測試

### 1. 使用瀏覽器開發者工具模擬手機

#### Chrome / Edge
1. 按 `F12` 開啟開發者工具
2. 按 `Ctrl + Shift + M` 切換到裝置模擬模式
3. 選擇一個手機裝置（例如：iPhone 14 Pro、Samsung Galaxy S22）
4. 重新載入頁面

#### Firefox
1. 按 `F12` 開啟開發者工具
2. 按 `Ctrl + Shift + M` 切換到響應式設計模式
3. 選擇一個手機裝置
4. 重新載入頁面

### 2. 測試自動旋轉

1. 在手機模擬模式下，播放一個**直立方向**的影片（高度 > 寬度）
2. 觀察影片載入後是否自動旋轉 90 度
3. 進入全螢幕模式，確認影片完整填滿螢幕

### 3. 測試手動旋轉按鈕

1. 在手機模擬模式下，播放任何影片
2. 查看播放器控制列右側（全螢幕按鈕前方）
3. 應該會看到一個旋轉按鈕（RefreshCw 圖示）
4. 點擊按鈕，確認影片旋轉 90 度
5. 再次點擊，確認持續旋轉：90° → 180° → 270° → 0°

### 4. 測試桌面模式

1. 切換回正常桌面視窗大小（取消裝置模擬）
2. 重新載入頁面
3. 確認旋轉按鈕**不會顯示**
4. 影片不會自動旋轉

## 預期行為

### 手機/平板（isMobile = true）
- ✅ 直立影片自動旋轉 90 度
- ✅ 顯示旋轉按鈕
- ✅ 可手動切換旋轉角度
- ✅ 全螢幕時旋轉後的影片填滿螢幕
- ✅ 旋轉動畫平滑（0.3s ease-in-out）

### 桌面（isMobile = false）
- ✅ 不顯示旋轉按鈕
- ✅ 影片不會自動旋轉
- ✅ 播放器正常運作

## 測試影片建議

### 直立影片（測試自動旋轉）
找尋以下特徵的影片：
- 影片尺寸：例如 1080x1920、720x1280
- 通常是手機直拍的影片
- 短影音平台的影片（TikTok、YouTube Shorts 風格）

### 橫向影片（測試不會誤旋轉）
- 影片尺寸：例如 1920x1080、1280x720
- 一般電影、電視劇、YouTube 影片

## 除錯技巧

### 檢查是否偵測為手機
在瀏覽器控制台輸入：
```javascript
window.innerWidth < 768 || /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
```
應該回傳 `true`（手機模式）或 `false`（桌面模式）

### 檢查影片尺寸
在影片載入後，在控制台輸入：
```javascript
const video = document.querySelector('video');
console.log('Width:', video.videoWidth, 'Height:', video.videoHeight);
console.log('Is Portrait:', video.videoHeight > video.videoWidth);
```

### 檢查旋轉狀態
在 React DevTools 中：
1. 找到 `DesktopVideoPlayer` 元件
2. 查看 hooks 中的 `videoRotation` 物件
3. 確認 `rotation`、`isPortrait`、`autoRotationEnabled` 的值

## 已知問題和解決方案

### 問題：旋轉按鈕在桌面顯示
**解決方案**：確認 `useIsMobile()` hook 正確偵測裝置

### 問題：影片沒有自動旋轉
**檢查**：
1. 是否在手機模式下？
2. 影片是否已完全載入（`loadedmetadata` 事件是否觸發）？
3. 影片尺寸是否確實為直立（videoHeight > videoWidth）？

### 問題：全螢幕時旋轉影片未填滿螢幕
**檢查**：
1. 是否進入真正的全螢幕模式？
2. CSS transform 是否正確應用？
3. 容器寬高是否正確交換？

## 效能測試

- 旋轉動畫應該流暢，無卡頓
- 切換旋轉角度應該即時響應
- 不應影響影片播放效能

## 回報問題

如果發現問題，請提供：
1. 瀏覽器和版本
2. 裝置模擬模式（或真實手機型號）
3. 影片 URL 或尺寸
4. 控制台錯誤訊息
5. 預期行為 vs 實際行為
