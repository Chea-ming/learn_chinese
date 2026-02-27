#!/usr/bin/env python3
"""
Pre-generate Edge-TTS audio for all learn_chinese sentences.

Saves MP3s to:  public/audio/{catId}/{topicId}/{sentenceIndex}.mp3

Setup:
    pip install edge-tts

Usage:
    python scripts/generate_audio.py                   # generate all missing
    python scripts/generate_audio.py --cat daily-life  # one category only
    python scripts/generate_audio.py --force           # overwrite existing
    python scripts/generate_audio.py --retry-errors    # re-run only failures
    python scripts/generate_audio.py --concurrency 15  # parallel workers (default 10)
"""

import asyncio
import argparse
import json
import sys
from dataclasses import dataclass, field
from pathlib import Path

try:
    import edge_tts
except ImportError:
    print("edge-tts not found. Install it with:  pip install edge-tts")
    sys.exit(1)

# ── Config ──────────────────────────────────────────────────────────────────
VOICES = [
    "zh-CN-XiaoxiaoNeural",  # female, warm
    "zh-CN-YunxiNeural",     # male, youthful
    "zh-CN-YunyangNeural",   # male, neutral
    "zh-CN-XiaoyiNeural",    # female, youthful
    "zh-CN-XiaoxuanNeural",  # female, professional
]
FALLBACK_VOICES = [
    "zh-CN-XiaoxiaoNeural",
    "zh-CN-YunxiNeural",
    "zh-CN-YunyangNeural",
]
MAX_RETRIES  = 2    # per-voice attempts before moving to next fallback
RETRY_DELAY  = 1.5  # base wait between retries (doubled each attempt)
ERRORS_FILE  = Path("scripts/.audio_errors.json")

PROJECT_ROOT = Path(__file__).resolve().parent.parent
DATA_DIR     = PROJECT_ROOT / "public" / "data"
AUDIO_DIR    = PROJECT_ROOT / "public" / "audio"


# ── Task descriptor ──────────────────────────────────────────────────────────
@dataclass
class AudioTask:
    key:      str          # e.g. "daily-life/greetings/0"
    text:     str
    voice:    str
    out_file: Path


# ── Counters (mutated under asyncio.Lock) ────────────────────────────────────
@dataclass
class Stats:
    total:     int = 0
    generated: int = 0
    skipped:   int = 0
    missing:   int = 0
    failed:    list = field(default_factory=list)


# ── Synthesis ────────────────────────────────────────────────────────────────
async def synthesize(text: str, voice: str, out_path: Path) -> None:
    """Single synthesis attempt — raises on failure or empty result."""
    communicate = edge_tts.Communicate(text, voice)
    await communicate.save(str(out_path))
    if not out_path.exists() or out_path.stat().st_size < 100:
        out_path.unlink(missing_ok=True)
        raise RuntimeError("Empty or missing audio file")


async def synthesize_with_retries(text: str, voice: str, out_path: Path) -> str | None:
    """Try assigned voice, then fallbacks. Returns winning voice or None."""
    voices_to_try = [voice] + [v for v in FALLBACK_VOICES if v != voice]
    for attempt_voice in voices_to_try:
        delay = RETRY_DELAY
        for attempt in range(1, MAX_RETRIES + 1):
            try:
                await synthesize(text, attempt_voice, out_path)
                return attempt_voice
            except Exception as e:
                out_path.unlink(missing_ok=True)
                short = f"{attempt_voice.split('-')[2][:12]} [{attempt}/{MAX_RETRIES}]"
                print(f"    ⚠  {short}: {e}")
                if attempt < MAX_RETRIES:
                    await asyncio.sleep(delay)
                    delay *= 2
    return None


# ── Worker (one per task, gated by semaphore) ────────────────────────────────
async def process_task(task: AudioTask, sem: asyncio.Semaphore, stats: Stats, lock: asyncio.Lock) -> None:
    async with sem:
        voice_short = task.voice.split("-")[2][:10]
        print(f"  {task.key:50s} [{voice_short}]  {task.text[:36]}")

        used_voice = await synthesize_with_retries(task.text, task.voice, task.out_file)

        async with lock:
            if used_voice:
                stats.generated += 1
                if used_voice != task.voice:
                    print(f"    ✓ fell back to {used_voice.split('-')[2]}")
            else:
                print(f"    ✗ FAILED: {task.key}")
                stats.failed.append({"key": task.key, "text": task.text, "voice": task.voice})


# ── Build task list ──────────────────────────────────────────────────────────
def build_tasks(index: dict, only_cat: str | None, force: bool,
                retry_errors: bool, error_keys: set[str], stats: Stats) -> list[AudioTask]:
    tasks: list[AudioTask] = []

    for category in index["categories"]:
        cat_id = category["id"]
        if only_cat and cat_id != only_cat:
            continue

        for topic in category["topics"]:
            topic_id   = topic["id"]
            topic_file = DATA_DIR / cat_id / f"{topic_id}.json"

            if not topic_file.exists():
                stats.missing += 1
                continue

            with open(topic_file, encoding="utf-8") as f:
                data = json.load(f)

            sentences = data.get("sentences", [])
            out_dir   = AUDIO_DIR / cat_id / topic_id
            out_dir.mkdir(parents=True, exist_ok=True)

            for i, sentence in enumerate(sentences):
                text = sentence.get("chinese", "").strip()
                if not text:
                    continue

                key      = f"{cat_id}/{topic_id}/{i}"
                out_file = out_dir / f"{i}.mp3"
                stats.total += 1

                already_done = out_file.exists() and out_file.stat().st_size >= 100
                if already_done:
                    if not force and not (retry_errors and key in error_keys):
                        stats.skipped += 1
                        continue
                    if retry_errors and key not in error_keys:
                        stats.skipped += 1
                        continue

                tasks.append(AudioTask(
                    key=key,
                    text=text,
                    voice=VOICES[i % len(VOICES)],
                    out_file=out_file,
                ))

    return tasks


# ── Main ─────────────────────────────────────────────────────────────────────
async def main(only_cat: str | None, force: bool, retry_errors: bool, concurrency: int) -> None:
    index_path = DATA_DIR / "index.json"
    if not index_path.exists():
        print(f"ERROR: {index_path} not found")
        sys.exit(1)

    with open(index_path, encoding="utf-8") as f:
        index = json.load(f)

    error_keys: set[str] = set()
    if retry_errors and ERRORS_FILE.exists():
        with open(ERRORS_FILE) as f:
            error_keys = {e["key"] for e in json.load(f)}
        print(f"Retrying {len(error_keys)} previously failed items.\n")

    stats = Stats()
    tasks = build_tasks(index, only_cat, force, retry_errors, error_keys, stats)

    print(f"▶  {len(tasks)} to generate   ({stats.skipped} already done)   concurrency={concurrency}\n")

    sem  = asyncio.Semaphore(concurrency)
    lock = asyncio.Lock()

    await asyncio.gather(
        *(process_task(t, sem, stats, lock) for t in tasks),
        return_exceptions=True,
    )

    # Persist error log
    ERRORS_FILE.parent.mkdir(exist_ok=True)
    with open(ERRORS_FILE, "w") as f:
        json.dump(stats.failed, f, ensure_ascii=False, indent=2)

    ok = "✓" if not stats.failed else "✗"
    print(
        f"\n{'─'*64}\n"
        f"  {ok} Generated : {stats.generated}\n"
        f"     Skipped   : {stats.skipped}  (already exist)\n"
        f"     Missing   : {stats.missing}  (no JSON file yet)\n"
        f"     Failed    : {len(stats.failed)}\n"
        f"     Total     : {stats.total}\n"
    )
    if stats.failed:
        print(f"  Failures saved → {ERRORS_FILE}")
        print("  Re-run with --retry-errors to attempt them again.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Pre-generate Edge-TTS audio (parallel)")
    parser.add_argument("--cat",          metavar="CAT_ID", help="Only process this category")
    parser.add_argument("--force",        action="store_true", help="Overwrite existing files")
    parser.add_argument("--retry-errors", action="store_true", help="Re-process previous failures only")
    parser.add_argument("--concurrency",  type=int, default=10, metavar="N",
                        help="Max parallel requests (default 10)")
    args = parser.parse_args()

    asyncio.run(main(
        only_cat=args.cat,
        force=args.force,
        retry_errors=args.retry_errors,
        concurrency=args.concurrency,
    ))
