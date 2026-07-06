"""Garante que o pacote `harvester` (em ./harvester) seja importável nos testes."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
