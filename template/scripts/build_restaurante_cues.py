import json
from pathlib import Path

# Primeiros 5s (f0..150) calibrados com a energia acustica real do master_audio.wav
exact_intro_words = [
    {"text": "Esses", "from": 0, "to": 11},
    {"text": "dois", "from": 12, "to": 20},
    {"text": "restaurantes", "from": 21, "to": 35},
    {"text": "servem", "from": 39, "to": 50},
    {"text": "o", "from": 51, "to": 54},
    {"text": "mesmo", "from": 55, "to": 62},
    {"text": "prato", "from": 63, "to": 75},
    {"text": "pelo", "from": 81, "to": 89},
    {"text": "mesmo", "from": 90, "to": 98},
    {"text": "preço", "from": 99, "to": 112},
    {"text": "na", "from": 117, "to": 122},
    {"text": "mesma", "from": 123, "to": 131},
    {"text": "rua.", "from": 132, "to": 149},
]

# Restante dos atos (5.2s - 97.0s)
remaining_acts = [
    ("Só que o Restaurante X vive cheio, e o Y passa a noite com mesa vazia.", 5.2, 10.5),
    ("E a diferença começa antes do cliente sentar!", 10.5, 15.0),
    ("O Restaurante Y continua do jeito que abriu anos atrás. O X estudou tudo e começou do zero.", 15.0, 22.0),
    ("Primeiro, o mapa: olha o cliente procurando onde jantar!", 22.0, 26.5),
    ("O Y aparece com horário errado, sem foto e sem telefone... está aberto? Ninguém sabe!", 26.5, 34.0),
    ("O X atualiza o perfil no Google: horário certo, foto dos pratos, botão de Rota.", 34.0, 41.0),
    ("Um toque e o cliente já está a caminho!", 41.0, 44.5),
    ("Mas o cliente quer ver o cardápio antes: no Y é um PDF que demora para abrir e precisa de zoom.", 44.5, 52.0),
    ("No X, o link abre no celular com foto e preço de cada prato!", 52.0, 57.0),
    ("Agora as avaliações: o Y tem nota baixa e nenhuma resposta, parece abandonado.", 57.0, 64.0),
    ("O X responde cada comentário, até o ruim, e o cliente confia!", 64.0, 71.0),
    ("Só que tem dia que a gente prefere pedir em casa: o Y depende só do aplicativo e deixa parte do lucro em taxa.", 71.0, 79.0),
    ("O X tem pedido próprio pelo WhatsApp, com cupom para pedir de novo!", 79.0, 84.5),
    ("Mas restaurante bom que ninguém vê fica vazio: o X posta o prato saindo na hora e anuncia para quem mora perto na hora do jantar.", 84.5, 91.0),
    ("E o Y espera o movimento aparecer... Um ano depois, o X tem fila na porta!", 91.0, 93.5),
    ("O Y colocou uma placa: Passa-se o Ponto.", 93.5, 95.0),
    ("Mesmo prato. Mesmo preço. Só um foi encontrado. Quer que o seu seja o próximo? Chama a gente!", 95.0, 97.0),
]

fps = 30
words_list = list(exact_intro_words)

for phrase, start_s, end_s in remaining_acts:
    words = phrase.split()
    total_w = len(words)
    dur = end_s - start_s
    w_dur = dur / max(1, total_w)
    for i, w in enumerate(words):
        w_start = round(start_s + i * w_dur, 2)
        w_end = round(w_start + w_dur, 2)
        f_from = int(round(w_start * fps))
        f_to = int(round(w_end * fps))
        words_list.append({"text": w, "from": f_from, "to": f_to})

cues = {
    "f_hook": 0,
    "f_vendas_init": 120,
    "f_mapa_search": 660,
    "f_y_sem_foto": 800,
    "f_x_google_rota": 1020,
    "f_cardapio_pdf_zoom": 1335,
    "f_cardapio_mobile_x": 1560,
    "f_avaliacoes_compare": 1710,
    "f_delivery_taxas": 2130,
    "f_whatsapp_cupom": 2370,
    "f_trafego_anuncio": 2535,
    "f_fila_porta_x": 2730,
    "f_passa_ponto_y": 2805,
    "f_cta_final": 2850,
    "total_frames": 2910,
}

ts_lines = [
    "// Gerado automaticamente para a composicao RestauranteContrast",
    f"export const RESTAURANTE_TOTAL_FRAMES = {cues['total_frames']};",
    "",
    f"export const RESTAURANTE_CUES = {json.dumps(cues, indent=2)} as const;",
    "",
    f"export const RESTAURANTE_WORDS: Array<{{text: string; from: number; to: number}}> = {json.dumps(words_list, indent=2)};",
]

out_path = Path("template/src/shots/G1/restauranteWords.ts")
out_path.write_text("\n".join(ts_lines), encoding="utf-8")
print(f"Saved {out_path} with {len(words_list)} words and total_frames={cues['total_frames']}")
