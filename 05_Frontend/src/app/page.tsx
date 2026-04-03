"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import {
  SignInButton,
  SignUpButton,
  UserButton,
  useUser,
} from "@clerk/nextjs";
import { useAction, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { anyApi } from "convex/server";

// ─── Lightweight Markdown Renderer ───────────────────────────
function renderMarkdown(text: string) {
  // Split into lines and process
  const lines = text.split("\n");
  const elements: React.ReactNode[] = [];

  lines.forEach((line, idx) => {
    // Process inline formatting: **bold**, *italic*, `code`
    const processInline = (str: string): React.ReactNode[] => {
      const parts: React.ReactNode[] = [];
      let remaining = str;
      let key = 0;

      while (remaining.length > 0) {
        // Bold: **text**
        const boldMatch = remaining.match(/\*\*(.+?)\*\*/);
        // Code: `text`
        const codeMatch = remaining.match(/`([^`]+)`/);

        // Find earliest match
        const matches = [
          boldMatch ? { type: "bold", match: boldMatch, index: boldMatch.index! } : null,
          codeMatch ? { type: "code", match: codeMatch, index: codeMatch.index! } : null,
        ]
          .filter(Boolean)
          .sort((a, b) => a!.index - b!.index);

        if (matches.length === 0) {
          parts.push(remaining);
          break;
        }

        const first = matches[0]!;
        if (first.index > 0) {
          parts.push(remaining.substring(0, first.index));
        }

        if (first.type === "bold") {
          parts.push(
            <strong key={key++} className="font-semibold">
              {first.match![1]}
            </strong>
          );
        } else if (first.type === "code") {
          parts.push(
            <code
              key={key++}
              className="px-1.5 py-0.5 bg-gray-200 text-gray-800 rounded text-xs font-mono"
            >
              {first.match![1]}
            </code>
          );
        }

        remaining = remaining.substring(first.index + first.match![0].length);
      }

      return parts;
    };

    // Heading: ## text
    if (line.match(/^### /)) {
      elements.push(
        <div key={idx} className="font-bold text-sm mt-3 mb-1">
          {processInline(line.replace(/^### /, ""))}
        </div>
      );
    } else if (line.match(/^## /)) {
      elements.push(
        <div key={idx} className="font-bold text-base mt-3 mb-1">
          {processInline(line.replace(/^## /, ""))}
        </div>
      );
    }
    // Bullet: - text
    else if (line.match(/^[-*] /)) {
      elements.push(
        <div key={idx} className="flex gap-2 ml-2">
          <span className="text-gray-400 select-none">&bull;</span>
          <span>{processInline(line.replace(/^[-*] /, ""))}</span>
        </div>
      );
    }
    // Numbered list: 1. text
    else if (line.match(/^\d+\. /)) {
      const num = line.match(/^(\d+)\. /)![1];
      elements.push(
        <div key={idx} className="flex gap-2 ml-2">
          <span className="text-gray-400 select-none min-w-[1.2em] text-right">
            {num}.
          </span>
          <span>{processInline(line.replace(/^\d+\. /, ""))}</span>
        </div>
      );
    }
    // Empty line
    else if (line.trim() === "") {
      elements.push(<div key={idx} className="h-2" />);
    }
    // Regular text
    else {
      elements.push(<div key={idx}>{processInline(line)}</div>);
    }
  });

  return elements;
}

// ─── Types ───────────────────────────────────────────────────
type Message = {
  role: "user" | "assistant";
  content: string;
};

type Tab = "games" | "profile" | "leaderboard" | "chat" | "status";

// ─── Main Page ───────────────────────────────────────────────
export default function Home() {
  const { isSignedIn, user, isLoaded } = useUser();

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="animate-pulse text-blue-600 text-lg font-medium">
          Loading...
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      <header className="border-b border-gray-200 bg-white px-6 py-4 flex items-center justify-between shadow-sm">
        <h1 className="text-xl font-bold text-gray-900">
          <span className="text-blue-600">Game</span> Dashboard
        </h1>
        {isSignedIn ? (
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-600 font-medium">
              {user?.firstName || user?.username || "Player"}
            </span>
            <UserButton />
          </div>
        ) : null}
      </header>

      <div className="max-w-3xl mx-auto px-6 py-8">
        {!isSignedIn ? (
          <LandingScreen />
        ) : (
          <Dashboard
            userName={user?.firstName || user?.username || "Player"}
          />
        )}
      </div>
    </main>
  );
}

// ─── Landing ─────────────────────────────────────────────────
function LandingScreen() {
  return (
    <div className="text-center space-y-8 pt-8">
      <div className="space-y-4">
        <h2 className="text-5xl font-bold bg-gradient-to-r from-green-600 via-blue-600 to-orange-600 bg-clip-text text-transparent">
          Welcome to Game Hub
        </h2>
        <p className="text-lg font-semibold text-gray-700">
          🏏 Cricket AI 2026 &middot; ⚽ Football AI 2026 &middot; ⚾ Baseball AI 2026
        </p>
        <p className="text-gray-600">
          Sign in to play, track your stats, chat with your AI coach, and dominate the leaderboard!
        </p>
      </div>

      <div className="flex gap-4 justify-center">
        <SignInButton mode="modal">
          <button className="px-8 py-4 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white rounded-2xl font-bold transition-all shadow-lg hover:shadow-xl transform hover:scale-105 active:scale-95">
            Sign In
          </button>
        </SignInButton>
        <SignUpButton mode="modal">
          <button className="px-8 py-4 border-3 border-blue-600 hover:bg-blue-50 text-blue-700 hover:text-blue-800 rounded-2xl font-bold transition-all hover:shadow-lg transform hover:scale-105 active:scale-95">
            Sign Up
          </button>
        </SignUpButton>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-6 pt-12">
        {[
          {
            emoji: "🏏",
            name: "Cricket AI 2026",
            desc: "AI-powered cricket batting challenge",
            color: "text-green-600",
            bg: "bg-gradient-to-br from-green-50 to-green-100 border-green-300",
          },
          {
            emoji: "⚽",
            name: "Football AI 2026",
            desc: "AI penalty shootout game",
            color: "text-blue-600",
            bg: "bg-gradient-to-br from-blue-50 to-blue-100 border-blue-300",
          },
          {
            emoji: "⚾",
            name: "Baseball AI 2026",
            desc: "AI home run derby game",
            color: "text-orange-600",
            bg: "bg-gradient-to-br from-orange-50 to-orange-100 border-orange-300",
          },
          {
            emoji: "⚔️",
            name: "Survival Arena IO 2026",
            desc: "AI battle royale survival game",
            color: "text-emerald-600",
            bg: "bg-gradient-to-br from-emerald-50 to-emerald-100 border-emerald-300",
          },
          {
            emoji: "🚀",
            name: "Infinite Voyager",
            desc: "AI space exploration adventure",
            color: "text-cyan-600",
            bg: "bg-gradient-to-br from-cyan-50 to-cyan-100 border-cyan-300",
          },
        ].map((game) => (
          <div
            key={game.name}
            className={`p-6 rounded-3xl border-2 text-center transition-all hover:shadow-lg hover:scale-105 cursor-pointer ${game.bg}`}
          >
            <div className="text-5xl mb-3">{game.emoji}</div>
            <div className={`font-bold text-lg ${game.color}`}>{game.name}</div>
            <div className="text-xs text-gray-600 mt-2">{game.desc}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Dashboard ───────────────────────────────────────────────
function Dashboard({ userName }: { userName: string }) {
  const [tab, setTab] = useState<Tab>("games");

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">
          Hey, {userName}! 👋
        </h2>
        <p className="text-gray-600 mt-1 font-medium">Ready to play and dominate?</p>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 border-b border-gray-200 overflow-x-auto">
        {(
          [
            { id: "games", label: "Games", icon: "🎮" },
            { id: "profile", label: "Profile", icon: "👤" },
            { id: "leaderboard", label: "Leaderboard", icon: "🏆" },
            { id: "chat", label: "Game Coach", icon: "🤖" },
            { id: "status", label: "Status", icon: "📡" },
          ] as const
        ).map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-3 text-sm font-semibold border-b-2 transition-all whitespace-nowrap ${
              tab === t.id
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
            }`}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === "games" && <GamesTab />}
      {tab === "profile" && <ProfileTab />}
      {tab === "leaderboard" && <LeaderboardTab />}
      {tab === "chat" && <ChatTab />}
      {tab === "status" && <StatusTab />}
    </div>
  );
}

// ─── Games Tab ───────────────────────────────────────────────
function GamesTab() {
  const games = [
    {
      id: "cricket",
      emoji: "🏏",
      name: "Cricket AI 2026",
      description: "AI-powered cricket batting with smart bowler bot, power-ups, and competitive gameplay",
      color: "from-green-400 to-green-600",
      textColor: "text-green-700",
      badgeColor: "bg-green-100 text-green-700",
      banner: "https://design.canva.ai/E797qE1ohvoW1pa",
      highScore: 8450,
      gamesPlayed: 127,
      winRate: 68,
      features: [
        { label: "Multiplayer", icon: "⚡" },
        { label: "Campaign", icon: "🗺️" },
        { label: "AI Coach", icon: "🤖" },
      ],
    },
    {
      id: "soccer",
      emoji: "⚽",
      name: "Football AI 2026",
      description: "AI penalty shootout with smart keeper bot, power shots, and competitive streaks",
      color: "from-blue-400 to-blue-600",
      textColor: "text-blue-700",
      badgeColor: "bg-blue-100 text-blue-700",
      banner: "https://design.canva.ai/2P5jVpvZ1qJjIMR",
      highScore: 7920,
      gamesPlayed: 95,
      winRate: 71,
      features: [
        { label: "Multiplayer", icon: "⚡" },
        { label: "Banana Kick", icon: "🍌" },
        { label: "Curve Shots", icon: "🌀" },
      ],
    },
    {
      id: "baseball",
      emoji: "⚾",
      name: "Baseball AI 2026",
      description: "AI home run derby with smart pitcher bot, power-ups, and progressive difficulty",
      color: "from-orange-400 to-orange-600",
      textColor: "text-orange-700",
      badgeColor: "bg-orange-100 text-orange-700",
      banner: "https://design.canva.ai/sQ1Nxn4hf6SSelo",
      highScore: 6780,
      gamesPlayed: 82,
      winRate: 64,
      features: [
        { label: "Campaign", icon: "🗺️" },
        { label: "Power-ups", icon: "💥" },
        { label: "Coming Soon", icon: "🔜" },
      ],
    },
    {
      id: "survivalarena",
      emoji: "⚔️",
      name: "Survival Arena IO 2026",
      description: "AI battle royale with shrinking arena, surge powers, rage mode, and 100-level campaign",
      color: "from-emerald-400 to-emerald-600",
      textColor: "text-emerald-700",
      badgeColor: "bg-emerald-100 text-emerald-700",
      banner: "",
      highScore: 5200,
      gamesPlayed: 45,
      winRate: 52,
      features: [
        { label: "Campaign", icon: "🗺️" },
        { label: "Rage Mode", icon: "🔥" },
        { label: "Surge Powers", icon: "⚡" },
      ],
    },
    {
      id: "infinitevoyager",
      emoji: "🚀",
      name: "Infinite Voyager",
      description: "AI space exploration adventure with alien encounters, boss battles, and cosmic challenges",
      color: "from-cyan-400 to-cyan-600",
      textColor: "text-cyan-700",
      badgeColor: "bg-cyan-100 text-cyan-700",
      banner: "",
      highScore: 4850,
      gamesPlayed: 38,
      winRate: 59,
      features: [
        { label: "Campaign", icon: "🗺️" },
        { label: "Boss Battles", icon: "👾" },
        { label: "Power-ups", icon: "⭐" },
      ],
    },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {games.map((game) => (
          <div
            key={game.id}
            className="rounded-2xl overflow-hidden shadow-lg hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-2 bg-white border border-gray-100"
          >
            {/* Banner */}
            <div
              className={`h-40 bg-gradient-to-br ${game.color} relative overflow-hidden`}
            >
              <img
                src={game.banner}
                alt={`${game.name} banner`}
                className="w-full h-full object-cover"
                onError={(e) => {
                  // Fallback to gradient + emoji if image fails
                  const target = e.currentTarget;
                  target.style.display = "none";
                  target.parentElement!.classList.add("flex", "items-center", "justify-center");
                  const fallback = document.createElement("div");
                  fallback.className = "text-6xl";
                  fallback.textContent = game.emoji;
                  target.parentElement!.appendChild(fallback);
                }}
              />
              <div className="absolute top-3 right-3 px-3 py-1 rounded-full text-xs font-bold bg-white bg-opacity-90 shadow-sm">
                Top Game ⭐
              </div>
            </div>

            {/* Content */}
            <div className="p-5 space-y-4">
              <div>
                <h3 className={`text-xl font-bold ${game.textColor}`}>{game.name}</h3>
                <p className="text-xs text-gray-600 mt-1 line-clamp-2">
                  {game.description}
                </p>
              </div>

              {/* Feature Badges */}
              {game.features && (
                <div className="flex flex-wrap gap-1.5">
                  {game.features.map((f, i) => (
                    <span
                      key={i}
                      className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold ${game.badgeColor}`}
                    >
                      {f.icon} {f.label}
                    </span>
                  ))}
                </div>
              )}

              {/* Stats Grid */}
              <div className="grid grid-cols-3 gap-2">
                <div className={`${game.badgeColor} rounded-lg p-3 text-center`}>
                  <div className="text-sm font-bold">{game.highScore.toLocaleString()}</div>
                  <div className="text-xs font-semibold">High Score</div>
                </div>
                <div className={`${game.badgeColor} rounded-lg p-3 text-center`}>
                  <div className="text-sm font-bold">{game.gamesPlayed}</div>
                  <div className="text-xs font-semibold">Played</div>
                </div>
                <div className={`${game.badgeColor} rounded-lg p-3 text-center`}>
                  <div className="text-sm font-bold">{game.winRate}%</div>
                  <div className="text-xs font-semibold">Win Rate</div>
                </div>
              </div>

              {/* Play Button */}
              <a
                href="#"
                className={`block w-full py-3 rounded-xl font-bold text-white text-center bg-gradient-to-r ${game.color} hover:shadow-lg transition-all transform hover:scale-105 active:scale-95`}
              >
                Play Now 🎮
              </a>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Profile Tab ──────────────────────────────────────────────
function ProfileTab() {
  const { user } = useUser();

  const playerStats = {
    joinDate: "January 15, 2024",
    totalGames: 304,
    totalScore: 23150,
    avgWinRate: 68,
    rank: "Gold",
    achievements: [
      { icon: "🏆", name: "First Win", unlocked: true },
      { icon: "🔥", name: "10-Game Streak", unlocked: true },
      { icon: "💯", name: "Perfect Score", unlocked: false },
      { icon: "⭐", name: "Rank Master", unlocked: true },
      { icon: "🎯", name: "Accuracy King", unlocked: false },
      { icon: "🚀", name: "Speed Demon", unlocked: true },
    ],
    milestones: [
      { emoji: "🎮", text: "Joined Game Hub", date: "Jan 15, 2024" },
      { emoji: "🎉", text: "First 100 Games", date: "Feb 28, 2024" },
      { emoji: "⭐", text: "Reached Gold Rank", date: "Mar 10, 2024" },
    ],
  };

  const getInitials = () => {
    if (user?.firstName && user?.lastName) {
      return `${user.firstName[0]}${user.lastName[0]}`.toUpperCase();
    }
    return user?.firstName?.[0]?.toUpperCase() || "P";
  };

  return (
    <div className="space-y-6">
      {/* Profile Header */}
      <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-3xl p-8 border-2 border-purple-200 shadow-lg">
        <div className="flex gap-6 items-start">
          {/* Avatar */}
          <div className="relative">
            {user?.imageUrl ? (
              <img
                src={user.imageUrl}
                alt="Profile"
                className="w-24 h-24 rounded-full border-4 border-white shadow-md"
              />
            ) : (
              <div className="w-24 h-24 rounded-full bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center border-4 border-white shadow-md">
                <span className="text-4xl font-bold text-white">{getInitials()}</span>
              </div>
            )}
            <div className="absolute bottom-0 right-0 bg-yellow-400 rounded-full px-2 py-1 text-xs font-bold shadow-md">
              ⭐ {playerStats.rank}
            </div>
          </div>

          {/* Player Info */}
          <div className="flex-1">
            <h2 className="text-3xl font-bold text-gray-900">
              {user?.firstName || "Player"}
            </h2>
            <p className="text-gray-600 font-medium mt-1">
              Joined {playerStats.joinDate}
            </p>

            {/* Quick Stats */}
            <div className="grid grid-cols-4 gap-3 mt-4">
              <div className="bg-white rounded-xl p-3 shadow-sm border border-gray-200">
                <div className="text-lg font-bold text-blue-600">{playerStats.totalGames}</div>
                <div className="text-xs text-gray-600 font-semibold">Total Games</div>
              </div>
              <div className="bg-white rounded-xl p-3 shadow-sm border border-gray-200">
                <div className="text-lg font-bold text-green-600">{playerStats.totalScore.toLocaleString()}</div>
                <div className="text-xs text-gray-600 font-semibold">Total Score</div>
              </div>
              <div className="bg-white rounded-xl p-3 shadow-sm border border-gray-200">
                <div className="text-lg font-bold text-orange-600">{playerStats.avgWinRate}%</div>
                <div className="text-xs text-gray-600 font-semibold">Win Rate</div>
              </div>
              <div className="bg-white rounded-xl p-3 shadow-sm border border-gray-200">
                <div className="text-lg font-bold text-purple-600">42</div>
                <div className="text-xs text-gray-600 font-semibold">Achievements</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Achievements Showcase */}
      <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-lg">
        <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
          🏅 Achievements Unlocked
        </h3>
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
          {playerStats.achievements.map((ach, idx) => (
            <div
              key={idx}
              className={`flex flex-col items-center justify-center p-4 rounded-2xl transition-all ${
                ach.unlocked
                  ? "bg-gradient-to-br from-yellow-100 to-yellow-50 border-2 border-yellow-300 shadow-md"
                  : "bg-gray-100 border-2 border-gray-300 opacity-50"
              }`}
            >
              <div className="text-3xl">{ach.icon}</div>
              <div className="text-xs font-bold text-center mt-2 text-gray-700 line-clamp-1">
                {ach.name}
              </div>
              {!ach.unlocked && (
                <div className="text-xs text-gray-500 mt-1">🔒 Locked</div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Career Timeline */}
      <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-lg">
        <h3 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
          📅 Career Milestones
        </h3>
        <div className="space-y-4">
          {playerStats.milestones.map((milestone, idx) => (
            <div key={idx} className="flex gap-4 pb-4 border-b border-gray-200 last:border-0">
              <div className="text-3xl flex-shrink-0">{milestone.emoji}</div>
              <div className="flex-1">
                <h4 className="font-bold text-gray-900">{milestone.text}</h4>
                <p className="text-sm text-gray-500">{milestone.date}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Leaderboard Tab ──────────────────────────────────────────
function LeaderboardTab() {
  const [filter, setFilter] = useState<"all" | "cricket" | "soccer" | "baseball" | "survivalarena" | "infinitevoyager">("all");

  const mockLeaderboard = [
    { rank: 1, name: "Pro Gamer Alex", score: 24500, games: 158 },
    { rank: 2, name: "Champion Maria", score: 23800, games: 142 },
    { rank: 3, name: "Elite Player", score: 22900, games: 135 },
    { rank: 4, name: "Power User Sam", score: 21300, games: 128 },
    { rank: 5, name: "Current You", score: 23150, games: 304, isCurrent: true },
    { rank: 6, name: "Rising Star Dev", score: 20100, games: 118 },
    { rank: 7, name: "Game Master Lee", score: 19800, games: 105 },
    { rank: 8, name: "Skilled Jordan", score: 19200, games: 98 },
    { rank: 9, name: "Expert Casey", score: 18900, games: 92 },
    { rank: 10, name: "Pro Quinn", score: 18500, games: 88 },
  ];

  const getMedalEmoji = (rank: number) => {
    if (rank === 1) return "🥇";
    if (rank === 2) return "🥈";
    if (rank === 3) return "🥉";
    return "•";
  };

  return (
    <div className="space-y-6">
      {/* Filter Tabs */}
      <div className="flex gap-2 overflow-x-auto">
        {[
          { id: "all", label: "All Games", icon: "🎮" },
          { id: "cricket", label: "Cricket AI", icon: "🏏" },
          { id: "soccer", label: "Football AI", icon: "⚽" },
          { id: "baseball", label: "Baseball AI", icon: "⚾" },
          { id: "survivalarena", label: "Survival Arena", icon: "⚔️" },
          { id: "infinitevoyager", label: "Infinite Voyager", icon: "🚀" },
        ].map((f) => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id as typeof filter)}
            className={`px-4 py-2 rounded-full font-semibold whitespace-nowrap transition-all ${
              filter === f.id
                ? "bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-md"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            {f.icon} {f.label}
          </button>
        ))}
      </div>

      {/* Leaderboard Table */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gradient-to-r from-blue-50 to-purple-50 border-b-2 border-blue-200">
                <th className="px-6 py-4 text-left font-bold text-gray-900">Rank</th>
                <th className="px-6 py-4 text-left font-bold text-gray-900">Player</th>
                <th className="px-6 py-4 text-right font-bold text-gray-900">Score</th>
                <th className="px-6 py-4 text-right font-bold text-gray-900">Games</th>
              </tr>
            </thead>
            <tbody>
              {mockLeaderboard.map((player, idx) => (
                <tr
                  key={idx}
                  className={`border-b border-gray-100 transition-all ${
                    player.isCurrent
                      ? "bg-gradient-to-r from-yellow-50 to-amber-50 font-bold"
                      : "hover:bg-gray-50"
                  }`}
                >
                  <td className="px-6 py-4 text-center">
                    <span className="text-2xl">{getMedalEmoji(player.rank)}</span>
                    {player.rank > 3 && (
                      <span className="text-gray-900 font-bold ml-2">#{player.rank}</span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center text-white font-bold text-sm">
                        {player.name[0]}
                      </div>
                      <div>
                        <div className="text-gray-900 font-semibold">
                          {player.name}
                          {player.isCurrent && " 👈"}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <span className="font-bold text-lg text-blue-600">
                      {player.score.toLocaleString()}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right text-gray-600 font-semibold">
                    {player.games}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── Status Tab ──────────────────────────────────────────────
function StatusTab() {
  return (
    <div className="grid gap-4">
      <StatusCard
        title="Clerk Auth"
        emoji="🔐"
        status="connected"
        detail="Authenticated successfully"
      />
      <ConvexStatusCard />
    </div>
  );
}

function StatusCard({
  title,
  emoji,
  status,
  detail,
}: {
  title: string;
  emoji: string;
  status: "connected" | "error" | "loading";
  detail: string;
}) {
  const colors = {
    connected: "border-green-300 bg-green-50",
    error: "border-red-300 bg-red-50",
    loading: "border-yellow-300 bg-yellow-50",
  };
  const dots = {
    connected: "bg-green-500",
    error: "bg-red-500",
    loading: "bg-yellow-500 animate-pulse",
  };
  const textColors = {
    connected: "text-green-800",
    error: "text-red-800",
    loading: "text-yellow-800",
  };

  return (
    <div className={`p-5 rounded-xl border-2 ${colors[status]}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-2xl">{emoji}</span>
          <div>
            <div className="font-bold text-gray-900">{title}</div>
            <div className={`text-sm font-medium ${textColors[status]}`}>
              {detail}
            </div>
          </div>
        </div>
        <div className={`w-3 h-3 rounded-full ${dots[status]}`} />
      </div>
    </div>
  );
}

function ConvexStatusCard() {
  const result = useQuery(api.test.testAuth);

  let status: "connected" | "error" | "loading" = "loading";
  let detail = "Checking connection...";

  if (result === undefined) {
    status = "loading";
    detail = "Querying Convex...";
  } else if (result === "NOT LOGGED IN") {
    status = "connected";
    detail = "gallant-kingfisher-867 \u00B7 Connected (no auth token)";
  } else if (result && typeof result === "object") {
    status = "connected";
    detail = "gallant-kingfisher-867 \u00B7 Auth verified";
  } else {
    status = "connected";
    detail = "gallant-kingfisher-867 \u00B7 Responding";
  }

  return (
    <StatusCard title="Convex Backend" emoji="⚡" status={status} detail={detail} />
  );
}

// ─── Chat Tab ────────────────────────────────────────────────
function ChatTab() {
  const askClaude = useAction(anyApi.claude.askClaude);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const send = useCallback(async () => {
    const prompt = input.trim();
    if (!prompt || loading) return;

    setInput("");
    setError(null);
    setLoading(true);

    const userMsg: Message = { role: "user", content: prompt };
    setMessages((prev) => [...prev, userMsg]);

    try {
      const history = messages.map((m) => ({
        role: m.role,
        content: m.content,
      }));
      const res = await askClaude({ prompt, history });
      const assistantMsg: Message = {
        role: "assistant",
        content: res.text,
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch (e: unknown) {
      const errMsg = e instanceof Error ? e.message : "Something went wrong";
      setError(errMsg);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  }, [input, loading, messages, askClaude]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  const suggestions = [
    "How do I beat the Keeper Bot in Football AI 2026?",
    "Tips for winning penalty shootouts against the AI?",
    "Best power-up strategy for Cricket AI 2026 high scores?",
    "How do I outsmart the Pitcher Bot in Baseball AI 2026?",
    "Best strategy for surviving the shrinking arena in Survival Arena IO?",
  ];

  return (
    <div className="flex flex-col" style={{ minHeight: "60vh" }}>
      {/* Header */}
      <div className="p-4 bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 rounded-xl mb-4">
        <div className="flex items-center gap-2">
          <span className="text-2xl">🎮</span>
          <div>
            <div className="font-bold text-gray-900">
              Game Coach + Dev Assistant
            </div>
            <div className="text-xs text-gray-500">
              Powered by Claude &middot; Gaming tips &amp; full-stack help
            </div>
          </div>
        </div>
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto space-y-4 mb-4 max-h-[50vh] px-1">
        {messages.length === 0 && !loading && (
          <div className="text-center py-8 space-y-4">
            <p className="text-gray-400 text-sm">
              Ask for gaming tips or full-stack dev help.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {suggestions.map((s, i) => (
                <button
                  key={i}
                  onClick={() => {
                    setInput(s);
                    inputRef.current?.focus();
                  }}
                  className="text-left text-xs px-3 py-2 rounded-lg border border-gray-200 text-gray-600 hover:border-blue-400 hover:text-blue-600 transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[85%] px-4 py-3 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
                msg.role === "user"
                  ? "bg-blue-600 text-white rounded-br-md"
                  : "bg-gray-100 text-gray-900 border border-gray-200 rounded-bl-md"
              }`}
            >
              {msg.role === "assistant" && (
                <div className="text-xs text-gray-400 mb-1 font-medium">
                  Claude
                </div>
              )}
              {msg.role === "assistant" ? (
                <div className="space-y-0.5">{renderMarkdown(msg.content)}</div>
              ) : (
                msg.content
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="bg-gray-100 border border-gray-200 px-4 py-3 rounded-2xl rounded-bl-md">
              <div className="flex gap-1">
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" />
                <div
                  className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                  style={{ animationDelay: "0.1s" }}
                />
                <div
                  className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                  style={{ animationDelay: "0.2s" }}
                />
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
            {error}
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="border-t border-gray-200 pt-4">
        <div className="flex gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about game strategy, dev help, debugging..."
            rows={1}
            className="flex-1 px-4 py-3 border-2 border-gray-200 rounded-xl text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-blue-500 resize-none bg-white"
          />
          <button
            onClick={send}
            disabled={!input.trim() || loading}
            className="px-5 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white rounded-xl font-semibold text-sm transition-colors"
          >
            {loading ? "..." : "Send"}
          </button>
        </div>
        <p className="text-xs text-gray-400 mt-2 text-center">
          Shift+Enter for new line &middot; Enter to send
        </p>
      </div>
    </div>
  );
}
