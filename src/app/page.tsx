"use client";

import { FormEvent, useState } from "react";
import { CameraCapture } from "@/components/CameraCapture";
import { BrandHeader } from "@/components/BrandHeader";

const PRESET_MESSAGES = [
  "Having an amazing time! 🎉",
  "Best day ever with great people!",
  "Smiles all around today 😊",
  "Making memories that last forever",
  "So grateful to be here!",
  "This moment is everything ✨",
  "Cheers to good vibes only!",
  "Living my best life right now",
  "What a beautiful celebration!",
  "Forever thankful for today",
  "Good times and great company",
  "Happiness looks good on us!",
  "Here's to new adventures 🥂",
  "Couldn't ask for a better day",
  "Love, laughter, and lots of fun!",
];

const CUSTOM_MESSAGE_OPTION = "__custom__";

export default function SubmitPage() {
  const [name, setName] = useState("");
  const [messageSelection, setMessageSelection] = useState("");
  const [customMessage, setCustomMessage] = useState("");
  const [photoPreview, setPhotoPreview] = useState("");
  const [photoData, setPhotoData] = useState("");
  const [showCamera, setShowCamera] = useState(false);
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">(
    "idle"
  );
  const [error, setError] = useState("");

  function handleCapture(dataUrl: string) {
    setPhotoData(dataUrl);
    setPhotoPreview(dataUrl);
    setShowCamera(false);
    setError("");
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim() || !photoData || status === "sending") return;

    setStatus("sending");
    setError("");

    try {
      const text =
        messageSelection === CUSTOM_MESSAGE_OPTION
          ? customMessage.trim()
          : messageSelection;

      const res = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, photo: photoData, text }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to send");
      }

      setName("");
      setMessageSelection("");
      setCustomMessage("");
      setPhotoData("");
      setPhotoPreview("");
      setStatus("sent");
      setTimeout(() => setStatus("idle"), 2000);
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "Something went wrong");
    }
  }

  const canSubmit = name.trim().length > 0 && photoData.length > 0;

  return (
    <>
      <main className="min-h-dvh flex flex-col bg-black">
        <BrandHeader />

        <form
          onSubmit={handleSubmit}
          className="mx-auto flex w-full max-w-lg flex-1 flex-col px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-2 sm:px-6"
        >
          <div className="flex-1 space-y-5">
            <div>
              <label
                htmlFor="name"
                className="mb-2 block text-center text-sm font-medium text-slate-300"
              >
                Your name
              </label>
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter your name"
                maxLength={100}
                autoComplete="name"
                className="w-full rounded-2xl border border-slate-600/60 bg-slate-950/50 px-4 py-3.5 text-center text-base text-white placeholder:text-center placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-400/60 focus:border-sky-400/40"
              />
            </div>

            <div>
              <label
                htmlFor="message"
                className="mb-2 block text-center text-sm font-medium text-slate-300"
              >
                Your message
              </label>
              <select
                id="message"
                value={messageSelection}
                onChange={(e) => setMessageSelection(e.target.value)}
                className="w-full appearance-none rounded-2xl border border-slate-600/60 bg-slate-950/50 px-4 py-3.5 text-center text-base text-white focus:outline-none focus:ring-2 focus:ring-sky-400/60 focus:border-sky-400/40"
              >
                <option value="" className="bg-slate-900 text-slate-400">
                  Pick a message (optional)
                </option>
                <option
                  value={CUSTOM_MESSAGE_OPTION}
                  className="bg-slate-900 text-white"
                >
                  Custom message...
                </option>
                {PRESET_MESSAGES.map((preset) => (
                  <option
                    key={preset}
                    value={preset}
                    className="bg-slate-900 text-white"
                  >
                    {preset}
                  </option>
                ))}
              </select>
              {messageSelection === CUSTOM_MESSAGE_OPTION && (
                <textarea
                  id="custom-message"
                  value={customMessage}
                  onChange={(e) => setCustomMessage(e.target.value)}
                  placeholder="Write your own message"
                  maxLength={280}
                  rows={3}
                  className="mt-3 w-full resize-none rounded-2xl border border-slate-600/60 bg-slate-950/50 px-4 py-3.5 text-center text-base text-white placeholder:text-center placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-400/60 focus:border-sky-400/40"
                />
              )}
            </div>

            <div className="flex flex-col items-center">
              <p className="mb-2 w-full text-center text-sm font-medium text-slate-300">
                Your photo
              </p>
              <button
                type="button"
                onClick={() => setShowCamera(true)}
                className="relative aspect-square w-[min(100%,280px)] rounded-2xl border-2 border-dashed border-slate-600/70 bg-slate-950/40 overflow-hidden transition active:scale-[0.99] hover:border-sky-400/50"
              >
                {photoPreview ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={photoPreview}
                    alt="Your preview"
                    className="absolute inset-0 h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full flex-col items-center justify-center gap-2 text-slate-400 px-4">
                    <span className="text-4xl">📷</span>
                    <span className="text-sm font-medium text-center">
                      Tap to open camera
                    </span>
                  </div>
                )}
              </button>
              {photoPreview && (
                <button
                  type="button"
                  onClick={() => setShowCamera(true)}
                  className="mt-2 w-[min(100%,280px)] rounded-xl border border-slate-600/60 py-2.5 text-center text-sm font-medium text-slate-300 active:bg-slate-800/60"
                >
                  Retake photo
                </button>
              )}
            </div>
          </div>

          <div className="mt-4 min-h-5 text-center text-xs">
            {status === "sent" && (
              <span className="text-emerald-400 font-medium">
                Added to the wall!
              </span>
            )}
            {status === "error" && (
              <span className="text-rose-400 font-medium">{error}</span>
            )}
          </div>

          <button
            type="submit"
            disabled={!canSubmit || status === "sending"}
            className="mt-3 w-full rounded-2xl bg-sky-500 py-4 text-lg font-semibold text-white shadow-lg shadow-sky-500/25 transition active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100"
          >
            {status === "sending" ? "Sending..." : "Send to Wall"}
          </button>
        </form>
      </main>

      {showCamera && (
        <CameraCapture
          onCapture={handleCapture}
          onClose={() => setShowCamera(false)}
        />
      )}
    </>
  );
}
