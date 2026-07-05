import React from "react";

/**
 * AvatarFrame — animierte Profilbild-Rahmen (Cosmetics).
 *
 * Nutzung:
 *   <AvatarFrame type="beer" src={user.avatar_url} size={120} />
 *   <AvatarFrame type="fire" size={96} paused />   // paused = Animation aus (z.B. für Listen)
 *
 * Alle Rahmen basieren auf einer internen 152x152-Geometrie (Foto = 104px)
 * und werden per transform:scale auf `size` skaliert — die getunten Werte
 * bleiben dadurch pixelgenau erhalten.
 */

export type FrameType =
  | "stars"
  | "hearts"
  | "sparkle"
  | "snow"
  | "aurora"
  | "pulse"
  | "beer"
  | "fire"
  | "confetti";

export interface AvatarFrameProps {
  type: FrameType;
  /** Angezeigter Foto-Durchmesser in px (default 104). */
  size?: number;
  /** Bild-URL. Fehlt sie, wird ein Platzhalter gezeigt. */
  src?: string;
  /** Alt-Text fürs Bild. */
  alt?: string;
  /** Animationen anhalten (spart CPU in langen Listen). */
  paused?: boolean;
  /** Akzentfarbe überschreiben (sonst Standard je Typ). */
  accent?: string;
  /** Fallback-Inhalt, wenn keine Bild-URL vorhanden ist (z.B. Initiale). */
  fallback?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

const BASE = 104; // interne Foto-Größe
const BOX = 152; // interne Container-Größe

const DEFAULT_ACCENT: Record<FrameType, string> = {
  stars: "oklch(0.80 0.13 88)",
  hearts: "oklch(0.72 0.16 12)",
  sparkle: "oklch(0.66 0.17 300)",
  snow: "oklch(0.72 0.11 235)",
  aurora: "oklch(0.75 0.13 165)",
  pulse: "oklch(0.72 0.16 30)",
  beer: "oklch(0.80 0.15 84)",
  fire: "oklch(0.68 0.20 38)",
  confetti: "oklch(0.68 0.17 300)",
};

const KEYFRAMES = `
@keyframes af-spin { to { transform: rotate(360deg); } }
@keyframes af-spinRev { to { transform: rotate(-360deg); } }
@keyframes af-twinkle { 0%,100% { opacity:.35; transform:scale(.6);} 50% { opacity:1; transform:scale(1);} }
@keyframes af-beat { 0%,100% { transform:scale(.72);} 50% { transform:scale(.96);} }
@keyframes af-fall { 0% { transform:translateY(-24px); opacity:0;} 12%{opacity:1;} 88%{opacity:1;} 100%{transform:translateY(172px); opacity:0;} }
@keyframes af-pulseRing { 0% { transform:scale(1); opacity:.55;} 100%{transform:scale(1.45); opacity:0;} }
@keyframes af-glow { 0%,100% { opacity:.55;} 50%{opacity:1;} }
@keyframes af-rise { 0% { transform:translateY(22px); opacity:0;} 18%{opacity:1;} 80%{opacity:.9;} 100%{transform:translateY(-34px); opacity:0;} }
@keyframes af-flicker { 0%,100% { opacity:.6; transform:scale(.82);} 50%{opacity:1; transform:scale(1.12);} }
@keyframes af-floaty { 0%,100% { transform:translateY(0);} 50%{transform:translateY(-3px);} }
@keyframes af-flame { 0%,100% { transform:scaleY(.78) scaleX(.94); opacity:.8;} 50%{transform:scaleY(1.18) scaleX(1); opacity:1;} }
`;

let injected = false;
function useKeyframes() {
  React.useEffect(() => {
    if (injected || typeof document === "undefined") return;
    if (document.getElementById("af-keyframes")) {
      injected = true;
      return;
    }
    const el = document.createElement("style");
    el.id = "af-keyframes";
    el.textContent = KEYFRAMES;
    document.head.appendChild(el);
    injected = true;
  }, []);
}

// Positioniert ein aufrechtes Element auf einem Kreis (Radius r, Winkel a°).
function orbit(node: React.ReactNode, a: number, radius: number, size: number, key: React.Key) {
  return (
    <div
      key={key}
      style={{
        position: "absolute",
        left: "50%",
        top: "50%",
        width: size,
        height: size,
        marginLeft: -size / 2,
        marginTop: -size / 2,
        transform: `rotate(${a}deg) translateY(${-radius}px) rotate(${-a}deg)`,
      }}
    >
      {node}
    </div>
  );
}

// Wie orbit, aber radial ausgerichtet (Element zeigt nach außen) — für Flammen.
function orbitR(node: React.ReactNode, a: number, radius: number, w: number, h: number, key: React.Key) {
  return (
    <div
      key={key}
      style={{
        position: "absolute",
        left: "50%",
        top: "50%",
        width: w,
        height: h,
        marginLeft: -w / 2,
        marginTop: -h / 2,
        transform: `rotate(${a}deg) translateY(${-radius}px)`,
      }}
    >
      {node}
    </div>
  );
}

function deco(type: FrameType, A: string, paused: boolean): React.ReactNode {
  const ps = paused ? "paused" : "running";
  const starClip = "polygon(50% 0%,61% 35%,98% 35%,68% 57%,79% 91%,50% 70%,21% 91%,32% 57%,2% 35%,39% 35%)";
  const plusClip = "polygon(43% 0,57% 0,57% 43%,100% 43%,100% 57%,57% 57%,57% 100%,43% 100%,43% 57%,0 57%,0 43%,43% 43%)";
  const heartClip =
    'path("M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z")';

  if (type === "stars") {
    const items = [];
    for (let i = 0; i < 10; i++) {
      items.push(
        orbit(
          <div style={{ width: "100%", height: "100%", background: A, clipPath: starClip, animation: `af-twinkle 2.6s ease-in-out ${(i * 0.2).toFixed(2)}s infinite`, animationPlayState: ps }} />,
          i * 36, 64, 15, i,
        ),
      );
    }
    return (
      <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
        <div style={{ position: "absolute", inset: 0, animation: "af-spin 22s linear infinite", animationPlayState: ps }}>{items}</div>
      </div>
    );
  }

  if (type === "hearts") {
    const items = [];
    for (let i = 0; i < 8; i++) {
      items.push(
        orbit(
          <div style={{ width: "100%", height: "100%", background: A, clipPath: heartClip, animation: `af-beat 1.9s ease-in-out ${(i * 0.16).toFixed(2)}s infinite`, animationPlayState: ps }} />,
          i * 45, 65, 24, i,
        ),
      );
    }
    return (
      <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
        <div style={{ position: "absolute", inset: 0, animation: "af-spinRev 28s linear infinite", animationPlayState: ps }}>{items}</div>
      </div>
    );
  }

  if (type === "sparkle") {
    const pts: [number, number, number][] = [
      [8, 66, 16], [58, 52, 10], [108, 64, 13], [162, 54, 9], [208, 66, 15], [256, 52, 11], [300, 63, 12], [342, 56, 9],
    ];
    const items = pts.map((p, i) =>
      orbit(
        <div style={{ width: "100%", height: "100%", background: A, clipPath: plusClip, animation: `af-twinkle ${(1.8 + (i % 3) * 0.5).toFixed(1)}s ease-in-out ${(i * 0.28).toFixed(2)}s infinite`, animationPlayState: ps }} />,
        p[0], p[1], p[2], i,
      ),
    );
    return <div style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 3 }}>{items}</div>;
  }

  if (type === "snow") {
    const flakes = [];
    for (let i = 0; i < 24; i++) {
      const left = (i * 37) % 100, dur = 3 + (i % 4) * 0.8, delay = (i * 0.29) % 3.4, sz = i % 3 === 0 ? 7 : 5;
      flakes.push(
        <div key={i} style={{ position: "absolute", top: -10, left: left + "%", width: sz, height: sz, borderRadius: "50%", background: A, opacity: 0.85, animation: `af-fall ${dur.toFixed(1)}s linear ${delay.toFixed(2)}s infinite`, animationPlayState: ps }} />,
      );
    }
    return (
      <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
        <div style={{ position: "absolute", inset: 0, borderRadius: "50%", overflow: "hidden", zIndex: 3 }}>{flakes}</div>
      </div>
    );
  }

  if (type === "aurora") {
    return (
      <div style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 0 }}>
        <div style={{ position: "absolute", inset: 0, borderRadius: "50%", background: "conic-gradient(from 0deg, oklch(0.80 0.13 165), oklch(0.72 0.13 235), oklch(0.66 0.16 300), oklch(0.78 0.14 200), oklch(0.80 0.13 165))", filter: "blur(1px)", animation: "af-spin 6s linear infinite", animationPlayState: ps }} />
        <div style={{ position: "absolute", inset: 0, borderRadius: "50%", mixBlendMode: "screen", opacity: 0.75, background: "conic-gradient(from 120deg, transparent, oklch(0.88 0.16 300) 25%, transparent 45%, oklch(0.86 0.15 165) 70%, transparent 90%)", filter: "blur(3px)", animation: "af-spinRev 9s linear infinite", animationPlayState: ps }} />
        <div style={{ position: "absolute", inset: -2, borderRadius: "50%", border: "2px solid oklch(0.82 0.14 240)", boxShadow: "0 0 16px oklch(0.80 0.14 260)", animation: "af-glow 2.6s ease-in-out infinite", animationPlayState: ps }} />
      </div>
    );
  }

  if (type === "beer") {
    const bubbles = [];
    for (let i = 0; i < 18; i++) {
      const left = (i * 41) % 100, dur = 1.7 + (i % 3) * 0.5, delay = (i * 0.17) % 1.7, sz = 4 + (i % 3) * 3;
      bubbles.push(
        <div key={i} style={{ position: "absolute", bottom: -6, left: left + "%", width: sz, height: sz, borderRadius: "50%", background: "rgba(255,252,238,0.95)", boxShadow: "0 0 3px rgba(255,250,225,.8)", animation: `af-rise ${dur.toFixed(1)}s ease-in ${delay.toFixed(2)}s infinite`, animationPlayState: ps }} />,
      );
    }
    const foamPts: [number, number, number][] = [
      [-72, 26, 68], [-54, 33, 71], [-38, 31, 75], [-22, 37, 73], [-6, 41, 74], [12, 40, 73], [30, 35, 75], [48, 32, 71], [66, 28, 68], [82, 23, 66], [-46, 22, 60], [-16, 27, 58], [16, 26, 59], [46, 22, 61],
    ];
    const foam = foamPts.map((p, i) =>
      orbit(
        <div style={{ width: "100%", height: "100%", borderRadius: "50%", background: "radial-gradient(circle at 40% 30%, #ffffff, #f3ebd6)", boxShadow: "inset 0 -3px 6px rgba(190,160,95,.5)", animation: `af-floaty ${(2 + (i % 3) * 0.4).toFixed(1)}s ease-in-out ${(i * 0.15).toFixed(1)}s infinite`, animationPlayState: ps }} />,
        p[0], p[2], p[1], i,
      ),
    );
    return (
      <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
        <div style={{ position: "absolute", inset: 0, borderRadius: "50%", overflow: "hidden", WebkitMaskImage: "radial-gradient(circle at center, transparent 51px, #000 52px)", maskImage: "radial-gradient(circle at center, transparent 51px, #000 52px)", background: "linear-gradient(to top, oklch(0.70 0.15 68), oklch(0.84 0.16 90))", boxShadow: "0 0 14px oklch(0.80 0.15 82)" }}>{bubbles}</div>
        <div style={{ position: "absolute", inset: 0, zIndex: 3 }}>{foam}</div>
      </div>
    );
  }

  if (type === "fire") {
    const flameClip = "polygon(50% 0%, 70% 28%, 78% 60%, 62% 90%, 50% 100%, 38% 90%, 22% 60%, 30% 28%)";
    const n = 17;
    const tongues = [];
    for (let i = 0; i < n; i++) {
      const a = i * (360 / n), hue = [42, 58, 24][i % 3], w = 15 + (i % 3) * 5, h = 26 + (i % 4) * 9;
      tongues.push(
        orbitR(
          <div style={{ width: "100%", height: "100%", clipPath: flameClip, background: `radial-gradient(ellipse at 50% 88%, oklch(0.96 0.11 ${hue}), oklch(0.74 0.2 ${hue - 12}) 52%, oklch(0.52 0.19 22) 100%)`, transformOrigin: "50% 100%", animation: `af-flame ${(0.55 + (i % 4) * 0.13).toFixed(2)}s ease-in-out ${(i * 0.06).toFixed(2)}s infinite`, animationPlayState: ps }} />,
          a, 63, w, h, i,
        ),
      );
    }
    return (
      <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
        <div style={{ position: "absolute", inset: 0, zIndex: 3 }}>{tongues}</div>
        <div style={{ position: "absolute", inset: 0, zIndex: 2, display: "grid", placeItems: "center" }}>
          <div style={{ position: "absolute", width: 112, height: 112, borderRadius: "50%", border: "3px solid oklch(0.70 0.20 40)", boxShadow: "0 0 14px oklch(0.68 0.20 38)", opacity: 0.9 }} />
          <div style={{ position: "absolute", width: 112, height: 112, borderRadius: "50%", border: "2px solid oklch(0.72 0.20 42)", animation: "af-pulseRing 1.8s ease-out infinite", animationPlayState: ps }} />
          <div style={{ position: "absolute", width: 112, height: 112, borderRadius: "50%", border: "2px solid oklch(0.72 0.20 42)", animation: "af-pulseRing 1.8s ease-out 0.9s infinite", animationPlayState: ps }} />
        </div>
      </div>
    );
  }

  if (type === "confetti") {
    const hues = [12, 62, 145, 215, 300, 42];
    const conf = [];
    for (let i = 0; i < 22; i++) {
      const left = (i * 37) % 100, dur = 2.4 + (i % 4) * 0.6, delay = (i * 0.19) % 2.4, sz = 5 + (i % 3) * 3, hue = hues[i % hues.length];
      conf.push(
        <div key={i} style={{ position: "absolute", top: -12, left: left + "%", width: sz, height: sz * 1.4, animation: `af-fall ${dur.toFixed(1)}s linear ${delay.toFixed(2)}s infinite`, animationPlayState: ps }}>
          <div style={{ width: "100%", height: "100%", background: `oklch(0.72 0.17 ${hue})`, borderRadius: "2px", animation: `af-spin ${(0.6 + (i % 3) * 0.3).toFixed(1)}s linear infinite`, animationPlayState: ps }} />
        </div>,
      );
    }
    return (
      <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
        <div style={{ position: "absolute", inset: 0, borderRadius: "50%", overflow: "hidden", zIndex: 3 }}>{conf}</div>
      </div>
    );
  }

  // pulse
  return (
    <div style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 2, display: "grid", placeItems: "center" }}>
      <div style={{ position: "absolute", width: 112, height: 112, borderRadius: "50%", border: `3px solid ${A}`, boxShadow: `0 0 14px ${A}`, opacity: 0.9 }} />
      <div style={{ position: "absolute", width: 112, height: 112, borderRadius: "50%", border: `2px solid ${A}`, animation: "af-pulseRing 2.4s ease-out infinite", animationPlayState: ps }} />
      <div style={{ position: "absolute", width: 112, height: 112, borderRadius: "50%", border: `2px solid ${A}`, animation: "af-pulseRing 2.4s ease-out 1.2s infinite", animationPlayState: ps }} />
    </div>
  );
}

export function AvatarFrame({ type, size = BASE, src, alt = "", paused = false, accent, fallback, className, style }: AvatarFrameProps) {
  useKeyframes();
  const scale = size / BASE;
  const A = accent ?? DEFAULT_ACCENT[type];

  return (
    <div className={className} style={{ position: "relative", width: BOX * scale, height: BOX * scale, ...style }}>
      <div style={{ position: "absolute", top: 0, left: 0, width: BOX, height: BOX, transform: `scale(${scale})`, transformOrigin: "top left" }}>
        {/* Foto */}
        <div style={{ position: "absolute", left: "50%", top: "50%", width: BASE, height: BASE, marginLeft: -BASE / 2, marginTop: -BASE / 2, zIndex: 1, borderRadius: "50%", overflow: "hidden", background: "repeating-linear-gradient(45deg,#e6ded5,#e6ded5 8px,#efe9e2 8px,#efe9e2 16px)", display: "grid", placeItems: "center" }}>
          {src ? (
            <img src={src} alt={alt} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          ) : (
            fallback ?? <span style={{ fontFamily: "monospace", fontSize: 10, letterSpacing: 1.5, color: "#b3a99e" }}>FOTO</span>
          )}
        </div>
        {/* Animierter Rahmen */}
        {deco(type, A, paused)}
      </div>
    </div>
  );
}

export default AvatarFrame;
