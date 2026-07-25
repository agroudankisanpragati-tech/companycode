'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useVoiceGuideContext, type AvatarState } from '@/context/VoiceGuideContext';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';

const AVATAR_EMOJI: Record<AvatarState, string> = {
  idle:      '🧑‍🌾',
  wave:      '👋',
  speaking:  '🗣️',
  listening: '👂',
  thinking:  '🤔',
  success:   '✅',
  error:     '⚠️',
  loading:   '⏳',
  namaste:   '🙏',
};

const STATE_ANIMATION: Record<AvatarState, string> = {
  idle:      '',
  wave:      'animate-bounce',
  speaking:  'animate-pulse',
  listening: 'animate-pulse',
  thinking:  'animate-spin',
  success:   'animate-bounce',
  error:     'animate-pulse',
  loading:   'animate-spin',
  namaste:   'animate-bounce',
};

const STATE_RING: Record<AvatarState, string> = {
  idle:      'ring-gray-300',
  wave:      'ring-green-400',
  speaking:  'ring-blue-400',
  listening: 'ring-yellow-400',
  thinking:  'ring-purple-400',
  success:   'ring-green-500',
  error:     'ring-red-400',
  loading:   'ring-gray-400',
  namaste:   'ring-orange-400',
};

// Unsupported paths where avatar should hide
const UNSUPPORTED_PATHS = ['/admin', '/rajasthan', '/shopkeeper'];

function isUnsupportedPath(pathname: string): boolean {
  return UNSUPPORTED_PATHS.some(p => pathname.startsWith(p));
}

export default function VoiceGuideAvatar() {
  const { isAuthenticated } = useAuth();
  const { langCode } = useLanguage();
  const guide = useVoiceGuideContext();
  const [minimized, setMinimized] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [hidden, setHidden] = useState(false);

  // Draggable state
  const avatarRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef({ dragging: false, startX: 0, startY: 0, initX: 0, initY: 0 });
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);

  // Hide on unsupported paths
  useEffect(() => {
    const check = () => setHidden(isUnsupportedPath(window.location.pathname));
    check();
    window.addEventListener('popstate', check);
    window.addEventListener('voice-guide-navigate', check);
    return () => {
      window.removeEventListener('popstate', check);
      window.removeEventListener('voice-guide-navigate', check);
    };
  }, []);

  const handleReplay = useCallback(() => {
    guide.replay();
    window.dispatchEvent(new CustomEvent('voice-guide-button', { detail: { button: 'replay' } }));
  }, [guide]);

  const handleDismiss = useCallback(() => {
    guide.dismiss();
    setMinimized(true);
    setTimeout(() => setMinimized(false), 3000);
  }, [guide]);

  // Drag handlers
  const onPointerDown = useCallback((e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest('button')) return;
    dragRef.current.dragging = true;
    dragRef.current.startX = e.clientX;
    dragRef.current.startY = e.clientY;
    const rect = avatarRef.current?.getBoundingClientRect();
    dragRef.current.initX = rect ? window.innerWidth - rect.right : 16;
    dragRef.current.initY = rect ? window.innerHeight - rect.bottom : 24;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, []);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragRef.current.dragging) return;
    const dx = dragRef.current.startX - e.clientX;
    const dy = dragRef.current.startY - e.clientY;
    const newX = Math.max(8, Math.min(window.innerWidth - 80, dragRef.current.initX + dx));
    const newY = Math.max(8, Math.min(window.innerHeight - 80, dragRef.current.initY + dy));
    setPos({ x: newX, y: newY });
  }, []);

  const onPointerUp = useCallback(() => {
    dragRef.current.dragging = false;
  }, []);

  if (hidden) return null;
  if (!isAuthenticated && !guide.subtitle) return null;
  if (!isAuthenticated && !guide.bridgeOnline && !guide.subtitle && !guide.isPlaying) return null;

  const emoji = AVATAR_EMOJI[guide.avatarState] ?? '🧑‍🌾';
  const animation = STATE_ANIMATION[guide.avatarState] ?? '';
  const ring = STATE_RING[guide.avatarState] ?? 'ring-gray-300';

  const style: React.CSSProperties = pos
    ? { position: 'fixed', bottom: pos.y, right: pos.x, zIndex: 50 }
    : { position: 'fixed', bottom: 24, right: 16, zIndex: 50 };

  return (
    <div
      ref={avatarRef}
      style={style}
      className="vg-avatar-root flex flex-col items-end gap-2 pointer-events-none select-none"
      aria-live="polite"
      aria-label="Kisan Saathi Voice Guide"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
    >
      {/* Subtitle bubble */}
      {guide.subtitle && !minimized && !collapsed && (
        <div className="pointer-events-auto max-w-[280px] sm:max-w-xs bg-white border border-green-200 rounded-2xl rounded-br-sm shadow-lg px-4 py-3 text-sm text-gray-800 leading-relaxed relative animate-fadeIn">
          <p className="pr-6 whitespace-pre-wrap">{guide.subtitle}</p>
          <button
            onClick={handleDismiss}
            className="absolute top-2 right-2 text-gray-400 hover:text-gray-600 text-xs leading-none w-5 h-5 flex items-center justify-center rounded-full hover:bg-gray-100"
            aria-label="Dismiss"
          >
            ✕
          </button>
          {/* Speaking indicator */}
          {guide.isPlaying && guide.avatarState === 'speaking' && (
            <div className="flex gap-0.5 mt-2 items-end h-4">
              {[0, 1, 2, 3].map(i => (
                <span
                  key={i}
                  className="vg-bar"
                  style={{ height: `${8 + (i % 2) * 6}px`, animationDelay: `${i * 0.12}s` }}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Controls row */}
      <div className="pointer-events-auto flex items-center gap-2">
        {/* Replay */}
        {guide.bridgeOnline && !collapsed && (
          <button
            onClick={handleReplay}
            disabled={guide.isPlaying}
            className="bg-white border border-gray-200 rounded-full w-8 h-8 flex items-center justify-center shadow text-sm hover:bg-green-50 disabled:opacity-40 transition-colors"
            title="Replay"
            aria-label="Replay last guide"
          >
            🔁
          </button>
        )}

        {/* Mute toggle */}
        {!collapsed && (
          <button
            onClick={guide.toggleMute}
            className="bg-white border border-gray-200 rounded-full w-8 h-8 flex items-center justify-center shadow text-sm hover:bg-gray-50 transition-colors"
            title={guide.isMuted ? 'Unmute guide' : 'Mute guide'}
            aria-label={guide.isMuted ? 'Unmute voice guide' : 'Mute voice guide'}
          >
            {guide.isMuted ? '🔇' : '🔊'}
          </button>
        )}

        {/* Collapse toggle */}
        <button
          onClick={() => setCollapsed(c => !c)}
          className="bg-white border border-gray-200 rounded-full w-6 h-6 flex items-center justify-center shadow text-xs hover:bg-gray-50 transition-colors"
          title={collapsed ? 'Expand' : 'Collapse'}
          aria-label={collapsed ? 'Expand voice guide' : 'Collapse voice guide'}
        >
          {collapsed ? '▲' : '▼'}
        </button>

        {/* Avatar bubble */}
        <div
          className={`relative w-14 h-14 rounded-full bg-gradient-to-br from-green-50 to-green-100 ring-2 ${ring} shadow-lg flex items-center justify-center cursor-grab active:cursor-grabbing`}
          title="Kisan Saathi — drag to move"
        >
          <span className={`text-2xl ${animation}`} role="img" aria-label={guide.avatarState}>
            {emoji}
          </span>

          {/* Speaking dots */}
          {guide.isPlaying && guide.avatarState === 'speaking' && (
            <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 flex gap-0.5">
              {[0, 1, 2].map(i => (
                <span
                  key={i}
                  className="w-1.5 h-1.5 rounded-full bg-green-500 animate-bounce"
                  style={{ animationDelay: `${i * 0.15}s` }}
                />
              ))}
            </span>
          )}

          {/* Offline dot */}
          {!guide.bridgeOnline && (
            <span className="absolute top-0 right-0 w-3 h-3 rounded-full bg-red-400 border-2 border-white" title="Voice Guide offline" />
          )}
        </div>
      </div>

      {/* Language badge */}
      {guide.bridgeOnline && !collapsed && (
        <div className="pointer-events-none text-xs text-gray-400 text-right pr-1">
          {langCode.toUpperCase()}
        </div>
      )}
    </div>
  );
}
