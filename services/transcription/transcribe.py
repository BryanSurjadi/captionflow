import argparse
import json
from pathlib import Path

from faster_whisper import WhisperModel


def main() -> None:
    parser = argparse.ArgumentParser(description="Transcribe media into word timestamps.")
    parser.add_argument("media", type=Path)
    parser.add_argument("--model", default="turbo")
    args = parser.parse_args()

    media = args.media.resolve()
    if not media.is_file():
        parser.error(f"media file does not exist: {media}")

    model = WhisperModel(args.model, device="cpu", compute_type="int8")
    segments, info = model.transcribe(
        str(media),
        language="id",
        word_timestamps=True,
        vad_filter=True,
    )

    words = [
        {
            "text": word.word.strip(),
            "start": round(word.start, 3),
            "end": round(word.end, 3),
            "probability": round(word.probability, 4),
            "segmentId": segment.id,
        }
        for segment in segments
        for word in (segment.words or [])
    ]

    print(
        json.dumps(
            {
                "language": info.language,
                "languageProbability": round(info.language_probability, 4),
                "durationSeconds": round(info.duration, 3),
                "text": " ".join(word["text"] for word in words),
                "words": words,
            },
            ensure_ascii=False,
        )
    )


if __name__ == "__main__":
    main()
