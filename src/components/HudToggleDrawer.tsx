import { useId, useState, useCallback } from 'react';
import type React from 'react';
import { useUiStore } from '../game/uiStore.js';
import { DEBUG_TOGGLES, SETTINGS_TOGGLES, type HudToggleDefinition } from './hudToggleConfig.js';

export function SettingsDrawer(): React.ReactElement {
  return (
    <HudToggleDrawer
      label="Simulation settings"
      icon={<GearIcon />}
      toggles={SETTINGS_TOGGLES}
      triggerClassName="hud-toggle-drawer__trigger--primary"
    />
  );
}

export function DebugDrawer(): React.ReactElement {
  return (
    <HudToggleDrawer
      label="Debug overlays"
      icon={<WrenchIcon />}
      toggles={DEBUG_TOGGLES}
      triggerClassName="hud-toggle-drawer__trigger--secondary"
      extra={<SimulationDebugSettings />}
    />
  );
}

interface HudToggleDrawerProps {
  label: string;
  icon: React.ReactNode;
  toggles: readonly HudToggleDefinition[];
  triggerClassName?: string;
  extra?: React.ReactNode;
}

function HudToggleDrawer({
  label,
  icon,
  toggles,
  triggerClassName,
  extra,
}: HudToggleDrawerProps): React.ReactElement {
  const [open, setOpen] = useState(false);
  const panelId = useId();

  const handleToggleDrawer = useCallback(() => {
    setOpen((value) => !value);
  }, []);

  const handleKeyDown = useCallback((event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.stopPropagation();
      setOpen(false);
    }
  }, []);

  return (
    <div className={`hud-toggle-drawer${open ? ' hud-toggle-drawer--open' : ''}`}>
      <button
        type="button"
        className={`hud-toggle-drawer__trigger ${triggerClassName ?? ''}`.trim()}
        aria-label={label}
        aria-expanded={open ? 'true' : 'false'}
        aria-controls={panelId}
        onClick={handleToggleDrawer}
      >
        {icon}
      </button>
      <div
        id={panelId}
        role="group"
        className="hud-toggle-drawer__panel"
        hidden={!open}
        aria-hidden={open ? 'false' : 'true'}
        onKeyDown={handleKeyDown}
      >
        <p className="hud-toggle-drawer__title">{label}</p>
        <ul className="hud-toggle-drawer__list">
          {toggles.map((definition) => (
            <ToggleRow key={definition.id} definition={definition} />
          ))}
        </ul>
        {extra ? <div className="hud-toggle-drawer__extra">{extra}</div> : null}
      </div>
    </div>
  );
}

function ToggleRow({ definition }: { definition: HudToggleDefinition }): React.ReactElement {
  const active = useUiStore(definition.select);
  const disabled = useUiStore((state) =>
    definition.disabled ? definition.disabled(state) : false,
  );
  const descriptionId = definition.description ? `${definition.id}-desc` : undefined;

  const handleClick = () => {
    if (disabled) return;
    definition.toggle();
  };

  return (
    <li className="hud-toggle-drawer__item">
      <button
        type="button"
        className="hud-toggle-drawer__toggle"
        role="switch"
        aria-checked={active ? 'true' : 'false'}
        aria-describedby={descriptionId}
        onClick={handleClick}
        disabled={disabled}
      >
        <span className="hud-toggle-drawer__toggle-label">{definition.label}</span>
        <span
          className={`hud-toggle-drawer__pill${active ? ' hud-toggle-drawer__pill--on' : ''}`}
          aria-hidden="true"
        >
          {active ? 'On' : 'Off'}
        </span>
      </button>
      {definition.description ? (
        <p id={descriptionId} className="hud-toggle-drawer__description">
          {definition.description}
        </p>
      ) : null}
    </li>
  );
}

const SIMULATION_SAMPLE_RATES = [1, 2, 3, 4, 5];

function SimulationDebugSettings(): React.ReactElement {
  const sampleRate = useUiStore((state) => state.simProfileSampleRate);
  const setSampleRate = useUiStore((state) => state.setSimProfileSampleRate);

  return (
    <div className="hud-toggle-drawer__simulation-settings">
      <p className="hud-toggle-drawer__simulation-settings-title">Profiling sample rate</p>
      <div className="hud-toggle-drawer__simulation-settings-grid">
        {SIMULATION_SAMPLE_RATES.map((value) => (
          <button
            key={value}
            type="button"
            className={`hud-toggle-drawer__rate-button${
              value === sampleRate ? ' hud-toggle-drawer__rate-button--active' : ''
            }`}
            onClick={() => setSampleRate(value)}
          >
            {value === 1 ? 'Every tick' : `Every ${value}th tick`}
          </button>
        ))}
      </div>
      <p className="hud-toggle-drawer__simulation-settings-note">
        Profiling occurs once per selected interval. Higher values reduce overhead.
      </p>
    </div>
  );
}

function GearIcon(): React.ReactElement {
  return (
    <svg className="hud-toggle-drawer__icon" viewBox="0 0 24 24" role="img" aria-hidden="true">
      <path
        d="M13.94 2.5 15 4.8a7.4 7.4 0 0 1 1.58.92l2.36-.58 1.1 1.9-1.78 1.68c.1.47.16.96.16 1.46 0 .5-.06.99-.16 1.46l1.78 1.68-1.1 1.9-2.36-.58A7.4 7.4 0 0 1 15 19.2l-1.06 2.3h-2.24L10.64 19.2a7.4 7.4 0 0 1-1.58-.92l-2.36.58-1.1-1.9 1.78-1.68A7.4 7.4 0 0 1 7 12.08c0-.5.06-.99.16-1.46l-1.78-1.68 1.1-1.9 2.36.58c.48-.36 1-.66 1.58-.92l1.06-2.3h2.24Zm-1.94 6.12a3.38 3.38 0 1 0 0 6.76 3.38 3.38 0 0 0 0-6.76Z"
        fill="currentColor"
      />
    </svg>
  );
}

function WrenchIcon(): React.ReactElement {
  return (
    <svg className="hud-toggle-drawer__icon" viewBox="0 0 24 24" role="img" aria-hidden="true">
      <path
        d="M21.44 6.5a4.2 4.2 0 0 1-5.06 5.06l-8.3 8.3a1.3 1.3 0 0 1-1.84-1.84l8.3-8.3A4.2 4.2 0 0 1 17.5 4.56a3.64 3.64 0 0 0 .07.72l-2.4 2.4 1.65 1.66 2.4-2.4c.24.04.48.06.72.06a3.64 3.64 0 0 0 1.5-.3Z"
        fill="currentColor"
      />
    </svg>
  );
}
