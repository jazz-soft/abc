import {EditorView, basicSetup} from "codemirror";
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

let watcher = EditorView.updateListener.of((update) => {
  if (update.docChanged) {
    //console.log('!');
  }
});

let editor = new EditorView({
  extensions: [basicSetup, watcher],
  parent: document.body
})

widget._receive = function(msg) {
  if (!msg.isNoteOn()) return;
};

function tokenize(s) {
  var p = new TAB.Parser(s);
  return p.tok;
}
