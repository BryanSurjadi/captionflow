"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  saveCaptionData,
  sessionVideoUrl,
  type CaptionData,
  type CaptionGroup,
  type Session,
  type TranscriptWord,
} from "@/lib/api";

export function CaptionEditor({ session }: { session: Session }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const firstSave = useRef(true);
  const [captions, setCaptions] = useState(session.captionData!);
  const [selectedGroupId, setSelectedGroupId] = useState(captions.groups[0]?.id ?? "");
  const [selectedWordId, setSelectedWordId] = useState(captions.groups[0]?.wordIds[0] ?? "");
  const [draftText, setDraftText] = useState(() => groupText(captions, captions.groups[0]));
  const [currentTime, setCurrentTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [saveState, setSaveState] = useState<"saved" | "saving" | "error">("saved");

  const wordsById = useMemo(() => new Map(captions.words.map((word) => [word.id, word])), [captions.words]);
  const selectedIndex = captions.groups.findIndex((group) => group.id === selectedGroupId);
  const selectedGroup = captions.groups[selectedIndex];
  const activeGroup = captions.groups.find((group) => currentTime >= group.start && currentTime <= group.end);
  const duration = session.durationSeconds ?? captions.durationSeconds;

  useEffect(() => {
    if (firstSave.current) {
      firstSave.current = false;
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setSaveState("saving");
      try {
        await saveCaptionData(session.id, captions, controller.signal);
        if (!controller.signal.aborted) setSaveState("saved");
      } catch {
        if (!controller.signal.aborted) setSaveState("error");
      }
    }, 600);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [captions, session.id]);

  function selectGroup(group: CaptionGroup) {
    setSelectedGroupId(group.id);
    setSelectedWordId(group.wordIds[Math.max(0, Math.floor(group.wordIds.length / 2) - 1)] ?? "");
    setDraftText(groupText(captions, group));
    seek(group.start);
  }

  function seek(time: number) {
    if (videoRef.current) videoRef.current.currentTime = time;
    setCurrentTime(time);
  }

  async function togglePlayback() {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) await video.play();
    else video.pause();
  }

  function applyText() {
    if (!selectedGroup) return;
    const tokens = draftText.trim().split(/\s+/).filter(Boolean);
    if (!tokens.length) return;

    const oldWords = selectedGroup.wordIds.map((id) => wordsById.get(id)!).filter(Boolean);
    let replacements: TranscriptWord[];

    if (tokens.length === oldWords.length) {
      replacements = oldWords.map((word, index) => ({ ...word, text: tokens[index]!, edited: true }));
    } else {
      const slice = (selectedGroup.end - selectedGroup.start) / tokens.length;
      replacements = tokens.map((text, index) => ({
        id: `w-${crypto.randomUUID()}`,
        text,
        start: selectedGroup.start + slice * index,
        end: selectedGroup.start + slice * (index + 1),
        probability: 0,
        hidden: false,
        edited: true,
      }));
    }

    const removedIds = new Set(selectedGroup.wordIds);
    setCaptions((current) => ({
      ...current,
      words: [...current.words.filter((word) => !removedIds.has(word.id)), ...replacements].sort((a, b) => a.start - b.start),
      groups: current.groups.map((group) => group.id === selectedGroup.id
        ? { ...group, wordIds: replacements.map((word) => word.id) }
        : group),
    }));
    setSelectedWordId(replacements[Math.max(0, Math.floor(replacements.length / 2) - 1)]!.id);
  }

  function splitGroup() {
    if (!selectedGroup) return;
    const splitIndex = selectedGroup.wordIds.indexOf(selectedWordId);
    if (splitIndex < 0 || splitIndex === selectedGroup.wordIds.length - 1) return;

    const leftIds = selectedGroup.wordIds.slice(0, splitIndex + 1);
    const rightIds = selectedGroup.wordIds.slice(splitIndex + 1);
    const leftEnd = wordsById.get(leftIds.at(-1)!)!.end;
    const rightStart = wordsById.get(rightIds[0]!)!.start;
    const rightId = `g-${crypto.randomUUID()}`;

    setCaptions((current) => ({
      ...current,
      groups: current.groups.flatMap((group) => group.id === selectedGroup.id ? [
        { ...group, wordIds: leftIds, end: leftEnd },
        { id: rightId, wordIds: rightIds, start: rightStart, end: group.end },
      ] : group),
    }));
    setDraftText(leftIds.map((id) => wordsById.get(id)?.text).join(" "));
    setSelectedWordId(leftIds[0]!);
  }

  function mergeNext() {
    if (!selectedGroup || selectedIndex < 0 || selectedIndex === captions.groups.length - 1) return;
    const next = captions.groups[selectedIndex + 1]!;
    const merged = { ...selectedGroup, wordIds: [...selectedGroup.wordIds, ...next.wordIds], end: next.end };
    setCaptions((current) => ({
      ...current,
      groups: current.groups.filter((group) => group.id !== next.id).map((group) => group.id === merged.id ? merged : group),
    }));
    setDraftText(groupText(captions, merged));
  }

  return (
    <main className="caption-editor">
      <header className="caption-editor-header">
        <Link className="brand" href="/">
          <span className="brand-mark" aria-hidden="true"><i /><i /><i /></span>
          CaptionFlow
        </Link>
        <div className="editor-title">
          <strong>{session.sourceFileName}</strong>
          <span className={`save-state ${saveState}`}>{saveState === "saving" ? "Saving…" : saveState === "error" ? "Save failed" : "All changes saved"}</span>
        </div>
        <Link className="secondary-button" href="/">New video</Link>
      </header>

      <section className="caption-editor-grid">
        <aside className="caption-list-panel">
          <div className="editor-panel-title">
            <span>Transcript</span>
            <small>{captions.groups.length} blocks</small>
          </div>
          <div className="caption-block-list">
            {captions.groups.map((group, index) => (
              <button
                type="button"
                className={group.id === selectedGroupId ? "selected" : group.id === activeGroup?.id ? "active" : ""}
                onClick={() => selectGroup(group)}
                key={group.id}
              >
                <span>{String(index + 1).padStart(2, "0")}</span>
                <div><small>{formatTime(group.start)} — {formatTime(group.end)}</small><p>{groupText(captions, group)}</p></div>
              </button>
            ))}
          </div>
        </aside>

        <section className="caption-stage-panel" aria-label="Video preview">
          <div className="editor-video-frame" style={{ aspectRatio: session.width && session.height ? `${session.width} / ${session.height}` : "9 / 16" }}>
            <video
              ref={videoRef}
              playsInline
              preload="metadata"
              crossOrigin="use-credentials"
              src={sessionVideoUrl(session.id)}
              onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)}
              onPlay={() => setPlaying(true)}
              onPause={() => setPlaying(false)}
              onEnded={() => setPlaying(false)}
            />
            {activeGroup && (
              <div className="live-caption" aria-live="off">
                {activeGroup.wordIds.map((id) => {
                  const word = wordsById.get(id);
                  if (!word) return null;
                  const active = currentTime >= word.start && currentTime <= word.end;
                  return <span className={active ? "active" : ""} key={id}>{word.text}</span>;
                })}
              </div>
            )}
          </div>
          <div className="playback-controls">
            <button type="button" onClick={() => void togglePlayback()} aria-label={playing ? "Pause video" : "Play video"}>{playing ? "Ⅱ" : "▶"}</button>
            <time>{formatTime(currentTime)}</time>
            <input type="range" min={0} max={duration} step={0.01} value={currentTime} onChange={(event) => seek(Number(event.target.value))} aria-label="Video position" />
            <time>{formatTime(duration)}</time>
          </div>
        </section>

        <aside className="caption-inspector">
          <div className="editor-panel-title"><span>Edit caption</span><small>{selectedIndex >= 0 ? `Block ${selectedIndex + 1}` : ""}</small></div>
          {selectedGroup && (
            <>
              <label>Caption text<textarea value={draftText} onChange={(event) => setDraftText(event.target.value)} /></label>
              <button className="apply-caption-button" type="button" onClick={applyText} disabled={!draftText.trim()}>Apply text</button>
              <div className="word-picker">
                <span>Choose where to split</span>
                <div>{selectedGroup.wordIds.map((id) => (
                  <button type="button" className={id === selectedWordId ? "selected" : ""} onClick={() => setSelectedWordId(id)} key={id}>{wordsById.get(id)?.text}</button>
                ))}</div>
              </div>
              <div className="group-actions">
                <button type="button" onClick={splitGroup} disabled={selectedGroup.wordIds.at(-1) === selectedWordId}>Split after word</button>
                <button type="button" onClick={mergeNext} disabled={selectedIndex === captions.groups.length - 1}>Merge with next</button>
              </div>
              <p className="inspector-note">Captions appear in the middle for now. Style and position controls come in the next editor step.</p>
            </>
          )}
        </aside>
      </section>

      <section className="caption-timeline">
        <div className="timeline-heading"><strong>Caption timing</strong><span>{formatTime(currentTime)} / {formatTime(duration)}</span></div>
        <div className="timeline-ruler">{[0, .25, .5, .75, 1].map((point) => <span key={point}>{formatTime(duration * point)}</span>)}</div>
        <div className="timeline-lane">
          <i style={{ left: `${Math.min(100, currentTime / duration * 100)}%` }} />
          {captions.groups.map((group) => (
            <button
              type="button"
              className={group.id === selectedGroupId ? "selected" : group.id === activeGroup?.id ? "active" : ""}
              style={{ left: `${group.start / duration * 100}%`, width: `${Math.max(1.5, (group.end - group.start) / duration * 100)}%` }}
              onClick={() => selectGroup(group)}
              title={groupText(captions, group)}
              key={group.id}
            >{groupText(captions, group)}</button>
          ))}
        </div>
      </section>
    </main>
  );
}

function groupText(captions: CaptionData, group?: CaptionGroup) {
  if (!group) return "";
  const words = new Map(captions.words.map((word) => [word.id, word.text]));
  return group.wordIds.map((id) => words.get(id)).filter(Boolean).join(" ");
}

function formatTime(seconds: number) {
  const safe = Number.isFinite(seconds) ? Math.max(0, seconds) : 0;
  const minutes = Math.floor(safe / 60);
  return `${minutes}:${(safe % 60).toFixed(1).padStart(4, "0")}`;
}
