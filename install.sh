#!/usr/bin/env bash
#
# install.sh — install caddyup for the current user (no sudo required).
#
# Lays down:
#   ~/.local/bin/caddyup                              the script
#   ~/.local/share/caddyup/{cert,key}.pem            TLS certificate (mkcert only)
#   ~/.local/share/icons/.../caddyup.svg             launcher icon
#   ~/.local/share/applications/caddyup.desktop      GNOME launcher
#   ~/.config/caddyup/config                         settings (default root)

set -euo pipefail

BUNDLE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

BIN_DIR="${HOME}/.local/bin"
DATA_DIR="${XDG_DATA_HOME:-$HOME/.local/share}/caddyup"
CONFIG_DIR="${XDG_CONFIG_HOME:-$HOME/.config}/caddyup"
DESKTOP_DIR="${XDG_DATA_HOME:-$HOME/.local/share}/applications"
ICON_DIR="${XDG_DATA_HOME:-$HOME/.local/share}/icons/hicolor/scalable/apps"

# ── Dependency checks ─────────────────────────────────────────────────────────

if ! command -v caddy >/dev/null 2>&1; then
    echo "ERROR: caddy is required but not found."
    echo "  Install: https://caddyserver.com/docs/install"
    echo "           (e.g. sudo apt install caddy, or the Cloudsmith apt repo)"
    exit 1
fi

if command -v php-fpm >/dev/null 2>&1 || ls /usr/sbin/php-fpm* >/dev/null 2>&1; then
    have_fpm=true
else
    have_fpm=false
fi
if ! command -v php >/dev/null 2>&1 || [[ "$have_fpm" == false ]]; then
    echo "NOTE: PHP-FPM not detected — caddyup will serve static files only."
    echo "      For PHP support: sudo apt install php-fpm"
fi

command -v jq    >/dev/null 2>&1 || echo "NOTE: 'jq' not found — access logs will be less tidy (sudo apt install jq)."
command -v zenity >/dev/null 2>&1 || echo "NOTE: 'zenity' not found — the launcher's folder pickers need it (sudo apt install zenity)."

# ── Script ────────────────────────────────────────────────────────────────────

mkdir -p "$BIN_DIR"
install -m 0755 "${BUNDLE_DIR}/caddyup" "${BIN_DIR}/caddyup"
echo "Installed ${BIN_DIR}/caddyup"

if [[ ":$PATH:" != *":${BIN_DIR}:"* ]]; then
    echo "NOTE: ${BIN_DIR} is not in your PATH. Add to ~/.bashrc or ~/.profile:"
    echo "      export PATH=\"\${HOME}/.local/bin:\${PATH}\""
fi

# ── TLS certificate ───────────────────────────────────────────────────────────
#
# With mkcert we mint a locally-trusted cert (no browser warnings). Without it,
# caddyup falls back at runtime to Caddy's built-in internal CA — HTTPS still
# works, but browsers warn until that CA is trusted. We ship no certificate.

mkdir -p "$DATA_DIR"
if command -v mkcert >/dev/null 2>&1; then
    echo "Generating a locally-trusted certificate with mkcert..."
    mkcert -install
    mkcert -cert-file "${DATA_DIR}/cert.pem" -key-file "${DATA_DIR}/key.pem" \
        localhost 127.0.0.1 ::1 "$(hostname)"
    echo "Trusted certificate in place at ${DATA_DIR}/cert.pem"
else
    echo "mkcert not found — caddyup will use Caddy's internal CA (browsers will warn)."
    echo "  For a browser-trusted certificate, install mkcert and re-run install.sh:"
    echo "  https://github.com/FiloSottile/mkcert"
fi

# ── Icon ──────────────────────────────────────────────────────────────────────

mkdir -p "$ICON_DIR"
install -m 0644 "${BUNDLE_DIR}/caddyup.svg" "${ICON_DIR}/caddyup.svg"
gtk-update-icon-cache -f -t "${XDG_DATA_HOME:-$HOME/.local/share}/icons/hicolor" 2>/dev/null || true
echo "Installed icon"

# ── Desktop launcher ──────────────────────────────────────────────────────────

mkdir -p "$DESKTOP_DIR"
install -m 0644 "${BUNDLE_DIR}/caddyup.desktop" "${DESKTOP_DIR}/caddyup.desktop"
# Point every Exec line at the absolute path, since GUI launches may not have
# ~/.local/bin on PATH.
sed -i "s|^Exec=caddyup|Exec=${BIN_DIR}/caddyup|" "${DESKTOP_DIR}/caddyup.desktop"
update-desktop-database "$DESKTOP_DIR" 2>/dev/null || true
echo "Installed launcher (Caddy Up)"

# ── Default root ──────────────────────────────────────────────────────────────

echo
echo "The launcher (and bare 'caddyup') serves a default folder when none is given."
read -rp "Default folder to serve [leave blank to set up later]: " DEFAULT_ROOT_INPUT
if [[ -n "$DEFAULT_ROOT_INPUT" ]]; then
    if "${BIN_DIR}/caddyup" --set-default "$DEFAULT_ROOT_INPUT"; then
        :
    else
        echo "Could not set default now — do it later with: caddyup --set-default [DIR]"
    fi
else
    mkdir -p "$CONFIG_DIR"
    echo "Skipped. Set it later with: caddyup --set-default [DIR]"
    echo "(or via the launcher's right-click 'Set default folder…' action)"
fi

echo
echo "Done. Usage:"
echo "  caddyup [DIR]        serve a folder over https://127.0.0.1:8443"
echo "  caddyup --set-default [DIR] / --pick / --stop / --status"
