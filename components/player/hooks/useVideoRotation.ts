import { useState, useEffect, useCallback, useRef, RefObject } from 'react';

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
  // 記住影片尺寸作為 state，讓樣式能正確更新
  const [videoDimensions, setVideoDimensions] = useState({ width: 0, height: 0 });
  const prevFullscreenRef = useRef(isFullscreen);

  // 偵測影片是否為直立方向（只更新 state，不自動旋轉）
  const detectVideoOrientation = useCallback(() => {
    const video = videoRef.current;
    if (!video || !enabled) return;

    const { videoWidth, videoHeight } = video;
    if (videoWidth === 0 || videoHeight === 0) return;

    setVideoDimensions({ width: videoWidth, height: videoHeight });
    setIsPortrait(videoHeight > videoWidth);
  }, [videoRef, enabled]);

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

  // 全螢幕切換時：進入全螢幕且影片是直立的 → 自動旋轉 270 度；退出 → 重置為 0
  useEffect(() => {
    const wasFullscreen = prevFullscreenRef.current;
    prevFullscreenRef.current = isFullscreen;

    if (!enabled) return;

    if (isFullscreen && !wasFullscreen) {
      // 進入全螢幕：如果影片是直立的，自動旋轉
      const video = videoRef.current;
      if (video) {
        const { videoWidth, videoHeight } = video;
        if (videoHeight > videoWidth) {
          setRotation(270);
        }
      }
    } else if (!isFullscreen && wasFullscreen) {
      // 退出全螢幕：重置旋轉
      setRotation(0);
    }
  }, [isFullscreen, enabled, videoRef]);

  // 手動切換旋轉角度（反方向：0 → 270 → 180 → 90）
  const toggleRotation = useCallback(() => {
    setRotation((prev) => {
      const angles: RotationAngle[] = [0, 270, 180, 90];
      const currentIndex = angles.indexOf(prev);
      const nextIndex = (currentIndex + 1) % angles.length;
      return angles[nextIndex];
    });
  }, []);

  // 重置旋轉
  const resetRotation = useCallback(() => {
    setRotation(0);
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

    // 旋轉 90/270 度時，需要讓旋轉後的影片填滿容器
    const container = containerRef.current;
    if (!container) {
      return { transform: `rotate(${rotation}deg)` };
    }

    const containerWidth = container.clientWidth;
    const containerHeight = container.clientHeight;

    // 策略：使用 absolute 定位 + 交換尺寸 + 旋轉
    // 元素設為 containerHeight(寬) × containerWidth(高)，居中放置
    // 旋轉後視覺上恰好是 containerWidth × containerHeight
    return {
      position: 'absolute' as const,
      top: '50%',
      left: '50%',
      width: `${containerHeight}px`,
      height: `${containerWidth}px`,
      transform: `translate(-50%, -50%) rotate(${rotation}deg)`,
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
    toggleRotation,
    resetRotation,
    getContainerStyle: getVideoTransformStyle,
    getVideoStyle,
  };
}
