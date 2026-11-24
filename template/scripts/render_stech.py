"""
Pipeline Otimizado de Renderizacao + Organizacao Automatica de Pastas + QA
para os videos da Stech Solucoes (YouTube 16:9 e Instagram Reels 9:16).

Melhorias de velocidade implementadas:
1. Pre-bundle inteligente em template/.remotion-bundle/ (so recompila Webpack quando src/ ou public/ mudar).
2. Aceleracao GPU ANGLE (--gl=angle) + 8 workers (--concurrency=8).
3. Modo --fast (rascunho/previa direta H.264 sem passo ProRes) vs modo master (ProRes + filtros FFmpeg + encode unico libx264 CRF 17).
4. Organizacao automatica de saida em template/renders/<projeto>/{youtube-16x9, reels-9x16, previews, qa}/.
5. Validacao automatica via ffprobe (+ opcional --raea-check).
"""
import argparse
import json
import shutil
import subprocess
import time
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
RENDERS_ROOT = BASE_DIR / "renders"
BUNDLE_DIR = BASE_DIR / ".remotion-bundle"
REMOTION_CLI = BASE_DIR / "node_modules" / "@remotion" / "cli" / "remotion-cli.js"
REMOTION_FFMPEG = BASE_DIR / "node_modules" / "@remotion" / "compositor-win32-x64-msvc" / "ffmpeg.exe"
AUDIO_MASTER = BASE_DIR / "public" / "assets" / "stech-automacao" / "master_audio_sfx.wav"

PRESETS = {
    "youtube": {
        "comp": "StechAutomacao",
        "width": 1920,
        "height": 1080,
        "subfolder": "youtube-16x9",
        "default_out": "stech_automacao_16x9_v1.mp4",
    },
    "reels": {
        "comp": "StechAutomacaoVertical",
        "width": 1080,
        "height": 1920,
        "subfolder": "reels-9x16",
        "default_out": "stech_automacao_reels_9x16_v2.mp4",
        "audio": AUDIO_MASTER,
    },
    "reels-v3": {
        "comp": "StechAutomacaoReelsV3",
        "width": 1080,
        "height": 1920,
        "subfolder": "reels-9x16",
        "default_out": "stech_automacao_reels_9x16_v3.mp4",
        "audio": BASE_DIR / "public" / "assets" / "stech-automacao" / "master_audio_v3_sfx.wav",
    },
    "centerbox": {
        "comp": "CenterboxAntecipacao",
        "width": 1920,
        "height": 1080,
        "subfolder": "youtube-16x9",
        "default_out": "centerbox_antecipacao_16x9_v1.mp4",
        "project": "centerbox-antecipacao",
        "audio": BASE_DIR / "public" / "assets" / "centerbox-antecipacao" / "master_audio_sfx.wav",
    },
}


def latest_mtime(root: Path) -> float:
    newest = 0.0
    if not root.exists():
        return newest
    for p in root.rglob("*"):
        if p.is_file():
            mt = p.stat().st_mtime
            if mt > newest:
                newest = mt
    return newest


def ensure_bundle(force_rebundle: bool = False) -> Path:
    """Cria ou reaproveita o bundle compilado do Remotion para eliminar compilacao repetida."""
    marker = BUNDLE_DIR / "index.html"
    src_mtime = max(latest_mtime(BASE_DIR / "src"), latest_mtime(BASE_DIR / "public"))
    needs_build = force_rebundle or not marker.exists() or marker.stat().st_mtime < src_mtime

    if needs_build:
        print("[0/3] Atualizando pre-bundle Remotion (.remotion-bundle)...")
        t0 = time.time()
        if BUNDLE_DIR.exists():
            shutil.rmtree(BUNDLE_DIR, ignore_errors=True)
        subprocess.run(
            [
                "node",
                str(REMOTION_CLI),
                "bundle",
                "src/index.ts",
                f"--out-dir={BUNDLE_DIR}",
                "--log=error",
            ],
            cwd=str(BASE_DIR),
            check=True,
        )
        print(f"      Pre-bundle pronto em {time.time() - t0:.1f}s.")
    else:
        print("[0/3] Reaproveitando pre-bundle Remotion em cache (.remotion-bundle).")
    return BUNDLE_DIR


def run_qa(video_path: Path, expected_w: int, expected_h: int) -> dict:
    out = subprocess.check_output(
        [
            "ffprobe",
            "-v",
            "error",
            "-show_entries",
            "format=duration,size,bit_rate:stream=codec_type,codec_name,width,height,r_frame_rate,pix_fmt,sample_rate,channels",
            "-of",
            "json",
            str(video_path),
        ],
        text=True,
    )
    info = json.loads(out)
    v_stream = next(s for s in info["streams"] if s["codec_type"] == "video")
    a_stream = next(s for s in info["streams"] if s["codec_type"] == "audio")
    assert int(v_stream["width"]) == expected_w, f"Width {v_stream['width']} != {expected_w}"
    assert int(v_stream["height"]) == expected_h, f"Height {v_stream['height']} != {expected_h}"
    assert v_stream["codec_name"] == "h264", f"Unexpected video codec: {v_stream['codec_name']}"
    assert v_stream["pix_fmt"] == "yuv420p", f"Unexpected pix_fmt: {v_stream['pix_fmt']}"
    assert v_stream["r_frame_rate"] == "30/1", f"Unexpected FPS: {v_stream['r_frame_rate']}"
    assert a_stream["codec_name"] == "aac", f"Unexpected audio codec: {a_stream['codec_name']}"
    dur = float(info["format"]["duration"])
    size_mb = int(info["format"]["size"]) / (1024 * 1024)
    print(
        f"[QA OK] {video_path.relative_to(RENDERS_ROOT)}: {v_stream['width']}x{v_stream['height']} "
        f"{v_stream['r_frame_rate']} {v_stream['codec_name']} ({v_stream['pix_fmt']}), "
        f"audio {a_stream['codec_name']} {a_stream['sample_rate']}Hz, {dur:.2f}s, {size_mb:.2f} MB"
    )
    return info


def resolve_output_path(
    project: str, out_name: str, expected_w: int, expected_h: int, is_preview: bool
) -> Path:
    if is_preview:
        subfolder = "previews"
    elif expected_h > expected_w:
        subfolder = "reels-9x16"
    else:
        subfolder = "youtube-16x9"
    target_dir = RENDERS_ROOT / project / subfolder
    target_dir.mkdir(parents=True, exist_ok=True)
    return target_dir / Path(out_name).name


def render_pipeline(
    project: str,
    comp_id: str,
    out_name: str,
    expected_w: int,
    expected_h: int,
    frames: str | None = None,
    fast: bool = False,
    rebundle: bool = False,
    concurrency: int = 8,
    raea_check: bool = False,
    audio_path: Path = AUDIO_MASTER,
):
    t_total = time.time()
    bundle_path = ensure_bundle(force_rebundle=rebundle)
    is_preview = fast or (frames is not None)
    final_mp4 = resolve_output_path(project, out_name, expected_w, expected_h, is_preview)

    if fast:
        # Modo rapido de edicao/previa: encode H.264 direto pelo Remotion (sem passo ProRes)
        remotion_cmd = [
            "node",
            str(REMOTION_CLI),
            "render",
            str(bundle_path),
            comp_id,
            str(final_mp4),
            "--codec=h264",
            "--crf=22",
            "--pixel-format=yuv420p",
            "--gl=angle",
            f"--concurrency={concurrency}",
            "--log=error",
        ]
        if frames:
            remotion_cmd.append(f"--frames={frames}")
        print(f"[1/2] Render RAPIDO H.264 ({comp_id}, frames={frames or 'FULL'}) -> {final_mp4.relative_to(RENDERS_ROOT)}...")
        subprocess.run(remotion_cmd, cwd=str(BASE_DIR), check=True)
        print("[2/2] Validando integridade com ffprobe...")
        run_qa(final_mp4, expected_w, expected_h)
    else:
        # Modo MASTER publicacao: ProRes intra-frame -> filtros FFmpeg -> encode unico libx264 CRF 17
        master_mov = final_mp4.parent / f"_master_{comp_id}.mov"
        remotion_cmd = [
            "node",
            str(REMOTION_CLI),
            "render",
            str(bundle_path),
            comp_id,
            str(master_mov),
            "--codec=prores",
            "--prores-profile=standard",
            "--gl=angle",
            "--muted",
            f"--concurrency={concurrency}",
            "--log=error",
        ]
        if frames:
            remotion_cmd.append(f"--frames={frames}")

        print(f"[1/3] Renderizando master ProRes ({comp_id}, frames={frames or 'FULL'})...")
        t1 = time.time()
        subprocess.run(remotion_cmd, cwd=str(BASE_DIR), check=True)
        print(f"      Master ProRes concluido em {time.time() - t1:.1f}s.")

        print(f"[2/3] Aplicando acabamento visual e codificacao unica libx264 -> {final_mp4.relative_to(RENDERS_ROOT)}...")
        t2 = time.time()
        filter_cmd = [
            "ffmpeg",
            "-y",
            "-v",
            "error",
            "-i",
            str(master_mov),
            "-vf",
            "unsharp=5:5:0.38:5:5:0.0,vibrance=intensity=0.12,vignette=PI/12",
            "-c:v",
            "rawvideo",
            "-pix_fmt",
            "yuv420p",
            "-f",
            "matroska",
            "-",
        ]

        audio_trim_args = []
        if frames:
            a, b = map(int, frames.split("-"))
            dur_sec = (b - a + 1) / 30.0
            start_sec = a / 30.0
            audio_trim_args = ["-ss", f"{start_sec:.3f}", "-t", f"{dur_sec:.3f}"]

        encode_cmd = [
            str(REMOTION_FFMPEG),
            "-y",
            "-v",
            "error",
            "-f",
            "matroska",
            "-i",
            "-",
            *audio_trim_args,
            "-i",
            str(audio_path),
            "-map",
            "0:v:0",
            "-map",
            "1:a:0",
            "-c:v",
            "libx264",
            "-crf",
            "17",
            "-preset",
            "medium",
            "-pix_fmt",
            "yuv420p",
            "-c:a",
            "aac",
            "-b:a",
            "192k",
            "-ar",
            "44100",
            "-movflags",
            "+faststart",
            "-shortest",
            str(final_mp4),
        ]

        p1 = subprocess.Popen(filter_cmd, stdout=subprocess.PIPE)
        p2 = subprocess.Popen(encode_cmd, stdin=p1.stdout)
        p1.stdout.close()
        rc2 = p2.wait()
        rc1 = p1.wait()
        if rc1 != 0 or rc2 != 0:
            raise RuntimeError(f"FFmpeg pipeline falhou: filter={rc1}, encode={rc2}")

        master_mov.unlink(missing_ok=True)
        print(f"      Acabamento FFmpeg concluido em {time.time() - t2:.1f}s.")

        print("[3/3] Validando integridade com ffprobe...")
        run_qa(final_mp4, expected_w, expected_h)

    if raea_check and shutil.which("raea"):
        print("[QA EXTRA] Rodando raea check...")
        subprocess.run(["raea", "check", str(final_mp4)], check=False)

    print(f"[CONCLUIDO] Tempo total: {time.time() - t_total:.1f}s | Arquivo: {final_mp4}")


def main():
    parser = argparse.ArgumentParser(description="Render pipeline organizado Stech Solucoes")
    parser.add_argument("--preset", choices=list(PRESETS.keys()), default=None)
    parser.add_argument("--project", default="stech-automacao")
    parser.add_argument("--comp", default=None)
    parser.add_argument("--out", default=None)
    parser.add_argument("--width", type=int, default=None)
    parser.add_argument("--height", type=int, default=None)
    parser.add_argument("--frames", default=None)
    parser.add_argument("--fast", action="store_true", help="Rascunho rapido H.264 sem ProRes")
    parser.add_argument("--rebundle", action="store_true", help="Forca recriacao do .remotion-bundle")
    parser.add_argument("--concurrency", type=int, default=8)
    parser.add_argument("--audio", default=None, help="Caminho explicito para o WAV master")
    parser.add_argument("--raea-check", action="store_true", help="Roda auditoria raea check no MP4 final")
    args = parser.parse_args()

    p = PRESETS[args.preset] if args.preset else PRESETS["youtube"]
    comp = args.comp or p["comp"]
    width = args.width or p["width"]
    height = args.height or p["height"]
    out = args.out or p["default_out"]

    audio_path = Path(args.audio) if args.audio else p.get("audio", AUDIO_MASTER)

    render_pipeline(
        project=args.project,
        comp_id=comp,
        out_name=out,
        expected_w=width,
        expected_h=height,
        frames=args.frames,
        fast=args.fast,
        rebundle=args.rebundle,
        concurrency=args.concurrency,
        raea_check=args.raea_check,
        audio_path=audio_path,
    )


if __name__ == "__main__":
    main()
