#!/usr/bin/env bash
set -euo pipefail
sudo apt-get update
sudo apt-get install -y \
  libasound2 libatk1.0-0 libatk-bridge2.0-0 libatspi2.0-0 libc6 libdrm2 libgbm1 \
  libgtk-3-0 libnss3 libnspr4 libx11-6 libx11-xcb1 libxcb1 libxcomposite1 libxdamage1 \
  libxext6 libxfixes3 libxrandr2 libxrender1 libxshmfence1 libpango-1.0-0 libcairo2 \
  libglib2.0-0 libexpat1 fonts-liberation ca-certificates
ldconfig -p | grep -E 'libatk-1.0\.so\.0|libgtk-3\.so\.0|libnss3\.so' >/dev/null
echo "Chromium system libs installed (libatk OK)."
