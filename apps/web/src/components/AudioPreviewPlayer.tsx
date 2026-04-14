import { useEffect, useRef, useState } from "react";

type AudioPreviewPlayerProps = {
  src: string;
  title: string;
};

function formatTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) {
    return "0:00";
  }

  const totalSeconds = Math.floor(seconds);
  const minutes = Math.floor(totalSeconds / 60);
  const remainingSeconds = totalSeconds % 60;
  return `${minutes}:${String(remainingSeconds).padStart(2, "0")}`;
}

export function AudioPreviewPlayer({ src, title }: AudioPreviewPlayerProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) {
      return;
    }

    const handleLoadedMetadata = () => {
      setDuration(audio.duration || 0);
    };
    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime || 0);
    };
    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(audio.duration || 0);
    };

    audio.addEventListener("loadedmetadata", handleLoadedMetadata);
    audio.addEventListener("timeupdate", handleTimeUpdate);
    audio.addEventListener("play", handlePlay);
    audio.addEventListener("pause", handlePause);
    audio.addEventListener("ended", handleEnded);

    return () => {
      audio.pause();
      audio.removeEventListener("loadedmetadata", handleLoadedMetadata);
      audio.removeEventListener("timeupdate", handleTimeUpdate);
      audio.removeEventListener("play", handlePlay);
      audio.removeEventListener("pause", handlePause);
      audio.removeEventListener("ended", handleEnded);
    };
  }, [src]);

  function handleTogglePlayback() {
    const audio = audioRef.current;
    if (!audio) {
      return;
    }

    if (audio.paused) {
      void audio.play();
      return;
    }

    audio.pause();
  }

  function handleSeek(nextValue: string) {
    const audio = audioRef.current;
    if (!audio) {
      return;
    }

    const nextTime = Number(nextValue);
    if (!Number.isFinite(nextTime)) {
      return;
    }

    audio.currentTime = nextTime;
    setCurrentTime(nextTime);
  }

  return (
    <div className="rounded-3xl border border-cobalt-100 bg-cobalt-50 p-4 shadow-sm shadow-cobalt-100/60 md:p-5">
      <audio ref={audioRef} src={src} preload="metadata" />

      <div className="flex flex-col gap-4 md:flex-row md:items-center">
        <button
          type="button"
          onClick={handleTogglePlayback}
          className="inline-flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-cobalt-600 text-white shadow-lg shadow-cobalt-200 transition hover:bg-cobalt-700"
          aria-label={isPlaying ? "Pause audio preview" : "Play audio preview"}
        >
          {isPlaying ? (
            <svg viewBox="0 0 24 24" aria-hidden="true" className="h-6 w-6 fill-current">
              <path d="M7 5h3v14H7zM14 5h3v14h-3z" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" aria-hidden="true" className="h-6 w-6 fill-current">
              <path d="m8 5 11 7-11 7z" />
            </svg>
          )}
        </button>

        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-cobalt-700">Audio Preview</p>
          <p className="mt-1 truncate font-display text-lg font-semibold text-ink">{title}</p>

          <div className="mt-3 flex items-center gap-3">
            <span className="w-11 text-xs font-medium text-sand-600">{formatTime(currentTime)}</span>
            <input
              type="range"
              min={0}
              max={duration || 0}
              step="0.1"
              value={Math.min(currentTime, duration || 0)}
              onChange={(event) => handleSeek(event.target.value)}
              className="h-2 w-full cursor-pointer accent-cobalt-600"
              aria-label="Audio preview progress"
            />
            <span className="w-11 text-right text-xs font-medium text-sand-600">{formatTime(duration)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
