# Usher GNOME Shell Extension Plan

## Premise
The Usher GNOME Extension transforms the `usher` CLI from a terminal-bound script into a first-class desktop utility. It provides a "Remote Control" indicator in the GNOME top bar, allowing users to monitor server status, switch between bookmarks, and stop background processes without opening a terminal. 

This project follows a **"State Producer / View Observer"** architecture: the `usher` CLI remains the authoritative owner of logic and state, while the extension acts as a thin, reactive, and performance-safe UI.

---

## Core Architectural Principles

### 1. Authoritative State (The Contract)
*   **JSON via `jq`:** All structured state (`state.json`) must be generated using `jq`. This prevents shell interpolation errors (quotes, newlines, Unicode) from crashing the GNOME Shell UI.
*   **Persistent State:** `state.json` survives server stops, transitioning to a `"status": "stopped"` state at `${XDG_RUNTIME_DIR}/usher/state.json`.
*   **Singleton Semantics:** Usher operates as a singleton. By default, it refuses to start if another instance is active.
    *   **Replacement:** A `--replace` flag allows a new instance to take over.
    *   **UX:** The extension uses `--replace` for "Switch" actions, ensuring a smooth workflow.

### 2. Reactive Extension (The Observer)
*   **Event-Driven:** Uses `Gio.FileMonitor` on `state.json`. Zero CPU usage when idle; instant UI updates on change.
*   **Performance-Safe:** The extension never parses raw logs or performs heavy IO. It only consumes tiny, pre-processed JSON snapshots produced by the CLI.
*   **Safe Invocation:** All CLI calls use explicit `argv` arrays via `Gio.Subprocess` to prevent shell injection.

### 3. Modular Package Structure
Usher moves from a single-file script to a structured resource layout to manage extensions, icons, and metadata cleanly.
```text
usher/
├── usher                # The CLI binary
├── install.sh           # Modular installer
├── extension/           # GNOME Extension source (ESM)
│   ├── metadata.json
│   ├── extension.js
│   └── stylesheet.css
└── icons/               # Assets
    └── usher-symbolic.svg
```

---

## Phase 1: The Foundation (Stability & Integration)

### 1. CLI Refinement
*   Add `jq` as a mandatory dependency for state generation.
*   Implement `write_state()` using `jq` with timestamps (`started_at`, `updated_at`).
*   Implement singleton protection logic and the `--replace` flag.

### 2. Extension Implementation (ESM)
*   Build for **GNOME 45+**.
*   Implement the `state.json` observer.
*   Create `usher-symbolic.svg` for top-bar consistency.
*   Implement `enable()`/`disable()` with strict resource cleanup.

### 3. Installer & Management
*   Update `install.sh` to detect GNOME and offer an optional extension install.
*   Add `usher install-extension` and `usher uninstall-extension` commands to the CLI.

---

## Phase 2: Power User Features (Expansion)

1.  **Log Summary:** `usher` produces a structured `logs.json` snapshot (last 10 entries) which the extension renders in a sub-menu.
2.  **Certificate Trust Status:** Visual indication of `mkcert` status (e.g., a green shield).
3.  **Project History:** A "Recent" section tracking the last 5 folders served, stored in `~/.local/state/usher/history.json`.
4.  **Automatic Browser Launch:** A preference toggle to open the URL automatically when a server starts.
5.  **Notifications:** Desktop notifications for lifecycle events and critical errors.

---

## Technical Constraints
*   **Compatibility:** GNOME 45+ only (ESM).
*   **Safety:** No string-concatenation for commands; strict use of `argv`.
*   **Stability:** UI elements must never block the main GNOME Shell thread.
