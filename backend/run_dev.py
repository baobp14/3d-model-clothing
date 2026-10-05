"""Run Python + Vite together; Ctrl+C stops only the process trees started here."""
import shutil
import socket
import subprocess
import sys
import time

import httpx

from app.config import ROOT, Settings
from app.init_db import main as init_local_database


def stop(process):
    if process.poll() is not None:
        return
    if sys.platform == 'win32':
        # Venv Python creates a child process on Windows.
        # This PID still belongs to the Popen instance above; stop its tree.
        subprocess.run(['taskkill', '/PID', str(process.pid), '/T', '/F'],
                       stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=False)
    else:
        process.terminate()
    try:
        process.wait(timeout=5)
    except subprocess.TimeoutExpired:
        process.kill()
        process.wait(timeout=5)


def main():
    node = shutil.which('node')
    vite = ROOT.parent / 'frontend' / 'node_modules' / 'vite' / 'bin' / 'vite.js'
    if not node or not vite.is_file():
        raise SystemExit('Install Node.js and run npm install in frontend first.')
    for port in (8000, 5173):
        with socket.socket() as check:
            if check.connect_ex(('127.0.0.1', port)) == 0:
                raise SystemExit(f'Port {port} is already in use. Stop the previous dev server before starting both services.')
    if Settings().database_url.startswith('sqlite'):
        init_local_database()
    processes = []
    # The supervisor handles Ctrl+C and stops its own children in finally.
    process_options = {'creationflags': subprocess.CREATE_NEW_PROCESS_GROUP} if sys.platform == 'win32' else {}
    try:
        api = subprocess.Popen([sys.executable, '-m', 'uvicorn', 'app.main:app',
                                '--host', '127.0.0.1', '--port', '8000'], cwd=ROOT, **process_options)
        processes.append(api)
        deadline = time.monotonic() + 20
        while True:
            if api.poll() is not None:
                raise SystemExit('Python API exited during startup. Check its error output above.')
            try:
                if httpx.get('http://127.0.0.1:8000/api/health', timeout=1).status_code == 200:
                    break
            except httpx.HTTPError:
                pass
            if time.monotonic() >= deadline:
                raise SystemExit('API is not ready. Check DATABASE_URL and migrations in backend/README.md.')
            time.sleep(0.2)
        web = subprocess.Popen([node, str(vite), '--host', '127.0.0.1', '--port', '5173', '--strictPort'], cwd=ROOT.parent / 'frontend', **process_options)
        processes.append(web)
        print('\nShop: http://127.0.0.1:5173\nAPI docs: http://127.0.0.1:8000/docs\nCtrl+C stops both services.\n', flush=True)
        while all(process.poll() is None for process in processes):
            time.sleep(0.3)
        raise SystemExit('A dev service stopped. Both services are shutting down.')
    except KeyboardInterrupt:
        print('\nStopping dev services...', flush=True)
    finally:
        for process in reversed(processes):
            stop(process)


if __name__ == '__main__':
    main()
