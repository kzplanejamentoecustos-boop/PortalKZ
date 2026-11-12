"""
CTC App Base — gerador da versao de arquivo unico.

Junta design-system.css, funcionalidades.js, componentes.js e app.js em um
unico HTML que abre com duplo clique (sem servidor), pois nao usa modulos.

Os arquivos de origem continuam sendo a unica fonte: sempre que algum deles
mudar, rode este script de novo. Nao edite o arquivo gerado.

Uso (dentro da pasta ctc-app-base):
    python ferramentas/gerar-arquivo-unico.py
Resultado:
    CTC-App-Base-arquivo-unico.html
"""
import re
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
CSS = RAIZ / "compartilhado" / "design-system.css"
MODULOS = [
    RAIZ / "compartilhado" / "funcionalidades.js",
    RAIZ / "compartilhado" / "componentes.js",
    RAIZ / "app.js",
]
SAIDA = RAIZ / "CTC-App-Base-arquivo-unico.html"


def remover_modulos(codigo: str) -> str:
    """Remove import/export: no arquivo unico todos os codigos dividem o mesmo escopo."""
    codigo = re.sub(r"^import\s*\{[^}]*\}\s*from\s*['\"][^'\"]+['\"];\s*$", "", codigo, flags=re.M)
    codigo = re.sub(r"^export\s*\{[^}]*\};\s*$", "", codigo, flags=re.M)
    codigo = re.sub(r"^export\s+(?=(async\s+)?function|const|let|class)", "", codigo, flags=re.M)
    if re.search(r"^\s*(import|export)\s", codigo, flags=re.M):
        raise SystemExit("Erro: sobrou import/export que o gerador nao reconhece.")
    return codigo


def conferir_nomes_repetidos(codigos: dict) -> None:
    """No arquivo unico todos dividem o mesmo escopo: nomes de nivel superior nao podem se repetir."""
    vistos = {}
    for arquivo, codigo in codigos.items():
        for nome in re.findall(r"^(?:async\s+)?(?:function|const|let|class)\s+([A-Za-z_$][\w$]*)", codigo, flags=re.M):
            if nome in vistos:
                raise SystemExit(f'Erro: "{nome}" foi declarado em {vistos[nome]} e em {arquivo}. Renomeie um deles.')
            vistos[nome] = arquivo


def main() -> None:
    css = CSS.read_text(encoding="utf-8")
    codigos = {a.relative_to(RAIZ).as_posix(): remover_modulos(a.read_text(encoding="utf-8")) for a in MODULOS}
    conferir_nomes_repetidos(codigos)
    partes = []
    for arquivo in MODULOS:
        codigo = codigos[arquivo.relative_to(RAIZ).as_posix()]
        partes.append(f"/* ===== {arquivo.relative_to(RAIZ).as_posix()} ===== */\n{codigo}")
    js = "\n".join(partes)
    if "</script" in js.lower() or "</style" in css.lower():
        raise SystemExit("Erro: conteudo contem fechamento de tag que quebraria o HTML.")

    html = f"""<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>CTC App Base — Demonstração (dados fictícios)</title>
<!-- ARQUIVO GERADO por ferramentas/gerar-arquivo-unico.py. Nao edite: altere os arquivos de origem e gere de novo. -->
<style>
{css}
</style>
</head>
<body>
<script>
(function () {{
'use strict';
{js}
}})();
</script>
</body>
</html>
"""
    SAIDA.write_text(html, encoding="utf-8")
    print(f"Gerado: {SAIDA.name} ({len(html) // 1024} KB)")


if __name__ == "__main__":
    main()
