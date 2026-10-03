#!/usr/bin/env bash
set -e

echo "========================================"
echo " BORA Render Build"
echo " Installing server conversion engines"
echo "========================================"

apt-get update
apt-get install -y \
  poppler-utils \
  libreoffice \
  python3 \
  python3-pip

echo "Installing Python PDF engine..."
python3 -m pip install --break-system-packages -r requirements-pdf2docx.txt

echo "Installing Node packages..."
npm install

echo "========================================"
echo " BORA build completed"
echo "========================================"