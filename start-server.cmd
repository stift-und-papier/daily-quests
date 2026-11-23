@echo off
rem Doppelklick startet den lokalen Testserver und oeffnet die App im Browser.
start "" "http://localhost:8080/"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0serve.ps1"
