import { CharacterType } from './types';

// World Dimensions (Logical pixels)
export const WORLD_WIDTH = 1200;
export const WORLD_HEIGHT = 600;
export const GROUND_Y = 500;

// Physics
export const GRAVITY = 0.6;
export const FRICTION = 0.85;
export const MOVE_ACCEL = 1.2;
export const JUMP_FORCE = -16;
export const MAX_SPEED = 12;
export const STICK_REACH = 90;
export const STICK_DAMAGE_BASE = 10;
export const MOMENTUM_MULTIPLIER = 1.5;

// Game Rules
export const ROUND_DURATION = 80; // Seconds
export const MAX_STICKS = 5;
export const STICK_DURABILITY_LOSS_PER_HIT = 25;
export const SPECIAL_COOLDOWN_FRAMES = 300; // ~5 seconds

// Hazards
export const ANVIL_DAMAGE = 30;
export const ANVIL_WIDTH = 60;
export const ANVIL_HEIGHT = 50;

export const CHARACTER_STATS: Record<CharacterType, {
  name: string;
  description: string;
  color: string;
  width: number;
  height: number;
  mass: number; // Affects knockback
  speedMod: number;
  jumpMod: number;
  trait: string;
  specialName: string;
  specialDesc: string;
}> = {
  [CharacterType.SIR_WOBBLES]: {
    name: "Sir Wobbles",
    description: "Giant head, trips easily.",
    color: "#fbbf24", // Amber
    width: 60,
    height: 100,
    mass: 1.2,
    speedMod: 0.9,
    jumpMod: 0.9,
    trait: "Top Heavy",
    specialName: "Headbang Quake",
    specialDesc: "Slams ground to stun opponent.",
  },
  [CharacterType.GUMBY_LEGS]: {
    name: "Gumby Legs",
    description: "Long rubbery legs.",
    color: "#4ade80", // Green
    width: 50,
    height: 130,
    mass: 1.0,
    speedMod: 1.2,
    jumpMod: 1.1,
    trait: "High Step",
    specialName: "Noodle Spin",
    specialDesc: "Helicopter legs knockback.",
  },
  [CharacterType.BARREL_BOB]: {
    name: "Barrel Bob",
    description: "Rotund and rolls.",
    color: "#f87171", // Red
    width: 90,
    height: 80,
    mass: 1.5,
    speedMod: 0.8,
    jumpMod: 0.8,
    trait: "Bouncy",
    specialName: "Bowling Blitz",
    specialDesc: "Rolls invincibly forward.",
  },
  [CharacterType.FLAT_STANLEY]: {
    name: "Flat Stanley",
    description: "2D and thin.",
    color: "#60a5fa", // Blue
    width: 20,
    height: 110,
    mass: 0.5,
    speedMod: 1.1,
    jumpMod: 1.3,
    trait: "Paper Thin",
    specialName: "Paper Glide",
    specialDesc: "Floats in air, fast movement.",
  },
  [CharacterType.TINY_TIM]: {
    name: "Tiny Tim",
    description: "Small guy, big hat.",
    color: "#c084fc", // Purple
    width: 45,
    height: 70, // Short hitbox (hat doesn't count for hurtbox mostly)
    mass: 0.8,
    speedMod: 1.15,
    jumpMod: 1.1,
    trait: "Big Hat",
    specialName: "Hat Boomerang",
    specialDesc: "Throws hat to stun.",
  },
};