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
  ".cm-ttip": { fontFamily: "sans-serif", fontSize: "x-small", padding: ".2em", color: "blue" },
  ".cm-ttip-err": { fontFamily: "sans-serif", fontSize: "x-small", padding: ".2em", color: "red" },
  ".cm-field": { color: "blue", fontWeight: "bold" },
  ".cm-pseudo": { color: "darkturquoise", fontWeight: "bold" },
  ".cm-comment": { color: "green", fontStyle: "italic" },
  ".cm-free": { color: "gray" },
  ".cm-err": { textDecoration: "underline wavy red", textUnderlineOffset: ".21em" }
});

const fieldMark = Decoration.mark({class: "cm-field"});
const pseudoMark = Decoration.mark({class: "cm-pseudo"});
const commentMark = Decoration.mark({class: "cm-comment"});
const freeMark = Decoration.mark({class: "cm-free"});
const errMark = Decoration.mark({class: "cm-err"});

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

function len(t) { return t.x.length; }
function decorate(a, d, t) {
  var mark, from, to;
  if (t.t) {
    if (t.t[1] == ':') mark = fieldMark;
    else if (t.t == '%') mark = commentMark;
    else if (t.t == '%%') mark = pseudoMark;
    else if (t.t == '??') mark = freeMark;
  }
  if (mark || t.e) {
    from = d.line(t.l + 1).from + t.c;
    to = from + len(t);
  }
  if (mark) a.push(mark.range(from, to));
  if (t.e) a.push(errMark.range(from, to));
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

const details = { '%:': 'ABC file header' };
const fields = ABC.Parser.fields();
for (var x of fields) if (x.det) details[x.name + ':'] = x.det;

const pseudo = [];
for (var x of ABC.Parser.pseudo()) {
  var opt = { label: '%%' + x.name, apply: '%%' + x.name + ' ' };
  if (x.det) {
    opt.detail = '(' + x.det + ')';
    details['%%' + x.name] = x.det;
  }
  pseudo.push(opt);
}

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
  var i, k, n, t, t0, t1, s, from, to;
  const line = view.state.doc.lineAt(pos);
  const ln = view.state.field(parser).tokens[line.number - 1];
  if (!ln || !ln.length) return null;
  n = line.from;
  for (i = 0; i < ln.length; i++) {
    t = ln[i];
    if (pos >= n + t.c) {
      k = i;
      t0 = t;
    }
    if (pos < n + t.c + len(t)) {
      t1 = t;
      break;
    } 
  }
  if (!t1 || t1.t == '%') return null;
  if (t0.e && t0.e == t1.e) {
    s = t0.e;
    from = line.from + t0.c;
    to = line.from + t1.c + len(t1);
    for (i = k - 1; i >= 0; i--) {
      t = ln[i];
      if (t.e == s) from = line.from + t.c;
      else break;
    }
    for (i = k + 1; i < ln.length; i++) {
      t = ln[i];
      if (t.e == s) to = line.from + t.c + len(t);
      else break;
    }
  }
  else {
    for (i = k; i >= 0; i--) {
      t = ln[i];
      if (t.e) break;
      if (t.h) s = details[t.h];
      if (s) {
        from = line.from + t.c;
        to = line.from + t.c + len(t);
        break;
      } 
    }
    if (s) for (i = k; i < ln.length; i++) {
      t = ln[i];
      if (t.t == '%' || t.e) break;
      to = line.from + t.c + len(t);
    }
  }
  if (!s) return null;
  return {
    pos: from,
    end: to,
    above: true,
    create(view) {
      var dom = document.createElement("div");
      dom.className = t0.e ? "cm-ttip-err" : "cm-ttip";
      dom.textContent = s;
      return {dom}
    }
  }
})

let editor = new EditorView({
  extensions: [basicSetup, theme, parser, decorator, watcher, autocomplete, tooltip],
  parent: document.getElementById('editor')
})

const defHeader = '%abc';
const defTune = '\n\nX:1\nT:untitled\nM:4/4\nL:1/8\nK:C\n';

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
    txt = defHeader + defTune + ABC.Parser.m2n(msg.getNote());
    editor.dispatch(editor.state.update({changes: {
      from: 0, to: editor.state.doc.length, insert: txt}, selection: {anchor: txt.length}
    }));
  }
  else if (!tune) {
    txt = defTune + ABC.Parser.m2n(msg.getNote());
    last = editor.state.doc.line(last + 1).to;
    editor.dispatch(editor.state.update({changes: {
      from: last, to: editor.state.doc.length, insert: txt}, selection: {anchor: last + txt.length}
    }));
  }
};

window.setText = function(txt) {
  editor.dispatch(editor.state.update({changes: {
    from: 0, to: editor.state.doc.length, insert: txt}, selection: {anchor: 0}
  }));
}