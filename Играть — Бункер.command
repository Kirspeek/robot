#!/bin/zsh
# Запускает игру «Робот против людей» на карте «Бункер».
# Тот же сервер нужен и для игры вдвоём: напарник в той же Wi‑Fi сети открывает ссылку из меню «Вдвоём по сети».
cd "$(dirname "$0")"
if [[ ! -x .venv/bin/python ]]; then
  echo "Первый запуск: ставлю нужный пакет (aiohttp)…"
  python3 -m venv .venv && .venv/bin/pip install -q aiohttp || { echo "Не получилось установить aiohttp"; read; exit 1; }
fi
if curl -s -o /dev/null http://127.0.0.1:8800/api/info; then
  open "http://127.0.0.1:8800/?map=bunker"
  echo "Сервер игры уже запущен в другом окне. Игра открыта."
  exit 0
fi
.venv/bin/python server.py 8800 &
sleep 1.5
open "http://127.0.0.1:8800/?map=bunker"
echo
echo "Не закрывайте это окно, пока играете."
wait
