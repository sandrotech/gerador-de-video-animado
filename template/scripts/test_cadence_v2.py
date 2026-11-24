"""Gera previa curta (~10-12s) para validar cadencia natural estilo ref_DfVKHAJD3Gx."""
import asyncio
from pathlib import Path

from cadence_audio import SegmentSpec, add_sfx, make_chime, make_whoosh, synthesize_with_profile

OUT = Path("template/renders/stech-automacao/previews/teste_cadencia_v2_10s.wav")

SEGMENTS = [
    SegmentSpec("hook", "Olha só... seu negócio ainda tá na planilha?", role="hook", pause_after=0.68),
    SegmentSpec("dor1", "Aí o pedido se perde,", role="micro", pause_after=0.22),
    SegmentSpec("dor2", "e o estoque nunca bate...", role="body_steps", pause_after=0.58),
    SegmentSpec("sol", "Na Stech, tudo já conversa sozinho no painel.", role="climax_result", pause_after=0.55),
    SegmentSpec("cta", "Chama a gente pra ver na prática.", role="cta_close"),
]


def sfx(mix, starts, _words):
    add_sfx(mix, make_whoosh(), starts["sol"])
    add_sfx(mix, make_chime(dur=0.80, vol=0.09), starts["cta"])


if __name__ == "__main__":
    res = asyncio.run(synthesize_with_profile(SEGMENTS, OUT, tail_sec=0.45, sfx_callback=sfx))
    print(f"DURACAO_V2: {res['total_sec']:.2f}s | PALAVRAS: {len(res['words'])} | ARQUIVO: {OUT}")
