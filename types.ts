export enum CharacterType {
  SIR_WOBBLES = 'SIR_WOBBLES',
  GUMBY_LEGS = 'GUMBY_LEGS',
  BARREL_BOB = 'BARREL_BOB',
  FLAT_STANLEY = 'FLAT_STANLEY',
  TINY_TIM = 'TINY_TIM',
}

export enum GameState {
  MENU = 'MENU',
  PLAYING = 'PLAYING',
  GAME_OVER = 'GAME_OVER',
}

export enum NetworkMode {
  OFFLINE = 'OFFLINE',
  HOST = 'HOST',
  CLIENT = 'CLIENT'
}

export interface PlayerState {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  hp: number;
  maxHp: number;
  score: number;
  character: CharacterType;
  facing: 'LEFT' | 'RIGHT';
  isGrounded: boolean;
  isDucking: boolean;
  isAttacking: boolean;
  attackCooldown: number;
  isStunned: boolean;
  stunTimer: number;
  
  // Special Moves
  specialCooldown: number;
  isSpecialActive: boolean;
  specialTimer: number;

  // Status Effects
  isFlattened: boolean;
  flattenTimer: number;
  
  // Stick Mechanics
  hasStick: boolean;
  stickDurability: number; // 0-100
  sticksRemainingInPile: number;
  
  // Visual states
  animationFrame: number;
}

export interface Projectile {
  id: number;
  ownerId: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  width: number;
  height: number;
  type: 'HAT';
  returnToOwner: boolean;
  active: boolean;
}

export interface Hazard {
  id: number;
  x: number;
  y: number;
  type: 'ANVIL';
  vy: number;
  width: number;
  height: number;
  active: boolean;
}

export interface Particle {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  color: string;
  size: number;
}

// Network Payloads
export type NetworkMessage = 
  | { type: 'INPUT'; keys: string[] }
  | { type: 'GAME_STATE'; players: PlayerState[]; projectiles: Projectile[]; hazards: Hazard[]; timeLeft: number; windForce: number }
  | { type: 'PARTICLE_EVENT'; x: number; y: number; color: string; count: number }
  | { type: 'MENU_UPDATE'; p1Char?: CharacterType; p2Char?: CharacterType; startGame?: boolean };
