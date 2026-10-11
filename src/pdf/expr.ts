// Safe math-expression compiler (no eval). Supports + - * / ^ (or **), unary minus,
// implicit multiplication (2x, 3(x+1), x sin(x)), constants and common functions.

export type Fn = (vars: Record<string, number>) => number;

const FUNCS: Record<string, (...a: number[]) => number> = {
  sin: Math.sin, cos: Math.cos, tan: Math.tan, asin: Math.asin, acos: Math.acos, atan: Math.atan, arcsin: Math.asin, arccos: Math.acos, arctan: Math.atan,
  sinh: Math.sinh, cosh: Math.cosh, tanh: Math.tanh, exp: Math.exp, ln: Math.log, log: Math.log10, log10: Math.log10, log2: Math.log2,
  sqrt: Math.sqrt, cbrt: Math.cbrt, abs: Math.abs, floor: Math.floor, ceil: Math.ceil, round: Math.round, sign: Math.sign, sgn: Math.sign,
  min: Math.min, max: Math.max, pow: Math.pow, atan2: Math.atan2, hypot: Math.hypot,
  sec: (x) => 1 / Math.cos(x), csc: (x) => 1 / Math.sin(x), cot: (x) => 1 / Math.tan(x),
  step: (x) => (x >= 0 ? 1 : 0), heaviside: (x) => (x >= 0 ? 1 : 0),
  sinc: (x) => (x === 0 ? 1 : Math.sin(x) / x),
  gauss: (x, mu = 0, s = 1) => Math.exp(-((x - mu) ** 2) / (2 * s * s)) / (s * Math.sqrt(2 * Math.PI)),
};
const CONSTS: Record<string, number> = { pi: Math.PI, π: Math.PI, e: Math.E, tau: 2 * Math.PI, inf: Infinity };

type Tok = { t: 'num'; v: number } | { t: 'id'; v: string } | { t: 'op'; v: string };

function lex(src: string): Tok[] {
  const s = src
    .replace(/\*\*/g, '^')
    .replace(/[·×⋅]/g, '*')
    .replace(/[−–]/g, '-')
    .replace(/÷/g, '/')
    .replace(/\\(left|right)/g, '')
    .replace(/\\(pi|sin|cos|tan|exp|ln|log|sqrt)/g, '$1');
  const out: Tok[] = [];
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (/\s/.test(c)) {
      i++;
      continue;
    }
    const num = /^(\d+\.?\d*|\.\d+)(e[+-]?\d+)?/i.exec(s.slice(i));
    if (num) {
      out.push({ t: 'num', v: parseFloat(num[0]) });
      i += num[0].length;
      continue;
    }
    const id = /^([A-Za-z_\u0370-\u03ff][A-Za-z_0-9]*)/.exec(s.slice(i));
    if (id) {
      out.push({ t: 'id', v: id[0] });
      i += id[0].length;
      continue;
    }
    if ('+-*/^(),[]{}'.includes(c)) {
      out.push({ t: 'op', v: c === '[' || c === '{' ? '(' : c === ']' || c === '}' ? ')' : c });
      i++;
      continue;
    }
    throw new Error(`Unexpected "${c}" in expression`);
  }
  return out;
}

export function compileExpr(src: string, varNames: string[] = ['x']): Fn {
  const toks = lex(String(src ?? ''));
  let p = 0;
  const peek = () => toks[p];
  const isOp = (v: string) => peek()?.t === 'op' && peek().v === v;
  const expect = (v: string) => {
    if (!isOp(v)) throw new Error(`Expected "${v}"`);
    p++;
  };

  function expr(): Fn {
    let left = term();
    while (isOp('+') || isOp('-')) {
      const op = toks[p++].v;
      const l = left;
      const r = term();
      left = op === '+' ? (v) => l(v) + r(v) : (v) => l(v) - r(v);
    }
    return left;
  }
  function startsFactor() {
    const t = peek();
    return !!t && (t.t === 'num' || t.t === 'id' || (t.t === 'op' && t.v === '('));
  }
  function term(): Fn {
    let left = unary();
    for (;;) {
      if (isOp('*') || isOp('/')) {
        const op = toks[p++].v;
        const l = left;
        const r = unary();
        left = op === '*' ? (v) => l(v) * r(v) : (v) => l(v) / r(v);
      } else if (startsFactor()) {
        const l = left;
        const r = power();
        left = (v) => l(v) * r(v);
      } else break;
    }
    return left;
  }
  function unary(): Fn {
    if (isOp('-')) {
      p++;
      const f = unary();
      return (v) => -f(v);
    }
    if (isOp('+')) {
      p++;
      return unary();
    }
    return power();
  }
  function power(): Fn {
    const base = atom();
    if (isOp('^')) {
      p++;
      const ex = unary(); // right associative, allows 2^-x
      return (v) => Math.pow(base(v), ex(v));
    }
    return base;
  }
  function atom(): Fn {
    const t = toks[p++];
    if (!t) throw new Error('Unexpected end of expression');
    if (t.t === 'num') {
      const n = t.v;
      return () => n;
    }
    if (t.t === 'op' && t.v === '(') {
      const f = expr();
      expect(')');
      return f;
    }
    if (t.t === 'op' && t.v === '|') throw new Error('Use abs()');
    if (t.t === 'id') {
      const name = t.v;
      const lname = name.toLowerCase();
      if (FUNCS[lname] && (isOp('(') || startsFactor())) {
        const fn = FUNCS[lname];
        if (isOp('(')) {
          p++;
          const args: Fn[] = [];
          if (!isOp(')')) {
            args.push(expr());
            while (isOp(',')) {
              p++;
              args.push(expr());
            }
          }
          expect(')');
          return (v) => fn(...args.map((a) => a(v)));
        }
        const arg = power(); // sin x
        return (v) => fn(arg(v));
      }
      if (varNames.includes(name)) return (v) => v[name] ?? 0;
      if (lname in CONSTS) {
        const c = CONSTS[lname];
        return () => c;
      }
      // unknown identifier: treat as variable (0 unless provided)
      return (v) => v[name] ?? NaN;
    }
    throw new Error(`Unexpected "${t.v}"`);
  }

  const f = expr();
  if (p < toks.length) throw new Error(`Unexpected "${toks[p].v}"`);
  return f;
}

export function safeCompile(src: string, vars: string[] = ['x']): Fn | null {
  try {
    const f = compileExpr(src.replace(/^\s*[a-zA-Z]\s*(\(\s*[a-z]\s*\))?\s*=/, ''), vars);
    return f;
  } catch {
    return null;
  }
}
