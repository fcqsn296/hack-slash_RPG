@echo off
chcp 65001 > nul
rem Open the NovelAI image generator. Console stays open on error.
cd /d "%~dp0.."
python tools/novelai_gen.py %*
if errorlevel 1 pause
