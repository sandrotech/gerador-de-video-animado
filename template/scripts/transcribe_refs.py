#!/usr/bin/env python3
"""Transcribe reference Instagram Reels in chunks using SpeechRecognition (pt-BR)."""
import subprocess
import io
import wave
from pathlib import Path
import speech_recognition as sr

RENDERS = Path(__file__).resolve().parent.parent / "renders"
VIDEOS = [
    ("Reel 1: Ar-Condicionado (DewJ1whAl3p - 310k likes)", RENDERS / "ref_instagram.mp4"),
    ("Reel 2: Telhado (DezX76zgi47 - 1.75M likes)", RENDERS / "ref_reel_2_DezX76zgi47.mp4"),
    ("Reel 3: Arranha-Céu (De4oWvEh06y - 886k likes)", RENDERS / "ref_reel_3_De4oWvEh06y.mp4"),
]


def get_duration(mp4_path: Path) -> float:
    out = subprocess.check_output(
        [
            "ffprobe",
            "-v",
            "error",
            "-show_entries",
            "format=duration",
            "-of",
            "default=noprint_wrappers=1:nokey=1",
            str(mp4_path),
        ],
        text=True,
    ).strip()
    return float(out)


def extract_wav_bytes(mp4_path: Path, start: float, duration: float) -> bytes:
    cmd = [
        "ffmpeg",
        "-v",
        "error",
        "-ss",
        str(start),
        "-t",
        str(duration),
        "-i",
        str(mp4_path),
        "-ac",
        "1",
        "-ar",
        "16000",
        "-f",
        "wav",
        "pipe:1",
    ]
    return subprocess.check_output(cmd)


def main():
    recognizer = sr.Recognizer()
    lines = ["# Transcrições dos 3 Reels Virais (@desmontandoomundo)\n"]

    for title, mp4 in VIDEOS:
        if not mp4.exists():
            continue
        dur = get_duration(mp4)
        print(f"Transcribing {mp4.name} ({dur:.1f}s)...")
        lines.append(f"## {title}\n- **Arquivo:** `{mp4.name}`\n- **Duração:** `{dur:.1f}s`\n")
        chunk_len = 25.0
        t = 0.0
        while t < dur:
            wav_bytes = extract_wav_bytes(mp4, t, chunk_len)
            with sr.AudioFile(io.BytesIO(wav_bytes)) as source:
                audio = recognizer.record(source)
            try:
                text = recognizer.recognize_google(audio, language="pt-BR")
            except Exception as e:
                text = f"[erro/silêncio: {e}]"
            end_t = min(dur, t + chunk_len)
            line = f"- **[{int(t):02d}s–{int(end_t):02d}s]:** {text}"
            print(" ", line)
            lines.append(line)
            t += chunk_len
        lines.append("\n")

    out_path = RENDERS / "ref_transcripts.md"
    out_path.write_text("\n".join(lines), encoding="utf-8")
    print(f"Saved transcripts to {out_path}")


if __name__ == "__main__":
    main()

