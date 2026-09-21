# CaptionFlow Development Roadmap

Build one working path at a time. Commit after every checkpoint.

## Phase 1 — Upload foundation

**Goal:** upload one validated video, persist its temporary session, and play it in the browser.

1. Run PostgreSQL locally with Docker Compose.
2. Configure Prisma with a minimal `CaptionSession` model.
3. Add server-controlled `storage/sessions/<session-id>/` directories.
4. Add `POST /sessions` for one MP4 upload.
5. Validate size, MIME type, extension, and actual media with FFprobe.
6. Save duration, dimensions, frame rate, and codec.
7. Add authorized, expiration-checked source video streaming with HTTP range support.
8. Replace the default page with an accessible upload form.
9. Open `/sessions/:id` and play the stored video.

**Done when:** upload MP4 → database session created → source video plays.

## Phase 2 — Local faster-whisper transcription

**Goal:** turn the session video into word-level transcript JSON.

1. Create `services/transcription/` and a Python virtual environment.
2. Install `faster-whisper`.
3. Write one CLI script that accepts a media path and prints JSON to stdout.
4. Enable word timestamps and test it directly with a real salon video.
5. Have Express invoke the script with `spawn`; do not add a Python HTTP service.
6. Persist job status and returned words in `CaptionSession`.
7. Delete extracted audio after transcription finishes or fails.

**Done when:** upload MP4 → local transcription → API returns timed words.

## Phase 3 — Caption grouping

**Goal:** create predictable, readable caption blocks.

1. Omit obvious displayed filler words without altering audio.
2. Break at a pause near 0.4 seconds or after four words.
3. Assign stable word and group IDs.
4. Leave one small runnable grouping check.

**Done when:** timed words become deterministic 3–5-word blocks.

## Phase 4 — Basic editor

**Goal:** correct transcription and preview captions live.

1. Show the video with a browser caption overlay.
2. Highlight the active word from playback time.
3. List caption blocks; clicking one seeks to it.
4. Support text correction, split, and merge.
5. Autosave through `PATCH /sessions/:id` and restore after refresh.

**Done when:** caption mistakes can be corrected and previewed without rendering.

## Phase 5 — Timing editor

**Goal:** fix caption alignment visually.

1. Add a basic horizontal timeline.
2. Drag whole caption blocks and resize their edges.
3. Keep times within the video and prevent unintended overlap.
4. Shift underlying word timing consistently.
5. Add play, pause, and seek keyboard controls.

**Done when:** the user can align caption blocks to speech.

## Phase 6 — Styling and emphasis

**Goal:** create reusable CapCut-like presentation.

1. Add font, weight, size, colors, outline, and shadow.
2. Add top/middle/bottom placement and vertical adjustment.
3. Keep captions horizontally centered in V1.
4. Add manual large emphasis for selected words or phrases.
5. Drive preview and export from the same state and style model.

**Done when:** ordinary captions, active words, and large emphasis preview correctly.

## Phase 7 — ASS and FFmpeg export

**Goal:** render a downloadable captioned MP4.

1. Convert saved caption state into safely escaped ASS.
2. Generate active-word and large-emphasis events.
3. Render with the project-local FFmpeg binary.
4. Preserve dimensions and frame rate with high visual quality.
5. Track render status and expose the output for review/download.
6. Allow editing and rendering again while the session is active.

**Done when:** the exported MP4 closely matches the browser preview.

## Phase 8 — Expiration and cleanup

**Goal:** enforce temporary projects.

1. Deny access after one hour of meaningful inactivity.
2. Do not refresh activity from passive polling.
3. Run one idempotent cleanup at API startup and every 15 minutes.
4. Remove expired session files and database rows.
5. Never delete files during an active transcription or render.

**Done when:** projects expire while persistent account data can remain.

## Phase 9 — Optional accounts and presets

**Goal:** remember styles without retaining videos.

1. Add authentication after the guest workflow is complete.
2. Add persistent caption presets owned by users.
3. Keep the full caption workflow available to guests.
4. Enforce user ownership and guest access-token checks.

**Done when:** a signed-in user can reuse a style on a new temporary video.

## Explicitly deferred

Redis, BullMQ, microservices, a Python HTTP API, cloud media storage, billing, permanent project history, and individual word-boundary dragging stay out until a measured need appears.
