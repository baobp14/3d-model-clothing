@echo off
chcp 65001 > nul
title N&B Fashion - Cloudflare Tunnel Demo Điện Thoại

echo ========================================================
echo   KHỞI TẠO ĐƯỜNG LINK PUBLIC ĐỂ DEMO TRÊN ĐIỆN THOẠI
echo ========================================================
echo.
echo Đang kết nối Cloudflare... Vui lòng đợi link trycloudflare.com xuất hiện...
echo.
"C:\Program Files (x86)\cloudflared\cloudflared.exe" tunnel --url http://localhost:5173
pause
