import Adw from 'gi://Adw';
import { ExtensionPreferences } from 'resource:///org/gnome/shell/extensions/prefs.js';

export default class UsherPreferences extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        const settings = this.getSettings();

        const page = new Adw.PreferencesPage();
        const group = new Adw.PreferencesGroup({
            title: 'Browser',
            description: 'Leave blank to use the system default browser. ' +
                         'The URL is appended as the final argument.',
        });

        const row = new Adw.EntryRow({
            title: 'Browser command',
            text: settings.get_string('browser-command'),
        });
        row.connect('notify::text', () => {
            settings.set_string('browser-command', row.get_text());
        });

        group.add(row);
        page.add(group);
        window.add(page);
    }
}
