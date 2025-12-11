import React from 'react';
import { PlayerState, CharacterType } from '../types';
import { CHARACTER_STATS, STICK_REACH } from '../constants';

interface PlayerRendererProps {
  player: PlayerState;
  hasProjectile?: boolean; // For Tiny Tim logic
}

const PlayerRenderer: React.FC<PlayerRendererProps> = ({ player, hasProjectile = false }) => {
  const stats = CHARACTER_STATS[player.character];
  const isFacingRight = player.facing === 'RIGHT';
  
  // Ragdoll/Wobble calculations
  const lean = player.vx * 2;
  const bounce = Math.abs(Math.sin(Date.now() / 100)) * (Math.abs(player.vx) > 0.1 ? 5 : 0);
  
  // Special Move Visual overrides
  const isRolling = player.character === CharacterType.BARREL_BOB && player.isSpecialActive;
  const isGliding = player.character === CharacterType.FLAT_STANLEY && player.isSpecialActive;
  const isSpinning = player.character === CharacterType.GUMBY_LEGS && player.isSpecialActive;

  const renderBody = () => {
    switch (player.character) {
      case CharacterType.SIR_WOBBLES:
        return (
          <>
            <div className="absolute bottom-0 w-8 h-12 bg-amber-600 left-1/2 -translate-x-1/2 rounded-full" />
            <div 
              className="absolute bottom-10 w-20 h-24 bg-amber-300 border-4 border-amber-600 rounded-[2rem] left-1/2 -translate-x-1/2 flex items-center justify-center overflow-hidden"
              style={{ transform: `rotate(${lean * 2}deg) scale(${player.isSpecialActive ? 1.3 : 1})`, transition: 'transform 0.1s' }}
            >
              <div className="space-y-2">
                 <div className="flex gap-4">
                    <div className="w-4 h-4 bg-black rounded-full" />
                    <div className="w-4 h-4 bg-black rounded-full" />
                 </div>
                 <div className="w-8 h-2 bg-black rounded-full mx-auto" />
              </div>
            </div>
          </>
        );
      
      case CharacterType.BARREL_BOB:
        return (
          <div 
            className="absolute bottom-0 w-full h-full bg-red-400 border-4 border-red-700 rounded-full flex items-center justify-center"
            style={{ transform: `rotate(${isRolling ? Date.now() / 2 : player.vx * 10}deg)` }}
          >
             <div className="w-full border-t-4 border-red-800 absolute top-1/4" />
             <div className="w-full border-t-4 border-red-800 absolute bottom-1/4" />
             <span className="font-bold text-red-900">{isRolling ? "><" : "BOB"}</span>
          </div>
        );

      case CharacterType.GUMBY_LEGS:
        return (
            <>
             {/* Legs - Spin if special */}
             <div className={`absolute bottom-0 w-full h-2/3 flex justify-between px-2 ${isSpinning ? 'animate-spin' : ''}`}>
                <div 
                    className="w-3 bg-green-600 rounded-full origin-top"
                    style={{ 
                        height: '100%',
                        transform: !isSpinning ? `skewX(${Math.sin(Date.now() / 100) * 20}deg)` : 'none'
                    }} 
                />
                <div 
                    className="w-3 bg-green-600 rounded-full origin-top"
                    style={{ 
                        height: '100%',
                        transform: !isSpinning ? `skewX(${Math.cos(Date.now() / 100) * 20}deg)` : 'rotate(180deg)'
                    }} 
                />
             </div>
             {/* Torso */}
             <div className="absolute top-0 w-full h-1/3 bg-green-400 rounded-lg border-2 border-green-700" />
            </>
        );

      case CharacterType.FLAT_STANLEY:
        return (
            <div 
                className="w-full h-full bg-blue-300 border-2 border-blue-600 transition-all duration-300"
                style={{ 
                    transform: isGliding 
                        ? 'rotate(90deg) scaleX(0.5)' 
                        : (isFacingRight ? 'scaleX(1)' : 'scaleX(-1)')
                }}
            >
                <div className="absolute top-2 left-1/2 -translate-x-1/2 w-4 h-4 bg-black rounded-full opacity-20" />
                <div className="absolute top-8 left-1/2 -translate-x-1/2 w-full h-1 bg-blue-600" />
            </div>
        );

      case CharacterType.TINY_TIM:
        // Tiny Tim loses his hat when projectile is active (conceptually handled by passing prop or checking cooldown if needed, 
        // but let's assume if he's throwing it, it's not on his head)
        const showHat = !player.isSpecialActive; // Simple check: if special active, hat is "thrown"
        
        return (
            <>
                <div className="absolute bottom-0 w-full h-1/2 bg-purple-500 rounded-md" />
                <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-10 h-10 bg-purple-300 rounded-full" />
                {showHat && (
                    <div 
                        className="absolute -top-10 left-1/2 -translate-x-1/2 w-32 h-20 bg-purple-900 flex items-end justify-center"
                        style={{ 
                            transform: `translate(-50%, ${player.isStunned ? -20 : 0}px) rotate(${lean * 3}deg)`,
                            transition: 'transform 0.1s'
                        }}
                    >
                        <div className="w-full h-4 bg-purple-950 absolute bottom-0" />
                    </div>
                )}
            </>
        );
      
      default: return <div className="bg-gray-500 w-full h-full" />;
    }
  };

  return (
    <div
      className="absolute transition-transform duration-75"
      style={{
        left: player.x,
        top: player.y,
        width: stats.width,
        height: player.isFlattened ? stats.height * 0.2 : stats.height, // Flatten effect
        transform: `translate(-50%, -100%) scaleX(${isFacingRight && !isGliding ? 1 : (isGliding ? 1 : -1)})`,
        opacity: player.hp <= 0 ? 0.5 : 1,
        filter: player.isStunned ? 'grayscale(100%)' : 'none'
      }}
    >
      {/* Player Indicator */}
      <div 
        className="absolute -top-12 left-1/2 -translate-x-1/2 font-display text-white text-xl drop-shadow-md whitespace-nowrap"
        style={{ transform: `scaleX(${isFacingRight && !isGliding ? 1 : -1})` }}
      >
        P{player.id}
      </div>

      {/* The Stick - Hidden if rolling */}
      {player.hasStick && !isRolling && (
        <div
            className="absolute top-1/2 left-1/2 origin-left bg-amber-800 border border-amber-950 rounded-sm z-10"
            style={{
                width: STICK_REACH,
                height: 6,
                transform: `rotate(${player.isAttacking ? (player.isDucking ? 20 : -20) : (player.isDucking ? 10 : 45)}deg) translateX(${player.isAttacking ? 20 : 0}px)`,
                transition: 'transform 0.1s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
            }}
        >
             {player.stickDurability < 50 && (
                 <div className="absolute left-1/2 top-0 w-1 h-full bg-black/30" />
             )}
        </div>
      )}

      {/* Body */}
      <div className="relative w-full h-full">
         {renderBody()}
      </div>

      {/* Effects */}
      {player.isStunned && (
          <div className="absolute -top-10 left-0 w-full flex justify-center animate-bounce">
              <span className="text-2xl">💫</span>
          </div>
      )}
      {player.isSpecialActive && player.character === CharacterType.SIR_WOBBLES && (
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-40 h-4 bg-amber-500/50 rounded-full animate-ping" />
      )}
    </div>
  );
};

export default PlayerRenderer;