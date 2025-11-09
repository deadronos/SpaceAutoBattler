import type { GameState, ShipEntity, Team, EscortAssignment } from '../../../../types/index.js';
import { getDoctrineSquadDirectives } from '../../../aiDoctrine.js';
import { resolveBehaviorProfile } from '../../../aiProfiles.js';
import { computeEscortShellOffset } from './escortOffset.js';

const compareById = (a: ShipEntity, b: ShipEntity): number => a.id - b.id;

const sortTeamPools = (teamShips: Record<Team, ShipEntity[]>): void => {
  teamShips.blue.sort(compareById);
  teamShips.red.sort(compareById);
};

export const assignTeamRoles = (state: GameState, ships: ShipEntity[]): void => {
  const escorts = state.ai.assignments.escorts;
  escorts.clear();
  const teamEscorts: Record<Team, ShipEntity[]> = {
    blue: [],
    red: [],
  };
  const teamVips: Record<Team, ShipEntity[]> = {
    blue: [],
    red: [],
  };

  for (const ship of ships) {
    if (ship.ai) {
      const profile = resolveBehaviorProfile(ship.ai.profileId);
      if (profile.style === 'escort') {
        teamEscorts[ship.ship.team].push(ship);
      }
    }
    if (ship.ship.hull === 'carrier' || ship.ship.hull === 'destroyer') {
      teamVips[ship.ship.team].push(ship);
    }
  }

  sortTeamPools(teamEscorts);
  sortTeamPools(teamVips);

  for (const team of ['blue', 'red'] as const) {
    const vips = teamVips[team];
    const pool = teamEscorts[team];
    const vipCount = vips.length;
    if (vipCount === 0) continue;
    const directives = getDoctrineSquadDirectives(state.ai, team);
    const ratio = directives?.escortReserveRatio;
    let assignable = pool.length;
    if (ratio != null) {
      const clamped = Math.max(0, Math.min(1, ratio));
      if (clamped <= 0) {
        assignable = 0;
      } else {
        assignable = Math.max(1, Math.round(pool.length * clamped));
        assignable = Math.min(pool.length, assignable);
      }
    }
    if (assignable === 0) continue;
    for (let i = 0; i < assignable; i += 1) {
      const escort = pool[i];
      const vip = vips[i % vipCount];
      const escortProfile = escort.ai
        ? resolveBehaviorProfile(escort.ai.profileId)
        : resolveBehaviorProfile('escort');
      const radiusBase = Math.max(
        30,
        (escortProfile.desiredRange[0] + escortProfile.desiredRange[1]) * 0.33,
      );
      const offset = computeEscortShellOffset(vip.id, i, pool.length, radiusBase);
      escorts.set(escort.id, {
        vipId: vip.id,
        offset,
        threatId: state.blackboard.threatToVip.get(vip.id),
      } satisfies EscortAssignment);
    }
  }
};
