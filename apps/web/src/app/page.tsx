"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { uploadVideo } from "@/lib/api";

const maximumFileBytes = 250 * 1024 * 1024;

export default function Home() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState("");

  function selectVideo(file: File | undefined) {
    if (!file) return;
    if (file.type !== "video/mp4" || !file.name.toLowerCase().endsWith(".mp4")) {
      setError("Choose an MP4 video.");
      return;
    }
    if (file.size > maximumFileBytes) {
      setError("Choose a video smaller than 250 MB.");
      return;
    }

    setError("");
    setProgress(0);

    uploadVideo(file, setProgress)
      .then((id) => router.push(`/sessions/${id}`))
      .catch((uploadError: unknown) => {
        setProgress(null);
        setError(uploadError instanceof Error ? uploadError.message : "The video could not be uploaded.");
      });
  }

  return (
    <main className="landing-shell">
      <header className="site-header">
        <a className="brand" href="#top" aria-label="CaptionFlow home">
          <span className="brand-mark" aria-hidden="true"><i /><i /><i /></span>
          CaptionFlow
        </a>
        <nav aria-label="Main navigation">
          <a href="#examples">Examples</a>
          <a href="#how-it-works">How it works</a>
        </nav>
      </header>

      <section className="hero" id="top">
        <div className="hero-copy">
          <span className="eyebrow">Local auto captions</span>
          <h1>Captions that land on <mark>every word.</mark></h1>
          <p>Upload your short video, fix the timing, and export captions that feel made for the moment.</p>
          <div className="trust-row" aria-label="Product benefits">
            <span>No account needed</span>
            <span>Files stay temporary</span>
          </div>
        </div>

        <div
          className={`upload-card${isDragging ? " is-dragging" : ""}`}
          onDragEnter={(event) => { event.preventDefault(); setIsDragging(true); }}
          onDragOver={(event) => event.preventDefault()}
          onDragLeave={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setIsDragging(false);
          }}
          onDrop={(event) => {
            event.preventDefault();
            setIsDragging(false);
            selectVideo(event.dataTransfer.files[0]);
          }}
        >
          <input
            ref={inputRef}
            type="file"
            accept="video/mp4,.mp4"
            onChange={(event) => selectVideo(event.target.files?.[0])}
            disabled={progress !== null}
          />
          <div className="upload-icon" aria-hidden="true"><span>↑</span></div>
          <button type="button" className="primary-button" onClick={() => inputRef.current?.click()} disabled={progress !== null}>
            {progress === null ? "Upload video" : `Uploading ${progress}%`}
          </button>
          <strong>or drop an MP4 here</strong>
          <small>Vertical video works best · Maximum 250 MB</small>
          {progress !== null && (
            <div className="progress-track" aria-label={`Upload ${progress}% complete`}>
              <span style={{ width: `${progress}%` }} />
            </div>
          )}
          {error && <p className="form-error" role="alert">{error}</p>}
        </div>
      </section>

      <section className="examples" id="examples" aria-labelledby="examples-title">
        <div className="section-heading">
          <span className="eyebrow">Built for short-form video</span>
          <h2 id="examples-title">One voice. Three useful moments.</h2>
        </div>
        <div className="example-grid">
          <article className="example-card example-clean">
            <span>Clean</span><div className="caption-demo">make every moment count</div>
          </article>
          <article className="example-card example-active">
            <span>Active word</span><div className="caption-demo">tell your <mark>STORY</mark> clearly</div>
          </article>
          <article className="example-card example-emphasis">
            <span>Big emphasis</span><div className="caption-demo">DON&apos;T<br />MISS THIS</div>
          </article>
        </div>
      </section>

      <section className="how-it-works" id="how-it-works" aria-labelledby="how-title">
        <div className="section-heading">
          <span className="eyebrow">A short workflow</span>
          <h2 id="how-title">Upload. Adjust. Export.</h2>
        </div>
        <ol>
          <li><b>1</b><span><strong>Upload a finished video</strong><small>Use the MP4 you already prepared for Reels or TikTok.</small></span></li>
          <li><b>2</b><span><strong>Fix words and timing</strong><small>Correct the transcript and align caption blocks with speech.</small></span></li>
          <li><b>3</b><span><strong>Export with captions</strong><small>Download the finished video without keeping a project history.</small></span></li>
        </ol>
      </section>
    </main>
  );
}
