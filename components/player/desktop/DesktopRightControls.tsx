import React from 'react';
import { Icons } from '@/components/ui/Icon';
import { useVideoRotation } from '../hooks/useVideoRotation';
import { useIsMobile } from '@/lib/hooks/mobile/useDeviceDetection';

interface DesktopRightControlsProps {
    isFullscreen: boolean;
    isPiPSupported: boolean;
    isAirPlaySupported: boolean;
    isCastAvailable: boolean;
    isProxied?: boolean;
    onToggleFullscreen: () => void;
    onTogglePictureInPicture: () => void;
    onShowAirPlayMenu: () => void;
    onShowCastMenu: () => void;
    videoRotation?: ReturnType<typeof useVideoRotation>;
}

export function DesktopRightControls({
    isFullscreen,
    isPiPSupported,
    isAirPlaySupported,
    isCastAvailable,
    isProxied,
    onToggleFullscreen,
    onTogglePictureInPicture,
    onShowAirPlayMenu,
    onShowCastMenu,
    videoRotation
}: DesktopRightControlsProps) {
    const isMobile = useIsMobile();

    return (
        <div className="relative z-50 flex items-center gap-3">
            {/* Picture-in-Picture - Hide on mobile */}
            {
                isPiPSupported && !isMobile && (
                    <button
                        onClick={onTogglePictureInPicture}
                        className="btn-icon"
                        aria-label="画中画"
                        title="画中画"
                    >
                        <Icons.PictureInPicture size={20} />
                    </button>
                )
            }

            {/* AirPlay - Hide on mobile */}
            {
                isAirPlaySupported && !isMobile && (
                    <button
                        onClick={onShowAirPlayMenu}
                        className="btn-icon"
                        aria-label="隔空播放"
                        title="隔空播放"
                    >
                        <Icons.Airplay size={20} />
                    </button>
                )
            }

            {/* Google Cast - Hide on mobile */}
            {
                isCastAvailable && !isMobile && (
                    <button
                        onClick={onShowCastMenu}
                        className="btn-icon"
                        aria-label="投屏"
                        title="投屏"
                    >
                        <Icons.Cast size={20} />
                    </button>
                )
            }

            {/* Video Rotation - Only show on mobile/tablet */}
            {
                videoRotation && (
                    <button
                        onClick={videoRotation.toggleRotation}
                        className="btn-icon"
                        aria-label="旋轉影片"
                        title={`旋轉影片 (${videoRotation.rotation}°)`}
                    >
                        <div style={{ transform: `rotate(${videoRotation.rotation}deg)`, transition: 'transform 0.3s ease-in-out' }}>
                            <Icons.RefreshCw size={20} />
                        </div>
                    </button>
                )
            }

            {/* Fullscreen */}
            <button
                onClick={onToggleFullscreen}
                className="btn-icon"
                aria-label={isFullscreen ? '退出全屏' : '全屏'}
            >
                {isFullscreen ? <Icons.Minimize size={20} /> : <Icons.Maximize size={20} />}
            </button>
        </div >
    );
}
