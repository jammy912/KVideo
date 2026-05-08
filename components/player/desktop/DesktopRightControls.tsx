import React from 'react';
import { Icons } from '@/components/ui/Icon';
import { useVideoRotation } from '../hooks/useVideoRotation';
import { useIsMobile } from '@/lib/hooks/mobile/useDeviceDetection';

interface DesktopRightControlsProps {
    isNativeFullscreen: boolean;
    isWebFullscreen: boolean;
    isPiPSupported: boolean;
    isAirPlaySupported: boolean;
    isCastAvailable: boolean;
    onToggleNativeFullscreen: () => void;
    onToggleWebFullscreen: () => void;
    onTogglePictureInPicture: () => void;
    onShowAirPlayMenu: () => void;
    onShowCastMenu: () => void;
    videoRotation?: ReturnType<typeof useVideoRotation>;
}

export function DesktopRightControls({
    isNativeFullscreen,
    isWebFullscreen,
    isPiPSupported,
    isAirPlaySupported,
    isCastAvailable,
    onToggleNativeFullscreen,
    onToggleWebFullscreen,
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

            {/* AirPlay */}
            {
                isAirPlaySupported && (
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

            {/* Google Cast */}
            {
                isCastAvailable && (
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

            {/* Web Fullscreen - Hide on mobile (use system fullscreen instead) */}
            {!isMobile && (
                <button
                    onClick={onToggleWebFullscreen}
                    className="btn-icon"
                    aria-label={isWebFullscreen ? '退出网页全屏' : '网页全屏'}
                    title={isWebFullscreen ? '退出网页全屏 (W)' : '网页全屏 (W)'}
                >
                    <Icons.Target size={20} className={isWebFullscreen ? 'text-[var(--accent-color)]' : ''} />
                </button>
            )}

            {/* Native Fullscreen */}
            <button
                onClick={onToggleNativeFullscreen}
                className="btn-icon"
                aria-label={isNativeFullscreen ? '退出系统全屏' : '系统全屏'}
                title={isNativeFullscreen ? '退出系统全屏 (F)' : '系统全屏 (F)'}
            >
                {isNativeFullscreen ? <Icons.Minimize size={20} /> : <Icons.Maximize size={20} />}
            </button>
        </div >
    );
}
