#!/usr/bin/env bash
set -euo pipefail

if ! command -v apt-get >/dev/null 2>&1; then
  echo "apt-get not available; skipping chromium dependency installation"
  exit 0
fi

SUDO=""
if command -v sudo >/dev/null 2>&1; then
  SUDO="sudo "
fi

if [ -z "${SUDO}" ] && [ "$(id -u)" -ne 0 ]; then
  echo "apt-get available but requires elevated privileges; skipping chromium dependency installation"
  exit 0
fi

choose_pkg() {
  for pkg in "$@"; do
    candidate=$(apt-cache policy "$pkg" | awk '/Candidate:/ { print $2 }' | head -n1)
    if [ -n "${candidate:-}" ] && [ "$candidate" != "(none)" ]; then
      echo "$pkg"
      return 0
    fi
  done
  return 1
}

ALSA_PKG="$(choose_pkg libasound2 libasound2t64)"
CUPS_PKG="$(choose_pkg libcups2 libcups2t64)"

${SUDO}apt-get update
${SUDO}apt-get install -y \
  libnss3 \
  libatk1.0-0 \
  libatk-bridge2.0-0 \
  "${CUPS_PKG}" \
  libdrm2 \
  libxkbcommon0 \
  libxcomposite1 \
  libxdamage1 \
  libxfixes3 \
  libxrandr2 \
  libgbm1 \
  libpango-1.0-0 \
  "${ALSA_PKG}" \
  fonts-liberation \
  libxshmfence1 \
  libxcb1 \
  libx11-6 \
  ca-certificates

${SUDO}apt-get clean
${SUDO}rm -rf /var/lib/apt/lists/*
