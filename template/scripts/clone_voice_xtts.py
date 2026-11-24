"""
Clonador de Voz Local (XTTS-v2 / coqui-tts) para a Mini Produtora Stech Solucoes.
Usa a amostra limpa da sua voz (`alessandro_clone_sample_15s.wav`) para gerar
novas falas em Portugues Brasileiro (pt-BR) 100% offline no PC, com tratamento
de estudio FFmpeg (-14 LUFS, EQ quente, zero clipping).

Uso:
  voice-clone-env\\Scripts\\python.exe template/scripts/clone_voice_xtts.py \
      --text "Olha só... sua empresa ainda tá na planilha? Chama a Stech pra ver na prática." \
      --out template/renders/stech-automacao/previews/teste_clone_alessandro_10s.wav
"""
import argparse
import json
import os
import re
import subprocess
from pathlib import Path

os.environ.setdefault("COQUI_TOS_AGREED", "1")

WORKSPACE_ROOT = Path(__file__).resolve().parent.parent.parent
DEFAULT_REF = WORKSPACE_ROOT / "banco-de-referencias" / "audio" / "vozes" / "alessandro_clone_sample_15s.wav"
DEFAULT_OUT = WORKSPACE_ROOT / "template" / "renders" / "stech-automacao" / "previews" / "teste_clone_alessandro_10s.wav"


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--text",
        default="Olha só... sua empresa ainda tá na planilha? Com a Stech, tudo conversa sozinho no painel. Chama a gente pra ver na prática.",
    )
    parser.add_argument("--ref", default=str(DEFAULT_REF))
    parser.add_argument("--out", default=str(DEFAULT_OUT))
    parser.add_argument("--speed", type=float, default=1.02)
    args = parser.parse_args()

    out_path = Path(args.out)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    raw_wav = out_path.parent / f"_raw_{out_path.stem}.wav"

    import soundfile as sf
    import torch
    import torchaudio

    # Bypass torchcodec on Windows by routing torchaudio.load through soundfile
    def _sf_load(filepath, *a, **kw):
        data, sr = sf.read(str(filepath), dtype="float32", always_2d=True)
        return torch.from_numpy(data.T.copy()), sr

    torchaudio.load = _sf_load

    # Compatibilidade transformers 4.49+ / 4.51 com coqui-tts: converte tuple -> DynamicCache se necessario
    from TTS.tts.layers.xtts import gpt_inference
    from transformers.cache_utils import DynamicCache

    _orig_fwd = gpt_inference.GPT2InferenceModel.forward

    def _compat_fwd(self, input_ids=None, past_key_values=None, **kwargs):
        if isinstance(past_key_values, tuple):
            past_key_values = DynamicCache.from_legacy_cache(past_key_values)
        return _orig_fwd(self, input_ids=input_ids, past_key_values=past_key_values, **kwargs)

    gpt_inference.GPT2InferenceModel.forward = _compat_fwd

    from TTS.api import TTS

    print("[1/3] Carregando modelo XTTS-v2 (CPU)...")
    tts = TTS("tts_models/multilingual/multi-dataset/xtts_v2").to("cpu")

    print(f"[2/3] Clonando voz a partir de {Path(args.ref).name}...")
    tts.tts_to_file(
        text=args.text,
        speaker_wav=str(args.ref),
        language="pt",
        file_path=str(raw_wav),
        speed=args.speed,
        split_sentences=True,
    )

    print("[3/3] Aplicando acabamento de estudio (-14 LUFS + EQ quente)...")
    pre_wav = out_path.parent / f"_pre_{out_path.stem}.wav"
    af_clean = "highpass=f=75,equalizer=f=220:t=q:w=1.2:g=2.0,acompressor=threshold=-18dB:ratio=2.2:attack=10:release=110"
    subprocess.run(
        ["ffmpeg", "-y", "-v", "error", "-i", str(raw_wav), "-af", af_clean, "-ar", "44100", "-ac", "2", "-c:a", "pcm_s16le", str(pre_wav)],
        check=True,
    )

    p1 = subprocess.run(
        ["ffmpeg", "-y", "-i", str(pre_wav), "-af", "loudnorm=I=-14:TP=-1.6:LRA=9:print_format=json", "-f", "null", "-"],
        capture_output=True,
        text=True,
        check=True,
    )
    st = json.loads(re.search(r"\{[\s\S]*?\}", p1.stderr).group(0))
    af2 = (
        f"loudnorm=I=-14:TP=-1.6:LRA=9:linear=true:"
        f"measured_I={st['input_i']}:measured_TP={st['input_tp']}:"
        f"measured_LRA={st['input_lra']}:measured_thresh={st['input_thresh']}:"
        f"offset={st['target_offset']},alimiter=limit=-1.6dB:attack=5:release=60:level=false"
    )
    subprocess.run(
        ["ffmpeg", "-y", "-v", "error", "-i", str(pre_wav), "-af", af2, "-ar", "44100", "-ac", "2", "-c:a", "pcm_s16le", str(out_path)],
        check=True,
    )
    raw_wav.unlink(missing_ok=True)
    pre_wav.unlink(missing_ok=True)
    print(f"[OK] Audio clonado salvo em: {out_path}")


if __name__ == "__main__":
    main()
