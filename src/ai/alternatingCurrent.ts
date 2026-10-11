import type { Block, DocSpec } from '../types';
import { BOX, EQ, FIG, H, L, P, TABLE, meta } from './science';

const plot = (p: Omit<Extract<Block, { type: 'plot' }>, 'id' | 'type'>): Block => BOX('note', 'Graph insight', p.caption ?? 'Compare how the plotted quantities vary with phase or frequency.');
const ACSTEPS = (items: { text?: string; math?: string }[], _title?: string): Block => L(items.map((x, i) => `**Step ${i + 1}:** ${x.text ?? `$${x.math}$`}`), true);

export function alternatingCurrent(): DocSpec {
  return {
    meta: meta('Alternating Current', 'Class XII · A deep visual guide to phasors, reactance, resonance, power and transformers', 'ink', {
      kicker: 'SENIOR PHYSICS · ELECTRODYNAMICS · MASTERCLASS EDITION', cover: false, toc: false,
      numberedHeadings: true, density: 'comfortable', pageNumbers: true,
      footer: 'Advanced Physics Masterclass · Alternating Current',
    }),
    blocks: [
      BOX('abstract', undefined, 'Alternating current is not simply “current that changes direction.” It is a continuously evolving electrical state in which voltage, current, stored electric energy and stored magnetic energy exchange in a precise rhythm. These notes build the chapter from the rotating-vector picture, so every formula has a physical meaning.'),

      H(1, 'The big picture: what alternates and why?'),
      P('A direct current keeps one direction. An alternating current changes both **magnitude and direction periodically**. Power stations generate AC because electromagnetic induction naturally produces a sinusoid, transformers can then change its voltage efficiently, and high-voltage transmission greatly reduces heating loss.'),
      FIG(170, 88, [
        { type: 'source', center: [15,44], r: 8, label: 'AC generator' },
        { type: 'wire', points: [[23,44],[44,44]] },
        { type: 'inductor', from: [44,44], to: [70,44], coils: 6, label: 'step-up' },
        { type: 'wire', points: [[70,44],[105,44]] },
        { type: 'text', at: [87,52], text: 'high-voltage grid', fontSize: 8 },
        { type: 'inductor', from: [105,44], to: [131,44], coils: 6, label: 'step-down' },
        { type: 'wire', points: [[131,44],[153,44]] },
        { type: 'bulb', center: [159,44], r: 7, label: 'load' },
        { type: 'arrow', from: [30,66], to: [143,66], label: 'energy transported with small $I^2R$ loss', labelPos: 'above' },
      ], 'The logic of the AC power system: generate, transform, transmit and transform again.'),
      BOX('key', 'One idea to keep throughout', 'The source sets the **voltage frequency**. The circuit elements decide the **current amplitude** and its **phase** relative to voltage.'),

      H(1, 'Sinusoidal voltage and current'),
      P('For a sinusoidal source, instantaneous voltage and current are written'),
      EQ('v(t)=V_m\\sin(\\omega t),\\qquad i(t)=I_m\\sin(\\omega t+\\phi)'),
      TABLE(['Symbol','Meaning','SI unit'], [['$V_m,I_m$','peak (maximum) values','V, A'],['$\\omega$','angular frequency $=2\\pi f$','rad s$^{-1}$'],['$f$','cycles per second','Hz'],['$T$','time for one cycle $=1/f$','s'],['$\\phi$','phase of current relative to voltage','rad or degree']]),
      plot({ functions: [
        { expr: 'sin(x)', label: '$v/V_m$', domain: [0,12.57] },
        { expr: '0.72*sin(x-1.047)', label: '$i/I_m$ (lags $60°$)', domain: [0,12.57], dashed: true },
      ], xRange:[0,12.57], yRange:[-1.25,1.25], xLabel:'phase $\\omega t$', yLabel:'normalised value', caption:'Two complete cycles. Horizontal separation measures phase difference.' }),
      BOX('note', 'Reading a sinusoid deeply', 'At a zero crossing the quantity is momentarily zero but changing fastest. At a crest its value is greatest but its rate of change is zero. This distinction explains inductor and capacitor phase relations.'),

      H(1, 'Mean and RMS values'),
      P('The average of a sine wave over a complete cycle is zero, which does **not** mean AC delivers no energy. Heating depends on $i^2$, which stays positive. The RMS current is the DC current producing the same heat in a resistor.'),
      EQ('I_{\\rm rms}=\\sqrt{\\frac{1}{T}\\int_0^T i^2dt}=\\frac{I_m}{\\sqrt2},\\qquad V_{\\rm rms}=\\frac{V_m}{\\sqrt2}'),
      BOX('formula', 'Household rating', 'A 230 V AC supply means **230 V RMS**, not peak. Its peak is $V_m=230\\sqrt2\\approx325$ V.'),
      ACSTEPS([{text:'Start with $i=I_m\\sin\\omega t$.'},{math:'I_{rms}^2=\\frac1T\\int_0^T I_m^2\\sin^2\\omega t\\,dt'},{text:'Over a full cycle, the mean of $\\sin^2$ is $1/2$.'},{math:'I_{rms}=I_m/\\sqrt2'}], 'Derivation of RMS current'),

      H(1, 'The phasor method'),
      P('A phasor is a rotating vector. Its vertical projection produces the instantaneous sinusoid. Phasors convert differential relations into geometry: vector lengths represent amplitudes and angular separation represents phase.'),
      FIG(150, 78, [
        { type:'line', from:[15,18], to:[105,18], color:'#777' }, { type:'line', from:[15,18], to:[15,70], color:'#777' },
        { type:'vector', from:[15,18], to:[72,61], label:'$V_m$', color:'#17365d' },
        { type:'angle', at:[15,18], startAngle:0, endAngle:37, r:18, label:'$\\omega t$' },
        { type:'line', from:[72,61], to:[72,18], dashed:true, color:'#777' },
        { type:'text', at:[72,11], text:'projection = $V_m\\sin\\omega t$', fontSize:8 },
        { type:'text', at:[125,60], text:'rotates CCW', fontSize:8 },
        { type:'arc', center:[122,36], r:15, startAngle:10, endAngle:285 },
      ], 'A sinusoid is the shadow of uniform circular motion. The phasor itself is not a physical rotating wire.'),

      H(1, 'Pure resistor: voltage and current in phase'),
      P('A resistor stores no energy. At each instant Ohm’s law applies, so current rises, crosses zero and falls exactly with voltage.'),
      EQ('v=V_m\\sin\\omega t,\\quad i=\\frac vR=I_m\\sin\\omega t,\\quad I_m=V_m/R'),
      FIG(160, 55, [
        { type:'source', center:[18,28], r:8, label:'$v$' }, { type:'wire', points:[[26,28],[58,28]] },
        { type:'resistor', from:[58,28], to:[105,28], label:'$R$' }, { type:'wire', points:[[105,28],[142,28],[142,45],[18,45],[18,36]] },
        { type:'arrow', from:[38,18], to:[58,18], label:'$i$', labelPos:'above' },
      ], 'Pure resistive AC circuit.'),
      EQ('P_{av}=V_{rms}I_{rms}=I_{rms}^2R=\\frac{V_{rms}^2}{R}'),

      H(1, 'Pure inductor: current lags by $90°$'),
      P('An inductor opposes a **change** in current by producing self-induced emf. From $v=L\\,di/dt$, integration shows that current reaches its maximum one-quarter cycle after voltage.'),
      EQ('i=I_m\\sin(\\omega t-\\pi/2),\\qquad X_L=\\omega L,\\qquad I_m=\\frac{V_m}{X_L}'),
      FIG(160, 68, [
        { type:'source', center:[18,34], r:8, label:'$v$' }, { type:'wire', points:[[26,34],[55,34]] },
        { type:'inductor', from:[55,34], to:[108,34], coils:7, label:'$L$' }, { type:'wire', points:[[108,34],[142,34],[142,53],[18,53],[18,42]] },
        { type:'vector', from:[125,13], to:[154,13], label:'$V_L$', color:'#17365d' },
        { type:'vector', from:[125,13], to:[125,38], label:'$I$', color:'#9b2c2c' },
      ], 'Circuit and phasors: $V_L$ leads $I$ by $90°$.'),
      BOX('note', 'Frequency response', 'At high frequency, current must change rapidly, producing a large back emf. Therefore $X_L=2\\pi fL$ increases with frequency: an inductor passes low frequency more easily than high frequency.'),
      P('During one quarter-cycle the source stores magnetic energy $U_B=\\tfrac12Li^2$; during the next it receives that energy back. Hence an ideal inductor has zero average power.'),

      H(1, 'Pure capacitor: current leads by $90°$'),
      P('A capacitor draws current while its charge—and therefore voltage—is changing. Since $i=C\\,dv/dt$, current is maximum when voltage crosses zero and zero when voltage is at an extreme.'),
      EQ('i=I_m\\sin(\\omega t+\\pi/2),\\qquad X_C=\\frac1{\\omega C},\\qquad I_m=\\frac{V_m}{X_C}'),
      FIG(160, 68, [
        { type:'source', center:[18,34], r:8, label:'$v$' }, { type:'wire', points:[[26,34],[64,34]] },
        { type:'capacitor', from:[64,34], to:[99,34], label:'$C$' }, { type:'wire', points:[[99,34],[142,34],[142,53],[18,53],[18,42]] },
        { type:'vector', from:[125,38], to:[125,13], label:'$I$', color:'#9b2c2c' },
        { type:'vector', from:[125,38], to:[154,38], label:'$V_C$', color:'#17365d' },
      ], 'Circuit and phasors: $I$ leads $V_C$ by $90°$.'),
      BOX('note', 'Frequency response', 'At high frequency there is little time to accumulate charge, so a small voltage drives appreciable current. Thus $X_C=1/(2\\pi fC)$ decreases with frequency: a capacitor blocks DC but passes rapidly varying signals.'),

      H(1, 'Series LCR circuit'),
      P('The same current flows through all three elements. Use current as the reference phasor. $V_R$ lies along $I$, $V_L$ points upward, and $V_C$ points downward. Because opposite phasors subtract, voltages must **not** be added arithmetically.'),
      FIG(170, 80, [
        { type:'source', center:[14,44], r:8, label:'$v$' }, { type:'wire', points:[[22,44],[37,44]] },
        { type:'resistor', from:[37,44], to:[72,44], label:'$R$' }, { type:'inductor', from:[72,44], to:[112,44], coils:6, label:'$L$' },
        { type:'capacitor', from:[112,44], to:[137,44], label:'$C$' }, { type:'wire', points:[[137,44],[157,44],[157,65],[14,65],[14,52]] },
        { type:'arrow', from:[30,28], to:[53,28], label:'$i$', labelPos:'above' },
      ], 'A series LCR circuit driven by a sinusoidal source.'),
      FIG(150, 95, [
        { type:'vector', from:[25,30], to:[100,30], label:'$V_R$', color:'#17365d' },
        { type:'vector', from:[100,30], to:[100,78], label:'$V_L-V_C$', color:'#8b1e3f' },
        { type:'vector', from:[25,30], to:[100,78], label:'$V$', color:'#5a7d3a' },
        { type:'angle', at:[25,30], startAngle:0, endAngle:33, r:22, label:'$\\phi$' },
        { type:'text', at:[60,19], text:'$I$ reference', fontSize:8 },
      ], 'Voltage triangle for the net inductive case $X_L>X_C$.'),
      EQ('Z=\\sqrt{R^2+(X_L-X_C)^2},\\qquad I_{rms}=\\frac{V_{rms}}{Z}'),
      EQ('\\tan\\phi=\\frac{X_L-X_C}{R},\\qquad \\cos\\phi=\\frac{R}{Z}'),
      TABLE(['Condition','Nature','Current relative to source voltage'], [['$X_L>X_C$','inductive','lags'],['$X_C>X_L$','capacitive','leads'],['$X_L=X_C$','resonant / resistive','in phase']]),

      H(1, 'Resonance'),
      P('At resonance the inductive and capacitive reactances cancel. Impedance becomes minimum, current becomes maximum and the source only replaces energy lost in resistance. Large internal voltages may still appear across $L$ and $C$.'),
      EQ('\\omega_0L=\\frac1{\\omega_0C}\\quad\\Rightarrow\\quad \\omega_0=\\frac1{\\sqrt{LC}},\\qquad f_0=\\frac1{2\\pi\\sqrt{LC}}'),
      plot({ functions:[
        { expr:'1/sqrt(1+25*(x-1/x)^2)', label:'small $R$: sharp resonance', domain:[0.25,2.5] },
        { expr:'1/sqrt(1+4*(x-1/x)^2)', label:'large $R$: broad resonance', domain:[0.25,2.5], dashed:true },
      ], xRange:[0.2,2.5], yRange:[0,1.15], xLabel:'normalised frequency $f/f_0$', yLabel:'normalised current', caption:'Resonance curves. Lower resistance gives greater selectivity and a sharper peak.' }),
      EQ('Q=\\frac{\\omega_0L}{R}=\\frac1{\\omega_0CR},\\qquad \\Delta f=\\frac{f_0}{Q}'),
      BOX('tip', 'Why tuning works', 'A radio’s variable capacitor changes $f_0$. At the desired station frequency, current response is large; nearby frequencies are suppressed. High $Q$ means good selectivity.'),

      H(1, 'AC power and power factor'),
      P('Instantaneous power $p=vi$ fluctuates. Averaging over a cycle gives'),
      EQ('P_{av}=V_{rms}I_{rms}\\cos\\phi'),
      P('The factor $\\cos\\phi$ tells what fraction of apparent power is converted to net useful energy. Inductors and capacitors exchange reactive energy with the source; resistance dissipates real energy.'),
      TABLE(['Quantity','Expression','Unit'], [['Real (active) power','$P=VI\\cos\\phi$','W'],['Reactive power','$Q=VI\\sin\\phi$','var'],['Apparent power','$S=VI$','VA']]),
      BOX('warning', 'Wattless current does not mean zero current', 'For a pure $L$ or $C$, $\\phi=90°$ and average power is zero, but instantaneous current and energy exchange are real. “Wattless” means no **net energy per cycle**.'),
      BOX('key', 'Why industries correct power factor', 'For fixed useful power, $I=P/(V\\cos\\phi)$. A low power factor requires larger current, causing larger $I^2R$ losses and thicker cables. Capacitor banks compensate inductive loads.'),

      H(1, 'Transformer'),
      P('A transformer uses **mutual induction** to transfer AC power between two coils on a common laminated iron core. The changing primary current creates changing core flux, inducing emf in both windings.'),
      EQ('\\frac{V_s}{V_p}=\\frac{N_s}{N_p},\\qquad V_pI_p=V_sI_s,\\qquad \\frac{I_s}{I_p}=\\frac{N_p}{N_s}'),
      H(2, 'Transformer losses and their reduction'),
      L(['**Copper loss:** $I^2R$ heating; use thick, low-resistance copper.', '**Eddy-current loss:** currents induced in the core; use thin insulated laminations.', '**Hysteresis loss:** repeated magnetisation; use soft iron or silicon steel.', '**Flux leakage:** incomplete linkage; use a closed, high-permeability core.']),
      P('**Important:** A transformer does not work on steady DC. DC gives only a brief transient at switching and can overheat the primary because inductive reactance disappears.'),

    ],
  };
}
