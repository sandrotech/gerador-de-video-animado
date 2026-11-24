"""
Rollback rapido para o estado salvo antes da implementacao da Miniprodutora Multi-Agente.
Uso:
  python template/scripts/rollback_studio.py --confirm
"""
import argparse
import shutil
from pathlib import Path

TEMPLATE_DIR = Path(__file__).resolve().parent.parent
WORKSPACE_ROOT = TEMPLATE_DIR.parent
BACKUP_DIR = WORKSPACE_ROOT / "backups" / "pre-miniprodutora"


def main():
    parser = argparse.ArgumentParser(description="Restaura snapshot backups/pre-miniprodutora")
    parser.add_argument("--confirm", action="store_true", help="Confirma a restauracao dos arquivos")
    args = parser.parse_args()

    if not BACKUP_DIR.exists():
        raise FileNotFoundError(f"Backup nao encontrado em {BACKUP_DIR}")
    if not args.confirm:
        print(f"Backup pronto em: {BACKUP_DIR}")
        print("Para restaurar, rode: python template\\scripts\\rollback_studio.py --confirm")
        return

    for sub in ("src", "scripts"):
        dst = TEMPLATE_DIR / sub
        if dst.exists():
            shutil.rmtree(dst)
        shutil.copytree(BACKUP_DIR / "template" / sub, dst)

    for fname in (".gitignore", "FABRICA_VIDEOS_GUIA.md"):
        src_f = BACKUP_DIR / fname
        if src_f.exists():
            shutil.copy2(src_f, WORKSPACE_ROOT / fname)

    print("OK! Projeto restaurado para o snapshot pre-miniprodutora.")


if __name__ == "__main__":
    main()
