'use client';

/**
 * VoiceButton — Shared Voice UI Component (Phase 6)
 *
 * Single reusable button used by every page for voice interaction.
 * Supports: push-to-talk, continuous mode, interrupt, replay.
 *
 * Uses the singleton VoiceEngineContext — no re-initialization per page.
 *
 * Usage:
 *   <VoiceButton onResult={r => console.log(r.englishForBackend)} />
 *   <VoiceButton mode="push-to-talk" onResult={...} />
 *   <VoiceButton mode="continuous" onResult={...} />
 *   <VoiceButton speakText="Your crop has leaf blight" />
 */

import { useCallback } from 'react';
import { FaMicrophone, FaStop, FaVolumeUp, FaRedo, FaPause } from 'react-icons/fa';
import { useVoiceEngineContext } from '@/components/VoiceEngineProvider';
import type { PipelineResult } from '@/services/speechPipeline';

export type VoiceButtonMode = 'listen' | 'push-to-talk' | 'continuous' | 'speak';

interface VoiceButtonProps {
  /** Callback when STT produces a result */
  onResult?: (result: PipelineResult) => void;
  /** Text to speak (for speak mode) */
  speakText?: string;
  /** Hindi translation of speakText (optional) */
  speakHindi?: string;
  /** Interaction mode */
  mode?: VoiceButtonMode;
  /** Page context for pipeline (auto-detected if omitted) */
  pageContext?: string;
  disabled?: boolean;
  className?: string;
  /** Show label text next to icon */
  showLabel?: boolean;
}

export default function VoiceButton({
  onResult,
  speakText,
  speakHindi,
  mode = 'listen',
  pageContext,
  disabled = false,
  className = '',
  showLabel = false,
}: VoiceButtonProps) {
  const voice = useVoiceEngineContext();

  const handleClick = useCallback(() => {
    if (!voice.ready || disabled) return;

    if (mode === 'speak' && speakText) {
      if (voice.ttsState === 'playing') {
        voice.interrupt();
      } else if (voice.ttsState === 'paused') {
        voice.resume();
      } else {
        voice.speak(speakText, speakHindi);
      }
      return;
    }

    if (mode === 'continuous') {
      if (voice.isContinuous) {
        voice.stopContinuous();
      } else {
        voice.startContinuous(onResult ?? (() => {}), pageContext);
      }
      return;
    }

    if (mode === 'listen') {
      if (voice.sttState === 'listening') {
        voice.stopListening();
      } else {
        voice.startListening(onResult ?? (() => {}), pageContext);
      }
    }
  }, [voice, mode, speakText, speakHindi, onResult, pageContext, disabled]);

  const handlePTTDown = useCallback(() => {
    if (mode !== 'push-to-talk' || disabled || !voice.ready) return;
    voice.pushToTalkStart();
  }, [voice, mode, disabled]);

  const handlePTTUp = useCallback(() => {
    if (mode !== 'push-to-talk' || !voice.isHolding) return;
    voice.pushToTalkEnd(onResult ?? (() => {}), pageContext);
  }, [voice, mode, onResult, pageContext]);

  // Determine button appearance
  const isActive =
    (mode === 'listen' && voice.sttState === 'listening') ||
    (mode === 'continuous' && voice.isContinuous) ||
    (mode === 'push-to-talk' && voice.isHolding) ||
    (mode === 'speak' && voice.ttsState === 'playing');

  const isPaused = mode === 'speak' && voice.ttsState === 'paused';

  if (!voice.ttsSupported && mode === 'speak') return null;
  if (!voice.sttSupported && mode !== 'speak') return null;

  const icon = (() => {
    if (mode === 'speak') {
      if (voice.ttsState === 'playing') return <FaStop size={11} />;
      if (voice.ttsState === 'paused') return <FaPause size={11} />;
      return <FaVolumeUp size={11} />;
    }
    if (voice.sttState === 'listening' || voice.isHolding) return <FaStop size={11} />;
    return <FaMicrophone size={11} />;
  })();

  const label = (() => {
    if (!showLabel) return null;
    if (mode === 'speak') {
      if (voice.ttsState === 'playing') return 'रोकें';
      if (voice.ttsState === 'paused') return 'जारी रखें';
      return 'सुनें';
    }
    if (voice.sttState === 'listening') return 'रोकें';
    if (mode === 'continuous' && voice.isContinuous) return 'बंद करें';
    if (mode === 'push-to-talk') return 'दबाएं';
    return 'बोलें';
  })();

  const baseClass = `inline-flex items-center gap-1.5 rounded-xl transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 disabled:opacity-40 ${showLabel ? 'px-3 py-2 text-xs font-semibold' : 'h-9 w-9 justify-center'}`;

  const colorClass = isActive
    ? 'bg-red-500 text-white animate-pulse'
    : isPaused
    ? 'bg-amber-100 text-amber-700 hover:bg-amber-200'
    : 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200';

  if (mode === 'push-to-talk') {
    return (
      <button
        type="button"
        onMouseDown={handlePTTDown}
        onMouseUp={handlePTTUp}
        onTouchStart={handlePTTDown}
        onTouchEnd={handlePTTUp}
        disabled={disabled || !voice.ready}
        aria-label="Push to talk"
        aria-pressed={voice.isHolding}
        className={`${baseClass} ${colorClass} ${className}`}
      >
        {icon}
        {label}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled || !voice.ready}
      aria-label={mode === 'speak' ? 'Play voice' : 'Voice input'}
      aria-pressed={isActive}
      className={`${baseClass} ${colorClass} ${className}`}
    >
      {icon}
      {label}
    </button>
  );
}

/**
 * VoiceReplayButton — replay the last spoken text.
 * Thin wrapper around VoiceButton for replay use case.
 */
export function VoiceReplayButton({ className = '' }: { className?: string }) {
  const voice = useVoiceEngineContext();
  if (!voice.ttsSupported) return null;
  return (
    <button
      type="button"
      onClick={voice.replay}
      disabled={!voice.ready || !voice.lastResult}
      aria-label="Replay last voice"
      className={`inline-flex h-8 w-8 items-center justify-center rounded-xl bg-slate-100 text-slate-500 hover:bg-slate-200 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 disabled:opacity-40 ${className}`}
    >
      <FaRedo size={10} />
    </button>
  );
}
