#!/usr/bin/env bash
set -euo pipefail

if ! command -v apt-get >/dev/null 2>&1; then
  echo "apt-get not available; skipping chromium dependency installation"
  exit 0
fi

apt-get update
apt-get install -y \
  libnss3 \
  libatk1.0-0 \
  libatk-bridge2.0-0 \
  libcups2 \
  libdrm2 \
  libxkbcommon0 \
  libxcomposite1 \
  libxdamage1 \
  libxfixes3 \
  libxrandr2 \
  libgbm1 \
  libpango-1.0-0 \
  libasound2 \
  fonts-liberation \
  libxshmfence1 \
  libxcb1 \
  libx11-6 \
  ca-certificates

apt-get clean
rm -rf /var/lib/apt/lists/*
