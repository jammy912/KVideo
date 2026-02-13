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
      const video = videoRef.current;

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
        // 非全螢幕時，需要放大影片以填滿容器
        // 因為旋轉後，直立影片（高>寬）的高度會變成寬度
        // 我們需要根據容器的寬高比來計算適當的縮放
        let scale = 1;

        if (video && video.videoWidth > 0 && video.videoHeight > 0) {
          // 直立影片旋轉 90 度後，原本的高會成為新的寬
          // videoHeight / videoWidth 就是旋轉後需要的縮放比例
          const videoAspect = video.videoHeight / video.videoWidth;

          // 假設容器是 16:9 的比例（手機橫向）
          // 我們需要讓旋轉後的影片填滿這個容器
          scale = videoAspect;
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

    const isRotated = rotation === 90 || rotation === 270;

    // 旋轉後使用 cover 讓影片填滿容器
    return {
      objectFit: isRotated ? 'cover' : 'contain',
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
