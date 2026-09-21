# CaptionFlow Frontend Direction

## Product flow

The landing page has one job: receive a video. Upload progress remains inside the upload card. As soon as the API creates the temporary session, navigate to `/sessions/:id`; do not wait for transcription. The session page shows the video immediately and progressively adds transcription and editing controls.

```text
Landing → upload progress → /sessions/:id → video preview → transcription → editor → export
```

A dedicated session page is preferred over morphing the landing page because it provides room for the timeline and inspector, supports refresh recovery, and gives Back/New video predictable behavior.

## Visual direction

- Bright, quiet canvas with one strong blue action color.
- Heavy, direct headlines; short supporting copy.
- White upload card with generous space and a soft shadow.
- Yellow word highlighting is the product signature and demonstrates synchronized captions in the hero itself.
- Examples use generic caption copy rather than content from one business or niche.
- Motion is limited to functional upload/loading feedback.

### Tokens

| Role | Value |
| --- | --- |
| Canvas | `#f7f9fc` |
| Surface | `#ffffff` |
| Ink | `#151922` |
| Muted ink | `#667085` |
| Primary blue | `#176bff` |
| Active-word yellow | `#ffd84d` |
| Display/body | Geist, system fallback |
| Utility data | Geist Mono, monospace fallback |

## Landing page

Desktop uses a simple two-column hero: bold promise and benefits on the left, upload/drop card on the right. Below it are three compact visual examples—clean captions, active-word highlighting, and large emphasis—followed by the real three-step workflow. Mobile stacks the copy, upload card, and examples.

## Session page

The session page uses a quiet application layout: header, video stage, and right-side details/controls panel. The preview follows the source video's aspect ratio, so portrait and landscape uploads keep their true frame without artificial black side panels. The video is visible immediately after upload. Caption tools will occupy the right panel and a timeline will be added beneath the workspace when transcription is implemented.

## Copy principles

Use plain action labels: **Upload video**, **New video**, **Generate captions**, **Export video**. Errors name the problem and the corrective action. Do not expose worker, FFmpeg, session-token, or storage implementation details in the user interface.
