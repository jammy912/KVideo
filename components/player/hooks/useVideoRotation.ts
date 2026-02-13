import { useState, useEffect, useCallback, RefObject } from 'react';

export type RotationAngle = 0 | 90 | 180 | 270;

interface UseVideoRotationOptions {
  videoRef: RefObject<HTMLVideoElement | null>;
  isFullscreen: boolean;
  enabled?: boolean;
}

export function useVideoRotation({
  videoRef,
  isFullscreen,
  enabled = true
}: UseVideoRotationOptions) {
  const [rotation, setRotation] = useState<RotationAngle>(0);
  const [isPortrait, setIsPortrait] = useState(false);
  const [autoRotationEnabled, setAutoRotationEnabled] = useState(true);

  // 偵測影片是否為直立方向
  const detectVideoOrientation = useCallback(() => {
    const video = videoRef.current;
    if (!video || !enabled) return;

    const { videoWidth, videoHeight } = video;

    // 確保影片已載入
    if (videoWidth === 0 || videoHeight === 0) return;

    const isVertical = videoHeight > videoWidth;
    setIsPortrait(isVertical);

    // 如果啟用自動旋轉且影片為直立方向，則自動旋轉 90 度
    if (autoRotationEnabled && isVertical && rotation === 0) {
      setRotation(90);
    }
  }, [videoRef, enabled, autoRotationEnabled, rotation]);

  // 當影片載入後偵測方向
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !enabled) return;

    const handleLoadedMetadata = () => {
      detectVideoOrientation();
    };

    // 如果影片已經載入，立即檢測
    if (video.readyState >= 1) {
      detectVideoOrientation();
    }

    video.addEventListener('loadedmetadata', handleLoadedMetadata);

    return () => {
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
    };
  }, [videoRef, enabled, detectVideoOrientation]);

  // 手動切換旋轉角度
  const toggleRotation = useCallback(() => {
    setRotation((prev) => {
      const angles: RotationAngle[] = [0, 90, 180, 270];
      const currentIndex = angles.indexOf(prev);
      const nextIndex = (currentIndex + 1) % angles.length;
      return angles[nextIndex];
    });
    // 手動旋轉時停用自動旋轉
    setAutoRotationEnabled(false);
  }, []);

  // 重置旋轉
  const resetRotation = useCallback(() => {
    setRotation(0);
    setAutoRotationEnabled(true);
  }, []);

  // 計算容器變換樣式
  const getContainerStyle = useCallback((): React.CSSProperties => {
    if (!enabled || rotation === 0) {
      return {};
    }

    const isRotated = rotation === 90 || rotation === 270;

    // 當旋轉 90 或 270 度時，需要調整寬高和縮放
    if (isRotated) {
      if (isFullscreen) {
        // 全螢幕時，交換寬高使影片填滿螢幕
        return {
          transform: `rotate(${rotation}deg)`,
          width: '100vh',
          height: '100vw',
          maxWidth: '100vh',
          maxHeight: '100vw',
        };
      } else {
        // 非全螢幕時，計算適當的縮放比例
        // 直立影片（9:16）旋轉 90 度後會變成（16:9）
        // 但容器可能是 16:9，所以需要放大
        const video = videoRef.current;
        let scale = 1;

        if (video && video.videoWidth > 0 && video.videoHeight > 0) {
          // 計算影片的長寬比
          const videoWidth = video.videoWidth;
          const videoHeight = video.videoHeight;

          // 旋轉後，寬高會互換
          // 如果是直立影片 (9:16)，旋轉後變成 (16:9)
          // 我們需要放大到原本高度的比例
          scale = videoHeight / videoWidth;
        }

        return {
          transform: `rotate(${rotation}deg) scale(${scale})`,
          width: '100%',
          height: '100%',
        };
      }
    }

    return {
      transform: `rotate(${rotation}deg)`,
    };
  }, [rotation, isFullscreen, enabled, videoRef]);

  // 計算影片元素樣式
  const getVideoStyle = useCallback((): React.CSSProperties => {
    if (!enabled || rotation === 0) {
      return {};
    }

    // 保持 contain 以避免裁切影片內容
    return {
      objectFit: 'contain',
    };
  }, [rotation, enabled]);

  return {
    rotation,
    isPortrait,
    autoRotationEnabled,
    toggleRotation,
    resetRotation,
    setAutoRotationEnabled,
    getContainerStyle,
    getVideoStyle,
  };
}
