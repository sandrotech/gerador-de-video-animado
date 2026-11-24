@echo off
chcp 65001 >nul
title Desmontando Studio 3D - Gerador de Videos Explicativos
set PYTHONUTF8=1

echo ============================================================================
echo   DESMONTANDO STUDIO 3D - INICIANDO SERVIDORES (API :8787 + WEB :5178)
echo ============================================================================

cd /d "%~dp0"
start "Studio API (8787)" cmd /k "set PYTHONUTF8=1 && "..\.venv\Scripts\python.exe" scripts\studio_server.py"
timeout /t 2 >nul
start "" "http://127.0.0.1:5178"
call npm run web

