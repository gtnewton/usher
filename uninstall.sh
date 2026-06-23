#!/usr/bin/env bash
#
# uninstall.sh — remove usher for the current user.

set -euo pipefail

BIN_FILE="${HOME}/.local/bin/usher"
DATA_DIR="${XDG_DATA_HOME:-$HOME/.local/share}/usher"
CONFIG_DIR="${XDG_CONFIG_HOME:-$HOME/.config}/usher"
DESKTOP_FILE="${XDG_DATA_HOME:-$HOME/.local/share}/applications/usher.desktop"
ICON_FILE="${XDG_DATA_HOME:-$HOME/.local/share}/icons/hicolor/scalable/apps/usher.svg"
COMPLETION_FILE="${XDG_DATA_HOME:-$HOME/.local/share}/bash-completion/completions/usher"

echo "Removing usher..."

# Stop a running background server, if any.
[[ -x "$BIN_FILE" ]] && "$BIN_FILE" --stop >/dev/null 2>&1 || true

[[ -f "$BIN_FILE" ]]        && rm "$BIN_FILE"        && echo "Removed $BIN_FILE"
[[ -f "$DESKTOP_FILE" ]]   && rm "$DESKTOP_FILE"   && echo "Removed $DESKTOP_FILE"
[[ -f "$ICON_FILE" ]]      && rm "$ICON_FILE"      && echo "Removed $ICON_FILE"
[[ -f "$COMPLETION_FILE" ]] && rm "$COMPLETION_FILE" && echo "Removed $COMPLETION_FILE"

update-desktop-database "${XDG_DATA_HOME:-$HOME/.local/share}/applications" 2>/dev/null || true
gtk-update-icon-cache -f -t "${XDG_DATA_HOME:-$HOME/.local/share}/icons/hicolor" 2>/dev/null || true

EXTENSION_DIR="${XDG_DATA_HOME:-$HOME/.local/share}/gnome-shell/extensions/usher@gtnewton.github.com"
if [[ -d "$EXTENSION_DIR" ]]; then
    if command -v gnome-extensions >/dev/null 2>&1 && \
       gnome-extensions uninstall "usher@gtnewton.github.com" 2>/dev/null; then
        echo "Removed GNOME extension (via gnome-extensions uninstall)"
    else
        rm -rf "$EXTENSION_DIR"
        echo "Removed $EXTENSION_DIR"
    fi
fi

BOOKMARKS_FILE="${CONFIG_DIR}/bookmarks"

if [[ -d "$DATA_DIR" || -d "$CONFIG_DIR" ]]; then
    echo
    read -rp "Also remove the certificate and config (${DATA_DIR}, ${CONFIG_DIR})? [y/N] " choice
    case "$choice" in
        [yY]|[yY][eE][sS])
            [[ -d "$DATA_DIR" ]] && rm -rf "$DATA_DIR" && echo "Removed $DATA_DIR"

            if [[ -d "$CONFIG_DIR" ]]; then
                # Bookmarks are user data, not an installed artifact — decide
                # their fate separately before wiping the config directory.
                keep_bookmarks=0
                if [[ -f "$BOOKMARKS_FILE" ]]; then
                    echo
                    echo "You have saved bookmarks at $BOOKMARKS_FILE"
                    read -rp "Bookmarks: [k]eep (default), [b]ack up to home, or [d]elete with config? [K/b/d] " bm_choice
                    case "$bm_choice" in
                        [bB])
                            backup="${HOME}/usher-bookmarks-$(date +%Y%m%d-%H%M%S).bak"
                            cp -p "$BOOKMARKS_FILE" "$backup"
                            echo "Backed up bookmarks to $backup"
                            ;;
                        [dD])
                            echo "Bookmarks will be deleted with the config."
                            ;;
                        *)
                            keep_bookmarks=1
                            ;;
                    esac
                fi

                if [[ "$keep_bookmarks" == 1 ]]; then
                    saved="$(mktemp)"
                    cp -p "$BOOKMARKS_FILE" "$saved"
                    rm -rf "$CONFIG_DIR"
                    mkdir -p "$CONFIG_DIR"
                    mv "$saved" "$BOOKMARKS_FILE"
                    echo "Removed $CONFIG_DIR (kept bookmarks)"
                else
                    rm -rf "$CONFIG_DIR" && echo "Removed $CONFIG_DIR"
                fi
            fi
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
