"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { getSession, sessionVideoUrl, startTranscription, type Session } from "@/lib/api";
import { CaptionEditor } from "./caption-editor";

export default function SessionPreviewPage() {
  const { id } = useParams<{ id: string }>();
  const [session, setSession] = useState<Session | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [actionError, setActionError] = useState("");
  const [error, setError] = useState("");
  const [videoError, setVideoError] = useState(false);

  useEffect(() => {
    const controller = new AbortController();

    getSession(id, controller.signal)
      .then(setSession)
      .catch((requestError: unknown) => {
        if (requestError instanceof DOMException && requestError.name === "AbortError") return;
        setError(requestError instanceof Error ? requestError.message : "Unable to open this video.");
      });

    return () => controller.abort();
  }, [id]);

  useEffect(() => {
    if (session?.status !== "TRANSCRIBING") return;

    const controller = new AbortController();

    const timer = window.setInterval(() => {
      getSession(id, controller.signal)
        .then(setSession)
        .catch((requestError: unknown) => {
          if (
            requestError instanceof DOMException &&
            requestError.name === "AbortError"
          ) {
            return;
          }

          setActionError(
            requestError instanceof Error
              ? requestError.message
              : "Unable to check transcription status.",
          );
        });
    }, 2000);

    return () => {
      window.clearInterval(timer);
      controller.abort();
    };
  }, [id, session?.status]);

  async function handleTranscription() {
    setIsStarting(true);
    setActionError("");

    try {
      const updatedSession = await startTranscription(id);
      setSession(updatedSession);
    } catch (requestError) {
      setActionError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to start transcription.",
      );
    } finally {
      setIsStarting(false);
    }
  }

  if (error) {
    return (
      <main className="state-page">
        <div className="state-card">
          <span className="state-icon">!</span>
          <h1>This session is unavailable.</h1>
          <p>{error}</p>
          <Link className="primary-button" href="/">Upload another video</Link>
        </div>
      </main>
    );
  }

  if (!session) {
    return (
      <main className="state-page" aria-live="polite">
        <div className="loading-mark" aria-hidden="true" />
        <strong>Opening your video…</strong>
      </main>
    );
  }

  if (session.status === "READY" && session.captionData?.groups?.length) {
    return <CaptionEditor session={session} />;
  }

  return (
    <main className="editor-shell">
      <header className="editor-header">
        <Link className="brand" href="/">
          <span className="brand-mark" aria-hidden="true"><i /><i /><i /></span>
          CaptionFlow
        </Link>
        <span className="file-name" title={session.sourceFileName}>{session.sourceFileName}</span>
        <Link className="secondary-button" href="/">New video</Link>
      </header>

      <div className="editor-workspace">
        <section className="video-panel" aria-labelledby="preview-title">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">Preview</span>
              <h1 id="preview-title">Your video is ready.</h1>
            </div>
            <span className="ready-badge"><i /> Uploaded</span>
          </div>

          <div className="video-stage">
            {videoError ? (
              <p className="video-error">The browser could not play this video.</p>
            ) : (
              <video
                controls
                playsInline
                preload="metadata"
                crossOrigin="use-credentials"
                src={sessionVideoUrl(id)}
                style={session.width && session.height ? { aspectRatio: `${session.width} / ${session.height}` } : undefined}
                onError={() => setVideoError(true)}
              />
            )}
          </div>
        </section>

        <aside className="details-panel">
          <div>
            <span className="eyebrow">Video details</span>
            <h2>Ready for captions</h2>
          </div>
          <dl>
            <div><dt>Length</dt><dd>{formatDuration(session.durationSeconds)}</dd></div>
            <div><dt>Size</dt><dd>{session.width && session.height ? `${session.width} × ${session.height}` : "—"}</dd></div>
            <div><dt>Frame rate</dt><dd>{session.frameRate ? `${session.frameRate.toFixed(2)} fps` : "—"}</dd></div>
            <div><dt>Codec</dt><dd>{session.videoCodec?.toUpperCase() ?? "—"}</dd></div>
          </dl>
          <div className="next-step-card" aria-live="polite">
            <span className="next-step-number">Captions</span>

            {session.status === "READY" && session.captionData ? (
              <>
                <strong>Caption groups ready</strong>
                {session.captionData.groups?.length ? (
                  <div className="caption-group-list">
                    {session.captionData.groups.map((group) => (
                      <div key={group.id}>
                        <small>{formatTimestamp(group.start)} – {formatTimestamp(group.end)}</small>
                        <p>{group.wordIds
                          .map((wordId) => session.captionData?.words.find((word) => word.id === wordId)?.text)
                          .filter(Boolean)
                          .join(" ")}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="transcript-preview">{session.captionData.text}</p>
                )}
              </>
            ) : session.status === "TRANSCRIBING" ? (
              <>
                <strong>Generating captions…</strong>
                <p>
                  Turbo is transcribing locally. You can keep this page open.
                </p>
              </>
            ) : (
              <>
                <strong>Generate the first transcript</strong>
                <p>
                  Create word-level captions from the uploaded video.
                </p>

                {session.status === "FAILED" && (
                  <p className="form-error">
                    {session.errorMessage}
                  </p>
                )}

                <button
                  type="button"
                  className="primary-button"
                  disabled={isStarting}
                  onClick={handleTranscription}
                >
                  {isStarting ? "Starting…" : "Generate captions"}
                </button>
              </>
            )}

            {actionError && (
              <p className="form-error" role="alert">
                {actionError}
              </p>
            )}
          </div>
          <p className="expiry-note">This temporary session expires after one hour of inactivity.</p>
        </aside>
      </div>
    </main>
  );
}

function formatDuration(seconds: number | null) {
  if (!seconds) return "—";
  const totalSeconds = Math.round(seconds);
  const minutes = Math.floor(totalSeconds / 60);
  const remainingSeconds = (totalSeconds % 60).toString().padStart(2, "0");
  return `${minutes}:${remainingSeconds}`;
}

function formatTimestamp(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = (seconds % 60).toFixed(2).padStart(5, "0");
  return `${minutes}:${remainingSeconds}`;
}
