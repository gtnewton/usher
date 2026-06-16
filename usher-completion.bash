# bash completion for usher

_usher_bookmarks() {
    local f="${XDG_CONFIG_HOME:-$HOME/.config}/usher/bookmarks"
    [[ -f "$f" ]] || return
    grep "^[^#]" "$f" | cut -d= -f1
}

_usher_filedir() {
    if declare -f _filedir >/dev/null 2>&1; then
        _filedir -d
    else
        COMPREPLY+=( $(compgen -d -- "$cur") )
    fi
}

_usher() {
    local cur prev words cword

    if declare -f _init_completion >/dev/null 2>&1; then
        _init_completion || return
    else
        cur="${COMP_WORDS[COMP_CWORD]}"
        prev="${COMP_WORDS[COMP_CWORD-1]}"
        words=("${COMP_WORDS[@]}")
        cword="$COMP_CWORD"
    fi

    case "$prev" in
        --unbookmark)
            COMPREPLY=( $(compgen -W "$(_usher_bookmarks)" -- "$cur") )
            return ;;
        --set-default)
            _usher_filedir
            return ;;
        --bookmark)
            # next word is the bookmark name — nothing to complete
            return ;;
    esac

    # usher --bookmark NAME <TAB>  →  directory
    if [[ ${words[1]} == --bookmark && $cword -eq 3 ]]; then
        _usher_filedir
        return
    fi

    if [[ "$cur" == -* ]]; then
        COMPREPLY=( $(compgen -W \
            '--pick --set-default --bookmark --new-bookmark --unbookmark --bookmarks --stop --status --help' \
            -- "$cur") )
        return
    fi

    # First positional arg: bookmark names + directories
    if [[ $cword -eq 1 ]]; then
        COMPREPLY=( $(compgen -W "$(_usher_bookmarks)" -- "$cur") )
        _usher_filedir
    fi
}

complete -F _usher usher
