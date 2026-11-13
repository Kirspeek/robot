"""
Сервер игры «Робот против людей»: отдаёт index.html и соединяет двух игроков.

Запуск: .venv/bin/python server.py [порт]   (по умолчанию 8800)
Первый подключившийся игрок ведёт игру (роботы, волны, стены считаются у него),
второй присоединяется к нему. Сервер только пересылает сообщения между ними.
"""
import socket
import sys
from pathlib import Path

from aiohttp import WSMsgType, web

HERE = Path(__file__).resolve().parent
PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8800
clients = []          # не больше двух: [ведущий, напарник]


def lan_ips():
    """Адреса этого компьютера в локальной сети (по ним напарник открывает игру)."""
    ips = set()
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("10.255.255.255", 1))          # пакет никуда не уходит, так узнаём свой адрес
        ips.add(s.getsockname()[0])
        s.close()
    except OSError:
        pass
    try:
        for info in socket.getaddrinfo(socket.gethostname(), None, socket.AF_INET):
            ips.add(info[4][0])
    except OSError:
        pass
    return sorted(ip for ip in ips if not ip.startswith("127."))


async def index(request):
    return web.FileResponse(HERE / "index.html", headers={"Cache-Control": "no-store"})


async def info(request):
    return web.json_response({"ips": lan_ips(), "port": PORT, "players": len(clients)})


async def ws_handler(request):
    ws = web.WebSocketResponse(heartbeat=15, max_msg_size=4 * 1024 * 1024)
    await ws.prepare(request)
    if len(clients) >= 2:
        await ws.send_json({"t": "full"})
        await ws.close()
        return ws
    clients.append(ws)
    role = "host" if len(clients) == 1 else "guest"
    print(f"Игрок подключился ({'ведущий' if role == 'host' else 'напарник'}), {request.remote}", flush=True)
    await ws.send_json({"t": "role", "role": role})
    if role == "guest":
        await clients[0].send_json({"t": "joined"})
    try:
        async for msg in ws:
            if msg.type == WSMsgType.TEXT:
                for c in clients:
                    if c is not ws and not c.closed:
                        await c.send_str(msg.data)
    finally:
        if ws in clients:
            clients.remove(ws)
        print("Игрок вышел", flush=True)
        for c in clients:
            if not c.closed:
                await c.send_json({"t": "left"})
    return ws


def main():
    app = web.Application()
    app.add_routes([web.get("/", index), web.get("/index.html", index),
                    web.get("/api/info", info), web.get("/ws", ws_handler)])
    ips = lan_ips()
    print(f"Игра: http://127.0.0.1:{PORT}/")
    for ip in ips:
        print(f"Напарник в той же сети открывает: http://{ip}:{PORT}/?net=1")
    web.run_app(app, host="0.0.0.0", port=PORT, print=None)


if __name__ == "__main__":
    main()
