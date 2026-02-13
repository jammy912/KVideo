import { useState, useEffect, useCallback, RefObject } from 'react';

export type RotationAngle = 0 | 90 | 180 | 270;

interface UseVideoRotationOptions {
  videoRef: RefObject<HTMLVideoElement | null>;
  containerRef: RefObject<HTMLDivElement | null>;
  isFullscreen: boolean;
  enabled?: boolean;
}

export function useVideoRotation({
  videoRef,
  containerRef,
  isFullscreen,
  enabled = true
}: UseVideoRotationOptions) {
  const [rotation, setRotation] = useState<RotationAngle>(0);
  const [isPortrait, setIsPortrait] = useState(false);
  const [autoRotationEnabled, setAutoRotationEnabled] = useState(true);
  // 記住影片尺寸作為 state，讓樣式能正確更新
  const [videoDimensions, setVideoDimensions] = useState({ width: 0, height: 0 });

  // 偵測影片是否為直立方向
  const detectVideoOrientation = useCallback(() => {
    const video = videoRef.current;
    if (!video || !enabled) return;

    const { videoWidth, videoHeight } = video;
    if (videoWidth === 0 || videoHeight === 0) return;

    setVideoDimensions({ width: videoWidth, height: videoHeight });
    const isVertical = videoHeight > videoWidth;
    setIsPortrait(isVertical);

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
    setAutoRotationEnabled(false);
  }, []);

  // 重置旋轉
  const resetRotation = useCallback(() => {
    setRotation(0);
    setAutoRotationEnabled(true);
  }, []);

  // 計算影片旋轉的 CSS transform
  const getVideoTransformStyle = useCallback((): React.CSSProperties => {
    if (!enabled || rotation === 0) {
      return {};
    }

    const isRotated = rotation === 90 || rotation === 270;

    if (!isRotated) {
      // 180 度旋轉，不需要調整尺寸
      return {
        transform: `rotate(${rotation}deg)`,
      };
    }

    // 旋轉 90/270 度時，需要計算縮放
    // 關鍵：旋轉後寬高互換，需要讓旋轉後的影片填滿容器的寬度
    const container = containerRef.current;
    if (!container) {
      return { transform: `rotate(${rotation}deg)` };
    }

    const containerWidth = container.clientWidth;
    const containerHeight = container.clientHeight;

    // 旋轉 90 度後，容器的高度變成「可用寬度」，容器的寬度變成「可用高度」
    // 我們要讓影片旋轉後填滿整個容器寬度
    // scale 需要是 containerWidth / containerHeight
    // 因為旋轉後原本的 height 軸變成了水平方向，
    // 如果 containerHeight < containerWidth，放大比例 = containerWidth / containerHeight
    const scale = containerWidth / containerHeight;

    return {
      transform: `rotate(${rotation}deg) scale(${scale})`,
      transformOrigin: 'center center',
    };
  }, [rotation, enabled, containerRef, isFullscreen, videoDimensions]);

  // 不需要額外的影片樣式了
  const getVideoStyle = useCallback((): React.CSSProperties => {
    return {};
  }, []);

  return {
    rotation,
    isPortrait,
    autoRotationEnabled,
    toggleRotation,
    resetRotation,
    setAutoRotationEnabled,
    getContainerStyle: getVideoTransformStyle,
    getVideoStyle,
  };
}
