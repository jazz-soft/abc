import {EditorView, basicSetup} from "codemirror";
import {Decoration, ViewPlugin} from "@codemirror/view";
import {StateField, StateEffect} from "@codemirror/state";
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
  ".cm-field": { color: "blue", fontWeight: "bold" },
  ".cm-pseudo": { color: "darkturquoise", fontWeight: "bold" },
  ".cm-comment": { color: "green", fontStyle: "italic" }
});

const fieldMark = Decoration.mark({class: "cm-field"});
const pseudoMark = Decoration.mark({class: "cm-pseudo"});
const commentMark = Decoration.mark({class: "cm-comment"});

const watcher = EditorView.updateListener.of((update) => {
  if (update.docChanged) {
    //console.log(update.state.field(parser));
  }
});

const parser = StateField.define({
  create() {},
  update(val, tr) {
    if (!tr.docChanged) return val;
    return new ABC.Parser(tr.state.doc.toString());
  }
});

function decorate(a, d, t) {
  if (t.t == undefined) return;
  var mark;
  if (t.t[1] == ':') mark = fieldMark;
  else if (t.t == '%') mark = commentMark;
  else if (t.t == '%%') mark = pseudoMark;
  if (mark) {
    var from = d.line(t.l + 1).from + t.c;
    var to = from + t.x.length;
    a.push(mark.range(from, to));
  }
}

const decorator = StateField.define({
  create() { return Decoration.set([]); },
  update(val, tr) {
    if (!tr.docChanged) return val;
    const data = tr.state.field(parser).tokens;
    const dec = [];
    for (var line of data) for (var token of line) decorate(dec, tr.state.doc, token);
    return Decoration.set(dec);
  },
  provide: (x) => EditorView.decorations.from(x)
});

let editor = new EditorView({
  extensions: [basicSetup, theme, parser, decorator, watcher],
  parent: document.body
})

widget._receive = function(msg) {
  if (!msg.isNoteOn()) return;
};
