// Lightweight ship configuration validation helpers (TypeScript)
export function validateShipConfig(config) {
    const errors = [];
    if (!config || typeof config !== 'object') {
        errors.push('config must be an object');
        return errors;
    }
    for (const [type, shipRaw] of Object.entries(config)) {
        const ship = shipRaw;
        if (!ship || typeof ship !== 'object') {
            errors.push(`${type}: ship entry must be an object`);
            continue;
        }
        if (typeof ship.maxHp !== 'number' || Number.isNaN(ship.maxHp)) {
            errors.push(`${type}: maxHp must be a number`);
        }
        else if (ship.maxHp <= 0) {
            errors.push(`${type}: maxHp must be positive`);
        }
        if (typeof ship.accel !== 'number' || Number.isNaN(ship.accel)) {
            errors.push(`${type}: accel must be a number`);
        }
        else if (ship.accel < 0) {
            errors.push(`${type}: accel cannot be negative`);
        }
        if (!Array.isArray(ship.cannons) || ship.cannons.length === 0) {
            errors.push(`${type}: must have at least one cannon`);
        }
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
    if (errors.length === 0)
        return [];
    const message = `Ship config validation failed:\n - ${errors.join('\n - ')}`;
    const isCI = process.env.CI === 'true' || process.env.NODE_ENV === 'production';
    if (throwInCI && isCI) {
        throw new Error(message);
    }
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
    const tcfg = cfg;
    if (!tcfg.teams || typeof tcfg.teams !== 'object') {
        errors.push('TeamsConfig.teams must be an object with team entries');
    }
    else {
        for (const [k, v] of Object.entries(tcfg.teams)) {
            if (!v || typeof v !== 'object') {
                errors.push(`teams.${k} must be an object`);
                continue;
            }
            const teamObj = v;
            if (!teamObj.id)
                errors.push(`teams.${k} missing id`);
            if (!teamObj.color)
                errors.push(`teams.${k} missing color`);
        }
    }
    if (tcfg.defaultFleet) {
        if (!tcfg.defaultFleet.counts || typeof tcfg.defaultFleet.counts !== 'object') {
            errors.push('TeamsConfig.defaultFleet.counts must be an object mapping ship types to counts');
        }
        if (tcfg.defaultFleet.spacing != null && typeof tcfg.defaultFleet.spacing !== 'number') {
            errors.push('TeamsConfig.defaultFleet.spacing must be a number');
        }
    }
    if (tcfg.continuousReinforcement) {
        const cr = tcfg.continuousReinforcement;
        if (typeof cr.enabled !== 'boolean')
            errors.push('continuousReinforcement.enabled must be boolean');
        if (typeof cr.scoreMargin !== 'number')
            errors.push('continuousReinforcement.scoreMargin must be number');
        if (typeof cr.perTick !== 'number')
            errors.push('continuousReinforcement.perTick must be number');
        // reinforceType is not present in actual config; skip validation
        if (cr.shipTypes && !Array.isArray(cr.shipTypes))
            errors.push('continuousReinforcement.shipTypes must be an array if provided');
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
    const p = cfg;
    if (typeof p.xpPerDamage !== 'number')
        errors.push('xpPerDamage must be a number');
    if (typeof p.xpPerKill !== 'number')
        errors.push('xpPerKill must be a number');
    if (typeof p.xpToLevel !== 'function' && typeof p.xpToLevel !== 'number') {
        errors.push('xpToLevel must be a function(level) or a number base');
    }
    const isNumberOrFn = (v) => typeof v === 'number' || typeof v === 'function';
    if (!isNumberOrFn(p.hpPercentPerLevel))
        errors.push('hpPercentPerLevel must be a number or function(level)');
    if (!isNumberOrFn(p.dmgPercentPerLevel))
        errors.push('dmgPercentPerLevel must be a number or function(level)');
    if (!isNumberOrFn(p.shieldPercentPerLevel))
        errors.push('shieldPercentPerLevel must be a number or function(level)');
    if (typeof p.speedPercentPerLevel !== 'undefined' && !isNumberOrFn(p.speedPercentPerLevel))
        errors.push('speedPercentPerLevel must be a number or function(level)');
    if (typeof p.regenPercentPerLevel !== 'undefined' && !isNumberOrFn(p.regenPercentPerLevel))
        errors.push('regenPercentPerLevel must be a number or function(level)');
    return errors;
}
// Validate assets config (basic checks)
export function validateAssetsConfig(cfg) {
    const errors = [];
    if (!cfg || typeof cfg !== 'object') {
        errors.push('AssetsConfig must be an object');
        return errors;
    }
    const a = cfg;
    if (!a.palette || typeof a.palette !== 'object')
        errors.push('AssetsConfig.palette must be an object');
    if (!a.shapes2d || typeof a.shapes2d !== 'object')
        errors.push('AssetsConfig.shapes2d must be an object of named shapes');
    if (a.shapes2d && typeof a.shapes2d === 'object') {
        for (const [k, vRaw] of Object.entries(a.shapes2d)) {
            const v = vRaw;
            if (!v || typeof v !== 'object') {
                errors.push(`shapes2d.${k} must be an object`);
                continue;
            }
            if (!v.type)
                errors.push(`shapes2d.${k} missing type`);
            if (v.type === 'polygon' && (!Array.isArray(v.points) || v.points.length === 0))
                errors.push(`shapes2d.${k} polygon must have points`);
            if (v.type === 'compound' && (!Array.isArray(v.parts) || v.parts.length === 0))
                errors.push(`shapes2d.${k} compound must have parts`);
        }
    }
    return errors;
}
export function validateDisplayConfig(cfg) {
    const errors = [];
    if (!cfg)
        return errors;
    const d = cfg;
    if (typeof d.getDefaultBounds !== 'function')
        errors.push('displayConfig.getDefaultBounds must be a function');
    return errors;
}
export function validateRendererConfig(cfg) {
    const errors = [];
    if (!cfg || typeof cfg !== 'object') {
        errors.push('RendererConfig must be an object');
        return errors;
    }
    const r = cfg;
    if (typeof r.preferred !== 'string')
        errors.push('RendererConfig.preferred must be a string');
    // rendererScale is not present in actual config; skip validation
    return errors;
}
export default {};
