"""
Gerador de Audio v3 — Reels Comercial Curto (45-55s) da Stech Solucoes.
Usa automaticamente o motor padrao `cadence_audio.py` calibrado com o perfil
`ref_DfVKHAJD3Gx` (pausas naturais, velocidade +15% e curva de entonacao em 4 degraus).
"""
import asyncio
import json
from pathlib import Path

from cadence_audio import (
    SegmentSpec,
    add_sfx,
    make_chime,
    make_kds_beep,
    make_whoosh,
    synthesize_with_profile,
)

TEMPLATE_DIR = Path(__file__).resolve().parent.parent
OUT_WAV = TEMPLATE_DIR / "public" / "assets" / "stech-automacao" / "master_audio_v3_sfx.wav"
WORDS_TS = TEMPLATE_DIR / "src" / "shots" / "G1" / "stechV3Words.ts"

SEGMENTS = [
    SegmentSpec("hook", "Seu restaurante ainda depende de papel?", role="hook"),
    SegmentSpec(
        "dor",
        "Pedidos anotados à mão, informações desencontradas e clientes esperando.",
        role="body_steps",
    ),
    SegmentSpec(
        "virada",
        "E se toda a operação funcionasse de forma integrada?",
        role="hook",
        pause_after=0.45,
    ),
    SegmentSpec(
        "recebimento",
        "No sistema sob medida da Stech, o atendente lança o pedido no terminal ou celular, e ele já cai organizado na fila central.",
        role="body_steps",
    ),
    SegmentSpec(
        "cozinha",
        "Na hora, o pedido aparece na tela da cozinha com observações, mudando de em preparo para pronto e avisando o salão.",
        role="climax_result",
        pause_after=0.36,
    ),
    SegmentSpec(
        "gestao",
        "E no painel de gestão, você acompanha vendas, estoque e caixa em um só lugar, com mais controle sobre cada pedido.",
        role="climax_result",
    ),
    SegmentSpec(
        "cta",
        "Sua empresa, seus processos, nossa tecnologia. Quer organizar a operação do seu negócio com mais eficiência? Fale com a Stech.",
        role="cta_close",
    ),
]


def find_word(ts_words: list[dict], substr: str, after_f: int = 0, fallback: int = 0) -> int:
    sl = substr.lower()
    for w in ts_words:
        if w["from"] >= after_f and sl in w["text"].lower():
            return int(w["from"])
    return fallback


async def main():
    holder = {}

    def apply_sfx(mix, seg_starts, ts_words):
        f_coz = seg_starts["cozinha"]
        f_em_preparo = find_word(ts_words, "preparo", f_coz, f_coz + 60)
        f_pronto = find_word(ts_words, "pronto", f_coz, f_coz + 90)
        holder["f_em_preparo"] = f_em_preparo
        holder["f_pronto"] = f_pronto
        holder["f_salao"] = find_word(ts_words, "salão", f_coz, f_pronto + 18)

        add_sfx(mix, make_whoosh(), seg_starts["virada"])
        add_sfx(mix, make_kds_beep(880.0, 1318.5), seg_starts["recebimento"] + 12)
        add_sfx(mix, make_kds_beep(1046.5, 1567.98), f_coz + 8)
        add_sfx(mix, make_kds_beep(1174.66, 1760.0), f_pronto)
        add_sfx(mix, make_whoosh(), seg_starts["gestao"])
        add_sfx(mix, make_chime(), seg_starts["cta"])

    res = await synthesize_with_profile(
        SEGMENTS,
        out_wav=OUT_WAV,
        tail_sec=3.2,
        sfx_callback=apply_sfx,
    )

    seg_starts = res["seg_starts"]
    cues = {
        "f_hook": 0,
        "f_dor": seg_starts["dor"],
        "f_virada": seg_starts["virada"],
        "f_recebimento": seg_starts["recebimento"],
        "f_cozinha": seg_starts["cozinha"],
        "f_em_preparo": holder["f_em_preparo"],
        "f_pronto": holder["f_pronto"],
        "f_salao": holder["f_salao"],
        "f_gestao": seg_starts["gestao"],
        "f_cta": seg_starts["cta"],
        "f_cta_card": res["speech_end_frame"] - 30,
        "total_frames": res["total_frames"],
    }

    ts_words = [{"text": w["text"], "from": w["from"], "to": w["to"]} for w in res["words"]]
    WORDS_TS.write_text(
        "\n".join(
            [
                f"// Gerado automaticamente com cadencia/entonacao padrao: {res['profile_id']}",
                f"export const STECH_V3_TOTAL_FRAMES = {res['total_frames']};",
                f"export const STECH_V3_CUES = {json.dumps(cues, indent=2)} as const;",
                f"export const STECH_V3_WORDS: Array<{{text: string; from: number; to: number}}> = {json.dumps(ts_words, ensure_ascii=False)};",
            ]
        ),
        encoding="utf-8",
    )

    print(
        f"OK! Stech v3 Audio ({res['profile_id']}) -> {res['total_frames']} frames ({res['total_sec']:.2f}s), {len(ts_words)} palavras"
    )
    print("STECH_V3_CUES:", json.dumps(cues, indent=2))


if __name__ == "__main__":
    asyncio.run(main())
