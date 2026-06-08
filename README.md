# usher

A one-command local **HTTPS** dev server backed by [Caddy](https://caddyserver.com/),
with optional **PHP-FPM** support. Point it at a folder and it serves it over
`https://127.0.0.1:8443` with permissive CORS and tidy access logs. Install
[`mkcert`](https://github.com/FiloSottile/mkcert) for a browser-trusted
certificate.

All working files (PHP-FPM socket, Caddyfile, logs) live in a private `mktemp`
directory and are removed on exit — **nothing is ever written into the folder
being served**.

## Install

```bash
./install.sh
```

User-level, no sudo. It places:

| Path | Purpose |
|------|---------|
| `~/.local/bin/usher` | the script |
| `~/.local/share/usher/{cert,key}.pem` | TLS certificate (created by mkcert; absent otherwise) |
| `~/.config/usher/config` | settings (`DEFAULT_ROOT`, `PORT`) |
| `~/.local/share/applications/usher.desktop` | GNOME launcher |
| `~/.local/share/icons/.../usher.svg` | launcher icon |

The installer asks for a **default folder** to serve; leave it blank to set one
up later. If [`mkcert`](https://github.com/FiloSottile/mkcert) is installed it
generates a locally-trusted certificate (no browser warnings). Otherwise usher
falls back to Caddy's built-in internal CA at runtime — HTTPS still works, but
browsers warn until you trust that CA; install mkcert and re-run for a trusted
certificate.

### Requirements

- **caddy** — required.
- **php-fpm** — optional; enables PHP, otherwise static files only.
- **mkcert** — optional; for a browser-trusted certificate.
- **jq** — optional; prettier access logs.
- **zenity** — optional; the launcher's graphical folder pickers need it.

## Usage

```bash
usher [DIR]               # serve DIR (or the configured default root)
usher --pick              # pick a folder graphically, then serve it
usher --set-default [DIR] # set the default root (graphical picker if no DIR)
usher --stop              # stop a server started in the background
usher --status            # is a background server running?
usher --help
```

Resolution of the served folder: the `DIR` argument wins, then `DEFAULT_ROOT`
from the config, then the current directory (when run in a terminal).

Run in a terminal, `Ctrl-C` stops it. Launched from the GNOME menu it runs in
the background — use the launcher's right-click **Stop server** action, or
`usher --stop`.

### GNOME launcher

The "Usher" entry serves the default folder in the background. Right-click
it for quick actions:

- **Serve a folder…** — pick a folder and serve it (one-off).
- **Set default folder…** — change the default root.
- **Stop server** — stop the background server.

## Configuration

`~/.config/usher/config` is sourced as shell. Recognised keys:

```sh
DEFAULT_ROOT="/home/you/Sites"   # served when no folder is given
PORT="8443"                       # listen port
```

`PORT` can also be overridden per-invocation: `PORT=9000 usher`.

## Security

usher is a **local dev** tool. It binds to `127.0.0.1` only, so it is never
reachable from the network. It also sends permissive CORS headers
(`Access-Control-Allow-Origin: *`) so your front-end can fetch from it across
origins without friction — that is the point.

The trade-off: while usher is running, **any website open in your browser can
make requests to `https://127.0.0.1:<port>` and read the files you are
serving.** Credentialed (cookie-bearing) requests are still blocked, because a
wildcard origin disallows them — but the served content itself is readable.

So: only run usher while you actually need it, and don't point it at folders
containing secrets you wouldn't want a visited page to read.

## Uninstall

```bash
./uninstall.sh
```

Removes the script, launcher, and icon. It offers to remove the certificate and
config too. The mkcert root CA is left alone (other tools may rely on it; remove
with `mkcert -uninstall`).
