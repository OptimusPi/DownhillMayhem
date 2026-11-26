import React, { useEffect, useState } from "react";
import type { KolmoInputState } from "@pinkaphant/kolmo";

export function detectTouchDevice(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia?.("(pointer: coarse)")?.matches || "ontouchstart" in window;
}

export interface MobileTouchOverlayProps {
  readonly enabled?: boolean;
  readonly onInputChange: (next: Partial<KolmoInputState>) => void;
  readonly onFire: () => void;
}

export function MobileTouchOverlay({
  enabled,
  onInputChange,
  onFire,
}: MobileTouchOverlayProps): React.JSX.Element | null {
  const [isTouch, setIsTouch] = useState(false);
  const [state, setState] = useState<Partial<KolmoInputState>>({});

  useEffect(() => {
    setIsTouch(enabled ?? detectTouchDevice());
  }, [enabled]);

  if (!isTouch) return null;

  const setKey = (key: keyof KolmoInputState, down: boolean) => {
    const next = { ...state, [key]: down };
    setState(next);
    onInputChange(next);
  };

  const btnStyle = (active?: boolean): React.CSSProperties => ({
    width: 56,
    height: 56,
    borderRadius: 12,
    border: "2px solid rgba(255,255,255,0.35)",
    background: active ? "rgba(250,204,21,0.45)" : "rgba(15,23,42,0.7)",
    color: "#f8fafc",
    fontWeight: 800,
    fontSize: 13,
    touchAction: "none",
    userSelect: "none",
  });

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
        zIndex: 25,
        display: "flex",
        justifyContent: "space-between",
        alignItems: "flex-end",
        padding: "16px",
      }}
    >
      <div style={{ display: "flex", gap: 10, pointerEvents: "auto" }}>
        <button
          style={btnStyle(state.left)}
          onPointerDown={() => setKey("left", true)}
          onPointerUp={() => setKey("left", false)}
          onPointerCancel={() => setKey("left", false)}
        >
          ◀
        </button>
        <button
          style={btnStyle(state.right)}
          onPointerDown={() => setKey("right", true)}
          onPointerUp={() => setKey("right", false)}
          onPointerCancel={() => setKey("right", false)}
        >
          ▶
        </button>
      </div>

      <div style={{ display: "flex", gap: 10, pointerEvents: "auto" }}>
        <button
          style={{ ...btnStyle(false), background: "rgba(239,68,68,0.8)", width: 68 }}
          onPointerDown={(e) => {
            e.preventDefault();
            onFire();
          }}
        >
          FIRE
        </button>
        <button
          style={{ ...btnStyle(state.boost), background: "rgba(6,182,212,0.75)", width: 68 }}
          onPointerDown={() => setKey("boost", true)}
          onPointerUp={() => setKey("boost", false)}
          onPointerCancel={() => setKey("boost", false)}
        >
          BOOST
        </button>
        <button
          style={{ ...btnStyle(state.forward), background: "rgba(34,197,94,0.75)", width: 68 }}
          onPointerDown={() => setKey("forward", true)}
          onPointerUp={() => setKey("forward", false)}
          onPointerCancel={() => setKey("forward", false)}
        >
          GAS
        </button>
      </div>
    </div>
  );
}
