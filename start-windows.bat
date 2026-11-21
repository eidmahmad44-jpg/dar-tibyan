@echo off
chcp 65001 >nul
title Dar Tibyan Server
cd /d "%~dp0"
where node >nul 2>nul || (echo Node.js غير مثبت. حمّله من https://nodejs.org ^(نسخة LTS^) ثم أعد التشغيل. & pause & exit /b)
start "" http://localhost:3000
node server.js
pause
