import React, { useState, useEffect, useRef, useCallback } from 'react';
import { GameState, PlayerState, CharacterType, Particle, Projectile, Hazard, NetworkMode, NetworkMessage } from './types';
import { 
  WORLD_WIDTH, WORLD_HEIGHT, GROUND_Y, GRAVITY, FRICTION, 
  MOVE_ACCEL, MAX_SPEED, JUMP_FORCE, STICK_REACH, 
  STICK_DAMAGE_BASE, MOMENTUM_MULTIPLIER, MAX_STICKS,
  ROUND_DURATION, STICK_DURABILITY_LOSS_PER_HIT, CHARACTER_STATS,
  SPECIAL_COOLDOWN_FRAMES, ANVIL_DAMAGE, ANVIL_WIDTH, ANVIL_HEIGHT
} from './constants';
import PlayerRenderer from './components/PlayerRenderer';
import StickPile from './components/StickPile';
import { Wind, Trophy, Timer, AlertTriangle, Zap, Wifi, Copy, Share2, Maximize, Minimize } from 'lucide-react';
import { Peer, DataConnection } from 'peerjs';

// --- Utils ---
const rectIntersect = (
  x1: number, y1: number, w1: number, h1: number,
  x2: number, y2: number, w2: number, h2: number
) => {
  return x2 < x1 + w1 && x2 + w2 > x1 && y2 < y1 + h1 && y2 + h2 > y1;
};

const INITIAL_HP = 100;

const createInitialPlayer = (id: number, char: CharacterType): PlayerState => ({
  id,
  character: char,
  x: id === 1 ? 200 : WORLD_WIDTH - 200,
  y: GROUND_Y,
  vx: 0,
  vy: 0,
  hp: INITIAL_HP,
  maxHp: INITIAL_HP,
  score: 0,
  facing: id === 1 ? 'RIGHT' : 'LEFT',
  isGrounded: true,
  isDucking: false,
  isAttacking: false,
  attackCooldown: 0,
  isStunned: false,
  stunTimer: 0,
  specialCooldown: 0,
  isSpecialActive: false,
  specialTimer: 0,
  isFlattened: false,
  flattenTimer: 0,
  hasStick: true,
  stickDurability: 100,
  sticksRemainingInPile: MAX_STICKS,
  animationFrame: 0,
});

const App: React.FC = () => {
  const [gameState, setGameState] = useState<GameState>(GameState.MENU);
  const [networkMode, setNetworkMode] = useState<NetworkMode>(NetworkMode.OFFLINE);
  const [winner, setWinner] = useState<number | null>(null);
  const [timeLeft, setTimeLeft] = useState(ROUND_DURATION);
  const [p1Char, setP1Char] = useState<CharacterType>(CharacterType.SIR_WOBBLES);
  const [p2Char, setP2Char] = useState<CharacterType>(CharacterType.GUMBY_LEGS);
  
  // Viewport Scaling & Fullscreen
  const [scale, setScale] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const handleResize = () => {
      const aspect = WORLD_WIDTH / WORLD_HEIGHT;
      const windowAspect = window.innerWidth / window.innerHeight;
      let newScale;
      if (windowAspect > aspect) {
        newScale = window.innerHeight / WORLD_HEIGHT;
      } else {
        newScale = window.innerWidth / WORLD_WIDTH;
      }
      setScale(newScale);
    };

    window.addEventListener('resize', handleResize);
    handleResize();
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(err => {
        console.error(`Error attempting to enable fullscreen: ${err.message}`);
      });
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    }
  };

  useEffect(() => {
      const handleFullscreenChange = () => {
          setIsFullscreen(!!document.fullscreenElement);
      };
      document.addEventListener('fullscreenchange', handleFullscreenChange);
      return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  // Environment State
  const [windForce, setWindForce] = useState(0);

  // Network State
  const [myPeerId, setMyPeerId] = useState<string>('');
  const [remotePeerIdInput, setRemotePeerIdInput] = useState('');
  const [connectionStatus, setConnectionStatus] = useState<string>('Disconnected');
  const peerRef = useRef<Peer | null>(null);
  const connRef = useRef<DataConnection | null>(null);

  const playersRef = useRef<[PlayerState, PlayerState]>([
    createInitialPlayer(1, CharacterType.SIR_WOBBLES),
    createInitialPlayer(2, CharacterType.GUMBY_LEGS)
  ]);
  
  const particlesRef = useRef<Particle[]>([]);
  const projectilesRef = useRef<Projectile[]>([]);
  const hazardsRef = useRef<Hazard[]>([]);
  
  const localKeysPressed = useRef<Set<string>>(new Set());
  const remoteKeysPressed = useRef<Set<string>>(new Set());
  
  const requestRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);
  
  const [renderPlayers, setRenderPlayers] = useState<[PlayerState, PlayerState]>(playersRef.current);
  const [renderParticles, setRenderParticles] = useState<Particle[]>([]);
  const [renderProjectiles, setRenderProjectiles] = useState<Projectile[]>([]);
  const [renderHazards, setRenderHazards] = useState<Hazard[]>([]);

  // --- Network Setup ---
  useEffect(() => {
    return () => {
      connRef.current?.close();
      peerRef.current?.destroy();
    };
  }, []);

  const initializePeer = (mode: NetworkMode) => {
    setNetworkMode(mode);
    setConnectionStatus('Initializing...');
    
    // Create peer (auto-generate ID)
    const peer = new Peer();
    peerRef.current = peer;

    peer.on('open', (id) => {
      setMyPeerId(id);
      setConnectionStatus(mode === NetworkMode.HOST ? 'Waiting for player...' : 'Ready to join');
    });

    peer.on('connection', (conn) => {
      if (mode === NetworkMode.HOST) {
        setupConnection(conn);
      } else {
        conn.close(); // Only accept connections if Host
      }
    });

    peer.on('error', (err) => {
        console.error(err);
        setConnectionStatus('Error: ' + err.type);
    });
  };

  const connectToPeer = () => {
    if (!peerRef.current || !remotePeerIdInput) return;
    setConnectionStatus('Connecting...');
    const conn = peerRef.current.connect(remotePeerIdInput);
    setupConnection(conn);
  };

  const setupConnection = (conn: DataConnection) => {
    connRef.current = conn;
    
    conn.on('open', () => {
      setConnectionStatus('Connected!');
    });

    conn.on('data', (data: any) => {
       const msg = data as NetworkMessage;
       if (msg.type === 'INPUT') {
           // Host receives input from Client
           remoteKeysPressed.current = new Set(msg.keys);
       } else if (msg.type === 'GAME_STATE') {
           // Client receives state from Host
           playersRef.current = msg.players as [PlayerState, PlayerState];
           projectilesRef.current = msg.projectiles;
           hazardsRef.current = msg.hazards;
           setTimeLeft(msg.timeLeft);
           setWindForce(msg.windForce);
       } else if (msg.type === 'PARTICLE_EVENT') {
           spawnParticle(msg.x, msg.y, msg.color, msg.count);
       } else if (msg.type === 'MENU_UPDATE') {
           if (msg.p1Char) setP1Char(msg.p1Char);
           if (msg.p2Char) setP2Char(msg.p2Char);
           if (msg.startGame) startGame();
       }
    });

    conn.on('close', () => {
        setConnectionStatus('Disconnected');
        setNetworkMode(NetworkMode.OFFLINE);
        setGameState(GameState.MENU);
    });
  };

  const syncMenuSelection = (char: CharacterType, isP1: boolean) => {
      if (!connRef.current) return;
      connRef.current.send({
          type: 'MENU_UPDATE',
          [isP1 ? 'p1Char' : 'p2Char']: char
      } as NetworkMessage);
  };

  // --- Input Handling ---
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => localKeysPressed.current.add(e.code);
    const handleKeyUp = (e: KeyboardEvent) => localKeysPressed.current.delete(e.code);
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  // --- Game Loop (Timer only for Host/Offline) ---
  useEffect(() => {
    if (gameState !== GameState.PLAYING) return;
    if (networkMode === NetworkMode.CLIENT) return; // Client relies on Host state for time

    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          endRound(null); 
          return 0;
        }
        return prev - 1;
      });

      // Random Hazards
      if (Math.random() < 0.1) {
        const dir = Math.random() > 0.5 ? 1 : -1;
        setWindForce(dir * (Math.random() * 0.2));
      } else if (Math.random() < 0.05) {
        setWindForce(0);
      }

      // Spawn Anvil Hazard
      if (Math.random() < 0.08) {
         hazardsRef.current.push({
           id: Math.random(),
           x: Math.random() * (WORLD_WIDTH - 100) + 50,
           y: -100,
           type: 'ANVIL',
           vy: 0,
           width: ANVIL_WIDTH,
           height: ANVIL_HEIGHT,
           active: true
         });
      }

    }, 1000);
    return () => clearInterval(interval);
  }, [gameState, networkMode]);

  const endRound = (winnerId: number | null) => {
    setWinner(winnerId);
    setGameState(GameState.GAME_OVER);
  };

  const startGame = () => {
    playersRef.current = [
      createInitialPlayer(1, p1Char),
      createInitialPlayer(2, p2Char)
    ];
    particlesRef.current = [];
    projectilesRef.current = [];
    hazardsRef.current = [];
    setTimeLeft(ROUND_DURATION);
    setWinner(null);
    setWindForce(0);
    setGameState(GameState.PLAYING);

    if (networkMode === NetworkMode.HOST && connRef.current) {
        connRef.current.send({ type: 'MENU_UPDATE', startGame: true });
    }
  };

  const spawnParticle = (x: number, y: number, color: string, count = 5) => {
    for (let i = 0; i < count; i++) {
        particlesRef.current.push({
            id: Math.random(),
            x, y,
            vx: (Math.random() - 0.5) * 10,
            vy: (Math.random() - 0.5) * 10,
            life: 1.0,
            color,
            size: Math.random() * 8 + 2
        });
    }
    // If Host, broadcast particle event
    if (networkMode === NetworkMode.HOST && connRef.current) {
        connRef.current.send({ type: 'PARTICLE_EVENT', x, y, color, count });
    }
  };

  const updatePhysics = useCallback((deltaTime: number) => {
    // Client does NOT run physics, only rendering from received state
    if (networkMode === NetworkMode.CLIENT) {
        // Send inputs to Host
        if (connRef.current) {
            connRef.current.send({
                type: 'INPUT',
                keys: Array.from(localKeysPressed.current)
            } as NetworkMessage);
        }
        return;
    }

    if (gameState !== GameState.PLAYING) return;

    const players = playersRef.current;
    
    players.forEach((p, index) => {
      const stats = CHARACTER_STATS[p.character];
      const opponent = players[index === 0 ? 1 : 0];
      const isP1 = index === 0;

      // --- Input Source Logic ---
      let keys: Set<string>;
      if (networkMode === NetworkMode.OFFLINE) {
          keys = localKeysPressed.current; // Both on local keyboard
      } else {
          // Host Mode
          if (isP1) {
              keys = localKeysPressed.current; // Host controls P1
          } else {
              keys = remoteKeysPressed.current; // Remote controls P2
          }
      }

      // Controls
      const leftKey = isP1 ? 'KeyA' : 'ArrowLeft';
      const rightKey = isP1 ? 'KeyD' : 'ArrowRight';
      const jumpKey = isP1 ? 'KeyW' : 'ArrowUp';
      const duckKey = isP1 ? 'KeyS' : 'ArrowDown';
      const attackKey = isP1 ? 'Space' : 'Enter';
      const specialKey = isP1 ? 'KeyF' : 'ShiftRight';

      // --- Status Updates ---
      if (p.isStunned) {
        p.stunTimer -= deltaTime;
        if (p.stunTimer <= 0) p.isStunned = false;
      }
      if (p.isFlattened) {
        p.flattenTimer -= deltaTime;
        if (p.flattenTimer <= 0) p.isFlattened = false;
      }
      if (p.specialCooldown > 0) p.specialCooldown -= deltaTime;
      if (p.isSpecialActive) {
        p.specialTimer -= deltaTime;
        if (p.specialTimer <= 0) p.isSpecialActive = false;
      }

      // --- Movement & Special Logic ---
      if (!p.isStunned && p.hp > 0 && !p.isFlattened) {
        
        // SPECIAL ACTIVATION
        if (keys.has(specialKey) && p.specialCooldown <= 0 && !p.isSpecialActive) {
          p.isSpecialActive = true;
          p.specialCooldown = SPECIAL_COOLDOWN_FRAMES;
          
          switch (p.character) {
             case CharacterType.SIR_WOBBLES:
                 p.specialTimer = 20; 
                 if (p.isGrounded) {
                     if (opponent.isGrounded) {
                         opponent.vy = -12;
                         opponent.isStunned = true;
                         opponent.stunTimer = 60;
                         spawnParticle(opponent.x, opponent.y, '#fbbf24', 10);
                     }
                 }
                 break;
             case CharacterType.GUMBY_LEGS:
                 p.specialTimer = 60; 
                 break;
             case CharacterType.BARREL_BOB:
                 p.specialTimer = 60;
                 p.vx = (p.facing === 'RIGHT' ? 20 : -20);
                 break;
             case CharacterType.FLAT_STANLEY:
                 p.specialTimer = 120;
                 p.vy = -10;
                 break;
             case CharacterType.TINY_TIM:
                 p.specialTimer = 30;
                 projectilesRef.current.push({
                     id: Math.random(),
                     ownerId: p.id,
                     x: p.x,
                     y: p.y - 40,
                     vx: p.facing === 'RIGHT' ? 15 : -15,
                     vy: 0,
                     width: 40, height: 20,
                     type: 'HAT',
                     returnToOwner: false,
                     active: true
                 });
                 break;
          }
        }

        // Standard Move Logic 
        if (!(p.character === CharacterType.BARREL_BOB && p.isSpecialActive)) {
            if (keys.has(leftKey)) {
                p.vx -= MOVE_ACCEL * stats.speedMod;
                p.facing = 'LEFT';
            }
            if (keys.has(rightKey)) {
                p.vx += MOVE_ACCEL * stats.speedMod;
                p.facing = 'RIGHT';
            }
            if (keys.has(jumpKey) && p.isGrounded) {
                p.vy = JUMP_FORCE * stats.jumpMod;
                p.isGrounded = false;
            }
        }

        p.vx += windForce * (p.character === CharacterType.FLAT_STANLEY ? 3 : 1);
        p.isDucking = keys.has(duckKey);

        // Attack Logic 
        if (keys.has(attackKey) && p.attackCooldown <= 0 && p.hasStick && !p.isSpecialActive) {
          p.isAttacking = true;
          p.attackCooldown = 20; 
          
          const attackX = p.facing === 'RIGHT' ? p.x + stats.width/2 : p.x - stats.width/2 - STICK_REACH;
          const attackY = p.y - stats.height/2; 
          const attackW = STICK_REACH;
          const attackH = 20;

          const oppStats = CHARACTER_STATS[opponent.character];
          const oppRect = {
              x: opponent.x - oppStats.width/2,
              y: opponent.y - oppStats.height,
              w: oppStats.width,
              h: oppStats.height
          };

          if (rectIntersect(attackX, attackY, attackW, attackH, oppRect.x, oppRect.y, oppRect.w, oppRect.h)) {
              const oppRolling = opponent.character === CharacterType.BARREL_BOB && opponent.isSpecialActive;
              
              if (!oppRolling) {
                  const velocityBonus = Math.abs(p.vx) * MOMENTUM_MULTIPLIER;
                  const damage = STICK_DAMAGE_BASE + velocityBonus;
                  
                  opponent.hp -= damage;
                  opponent.vx += (p.facing === 'RIGHT' ? 1 : -1) * (10 + velocityBonus) / oppStats.mass; 
                  opponent.vy -= 5;
                  opponent.isStunned = true;
                  opponent.stunTimer = 10 + (damage/2); 

                  p.stickDurability -= STICK_DURABILITY_LOSS_PER_HIT;
                  if (p.stickDurability <= 0) {
                      p.hasStick = false;
                      spawnParticle(p.x, p.y - 40, '#78350f', 8); 
                  }

                  if (damage > 25 && opponent.hasStick && Math.random() > 0.7) {
                      opponent.hasStick = false;
                      spawnParticle(opponent.x, opponent.y - 50, '#78350f', 3);
                  }
                  spawnParticle(opponent.x, opponent.y - oppStats.height/2, '#ef4444', 5);
              } else {
                  p.vx = (p.facing === 'RIGHT' ? -10 : 10);
                  p.isStunned = true;
                  p.stunTimer = 15;
              }
          }
        }
      }

      // Continuous Special Effects
      if (p.character === CharacterType.GUMBY_LEGS && p.isSpecialActive) {
          const range = 80;
          if (Math.abs(p.x - opponent.x) < range && Math.abs(p.y - opponent.y) < range) {
              opponent.vx = (p.x < opponent.x ? 15 : -15);
              opponent.vy = -5;
              opponent.hp -= 0.5; 
          }
      }
      
      if (p.character === CharacterType.FLAT_STANLEY && p.isSpecialActive) {
          p.vy = Math.min(p.vy, 1); 
          p.vx *= 1.05; 
      }

      // Physics
      p.vy += GRAVITY;
      p.vx *= (p.isGrounded ? (p.character === CharacterType.BARREL_BOB ? 0.98 : FRICTION) : 0.98); 
      
      const currentMaxSpeed = (p.character === CharacterType.BARREL_BOB && p.isSpecialActive) ? 25 : MAX_SPEED;
      p.vx = Math.max(Math.min(p.vx, currentMaxSpeed), -currentMaxSpeed);

      p.x += p.vx;
      p.y += p.vy;

      if (p.attackCooldown > 0) {
          p.attackCooldown--;
          if (p.attackCooldown < 10) p.isAttacking = false;
      }

      if (p.y >= GROUND_Y) {
        p.y = GROUND_Y;
        p.vy = 0;
        p.isGrounded = true;
      }
      if (p.x < stats.width/2) { p.x = stats.width/2; p.vx *= -0.5; }
      if (p.x > WORLD_WIDTH - stats.width/2) { p.x = WORLD_WIDTH - stats.width/2; p.vx *= -0.5; }

      // Stick Resupply
      if (!p.hasStick && p.sticksRemainingInPile > 0) {
          const pileX = isP1 ? 50 : WORLD_WIDTH - 50;
          if (Math.abs(p.x - pileX) < 60 && p.isGrounded) {
              p.hasStick = true;
              p.stickDurability = 100;
              p.sticksRemainingInPile--;
          }
      }

      if (p.hp <= 0 && gameState === GameState.PLAYING) {
          endRound(opponent.id);
      }
    });

    // Projectiles
    for (let i = projectilesRef.current.length - 1; i >= 0; i--) {
        const proj = projectilesRef.current[i];
        if (!proj.returnToOwner) {
             proj.x += proj.vx;
             if (Math.abs(proj.vx) > 0) proj.vx *= 0.95; 
             if (Math.abs(proj.vx) < 1) {
                 proj.returnToOwner = true;
             }
        } else {
            const owner = playersRef.current.find(p => p.id === proj.ownerId);
            if (owner) {
                const dx = owner.x - proj.x;
                const dy = (owner.y - 40) - proj.y;
                const dist = Math.sqrt(dx*dx + dy*dy);
                if (dist < 30) {
                    proj.active = false; 
                } else {
                    proj.x += (dx / dist) * 15;
                    proj.y += (dy / dist) * 15;
                }
            }
        }

        const opponent = playersRef.current.find(p => p.id !== proj.ownerId);
        if (opponent && proj.active) {
            const oppStats = CHARACTER_STATS[opponent.character];
             if (Math.abs(proj.x - opponent.x) < oppStats.width && Math.abs(proj.y - (opponent.y - oppStats.height/2)) < oppStats.height/2) {
                 opponent.isStunned = true;
                 opponent.stunTimer = 60;
                 opponent.hp -= 5;
                 spawnParticle(opponent.x, opponent.y - 50, '#c084fc', 5);
                 proj.returnToOwner = true; 
             }
        }
        if (!proj.active) projectilesRef.current.splice(i, 1);
    }

    // Hazards
    for (let i = hazardsRef.current.length - 1; i >= 0; i--) {
        const h = hazardsRef.current[i];
        if (h.type === 'ANVIL') {
            h.vy += GRAVITY;
            h.y += h.vy;
            
            playersRef.current.forEach(p => {
                const stats = CHARACTER_STATS[p.character];
                if (Math.abs(h.x - p.x) < (h.width + stats.width)/2 && Math.abs(h.y - (p.y - stats.height/2)) < stats.height/2) {
                    p.hp -= ANVIL_DAMAGE;
                    p.isFlattened = true;
                    p.flattenTimer = 120;
                    p.isStunned = true;
                    p.stunTimer = 60;
                    h.active = false;
                    spawnParticle(p.x, p.y, '#333', 10);
                }
            });

            if (h.y > GROUND_Y) {
                h.active = false;
                spawnParticle(h.x, GROUND_Y, '#333', 5);
            }
        }
        if (!h.active) hazardsRef.current.splice(i, 1);
    }

    // Host sends Full State Broadcast
    if (networkMode === NetworkMode.HOST && connRef.current) {
        connRef.current.send({
            type: 'GAME_STATE',
            players: playersRef.current,
            projectiles: projectilesRef.current,
            hazards: hazardsRef.current,
            timeLeft,
            windForce
        } as NetworkMessage);
    }

  }, [gameState, windForce, networkMode]);

  // Main Loop
  const loop = (time: number) => {
    updatePhysics(1); 
    
    // Update particles (visual only, run locally on both)
    for (let i = particlesRef.current.length - 1; i >= 0; i--) {
        const pt = particlesRef.current[i];
        pt.x += pt.vx;
        pt.y += pt.vy;
        pt.vy += GRAVITY * 0.5;
        pt.life -= 0.05;
        if (pt.y >= GROUND_Y) { pt.y = GROUND_Y; pt.vy *= -0.6; }
        if (pt.life <= 0) particlesRef.current.splice(i, 1);
    }

    setRenderPlayers([...playersRef.current]);
    setRenderParticles([...particlesRef.current]);
    setRenderProjectiles([...projectilesRef.current]);
    setRenderHazards([...hazardsRef.current]);

    lastTimeRef.current = time;
    requestRef.current = requestAnimationFrame(loop);
  };

  useEffect(() => {
    requestRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(requestRef.current!);
  }, [updatePhysics]);


  // --- UI RENDER ---

  const renderMenu = () => {
    // Show Lobby if Network Mode is Active
    if (networkMode !== NetworkMode.OFFLINE && connectionStatus !== 'Connected!' && connectionStatus !== 'Disconnected' && connectionStatus !== 'Error: null') {
        return (
            <div className="absolute inset-0 bg-black/90 flex flex-col items-center justify-center z-50 text-white">
                <div className="bg-slate-800 p-8 rounded-xl border border-blue-500 max-w-md w-full text-center">
                    <h2 className="text-3xl font-display text-amber-400 mb-6">{networkMode === NetworkMode.HOST ? "Host Game" : "Join Game"}</h2>
                    
                    {networkMode === NetworkMode.HOST && (
                         <div className="mb-6">
                            <p className="text-gray-400 mb-2">Share this Game ID with your friend:</p>
                            <div className="bg-black p-4 rounded flex items-center justify-between gap-2 border border-slate-600">
                                <code className="text-xl text-green-400 font-mono select-all">{myPeerId || "Generating ID..."}</code>
                                <button onClick={() => navigator.clipboard.writeText(myPeerId)} className="p-2 hover:bg-slate-700 rounded"><Copy size={16}/></button>
                            </div>
                            <div className="mt-4 flex items-center justify-center gap-2 text-yellow-500 animate-pulse">
                                <Wifi size={20} /> Waiting for connection...
                            </div>
                         </div>
                    )}

                    {networkMode === NetworkMode.CLIENT && (
                         <div className="mb-6">
                             <p className="text-gray-400 mb-2">Enter Host Game ID:</p>
                             <input 
                                type="text" 
                                value={remotePeerIdInput}
                                onChange={(e) => setRemotePeerIdInput(e.target.value)}
                                className="w-full bg-black p-3 rounded border border-slate-600 text-white text-center font-mono focus:border-blue-500 outline-none"
                                placeholder="paste-id-here"
                             />
                             <button 
                                onClick={connectToPeer}
                                disabled={!remotePeerIdInput}
                                className="mt-4 w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold py-3 rounded"
                             >
                                 Connect
                             </button>
                         </div>
                    )}
                     <div className="mt-2 text-sm text-red-400">{connectionStatus.startsWith('Error') ? connectionStatus : ''}</div>
                    <button onClick={() => setNetworkMode(NetworkMode.OFFLINE)} className="mt-4 text-gray-500 hover:text-white underline">Cancel</button>
                </div>
            </div>
        );
    }

    return (
    <div className="absolute inset-0 bg-black/90 flex flex-col items-center justify-center z-50 text-white overflow-y-auto">
      <h1 className="font-display text-5xl text-amber-400 mb-2 tracking-wider transform -rotate-3 mt-8">Stick-Poke Mayhem</h1>
      
      {/* Network Status Indicator */}
      {connectionStatus === 'Connected!' && (
          <div className="bg-green-600/20 text-green-400 px-4 py-1 rounded-full border border-green-500/50 mb-4 flex items-center gap-2">
              <Wifi size={16} /> Online: {networkMode === NetworkMode.HOST ? "Hosting" : "Client"}
          </div>
      )}

      <h2 className="text-xl text-gray-300 mb-6">Choose Your Poker</h2>
      
      <div className="flex gap-8 mb-8 w-full max-w-4xl px-4">
        {/* Player 1 Selection */}
        <div className={`flex-1 bg-slate-800 p-4 rounded-xl border border-blue-500 ${networkMode === NetworkMode.CLIENT ? 'opacity-50 pointer-events-none' : ''}`}>
            <h3 className="text-2xl font-bold mb-4 text-blue-400 text-center">Player 1 {networkMode === NetworkMode.HOST && "(You)"}</h3>
            <div className="space-y-2">
                {Object.values(CharacterType).map(c => (
                    <button 
                        key={c}
                        onClick={() => { setP1Char(c); syncMenuSelection(c, true); }}
                        className={`block w-full px-4 py-3 rounded text-left transition-all ${p1Char === c ? 'bg-blue-600 text-white scale-105 shadow-lg' : 'bg-slate-700 text-gray-300 hover:bg-slate-600'}`}
                    >
                        <div className="flex justify-between items-center">
                            <span className="font-bold">{CHARACTER_STATS[c].name}</span>
                            <span className="text-xs opacity-75">{CHARACTER_STATS[c].specialName}</span>
                        </div>
                    </button>
                ))}
            </div>
        </div>
        
        {/* Player 2 Selection */}
        <div className={`flex-1 bg-slate-800 p-4 rounded-xl border border-red-500 ${networkMode === NetworkMode.HOST ? 'opacity-50 pointer-events-none' : ''}`}>
            <h3 className="text-2xl font-bold mb-4 text-red-400 text-center">Player 2 {networkMode === NetworkMode.CLIENT && "(You)"}</h3>
            <div className="space-y-2">
                {Object.values(CharacterType).map(c => (
                    <button 
                        key={c}
                        onClick={() => { setP2Char(c); syncMenuSelection(c, false); }}
                        className={`block w-full px-4 py-3 rounded text-left transition-all ${p2Char === c ? 'bg-red-600 text-white scale-105 shadow-lg' : 'bg-slate-700 text-gray-300 hover:bg-slate-600'}`}
                    >
                         <div className="flex justify-between items-center">
                            <span className="font-bold">{CHARACTER_STATS[c].name}</span>
                            <span className="text-xs opacity-75">{CHARACTER_STATS[c].specialName}</span>
                        </div>
                    </button>
                ))}
            </div>
        </div>
      </div>

      <div className="flex gap-4">
          {networkMode === NetworkMode.OFFLINE && (
            <>
                <button 
                    onClick={() => initializePeer(NetworkMode.HOST)}
                    className="px-8 py-3 bg-slate-700 hover:bg-slate-600 text-white font-bold rounded flex items-center gap-2"
                >
                    <Share2 size={20}/> Host Online
                </button>
                <button 
                    onClick={() => initializePeer(NetworkMode.CLIENT)}
                    className="px-8 py-3 bg-slate-700 hover:bg-slate-600 text-white font-bold rounded flex items-center gap-2"
                >
                    <Wifi size={20}/> Join Online
                </button>
            </>
          )}

          {(networkMode === NetworkMode.OFFLINE || networkMode === NetworkMode.HOST) && (
              <button 
                onClick={startGame}
                disabled={networkMode === NetworkMode.HOST && connectionStatus !== 'Connected!'}
                className="px-16 py-4 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 disabled:cursor-not-allowed text-black font-display text-4xl rounded-xl shadow-lg transform hover:scale-110 transition-transform"
              >
                FIGHT!
              </button>
          )}
          
          {networkMode === NetworkMode.CLIENT && (
              <div className="px-16 py-4 bg-slate-800 text-gray-400 font-bold rounded-xl border border-slate-600 animate-pulse">
                  Waiting for Host...
              </div>
          )}
      </div>
    </div>
  )};

  const renderGameOver = () => (
    <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center z-50 animate-in fade-in duration-500">
       <Trophy className="w-24 h-24 text-yellow-400 mb-4 animate-bounce" />
       <h2 className="font-display text-6xl mb-4">
           {winner ? `Player ${winner} Wins!` : "It's a Draw!"}
       </h2>
       {networkMode !== NetworkMode.CLIENT && (
           <button 
            onClick={() => setGameState(GameState.MENU)}
            className="px-8 py-3 bg-white text-black font-bold text-xl rounded hover:bg-gray-200"
          >
            Play Again
          </button>
       )}
       {networkMode === NetworkMode.CLIENT && (
           <p className="text-gray-400">Waiting for host...</p>
       )}
    </div>
  );

  return (
    <div className="w-full h-screen bg-slate-900 flex items-center justify-center overflow-hidden">
      <div className="relative overflow-hidden shadow-2xl rounded-xl border-4 border-slate-700 bg-gradient-to-b from-sky-300 via-sky-200 to-green-100"
           style={{ 
               width: WORLD_WIDTH, 
               height: WORLD_HEIGHT, 
               transform: `scale(${scale})`,
               transformOrigin: 'center center'
           }}>

        {/* Fullscreen Button */}
        <button 
            onClick={toggleFullscreen}
            className="absolute top-4 right-4 z-50 p-2 bg-slate-800/50 hover:bg-slate-800 text-white rounded-lg transition-colors"
        >
            {isFullscreen ? <Minimize size={24} /> : <Maximize size={24} />}
        </button>
        
        {/* Environment - Wind */}
        {windForce !== 0 && (
             <div className="absolute top-0 left-0 w-full h-full pointer-events-none opacity-30">
                 {Array.from({length: 10}).map((_, i) => (
                     <div key={i} className="absolute animate-pulse text-white" 
                          style={{
                              left: `${(Date.now() / 10 + i * 100) % 100}%`,
                              top: `${i * 10}%`,
                              transform: `scaleX(${windForce > 0 ? 1 : -1})`
                          }}>
                         <Wind size={48 + Math.random() * 32} />
                     </div>
                 ))}
             </div>
        )}

        {/* The Ground */}
        <div 
            className="absolute bottom-0 left-0 right-0 bg-green-600 border-t-8 border-green-800"
            style={{ height: '16.6%' }} 
        >
            <div className="w-full h-4 bg-green-500 opacity-50" /> 
        </div>

        {/* Stick Piles */}
        <StickPile count={renderPlayers[0].sticksRemainingInPile} x={50} y={GROUND_Y} isPlayer1={true} />
        <StickPile count={renderPlayers[1].sticksRemainingInPile} x={1150} y={GROUND_Y} isPlayer1={false} />

        {/* Projectiles */}
        {renderProjectiles.map(p => (
            <div 
                key={p.id}
                className="absolute bg-purple-900 border-2 border-purple-950 rounded-full z-20 flex items-center justify-center"
                style={{
                    left: p.x, top: p.y, width: p.width, height: p.height,
                    transform: `translate(-50%, -50%) rotate(${Date.now()}deg)`
                }}
            >
                <div className="w-full h-1 bg-purple-400" />
            </div>
        ))}

        {/* Hazards (Anvils) */}
        {renderHazards.map(h => (
            <div 
                key={h.id}
                className="absolute bg-gray-800 border-2 border-black rounded z-20 flex items-center justify-center text-white font-bold"
                style={{
                    left: h.x, top: h.y, width: h.width, height: h.height,
                    transform: 'translate(-50%, -50%)'
                }}
            >
                <div className="absolute -top-10 animate-bounce text-red-600"><AlertTriangle size={24} /></div>
                10T
            </div>
        ))}

        {/* Players */}
        {renderPlayers.map(p => <PlayerRenderer key={p.id} player={p} />)}

        {/* Particles */}
        {renderParticles.map(p => (
            <div 
                key={p.id}
                className="absolute rounded-full"
                style={{
                    left: p.x, top: p.y,
                    width: p.size, height: p.size,
                    backgroundColor: p.color,
                    opacity: p.life,
                    transform: 'translate(-50%, -50%)'
                }}
            />
        ))}

        {/* HUD */}
        <div className="absolute top-0 left-0 w-full p-4 flex justify-between items-start pointer-events-none">
            {/* P1 Stats */}
            <div className="w-1/3">
                <div className="flex items-center gap-2 mb-1">
                    <span className="font-display text-2xl text-blue-600">P1</span>
                    <span className="font-bold text-slate-700">{CHARACTER_STATS[renderPlayers[0].character].name}</span>
                </div>
                <div className="h-6 bg-slate-800 rounded-full overflow-hidden border-2 border-slate-900 relative">
                    <div 
                        className="h-full bg-amber-400 transition-all duration-200"
                        style={{ width: `${Math.max(0, renderPlayers[0].hp)}%` }}
                    />
                </div>
                <div className="flex gap-4 mt-2">
                     {/* Stick */}
                     {renderPlayers[0].hasStick ? (
                         <div className="w-24 h-2 bg-slate-400 rounded-full overflow-hidden"><div className="h-full bg-amber-700" style={{ width: `${renderPlayers[0].stickDurability}%`}} /></div>
                     ) : <span className="text-red-600 text-xs font-bold animate-pulse">NO STICK</span>}
                     {/* Special Cooldown */}
                     <div className="flex items-center gap-1">
                         <Zap size={16} className={renderPlayers[0].specialCooldown <= 0 ? "text-yellow-400 fill-yellow-400" : "text-gray-400"} />
                         <div className="w-20 h-2 bg-slate-400 rounded-full overflow-hidden">
                             <div className="h-full bg-yellow-400" style={{ width: `${Math.max(0, 100 - (renderPlayers[0].specialCooldown / SPECIAL_COOLDOWN_FRAMES * 100))}%`}} />
                         </div>
                     </div>
                </div>
            </div>

            {/* Timer & Environment Status */}
            <div className="flex flex-col items-center gap-2">
                <div className="bg-slate-800 text-white px-4 py-2 rounded-lg border-2 border-slate-600 font-display text-3xl shadow-lg flex items-center gap-2">
                    <Timer size={24} />
                    {timeLeft}
                </div>
                {windForce !== 0 && (
                    <div className="bg-blue-500/80 text-white px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1 animate-pulse">
                        <Wind size={14} /> GUSTY WINDS
                    </div>
                )}
            </div>

            {/* P2 Stats */}
            <div className="w-1/3 text-right">
                <div className="flex items-center gap-2 mb-1 justify-end">
                    <span className="font-bold text-slate-700">{CHARACTER_STATS[renderPlayers[1].character].name}</span>
                    <span className="font-display text-2xl text-red-600">P2</span>
                </div>
                <div className="h-6 bg-slate-800 rounded-full overflow-hidden border-2 border-slate-900 relative">
                    <div 
                        className="h-full bg-amber-400 transition-all duration-200 ml-auto"
                        style={{ width: `${Math.max(0, renderPlayers[1].hp)}%` }}
                    />
                </div>
                <div className="flex gap-4 mt-2 justify-end">
                     <div className="flex items-center gap-1">
                         <div className="w-20 h-2 bg-slate-400 rounded-full overflow-hidden">
                             <div className="h-full bg-yellow-400" style={{ width: `${Math.max(0, 100 - (renderPlayers[1].specialCooldown / SPECIAL_COOLDOWN_FRAMES * 100))}%`}} />
                         </div>
                         <Zap size={16} className={renderPlayers[1].specialCooldown <= 0 ? "text-yellow-400 fill-yellow-400" : "text-gray-400"} />
                     </div>
                     {renderPlayers[1].hasStick ? (
                         <div className="w-24 h-2 bg-slate-400 rounded-full overflow-hidden"><div className="h-full bg-amber-700" style={{ width: `${renderPlayers[1].stickDurability}%`}} /></div>
                     ) : <span className="text-red-600 text-xs font-bold animate-pulse">NO STICK</span>}
                </div>
            </div>
        </div>

        {/* Overlays */}
        {gameState === GameState.MENU && renderMenu()}
        {gameState === GameState.GAME_OVER && renderGameOver()}
        
      </div>
      
      <div className="fixed bottom-4 right-4 text-slate-500 text-xs text-right opacity-50 pointer-events-none">
        P1: WASD + Space (Special: F) | P2: Arrows + Enter (Special: R-Shift)<br/>
        {networkMode === NetworkMode.HOST ? "Hosting Game" : (networkMode === NetworkMode.CLIENT ? "Client Mode" : "Local Play")}
      </div>
    </div>
  );
};

export default App;