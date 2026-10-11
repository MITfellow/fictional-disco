// Offline chapter: Electromagnetic Induction (≈5 A4 pages).
// Showcases magnets, solenoids, circuits, field symbols, plots, boxes and worked steps.
import type { Block, DocSpec } from '../types';
import { uid } from '../normalize';
import { BOX, EQ, FIG, H, L, P, TABLE, meta } from './science';

const plot = (p: Omit<Extract<Block, { type: 'plot' }>, 'id' | 'type'>): Block => ({ id: uid(), type: 'plot', ...p });

export function induction(): DocSpec {
  return {
    meta: meta('Electromagnetic Induction', 'A visual masterclass in flux, induced fields, magnetic energy and modern applications', 'ink', {
      kicker: 'THE INSTITUTE OF ADVANCED PHYSICS · MASTERCLASS EDITION',
      cover: false,
      coverStyle: 'minimal',
      toc: false,
      numberedHeadings: true,
      density: 'comfortable',
      pageNumbers: true,
      footer: 'Advanced Physics Masterclass · Electromagnetic Induction',
    }),
    blocks: [
      BOX(
        'abstract',
        undefined,
        'A changing magnetic field can drive a current through a circuit with no battery at all. We follow that idea from Faraday’s experiments to flux, Faraday’s and Lenz’s laws, inductance, RL circuits and the AC generator.',
      ),
      // Page 2 begins the chapter itself.
      { id: uid(), type: 'pagebreak' },
      // A dedicated full-page synthesis plate: complex on purpose, but layered
      // so students can follow cause → flux change → emf → current → load.
      {
        ...FIG(
          170,
          210,
          [
            { type: 'text', at: [85, 205], text: 'CHAPTER 1 · THE COMPLETE INDUCTION SYSTEM', fontSize: 10, color: '#3a3631' },
            { type: 'text', at: [85, 197], text: '1 · CAUSE — change the magnetic flux linked with a coil', fontSize: 8.5, color: '#6b645a' },
            { type: 'magnet', center: [27, 181], size: [34, 11], kind: 'SN' },
            { type: 'text', at: [27, 168], text: 'moving magnet', fontSize: 7.5, color: '#6b645a' },
            { type: 'velocity', from: [14, 198], to: [39, 198], label: '$\vec v$', width: 1.5 },
            { type: 'solenoid', from: [62, 181], to: [112, 181], r: 13, coils: 11 },
            { type: 'text', at: [87, 198], text: 'primary coil · N₁ turns', fontSize: 7.5, color: '#6b645a' },
            { type: 'arrow', from: [44, 182], to: [119, 182], color: '#5f7d9c', width: 1.1, label: '$\Delta\Phi_B$', labelPos: 'above' },
            { type: 'dimension', from: [62, 161], to: [112, 161], label: 'area $A$, length $\ell$' },
            { type: 'wire', points: [[62, 156], [62, 146], [72, 146]] },
            { type: 'galvanometer', from: [72, 146], to: [91, 146], label: '$G_1$' },
            { type: 'resistor', from: [91, 146], to: [118, 146], label: '$R_1$' },
            { type: 'wire', points: [[118, 146], [112, 146], [112, 156]] },
            { type: 'vector', from: [76, 153], to: [101, 153], label: '$I_1$', color: '#9a5a43', width: 1.2 },
            { type: 'text', at: [139, 182], text: '$\varepsilon_1=-N_1\,d\Phi_B/dt$', fontSize: 8.5, color: '#3a3631' },

            { type: 'line', from: [8, 134], to: [162, 134], dashed: true, color: '#c8c1b5', width: 0.7 },
            { type: 'text', at: [85, 128], text: '2 · COUPLING — primary flux links a second coil', fontSize: 9, color: '#3a3631' },
            { type: 'rect', center: [85, 103], size: [94, 22], fill: '#ded9ce', color: '#8a847a', label: 'laminated magnetic core' },
            { type: 'solenoid', from: [47, 104], to: [72, 104], r: 17, coils: 7, kind: 'noleads', label: '$N_1$' },
            { type: 'solenoid', from: [99, 104], to: [124, 104], r: 17, coils: 10, kind: 'noleads', label: '$N_2$' },
            { type: 'arrow', from: [69, 103], to: [103, 103], dashed: true, color: '#5f7d9c', width: 1.1, label: '$\Phi_{21}$' },
            { type: 'wire', points: [[47, 86], [47, 76], [57, 76]] },
            { type: 'source', from: [57, 76], to: [75, 76], label: 'AC' },
            { type: 'wire', points: [[75, 76], [72, 76], [72, 86]] },
            { type: 'wire', points: [[99, 86], [99, 76], [109, 76]] },
            { type: 'voltmeter', from: [109, 76], to: [127, 76], label: '$V_2$' },
            { type: 'wire', points: [[127, 76], [124, 76], [124, 86]] },
            { type: 'text', at: [148, 103], text: '$\varepsilon_2=-M\,dI_1/dt$', fontSize: 8.3, color: '#3a3631' },

            { type: 'line', from: [8, 64], to: [162, 64], dashed: true, color: '#c8c1b5', width: 0.7 },
            { type: 'text', at: [85, 58], text: '3 · OUTPUT — induced current transfers energy to a load', fontSize: 9, color: '#3a3631' },
            { type: 'wire', points: [[20, 42], [20, 22], [38, 22]] },
            { type: 'diode', from: [38, 22], to: [58, 22], label: 'rectifier' },
            { type: 'capacitor', from: [68, 14], to: [68, 34], label: '$C$' },
            { type: 'wire', points: [[58, 22], [68, 22], [82, 22]] },
            { type: 'ammeter', from: [82, 22], to: [101, 22], label: '$A$' },
            { type: 'bulb', from: [118, 34], to: [118, 14], label: 'load' },
            { type: 'wire', points: [[101, 22], [118, 22], [118, 34]] },
            { type: 'wire', points: [[118, 14], [118, 8], [20, 8], [20, 22]] },
            { type: 'vector', from: [76, 42], to: [102, 42], label: 'current I', color: '#9a5a43', width: 1.2 },
            { type: 'text', at: [145, 31], text: '$P_{load}=I^2R$\nenergy conserved', fontSize: 8.2, color: '#3a3631' },
            { type: 'text', at: [85, 2], text: 'INPUT → CHANGING FLUX → INDUCED EMF → CURRENT → OUTPUT + HEAT', fontSize: 8, color: '#6b645a' },
          ],
          'Full-system electromagnetic-induction plate. The two experiments share the same chain of reasoning: identify what changes the flux, apply Faraday–Lenz, then follow the induced current and energy.',
          100,
        ),
        fullPage: true,
      } as Block,
      { id: uid(), type: 'pagebreak' },

      // ------------------------------------------------------------ 1
      H(1, 'The experiments of Faraday and Henry'),
      P('In 1831 Faraday and Henry found, independently, that a current appears in a closed coil whenever the magnetic field through it changes. A magnet, a coil and a galvanometer are enough to see it.'),
      FIG(
        150,
        58,
        [
          { type: 'magnet', center: [26, 30], size: [34, 10], kind: 'SN', lines: 2 },
          { type: 'velocity', from: [14, 52], to: [34, 52], label: '$\\vec v$', width: 1.3 },
          { type: 'solenoid', from: [66, 34], to: [116, 34], r: 10, coils: 9 },
          { type: 'wire', points: [[66, 14], [66, 5], [82, 5]] },
          { type: 'galvanometer', from: [82, 5], to: [100, 5] },
          { type: 'wire', points: [[100, 5], [116, 5], [116, 14]] },
          { type: 'text', at: [91, 50], text: 'coil, $N$ turns', fontSize: 8, color: '#6b645a' },
        ],
        'Moving the N pole in deflects G; moving it out reverses the deflection.',
        50,
        'right',
      ),
      L([
        'A current flows only while the magnet and coil **move relative to each other**; at rest there is none, however strong the magnet.',
        'Faster motion gives a **larger** current, and reversing the motion **reverses** it.',
        'Switching the current in a *nearby* coil on or off has the same effect with no motion at all.',
      ]),

      // ------------------------------------------------------------ 2
      H(1, 'Magnetic flux'),
      FIG(
        120,
        52,
        [
          { type: 'polygon', points: [[22, 10], [68, 10], [84, 34], [38, 34]], fill: '#e9e4d8', color: '#7d766b' },
          { type: 'vector', from: [53, 22], to: [53, 50], label: '$\\mathbf{n}$', labelPos: 'left', color: '#3a3631', width: 1.2 },
          { type: 'vector', from: [41, 2], to: [65, 50], color: '#5f7d9c', width: 1 },
          { type: 'vector', from: [62, 2], to: [86, 50], color: '#5f7d9c', width: 1, label: '$\\mathbf{B}$', labelPos: 'right' },
          { type: 'vector', from: [20, 2], to: [44, 50], color: '#5f7d9c', width: 1 },
          { type: 'angle', at: [53, 22], startAngle: 63.4, endAngle: 90, r: 16, label: '$\\theta$' },
          { type: 'text', at: [26, 24], text: 'area $A$', fontSize: 8, color: '#6b645a', labelPos: 'left' },
        ],
        'Only $B\\cos\\theta$ threads the area $A$.',
        42,
        'left',
      ),
      P('Magnetic flux measures how much field threads a surface. It depends on the angle $\\theta$ between $\\vec B$ and the surface normal $\\mathbf{n}$: it is largest when the surface faces the field and zero when the field skims along it.'),
      BOX('definition', 'Magnetic flux', 'Measured in webers, $1\\ \\mathrm{Wb} = 1\\ \\mathrm{T\\,m^2}$. For a curved surface, sum over every element $d\\vec A$:', [
        EQ('\\Phi_B = \\vec B \\cdot \\vec A = BA\\cos\\theta, \\qquad \\Phi_B = \\int \\vec B \\cdot d\\vec A'),
      ]),

      // ------------------------------------------------------------ 3
      H(1, 'Faraday’s law of induction'),
      BOX('law', 'Faraday’s law', 'The induced emf equals the negative rate of change of the flux linked with the circuit. Since $\\Phi_B = BA\\cos\\theta$, it can come from changing $B$ (transformers), the area $A$ (sliding rods) or the angle $\\theta$ (generators). For $N$ turns:', [
        EQ('\\boxed{\\varepsilon = -N\\,\\frac{d\\Phi_B}{dt}}'),
      ]),
      plot({
        functions: [
          { expr: 'exp(-(x-3)^2)', label: 'flux $\\Phi_B$ (relative)', dashed: true },
          { expr: '2*(x-3)*exp(-(x-3)^2)', label: 'induced emf $\\varepsilon = -d\\Phi_B/dt$' },
        ],
        xRange: [0, 6],
        yRange: [-1, 1.15],
        xLabel: 'time $t$ (arbitrary units)',
        yLabel: 'flux and emf',
        height: 112,
        caption: 'A magnet falling through a coil: the flux rises, peaks and falls, so the emf is a pulse that reverses where the flux peaks.',
      }),

      BOX('example', 'A coil in a growing field', 'A $200$-turn coil of area $0.010\\ \\mathrm{m^2}$ sees $B$ rise from $0.10$ to $0.50\\ \\mathrm{T}$ in $0.20\\ \\mathrm{s}$, so $|\\varepsilon| = NA\\,\\Delta B/\\Delta t = (200)(0.010)(0.40)/(0.20) = 4.0\\ \\mathrm{V}$. Through $10\\ \\Omega$ this drives $I = 0.40\\ \\mathrm{A}$.'),

      // ------------------------------------------------------------ 4
      H(1, 'Lenz’s law: the direction of the current'),
      BOX('principle', 'Lenz’s law', 'The induced current opposes the change in flux that causes it. This is the minus sign in Faraday’s law, and energy conservation in disguise.'),
      FIG(
        170,
        56,
        [
          { type: 'text', at: [42, 54], text: '(a) N pole approaching', fontSize: 8, color: '#6b645a' },
          { type: 'magnet', center: [22, 30], size: [28, 9], kind: 'SN' },
          { type: 'velocity', from: [14, 40], to: [30, 40], label: '$\\vec v$', width: 1.2 },
          { type: 'ellipse', center: [62, 30], rx: 4, ry: 14, color: '#8a5a3c', width: 1.6 },
          { type: 'into', at: [62, 44], label: '$I$' },
          { type: 'outof', at: [62, 16] },
          { type: 'arrow', from: [70, 30], to: [54, 30], color: '#b8605a', width: 1.1 },
          { type: 'text', at: [62, 6], text: 'near face N, repels', fontSize: 7.5, color: '#6b645a' },

          { type: 'line', from: [86, 4], to: [86, 52], dashed: true, color: '#cfc8bb', width: 0.6 },

          { type: 'text', at: [128, 54], text: '(b) N pole receding', fontSize: 8, color: '#6b645a' },
          { type: 'magnet', center: [108, 30], size: [28, 9], kind: 'SN' },
          { type: 'velocity', from: [116, 40], to: [100, 40], label: '$\\vec v$', width: 1.2 },
          { type: 'ellipse', center: [148, 30], rx: 4, ry: 14, color: '#8a5a3c', width: 1.6 },
          { type: 'outof', at: [148, 44], label: '$I$' },
          { type: 'into', at: [148, 16] },
          { type: 'arrow', from: [140, 30], to: [156, 30], color: '#b8605a', width: 1.1 },
          { type: 'text', at: [148, 6], text: 'near face S, attracts', fontSize: 7.5, color: '#6b645a' },
        ],
        'The induced field (red) opposes the magnet’s while the flux grows (a) and aids it while the flux shrinks (b). Eddy currents in solid metal obey the same rule, which is how magnetic brakes work.',
        68,
      ),

      // ------------------------------------------------------------ 5
      H(1, 'Motional emf'),
      P('Flux also changes when the circuit changes shape. A rod of length $\\ell$ slides at speed $v$ on rails joined by $R$; the enclosed area $\\ell x$ gives $\\Phi_B = B\\ell x$.'),
      FIG(
        140,
        56,
        [
          { type: 'field', kind: 'in', at: [16, 8], size: [104, 40], color: '#a7b4c3' },
          { type: 'line', from: [12, 8], to: [130, 8], width: 1.6, color: '#5b554c' },
          { type: 'line', from: [12, 48], to: [130, 48], width: 1.6, color: '#5b554c' },
          { type: 'resistor', from: [12, 48], to: [12, 8], label: '$R$', labelPos: 'left' },
          { type: 'rod', from: [84, 4], to: [84, 52], color: '#8a5a3c', width: 3 },
          { type: 'velocity', from: [86, 28], to: [108, 28], label: '$\\vec v$', width: 1.4 },
          { type: 'vector', from: [78, 16], to: [78, 40], label: '$I$', labelPos: 'left', color: '#b8605a', width: 1.1 },
          { type: 'dimension', from: [126, 8], to: [126, 48], label: '$\\ell$' },
          { type: 'dimension', from: [12, 2], to: [84, 2], label: '$x$' },
          { type: 'text', at: [24, 53.5], text: '$\\vec B$ into page', fontSize: 8, color: '#6b645a', labelPos: 'right' },
        ],
        'The sliding rod sweeps out area, so the flux grows at the rate $B\\ell v$.',
        50,
        'right',
        2,
      ),
      EQ('\\varepsilon = \\frac{d\\Phi_B}{dt} = B\\ell\\,\\frac{dx}{dt} = B\\ell v'),
      P('The force $q\\vec v \\times \\vec B$ drives charges up the rod. The current $I = B\\ell v/R$ then feels a force $BI\\ell$ opposing the motion, so the pushing power $Fv = \\varepsilon^2/R$ is exactly the heat produced in $R$.'),

      // ------------------------------------------------------------ 6
      H(1, 'Self-inductance'),
      P('A coil carrying current $I$ links its own flux $N\\Phi_B = LI$, where $L$ is the **self-inductance**. The resulting *back emf* resists any change of current, giving the circuit electrical inertia:'),
      EQ('\\varepsilon = -L\\,\\frac{dI}{dt}, \\qquad L_{\\text{solenoid}} = \\frac{\\mu_0 N^2 A}{\\ell} \\quad (\\mathrm{henry,\\ H})'),
      FIG(
        130,
        50,
        [
          { type: 'solenoid', from: [24, 26], to: [102, 26], r: 12, coils: 14, kind: 'noleads' },
          { type: 'arrow', from: [6, 26], to: [122, 26], color: '#5f7d9c', width: 1, label: '$\\vec B$', labelPos: 'end' },
          { type: 'dimension', from: [24, 6], to: [102, 6], label: '$\\ell$' },
          { type: 'text', at: [63, 46], text: '$N$ turns, cross-section $A$', fontSize: 8, color: '#6b645a' },
        ],
        'Inside a long solenoid, $B = \\mu_0 n I$, $n = N/\\ell$.',
        42,
        'left',
      ),
      BOX('example', 'Inductance of an air-cored coil', 'With $N = 500$, $\\ell = 25\\ \\mathrm{cm}$ and $r = 1.0\\ \\mathrm{cm}$, $L \\approx 0.39\\ \\mathrm{mH}$. An iron core multiplies this by $\\mu_r$, often over a thousand.'),

      // ------------------------------------------------------------ 7
      H(1, 'Mutual inductance'),
      P('A changing current in one coil (the primary) changes the flux through a neighbour (the secondary) and induces an emf there. This coupling is the principle of every transformer.'),
      FIG(
        150,
        56,
        [
          { type: 'solenoid', from: [14, 34], to: [58, 34], r: 10, coils: 8, label: 'primary N₁' },
          { type: 'wire', points: [[14, 14], [14, 5], [22, 5]] },
          { type: 'battery', from: [22, 5], to: [38, 5] },
          { type: 'switch', from: [40, 5], to: [54, 5], label: 'S', labelPos: 'below' },
          { type: 'wire', points: [[38, 5], [40, 5]] },
          { type: 'wire', points: [[54, 5], [58, 5], [58, 14]] },
          { type: 'arrow', from: [62, 34], to: [84, 34], dashed: true, color: '#5f7d9c', width: 1, label: 'linked flux Φ₂₁' },
          { type: 'solenoid', from: [90, 34], to: [136, 34], r: 10, coils: 9, label: 'secondary N₂' },
          { type: 'wire', points: [[90, 14], [90, 5], [104, 5]] },
          { type: 'galvanometer', from: [104, 5], to: [122, 5] },
          { type: 'wire', points: [[122, 5], [136, 5], [136, 14]] },
        ],
        'Switching $I_1$ on or off makes G kick in the separate secondary.',
        52,
        'right',
      ),
      P('The secondary links flux $N_2\\Phi_{21} = M I_1$, where $M$ is the **mutual inductance**. For coils on one long former, and in general,'),
      EQ('\\varepsilon_2 = -M\\,\\frac{dI_1}{dt}, \\qquad M = \\frac{\\mu_0 N_1 N_2 A}{\\ell}, \\qquad M = k\\sqrt{L_1 L_2}\\ \\ (0 \\le k \\le 1)'),

      // ------------------------------------------------------------ 8
      H(1, 'Energy and the RL circuit'),
      P('Building up current takes work against the back emf at the rate $LI\\,dI/dt$. Integrating gives the stored energy, and its density for any magnetic field:'),
      EQ('U = \\int_0^I L I\\,dI = \\tfrac12 L I^2, \\qquad u_B = \\frac{B^2}{2\\mu_0}'),
      FIG(
        120,
        44,
        [
          { type: 'battery', from: [10, 8], to: [10, 36], label: '$\\varepsilon$', labelPos: 'left' },
          { type: 'wire', points: [[10, 36], [10, 40], [24, 40]] },
          { type: 'switch', from: [24, 40], to: [40, 40], label: 'S' },
          { type: 'resistor', from: [40, 40], to: [76, 40], label: '$R$' },
          { type: 'wire', points: [[76, 40], [100, 40], [100, 36]] },
          { type: 'inductor', from: [100, 36], to: [100, 8], label: '$L$' },
          { type: 'wire', points: [[100, 8], [100, 4], [10, 4], [10, 8]] },
        ],
        'A series RL circuit.',
        36,
        'left',
        2,
      ),
      P('The loop rule $\\varepsilon = IR + L\\,dI/dt$ gives an exponential rise; with the battery removed the current decays:'),
      EQ('\\begin{aligned} I_{\\text{growth}} &= \\frac{\\varepsilon}{R}\\left(1 - e^{-t/\\tau}\\right) \\\\ I_{\\text{decay}} &= I_0\\, e^{-t/\\tau}, \\quad \\tau = \\frac{L}{R} \\end{aligned}'),
      plot({
        functions: [
          { expr: '1-exp(-x)', label: 'growth (switch closed)', domain: [0, 5] },
          { expr: 'exp(-(x-5))', label: 'decay (battery removed)', domain: [5, 10], dashed: true },
        ],
        xRange: [0, 10],
        yRange: [0, 1.1],
        hlines: [{ y: 0.632, label: '$63\\%$' }],
        vlines: [{ x: 1, label: '$\\tau$' }],
        xLabel: 'time $t/\\tau$',
        yLabel: 'current $I R/\\varepsilon$',
        height: 112,
        caption: 'After one time constant the current reaches $63\\%$ of its final value; after $5\\tau$, within $1\\%$.',
      }),

      // ------------------------------------------------------------ 9
      H(1, 'The AC generator'),
      FIG(
        150,
        76,
        [
          { type: 'pole', center: [18, 48], size: [20, 36], kind: 'N' },
          { type: 'pole', center: [114, 48], size: [20, 36], kind: 'S' },
          { type: 'field', kind: 'right', at: [30, 34], size: [72, 28], color: '#c9d0d8' },
          { type: 'polygon', points: [[52, 34], [80, 40], [80, 64], [52, 58]], fill: 'none', color: '#8a5a3c', width: 1.8 },
          { type: 'line', from: [66, 72], to: [66, 12], dashed: true, color: '#9a948b', width: 0.7 },
          { type: 'arc', center: [66, 70], r: 5, startAngle: 200, endAngle: 340, arrow: 'end', color: '#3a3631' },
          { type: 'text', at: [73, 72], text: '$\\omega$', fontSize: 9, labelPos: 'right' },
          { type: 'wire', points: [[52, 34], [62, 26], [62, 20]], color: '#8a5a3c' },
          { type: 'wire', points: [[80, 40], [70, 28], [70, 14]], color: '#8a5a3c' },
          { type: 'ellipse', center: [66, 20], rx: 5, ry: 1.6, color: '#7d766b', width: 1.2 },
          { type: 'ellipse', center: [66, 14], rx: 5, ry: 1.6, color: '#7d766b', width: 1.2 },
          { type: 'rect', center: [73, 20], size: [3, 2.4], fill: '#5b554c', color: '#5b554c' },
          { type: 'rect', center: [73, 14], size: [3, 2.4], fill: '#5b554c', color: '#5b554c' },
          { type: 'wire', points: [[74.5, 20], [130, 20], [130, 18]] },
          { type: 'wire', points: [[74.5, 14], [96, 14], [96, 5], [130, 5], [130, 8]] },
          { type: 'bulb', from: [130, 18], to: [130, 8] },
          { type: 'text', at: [80, 25], text: 'slip rings', fontSize: 7, color: '#6b645a', labelPos: 'right' },
        ],
        'A simple AC generator.',
        48,
        'left',
        2,
      ),
      P('A coil of $N$ turns and area $A$ rotating at angular speed $\\omega$ in a uniform field has $\\theta = \\omega t$, so its flux varies as a cosine and the emf as a sine.'),
      EQ('\\begin{aligned} \\Phi_B &= BA\\cos\\omega t \\\\ \\varepsilon &= -N\\frac{d\\Phi_B}{dt} = NBA\\omega\\,\\sin\\omega t \\end{aligned}'),
      plot({
        functions: [
          { expr: 'cos(x)', label: 'flux $\\Phi_B / NBA$', dashed: true },
          { expr: 'sin(x)', label: 'emf $\\varepsilon / \\varepsilon_0$' },
        ],
        xRange: [0, 12.566],
        yRange: [-1.2, 1.2],
        xLabel: 'phase $\\omega t$ (rad)',
        yLabel: 'relative value',
        height: 106,
        caption: 'The emf peaks when the flux is zero, and vanishes when the flux peaks.',
      }),
      BOX('example', 'Mains frequency', '$100$ turns of area $0.050\\ \\mathrm{m^2}$ turning at $50\\ \\mathrm{Hz}$ in $0.20\\ \\mathrm{T}$: $\\omega = 314\\ \\mathrm{rad\\,s^{-1}}$, so $\\varepsilon_0 = NBA\\omega = 314\\ \\mathrm{V}$.'),

      // ------------------------------------------------------------ 10
      H(1, 'Teacher viva: questions you must answer aloud'),
      P('Practise these without looking at the formulas. Begin with the physical idea, state the relevant law, then give the mathematical relation with units and assumptions.'),
      H(2, 'Rapid-fire conceptual questions'),
      L([
          '**Why is no current induced when a magnet is held still inside a coil?** Flux may be large, but $d\\Phi_B/dt=0$.',
          '**What does the minus sign in Faraday’s law mean?** The induced effect opposes the *change* in linked flux; it expresses Lenz’s law and energy conservation.',
          '**Can emf exist without current?** Yes. An open circuit can have induced emf, but current requires a closed conducting path.',
          '**How can flux change if $B$ is constant?** Change area, orientation, or the fraction of the field intercepted by the loop.',
          '**Why does a transformer require alternating current?** A steady primary current gives steady flux, so the secondary has no sustained induced emf.',
          '**Why are transformer cores laminated?** Thin insulated sheets interrupt eddy-current loops and reduce heating.',
          '**What sets the direction of motional emf?** The magnetic force $q\\vec v\\times\\vec B$, combined with Lenz’s law for the complete circuit.',
          '**Where is energy stored in an inductor?** In its magnetic field, with $U=LI^2/2$ and density $u_B=B^2/(2\\mu)$.',
          '**Why can current through an ideal inductor not jump instantly?** An instantaneous change would require infinite $dI/dt$ and therefore infinite back emf.',
          '**At $t=\\tau$ in an RL growth circuit, what has happened?** Current reaches $1-e^{-1}=63.2\\%$ of its final value.',
          '**Flux and emf in a generator are how far out of phase?** One quarter-cycle, or $\\pi/2$ radians.',
          '**Does Lenz’s law oppose motion in every case?** It opposes the flux change; magnetic drag is the mechanical consequence when motion causes that change.',
        ], true),
      H(2, 'Exam-level numerical checklist'),
      L([
        '[ ] I write the flux linkage $N\\Phi_B$ before differentiating.',
        '[ ] I convert centimetres to metres and milliseconds to seconds.',
        '[ ] I separate emf magnitude from direction.',
        '[ ] I state whether the circuit is open or closed before finding current.',
        '[ ] I check dimensions: $\\mathrm{Wb/s}=\\mathrm{V}$ and $\\mathrm{H/\\Omega}=\\mathrm{s}$.',
        '[ ] I test limiting cases such as $t=0$, $t\\to\\infty$, or $\\theta=90^\\circ$.',
      ], false),
      BOX('tip', 'A strong oral answer', 'Use this four-part pattern: **observation → law → equation → consequence**. Example: “The linked flux is decreasing; by Lenz’s law the coil reinforces the original field; Faraday’s law gives $|\\varepsilon|=N|d\\Phi/dt|$; therefore the induced current reverses when the motion reverses.”'),

      // ------------------------------------------------------------ 11
      H(1, 'Summary'),
      TABLE(
        ['Quantity', 'Relation', 'SI unit'],
        [
          ['Magnetic flux', '$\\Phi_B = BA\\cos\\theta$', 'weber (Wb)'],
          ['Faraday’s law', '$\\varepsilon = -N\\, d\\Phi_B/dt$', 'volt (V)'],
          ['Motional emf', '$\\varepsilon = B\\ell v$', 'volt (V)'],
          ['Self-inductance', '$\\varepsilon = -L\\, dI/dt$,  $L = \\mu_0 N^2 A/\\ell$', 'henry (H)'],
          ['Mutual inductance', '$\\varepsilon_2 = -M\\, dI_1/dt$', 'henry (H)'],
          ['Energy in an inductor', '$U = LI^2/2$', 'joule (J)'],
          ['RL time constant', '$\\tau = L/R$', 'second (s)'],
          ['AC generator', '$\\varepsilon = NBA\\omega \\sin\\omega t$', 'volt (V)'],
        ],
        'The key results of the chapter.',
      ),
    ],
  };
}
