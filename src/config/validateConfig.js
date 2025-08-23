// Lightweight ship configuration validation helpers
export function validateShipConfig(config) {
  const errors = [];
  if (!config || typeof config !== 'object') {
    errors.push('config must be an object');
    return errors;
  }

  for (const [type, ship] of Object.entries(config)) {
    if (!ship || typeof ship !== 'object') {
      errors.push(`${type}: ship entry must be an object`);
      continue;
    }

    if (typeof ship.maxHp !== 'number' || Number.isNaN(ship.maxHp)) {
      errors.push(`${type}: maxHp must be a number`);
    } else if (ship.maxHp <= 0) {
      errors.push(`${type}: maxHp must be positive`);
    }

    if (typeof ship.accel !== 'number' || Number.isNaN(ship.accel)) {
      errors.push(`${type}: accel must be a number`);
    } else if (ship.accel < 0) {
      errors.push(`${type}: accel cannot be negative`);
    }

    if (!Array.isArray(ship.cannons) || ship.cannons.length === 0) {
      errors.push(`${type}: must have at least one cannon`);
    }

    // Optional additional checks
    if (typeof ship.maxShield !== 'undefined') {
      if (typeof ship.maxShield !== 'number' || Number.isNaN(ship.maxShield) || ship.maxShield < 0) {
        errors.push(`${type}: maxShield must be a non-negative number`);
      }
    }

    if (typeof ship.radius !== 'undefined') {
      if (typeof ship.radius !== 'number' || Number.isNaN(ship.radius) || ship.radius <= 0) {
        errors.push(`${type}: radius must be a positive number`);
      }
    }
  }

  return errors;
}

export function validateConfigOrThrow(config, { throwInCI = true } = {}) {
  const errors = validateShipConfig(config);
  if (errors.length === 0) return [];

  const message = `Ship config validation failed:\n - ${errors.join('\n - ')}`;

  // If running in CI or NODE_ENV=production, treat as fatal
  const isCI = process.env.CI === 'true' || process.env.NODE_ENV === 'production';
  if (throwInCI && isCI) {
    throw new Error(message);
  }

  // Otherwise log and return errors
  // eslint-disable-next-line no-console
  console.error(message);
  return errors;
}

// Validate TeamsConfig shape
export function validateTeamsConfig(cfg) {
  const errors = [];
  if (!cfg || typeof cfg !== 'object') {
    errors.push('TeamsConfig must be an object');
    return errors;
  }

  if (!cfg.teams || typeof cfg.teams !== 'object') {
    errors.push('TeamsConfig.teams must be an object with team entries');
  } else {
    for (const [k, v] of Object.entries(cfg.teams)) {
      if (!v || typeof v !== 'object') {
        errors.push(`teams.${k} must be an object`);
        continue;
      }
      if (!v.id) errors.push(`teams.${k} missing id`);
      if (!v.color) errors.push(`teams.${k} missing color`);
    }
  }

  // defaultFleet validation
  if (cfg.defaultFleet) {
    if (!cfg.defaultFleet.counts || typeof cfg.defaultFleet.counts !== 'object') {
      errors.push('TeamsConfig.defaultFleet.counts must be an object mapping ship types to counts');
    }
    if (cfg.defaultFleet.spacing != null && typeof cfg.defaultFleet.spacing !== 'number') {
      errors.push('TeamsConfig.defaultFleet.spacing must be a number');
    }
  }

  // continuousReinforcement validation
  if (cfg.continuousReinforcement) {
    const cr = cfg.continuousReinforcement;
    if (typeof cr.enabled !== 'boolean') errors.push('continuousReinforcement.enabled must be boolean');
    if (typeof cr.scoreMargin !== 'number') errors.push('continuousReinforcement.scoreMargin must be number');
    if (typeof cr.perTick !== 'number') errors.push('continuousReinforcement.perTick must be number');
    if (cr.reinforceType && typeof cr.reinforceType !== 'string') errors.push('continuousReinforcement.reinforceType must be string');
    if (cr.shipTypes && !Array.isArray(cr.shipTypes)) errors.push('continuousReinforcement.shipTypes must be an array if provided');
  }

  return errors;
}

// Validate progression config
export function validateProgressionConfig(cfg) {
  const errors = [];
  if (!cfg || typeof cfg !== 'object') {
    errors.push('progression config must be an object');
    return errors;
  }
  if (typeof cfg.xpPerDamage !== 'number') errors.push('xpPerDamage must be a number');
  if (typeof cfg.xpPerKill !== 'number') errors.push('xpPerKill must be a number');
  if (typeof cfg.xpToLevel !== 'function' && typeof cfg.xpToLevel !== 'number') {
    errors.push('xpToLevel must be a function(level) or a number base');
  }
  // Allow percent-per-level scalars to be either a number (static) or a function(level)
  const isNumberOrFn = v => typeof v === 'number' || typeof v === 'function';
  if (!isNumberOrFn(cfg.hpPercentPerLevel)) errors.push('hpPercentPerLevel must be a number or function(level)');
  if (!isNumberOrFn(cfg.dmgPercentPerLevel)) errors.push('dmgPercentPerLevel must be a number or function(level)');
  if (!isNumberOrFn(cfg.shieldPercentPerLevel)) errors.push('shieldPercentPerLevel must be a number or function(level)');
  // Optional new progression fields
  if (typeof cfg.speedPercentPerLevel !== 'undefined' && !isNumberOrFn(cfg.speedPercentPerLevel)) errors.push('speedPercentPerLevel must be a number or function(level)');
  if (typeof cfg.regenPercentPerLevel !== 'undefined' && !isNumberOrFn(cfg.regenPercentPerLevel)) errors.push('regenPercentPerLevel must be a number or function(level)');

  return errors;
}

// Validate assets config (basic checks)
export function validateAssetsConfig(cfg) {
  const errors = [];
  if (!cfg || typeof cfg !== 'object') {
    errors.push('AssetsConfig must be an object');
    return errors;
  }
  if (!cfg.palette || typeof cfg.palette !== 'object') errors.push('AssetsConfig.palette must be an object');
  if (!cfg.shapes2d || typeof cfg.shapes2d !== 'object') errors.push('AssetsConfig.shapes2d must be an object of named shapes');

  if (cfg.shapes2d && typeof cfg.shapes2d === 'object') {
    for (const [k, v] of Object.entries(cfg.shapes2d)) {
      if (!v || typeof v !== 'object') { errors.push(`shapes2d.${k} must be an object`); continue; }
      if (!v.type) errors.push(`shapes2d.${k} missing type`);
      if (v.type === 'polygon' && (!Array.isArray(v.points) || v.points.length === 0)) errors.push(`shapes2d.${k} polygon must have points`);
      if (v.type === 'compound' && (!Array.isArray(v.parts) || v.parts.length === 0)) errors.push(`shapes2d.${k} compound must have parts`);
    }
  }

  return errors;
}

export function validateDisplayConfig(cfg) {
  const errors = [];
  if (!cfg) return errors; // display config may be dynamic
  if (typeof cfg.getDefaultBounds !== 'function') errors.push('displayConfig.getDefaultBounds must be a function');
  return errors;
}

export function validateRendererConfig(cfg) {
  const errors = [];
  if (!cfg || typeof cfg !== 'object') { errors.push('RendererConfig must be an object'); return errors; }
  if (typeof cfg.preferred !== 'string') errors.push('RendererConfig.preferred must be a string');
  if (typeof cfg.rendererScale !== 'undefined' && typeof cfg.rendererScale !== 'number') errors.push('RendererConfig.rendererScale must be a number');
  return errors;
}
