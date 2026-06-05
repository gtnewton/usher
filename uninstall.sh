#!/usr/bin/env bash
#
# uninstall.sh — remove caddyup for the current user.

set -euo pipefail

BIN_FILE="${HOME}/.local/bin/caddyup"
DATA_DIR="${XDG_DATA_HOME:-$HOME/.local/share}/caddyup"
CONFIG_DIR="${XDG_CONFIG_HOME:-$HOME/.config}/caddyup"
DESKTOP_FILE="${XDG_DATA_HOME:-$HOME/.local/share}/applications/caddyup.desktop"
ICON_FILE="${XDG_DATA_HOME:-$HOME/.local/share}/icons/hicolor/scalable/apps/caddyup.svg"

echo "Removing caddyup..."

# Stop a running background server, if any.
[[ -x "$BIN_FILE" ]] && "$BIN_FILE" --stop >/dev/null 2>&1 || true

[[ -f "$BIN_FILE" ]]     && rm "$BIN_FILE"     && echo "Removed $BIN_FILE"
[[ -f "$DESKTOP_FILE" ]] && rm "$DESKTOP_FILE" && echo "Removed $DESKTOP_FILE"
[[ -f "$ICON_FILE" ]]    && rm "$ICON_FILE"    && echo "Removed $ICON_FILE"

update-desktop-database "${XDG_DATA_HOME:-$HOME/.local/share}/applications" 2>/dev/null || true
gtk-update-icon-cache -f -t "${XDG_DATA_HOME:-$HOME/.local/share}/icons/hicolor" 2>/dev/null || true

if [[ -d "$DATA_DIR" || -d "$CONFIG_DIR" ]]; then
    echo
    read -rp "Also remove the certificate and config (${DATA_DIR}, ${CONFIG_DIR})? [y/N] " choice
    case "$choice" in
        [yY]|[yY][eE][sS])
            [[ -d "$DATA_DIR" ]]   && rm -rf "$DATA_DIR"   && echo "Removed $DATA_DIR"
            [[ -d "$CONFIG_DIR" ]] && rm -rf "$CONFIG_DIR" && echo "Removed $CONFIG_DIR"
            ;;
        *)
            echo "Left certificate and config in place."
            ;;
    esac
fi

echo
echo "NOTE: the mkcert root CA (if any) was not removed — other tools may use it."
echo "      To remove it: mkcert -uninstall"
echo "Done."
