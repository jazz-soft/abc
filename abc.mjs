import {EditorView, basicSetup} from "codemirror";
import {Decoration, hoverTooltip} from "@codemirror/view";
import {StateField, StateEffect} from "@codemirror/state";
import {autocompletion} from "@codemirror/autocomplete";
import ABC from "jazz-abc";

const theme = EditorView.baseTheme({
  ".cm-ttip": { fontFamily: "sans-serif", fontSize: "x-small", padding: ".2em", color: "blue" },
  ".cm-ttip-err": { fontFamily: "sans-serif", fontSize: "x-small", padding: ".2em", color: "red" },
  ".cm-field": { color: "blue", fontWeight: "bold" },
  ".cm-pseudo": { color: "darkturquoise", fontWeight: "bold" },
  ".cm-symbol": { color: "magenta" },
  ".cm-quoted": { color: "limegreen" },
  ".cm-enum": { color: "blue" },
  ".cm-comment": { color: "green", fontStyle: "italic" },
  ".cm-free": { color: "darkgray" },
  ".cm-err": { textDecoration: "underline wavy red", textUnderlineOffset: ".21em" }
});

const fieldMark = Decoration.mark({class: "cm-field"});
const pseudoMark = Decoration.mark({class: "cm-pseudo"});
const symbolMark = Decoration.mark({class: "cm-symbol"});
const quotedMark = Decoration.mark({class: "cm-quoted"});
const enumMark = Decoration.mark({class: "cm-enum"});
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
const decorator = StateField.define({
  create() { return Decoration.set([]); },
  update(val, tr) {
    var i, j, k, n, s, t, ln, mark, from, to;
    if (!tr.docChanged) return val;
    const data = tr.state.field(parser).tokens;
    const dec = [];
    for (k = 0; k < data.length; k++) {
      ln = data[k];
      n = tr.state.doc.line(k + 1).from;
      j = 0;
      for (i = 0; i < ln.length; i++) {
        t = ln[i];
        from = n + t.c;
        to = from + len(t);
        if (t.t) {
          mark = t.t[1] == ':' ? fieldMark : {
            '%': commentMark, '%%': pseudoMark, '!!': symbolMark, '""': quotedMark,
            '$$': enumMark, 'Kt': enumMark, 'Km': enumMark, '??': freeMark
          }[t.t];
          if (mark) dec.push(mark.range(from, to));
        }
        if (t.e && i >= j) {
          s = t.e;
          for (j = i + 1; j < ln.length; j++) {
            t = ln[j];
            if (t.e != s) break;
            to = n + t.c + len(t);
          }
          dec.push(errMark.range(from, to));
        }
      }
    }
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
  else if (t0 == t1 && t1.t == '!!') {
    s = ABC.Parser.symbolDet(t1.x);
    from = line.from + t1.c;
    to = line.from + t1.c + len(t1);
  }
  else if (t0 == t1 && t1.t == '%%') {
    s = ABC.Parser.pseudoDet(t1.x);
    from = line.from + t1.c;
    to = line.from + t1.c + len(t1);
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

const defHeader = '%abc';
const defTune = '\n\nX:1\nT:untitled\nM:4/4\nL:1/8\nK:C\n';

function AbcEditor(where) {
  var self = JZZ.Widget();
  self.editor = new EditorView({
    extensions: [basicSetup, theme, parser, decorator, watcher, autocomplete, tooltip],
    parent: document.getElementById(where)
  });
  self.setText = function(txt) {
    this.editor.dispatch(this.editor.state.update({changes: {
      from: 0, to: this.editor.state.doc.length, insert: txt}, selection: {anchor: 0}
    }));
  };
  self._receive = function(msg) {
    if (!msg.isNoteOn()) return;
    var last = -1;
    var tune = false;
    var txt;
    var data = this.editor.state.field(parser).tokens;
    for (var a of data) {
      if (a.length) {
        last = a[0].l;
        if (a[0].t == 'X:') { tune = true; break; }
      }
    }
    if (last == -1) {
      txt = defHeader + defTune + ABC.Parser.m2n(msg.getNote());
      this.editor.dispatch(this.editor.state.update({
        changes: { from: 0, to: this.editor.state.doc.length, insert: txt },
        selection: { anchor: txt.length }
      }));
    }
    else if (!tune) {
      txt = defTune + ABC.Parser.m2n(msg.getNote());
      last = this.editor.state.doc.line(last + 1).to;
      this.editor.dispatch(this.editor.state.update({
        changes: { from: last, to: this.editor.state.doc.length, insert: txt },
        selection: { anchor: last + txt.length }
      }));
    }
    else {
      var sel = this.editor.state.selection.ranges[0];
      var line = this.editor.state.doc.lineAt(sel.from);
      if (line.number != this.editor.state.doc.lineAt(sel.to).number) return;
      var ln = data[line.number - 1];
      if (!ln || !ln.length || ln[0].t != '!?') return;
      var from = sel.from - line.from;
      var to = sel.to - line.from;
      var key, x0, x1;
      for (var x of ln) {
        if (x.c <= from && x.t == '!?') key = ABC.Parser.getKey(x);
        if (x.c < from && x.c + len(x) > from) x0 = x;
        if (x.c < to && x.c + len(x) > to) x1 = x;
      }
      if (x0) from = x0.c;
      if (x1) to = x1.c + len(x1);
      txt = ABC.Parser.m2n(msg.getNote(), key);
      from += line.from;
      to += line.from;
      this.editor.dispatch(this.editor.state.update({
        changes: { from: from, to: to, insert: txt },
        selection: { anchor: from + txt.length }
      }));
    }
  };
  return self;
}

window.AbcEditor = AbcEditor;
