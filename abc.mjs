import {EditorView, basicSetup} from "codemirror";
import {Decoration, hoverTooltip} from "@codemirror/view";
import {StateField, StateEffect} from "@codemirror/state";
import {autocompletion} from "@codemirror/autocomplete";
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
  ".cm-ttip": { fontFamily: "sans-serif", fontSize: "x-small", padding: ".2em" },
  ".cm-field": { color: "blue", fontWeight: "bold" },
  ".cm-pseudo": { color: "darkturquoise", fontWeight: "bold" },
  ".cm-comment": { color: "green", fontStyle: "italic" },
  ".cm-free": { color: "gray" }
});

const fieldMark = Decoration.mark({class: "cm-field"});
const pseudoMark = Decoration.mark({class: "cm-pseudo"});
const commentMark = Decoration.mark({class: "cm-comment"});
const freeMark = Decoration.mark({class: "cm-free"});

const watcher = EditorView.updateListener.of((update) => {
  if (update.docChanged) {
    //console.log(update.state.field(parser));
  }
});

const parser = StateField.define({
  create() { return new ABC.Parser(''); },
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
  else if (t.t == '??') mark = freeMark;
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

const pseudo = [];
for (var x of ABC.Parser.pseudo()) {
  var opt = { label: '%%' + x.name, apply: '%%' + x.name + ' ' };
  if (x.det) opt.detail = '(' + x.det + ')';
  pseudo.push(opt);
}

const details = { '%:': 'ABC file header' };
const fields = ABC.Parser.fields();
for (var x of fields) if (x.det) details[x.name + ':'] = x.det;

const autocomplete = autocompletion({ filterStrict: true, override: [(context) => {
  var match;
  var sel = context.state.selection.ranges[0];
  var line = context.state.doc.lineAt(sel.to);
  if (sel.to == line.to) {
    if (line.number == 1) {
      match = context.matchBefore(/^%\w*/);
      if (match) return { from: match.from, options: [{ label: '%abc', detail: '(ABC file header)' }] };
      match = context.matchBefore(/^%abc-.*/);
      if (match) return { from: match.from, options: [{ label: '%abc-2.2' }] };
    }
    match = context.matchBefore(/^%%\S*/);
    if (match) return { from: match.from, options: pseudo };
  }
  return null;
}]});

const tooltip = hoverTooltip((view, pos, side) => {
  const line = view.state.doc.lineAt(pos);
  const ln = view.state.field(parser).tokens[line.number - 1];
  if (!ln || !ln.length) return null;
  var t = ln[0].t;
  var txt = details[t];
  if (!txt) return null;
  return {
    pos: line.from,
    end: line.to,
    above: true,
    create(view) {
      var dom = document.createElement("div");
      dom.className = "cm-ttip";
      dom.textContent = txt;
      return {dom}
    }
  }
})

let editor = new EditorView({
  extensions: [basicSetup, theme, parser, decorator, watcher, autocomplete, tooltip],
  parent: document.body
})

const defHeader = '%abc';
const defTune = '\n\nX:1\nT:untitled\nL:1/4\nK:C\n';

widget._receive = function(msg) {
  if (!msg.isNoteOn()) return;
  var last = -1;
  var tune = false;
  var txt;
  for (var a of editor.state.field(parser).tokens) {
    if (a.length) {
      last = a[0].l;
      if (a[0].t == 'X:') { tune = true; break; }
    }
  }
  if (last == -1) {
    txt = defHeader + defTune + m2n(msg.getNote());
    editor.dispatch(editor.state.update({changes: {
      from: 0, to: editor.state.doc.length, insert: txt}, selection: {anchor: txt.length}
    }));
  }
  else if (!tune) {
    txt = defTune + m2n(msg.getNote());
    last = editor.state.doc.line(last + 1).to;
    editor.dispatch(editor.state.update({changes: {
      from: last, to: editor.state.doc.length, insert: txt}, selection: {anchor: last + txt.length}
    }));
  }
};

function m2n(m, k) {
  var n = m % 12;
  var t = (m - n) / 12;
  var i, s;
  if (!k) {
    s = ['C', '^C', 'D', '_E', 'E', 'F', '^F', 'G', '_A', 'A', '_B', 'B'][n];
  }
  if (t > 5) s = s.toLowerCase();
  for (i = t; i < 5; i++) s += ',';
  for (i = 6; i < t; i++) s += "'";
  return s;
}