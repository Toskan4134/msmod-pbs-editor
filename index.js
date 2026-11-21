import { PbsEditor, setI18n as setEditorI18n } from './editor.js';
import { setI18n as setComponentsI18n } from './components.js';
import es from './locales/es.js';

let _dialog = null;
let _editor = null;

function openPbsEditor(ctx) {
  if (_dialog) return;

  _dialog = ctx.ui.showCustomDialog({
    title: ctx.i18n.t('PBS Editor'),
    width: '92vw',
    height: '88vh',
    render(body) {
      _editor = new PbsEditor(ctx, body);
      return () => { _editor?.dispose(); _editor = null; _dialog = null; };
    },
    onCloseRequest: async () => {
      const editor = _editor;
      if (editor?.switching || editor?.saving) return;
      if (await editor?.confirmPending() && _editor === editor) _dialog?.close();
    },
  });
}

export function activate(ctx) {
  setEditorI18n((s, v) => ctx.i18n.t(s, v));
  setComponentsI18n((s, v) => ctx.i18n.t(s, v));

  ctx.i18n.addTranslations("es", es);

  ctx.menu.registerMenuItem({
    menu: 'Mods',
    label: ctx.i18n.t('Open PBS Editor'),
    shortcut: 'Ctrl+Shift+P',
    icon: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M4 1.5h5.5L13 5v9.5H4V1.5z"/><path d="M9.5 1.5V5H13"/><line x1="6" y1="7.5" x2="11" y2="7.5"/><line x1="6" y1="10" x2="11" y2="10"/><line x1="6" y1="12.5" x2="9" y2="12.5"/></svg>`,
    handler: () => openPbsEditor(ctx),
  });
}

export function deactivate() {
  if (_dialog) { _dialog.close(); _dialog = null; }
  _editor = null;
}
