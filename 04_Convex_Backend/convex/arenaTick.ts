/**
 * Arena Game Tick — Server-authoritative game loop (OPTIMIZED)
 *
 * KEY CHANGES (Free tier fix — April 2026):
 * 1. TICK_INTERVAL: 200ms → 500ms (60% fewer function calls)
 * 2. ROOM_TTL: 10 minute max — auto-kills stuck rooms
 * 3. HUMAN_ABANDON_TIMEOUT: 30s no human input → force-end game
 * 4. BOT_SPEED scaled up by 2.5x to compensate for slower ticks
 * 5. cleanupStaleRooms: separate mutation to nuke orphaned rooms
 *
 * MATH: At 500ms ticks, a 3-min match = 360 calls (was 900).
 *        Free tier = 1M calls/month → supports ~2,700 matches/month.
 *
 * Human combat: reportArenaHit (client-reported, server-validated).
 * Human movement: sendArenaPosition (client-authoritative).
 */

import { internalMutation, mutation } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";

// ── Constants (TUNED FOR FREE TIER) ──────────────────────────────
const TICK_INTERVAL = 500;        // ms between ticks (was 200 — saves 60% calls)
const BOT_SPEED = 40;             // px per tick (was 16 — scaled 2.5x for 500ms interval)
const BOT_ATTACK_RANGE = 55;
const BOT_ATTACK_COOLDOWN = 0.8;  // seconds
const BOT_DAMAGE = 12;
const ARENA_SHRINK_AMOUNT = 12;
const ARENA_SHRINK_INTERVAL = 15; // seconds
const ARENA_MIN_W = 150;
const ARENA_MIN_H = 200;
const POWERUP_SPAWN_TICKS = 16;   // spawn every 16 ticks (8s at 500ms/tick)
const POWERUP_TYPES = ["speed", "shield", "damage", "heal"];
const DISCONNECT_TIMEOUT = 5000;  // 5s no input → disconnected
const ROOM_TTL = 600_000;         // 10 minutes max room lifetime
const HUMAN_ABANDON_TIMEOUT = 30_000; // 30s all humans gone → end game
const MAX_TICKS = 1200;           // 10 min at 500ms = 1200 ticks hard cap

// ── Main Game Tick ─────────────────────────────────────────────────
export const gameTick = internalMutation({
  args: { roomId: v.id("arena_rooms") },
  handler: async (ctx, { roomId }) => {
    const room = await ctx.db.get(roomId);
    if (!room) return; // Room deleted — stop chain

    // ── SAFETY: Stop ticking if room is finished/cancelled ────────
    if (room.status !== "playing" && room.status !== "countdown") return;

    const now = Date.now();

    // ── SAFETY: Room TTL — kill rooms older than 10 minutes ───────
    if (room.startedAt && now - room.startedAt > ROOM_TTL) {
      await ctx.db.patch(roomId, {
        status: "finished",
        winnerName: "Timeout",
        tick: room.tick,
        updatedAt: now,
      });
      return; // Stop ticking
    }

    // ── SAFETY: Hard tick cap — prevent infinite loops ────────────
    if (room.tick >= MAX_TICKS) {
      await ctx.db.patch(roomId, {
        status: "finished",
        winnerName: "Time Limit",
        tick: room.tick,
        updatedAt: now,
      });
      return; // Stop ticking
    }

    // Handle countdown phase
    if (room.status === "countdown") {
      if (room.startedAt && now >= room.startedAt) {
        await ctx.db.patch(roomId, { status: "playing", updatedAt: now });
      }
      await ctx.scheduler.runAfter(TICK_INTERVAL, internal.arenaTick.gameTick, { roomId });
      return;
    }

    const dt = TICK_INTERVAL / 1000; // delta time in seconds
    const tick = room.tick + 1;

    // Get all players
    const allPlayers = await ctx.db
      .query("arena_players")
      .withIndex("by_room", (q) => q.eq("roomId", roomId))
      .collect();

    const alivePlayers = allPlayers.filter((p) => p.alive);
    const aliveHumans = alivePlayers.filter((p) => !p.isBot && !p.isDisconnected);

    // ── SAFETY: All humans abandoned — end game after 30s ─────────
    const anyHumanActive = allPlayers.some(
      (p) => !p.isBot && p.alive && !p.isDisconnected && (now - p.lastInput < HUMAN_ABANDON_TIMEOUT)
    );
    if (!anyHumanActive && tick > 10) {
      // No human has sent input in 30 seconds — force end
      await ctx.db.patch(roomId, {
        status: "finished",
        winnerName: "Abandoned",
        tick,
        updatedAt: now,
      });
      return; // Stop ticking — THIS prevents infinite loop
    }

    // ── 1. Check win condition ───────────────────────────────────
    if (alivePlayers.length <= 1) {
      const winner = alivePlayers[0];
      if (winner) {
        await ctx.db.patch(winner._id, { placement: 1, updatedAt: now });
      }

      const placements = allPlayers
        .map((p) => ({
          name: p.playerName,
          isBot: p.isBot,
          kills: p.kills,
          placement: p.placement || (p.alive ? 1 : room.maxPlayers),
        }))
        .sort((a, b) => a.placement - b.placement);

      await ctx.db.patch(roomId, {
        status: "finished",
        winnerName: winner?.playerName || "Nobody",
        placements,
        tick,
        updatedAt: now,
      });

      // Cleanup queue entries for humans
      for (const p of allPlayers.filter((p) => !p.isBot)) {
        const qEntry = await ctx.db
          .query("arena_queue")
          .withIndex("by_name", (q) => q.eq("playerName", p.playerName))
          .first();
        if (qEntry) await ctx.db.delete(qEntry._id);
      }

      return; // Stop ticking
    }

    // ── 2. Detect disconnected humans ────────────────────────────
    for (const p of alivePlayers) {
      if (!p.isBot && !p.isDisconnected && now - p.lastInput > DISCONNECT_TIMEOUT) {
        await ctx.db.patch(p._id, { isDisconnected: true, updatedAt: now });
      }
    }

    // ── 3. Bot AI + Movement ─────────────────────────────────────
    const targetCount: Record<string, number> = {};
    const botList = alivePlayers.filter((p) => p.isBot || p.isDisconnected);
    const cx = room.arenaX + room.arenaW / 2;
    const cy = room.arenaY + room.arenaH / 2;

    for (let bi = 0; bi < botList.length; bi++) {
      const bot = botList[bi];
      const seed = (bot.slot || bi) + 1;

      // Find targets sorted by distance
      const targets: Array<{ p: typeof bot; dist: number }> = [];
      for (const other of alivePlayers) {
        if (other._id === bot._id) continue;
        const ddx = other.x - bot.x;
        const ddy = other.y - bot.y;
        targets.push({ p: other, dist: Math.sqrt(ddx * ddx + ddy * ddy) });
      }
      targets.sort((a, b) => a.dist - b.dist);

      if (targets.length === 0) continue;

      let chosen = targets[0];
      if (targets.length > 1 && (targetCount[chosen.p.playerName] || 0) >= 2) {
        chosen = targets[1];
      }
      const target = chosen.p;
      const targetDist = chosen.dist;
      targetCount[target.playerName] = (targetCount[target.playerName] || 0) + 1;

      const aggression = (seed % 3 === 0) ? 0.7 : (seed % 3 === 1) ? 1.0 : 1.3;
      let behavior = "chase";
      if (bot.hp < 30 && targetDist < 130) behavior = "flee";
      else if (targetDist < BOT_ATTACK_RANGE) behavior = "attack";
      else if (targetDist > 200) behavior = "wander";

      const dx = target.x - bot.x;
      const dy = target.y - bot.y;
      const len = Math.sqrt(dx * dx + dy * dy) || 1;
      let newX = bot.x;
      let newY = bot.y;

      const strafeAngle = Math.sin(tick * 0.15 + seed * 2.1) * 0.6;
      const strafeX = -dy / len * strafeAngle;
      const strafeY = dx / len * strafeAngle;
      const speed = BOT_SPEED * aggression;

      if (behavior === "chase") {
        newX += (dx / len) * speed * 0.85 + strafeX * speed * 0.3;
        newY += (dy / len) * speed * 0.85 + strafeY * speed * 0.3;
      } else if (behavior === "attack") {
        newX += strafeX * speed * 0.6;
        newY += strafeY * speed * 0.6;
      } else if (behavior === "flee") {
        newX -= (dx / len) * speed * 1.2;
        newY -= (dy / len) * speed * 1.2;
        const toCX = cx - bot.x, toCY = cy - bot.y;
        const toCLen = Math.sqrt(toCX * toCX + toCY * toCY) || 1;
        newX += (toCX / toCLen) * speed * 0.3;
        newY += (toCY / toCLen) * speed * 0.3;
      } else if (behavior === "wander") {
        const wanderA = tick * 0.08 + seed * 1.7;
        const wanderDirX = Math.cos(wanderA);
        const wanderDirY = Math.sin(wanderA);
        const toCX = cx - bot.x, toCY = cy - bot.y;
        const toCLen = Math.sqrt(toCX * toCX + toCY * toCY) || 1;
        newX += wanderDirX * speed * 0.4 + (dx / len) * speed * 0.2 + (toCX / toCLen) * speed * 0.15;
        newY += wanderDirY * speed * 0.4 + (dy / len) * speed * 0.2 + (toCY / toCLen) * speed * 0.15;
      }

      // Clamp to arena bounds
      newX = Math.max(room.arenaX + 15, Math.min(room.arenaX + room.arenaW - 15, newX));
      newY = Math.max(room.arenaY + 15, Math.min(room.arenaY + room.arenaH - 15, newY));

      const patch: Record<string, any> = {
        x: newX, y: newY,
        vx: newX - bot.x, vy: newY - bot.y,
        aiBehavior: behavior,
        aiTarget: target.playerName,
        updatedAt: now,
      };

      // Bot auto-attack
      const cd = bot.attackCooldown - dt;
      if (targetDist < BOT_ATTACK_RANGE && cd <= 0) {
        const newHp = target.hp - BOT_DAMAGE;
        if (newHp <= 0) {
          const aliveCount = alivePlayers.filter((p) => p._id !== target._id).length;
          await ctx.db.patch(target._id, {
            hp: 0, alive: false,
            placement: aliveCount,
            diedAt: now, updatedAt: now,
          });
          patch.kills = bot.kills + 1;
        } else {
          await ctx.db.patch(target._id, { hp: newHp, updatedAt: now });
        }
        patch.attackCooldown = BOT_ATTACK_COOLDOWN;
      } else {
        patch.attackCooldown = Math.max(0, cd);
      }

      await ctx.db.patch(bot._id, patch);
    }

    // ── 4. Arena shrink ──────────────────────────────────────────
    let newShrinkTimer = room.shrinkTimer - dt;
    let arenaW = room.arenaW;
    let arenaH = room.arenaH;
    let arenaX = room.arenaX;
    let arenaY = room.arenaY;
    let shrinkCount = room.shrinkCount;

    if (newShrinkTimer <= 0 && arenaW > ARENA_MIN_W) {
      arenaW = Math.max(ARENA_MIN_W, arenaW - ARENA_SHRINK_AMOUNT);
      arenaH = Math.max(ARENA_MIN_H, arenaH - ARENA_SHRINK_AMOUNT * 1.2);
      arenaX += ARENA_SHRINK_AMOUNT / 2;
      arenaY += (ARENA_SHRINK_AMOUNT * 1.2) / 2;
      newShrinkTimer = ARENA_SHRINK_INTERVAL;
      shrinkCount++;

      for (const p of alivePlayers) {
        if (p.x < arenaX || p.x > arenaX + arenaW ||
            p.y < arenaY || p.y > arenaY + arenaH) {
          const zoneHp = p.hp - 5;
          if (zoneHp <= 0) {
            const aliveAfter = alivePlayers.filter((a) => a._id !== p._id).length;
            await ctx.db.patch(p._id, {
              hp: 0, alive: false, placement: aliveAfter,
              diedAt: now, updatedAt: now,
            });
          } else {
            await ctx.db.patch(p._id, { hp: zoneHp, updatedAt: now });
          }
        }
      }
    }

    // ── 5. Spawn power-ups ───────────────────────────────────────
    let powerUps = [...room.powerUps];
    if (tick % POWERUP_SPAWN_TICKS === 0 && powerUps.filter((p) => p.alive).length < 3) {
      const type = POWERUP_TYPES[Math.floor(Math.random() * POWERUP_TYPES.length)];
      const px = arenaX + 30 + Math.random() * (arenaW - 60);
      const py = arenaY + 30 + Math.random() * (arenaH - 60);
      powerUps.push({ id: tick, type, x: px, y: py, alive: true });
    }

    for (const pu of powerUps) {
      if (!pu.alive) continue;
      for (const p of alivePlayers) {
        const pdx = p.x - pu.x;
        const pdy = p.y - pu.y;
        if (Math.sqrt(pdx * pdx + pdy * pdy) < 40) {
          pu.alive = false;
          if (pu.type === "heal") {
            await ctx.db.patch(p._id, { hp: Math.min(p.maxHp, p.hp + 30), updatedAt: now });
          } else if (pu.type === "damage") {
            await ctx.db.patch(p._id, { damage: p.damage + 5, updatedAt: now });
          } else if (pu.type === "shield") {
            await ctx.db.patch(p._id, { maxHp: p.maxHp + 25, hp: p.hp + 25, updatedAt: now });
          }
          break;
        }
      }
    }
    powerUps = powerUps.filter((p) => p.alive || tick - p.id < 100);

    // ── 6. Update room state ─────────────────────────────────────
    await ctx.db.patch(roomId, {
      tick,
      arenaX, arenaY, arenaW, arenaH,
      shrinkTimer: newShrinkTimer,
      shrinkCount,
      powerUps,
      updatedAt: now,
    });

    // ── 7. Schedule next tick ────────────────────────────────────
    await ctx.scheduler.runAfter(TICK_INTERVAL, internal.arenaTick.gameTick, { roomId });
  },
});

// ═══════════════════════════════════════════════════════════════════
// CLEANUP — Kill orphaned/stuck rooms (call manually or via cron)
// ═══════════════════════════════════════════════════════════════════

/**
 * cleanupStaleRooms — finds all rooms stuck in "playing" or "countdown"
 * for more than ROOM_TTL and force-finishes them.
 *
 * Call this manually from Convex dashboard if usage spikes,
 * or set up a cron to run every 5 minutes.
 *
 * USAGE FROM DASHBOARD:
 *   npx convex run arenaTick:cleanupStaleRooms
 */
export const cleanupStaleRooms = mutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const cutoff = now - ROOM_TTL;

    // Find all active rooms
    const activeRooms = await ctx.db
      .query("arena_rooms")
      .filter((q) =>
        q.or(
          q.eq(q.field("status"), "playing"),
          q.eq(q.field("status"), "countdown"),
          q.eq(q.field("status"), "waiting")
        )
      )
      .collect();

    let cleaned = 0;
    for (const room of activeRooms) {
      // Kill rooms older than TTL, or rooms with updatedAt older than 2 minutes
      // (means the tick chain already died but status wasn't updated)
      if (room.updatedAt < cutoff || room.updatedAt < now - 120_000) {
        await ctx.db.patch(room._id, {
          status: "finished",
          winnerName: "Cleanup",
          updatedAt: now,
        });
        cleaned++;
      }
    }

    return { cleaned, checked: activeRooms.length };
  },
});
