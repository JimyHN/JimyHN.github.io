@echo off
rem ============================================================
rem  Recorrido animado del blog JimyHN - lanzador para Windows
rem  Doble clic para abrir. Necesita Python 3 y conexion a internet.
rem  Deja esta ventana abierta mientras ves la animacion;
rem  cierrala (o Ctrl+C) para apagar el servidor.
rem ============================================================
title Recorrido animado - JimyHN
cd /d "%~dp0"

where py >nul 2>nul
if %errorlevel%==0 (
  py -3 animacion.py
) else (
  python animacion.py
)

if %errorlevel% neq 0 (
  echo.
  echo No se pudo arrancar. Comprueba que Python 3 esta instalado
  echo y anadido al PATH ^(python.org, opcion "Add to PATH"^).
  echo.
  pause
)
