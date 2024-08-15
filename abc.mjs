import {EditorView, basicSetup} from "codemirror";
import {Decoration, ViewPlugin} from "@codemirror/view";
import {StateField} from "@codemirror/state";

import JZZ from "jzz";
import ABC from "jazz-abc";
import SEL from "jzz-gui-select";
import KBD from "jzz-input-kbd";
import TINY from "jzz-synth-tiny";
SEL(JZZ);
KBD(JZZ);
TINY(JZZ);

JZZ.synth.Tiny.register('Web Audio');
var midi_in = JZZ.gui.SelectMidiIn({ at: 'select_midi_in' });
var midi_out = JZZ.gui.SelectMidiOut({ at: 'select_midi_out' });
var piano = JZZ.input.Kbd({ at: "piano" });
var widget = JZZ.Widget();

midi_in.connect(piano);
piano.connect(midi_out);
piano.connect(widget);
widget.connect(piano);
midi_in.select();
midi_out.select();

const theme = EditorView.baseTheme({
  ".cm-comment": { textDecoration: "underline 3px red" }
});

const commentMark = Decoration.mark({class: "cm-comment"});

const watcher = EditorView.updateListener.of((update) => {
  if (update.docChanged) {
  }
});

const decorator = StateField.define({
  create() {
    return Decoration.set([]);
  },
  update(val, tr) {
    if (!tr.docChanged) return val;
    return Decoration.set([
      commentMark.range(0, 1)
    ]);
  },
  provide: (x) => EditorView.decorations.from(x)
});

let editor = new EditorView({
  extensions: [basicSetup, theme, watcher, decorator],
  parent: document.body
})

widget._receive = function(msg) {
  if (!msg.isNoteOn()) return;
};

function tokenize(s) {
  var p = new TAB.Parser(s);
  return p.tok;
}
