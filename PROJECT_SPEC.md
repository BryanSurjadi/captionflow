# Local-First Auto-Caption Generator — Project Specification

## 1. Purpose and scope

Build a local-first web application for adding burned-in captions to finished, short salon videos. The primary use case is a roughly 30-second vertical MP4 prepared for Reels or TikTok. A user uploads one video, gets an Indonesian-first transcript with word timing, corrects captions and timing, styles them, previews changes immediately, and exports a captioned MP4. The core workflow runs locally without a paid AI API or cloud media storage. The design should remain practical to deploy later as a portfolio showcase.

The main product promise is **accurate, editable synchronization** with reusable styling. Do not build a general video editor: the source video is already assembled, and any thumbnail or opening design can be handled outside this tool.

## 2. Decisions to preserve

| Area | V1 decision |
| --- | --- |
| Input | One finished MP4, primarily vertical 9:16, usually about 30 seconds. Preserve other valid dimensions and frame rates. |
| Languages | Primarily Indonesian speech with occasional simple English terms such as “hair extension” and “natural.” |
| Transcription | Local Python `faster-whisper`, with word-level timestamps; no paid transcription API. |
| Caption display | Approximately 3–5 visible words per block; use a default maximum of four words and split at natural pauses around 0.4 seconds. The user can split or merge blocks. |
| Active word | Automatically highlight the word being spoken; normal captions need no mandatory bounce or pop animation. |
| Large emphasis | Separately, the user can manually select a word or phrase and show it as dramatically larger text for that moment, replacing the normal block while active. |
| Editing | Correct text, split/merge caption blocks, adjust block timing on a draggable timeline, and see synchronized playback. Individual word-boundary dragging is outside V1. |
| Styling | Font, size/weight, text and active-word colors, outline/shadow, top/middle/bottom placement with fine vertical adjustment, and reusable presets. Keep text horizontally centered in V1. |
| Preview | Browser video with an immediate HTML/CSS caption overlay; style changes do not trigger an FFmpeg render or page refresh. |
| Export | Generate ASS subtitles and burn them into an MP4 with FFmpeg. Preserve input dimensions, aspect ratio, and frame rate; use high-quality encoding. Burn-in requires re-encoding, so mathematically lossless output is not promised. |
| Persistence | Uploaded videos, transcripts, edits, and renders belong to a temporary session. No permanent project history in V1. Accounts and saved presets/preferences persist. |
| Access | Guest users can perform the full caption workflow. Sign-in is optional and enables saving and reusing styles/preferences. |
| Expiration | A session expires after **one hour of inactivity**, including after export/download. Export does not end editing. |
| Stack | Next.js + TypeScript frontend; Express + TypeScript REST backend; PostgreSQL + Prisma; local filesystem for media; Python `faster-whisper`; FFmpeg with ASS/libass. |

When earlier exploratory suggestions conflict with this table, use the later decisions here. In particular, do not delete a project at the moment of export or keep metadata-only “recent sessions” after its video is gone.

## 3. User journey

1. **Home/upload:** Offer a prominent MP4 upload. Explain that an account is not required, media is temporary, and saved presets require sign-in. Accept a single source video and report unsupported/corrupt input clearly.
2. **Processing:** Create a temporary session, inspect the source with FFprobe, extract speech audio using FFmpeg, and transcribe locally with word timestamps. Show processing status without holding one HTTP request open for the entire job. Remove extracted audio when transcription is finished.
3. **Caption editor:** Start with grouped captions and a playable video. Display a caption timeline, preferably with a waveform if it is straightforward to generate. Clicking a block seeks the video to it. Playback highlights the active word. Provide play/pause and seeking controls, including Space and arrow-key shortcuts when focus is not inside an input.
4. **Corrections:** Let the user edit text, remove unwanted filler words from displayed captions, split/merge blocks, and drag a block or its edges to fix alignment. Autosave changes during the active session. The source audio is never changed when filler words are omitted from captions.
5. **Styling:** Provide built-in starting styles and live controls for font, weight/size, colors, outline/shadow, and vertical placement. A signed-in user can save, rename, apply, and delete personal presets. Presets store reusable appearance and grouping defaults, not video-specific words or timings. There is no automatic import of CapCut project files; users can recreate a familiar style with the controls and save it.
6. **Large emphasis:** Let the user select one or more words and choose **Make Emphasis**. During the selected time, show a much larger phrase, typically centered, instead of the normal caption. Let the user remove or edit the emphasis. Keep this separate from automatic active-word highlighting.
7. **Export/review/download:** Generate ASS from the current editor state and render an MP4. Show progress/status and a result preview or download link. The user can return to the editor, fix a typo or position, render again, and download again while the session remains active.
8. **Expiration:** After one hour without meaningful activity, access to the session is denied. The source, output, and session data are cleaned up; account and presets remain.

## 4. Editing and timing behavior

- Keep the **word-timestamped transcript and caption groups** as the source of truth. ASS is generated only for export; SRT is not the internal editing format.
- Each word has text, start/end time, and a stable identifier. Each group references an ordered span of words and has display start/end times. A group can contain fewer than three words at a pause or video boundary; the 3–5-word target is a layout guideline, not a hard validator.
- Initial grouping is deterministic: break on a pause of about 0.4 seconds or after four words, whichever comes first. Make the defaults easy to tune after testing real salon footage. Do not introduce an LLM grouping step.
- Timeline editing is at the **caption-block level** in V1. Dragging the block moves its word timings by the same offset; resizing its start/end should adjust its words consistently so highlighting still follows the edited block. Keep all intervals valid (`0 <= start < end <= video duration`) and prevent unintended overlap with neighboring blocks. Where alignment remains wrong inside a block, the user can split it and adjust smaller blocks.
- Manual text edits should not silently throw away timing or regroup the whole transcript. Adding or deleting words in a corrected block may require explicit timing distribution within that block; keep the result visible and editable. Never pretend that a manually inserted word has an accurately inferred speech boundary.
- Filler words such as “umm/eee/anu” should be omitted from displayed captions when detected, with an easy way to restore or edit if the detection is wrong. Audio stays intact.
- Active-word highlighting uses the current playback time and saved word intervals. When no word is active, display the group with its base style. Handle pauses and group transitions without flashing unrelated words.
- An emphasis item stores its own selected word IDs, start/end, display text, and emphasis style. It replaces the regular caption only over that interval. Avoid overlapping emphasis items in V1 or require the editor to resolve the conflict explicitly.
- Autosave after text, timing, grouping, emphasis, and style changes. Show whether changes are saved. Keep the editor recoverable if the tab closes while the session remains unexpired.

## 5. Style and preview

The editor overlays captions on the HTML video at the correct time. Changes to font, color, size, outline/shadow, and placement should appear immediately without a server round trip for rendering. Top, middle, and bottom provide quick positions; a vertical slider fine-tunes placement. Constrain captions to a safe area suitable for short-form platforms.

Use one shared caption-state and style model to drive both browser preview and ASS generation. The two renderers will differ technically, so compare preview and exported frames for representative styles, active words, and emphasis. Expose only fonts available to both the browser and libass renderer, and resolve actual font files on the server. Escape user text for ASS so punctuation and subtitle control characters cannot change the generated script.

Export should keep the input width, height, aspect ratio, and frame rate. Choose a high-quality video encoding preset and copy the original audio when compatible, otherwise encode audio appropriately. Burned-in captions alter pixels, so the video must be encoded again. The requirement is **no visually noticeable degradation under normal viewing**, not a zero-loss guarantee. Do not silently downscale to 720p or 1080p.

## 6. Architecture and data flow

```text
Next.js editor (TypeScript)
    | REST + media/status requests
Express API (TypeScript)
    |-- Prisma --> PostgreSQL: users, presets, temporary session metadata/edits
    |-- local filesystem: per-session source and rendered output
    |-- FFmpeg/FFprobe: inspect, extract audio, generate preview assets, render
    `-- Python faster-whisper process: transcribe to word timestamps
```

Keep a conventional, readable backend: routes/controllers handle HTTP, services handle session and media rules, Prisma handles persistence, and small process adapters invoke Python/FFmpeg. Long-running transcription and rendering need an asynchronous job/status flow, but V1 does not need Redis, BullMQ, microservices, or a general workflow engine. A single local API process can run a bounded number of jobs and return a job/session ID for polling. State changes and errors must survive a browser refresh; if the API restarts during a job, mark or recover the interrupted state rather than leaving a session permanently “processing.”

Suggested repository shape, to be adjusted to the existing code if implementation starts in an established repository:

```text
apps/web/                 Next.js UI
apps/api/                 Express API, Prisma schema/migrations
services/transcription/   Small Python faster-whisper entry point
storage/sessions/         Ignored per-session temporary media directories
```

Avoid speculative layers such as engines, ports, orchestrators, factories, and providers with only one implementation.

### Processing flow

```text
Upload MP4
 -> validate/probe media and create session directory/DB row
 -> extract temporary audio
 -> faster-whisper with word_timestamps
 -> normalize words and omit obvious displayed fillers
 -> deterministic caption grouping
 -> editor/autosave
 -> caption state -> ASS generation -> FFmpeg burn-in
 -> output review/download -> continued editing if desired
 -> expiration/cleanup
```

The Python process returns structured word data to Express; it does not own user/session persistence. The backend must not invoke a shell with untrusted filenames or subtitle text interpolated into command strings. Pass arguments directly and keep generated paths inside the session directory.

## 7. Minimal persistent model

Use PostgreSQL via Prisma. The exact schema can evolve, but preserve these concepts:

| Model | Key fields | Lifetime |
| --- | --- | --- |
| `User` | `id`, unique `email`, password hash or equivalent authentication credential, timestamps | Persistent |
| `CaptionPreset` | `id`, `userId`, name, style JSON, grouping defaults, timestamps | Persistent, owned by one user |
| `CaptionSession` | `id`, nullable `userId`, guest access secret/hash where applicable, status, input metadata, transcript/caption state JSON, current style, `createdAt`, `lastActivityAt`, error details | Temporary |

Word and group state can live in a versioned JSON field in `CaptionSession` for V1; relational rows for every word are unnecessary unless actual queries demand them. Media paths should be derived from the server-controlled session ID or stored as internal relative paths, never accepted as arbitrary client paths. Use a random, unguessable guest session token and require it for all guest reads, edits, media streams, renders, and downloads. An authenticated session must belong to its user. Database records alone are insufficient access control; every route must check ownership/token **and** expiration.

Example editing shape (illustrative, not a required Prisma schema):

```json
{
  "version": 1,
  "words": [
    { "id": "w1", "text": "rambut", "start": 1.24, "end": 1.61 },
    { "id": "w2", "text": "kamu", "start": 1.62, "end": 1.92 }
  ],
  "groups": [
    { "id": "g1", "wordIds": ["w1", "w2"], "start": 1.24, "end": 1.92 }
  ],
  "emphasis": [],
  "style": { "fontFamily": "Poppins", "fontSize": 62, "textColor": "#FFFFFF", "activeColor": "#FFD400", "position": "bottom", "verticalPercent": 72 }
}
```

## 8. Temporary session lifecycle

| Data | Rule |
| --- | --- |
| Account, personal presets/preferences | Persist until the user deletes them. |
| Uploaded source | Keep while the session is active; remove at expiry. |
| Extracted audio | Remove as soon as transcription succeeds or fails. |
| Transcript, groups, timing, styles, emphasis | Autosave for the active session; remove at expiry. |
| Rendered MP4 | Keep available for review/download and re-render while active; remove at expiry. Old outputs can be replaced after a successful new render. |
| Project history | None in V1. Expired sessions cannot be reopened. |

**Activity** means a meaningful, authenticated interaction such as editing, explicitly opening the session, starting a render, reviewing, or downloading. Do not keep an abandoned session alive merely because the browser has a passive polling loop open. Update `lastActivityAt` atomically enough that cleanup cannot delete a session being actively edited or rendered. A running render counts as active work; do not delete its files mid-job. On every session access, reject it if `now - lastActivityAt >= 60 minutes`, even if physical files have not yet been removed.

Physical cleanup runs at API startup and on a lightweight 15-minute timer in the single-process local deployment; optionally invoke the same cleanup on a new session/upload. One idempotent cleanup operation removes expired session directories and DB rows, tolerates already-missing files, and logs failures for retry. This gives exact **logical** expiration and approximate physical deletion (normally within 15 minutes while the API is running). If the API is stopped, files remain on disk until startup cleanup. Do not claim an exactly timed deletion while the machine/server is off. A multi-instance deployment would need one coordinated scheduled worker; that is future deployment work, not a V1 dependency.

## 9. API contract to implement

These routes are a suggested minimal contract; names may change, but the capabilities and access checks should remain.

| Endpoint | Purpose |
| --- | --- |
| `POST /sessions` | Upload one video; create a temporary session and start transcription. |
| `GET /sessions/:id` | Get metadata, job status, current editor state, and expiry information. |
| `GET /sessions/:id/source` | Authorized, expiration-checked video streaming for preview. |
| `PATCH /sessions/:id` | Validate and autosave caption/style changes. |
| `POST /sessions/:id/renders` | Start rendering the current saved revision. |
| `GET /sessions/:id/output` | Authorized, expiration-checked review/download of the latest completed output. |
| `GET /presets`, `POST /presets`, `PATCH /presets/:id`, `DELETE /presets/:id` | Manage signed-in user's personal presets. |
| Auth routes | Sign up/sign in/sign out only as needed for optional account access. |

Return clear statuses such as `UPLOADING`, `TRANSCRIBING`, `READY`, `RENDERING`, `FAILED`, and `EXPIRED`. Avoid stale render downloads: tie each render to a saved editor-state revision, and indicate when the current edits are newer than the latest output. Protect the server from oversized uploads and unsupported codecs; report transcription/render failures with retry paths that keep the session where possible.

## 10. V1 acceptance criteria

1. A guest can upload a valid ~30-second vertical MP4, receive Indonesian/mixed-English captions with word timestamps, edit them, render, and download without creating an account or providing an AI API key.
2. Generated blocks are typically 3–5 words, break at pauses, and can be manually split or merged. Obvious filler words are omitted from displayed captions without altering audio.
3. While playing the video, the active spoken word highlights at its saved timestamp. A user can correct text and fix misalignment by dragging caption blocks and boundaries on the timeline.
4. Changing style or placement updates the browser preview immediately. A selected phrase can appear as large, manual emphasis text and replace the ordinary caption over its interval.
5. The exported MP4 has burned-in captions matching the saved content and styling closely, retains source dimensions/frame rate, and has no obvious visual degradation in normal viewing.
6. Export and download leave the project editable and renderable again until one hour after its last meaningful activity. Closing and reopening the tab within that period restores saved edits.
7. After expiration, all routes deny access and cleanup eventually removes temporary source, output, and session data. A signed-in user's account and saved presets remain available for the next video.
8. A signed-in user can save and reapply a caption style to a different video. Guest use remains fully functional except for persistent personal presets.

## 11. Explicitly outside V1

- Multi-clip editing, trimming/source-video composition, thumbnail design, B-roll, voice generation, script generation, AI video generation, and audio changes.
- Permanent video/project history, cloud media storage, quotas, billing, collaboration, and sharing.
- Individual word-boundary dragging, arbitrary X/Y canvas placement, complex animation templates, automatic large-emphasis selection, and direct CapCut project import.
- Redis/queue infrastructure, microservices, and a dedicated scheduler for the single-process local version.

## 12. Implementation order

1. Establish Next.js, Express, Prisma/PostgreSQL, local storage, FFmpeg/FFprobe, and the small Python transcription entry point.
2. Complete upload, probe, transcription, normalized word JSON, basic grouping, and status polling.
3. Build the video editor: synchronized preview, correction, block timeline editing, grouping, autosave, and clear error states.
4. Add styling, automatic active-word highlighting, and manual large emphasis using one shared state model.
5. Generate ASS, render with FFmpeg, compare export against preview, and support re-render/download.
6. Add optional account flow and persistent presets, then expiration checks and physical cleanup.

Use real salon sample clips to judge Indonesian/English transcription and timing. Tune the `faster-whisper` model/compute settings to the available CPU or GPU after measuring accuracy and processing time; do not assume a large CUDA model is practical on every machine.
