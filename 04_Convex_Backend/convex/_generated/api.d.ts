/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as achievements from "../achievements.js";
import type * as arenaMultiplayer from "../arenaMultiplayer.js";
import type * as arenaTick from "../arenaTick.js";
import type * as campaign from "../campaign.js";
import type * as claude from "../claude.js";
import type * as leaderboard from "../leaderboard.js";
import type * as multiplayer from "../multiplayer.js";
import type * as players from "../players.js";
import type * as sessions from "../sessions.js";
import type * as test from "../test.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  achievements: typeof achievements;
  arenaMultiplayer: typeof arenaMultiplayer;
  arenaTick: typeof arenaTick;
  campaign: typeof campaign;
  claude: typeof claude;
  leaderboard: typeof leaderboard;
  multiplayer: typeof multiplayer;
  players: typeof players;
  sessions: typeof sessions;
  test: typeof test;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
