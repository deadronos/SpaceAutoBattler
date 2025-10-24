/**
 * AI Experiment Configuration
 *
 * This file documents the available AI experiment flags and their configuration.
 * Actual flag values are computed in src/game/config.ts based on environment variables
 * and URL query parameters.
 */

export interface AIExperimentFlags {
  /** Enable 3D vertical maneuvering for AI ships */
  verticalEnabled: boolean;

  /** Enable engagement boost behavior during opening salvo */
  engagementBoostEnabled: boolean;

  /** Enable experimental higher tick rate (15Hz vs 12Hz) */
  tickRateHzExperiment: boolean;

  /** Range calculation policy: 'v0.1.1-exp' for experimental, other values for stable */
  rangePolicy: string;
}

/**
 * Environment Variable Configuration
 *
 * Set these environment variables to control AI experiment flags:
 *
 * Vertical Maneuvering:
 * - AI_VERTICAL_EXPERIMENT_ON=true/false - Force enable
 * - AI_VERTICAL_EXPERIMENT_OFF=true/false - Force disable
 *
 * Engagement Boost:
 * - AI_ENGAGEMENT_BOOST_ON=true/false - Force enable
 * - AI_ENGAGEMENT_BOOST_OFF=true/false - Force disable
 *
 * Tick Rate:
 * - AI_TICKRATE_EXPERIMENT_ON=true/false - Force enable
 * - AI_TICKRATE_EXPERIMENT_OFF=true/false - Force disable
 *
 * Range Policy:
 * - AI_RANGE_POLICY=v0.1.1-exp - Use experimental policy
 * - AI_RANGE_POLICY=stable - Use stable policy
 */

/**
 * URL Query Parameter Configuration
 *
 * Add these query parameters to the URL for runtime testing:
 *
 * - ?ai_vertical=true/false - Enable/disable vertical maneuvering
 * - ?ai_engagement=true/false - Enable/disable engagement boost
 * - ?ai_tick_experiment=true/false - Enable/disable experimental tick rate
 * - ?ai_range_policy=v0.1.1-exp/stable - Set range policy
 *
 * Example: http://localhost:8080/?ai_vertical=false&ai_engagement=true
 */

/**
 * Default Values
 *
 * When no environment variables or query parameters are set:
 * - verticalEnabled: true
 * - engagementBoostEnabled: true
 * - tickRateHzExperiment: true
 * - rangePolicy: 'v0.1.1-exp'
 */

/**
 * Rollback Strategy
 *
 * For immediate rollback of any experiment:
 * 1. Set the corresponding _OFF environment variable to true
 * 2. Or add query parameter with false value and refresh
 * 3. Or use runtime HUD toggles in developer overlay
 *
 * Emergency rollback: Clear all environment variables and URL parameters
 * to return to safe defaults.
 */
