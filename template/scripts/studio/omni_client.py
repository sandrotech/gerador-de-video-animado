"""
Cliente OmniRoute compartilhado pelos agentes da Miniprodutora.
Carrega OMNIROUTE_BASE_URL e OMNIROUTE_API_KEY do .env na raiz do repo,
executa fallback automatico entre modelos e extrai JSON com seguranca.
"""
import json
import os
import re
import time
import urllib.error
import urllib.request
from pathlib import Path

TEMPLATE_DIR = Path(__file__).resolve().parent.parent.parent
WORKSPACE_ROOT = TEMPLATE_DIR.parent
AGENTS_CFG_PATH = Path(__file__).resolve().parent / "studio_agents.json"


def load_env() -> dict[str, str]:
    env = dict(os.environ)
    for candidate in (WORKSPACE_ROOT / ".env", TEMPLATE_DIR / ".env"):
        if candidate.exists():
            for line in candidate.read_text(encoding="utf-8").splitlines():
                line = line.strip()
                if not line or line.startswith("#") or "=" not in line:
                    continue
                k, v = line.split("=", 1)
                env.setdefault(k.strip(), v.strip().strip('"').strip("'"))
    return env


def load_agent_models() -> dict[str, list[str]]:
    return json.loads(AGENTS_CFG_PATH.read_text(encoding="utf-8"))


class OmniClient:
    def __init__(self, timeout: int = 120):
        env = load_env()
        self.base_url = env.get("OMNIROUTE_BASE_URL", "https://omniroute.alessandrosantos.dev/v1").rstrip("/")
        self.api_key = env.get("OMNIROUTE_API_KEY", "")
        if not self.api_key:
            raise RuntimeError("OMNIROUTE_API_KEY nao encontrada no .env nem nas variaveis de ambiente.")
        self.timeout = timeout
        self.models = load_agent_models()

    def _post(self, path: str, payload: dict, timeout: int | None = None) -> dict:
        req = urllib.request.Request(
            f"{self.base_url}{path}",
            data=json.dumps(payload).encode("utf-8"),
            headers={
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json",
                "User-Agent": "Mozilla/5.0",
            },
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=timeout or self.timeout) as resp:
            return json.loads(resp.read().decode("utf-8"))

    def chat(self, role: str, messages: list[dict], max_tokens: int = 4096, temperature: float = 0.4) -> tuple[str, str]:
        candidates = self.models.get(role, [])
        if not candidates:
            raise ValueError(f"Papel de agente desconhecido: {role}")

        errors = []
        for model in candidates:
            try:
                t0 = time.time()
                res = self._post(
                    "/chat/completions",
                    {
                        "model": model,
                        "messages": messages,
                        "max_tokens": max_tokens,
                        "temperature": temperature,
                    },
                )
                content = (res.get("choices", [{}])[0].get("message", {}).get("content") or "").strip()
                if content:
                    print(f"[OmniRoute:{role}] {model} respondeu em {time.time() - t0:.1f}s")
                    return content, model
                errors.append(f"{model}: resposta vazia")
            except urllib.error.HTTPError as e:
                body = e.read().decode("utf-8", errors="ignore")[:180]
                errors.append(f"{model}: HTTP {e.code} {body}")
            except Exception as e:
                errors.append(f"{model}: {e}")

        raise RuntimeError(f"Todos os modelos falharam para '{role}': {' | '.join(errors)}")

    def generate_image_b64(self, prompt: str, size: str = "1280x720") -> tuple[bytes, str]:
        import base64

        candidates = self.models.get("thumbnail_image", [])
        errors = []
        for model in candidates:
            try:
                t0 = time.time()
                res = self._post(
                    "/images/generations",
                    {"model": model, "prompt": prompt, "size": size, "n": 1},
                    timeout=90,
                )
                item = res.get("data", [{}])[0]
                if item.get("b64_json"):
                    raw = base64.b64decode(item["b64_json"])
                    print(f"[OmniRoute:thumbnail_image] {model} gerou imagem em {time.time() - t0:.1f}s")
                    return raw, model
                if item.get("url"):
                    with urllib.request.urlopen(item["url"], timeout=45) as r:
                        raw = r.read()
                        print(f"[OmniRoute:thumbnail_image] {model} baixou imagem em {time.time() - t0:.1f}s")
                        return raw, model
                errors.append(f"{model}: sem b64_json nem url")
            except urllib.error.HTTPError as e:
                body = e.read().decode("utf-8", errors="ignore")[:180]
                errors.append(f"{model}: HTTP {e.code} {body}")
            except Exception as e:
                errors.append(f"{model}: {e}")

        raise RuntimeError(f"Falha ao gerar thumbnail: {' | '.join(errors)}")


def extract_json_block(text: str) -> dict:
    fenced = re.search(r"```(?:json)?\s*([\s\S]*?)```", text)
    raw = fenced.group(1).strip() if fenced else text.strip()
    start = raw.find("{")
    end = raw.rfind("}")
    if start != -1 and end != -1 and end > start:
        raw = raw[start : end + 1]
    raw = re.sub(r",\s*([}\]])", r"\1", raw)
    return json.loads(raw)


def extract_code_block(text: str) -> str:
    fenced = re.search(r"```(?:typescript|ts|tsx)?\s*([\s\S]*?)```", text)
    return (fenced.group(1) if fenced else text).strip()
