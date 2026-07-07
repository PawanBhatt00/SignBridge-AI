"use client";

import { useEffect, useRef } from "react";

interface Star {
  x: number; // normalized 0-1
  y: number;
  z: number; // depth: 0.2 (far) - 1 (near)
  r: number;
  twinklePhase: number;
  twinkleSpeed: number;
}

/**
 * Canvas-based starfield with mouse parallax.
 * Nearer stars (higher z) shift more on mouse move — that differential
 * is what reads as "depth" without needing a 3D library.
 */
export function Starfield({ density = 200 }: { density?: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mouseRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    let width = 0;
    let height = 0;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let stars: Star[] = [];
    let animationId: number;
    let time = 0;

    const resize = () => {
      const parent = canvas.parentElement;
      if (!parent) return;
      width = parent.clientWidth;
      height = parent.clientHeight;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      stars = Array.from({ length: density }, () => ({
        x: Math.random(),
        y: Math.random(),
        z: 0.2 + Math.random() * 0.8,
        r: Math.random() * 1.3 + 0.3,
        twinklePhase: Math.random() * Math.PI * 2,
        twinkleSpeed: 0.4 + Math.random() * 0.8,
      }));
    };

    const handleMouse = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouseRef.current = {
        x: (e.clientX - rect.left) / rect.width - 0.5,
        y: (e.clientY - rect.top) / rect.height - 0.5,
      };
    };

    const draw = () => {
      time += 0.016;
      ctx.clearRect(0, 0, width, height);

      for (const star of stars) {
        const parallaxX = mouseRef.current.x * star.z * 26;
        const parallaxY = mouseRef.current.y * star.z * 26;
        const px = star.x * width + parallaxX;
        const py = star.y * height + parallaxY;

        const twinkle = reduceMotion
          ? 0.8
          : 0.5 + 0.5 * Math.sin(time * star.twinkleSpeed + star.twinklePhase);
        const alpha = 0.25 + twinkle * 0.55 * star.z;

        ctx.beginPath();
        ctx.arc(px, py, star.r * star.z, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(224, 236, 255, ${alpha})`;
        ctx.fill();
      }

      if (!reduceMotion) {
        animationId = requestAnimationFrame(draw);
      }
    };

    resize();
    draw();

    window.addEventListener("resize", resize);
    window.addEventListener("mousemove", handleMouse);

    return () => {
      if (animationId) cancelAnimationFrame(animationId);
      window.removeEventListener("resize", resize);
      window.removeEventListener("mousemove", handleMouse);
    };
  }, [density]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-none"
      aria-hidden="true"
    />
  );
}

/**
 * Perspective grid that converges at the bottom of the hero,
 * fading into transparency — reads as a runway/horizon line.
 */
export function GridHorizon() {
  return (
    <div
      className="absolute inset-x-0 bottom-0 h-72 overflow-hidden pointer-events-none"
      style={{
        maskImage: "linear-gradient(to top, black, transparent)",
        WebkitMaskImage: "linear-gradient(to top, black, transparent)",
      }}
      aria-hidden="true"
    >
      <div
        className="absolute inset-0 origin-bottom"
        style={{ transform: "perspective(400px) rotateX(60deg)" }}
      >
        <div
          className="w-full h-full"
          style={{
            backgroundImage:
              "linear-gradient(to right, rgba(59,130,246,0.28) 1px, transparent 1px), linear-gradient(to bottom, rgba(59,130,246,0.28) 1px, transparent 1px)",
            backgroundSize: "56px 56px",
          }}
        />
      </div>
    </div>
  );
}

/**
 * Wraps children in a subtle 3D tilt that follows the cursor.
 * Use for hero content — small rotation, not a gimmick.
 */
export function TiltPanel({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  const handleMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = ref.current;
    if (!el) return;
    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (reduceMotion) return;

    const rect = el.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width - 0.5;
    const py = (e.clientY - rect.top) / rect.height - 0.5;
    el.style.transform = `perspective(1200px) rotateX(${py * -4}deg) rotateY(${px * 4}deg)`;
  };

  const handleLeave = () => {
    const el = ref.current;
    if (!el) return;
    el.style.transform = "perspective(1200px) rotateX(0deg) rotateY(0deg)";
  };

  return (
    <div
      ref={ref}
      onMouseMove={handleMove}
      onMouseLeave={handleLeave}
      className={className}
      style={{
        transition: "transform 0.25s ease-out",
        willChange: "transform",
      }}
    >
      {children}
    </div>
  );
}
