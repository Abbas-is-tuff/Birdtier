import React from 'react';
import { hex, CREW } from '../crew/crew.js';

// Head-and-shoulders portrait of a bird astronaut in its helmet, drawn from the same colours
// as the 3D model. Facing right.
export function BirdPortrait({ bird, size = 56, selected = false }) {
  const L = bird.look, c = (n) => hex(n);
  const id = `bp-${bird.id}`;
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" aria-label={`${bird.name}, ${bird.species}`} role="img">
      <defs>
        <radialGradient id={`${id}-bg`} cx="50%" cy="40%" r="60%">
          <stop offset="0%" stopColor="#1d3346" /><stop offset="100%" stopColor="#0a131c" />
        </radialGradient>
        <radialGradient id={`${id}-glass`} cx="35%" cy="30%" r="70%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.35" /><stop offset="60%" stopColor="#bfe3ff" stopOpacity="0.06" /><stop offset="100%" stopColor="#bfe3ff" stopOpacity="0.18" />
        </radialGradient>
        <clipPath id={`${id}-clip`}><circle cx="50" cy="50" r="48" /></clipPath>
      </defs>
      <g clipPath={`url(#${id}-clip)`}>
        <rect width="100" height="100" fill={`url(#${id}-bg)`} />
        {/* tail and body */}
        <path d={`M30 ${92 - L.tailLen * 6} L14 100 L34 100 Z`} fill={c(L.tail)} />
        <ellipse cx="48" cy="92" rx="30" ry="24" fill={c(L.body)} />
        <ellipse cx="56" cy="94" rx="18" ry="18" fill={c(L.chest)} />
        <ellipse cx="34" cy="90" rx="13" ry="18" fill={c(L.wing)} transform="rotate(-12 34 90)" />
        {L.wingPatch && <ellipse cx="36" cy="84" rx="6" ry="9" fill={c(L.wingPatch)} transform="rotate(-12 36 84)" />}
        {/* suit collar */}
        <path d="M22 76 Q50 66 78 76 L78 82 Q50 72 22 82 Z" fill="#e9edf1" />
        <rect x="44" y="70" width="12" height="5" rx="1.5" fill="#e9a23b" />
        {/* crest */}
        {L.crest && <path d="M44 30 Q40 8 30 4 Q44 10 50 28 Q50 10 44 2 Q56 12 55 30 Z" fill={c(L.crest)} />}
        {/* head */}
        {L.nape && <ellipse cx="46" cy="60" rx="20" ry="9" fill={c(L.nape)} />}
        <circle cx="50" cy="46" r="21" fill={c(L.head)} />
        <ellipse cx="57" cy="47" rx="15" ry="16" fill={c(L.face)} />
        {L.ring && <path d="M32 60 Q50 70 68 58" stroke={c(L.ring)} strokeWidth="3" fill="none" />}
        {L.cheek && <circle cx="58" cy="54" r="5.5" fill={c(L.cheek)} />}
        {/* eye */}
        <circle cx="60" cy="42" r="4" fill={c(L.eye)} />
        <circle cx="61.4" cy="40.6" r="1.3" fill="#fff" />
        {/* beak */}
        <path d="M68 42 Q82 44 76 56 Q72 50 66 51 Z" fill={c(L.beak)} />
        <path d="M67 51 Q71 52 72 56 Q68 56 66 53 Z" fill={c(L.beak)} opacity="0.8" />
        {/* helmet */}
        <circle cx="50" cy="45" r="30" fill={`url(#${id}-glass)`} stroke="#d9e6f0" strokeOpacity="0.55" strokeWidth="2" />
        <path d="M30 34 Q36 22 48 19" stroke="#fff" strokeOpacity="0.55" strokeWidth="2.5" fill="none" strokeLinecap="round" />
      </g>
      <circle cx="50" cy="50" r="48" fill="none" stroke={selected ? '#e9a23b' : '#2b3d4e'} strokeWidth={selected ? 4 : 2} />
    </svg>
  );
}

// Row of selectable crew portraits plus the selected bird's role and perk.
export function CrewPicker({ pilotId, onPick, size = 48, compact = false }) {
  const sel = CREW.find((b) => b.id === pilotId) || CREW[0];
  return (
    <div className={`crewpick ${compact ? 'compact' : ''}`}>
      <div className="crewrow">
        {CREW.map((b) => (
          <button key={b.id} className={`crewbtn ${b.id === sel.id ? 'on' : ''}`} title={`${b.name} — ${b.role}`} aria-pressed={b.id === sel.id} onClick={() => onPick(b.id)}>
            <BirdPortrait bird={b} size={size} selected={b.id === sel.id} />
            {!compact && <span>{b.name}</span>}
          </button>
        ))}
      </div>
      <div className="crewinfo">
        <b>{sel.name}</b> <span className="dim">· {sel.species} · {sel.role}</span>
        <div>{sel.perk}</div>
      </div>
    </div>
  );
}
