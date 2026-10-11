// Inline TeX ($...$) → styled text runs (Unicode + italics + sub/superscripts).
// Display equations use MathJax vector output instead; this keeps inline math flowing in text.

export interface MathRun {
  text: string;
  italic?: boolean;
  bold?: boolean;
  upright?: boolean; // text font instead of math font
  level?: number; // script depth (0 = baseline)
  va?: 'super' | 'sub';
}

const GREEK: Record<string, string> = {
  alpha: 'α', beta: 'β', gamma: 'γ', delta: 'δ', epsilon: 'ϵ', varepsilon: 'ε', zeta: 'ζ', eta: 'η', theta: 'θ', vartheta: 'ϑ', iota: 'ι', kappa: 'κ', lambda: 'λ', mu: 'μ', nu: 'ν', xi: 'ξ', omicron: 'ο', pi: 'π', varpi: 'ϖ', rho: 'ρ', varrho: 'ϱ', sigma: 'σ', varsigma: 'ς', tau: 'τ', upsilon: 'υ', phi: 'ϕ', varphi: 'φ', chi: 'χ', psi: 'ψ', omega: 'ω',
  Gamma: 'Γ', Delta: 'Δ', Theta: 'Θ', Lambda: 'Λ', Xi: 'Ξ', Pi: 'Π', Sigma: 'Σ', Upsilon: 'Υ', Phi: 'Φ', Psi: 'Ψ', Omega: 'Ω',
};
const SYM: Record<string, string> = {
  cdot: '·', cdotp: '·', times: '×', div: '÷', pm: '±', mp: '∓', leq: '≤', le: '≤', geq: '≥', ge: '≥', neq: '≠', ne: '≠', approx: '≈', sim: '∼', simeq: '≃', cong: '≅', equiv: '≡', propto: '∝',
  infty: '∞', partial: '∂', nabla: '∇', int: '∫', iint: '∬', iiint: '∭', oint: '∮', sum: '∑', prod: '∏', to: '→', rightarrow: '→', leftarrow: '←', gets: '←', Rightarrow: '⇒', Leftarrow: '⇐', implies: '⇒', iff: '⇔',
  Leftrightarrow: '⇔', leftrightarrow: '↔', mapsto: '↦', uparrow: '↑', downarrow: '↓', rightleftharpoons: '⇌', longrightarrow: '⟶', degree: '°', circ: '∘', prime: '′', angle: '∠', perp: '⊥', parallel: '∥',
  hbar: 'ℏ', ell: 'ℓ', in: '∈', notin: '∉', subset: '⊂', subseteq: '⊆', supset: '⊃', cup: '∪', cap: '∩', forall: '∀', exists: '∃', emptyset: '∅', varnothing: '∅', langle: '⟨', rangle: '⟩', '|': '‖', Vert: '‖', vert: '|', mid: '|',
  ldots: '…', cdots: '⋯', dots: '…', vdots: '⋮', star: '⋆', ast: '∗', dagger: '†', otimes: '⊗', oplus: '⊕', ll: '≪', gg: '≫', lt: '<', gt: '>', neg: '¬', land: '∧', lor: '∨', wedge: '∧', vee: '∨', therefore: '∴', because: '∵',
  AA: 'Å', aleph: 'ℵ', Re: 'ℜ', Im: 'ℑ', bullet: '•', triangle: '△', square: '□', checkmark: '✓', '%': '%', $: '$', '{': '{', '}': '}', _: '_', '&': '&', '#': '#', lbrace: '{', rbrace: '}', lvert: '|', rvert: '|',
  quad: '\u2003', qquad: '\u2003\u2003', ',': '\u2006', ';': '\u2005', ':': '\u2005', '!': '', ' ': ' ', enspace: '\u2000', thinspace: '\u2006',
};
const FUNCS = new Set(['sin', 'cos', 'tan', 'sec', 'csc', 'cot', 'arcsin', 'arccos', 'arctan', 'sinh', 'cosh', 'tanh', 'log', 'ln', 'exp', 'lim', 'max', 'min', 'det', 'sup', 'inf', 'arg', 'deg', 'dim', 'ker', 'Pr', 'gcd', 'mod', 'Tr', 'tr', 'sgn']);
const BB: Record<string, string> = { R: 'ℝ', N: 'ℕ', Z: 'ℤ', Q: 'ℚ', C: 'ℂ', P: 'ℙ' };
const SPACED_BIN = new Set(['+', '−', '=', '<', '>', '≤', '≥', '≠', '≈', '∼', '≃', '≡', '∝', '×', '÷', '±', '∓', '→', '←', '⇒', '⇔', '↔', '⟶', '⇌', '·', '∈', '⊂', '∪', '∩', '≪', '≫', '≅', '↦', '⊗', '⊕', '∧', '∨']);

type Node =
  | { k: 'char'; c: string }
  | { k: 'cmd'; name: string }
  | { k: 'group'; body: Node[] };

function parse(src: string): Node[] {
  let i = 0;
  function seq(stop?: string): Node[] {
    const out: Node[] = [];
    while (i < src.length) {
      const c = src[i];
      if (stop && c === stop) {
        i++;
        return out;
      }
      if (c === '{') {
        i++;
        out.push({ k: 'group', body: seq('}') });
      } else if (c === '\\') {
        i++;
        const m = /^([A-Za-z]+|.)/.exec(src.slice(i));
        const name = m ? m[0] : '';
        i += name.length;
        out.push({ k: 'cmd', name });
        if (/^[A-Za-z]/.test(name)) while (src[i] === ' ') i++;
      } else {
        out.push({ k: 'char', c });
        i++;
      }
    }
    return out;
  }
  return seq();
}

interface St {
  italic: boolean;
  bold: boolean;
  upright: boolean;
  level: number;
  va?: 'super' | 'sub';
  chem?: boolean;
}

const plain = (n: Node[]): string =>
  n.map((x) => (x.k === 'char' ? x.c : x.k === 'group' ? plain(x.body) : GREEK[x.name] ?? SYM[x.name] ?? (FUNCS.has(x.name) ? x.name : ''))).join('');

function isSimple(nodes: Node[]): boolean {
  const flat = nodes.length === 1 && nodes[0].k === 'group' ? nodes[0].body : nodes;
  const s = plain(flat);
  return /^[\p{L}\p{N}.′]+$/u.test(s) && flat.every((n) => n.k !== 'cmd' || GREEK[n.name] || SYM[n.name] || FUNCS.has(n.name));
}

function convert(nodes: Node[], st: St, out: MathRun[]) {
  const push = (text: string, o: Partial<St> & { italic?: boolean } = {}) => {
    if (!text) return;
    const s = { ...st, ...o };
    out.push({ text, italic: s.italic, bold: s.bold, upright: s.upright, level: s.level, va: s.va });
  };
  const lastText = () => {
    for (let j = out.length - 1; j >= 0; j--) if (out[j].text.trim()) return out[j].text.trim().slice(-1);
    return '';
  };
  const bin = (sym: string) => {
    const prev = lastText();
    const unary = (sym === '−' || sym === '+' || sym === '±') && (!prev || SPACED_BIN.has(prev) || '([{,'.includes(prev));
    if (unary || st.level > 0) push(sym, { italic: false });
    else push(`\u2005${sym}\u2005`, { italic: false });
  };
  const arg = (j: number): [Node[], number] => {
    const n = nodes[j];
    if (!n) return [[], j];
    if (n.k === 'group') return [n.body, j];
    return [[n], j];
  };
  for (let j = 0; j < nodes.length; j++) {
    const n = nodes[j];
    if (n.k === 'group') {
      convert(n.body, st, out);
      continue;
    }
    if (n.k === 'char') {
      const c = n.c;
      if (c === '^' || c === '_') {
        const [a, nj] = arg(j + 1);
        j = nj;
        // ^\circ → degree sign; ^\prime → prime
        if (c === '^' && a.length === 1 && a[0].k === 'cmd' && (a[0].name === 'circ' || a[0].name === 'degree')) {
          push('°', { italic: false });
          continue;
        }
        if (c === '^' && a.length === 1 && a[0].k === 'cmd' && a[0].name === 'prime') {
          push('′', { italic: false });
          continue;
        }
        convert(a, { ...st, level: st.level + 1, va: c === '^' ? 'super' : 'sub' }, out);
        continue;
      }
      if (c === "'") {
        push('′', { italic: false });
        continue;
      }
      if (c === '-' ) {
        if (st.chem && nodes[j + 1]?.k === 'char' && (nodes[j + 1] as { c: string }).c === '>') {
          j++;
          bin('→');
        } else bin('−');
        continue;
      }
      if (c === '<' && st.chem && plain(nodes.slice(j, j + 3)) === '<=>') {
        j += 2;
        bin('⇌');
        continue;
      }
      if ('+=<>'.includes(c)) {
        bin(c);
        continue;
      }
      if (c === '*') {
        push('∗', { italic: false });
        continue;
      }
      if (c === ',') {
        push(st.level ? ',' : ',\u2006', { italic: false });
        continue;
      }
      if (c === '~') {
        push(' ');
        continue;
      }
      if (c === ' ') {
        if (st.upright) push(' ');
        continue;
      }
      if (/[A-Za-z]/.test(c)) {
        if (st.chem) {
          push(c, { italic: false, upright: false });
          // digits right after an element symbol become subscripts
          let k = j + 1;
          let digits = '';
          while (nodes[k]?.k === 'char' && /\d/.test((nodes[k] as { c: string }).c)) digits += (nodes[k++] as { c: string }).c;
          if (digits) {
            push(digits, { italic: false, level: st.level + 1, va: 'sub' });
            j = k - 1;
          }
          continue;
        }
        push(c, { italic: st.upright ? st.italic : !st.bold || st.italic ? true : false });
        continue;
      }
      push(c, { italic: st.upright ? st.italic : false });
      continue;
    }
    // commands
    const name = n.name;
    if (GREEK[name]) {
      push(GREEK[name], { italic: !st.upright && /^[a-z]/.test(name) && !st.bold });
      continue;
    }
    if (name in SYM) {
      const s = SYM[name];
      if (SPACED_BIN.has(s)) bin(s);
      else push(s, { italic: false });
      continue;
    }
    if (FUNCS.has(name)) {
      const prev = lastText();
      push((prev && /[\p{L}\p{N})]/u.test(prev) ? '\u2006' : '') + name + '\u2006', { italic: false });
      continue;
    }
    switch (name) {
      case 'frac':
      case 'dfrac':
      case 'tfrac':
      case 'cfrac': {
        const [a, j1] = arg(j + 1);
        const [b, j2] = arg(j1 + 1);
        j = j2;
        const sa = isSimple(a);
        const sb = isSimple(b);
        if (!sa) push('(', { italic: false });
        convert(a, st, out);
        if (!sa) push(')', { italic: false });
        push('/', { italic: false });
        if (!sb) push('(', { italic: false });
        convert(b, st, out);
        if (!sb) push(')', { italic: false });
        break;
      }
      case 'sqrt': {
        let idx: Node[] | null = null;
        let k = j + 1;
        if (nodes[k]?.k === 'char' && (nodes[k] as { c: string }).c === '[') {
          idx = [];
          k++;
          while (nodes[k] && !(nodes[k].k === 'char' && (nodes[k] as { c: string }).c === ']')) idx.push(nodes[k++]);
          k++;
        }
        const [a, j1] = arg(k);
        j = j1;
        if (idx) convert(idx, { ...st, level: st.level + 1, va: 'super' }, out);
        const simple = isSimple(a);
        push('√' + (simple ? '' : '('), { italic: false });
        convert(a, st, out);
        if (!simple) push(')', { italic: false });
        break;
      }
      case 'vec':
      case 'mathbf':
      case 'bm':
      case 'boldsymbol':
      case 'textbf': {
        const [a, j1] = arg(j + 1);
        j = j1;
        convert(a, { ...st, bold: true, italic: name === 'boldsymbol' || name === 'bm', upright: name === 'textbf' ? true : st.upright }, out);
        break;
      }
      case 'hat':
      case 'bar':
      case 'overline':
      case 'dot':
      case 'ddot':
      case 'tilde':
      case 'widehat': {
        const [a, j1] = arg(j + 1);
        j = j1;
        convert(a, st, out);
        const mark = name === 'dot' ? '\u0307' : name === 'ddot' ? '\u0308' : name === 'bar' || name === 'overline' ? '\u0304' : name === 'tilde' ? '\u0303' : '\u0302';
        if (out.length) out[out.length - 1].text += mark;
        break;
      }
      case 'text':
      case 'textrm':
      case 'mathrm':
      case 'operatorname':
      case 'textnormal':
      case 'mbox':
      case 'rm':
      case 'unit':
      case 'si': {
        const [a, j1] = arg(j + 1);
        j = j1;
        convert(a, { ...st, upright: true, italic: false }, out);
        break;
      }
      case 'textit':
      case 'mathit':
      case 'emph': {
        const [a, j1] = arg(j + 1);
        j = j1;
        convert(a, { ...st, upright: true, italic: true }, out);
        break;
      }
      case 'mathbb': {
        const [a, j1] = arg(j + 1);
        j = j1;
        const s = plain(a);
        push(s.split('').map((ch) => BB[ch] ?? ch).join(''), { italic: false });
        break;
      }
      case 'mathcal':
      case 'mathscr': {
        const [a, j1] = arg(j + 1);
        j = j1;
        convert(a, { ...st, italic: true }, out);
        break;
      }
      case 'ce': {
        const [a, j1] = arg(j + 1);
        j = j1;
        convert(a, { ...st, chem: true, italic: false }, out);
        break;
      }
      case 'degree':
      case 'deg':
        push('°', { italic: false });
        break;
      case 'left':
      case 'right':
      case 'big':
      case 'Big':
      case 'bigg':
      case 'Bigg':
      case 'bigl':
      case 'bigr':
      case 'Bigl':
      case 'Bigr':
      case 'displaystyle':
      case 'textstyle':
      case 'limits':
      case 'nolimits': {
        const nx = nodes[j + 1];
        if ((name === 'left' || name === 'right') && nx?.k === 'char' && nx.c === '.') j++;
        break;
      }
      case 'boxed':
      case 'underline':
      case 'mathsf':
      case 'mathtt':
      case 'pmb':
      case 'cancel': {
        const [a, j1] = arg(j + 1);
        j = j1;
        convert(a, st, out);
        break;
      }
      case 'color':
      case 'textcolor': {
        // ignore colour, keep content
        const [, j1] = arg(j + 1);
        j = j1;
        break;
      }
      case '\\':
        push('  ');
        break;
      default:
        push(name, { italic: false, upright: true });
    }
  }
}

const cache = new Map<string, MathRun[]>();

export function texToRuns(tex: string): MathRun[] {
  const hit = cache.get(tex);
  if (hit) return hit;
  const out: MathRun[] = [];
  try {
    convert(parse(tex.trim()), { italic: true, bold: false, upright: false, level: 0 }, out);
  } catch {
    out.length = 0;
    out.push({ text: tex });
  }
  // merge adjacent runs with identical style
  const merged: MathRun[] = [];
  for (const r of out) {
    const p = merged[merged.length - 1];
    if (p && p.italic === r.italic && p.bold === r.bold && p.upright === r.upright && p.level === r.level && p.va === r.va) p.text += r.text;
    else merged.push({ ...r });
  }
  if (cache.size > 2000) cache.clear();
  cache.set(tex, merged);
  return merged;
}

/** Rough plain-text rendering (for widths, chat previews, accessibility). */
export function texToPlain(tex: string): string {
  return texToRuns(tex)
    .map((r) => (r.va === 'super' ? '^' + r.text : r.va === 'sub' ? '_' + r.text : r.text))
    .join('');
}
