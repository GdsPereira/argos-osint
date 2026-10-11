import os
import sys

# Garante que o diretório backend esteja no PYTHONPATH durante os testes
backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)
