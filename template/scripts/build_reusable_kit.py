import json
import subprocess
from pathlib import Path
import numpy as np
from PIL import Image

ROOT = Path(r"d:\Aplicações testes\editor videos\anything2explainer\template")
RENDERS = ROOT / "renders"
KIT_DIR = ROOT / "public" / "assets" / "desmontando_kit"
KIT_DIR.mkdir(parents=True, exist_ok=True)


def extract_frame_rgb(video_path: Path, sec: float) -> np.ndarray:
    tmp_png = KIT_DIR / "_frame_extract.png"
    subprocess.run(
        [
            "ffmpeg",
            "-y",
            "-ss",
            f"{sec:.2f}",
            "-i",
            str(video_path),
            "-frames:v",
            "1",
            "-q:v",
            "2",
            str(tmp_png),
        ],
        check=True,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    arr = np.array(Image.open(tmp_png).convert("RGB"))
    tmp_png.unlink(missing_ok=True)
    return arr


def save_crop(rgb: np.ndarray, box: tuple[int, int, int, int], out_name: str) -> str:
    h, w, _ = rgb.shape
    x1, y1, x2, y2 = box
    crop = rgb[max(0, y1):min(h, y2), max(0, x1):min(w, x2)]
    out_path = KIT_DIR / out_name
    Image.fromarray(crop).save(out_path, quality=95)
    return str(out_path.relative_to(ROOT))


def build_kit():
    v_ac = RENDERS / "ref_instagram.mp4"
    v_roof = RENDERS / "ref_reel_2_DezX76zgi47.mp4"
    v_sky = RENDERS / "ref_reel_3_De4oWvEh06y.mp4"

    # 1. Plates e Recortes Originais Extraídos Diretamente dos 3 Reels Virais
    f_ac_hot = extract_frame_rgb(v_ac, 2.0)
    f_ac_bucket = extract_frame_rgb(v_ac, 6.2)
    f_roof_char = extract_frame_rgb(v_roof, 1.0)
    f_roof_beam = extract_frame_rgb(v_roof, 24.5)
    f_sky_char = extract_frame_rgb(v_sky, 2.0)
    f_sky_wind = extract_frame_rgb(v_sky, 41.5)

    assets = {
        "personagem_sentado_calor": save_crop(f_ac_hot, (0, 380, 360, 930), "personagem_sentado_calor.png"),
        "personagem_sentado_com_balde": save_crop(f_ac_bucket, (0, 360, 560, 940), "personagem_sentado_com_balde.png"),
        "balde_gelo_original": save_crop(f_ac_bucket, (280, 440, 540, 880), "balde_gelo_original.png"),
        "ventilador_pedestal_original": save_crop(f_ac_hot, (390, 450, 720, 930), "ventilador_pedestal_original.png"),
        "personagem_em_pe_acenando": save_crop(f_roof_char, (200, 460, 520, 1020), "personagem_em_pe_acenando.png"),
        "personagem_em_pe_capacete_escala": save_crop(f_sky_char, (200, 460, 520, 1040), "personagem_em_pe_capacete_escala.png"),
        "plate_sala_completa_original": save_crop(f_ac_hot, (0, 0, 720, 1280), "plate_sala_completa_original.png"),
        "plate_telhado_estrutura": save_crop(f_roof_beam, (0, 0, 720, 1280), "plate_telhado_estrutura.png"),
        "plate_arranha_ceu_vento": save_crop(f_sky_wind, (0, 0, 720, 1280), "plate_arranha_ceu_vento.png"),
    }

    catalog = {
        "name": "@desmontandoomundo Permanent Asset & Rig Kit",
        "version": "1.0.0",
        "threejs_rig_module": "src/shots/G1/DesmontandoRig.ts",
        "poses_supported": [
            "sitting_hot",
            "sitting_cool",
            "standing_wave",
            "standing_neutral"
        ],
        "props_supported": [
            "createDesmontandoCharacter() -> Boneco oficial articulado (FK rig, cabelo alto com topete, olhos pretos com brilho, mangas bufantes, bermuda cinza-azulada, chinelos azuis, capacete amarelo opcional)",
            "createBeveledArmchair() -> Poltrona verde chanfrada (RoundedBoxGeometry) com pés de madeira",
            "createRibbedIceBucket() -> Balde metálico frisado com 3 anéis em relevo, alça preta e pirâmide de gelo low-poly"
        ],
        "extracted_original_plates": assets
    }

    with open(KIT_DIR / "CATALOG.json", "w", encoding="utf-8") as f:
        json.dump(catalog, f, ensure_ascii=False, indent=2)

    print("Kit de assets reutilizáveis gerado com sucesso em:", KIT_DIR)


if __name__ == "__main__":
    build_kit()
