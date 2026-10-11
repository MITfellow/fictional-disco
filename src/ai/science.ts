// Offline physics / science notes — showcases equations, plots, drawings, boxes and worked steps.
import type { Block, DocSpec, FigElement, ThemeName } from '../types';
import { DEFAULT_META, today, uid } from '../normalize';
import { induction } from './induction';

export const H = (level: 1 | 2 | 3, text: string): Block => ({ id: uid(), type: 'heading', level, text });
export const P = (text: string, lead = false): Block => ({ id: uid(), type: 'paragraph', text, lead });
export const L = (items: string[], ordered = false): Block => ({ id: uid(), type: 'list', items, ordered });
export const EQ = (latex: string, label?: string): Block => ({ id: uid(), type: 'equation', latex, numbered: true, label });
export const BOX = (variant: Extract<Block, { type: 'box' }>['variant'], title: string | undefined, text?: string, blocks: Block[] = []): Block => ({ id: uid(), type: 'box', variant, title, text, blocks });
export const STEPS = (items: { text?: string; math?: string }[], title?: string): Block => ({ id: uid(), type: 'steps', title, items });
export const FIG = (width: number, height: number, elements: FigElement[], caption?: string, scale?: number, side?: 'left' | 'right', beside?: number): Block => ({ id: uid(), type: 'figure', width, height, elements, caption, scale, side, beside });
export const TABLE = (headers: string[], rows: string[][], caption?: string): Block => ({ id: uid(), type: 'table', headers, rows, caption, striped: true });

export const meta = (title: string, subtitle: string, theme: ThemeName, extra: Partial<DocSpec['meta']> = {}): DocSpec['meta'] => ({
  ...DEFAULT_META,
  title,
  subtitle,
  theme,
  date: today(),
  font: 'serif',
  style: 'academic',
  numberedHeadings: true,
  kicker: 'Physics · Lecture notes',
  ...extra,
});

export type ScienceTopic = 'projectile' | 'forces' | 'oscillations' | 'circuits' | 'optics' | 'induction';

export function detectScienceTopic(text: string): ScienceTopic | null {
  const t = text.toLowerCase();
  if (/induction|faraday|lenz|inductance|inductor|\bemi\b|eddy|generator|magnetic flux|solenoid/.test(t)) return 'induction';
  if (/projectile|kinematic|trajector|free fall|motion in (two|2) dimensions|parabolic/.test(t)) return 'projectile';
  if (/newton|force|friction|incline|free[- ]body|dynamics|tension/.test(t)) return 'forces';
  if (/harmonic|oscillat|pendulum|spring|shm|vibration|wave/.test(t)) return 'oscillations';
  if (/circuit|ohm|resist|current|voltage|kirchhoff|capacitor|electric/.test(t)) return 'circuits';
  if (/optic|lens|refraction|mirror|snell|light ray/.test(t)) return 'optics';
  return null;
}

export function isScienceRequest(text: string) {
  return /physics|science|equation|formula|derivation|lecture|lab report|mechanics|thermodynamic|quantum|electro|kinematic|newton|optic|circuit|pendulum|projectile|wave|chemistry|calculus/.test(text.toLowerCase()) || !!detectScienceTopic(text);
}

export function buildScienceNotes(topic: ScienceTopic, opts: { theme?: ThemeName; style?: 'modern' | 'academic' } = {}): DocSpec {
  const build = { projectile, forces, oscillations, circuits, optics, induction }[topic];
  const doc = build();
  if (opts.theme) doc.meta.theme = opts.theme;
  if (opts.style) {
    doc.meta.style = opts.style;
    doc.meta.font = opts.style === 'modern' ? 'sans' : 'serif';
  }
  // Every built-in lesson includes an explicit learning path and retrieval
  // practice. This turns attractive notes into something students can use.
  const study = studyGuide(topic);
  const introAt = Math.min(1, doc.blocks.length);
  doc.blocks.splice(introAt, 0, ...study.opening);
  doc.blocks.push(...study.closing);
  return doc;
}


const STUDY: Record<ScienceTopic, { objectives: string[]; checks: string[]; traps: string[] }> = {
  projectile: {
    objectives: ['Resolve launch velocity into horizontal and vertical components.', 'Derive time of flight, maximum height and range from constant-acceleration equations.', 'Interpret a trajectory graph and check limiting cases.'],
    checks: ['Why can horizontal and vertical motion be solved independently?', 'At the apex, which velocity component is zero—and which is not?', 'Without calculating, compare the ranges at $30^\circ$ and $60^\circ$.'],
    traps: ['Velocity is not zero at the apex.', 'The level-ground range formula does not apply when launch and landing heights differ.'],
  },
  forces: {
    objectives: ['Isolate a body and draw every external force.', 'Choose useful axes and apply $\sum \vec F=m\vec a$ component by component.', 'Distinguish static from kinetic friction.'],
    checks: ['Why is the normal force not always equal to $mg$?', 'Which way does friction point before you know the motion?', 'What changes in the equations at the threshold of slipping?'],
    traps: ['Action–reaction forces act on different bodies.', 'Static friction is not automatically $\mu_sN$; that is its maximum value.'],
  },
  oscillations: {
    objectives: ['Recognise the condition $a=-\omega^2x$ for SHM.', 'Connect displacement, velocity, acceleration and energy.', 'Use phase and period correctly.'],
    checks: ['Where are speed and acceleration largest?', 'How does doubling mass change a spring’s period?', 'Why is total energy constant in ideal SHM?'],
    traps: ['Acceleration is opposite to displacement, not necessarily opposite to velocity.', 'Amplitude and period are independent only for ideal linear SHM.'],
  },
  circuits: {
    objectives: ['Apply Ohm’s law and Kirchhoff’s rules with consistent signs.', 'Reduce series and parallel resistor networks.', 'Relate current, voltage, power and energy.'],
    checks: ['What is conserved at a junction?', 'Why is voltage common across parallel branches?', 'Which resistor dissipates more power in series?'],
    traps: ['Current is not consumed by a component.', 'Equivalent resistance in parallel is smaller than the smallest branch resistance.'],
  },
  optics: {
    objectives: ['Trace principal rays through lenses and mirrors.', 'Use a consistent sign convention in the imaging equation.', 'Connect ray diagrams with magnification.'],
    checks: ['What happens to a ray through the optical centre?', 'When is an image virtual?', 'How can the sign of magnification identify orientation?'],
    traps: ['A virtual image cannot be projected on a screen.', 'Always state the sign convention before substituting values.'],
  },
  induction: {
    objectives: ['Relate magnetic flux change to induced emf.', 'Use Lenz’s law to determine current direction.', 'Connect Faraday’s law to generators and inductors.'],
    checks: ['Can a strong constant magnetic field induce emf?', 'What does the minus sign in Faraday’s law mean?', 'How can flux change if field strength stays constant?'],
    traps: ['Flux, not magnetic field alone, controls induced emf.', 'Lenz’s law opposes the change in flux, not necessarily the field itself.'],
  },
};

function studyGuide(topic: ScienceTopic): { opening: Block[]; closing: Block[] } {
  const x = STUDY[topic];
  return {
    opening: [
      H(1, 'Learning goals'),
      { id: uid(), type: 'list', items: x.objectives.map((text) => `[ ] ${text}`), checklist: true },
      BOX('note', 'How to use these notes', 'Preview the diagram first, cover each worked solution and attempt it yourself, then answer the retrieval questions without looking back. Revisit any question you cannot explain aloud.'),
    ],
    closing: [
      H(1, 'Active recall'),
      P('Close the notes and answer these from memory. A strong answer should include the physical reason, not only a formula.'),
      L(x.checks.map((q) => `**Question:** ${q}`), true),
      BOX('warning', 'Common exam traps', undefined, [L(x.traps)]),
      H(2, 'Final self-check'),
      { id: uid(), type: 'list', checklist: true, items: [
        '[ ] I can sketch and label the central diagram from memory.',
        '[ ] I can derive the key result and state its assumptions.',
        '[ ] I can solve a numerical example with units and a reasonableness check.',
        '[ ] I can explain the topic in sixty seconds without reading.',
      ] },
    ],
  };
}

// ---------------------------------------------------------------- projectile
function projectile(): DocSpec {
  return {
    meta: meta('Projectile Motion', 'Two-dimensional kinematics under uniform gravity', 'ink'),
    blocks: [
      BOX('abstract', undefined, 'A projectile is any object launched into the air that moves only under the influence of gravity. Because the horizontal and vertical motions are **independent**, the path can be analysed as uniform motion along $x$ combined with uniformly accelerated motion along $y$. The result is a parabola whose range, height and flight time follow from three short formulas.'),
      H(1, 'Setting up the problem'),
      P('Launch a particle from the origin with speed $v_0$ at angle $\\theta$ above the horizontal. Ignoring air resistance, the only force is the weight $m\\vec{g}$, so the acceleration is constant: $a_x = 0$ and $a_y = -g$ with $g \\approx 9.81\\ \\mathrm{m/s^2}$.'),
      FIG(
        120,
        58,
        [
          { type: 'axes', at: [6, 6], length: [108, 48], text: '$x$,$y$' },
          { type: 'curve', points: [[6, 6], [20, 22.4], [34, 33.4], [48, 39], [62, 39], [76, 33.4], [90, 22.4], [104, 6]], color: 'primary', dashed: true },
          { type: 'vector', from: [6, 6], to: [24, 24], label: '$\\vec{v}_0$', color: '#dc2626' },
          { type: 'vector', from: [6, 6], to: [24, 6], label: '$v_0\\cos\\theta$', color: '#64748b', labelPos: 'below', width: 1.2 },
          { type: 'vector', from: [6, 6], to: [6, 24], label: '$v_0\\sin\\theta$', color: '#64748b', labelPos: 'left', width: 1.2 },
          { type: 'angle', at: [6, 6], startAngle: 0, endAngle: 45, r: 8, label: '$\\theta$' },
          { type: 'ball', center: [55, 39.7], r: 2.2, label: 'apex', labelPos: 'above' },
          { type: 'vector', from: [55, 39.7], to: [70, 39.7], label: '$v_x$', color: '#2563eb', labelPos: 'end' },
          { type: 'vector', from: [55, 37.5], to: [55, 27], label: '$m\\vec{g}$', color: '#16a34a', labelPos: 'end' },
          { type: 'dimension', from: [6, 1.5], to: [104, 1.5], label: 'range $R$' },
          { type: 'dimension', from: [112, 6], to: [112, 39.7], label: '$H$' },
        ],
        'Trajectory of a projectile launched at angle $\\theta$. The horizontal velocity stays constant while gravity bends the path into a parabola.',
      ),
      H(1, 'Equations of motion'),
      P('Integrating the constant acceleration twice gives the position components as functions of time:'),
      EQ('\\begin{aligned} x(t) &= v_0 \\cos\\theta \\; t \\\\ y(t) &= v_0 \\sin\\theta \\; t - \\tfrac{1}{2} g t^2 \\end{aligned}'),
      P('Eliminating $t$ between the two equations shows that the trajectory is a downward-opening parabola:'),
      EQ('y = x\\tan\\theta - \\frac{g\\,x^2}{2 v_0^2 \\cos^2\\theta}'),
      BOX('formula', 'Results for level ground', undefined, [
        TABLE(
          ['Quantity', 'Formula', 'Maximised at'],
          [
            ['Time of flight', '$T = 2 v_0 \\sin\\theta / g$', '$\\theta = 90°$'],
            ['Maximum height', '$H = v_0^2 \\sin^2\\theta / 2g$', '$\\theta = 90°$'],
            ['Horizontal range', '$R = v_0^2 \\sin 2\\theta / g$', '$\\theta = 45°$'],
          ],
        ),
      ]),
      H(1, 'Range versus launch angle'),
      P('Because $R \\propto \\sin 2\\theta$, complementary angles such as $30°$ and $60°$ land at the same point, and the range is largest at $45°$. The plot shows trajectories for $v_0 = 20\\ \\mathrm{m/s}$.'),
      {
        id: uid(),
        type: 'plot',
        functions: [
          { expr: 'x*tan(pi/12) - 9.81*x^2/(2*400*cos(pi/12)^2)', label: '$\\theta = 15°$', domain: [0, 20.39] },
          { expr: 'x*tan(pi/6) - 9.81*x^2/(2*400*cos(pi/6)^2)', label: '$\\theta = 30°$', domain: [0, 35.31] },
          { expr: 'x*tan(pi/4) - 9.81*x^2/(2*400*cos(pi/4)^2)', label: '$\\theta = 45°$', domain: [0, 40.77] },
          { expr: 'x*tan(pi/3) - 9.81*x^2/(2*400*cos(pi/3)^2)', label: '$\\theta = 60°$', domain: [0, 35.31], dashed: true },
        ],
        xRange: [0, 44],
        yRange: [0, 17],
        xLabel: 'horizontal distance $x$ (m)',
        yLabel: 'height $y$ (m)',
        points: [{ x: 40.77, y: 0, label: '$R_{max} = 40.8$ m' }],
        caption: 'Trajectories for $v_0 = 20$ m/s. The $30°$ and $60°$ paths share the same range.',
      },
      H(1, 'Worked example'),
      BOX('problem', 'Kicking a football', 'A ball is kicked at $v_0 = 18\\ \\mathrm{m/s}$ and $\\theta = 35°$. Find its flight time, maximum height and range.'),
      STEPS([
        { text: 'Resolve the initial velocity into components.', math: 'v_{0x} = 18\\cos 35^\\circ = 14.7\\ \\mathrm{m/s}, \\quad v_{0y} = 18 \\sin 35^\\circ = 10.3\\ \\mathrm{m/s}' },
        { text: 'The ball lands when $y = 0$, so the flight time is', math: 'T = \\frac{2 v_{0y}}{g} = \\frac{2(10.3)}{9.81} = 2.10\\ \\mathrm{s}' },
        { text: 'The apex is reached at $t = T/2$, where $v_y = 0$:', math: 'H = \\frac{v_{0y}^2}{2g} = \\frac{(10.3)^2}{2(9.81)} = 5.42\\ \\mathrm{m}' },
        { text: 'The horizontal velocity is constant, so the range is', math: 'R = v_{0x} T = (14.7)(2.10) = 30.9\\ \\mathrm{m}' },
      ]),
      BOX('key', 'Key ideas', undefined, [
        L([
          'Horizontal and vertical motions are independent; only $y$ feels gravity.',
          'At the apex the velocity is purely horizontal: $v_y = 0$ and $v = v_0\\cos\\theta$.',
          'On level ground the maximum range occurs at $\\theta = 45°$.',
          'Air drag $\\vec{F}_d = -b\\vec{v}$ shortens the range and makes the path asymmetric.',
        ]),
      ]),
    ],
  };
}

// ---------------------------------------------------------------- forces
function forces(): DocSpec {
  return {
    meta: meta("Newton's Laws & Inclined Planes", 'Forces, free-body diagrams and friction', 'plum'),
    blocks: [
      P('Dynamics explains **why** objects move. Newton’s three laws link the net force on a body to its change in motion, and free-body diagrams turn word problems into solvable equations.', true),
      H(1, "Newton's three laws"),
      BOX('law', 'First law (inertia)', 'A body stays at rest or in uniform straight-line motion unless a net external force acts on it.'),
      BOX('law', 'Second law', 'The net force equals the rate of change of momentum. For constant mass this gives the familiar form:', [EQ('\\sum \\vec{F} = \\frac{d\\vec{p}}{dt} = m\\vec{a}')]),
      BOX('law', 'Third law', 'Whenever body A exerts a force on body B, B exerts an equal and opposite force on A: $\\vec{F}_{AB} = -\\vec{F}_{BA}$.'),
      H(1, 'Block on an inclined plane'),
      P('A block of mass $m$ rests on a rough plane inclined at angle $\\theta$. Three forces act on it: the weight $m\\vec{g}$, the normal force $\\vec{N}$ perpendicular to the surface, and friction $\\vec{f}$ along the surface, opposing the motion.'),
      FIG(
        120,
        66,
        [
          { type: 'incline', points: [[8, 8], [108, 8], [108, 60]] },
          { type: 'angle', at: [8, 8], startAngle: 0, endAngle: 27.47, r: 16, label: '$\\theta$' },
          { type: 'block', center: [66.1, 39.1], size: [20, 12], rotate: 27.47, label: '$m$' },
          { type: 'vector', from: [66.1, 39.1], to: [66.1, 14], label: '$m\\vec{g}$', color: '#16a34a' },
          { type: 'vector', from: [66.1, 39.1], to: [55.8, 59], label: '$\\vec{N}$', color: '#2563eb' },
          { type: 'vector', from: [66.1, 39.1], to: [84.7, 48.8], label: '$\\vec{f}$', color: '#dc2626' },
          { type: 'line', from: [66.1, 39.1], to: [77.2, 17.8], dashed: true, color: '#94a3b8' },
          { type: 'line', from: [66.1, 14], to: [77.2, 17.8], dashed: true, color: '#94a3b8' },
          { type: 'text', at: [86, 22], text: '$mg\\cos\\theta$', fontSize: 8.5, color: '#64748b' },
          { type: 'ground', from: [0, 8], to: [120, 8] },
        ],
        'Free-body diagram for a block on a rough incline. Gravity is resolved into components parallel and perpendicular to the surface.',
        80,
      ),
      P('Choosing axes along and perpendicular to the plane, Newton’s second law in each direction gives'),
      EQ('\\begin{aligned} \\perp:&\\quad N - mg\\cos\\theta = 0 \\\\ \\parallel:&\\quad mg\\sin\\theta - f = ma \\end{aligned}'),
      P('With kinetic friction $f = \\mu_k N$, the acceleration down the slope is'),
      EQ('a = g\\left(\\sin\\theta - \\mu_k \\cos\\theta\\right)'),
      BOX('note', 'When does it slide?', 'The block stays at rest while $\\tan\\theta \\le \\mu_s$. The **angle of repose** $\\theta_c = \\arctan\\mu_s$ is the steepest slope a stationary block can rest on.'),
      { id: uid(), type: 'plot', functions: [{ expr: '9.81*(sin(x*pi/180) - 0.3*cos(x*pi/180))', label: '$\\mu_k = 0.3$' }, { expr: '9.81*(sin(x*pi/180) - 0.6*cos(x*pi/180))', label: '$\\mu_k = 0.6$', dashed: true }, { expr: '9.81*sin(x*pi/180)', label: 'frictionless' }], xRange: [0, 90], yRange: [-6, 10], xLabel: 'incline angle $\\theta$ (degrees)', yLabel: '$a$ (m/s²)', hlines: [{ y: 0 }], caption: 'Acceleration along the incline. Negative values mean friction can hold the block still, so it does not slide.' },
      H(1, 'Worked example'),
      BOX('problem', undefined, 'A $5.0\\ \\mathrm{kg}$ crate slides down a $30°$ ramp with $\\mu_k = 0.25$. Find the normal force, the friction force and the acceleration.'),
      STEPS([
        { text: 'Normal force:', math: 'N = mg\\cos\\theta = (5.0)(9.81)\\cos 30^\\circ = 42.5\\ \\mathrm{N}' },
        { text: 'Kinetic friction:', math: 'f = \\mu_k N = 0.25 \\times 42.5 = 10.6\\ \\mathrm{N}' },
        { text: 'Net force and acceleration along the slope:', math: 'a = \\frac{mg\\sin\\theta - f}{m} = \\frac{24.5 - 10.6}{5.0} = 2.78\\ \\mathrm{m/s^2}' },
      ]),
      BOX('summary', undefined, undefined, [L(['Draw a free-body diagram before writing any equations.', 'Choose axes that line up with the acceleration.', 'Friction always opposes relative motion, and $f_s \\le \\mu_s N$.', 'Check limits: when $\\theta \\to 0$ the acceleration should vanish.'])]),
    ],
  };
}

// ---------------------------------------------------------------- oscillations
function oscillations(): DocSpec {
  return {
    meta: meta('Simple Harmonic Motion', 'Springs, pendulums and the mathematics of oscillation', 'sage'),
    blocks: [
      BOX('abstract', undefined, 'Simple harmonic motion (SHM) appears whenever a restoring force is proportional to displacement. These notes derive the equation of motion for a mass on a spring, solve it, examine energy exchange, and apply the result to the simple pendulum.'),
      H(1, 'The mass–spring system'),
      FIG(
        120,
        34,
        [
          { type: 'wall', from: [6, 4], to: [6, 30], kind: 'flip' },
          { type: 'spring', from: [6, 17], to: [60, 17], coils: 10, label: '$k$' },
          { type: 'block', center: [70, 17], size: [20, 16], label: '$m$' },
          { type: 'ground', from: [0, 9], to: [120, 9] },
          { type: 'line', from: [60, 34], to: [60, 26], dashed: true, color: '#94a3b8' },
          { type: 'text', at: [60, 32], text: 'equilibrium', fontSize: 7.5, color: '#64748b', labelPos: 'left' },
          { type: 'vector', from: [80, 17], to: [100, 17], label: '$x$', color: '#64748b', width: 1 },
          { type: 'vector', from: [60, 4], to: [44, 4], label: '$F = -kx$', color: '#dc2626', labelPos: 'below' },
        ],
        'A mass on a frictionless surface attached to a spring of stiffness $k$.',
        85,
      ),
      P('Hooke’s law states that the spring force is proportional to the extension and directed back toward equilibrium. Combining it with Newton’s second law gives the defining differential equation of SHM:'),
      EQ('m\\frac{d^2x}{dt^2} = -kx \\quad\\Longrightarrow\\quad \\ddot{x} + \\omega^2 x = 0, \\qquad \\omega = \\sqrt{\\frac{k}{m}}'),
      BOX('definition', 'Simple harmonic motion', 'Motion in which the acceleration is proportional to the displacement from equilibrium and points toward it: $a = -\\omega^2 x$.'),
      H(2, 'Solution'),
      P('The general solution is a sinusoid with amplitude $A$ and phase constant $\\phi$ set by the initial conditions:'),
      EQ('x(t) = A\\cos(\\omega t + \\phi), \\qquad T = \\frac{2\\pi}{\\omega} = 2\\pi\\sqrt{\\frac{m}{k}}'),
      {
        id: uid(),
        type: 'plot',
        functions: [
          { expr: '2*cos(2*x)', label: 'displacement $x(t)$' },
          { expr: '-4*sin(2*x)', label: 'velocity $v(t)$', dashed: true },
          { expr: '2*exp(-0.25*x)*cos(2*x)', label: 'damped, $\\gamma = 0.25$' },
        ],
        xRange: [0, 10],
        xLabel: 'time $t$ (s)',
        yLabel: 'amplitude',
        caption: 'Displacement and velocity are $90°$ out of phase. Light damping makes the envelope decay as $e^{-\\gamma t}$.',
      },
      H(1, 'Energy in SHM'),
      P('With no friction, mechanical energy is conserved and continually exchanged between kinetic and potential forms:'),
      EQ('E = \\tfrac12 m v^2 + \\tfrac12 k x^2 = \\tfrac12 k A^2'),
      { id: uid(), type: 'plot', functions: [{ expr: '0.5*x^2', label: 'potential $U$' }, { expr: '0.5*(4 - x^2)', label: 'kinetic $K$', domain: [-2, 2] }, { expr: '2', label: 'total $E$', dashed: true, domain: [-2, 2] }], xRange: [-2.4, 2.4], yRange: [0, 2.6], xLabel: 'displacement $x/A$', yLabel: 'energy', vlines: [{ x: -2, label: '$-A$' }, { x: 2, label: '$A$' }], caption: 'Energy versus position for $k = 1$ and $A = 2$.' },
      H(1, 'The simple pendulum'),
      P('For small angles, $\\sin\\theta \\approx \\theta$, so the pendulum obeys the same equation with $\\omega^2 = g/L$:'),
      EQ('\\boxed{T = 2\\pi\\sqrt{\\frac{L}{g}}}'),
      FIG(
        80,
        60,
        [
          { type: 'ceiling', from: [20, 56], to: [60, 56] },
          { type: 'line', from: [40, 56], to: [40, 14], dashed: true, color: '#94a3b8' },
          { type: 'rod', from: [40, 56], to: [55.4, 17.9], width: 1.2, label: '$L$', labelPos: 'right' },
          { type: 'ball', center: [55.4, 17.9], r: 4.2 },
          { type: 'angle', at: [40, 56], startAngle: -90, endAngle: -68, r: 14, label: '$\\theta$' },
          { type: 'vector', from: [55.4, 17.9], to: [55.4, 2], label: '$mg$', color: '#16a34a' },
          { type: 'vector', from: [55.4, 17.9], to: [47.6, 37.2], label: '$T$', color: '#2563eb', labelPos: 'end' },
          { type: 'arc', center: [40, 56], r: 41, startAngle: -112, endAngle: -68, dashed: true, color: '#94a3b8' },
        ],
        'A simple pendulum. The restoring force is $-mg\\sin\\theta$.',
        55,
      ),
      BOX('example', 'Grandfather clock', 'A clock pendulum must have a period of $2.00\\ \\mathrm{s}$. Its length is $L = gT^2/4\\pi^2 = (9.81)(4.00)/39.5 = 0.994\\ \\mathrm{m}$. That is why such pendulums are about a metre long.'),
      TABLE(['System', 'Restoring force', 'Angular frequency $\\omega$'], [['Mass–spring', '$-kx$', '$\\sqrt{k/m}$'], ['Simple pendulum', '$-mg\\theta$', '$\\sqrt{g/L}$'], ['LC circuit', '$-q/C$', '$1/\\sqrt{LC}$'], ['Torsion pendulum', '$-\\kappa\\theta$', '$\\sqrt{\\kappa/I}$']], 'The same mathematics describes many different physical systems.'),
    ],
  };
}

// ---------------------------------------------------------------- circuits
function circuits(): DocSpec {
  return {
    meta: meta("DC Circuits & Ohm's Law", 'Resistors, Kirchhoff’s rules and power', 'clay', { style: 'modern', font: 'sans', kicker: 'Physics · Electricity', cover: true, coverStyle: 'grid' }),
    blocks: [
      H(1, 'Current, voltage and resistance'),
      P('An electric current $I$ is the rate at which charge flows, $I = dQ/dt$, measured in amperes. A potential difference $V$ drives the current, and the resistance $R$ of a component sets how much current flows for a given voltage.'),
      BOX('law', "Ohm's law", 'For an ohmic conductor at constant temperature, current is proportional to voltage:', [EQ('V = IR')]),
      { id: uid(), type: 'plot', data: [{ points: [[0, 0], [1, 0.21], [2, 0.39], [3, 0.62], [4, 0.79], [5, 1.02], [6, 1.19]], label: 'measured (resistor)' }], functions: [{ expr: 'x/5', label: 'fit: $R = 5.0\\ \\Omega$' }, { expr: '0.05*(exp(1.1*x)-1)', label: 'filament / diode (non-ohmic)', dashed: true, domain: [0, 2.8] }], xRange: [0, 6.5], yRange: [0, 1.4], xLabel: 'voltage $V$ (V)', yLabel: 'current $I$ (A)', caption: 'I–V characteristics. A straight line through the origin means the component is ohmic.' },
      H(1, 'A series–parallel circuit'),
      FIG(
        120,
        64,
        [
          { type: 'battery', from: [10, 12], to: [10, 52], label: '$\\varepsilon = 12$ V', labelPos: 'left' },
          { type: 'wire', points: [[10, 52], [10, 58], [30, 58]] },
          { type: 'resistor', from: [30, 58], to: [62, 58], label: '$R_1 = 4\\,\\Omega$' },
          { type: 'wire', points: [[62, 58], [80, 58]] },
          { type: 'wire', points: [[80, 58], [80, 48]] },
          { type: 'wire', points: [[80, 58], [108, 58], [108, 48]] },
          { type: 'resistor', from: [80, 48], to: [80, 18], label: '$R_2 = 6\\,\\Omega$', labelPos: 'left' },
          { type: 'resistor', from: [108, 48], to: [108, 18], label: '$R_3 = 3\\,\\Omega$' },
          { type: 'wire', points: [[80, 18], [80, 6], [108, 6], [108, 18]] },
          { type: 'ammeter', from: [46, 6], to: [80, 6] },
          { type: 'wire', points: [[46, 6], [10, 6], [10, 12]] },
          { type: 'vector', from: [36, 62], to: [52, 62], label: '$I$', color: '#dc2626', width: 1.1 },
          { type: 'dot', at: [80, 58] },
          { type: 'dot', at: [80, 6] },
        ],
        '$R_1$ in series with the parallel pair $R_2 \\parallel R_3$.',
        88,
      ),
      BOX('formula', 'Combining resistors', undefined, [EQ('R_{\\text{series}} = R_1 + R_2 + \\cdots \\qquad \\frac{1}{R_{\\text{parallel}}} = \\frac{1}{R_1} + \\frac{1}{R_2} + \\cdots', ''), { id: uid(), type: 'paragraph', text: 'Series resistors share the **same current**; parallel resistors share the **same voltage**.' }]),
      H(2, 'Solving the circuit'),
      STEPS([
        { text: 'Combine the parallel pair:', math: 'R_{23} = \\frac{R_2 R_3}{R_2 + R_3} = \\frac{6 \\cdot 3}{6 + 3} = 2\\,\\Omega' },
        { text: 'Total resistance and current from the battery:', math: 'R_{\\text{tot}} = 4 + 2 = 6\\,\\Omega, \\qquad I = \\frac{\\varepsilon}{R_{\\text{tot}}} = \\frac{12}{6} = 2.0\\ \\mathrm{A}' },
        { text: 'Voltage across the parallel section and branch currents:', math: 'V_{23} = I R_{23} = 4\\ \\mathrm{V}, \\quad I_2 = \\tfrac{4}{6} = 0.67\\ \\mathrm{A}, \\quad I_3 = \\tfrac{4}{3} = 1.33\\ \\mathrm{A}' },
        { text: 'Check with Kirchhoff’s junction rule: $I_2 + I_3 = 2.0\\ \\mathrm{A} = I$ ✓' },
      ]),
      H(1, "Kirchhoff's rules"),
      { id: uid(), type: 'columns', columns: [{ title: 'Junction rule (charge)', text: 'The total current entering a node equals the total current leaving it: $\\sum I_{in} = \\sum I_{out}$.' }, { title: 'Loop rule (energy)', text: 'Around any closed loop the sum of potential changes is zero: $\\sum \\Delta V = 0$.' }] },
      H(1, 'Electrical power'),
      EQ('P = IV = I^2 R = \\frac{V^2}{R}'),
      TABLE(['Component', 'Current (A)', 'Voltage (V)', 'Power (W)'], [['$R_1$', '2.00', '8.00', '16.0'], ['$R_2$', '0.67', '4.00', '2.67'], ['$R_3$', '1.33', '4.00', '5.33'], ['**Battery**', '2.00', '12.0', '**24.0**']], 'Power balance: the battery supplies exactly what the resistors dissipate.'),
      BOX('warning', undefined, 'An ideal ammeter has zero resistance and goes **in series**; an ideal voltmeter has infinite resistance and goes **in parallel**. Swapping them can damage the meter.'),
    ],
  };
}

// ---------------------------------------------------------------- optics
function optics(): DocSpec {
  return {
    meta: meta('Geometric Optics: Thin Lenses', 'Ray diagrams, the lens equation and magnification', 'lake', { kicker: 'Physics · Optics' }),
    blocks: [
      BOX('abstract', undefined, 'When light passes through a thin lens it is refracted so that rays from one object point meet again at an image point. Three principal rays are enough to locate the image graphically, and the thin-lens equation does the same algebraically.'),
      H(1, 'Ray diagram for a converging lens'),
      FIG(
        130,
        56,
        [
          { type: 'line', from: [2, 28], to: [128, 28], color: '#94a3b8', label: 'optical axis', labelPos: 'below' },
          { type: 'lens', at: [60, 28], height: 48, label: 'lens' },
          { type: 'dot', at: [40, 28], label: '$F$', labelPos: 'below' },
          { type: 'dot', at: [80, 28], label: '$F′$', labelPos: 'below' },
          { type: 'arrow', from: [22, 28], to: [22, 44], width: 2.2, color: '#16a34a', label: 'object', labelPos: 'left' },
          { type: 'arrow', from: [100, 28], to: [100, 11.2], width: 2.2, color: '#dc2626', label: 'image', labelPos: 'right' },
          { type: 'line', from: [22, 44], to: [60, 44], color: '#f59e0b' },
          { type: 'line', from: [60, 44], to: [104, 4.4], color: '#f59e0b' },
          { type: 'line', from: [22, 44], to: [104, 9.5], color: '#0ea5e9' },
          { type: 'line', from: [22, 44], to: [60, 12], color: '#a855f7' },
          { type: 'line', from: [60, 12], to: [110, 12], color: '#a855f7' },
          { type: 'dimension', from: [22, 52], to: [60, 52], label: '$d_o$' },
          { type: 'dimension', from: [60, 52], to: [100, 52], label: '$d_i$' },
        ],
        'The three principal rays: parallel → through $F′$ (orange), through the centre undeviated (blue), through $F$ → parallel (purple).',
      ),
      H(1, 'The thin-lens equation'),
      EQ('\\frac{1}{d_o} + \\frac{1}{d_i} = \\frac{1}{f}, \\qquad m = -\\frac{d_i}{d_o} = \\frac{h_i}{h_o}'),
      TABLE(['Quantity', 'Positive when', 'Negative when'], [['$f$', 'converging lens', 'diverging lens'], ['$d_i$', 'real image (opposite side)', 'virtual image (same side)'], ['$m$', 'upright image', 'inverted image']], 'Sign conventions'),
      { id: uid(), type: 'plot', functions: [{ expr: '20*x/(x-20)', label: '$d_i$ for $f = 20$ cm', domain: [0.5, 80] }], xRange: [0, 80], yRange: [-80, 100], xLabel: 'object distance $d_o$ (cm)', yLabel: '$d_i$ (cm)', vlines: [{ x: 20, label: '$d_o = f$' }], hlines: [{ y: 20, label: '$d_i \\to f$' }], caption: 'Image distance versus object distance. Inside the focal length the image becomes virtual ($d_i < 0$).' },
      H(1, 'Worked example'),
      BOX('problem', undefined, 'A $3.0\\ \\mathrm{cm}$ tall object stands $30\\ \\mathrm{cm}$ in front of a converging lens with $f = 20\\ \\mathrm{cm}$. Locate and describe the image.'),
      STEPS([
        { text: 'Solve the lens equation for $d_i$:', math: '\\frac{1}{d_i} = \\frac{1}{20} - \\frac{1}{30} = \\frac{1}{60} \\;\\Rightarrow\\; d_i = 60\\ \\mathrm{cm}' },
        { text: 'Magnification and image height:', math: 'm = -\\frac{60}{30} = -2.0, \\qquad h_i = m h_o = -6.0\\ \\mathrm{cm}' },
        { text: 'The image is **real**, **inverted** and **twice the size** of the object, $60$ cm behind the lens.' },
      ]),
      BOX('tip', 'Lens power', 'Optometrists use the power $P = 1/f$ in dioptres (with $f$ in metres). A $+2.5\\ \\mathrm{D}$ reading lens has $f = 40\\ \\mathrm{cm}$.'),
    ],
  };
}
