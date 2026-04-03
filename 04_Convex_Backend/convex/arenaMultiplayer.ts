/**
 * Arena Multiplayer — Survival Arena Real-Time Matches
 *
 * Flow:
 *   1. Player joins queue (Quick Match) or creates/joins private room
 *   2. When enough players OR host starts → fill bots → countdown
 *   3. Server ticks run game logic (bots, combat, shrink, power-ups)
 *   4. Clients send position updates + poll room state
 *   5. Last player alive wins → placements recorded
 *
 * Tables: arena_queue, arena_rooms, arena_players
 */

import { mutation, query, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";

// ── Constants ──────────────────────────────────────────────────────
const BOT_NAMES = [
  "Ronin", "Kitsune", "Oni", "Tengu", "Shinobi", "Raijin", "Fujin",
  "Sakura", "Hanzo", "Kaede", "Yuki", "Akira", "Ryu", "Hoshi",
  "Sora", "Kaze", "Tsuki", "Hikari", "Kumo", "Tora",
];
const BOT_SKINS = ["default", "crimson", "royal", "golden", "ice", "shadow"];
const ARENA_DEFAULTS = { x: 7, y: 98, w: 400, h: 700 };

function generateRoomCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 4; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

// ═══════════════════════════════════════════════════════════════════
// MATCHMAKING QUEUE
// ═══════════════════════════════════════════════════════════════════

/**
 * Join Quick Match queue. Auto-creates room when enough players found.
 */
export const joinArenaQueue = mutation({
  args: {
    playerName: v.string(),
    difficulty: v.optional(v.string()),
    maxPlayers: v.optional(v.number()),
    skin: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const name = args.playerName.trim();
    const diff = args.difficulty || "medium";
    const max = args.maxPlayers === 10 ? 10 : 5;
    const skin = args.skin || "default";
    const now = Date.now();

    // Check if already in queue
    const existing = await ctx.db
      .query("arena_queue")
      .withIndex("by_name", (q) => q.eq("playerName", name))
      .first();

    if (existing) {
      if (existing.roomId) return { status: "matched" as const, roomId: existing.roomId };
      return { status: "waiting" as const };
    }

    // ── 0. Clean up any stale arena_player entries from abandoned lobbies ──
    // This prevents ghost player entries from accumulating on page refresh
    const myOldEntries = await ctx.db
      .query("arena_players")
      .withIndex("by_player_name", (q) => q.eq("playerName", name))
      .collect();
    for (const entry of myOldEntries) {
      const entryRoom = await ctx.db.get(entry.roomId);
      // Remove from rooms that are finished, or lobby rooms we're rejoining
      if (!entryRoom || entryRoom.status === "finished") {
        await ctx.db.delete(entry._id);
      }
    }

    // ── 1. Check for existing public lobby rooms with open slots ──
    const lobbyRooms = await ctx.db
      .query("arena_rooms")
      .withIndex("by_status", (q) => q.eq("status", "lobby"))
      .collect();

    for (const room of lobbyRooms) {
      if (room.isPrivate || room.maxPlayers !== max) continue;
      // Count current players in this room
      const players = await ctx.db
        .query("arena_players")
        .withIndex("by_room", (q) => q.eq("roomId", room._id))
        .collect();

      // Check if we're already in this room (page refresh / rejoin)
      const alreadyInRoom = players.find((p) => p.playerName === name);
      if (alreadyInRoom) {
        // Already in room — just return the match, no duplicate insert
        await ctx.db.insert("arena_queue", {
          playerName: name, difficulty: diff, maxPlayers: max,
          skin, status: "matched", roomId: room._id, joinedAt: now, matchedAt: now,
        });
        return { status: "matched" as const, roomId: room._id };
      }

      if (players.length < room.maxPlayers) {
        // Room has space — join it
        const slot = players.length;
        await ctx.db.insert("arena_players", {
          roomId: room._id, playerName: name, isBot: false, slot,
          skin, x: 0, y: 0, vx: 0, vy: 0,
          hp: 100, maxHp: 100, damage: 10, alive: true, kills: 0,
          attackCooldown: 0, lastInput: now, updatedAt: now,
          isReady: false, isDisconnected: false,
        });
        await ctx.db.insert("arena_queue", {
          playerName: name, difficulty: diff, maxPlayers: max,
          skin, status: "matched", roomId: room._id, joinedAt: now, matchedAt: now,
        });
        return { status: "matched" as const, roomId: room._id };
      }
    }

    // ── 2. Find ALL waiting players and create a new room ──────────
    const waiting = await ctx.db
      .query("arena_queue")
      .withIndex("by_status_size", (q) => q.eq("status", "waiting").eq("maxPlayers", max))
      .collect();

    if (waiting.length >= 1) {
      // We have us + waiting players — create room with ALL of them
      const roomCode = generateRoomCode();
      const roomId = await ctx.db.insert("arena_rooms", {
        hostName: waiting[0].playerName,
        difficulty: diff,
        maxPlayers: max,
        status: "lobby",
        roomCode,
        isPrivate: false,
        createdAt: now,
        arenaX: ARENA_DEFAULTS.x,
        arenaY: ARENA_DEFAULTS.y,
        arenaW: ARENA_DEFAULTS.w,
        arenaH: ARENA_DEFAULTS.h,
        shrinkTimer: 15,
        shrinkCount: 0,
        powerUps: [],
        tick: 0,
        updatedAt: now,
      });

      // Add ALL waiting players (up to max-1 to leave a slot for us)
      let slot = 0;
      for (const w of waiting.slice(0, max - 1)) {
        await ctx.db.insert("arena_players", {
          roomId, playerName: w.playerName, isBot: false, slot,
          skin: w.skin, x: 0, y: 0, vx: 0, vy: 0,
          hp: 100, maxHp: 100, damage: 10, alive: true, kills: 0,
          attackCooldown: 0, lastInput: now, updatedAt: now,
          isReady: false, isDisconnected: false,
        });
        await ctx.db.patch(w._id, { status: "matched", roomId, matchedAt: now });
        slot++;
      }

      // Add ourselves
      await ctx.db.insert("arena_players", {
        roomId, playerName: name, isBot: false, slot,
        skin, x: 0, y: 0, vx: 0, vy: 0,
        hp: 100, maxHp: 100, damage: 10, alive: true, kills: 0,
        attackCooldown: 0, lastInput: now, updatedAt: now,
        isReady: false, isDisconnected: false,
      });

      await ctx.db.insert("arena_queue", {
        playerName: name, difficulty: diff, maxPlayers: max,
        skin, status: "matched", roomId, joinedAt: now, matchedAt: now,
      });

      return { status: "matched" as const, roomId };
    }

    // ── 3. No one waiting — add to queue ────────────────────────
    await ctx.db.insert("arena_queue", {
      playerName: name, difficulty: diff, maxPlayers: max,
      skin, status: "waiting", joinedAt: now,
    });

    return { status: "waiting" as const };
  },
});

/**
 * Check queue status — has the player been matched yet?
 */
export const checkArenaQueue = query({
  args: { playerName: v.string() },
  handler: async (ctx, { playerName }) => {
    const entry = await ctx.db
      .query("arena_queue")
      .withIndex("by_name", (q) => q.eq("playerName", playerName.trim()))
      .first();
    if (!entry) return { status: "not_in_queue" as const };
    if (entry.roomId) return { status: "matched" as const, roomId: entry.roomId };
    return { status: "waiting" as const };
  },
});

/**
 * Leave queue / cancel search.
 * Also removes player from any lobby-status room to prevent ghost entries.
 */
export const leaveArenaQueue = mutation({
  args: { playerName: v.string() },
  handler: async (ctx, { playerName }) => {
    const name = playerName.trim();
    // Delete queue entries
    const entries = await ctx.db
      .query("arena_queue")
      .withIndex("by_name", (q) => q.eq("playerName", name))
      .collect();
    for (const e of entries) await ctx.db.delete(e._id);

    // Also remove from any lobby-status rooms (not active games)
    const playerEntries = await ctx.db
      .query("arena_players")
      .withIndex("by_player_name", (q) => q.eq("playerName", name))
      .collect();
    for (const pe of playerEntries) {
      const room = await ctx.db.get(pe.roomId);
      if (!room || room.status === "lobby" || room.status === "finished") {
        await ctx.db.delete(pe._id);
      }
    }
    return { success: true };
  },
});

/**
 * Get queue count for display.
 */
export const getArenaQueueCount = query({
  args: {},
  handler: async (ctx) => {
    const waiting = await ctx.db
      .query("arena_queue")
      .withIndex("by_status_size", (q) => q.eq("status", "waiting"))
      .collect();
    return waiting.length;
  },
});

// ═══════════════════════════════════════════════════════════════════
// PRIVATE ROOMS — Create / Join by Code
// ═══════════════════════════════════════════════════════════════════

/**
 * Create a room. Defaults to private (for Join by Code).
 * Quick Match creates public rooms (isPrivate: false) so other players can find and join.
 */
export const createArenaRoom = mutation({
  args: {
    hostName: v.string(),
    difficulty: v.optional(v.string()),
    maxPlayers: v.optional(v.number()),
    skin: v.optional(v.string()),
    isPrivate: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const name = args.hostName.trim();
    const diff = args.difficulty || "medium";
    const max = args.maxPlayers === 10 ? 10 : 5;
    const priv = args.isPrivate !== false; // default true, only false when explicitly set
    const now = Date.now();

    // Clean up any stale player entries from this player
    const myOldEntries = await ctx.db
      .query("arena_players")
      .withIndex("by_player_name", (q) => q.eq("playerName", name))
      .collect();
    for (const entry of myOldEntries) {
      const entryRoom = await ctx.db.get(entry.roomId);
      if (!entryRoom || entryRoom.status === "finished" || entryRoom.status === "lobby") {
        await ctx.db.delete(entry._id);
      }
    }

    const roomCode = generateRoomCode();
    const roomId = await ctx.db.insert("arena_rooms", {
      hostName: name,
      difficulty: diff,
      maxPlayers: max,
      status: "lobby",
      roomCode,
      isPrivate: priv,
      createdAt: now,
      arenaX: ARENA_DEFAULTS.x, arenaY: ARENA_DEFAULTS.y,
      arenaW: ARENA_DEFAULTS.w, arenaH: ARENA_DEFAULTS.h,
      shrinkTimer: 15, shrinkCount: 0,
      powerUps: [], tick: 0, updatedAt: now,
    });

    // Add host as player slot 0
    await ctx.db.insert("arena_players", {
      roomId, playerName: name, isBot: false, slot: 0,
      skin: args.skin || "default",
      x: 0, y: 0, vx: 0, vy: 0,
      hp: 100, maxHp: 100, damage: 10, alive: true, kills: 0,
      attackCooldown: 0, lastInput: now, updatedAt: now,
      isReady: true, isDisconnected: false,
    });

    return { roomId, roomCode };
  },
});

/**
 * Join a room by invite code.
 */
export const joinArenaRoom = mutation({
  args: {
    roomCode: v.string(),
    playerName: v.string(),
    skin: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const code = args.roomCode.toUpperCase().trim();
    const name = args.playerName.trim();
    const now = Date.now();

    const room = await ctx.db
      .query("arena_rooms")
      .withIndex("by_room_code", (q) => q.eq("roomCode", code))
      .first();

    if (!room) return { success: false as const, reason: "Room not found" };
    if (room.status !== "lobby") return { success: false as const, reason: "Game already started" };

    // Check if already in room
    const existing = await ctx.db
      .query("arena_players")
      .withIndex("by_room_player", (q) => q.eq("roomId", room._id).eq("playerName", name))
      .first();
    if (existing) return { success: true as const, roomId: room._id };

    // Check room capacity
    const players = await ctx.db
      .query("arena_players")
      .withIndex("by_room", (q) => q.eq("roomId", room._id))
      .collect();
    if (players.length >= room.maxPlayers) {
      return { success: false as const, reason: "Room is full" };
    }

    // Join
    await ctx.db.insert("arena_players", {
      roomId: room._id, playerName: name, isBot: false, slot: players.length,
      skin: args.skin || "default",
      x: 0, y: 0, vx: 0, vy: 0,
      hp: 100, maxHp: 100, damage: 10, alive: true, kills: 0,
      attackCooldown: 0, lastInput: now, updatedAt: now,
      isReady: false, isDisconnected: false,
    });

    return { success: true as const, roomId: room._id };
  },
});

/**
 * Toggle ready state in lobby.
 */
export const setArenaReady = mutation({
  args: {
    roomId: v.id("arena_rooms"),
    playerName: v.string(),
    ready: v.boolean(),
  },
  handler: async (ctx, { roomId, playerName, ready }) => {
    const p = await ctx.db
      .query("arena_players")
      .withIndex("by_room_player", (q) => q.eq("roomId", roomId).eq("playerName", playerName.trim()))
      .first();
    if (!p) return { success: false };
    await ctx.db.patch(p._id, { isReady: ready });
    return { success: true };
  },
});

// ═══════════════════════════════════════════════════════════════════
// START MATCH — Fill bots + assign positions + begin countdown
// ═══════════════════════════════════════════════════════════════════

/**
 * Start the arena match. Called by host or auto-triggered.
 * Fills empty slots with bots, assigns spawn positions, begins countdown.
 */
export const startArenaMatch = mutation({
  args: { roomId: v.id("arena_rooms") },
  handler: async (ctx, { roomId }) => {
    const room = await ctx.db.get(roomId);
    if (!room || room.status !== "lobby") return { success: false, reason: "Invalid room" };

    const now = Date.now();

    // Dedup: remove duplicate player entries (same name appearing 2+ times)
    const allEntries = await ctx.db
      .query("arena_players")
      .withIndex("by_room", (q) => q.eq("roomId", roomId))
      .collect();
    const seenNames = new Set<string>();
    for (const entry of allEntries) {
      if (seenNames.has(entry.playerName)) {
        await ctx.db.delete(entry._id); // remove duplicate
      } else {
        seenNames.add(entry.playerName);
      }
    }

    // Re-query after dedup
    const humans = await ctx.db
      .query("arena_players")
      .withIndex("by_room", (q) => q.eq("roomId", roomId))
      .collect();

    // Fill remaining slots with bots
    const usedNames = new Set(humans.map((h) => h.playerName));
    const availBotNames = BOT_NAMES.filter((n) => !usedNames.has(n));
    let slot = humans.length;

    for (let i = slot; i < room.maxPlayers; i++) {
      const botName = availBotNames[i % availBotNames.length] || `Bot_${i}`;
      const botSkin = BOT_SKINS[i % BOT_SKINS.length];
      await ctx.db.insert("arena_players", {
        roomId, playerName: botName, isBot: true, slot: i,
        skin: botSkin, x: 0, y: 0, vx: 0, vy: 0,
        hp: 100, maxHp: 100, damage: 10, alive: true, kills: 0,
        attackCooldown: 0,
        aiBehavior: "wander",
        lastInput: now, updatedAt: now,
        isReady: true, isDisconnected: false,
      });
    }

    // Assign spawn positions in a circle
    const allPlayers = await ctx.db
      .query("arena_players")
      .withIndex("by_room", (q) => q.eq("roomId", roomId))
      .collect();

    const cx = room.arenaX + room.arenaW / 2;
    const cy = room.arenaY + room.arenaH / 2;
    const spawnRadius = 120 + allPlayers.length * 8;

    for (let i = 0; i < allPlayers.length; i++) {
      const angle = (Math.PI * 2 * i) / allPlayers.length;
      const sx = cx + Math.cos(angle) * spawnRadius;
      const sy = cy + Math.sin(angle) * spawnRadius;
      await ctx.db.patch(allPlayers[i]._id, {
        x: sx, y: sy, vx: 0, vy: 0, slot: i,
      });
    }

    // Transition room to countdown (3 second countdown handled client-side)
    await ctx.db.patch(roomId, {
      status: "countdown",
      startedAt: now + 3000, // game begins 3s from now
      updatedAt: now,
    });

    // Schedule first game tick 3s from now
    await ctx.scheduler.runAfter(3000, internal.arenaTick.gameTick, { roomId });

    return { success: true, playerCount: allPlayers.length };
  },
});

// ═══════════════════════════════════════════════════════════════════
// REAL-TIME GAME — Player input + state queries
// ═══════════════════════════════════════════════════════════════════

/**
 * Send position update from client.
 * IMPORTANT: Client MUST throttle to ≥300ms (was 100ms — caused 15GB bandwidth).
 * At 300ms: 3.3 calls/sec × 180sec match = ~600 calls per player per match.
 */
export const sendArenaPosition = mutation({
  args: {
    roomId: v.id("arena_rooms"),
    playerName: v.string(),
    x: v.number(),
    y: v.number(),
    vx: v.number(),
    vy: v.number(),
  },
  handler: async (ctx, args) => {
    const p = await ctx.db
      .query("arena_players")
      .withIndex("by_room_player", (q) =>
        q.eq("roomId", args.roomId).eq("playerName", args.playerName.trim())
      )
      .first();
    if (!p || !p.alive || p.isBot) return;

    await ctx.db.patch(p._id, {
      x: args.x, y: args.y, vx: args.vx, vy: args.vy,
      lastInput: Date.now(), updatedAt: Date.now(),
      isDisconnected: false,
    });
  },
});

/**
 * Report a hit from client. Server validates distance + cooldown.
 */
export const reportArenaHit = mutation({
  args: {
    roomId: v.id("arena_rooms"),
    attackerName: v.string(),
    targetName: v.string(),
  },
  handler: async (ctx, { roomId, attackerName, targetName }) => {
    const attacker = await ctx.db
      .query("arena_players")
      .withIndex("by_room_player", (q) => q.eq("roomId", roomId).eq("playerName", attackerName.trim()))
      .first();
    const target = await ctx.db
      .query("arena_players")
      .withIndex("by_room_player", (q) => q.eq("roomId", roomId).eq("playerName", targetName.trim()))
      .first();

    if (!attacker || !target || !attacker.alive || !target.alive) return { hit: false };

    // Validate distance — generous tolerance for network latency + position sync delay
    // Client attack range = 60px, positions update every 100-200ms, bots move 16px/tick
    // So server positions can lag behind by 30-50px at any moment
    const dx = attacker.x - target.x;
    const dy = attacker.y - target.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > 150) return { hit: false, reason: "too_far" };

    // Apply damage
    const dmg = attacker.damage;
    const newHp = target.hp - dmg;
    const now = Date.now();

    if (newHp <= 0) {
      // Kill — count alive AFTER removing this target
      const alive = await ctx.db
        .query("arena_players")
        .withIndex("by_room", (q) => q.eq("roomId", roomId))
        .filter((q) => q.eq(q.field("alive"), true))
        .collect();
      const placementValue = alive.length - 1; // exclude the dying player

      await ctx.db.patch(target._id, {
        hp: 0, alive: false,
        placement: Math.max(1, placementValue),
        diedAt: now, updatedAt: now,
      });
      await ctx.db.patch(attacker._id, {
        kills: attacker.kills + 1, updatedAt: now,
      });

      return { hit: true, killed: true, targetName, placement: placementValue };
    } else {
      await ctx.db.patch(target._id, { hp: newHp, updatedAt: now });
      return { hit: true, killed: false, dmg, remainingHp: newHp };
    }
  },
});

/**
 * Get full arena room state — polled by all clients every 150ms.
 */
export const getArenaRoom = query({
  args: { roomId: v.id("arena_rooms") },
  handler: async (ctx, { roomId }) => {
    return ctx.db.get(roomId);
  },
});

/**
 * Get all players in a room — polled alongside room state.
 */
export const getArenaPlayers = query({
  args: { roomId: v.id("arena_rooms") },
  handler: async (ctx, { roomId }) => {
    return ctx.db
      .query("arena_players")
      .withIndex("by_room", (q) => q.eq("roomId", roomId))
      .collect();
  },
});

/**
 * Get active arena rooms (for "live matches" display).
 */
export const getLiveArenaMatches = query({
  args: {},
  handler: async (ctx) => {
    const active = await ctx.db
      .query("arena_rooms")
      .withIndex("by_status", (q) => q.eq("status", "playing"))
      .take(20);
    return active;
  },
});
