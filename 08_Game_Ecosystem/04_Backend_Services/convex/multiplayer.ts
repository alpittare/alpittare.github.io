import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { Id } from "./_generated/dataModel";

const generateRoomCode = (): string => {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
};

export const createRoom = mutation({
  args: {
    hostId: v.id("players"),
    game: v.union(v.literal("cricket"), v.literal("football"), v.literal("baseball")),
  },
  async handler(ctx, args) {
    const player = await ctx.db.get(args.hostId);
    if (!player) {
      throw new Error("Player not found");
    }

    const code = generateRoomCode();
    const now = Date.now();

    const roomId = await ctx.db.insert("multiplayer_rooms", {
      code,
      hostId: args.hostId,
      game: args.game,
      status: "waiting",
      created: now,
    });

    const room = await ctx.db.get(roomId);
    return room;
  },
});

export const joinRoom = mutation({
  args: {
    code: v.string(),
    guestId: v.id("players"),
  },
  async handler(ctx, args) {
    const guest = await ctx.db.get(args.guestId);
    if (!guest) {
      throw new Error("Guest player not found");
    }

    const room = await ctx.db
      .query("multiplayer_rooms")
      .withIndex("by_code", (q) => q.eq("code", args.code))
      .first();

    if (!room) {
      throw new Error("Room not found");
    }

    if (room.status !== "waiting") {
      throw new Error("Room is not available for joining");
    }

    if (room.hostId === args.guestId) {
      throw new Error("Cannot join your own room");
    }

    if (room.guestId) {
      throw new Error("Room is already full");
    }

    const now = Date.now();
    const updated = {
      ...room,
      guestId: args.guestId,
      status: "playing" as const,
      startedAt: now,
    };

    await ctx.db.replace(room._id, updated);
    return updated;
  },
});

export const getRoom = query({
  args: {
    roomId: v.id("multiplayer_rooms"),
  },
  async handler(ctx, args) {
    const room = await ctx.db.get(args.roomId);

    if (!room) {
      throw new Error("Room not found");
    }

    // Fetch player names
    const host = await ctx.db.get(room.hostId);
    const guest = room.guestId ? await ctx.db.get(room.guestId) : null;

    return {
      ...room,
      hostName: host?.name || "Unknown",
      guestName: guest?.name || null,
    };
  },
});

export const getRoomByCode = query({
  args: {
    code: v.string(),
  },
  async handler(ctx, args) {
    const room = await ctx.db
      .query("multiplayer_rooms")
      .withIndex("by_code", (q) => q.eq("code", args.code))
      .first();

    if (!room) {
      return null;
    }

    const host = await ctx.db.get(room.hostId);
    const guest = room.guestId ? await ctx.db.get(room.guestId) : null;

    return {
      ...room,
      hostName: host?.name || "Unknown",
      guestName: guest?.name || null,
    };
  },
});

export const updateInnings = mutation({
  args: {
    roomId: v.id("multiplayer_rooms"),
    playerId: v.id("players"),
    score: v.number(),
  },
  async handler(ctx, args) {
    if (args.score < 0) {
      throw new Error("Score cannot be negative");
    }

    const room = await ctx.db.get(args.roomId);
    if (!room) {
      throw new Error("Room not found");
    }

    if (args.playerId === room.hostId) {
      const updated = {
        ...room,
        hostScore: args.score,
      };
      await ctx.db.replace(args.roomId, updated);
      return updated;
    } else if (args.playerId === room.guestId) {
      const updated = {
        ...room,
        guestScore: args.score,
      };
      await ctx.db.replace(args.roomId, updated);
      return updated;
    } else {
      throw new Error("Player not in this room");
    }
  },
});

export const finishRoom = mutation({
  args: {
    roomId: v.id("multiplayer_rooms"),
  },
  async handler(ctx, args) {
    const room = await ctx.db.get(args.roomId);
    if (!room) {
      throw new Error("Room not found");
    }

    const now = Date.now();
    const updated = {
      ...room,
      status: "finished" as const,
      finishedAt: now,
    };

    await ctx.db.replace(args.roomId, updated);

    // Record sessions for both players
    const hostWon =
      room.hostScore !== undefined &&
      room.guestScore !== undefined &&
      room.hostScore > room.guestScore;

    const guestWon =
      room.guestScore !== undefined &&
      room.hostScore !== undefined &&
      room.guestScore > room.hostScore;

    // Host session
    if (room.hostScore !== undefined) {
      await ctx.db.insert("sessions", {
        playerId: room.hostId,
        game: room.game,
        score: room.hostScore,
        difficulty: "medium",
        won: hostWon,
        duration: (now - (room.startedAt || room.created)) / 1000,
        timestamp: now,
      });
    }

    // Guest session
    if (room.guestId && room.guestScore !== undefined) {
      await ctx.db.insert("sessions", {
        playerId: room.guestId,
        game: room.game,
        score: room.guestScore,
        difficulty: "medium",
        won: guestWon,
        duration: (now - (room.startedAt || room.created)) / 1000,
        timestamp: now,
      });
    }

    return updated;
  },
});

export const joinQueue = mutation({
  args: {
    playerId: v.id("players"),
    game: v.union(v.literal("cricket"), v.literal("football"), v.literal("baseball")),
    difficulty: v.union(v.literal("easy"), v.literal("medium"), v.literal("hard")),
  },
  async handler(ctx, args) {
    const player = await ctx.db.get(args.playerId);
    if (!player) {
      throw new Error("Player not found");
    }

    // Check if already in queue
    const existing = await ctx.db
      .query("multiplayer_queue")
      .withIndex("by_playerId", (q) => q.eq("playerId", args.playerId))
      .first();

    if (existing && existing.status === "searching") {
      throw new Error("Player is already in queue");
    }

    const queueId = await ctx.db.insert("multiplayer_queue", {
      playerId: args.playerId,
      game: args.game,
      difficulty: args.difficulty,
      status: "searching",
      timestamp: Date.now(),
    });

    // Try to find a match
    const others = await ctx.db
      .query("multiplayer_queue")
      .withIndex("by_game_status", (q) =>
        q.eq("game", args.game).eq("status", "searching")
      )
      .collect();

    const sameDifficulty = others.filter(
      (q) => q.difficulty === args.difficulty && q.playerId !== args.playerId
    );

    if (sameDifficulty.length > 0) {
      // Match found
      const opponent = sameDifficulty[0];

      // Create room
      const roomId = await ctx.db.insert("multiplayer_rooms", {
        code: generateRoomCode(),
        hostId: args.playerId,
        guestId: opponent.playerId,
        game: args.game,
        status: "playing",
        created: Date.now(),
        startedAt: Date.now(),
      });

      // Update queue entries
      await ctx.db.replace(queueId, {
        playerId: args.playerId,
        game: args.game,
        difficulty: args.difficulty,
        status: "matched",
        matchedRoomId: roomId,
        timestamp: Date.now(),
      });

      await ctx.db.replace(opponent._id, {
        playerId: opponent.playerId,
        game: opponent.game,
        difficulty: opponent.difficulty,
        status: "matched",
        matchedRoomId: roomId,
        timestamp: Date.now(),
      });

      const room = await ctx.db.get(roomId);
      return {
        matched: true,
        roomId,
        room,
      };
    }

    return {
      matched: false,
      queueId,
    };
  },
});

export const checkQueue = query({
  args: {
    playerId: v.id("players"),
  },
  async handler(ctx, args) {
    const queueEntry = await ctx.db
      .query("multiplayer_queue")
      .withIndex("by_playerId", (q) => q.eq("playerId", args.playerId))
      .first();

    if (!queueEntry) {
      return {
        inQueue: false,
      };
    }

    if (queueEntry.status === "matched" && queueEntry.matchedRoomId) {
      const room = await ctx.db.get(queueEntry.matchedRoomId);
      return {
        inQueue: true,
        matched: true,
        roomId: queueEntry.matchedRoomId,
        room,
      };
    }

    return {
      inQueue: true,
      matched: false,
      position: null, // Could calculate based on timestamp
    };
  },
});

export const leaveQueue = mutation({
  args: {
    playerId: v.id("players"),
  },
  async handler(ctx, args) {
    const queueEntry = await ctx.db
      .query("multiplayer_queue")
      .withIndex("by_playerId", (q) => q.eq("playerId", args.playerId))
      .first();

    if (!queueEntry) {
      throw new Error("Player not in queue");
    }

    await ctx.db.delete(queueEntry._id);
    return { success: true };
  },
});

export const getActiveRooms = query({
  args: {
    game: v.optional(
      v.union(v.literal("cricket"), v.literal("football"), v.literal("baseball"))
    ),
    limit: v.optional(v.number()),
  },
  async handler(ctx, args) {
    const limit = args.limit || 20;

    const rooms = await ctx.db
      .query("multiplayer_rooms")
      .withIndex("by_status", (q) => q.eq("status", "waiting"))
      .collect();

    const filtered = args.game ? rooms.filter((r) => r.game === args.game) : rooms;

    return filtered
      .sort((a, b) => b.created - a.created)
      .slice(0, limit);
  },
});
