# Garante que `import scraper` (o módulo scraper/scraper.py) funcione
# independente de onde o pytest for chamado — raiz do repo, dentro de
# scraper/, de dentro de scraper/tests/, ou via CI. Sem isso, o resultado
# depende de heurísticas de sys.path do próprio pytest, que variam conforme
# o import-mode e a presença (ou não) de __init__.py nas pastas.
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
