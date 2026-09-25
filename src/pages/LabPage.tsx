import { useState } from 'react';
import type { CircuitModel } from '../lib/sim/types.js';
import { simulate } from '../lib/sim/engine.js';
import CircuitCanvas from '../components/CircuitCanvas.js';
import PowerCalculator from '../components/PowerCalculator.js';
import { useStore } from '../lib/state/store.js';

interface SavedLab {
  id: string;
  name: string;
  savedAt: number;
  model: CircuitModel;
}

const SAVE_KEY = 'SiLo-lab-saves';

function readSaves(): SavedLab[] {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as SavedLab[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeSaves(saves: SavedLab[]) {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(saves));
  } catch {
    // storage full or unavailable — ignore
  }
}

interface Preset {
  id: string;
  name: string;
  description: string;
  build: () => CircuitModel;
}

const PRESETS: Preset[] = [
  {
    id: 'first-light',
    name: 'First light',
    description: 'A battery, a resistor, and an LED.',
    build: () => ({
      components: [
        { id: 'bat1', kind: 'battery', a: { x: 1, y: 1 }, b: { x: 1, y: 4 }, value: 9 },
        { id: 'w1', kind: 'wire', a: { x: 1, y: 1 }, b: { x: 3, y: 1 } },
        { id: 'r1', kind: 'resistor', a: { x: 3, y: 1 }, b: { x: 4, y: 1 }, value: 330 },
        { id: 'led1', kind: 'led', a: { x: 4, y: 1 }, b: { x: 4, y: 4 }, color: '#ffdd00' },
        { id: 'w2', kind: 'wire', a: { x: 4, y: 4 }, b: { x: 1, y: 4 } },
      ],
    }),
  },
  {
    id: 'the-switch',
    name: 'The switch',
    description: 'Click the switch to turn the LED on and off.',
    build: () => ({
      components: [
        { id: 'bat1', kind: 'battery', a: { x: 1, y: 1 }, b: { x: 1, y: 4 }, value: 9 },
        { id: 'w1', kind: 'wire', a: { x: 1, y: 1 }, b: { x: 3, y: 1 } },
        { id: 'r1', kind: 'resistor', a: { x: 3, y: 1 }, b: { x: 4, y: 1 }, value: 330 },
        { id: 'led1', kind: 'led', a: { x: 4, y: 1 }, b: { x: 4, y: 4 }, color: '#ffdd00' },
        { id: 'w2', kind: 'wire', a: { x: 4, y: 4 }, b: { x: 2, y: 4 } },
        { id: 's1', kind: 'switch', a: { x: 2, y: 4 }, b: { x: 1, y: 4 }, closed: true },
      ],
    }),
  },
  {
    id: 'two-resistors',
    name: 'Two resistors',
    description: 'Series resistance adds up. Try editing the values.',
    build: () => ({
      components: [
        { id: 'bat1', kind: 'battery', a: { x: 1, y: 1 }, b: { x: 1, y: 4 }, value: 9 },
        { id: 'w1', kind: 'wire', a: { x: 1, y: 1 }, b: { x: 2, y: 1 } },
        { id: 'r1', kind: 'resistor', a: { x: 2, y: 1 }, b: { x: 3, y: 1 }, value: 330 },
        { id: 'r2', kind: 'resistor', a: { x: 3, y: 1 }, b: { x: 4, y: 1 }, value: 220 },
        { id: 'led1', kind: 'led', a: { x: 4, y: 1 }, b: { x: 4, y: 4 }, color: '#ffdd00' },
        { id: 'w2', kind: 'wire', a: { x: 4, y: 4 }, b: { x: 1, y: 4 } },
      ],
    }),
  },
  {
    id: 'big-voltage',
    name: 'Big voltage',
    description: '12V into a 1kΩ resistor powers this lamp.',
    build: () => ({
      components: [
        { id: 'bat1', kind: 'battery', a: { x: 1, y: 1 }, b: { x: 1, y: 4 }, value: 12 },
        { id: 'w1', kind: 'wire', a: { x: 1, y: 1 }, b: { x: 3, y: 1 } },
        { id: 'r1', kind: 'resistor', a: { x: 3, y: 1 }, b: { x: 4, y: 1 }, value: 1000 },
        { id: 'lam1', kind: 'lamp', a: { x: 4, y: 1 }, b: { x: 4, y: 4 } },
        { id: 'w2', kind: 'wire', a: { x: 4, y: 4 }, b: { x: 1, y: 4 } },
      ],
    }),
  },
];

const RESISTOR_VALUES = [220, 330, 470, 1000, 2200, 10000];

export default function LabPage() {
  const countLabBuild = useStore((s) => s.countLabBuild);
  const [presetId, setPresetId] = useState(PRESETS[0].id);
  const [model, setModel] = useState<CircuitModel>(() => PRESETS[0].build());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [saves, setSaves] = useState<SavedLab[]>(readSaves);
  const [saveName, setSaveName] = useState('');
  const [activeSave, setActiveSave] = useState<string | null>(null);

  const loadPreset = (id: string) => {
    const preset = PRESETS.find((p) => p.id === id);
    if (!preset) return;
    setPresetId(id);
    setModel(preset.build());
    setSelectedId(null);
    setActiveSave(null);
  };

  const saveCircuit = () => {
    const name =
      saveName.trim().slice(0, 32) || `My circuit #${saves.length + 1}`;
    const save: SavedLab = {
      id: activeSave ?? crypto.randomUUID(),
      name,
      savedAt: Date.now(),
      model,
    };
    const next = activeSave
      ? saves.map((s) => (s.id === activeSave ? save : s))
      : [...saves, save];
    setSaves(next);
    writeSaves(next);
    setActiveSave(save.id);
    setSaveName('');
    countLabBuild();
  };

  const loadSave = (id: string) => {
    const save = saves.find((s) => s.id === id);
    if (!save) return;
    setModel(JSON.parse(JSON.stringify(save.model)) as CircuitModel);
    setPresetId('');
    setSelectedId(null);
    setActiveSave(id);
    setSaveName(save.name);
  };

  const deleteSave = (id: string) => {
    const next = saves.filter((s) => s.id !== id);
    setSaves(next);
    writeSaves(next);
    if (activeSave === id) {
      setActiveSave(null);
      setSaveName('');
      loadPreset(PRESETS[0].id);
    }
  };

  const updateComponent = (id: string, patch: Partial<CircuitModel['components'][number]>) => {
    setModel((m) => ({
      ...m,
      components: m.components.map((c) => (c.id === id ? { ...c, ...patch } : c)),
    }));
  };

  const toggleSwitch = (id: string, kind: string) => {
    if (kind === 'switch') {
      setModel((m) => ({
        ...m,
        components: m.components.map((c) =>
          c.id === id && c.kind === 'switch' ? { ...c, closed: !(c.closed ?? true) } : c,
        ),
      }));
    }
  };

  const handleClick = (id: string) => {
    const comp = model.components.find((c) => c.id === id);
    if (comp?.kind === 'switch') {
      toggleSwitch(id, 'switch');
    } else {
      setSelectedId(id === selectedId ? null : id);
    }
  };

  const result = simulate(model);
  const selected = model.components.find((c) => c.id === selectedId) ?? null;
  const ledCurrent =
    model.components
      .filter((c) => c.kind === 'led' || c.kind === 'lamp')
      .map((c) => result?.componentCurrents.get(c.id) ?? 0)
      .find((v) => v > 1e-6) ?? 0;

  return (
    <div className="lab-page">
      <h1>Circuit Lab</h1>
      <p className="page-subline">
        An open bench. Adjust values, flip switches, watch behavior.
      </p>

      <div className="preset-chips">
        {PRESETS.map((p) => (
          <button
            key={p.id}
            className={`chip ${presetId === p.id ? 'active' : ''}`}
            onClick={() => loadPreset(p.id)}
          >
            {p.name}
          </button>
        ))}
      </div>

      <div className="lab-readout">
        <span className={`readout-led ${ledCurrent > 1e-6 ? 'on' : ''}`}>
          {PRESETS.find((p) => p.id === presetId)?.description ??
            'A saved circuit — edit away.'}
        </span>
      </div>

      <div className="lab-layout">
        <div className="circuit-frame lab-canvas">
          <CircuitCanvas model={model} onComponentClick={handleClick} />
        </div>

        <div className="inspector">
          <h3 className="inspector-title">
            {selected ? (
              <>
                {selected.kind === 'battery' && '🔋 Battery'}
                {selected.kind === 'resistor' && '🔌 Resistor'}
                {selected.kind === 'led' && '💡 LED'}
                {selected.kind === 'lamp' && '💡 Lamp'}
                {selected.kind === 'switch' && '🛑 Switch'}
                {selected.kind === 'wire' && '〰️ Wire'}
              </>
            ) : (
              'Tap a component'
            )}
          </h3>

          {!selected && (
            <p className="inspector-empty">
              Tap a component in the circuit to inspect it. Tap the switch to
              flip it.
            </p>
          )}

          {selected?.kind === 'battery' && (
            <ValueStepper
              label="Voltage"
              value={selected.value ?? 9}
              step={0.5}
              min={1.5}
              max={24}
              unit="V"
              onChange={(v) => updateComponent(selected.id, { value: v })}
            />
          )}

          {selected?.kind === 'resistor' && (
            <>
              <p className="inspector-hint">Tap a value to change it:</p>
              <div className="value-chips">
                {RESISTOR_VALUES.map((v) => (
                  <button
                    key={v}
                    className={`chip ${(selected.value ?? 330) === v ? 'active' : ''}`}
                    onClick={() => updateComponent(selected.id, { value: v })}
                  >
                    {v >= 1000 ? `${v / 1000}kΩ` : `${v}Ω`}
                  </button>
                ))}
              </div>
            </>
          )}

          {selected?.kind === 'switch' && (
            <div className="inspector-row">
              <span>State</span>
              <button
                className="btn-primary btn-inline"
                onClick={() => toggleSwitch(selected.id, 'switch')}
              >
                Turn {selected.closed ? 'OFF' : 'ON'}
              </button>
            </div>
          )}

          {selected && (
            <div className="inspector-readings">
              {selected.kind === 'led' && (
                <p>
                  Forward voltage: <strong>2.0V</strong>, current:{' '}
                  <strong>
                    {((result?.componentCurrents.get(selected.id) ?? 0) * 1000).toFixed(1)} mA
                  </strong>
                </p>
              )}
              {selected.kind === 'resistor' && (
                <p>
                  Power: <strong>{(result?.componentPowers.get(selected.id) ?? 0).toFixed(4)} W</strong>
                </p>
              )}
              {selected.kind === 'lamp' && (
                <p>
                  Lamp current:{' '}
                  <strong>
                    {((result?.componentCurrents.get(selected.id) ?? 0) * 1000).toFixed(1)} mA
                  </strong>
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="save-bar">
        <input
          className="nick-input save-input"
          value={saveName}
          onChange={(e) => setSaveName(e.target.value)}
          placeholder="Give this circuit a name"
        />
        <button className="btn-primary btn-inline" onClick={saveCircuit}>
          💾 {activeSave ? 'Update save' : 'Save circuit'}
        </button>
      </div>

      {saves.length > 0 && (
        <div className="save-list">
          {saves.map((s) => (
            <div key={s.id} className={`save-chip ${activeSave === s.id ? 'active' : ''}`}>
              <button className="save-open" onClick={() => loadSave(s.id)}>
                {s.name}
              </button>
              <button className="save-delete" onClick={() => deleteSave(s.id)} title="Delete">
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      <PowerCalculator />

      <p className="lab-note">
        Full drag-and-drop wiring editor is on the roadmap. For now, tweak
        values and flip that switch — the LEDs respond live.
      </p>
    </div>
  );
}

function ValueStepper({
  label,
  value,
  step,
  min,
  max,
  unit,
  onChange,
}: {
  label: string;
  value: number;
  step: number;
  min: number;
  max: number;
  unit: string;
  onChange: (v: number) => void;
}) {
  return (
    <div className="stepper">
      <span className="stepper-label">
        {label}: <strong>{value}{unit}</strong>
      </span>
      <div className="stepper-row">
        <button
          className="stepper-btn"
          onClick={() => onChange(Math.max(min, +(value - step).toFixed(2)))}
        >
          −
        </button>
        <div className="stepper-track">
          <div
            className="stepper-fill"
            style={{ width: `${((value - min) / (max - min)) * 100}%` }}
          />
        </div>
        <button
          className="stepper-btn"
          onClick={() => onChange(Math.min(max, +(value + step).toFixed(2)))}
        >
          +
        </button>
      </div>
    </div>
  );
}