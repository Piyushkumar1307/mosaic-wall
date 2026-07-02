"use client";

import { useEffect, useRef, useState } from "react";

const OUTPUT_SIZE = 720;

type CameraCaptureProps = {
  onCapture: (dataUrl: string) => void;
  onClose: () => void;
};

/** Center-crop the video feed to a square — fills frame, no letterboxing. */
function drawSquareCrop(
  ctx: CanvasRenderingContext2D,
  video: HTMLVideoElement,
  size: number
) {
  const vw = video.videoWidth;
  const vh = video.videoHeight;
  if (!vw || !vh) return;

  const cropSize = Math.min(vw, vh);
  const sx = (vw - cropSize) / 2;
  const sy = (vh - cropSize) / 2;

  ctx.drawImage(video, sx, sy, cropSize, cropSize, 0, 0, size, size);
}

export function CameraCapture({ onCapture, onClose }: CameraCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [error, setError] = useState("");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function startCamera() {
      if (!navigator.mediaDevices?.getUserMedia) {
        setError("Camera is not supported on this device.");
        return;
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: "user",
            width: { ideal: 720 },
            height: { ideal: 720 },
            aspectRatio: { ideal: 1 },
          },
          audio: false,
        });

        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        streamRef.current = stream;
        const video = videoRef.current;
        if (!video) return;

        video.srcObject = stream;
        await video.play();
        setReady(true);
      } catch {
        setError("Could not open camera. Please allow camera permission.");
      }
    }

    startCamera();

    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    };
  }, []);

  function handleCapture() {
    const video = videoRef.current;
    if (!video || !ready) return;

    const canvas = document.createElement("canvas");
    canvas.width = OUTPUT_SIZE;
    canvas.height = OUTPUT_SIZE;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    drawSquareCrop(ctx, video, OUTPUT_SIZE);

    streamRef.current?.getTracks().forEach((track) => track.stop());
    onCapture(canvas.toDataURL("image/jpeg", 0.82));
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black">
      <div className="flex items-center justify-between px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-3">
        <button
          type="button"
          onClick={onClose}
          className="rounded-full bg-white/10 px-4 py-2 text-sm font-medium text-white"
        >
          Cancel
        </button>
        <p className="text-sm font-medium text-white">Take your photo</p>
        <div className="w-16" />
      </div>

      <div className="relative flex flex-1 items-center justify-center px-4">
        {error ? (
          <div className="flex h-full items-center justify-center px-6 text-center text-rose-300">
            {error}
          </div>
        ) : (
          <div className="relative aspect-square w-full max-w-md max-h-[min(100%,80vw)] overflow-hidden rounded-xl">
            <video
              ref={videoRef}
              playsInline
              muted
              className="h-full w-full object-cover"
            />
            <div className="pointer-events-none absolute inset-0 rounded-xl border-2 border-white/50" />
          </div>
        )}
      </div>

      <p className="px-6 pb-2 text-center text-xs text-slate-400">
        Square photo — fills the frame
      </p>

      <div className="flex justify-center px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-4">
        <button
          type="button"
          onClick={handleCapture}
          disabled={!ready || Boolean(error)}
          className="h-20 w-20 rounded-full border-4 border-white bg-white/20 disabled:opacity-40"
          aria-label="Capture photo"
        />
      </div>
    </div>
  );
}
