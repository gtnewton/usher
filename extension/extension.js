import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import St from 'gi://St';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';

const RUN_DIR_PATH = `${GLib.get_user_runtime_dir()}/usher`;

function findUsher() {
    return GLib.find_program_in_path('usher') ??
        `${GLib.get_home_dir()}/.local/bin/usher`;
}

class UsherIndicator extends PanelMenu.Button {
    constructor() {
        super(0.0, 'Usher', false);

        const box = new St.BoxLayout({ style_class: 'panel-status-menu-box' });
        this._icon = new St.Icon({
            icon_name: 'network-server-symbolic',
            style_class: 'system-status-icon',
        });
        this._countLabel = new St.Label({
            text: '',
            style_class: 'usher-count-label',
            y_expand: true,
            y_align: 1, // FILL
        });
        box.add_child(this._icon);
        box.add_child(this._countLabel);
        this.add_child(box);

        // Ensure the run dir exists so the monitor has something to watch.
        GLib.mkdir_with_parents(RUN_DIR_PATH, 0o700);
        this._setupMonitor();
        this._rebuild();
    }

    _setupMonitor() {
        const dir = Gio.File.new_for_path(RUN_DIR_PATH);
        this._monitor = dir.monitor_directory(Gio.FileMonitorFlags.NONE, null);
        this._monitorId = this._monitor.connect('changed', (_m, _f, _of, event) => {
            // Rebuild once writes are complete or files appear/disappear.
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
                } catch (_e) { /* skip unreadable or mid-write files */ }
            }
        } catch (_e) { /* dir not yet created */ }
        return states.sort((a, b) => a.port - b.port);
    }

    _rebuild() {
        this.menu.removeAll();
        const states = this._readStates();

        if (states.length === 0) {
            this._countLabel.set_text('');
            this._icon.add_style_class_name('usher-inactive');

            this.menu.addMenuItem(
                new PopupMenu.PopupMenuItem('No servers running', { reactive: false }));
        } else {
            this._countLabel.set_text(` ${states.length}`);
            this._icon.remove_style_class_name('usher-inactive');

            for (const state of states) {
                const url = `https://127.0.0.1:${state.port}`;
                const basename = (state.root ?? '')
                    .split('/').filter(Boolean).pop() ?? state.root ?? '';

                const urlItem = new PopupMenu.PopupMenuItem(`${url}  —  ${basename}`);
                urlItem.connect('activate', () => this._openUri(url));
                this.menu.addMenuItem(urlItem);

                const stopItem = new PopupMenu.PopupMenuItem(`    Stop :${state.port}`);
                stopItem.connect('activate', () => this._run(['--stop', String(state.port)]));
                this.menu.addMenuItem(stopItem);
            }

            if (states.length > 1) {
                this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
                const stopAll = new PopupMenu.PopupMenuItem('Stop all servers');
                stopAll.connect('activate', () => this._run(['--stop']));
                this.menu.addMenuItem(stopAll);
            }
        }

        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        const panelItem = new PopupMenu.PopupMenuItem('Open control panel');
        panelItem.connect('activate', () => this._run([]));
        this.menu.addMenuItem(panelItem);
    }

    _openUri(uri) {
        try {
            const ctx = global.create_app_launch_context(0, -1);
            Gio.AppInfo.launch_default_for_uri(uri, ctx);
        } catch (e) {
            console.error(`usher: failed to open ${uri}: ${e}`);
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
}

export default class UsherExtension {
    enable() {
        this._indicator = new UsherIndicator();
        Main.panel.addToStatusArea('usher', this._indicator);
    }

    disable() {
        this._indicator?.destroy();
        this._indicator = null;
    }
}
