import Clutter from 'gi://Clutter';
import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import Gio from 'gi://Gio';
import Pango from 'gi://Pango';
import St from 'gi://St';

import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';

const RUN_DIR_PATH = `${GLib.get_user_runtime_dir()}/usher`;
const BOOKMARKS_PATH = `${GLib.get_user_config_dir()}/usher/bookmarks`;

function findUsher() {
    return GLib.find_program_in_path('usher') ??
        `${GLib.get_home_dir()}/.local/bin/usher`;
}

const UsherIndicator = GObject.registerClass(
class extends PanelMenu.Button {
    constructor(settings) {
        super(0.0, 'Usher', false);
        this._settings = settings;

        const box = new St.BoxLayout({ style_class: 'panel-status-menu-box' });
        this._icon = new St.Icon({
            icon_name: 'network-server-symbolic',
            style_class: 'system-status-icon',
        });
        this._countLabel = new St.Label({
            text: '',
            style_class: 'usher-count-label',
            y_expand: true,
            y_align: Clutter.ActorAlign.CENTER,
        });
        // Never ellipsize the count — a single digit must always be readable,
        // even in a cramped (e.g. nested-shell) top bar.
        this._countLabel.clutter_text.ellipsize = Pango.EllipsizeMode.NONE;
        box.add_child(this._icon);
        box.add_child(this._countLabel);
        this.add_child(box);

        GLib.mkdir_with_parents(RUN_DIR_PATH, 0o700);
        this._setupMonitor();
        this._rebuild();
    }

    _setupMonitor() {
        const dir = Gio.File.new_for_path(RUN_DIR_PATH);
        this._monitor = dir.monitor_directory(Gio.FileMonitorFlags.NONE, null);
        this._monitorId = this._monitor.connect('changed', (_m, _f, _of, event) => {
            if (event === Gio.FileMonitorEvent.CHANGES_DONE_HINT ||
                event === Gio.FileMonitorEvent.CREATED ||
                event === Gio.FileMonitorEvent.DELETED)
                this._rebuild();
        });
    }

    _readStates() {
        const states = [];
        const dir = Gio.File.new_for_path(RUN_DIR_PATH);
        try {
            const iter = dir.enumerate_children(
                'standard::name', Gio.FileQueryInfoFlags.NONE, null);
            let info;
            while ((info = iter.next_file(null)) !== null) {
                const name = info.get_name();
                if (!/^state-\d+\.json$/.test(name)) continue;
                try {
                    const [, bytes] = dir.get_child(name).load_contents(null);
                    const state = JSON.parse(new TextDecoder().decode(bytes));
                    if (state.status === 'running') states.push(state);
                } catch (_e) {}
            }
        } catch (_e) {}
        return states.sort((a, b) => a.port - b.port);
    }

    _readBookmarks() {
        try {
            const [, bytes] = Gio.File.new_for_path(BOOKMARKS_PATH).load_contents(null);
            return new TextDecoder().decode(bytes)
                .split('\n')
                .filter(l => l.trim() && !l.startsWith('#') && l.includes('=') && !l.startsWith('='))
                .map(l => {
                    const eq = l.indexOf('=');
                    return { name: l.slice(0, eq).trim(), path: l.slice(eq + 1).trim() };
                })
                .filter(b => b.name && b.path);
        } catch (_e) {
            return [];
        }
    }

    _rebuild() {
        this.menu.removeAll();
        const states = this._readStates();
        const bookmarks = this._readBookmarks();

        if (states.length > 0) {
            this._countLabel.set_text(` ${states.length}`);
            this._icon.remove_style_class_name('usher-inactive');
            this._icon.add_style_class_name('usher-active');
        } else {
            this._countLabel.set_text('');
            this._icon.remove_style_class_name('usher-active');
            this._icon.add_style_class_name('usher-inactive');
        }

        const bookmarkByPath = new Map(bookmarks.map(b => [b.path, b]));
        const runningPaths = new Set(states.map(s => s.root));

        // Running servers — one row each, name from bookmark if matched
        for (const state of states) {
            const bm = bookmarkByPath.get(state.root);
            const name = bm?.name ?? (state.root ?? '').split('/').filter(Boolean).pop() ?? 'unknown';
            this.menu.addMenuItem(this._buildRunningItem(name, state));
        }

        // Idle bookmarks
        const idleBookmarks = bookmarks.filter(b => !runningPaths.has(b.path));
        if (states.length > 0 && idleBookmarks.length > 0)
            this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        for (const bm of idleBookmarks)
            this.menu.addMenuItem(this._buildIdleBookmarkItem(bm));

        if (states.length === 0 && bookmarks.length === 0)
            this.menu.addMenuItem(new PopupMenu.PopupMenuItem('No servers running', { reactive: false }));

        if (states.length > 1) {
            this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
            const stopAll = new PopupMenu.PopupMenuItem('Stop all servers');
            stopAll.connect('activate', () => this._run(['--stop']));
            this.menu.addMenuItem(stopAll);
        }

        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        const panelItem = new PopupMenu.PopupMenuItem('Open control panel');
        panelItem.connect('activate', () => this._run(['--panel']));
        this.menu.addMenuItem(panelItem);
    }

    _buildRunningItem(name, state) {
        const item = new PopupMenu.PopupBaseMenuItem();
        item.set_accessible_name(`Open ${name} in browser`);
        const url = `https://127.0.0.1:${state.port}`;

        const linkIcon = new St.Icon({
            icon_name: 'web-browser-symbolic',
            icon_size: 14,
            style_class: 'usher-link-icon',
        });
        const label = new St.Label({
            text: `${name} :${state.port}`,
            x_expand: true,
        });
        const stopBtn = new St.Button({
            style_class: 'usher-stop-button',
            child: new St.Icon({
                icon_name: 'process-stop-symbolic',
                icon_size: 16,
            }),
        });
        stopBtn.set_accessible_name('Stop server');

        item.add_child(linkIcon);
        item.add_child(label);
        item.add_child(stopBtn);

        item.connect('activate', () => this._openUri(url));
        stopBtn.connect('clicked', () => {
            this._run(['--stop', String(state.port)]);
            this.menu.close();
        });

        return item;
    }

    _buildIdleBookmarkItem(bm) {
        const item = new PopupMenu.PopupBaseMenuItem();
        const label = new St.Label({ text: bm.name, x_expand: true });
        const goBtn = new St.Button({
            style_class: 'usher-go-button',
            child: new St.Icon({
                icon_name: 'media-playback-start-symbolic',
                icon_size: 16,
            }),
        });
        goBtn.set_accessible_name(`Start ${bm.name}`);

        item.add_child(label);
        item.add_child(goBtn);

        item.connect('activate', () => this._run([bm.path]));
        goBtn.connect('clicked', () => {
            this._run([bm.path]);
            this.menu.close();
        });

        return item;
    }

    _openUri(uri) {
        const cmd = this._settings.get_string('browser-command').trim();
        if (cmd) {
            try {
                const [ok, argv] = GLib.shell_parse_argv(`${cmd} ${GLib.shell_quote(uri)}`);
                if (ok) Gio.Subprocess.new(argv, Gio.SubprocessFlags.NONE);
            } catch (e) {
                console.error(`usher: failed to launch browser "${cmd}": ${e}`);
            }
        } else {
            try {
                const ctx = global.create_app_launch_context(0, -1);
                Gio.AppInfo.launch_default_for_uri(uri, ctx);
            } catch (e) {
                console.error(`usher: failed to open ${uri}: ${e}`);
            }
        }
    }

    _run(args) {
        try {
            Gio.Subprocess.new([findUsher(), ...args], Gio.SubprocessFlags.NONE);
        } catch (e) {
            console.error(`usher: failed to run usher ${args.join(' ')}: ${e}`);
        }
    }

    destroy() {
        if (this._monitor) {
            this._monitor.disconnect(this._monitorId);
            this._monitor.cancel();
            this._monitor = null;
        }
        super.destroy();
    }
});

export default class UsherExtension extends Extension {
    enable() {
        this._indicator = new UsherIndicator(this.getSettings());
        Main.panel.addToStatusArea('usher', this._indicator);
    }

    disable() {
        this._indicator?.destroy();
        this._indicator = null;
    }
}
