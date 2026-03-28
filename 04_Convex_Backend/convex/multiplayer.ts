/**
 * Multiplayer Chase Mode — Real-time CrickBot Matches
 *
 * Flow:
 *   1. Player creates/joins a room via matchmaking queue
 *   2. System pairs two players into a match_room
 *   3. Player 1 (setter) bats first → score saved as target
 *   4. Player 2 (chaser) bats to chase the target
 *   5. Both players see live updates via Convex subscriptions
 *
 * Tables:
 *   matchmaking_queue – players waiting for a match
 *   match_rooms       – active match state (real-time synced)
 *
 * Architecture:
 *   - Convex real-time queries replace WebSockets
 *   - No server needed — Convex handles pub/sub natively
 *   - Game client polls room state via useQuery() subscription
 */

import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// ═══════════════════════════════════════════════════════════════════════
// MATCHMAKING QUEUE
// ═══════════════════════════════════════════════════════════════════════

/**
 * Join the matchmaking queue. If another player is waiting, auto-create a room.
 * Returns: { status: 'waiting' | 'matched', roomId?: Id<match_rooms> }
 */
export const joinQueue = mutation({
  args: {
    playerName: v.string(),
    difficulty: v.optional(v.string()),
  },
  handler: async (ctx, { playerName, difficulty }) => {
    const diff = difficulty || "medium";
    const now = Date.now();

    // Check if player is already in queue
    const existingEntry = await ctx.db
      .query("matchmaking_queue")
      .withIndex("by_name", (q) => q.eq("playerName", playerName))
      .first();

    if (existingEntry) {
      // Already waiting — check if they got matched
      if (existingEntry.roomId) {
        return { status: "matched" as const, roomId: existingEntry.roomId };
      }
      return { status: "waiting" as const, queueId: existingEntry._id };
    }

    // Look for an opponent in the queue (prefer same difficulty, fallback to any)
    const opponent = await ctx.db
      .query("matchmaking_queue")
      .withIndex("by_status", (q) => q.eq("status", "waiting"))
      .filter((q) => q.neq(q.field("playerName"), playerName))
      .first();

    if (opponent) {
      // MATCH FOUND — create a room
      const roomId = await ctx.db.insert("match_rooms", {
        player1Name: opponent.playerName,
        player2Name: playerName,
        difficulty: diff,
        status: "innings1",  // player1 bats first
        createdAt: now,

        // Innings tracking
        innings1Score: 0,
        innings1Wickets: 0,
        innings1Overs: 0,
        innings1Balls: 0,
        innings1Fours: 0,
        innings1Sixes: 0,
        innings1Complete: false,

        innings2Score: 0,
        innings2Wickets: 0,
        innings2Overs: 0,
        innings2Balls: 0,
        innings2Fours: 0,
        innings2Sixes: 0,
        innings2Complete: false,

        target: 0,
        winner: "",
        winMargin: "",
        updatedAt: now,

        // Live ball-by-ball for spectating
        lastBallResult: "",
        lastBallRuns: 0,
      });

      // Update opponent's queue entry
      await ctx.db.patch(opponent._id, {
        status: "matched",
        roomId,
        matchedAt: now,
      });

      // Also insert our own entry (matched immediately)
      await ctx.db.insert("matchmaking_queue", {
        playerName,
        difficulty: diff,
        status: "matched",
        roomId,
        joinedAt: now,
        matchedAt: now,
      });

      return { status: "matched" as const, roomId };
    }

    // No opponent — add to queue and wait
    const queueId = await ctx.db.insert("matchmaking_queue", {
      playerName,
      difficulty: diff,
      status: "waiting",
      roomId: undefined,
      joinedAt: now,
      matchedAt: undefined,
    });

    return { status: "waiting" as const, queueId };
  },
});

/**
 * Check queue status — has the player been matched yet?
 */
export const checkQueue = query({
  args: { playerName: v.string() },
  handler: async (ctx, { playerName }) => {
    const entry = await ctx.db
      .query("matchmaking_queue")
      .withIndex("by_name", (q) => q.eq("playerName", playerName))
      .first();

    if (!entry) return { status: "not_in_queue" as const };
    if (entry.roomId) return { status: "matched" as const, roomId: entry.roomId };
    return { status: "waiting" as const, queueId: entry._id };
  },
});

/**
 * Leave matchmaking queue (cancel search).
 * Cleans up ANY entry for this player — waiting, matched, or stale.
 */
export const leaveQueue = mutation({
  args: { playerName: v.string() },
  handler: async (ctx, { playerName }) => {
    // Delete ALL entries for this player (handles stale matched entries too)
    const entries = await ctx.db
      .query("matchmaking_queue")
      .withIndex("by_name", (q) => q.eq("playerName", playerName))
      .collect();

    for (const entry of entries) {
      await ctx.db.delete(entry._id);
    }
    return { success: true, deleted: entries.length };
  },
});

/**
 * Record a bot match result in match_rooms (for dashboard / history).
 * Called client-side after an AI bot match completes.
 */
export const recordBotMatch = mutation({
  args: {
    playerName: v.string(),
    difficulty: v.string(),
    botScore: v.number(),
    botWickets: v.number(),
    botOvers: v.number(),
    botBalls: v.number(),
    botFours: v.number(),
    botSixes: v.number(),
    playerScore: v.number(),
    playerWickets: v.number(),
    playerOvers: v.number(),
    playerBalls: v.number(),
    playerFours: v.number(),
    playerSixes: v.number(),
    winner: v.string(),
    winMargin: v.string(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const roomId = await ctx.db.insert("match_rooms", {
      player1Name: "CrickBot AI",
      player2Name: args.playerName,
      difficulty: args.difficulty,
      status: "completed",
      createdAt: now,
      innings1Score: args.botScore,
      innings1Wickets: args.botWickets,
      innings1Overs: args.botOvers,
      innings1Balls: args.botBalls,
      innings1Fours: args.botFours,
      innings1Sixes: args.botSixes,
      innings1Complete: true,
      innings2Score: args.playerScore,
      innings2Wickets: args.playerWickets,
      innings2Overs: args.playerOvers,
      innings2Balls: args.playerBalls,
      innings2Fours: args.playerFours,
      innings2Sixes: args.playerSixes,
      innings2Complete: true,
      target: args.botScore + 1,
      winner: args.winner,
      winMargin: args.winMargin,
      updatedAt: now,
      lastBallResult: "END",
      lastBallRuns: 0,
    });
    return { roomId, winner: args.winner, winMargin: args.winMargin };
  },
});

// ═══════════════════════════════════════════════════════════════════════
// PRIVATE ROOMS — Share a code with a friend
// ═══════════════════════════════════════════════════════════════════════

/**
 * Generate a random 4-character room code (A-Z, 0-9)
 */
function generateRoomCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no I/O/1/0 to avoid confusion
  let code = "";
  for (let i = 0; i < 4; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

/**
 * Create a private room — generates a 4-char code, player waits for friend to join.
 * Returns: { roomId, roomCode }
 */
export const createPrivateRoom = mutation({
  args: {
    playerName: v.string(),
    difficulty: v.optional(v.string()),
  },
  handler: async (ctx, { playerName, difficulty }) => {
    const diff = difficulty || "medium";
    const now = Date.now();

    // Generate unique code (retry if collision)
    let roomCode = generateRoomCode();
    let attempts = 0;
    while (attempts < 10) {
      const existing = await ctx.db
        .query("match_rooms")
        .withIndex("by_room_code", (q) => q.eq("roomCode", roomCode))
        .filter((q) => q.neq(q.field("status"), "completed"))
        .first();
      if (!existing) break;
      roomCode = generateRoomCode();
      attempts++;
    }

    const roomId = await ctx.db.insert("match_rooms", {
      player1Name: playerName,
      player2Name: "",              // empty — waiting for friend
      difficulty: diff,
      status: "waiting",            // waiting for player 2
      createdAt: now,
      roomCode,
      isPrivate: true,

      innings1Score: 0, innings1Wickets: 0, innings1Overs: 0,
      innings1Balls: 0, innings1Fours: 0, innings1Sixes: 0,
      innings1Complete: false,
      innings2Score: 0, innings2Wickets: 0, innings2Overs: 0,
      innings2Balls: 0, innings2Fours: 0, innings2Sixes: 0,
      innings2Complete: false,
      target: 0, winner: "", winMargin: "",
      updatedAt: now,
      lastBallResult: "", lastBallRuns: 0,
    });

    return { roomId, roomCode };
  },
});

/**
 * Join a private room by code. Sets player2Name and transitions to innings1.
 * Returns: { success, roomId, room } or { success: false, reason }
 */
export const joinPrivateRoom = mutation({
  args: {
    roomCode: v.string(),
    playerName: v.string(),
  },
  handler: async (ctx, { roomCode, playerName }) => {
    const code = roomCode.toUpperCase().trim();

    const room = await ctx.db
      .query("match_rooms")
      .withIndex("by_room_code", (q) => q.eq("roomCode", code))
      .filter((q) => q.eq(q.field("status"), "waiting"))
      .first();

    if (!room) {
      return { success: false as const, reason: "Room not found or already started" };
    }

    if (room.player1Name === playerName) {
      return { success: false as const, reason: "You cannot join your own room" };
    }

    // Join the room — set player2 and transition to innings1
    await ctx.db.patch(room._id, {
      player2Name: playerName,
      status: "innings1",
      updatedAt: Date.now(),
    });

    const updatedRoom = await ctx.db.get(room._id);
    return { success: true as const, roomId: room._id, room: updatedRoom };
  },
});

/**
 * Check private room status — used by room creator to poll if friend joined
 */
export const checkPrivateRoom = query({
  args: { roomId: v.id("match_rooms") },
  handler: async (ctx, { roomId }) => {
    const room = await ctx.db.get(roomId);
    if (!room) return { status: "not_found" as const };
    if (room.status === "waiting") return { status: "waiting" as const, roomCode: room.roomCode };
    return { status: "ready" as const, room };
  },
});

// ═══════════════════════════════════════════════════════════════════════
// MATCH ROOM — REAL-TIME STATE
// ═══════════════════════════════════════════════════════════════════════

/**
 * Get room state — this is the primary subscription endpoint.
 * Game client uses useQuery(api.multiplayer.getRoom, { roomId }) for live updates.
 */
export const getRoom = query({
  args: { roomId: v.id("match_rooms") },
  handler: async (ctx, { roomId }) => {
    return ctx.db.get(roomId);
  },
});

/**
 * Update innings score — called ball-by-ball from the game client
 */
export const updateInnings = mutation({
  args: {
    roomId: v.id("match_rooms"),
    innings: v.union(v.literal(1), v.literal(2)),
    score: v.number(),
    wickets: v.number(),
    overs: v.number(),
    balls: v.number(),
    fours: v.number(),
    sixes: v.number(),
    lastBallResult: v.string(),   // "6", "4", "1", "DOT", "BOWLED", "CAUGHT", "WIDE"
    lastBallRuns: v.number(),
  },
  handler: async (ctx, args) => {
    const room = await ctx.db.get(args.roomId);
    if (!room) throw new Error("Room not found");

    const now = Date.now();
    const prefix = args.innings === 1 ? "innings1" : "innings2";

    const update: Record<string, any> = {
      [`${prefix}Score`]: args.score,
      [`${prefix}Wickets`]: args.wickets,
      [`${prefix}Overs`]: args.overs,
      [`${prefix}Balls`]: args.balls,
      [`${prefix}Fours`]: args.fours,
      [`${prefix}Sixes`]: args.sixes,
      lastBallResult: args.lastBallResult,
      lastBallRuns: args.lastBallRuns,
      updatedAt: now,
    };

    await ctx.db.patch(args.roomId, update);
    return { success: true };
  },
});

/**
 * Complete innings 1 — sets the target and transitions to innings 2
 */
export const completeInnings1 = mutation({
  args: {
    roomId: v.id("match_rooms"),
    finalScore: v.number(),
    finalWickets: v.number(),
    finalOvers: v.number(),
    finalFours: v.number(),
    finalSixes: v.number(),
  },
  handler: async (ctx, args) => {
    const room = await ctx.db.get(args.roomId);
    if (!room) throw new Error("Room not found");

    await ctx.db.patch(args.roomId, {
      innings1Score: args.finalScore,
      innings1Wickets: args.finalWickets,
      innings1Overs: args.finalOvers,
      innings1Fours: args.finalFours,
      innings1Sixes: args.finalSixes,
      innings1Complete: true,
      target: args.finalScore + 1,  // target = score + 1 to win
      status: "innings2",
      updatedAt: Date.now(),
    });

    return { target: args.finalScore + 1 };
  },
});

/**
 * Complete innings 2 — determine winner and finalize match
 */
export const completeMatch = mutation({
  args: {
    roomId: v.id("match_rooms"),
    finalScore: v.number(),
    finalWickets: v.number(),
    finalOvers: v.number(),
    finalFours: v.number(),
    finalSixes: v.number(),
  },
  handler: async (ctx, args) => {
    const room = await ctx.db.get(args.roomId);
    if (!room) throw new Error("Room not found");

    const target = room.target;
    let winner = "";
    let winMargin = "";

    if (args.finalScore >= target) {
      // Chaser wins
      winner = room.player2Name;
      const wicketsLeft = 3 - args.finalWickets;
      winMargin = `${wicketsLeft} wicket${wicketsLeft !== 1 ? "s" : ""}`;
    } else if (args.finalScore === target - 1) {
      // Tie
      winner = "TIE";
      winMargin = "Scores level!";
    } else {
      // Setter wins
      winner = room.player1Name;
      const runDiff = (target - 1) - args.finalScore;
      winMargin = `${runDiff} run${runDiff !== 1 ? "s" : ""}`;
    }

    await ctx.db.patch(args.roomId, {
      innings2Score: args.finalScore,
      innings2Wickets: args.finalWickets,
      innings2Overs: args.finalOvers,
      innings2Fours: args.finalFours,
      innings2Sixes: args.finalSixes,
      innings2Complete: true,
      status: "completed",
      winner,
      winMargin,
      updatedAt: Date.now(),
    });

    // Cleanup queue entries for both players
    const q1 = await ctx.db
      .query("matchmaking_queue")
      .withIndex("by_name", (q) => q.eq("playerName", room.player1Name))
      .first();
    const q2 = await ctx.db
      .query("matchmaking_queue")
      .withIndex("by_name", (q) => q.eq("playerName", room.player2Name))
      .first();
    if (q1) await ctx.db.delete(q1._id);
    if (q2) await ctx.db.delete(q2._id);

    return { winner, winMargin };
  },
});

// ═══════════════════════════════════════════════════════════════════════
// LIVE MATCHES — Public feed for spectators / dashboard
// ═══════════════════════════════════════════════════════════════════════

/**
 * Get all active (non-completed) matches
 */
export const getLiveMatches = query({
  args: {},
  handler: async (ctx) => {
    const active = await ctx.db
      .query("match_rooms")
      .withIndex("by_status")
      .filter((q) => q.neq(q.field("status"), "completed"))
      .order("desc")
      .take(20);
    return active;
  },
});

/**
 * Get recent completed matches
 */
export const getRecentMatches = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, { limit }) => {
    const take = limit || 10;
    return ctx.db
      .query("match_rooms")
      .withIndex("by_status")
      .filter((q) => q.eq(q.field("status"), "completed"))
      .order("desc")
      .take(take);
  },
});

/**
 * Get number of players in queue
 */
export const getQueueCount = query({
  args: {},
  handler: async (ctx) => {
    const waiting = await ctx.db
      .query("matchmaking_queue")
      .withIndex("by_status", (q) => q.eq("status", "waiting"))
      .collect();
    return waiting.length;
  },
});
