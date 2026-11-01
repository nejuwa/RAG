"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";

export function StarfieldBackground() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        alpha: true,
        antialias: true,
        powerPreference: "low-power",
      });
    } catch (error) {
      console.error("Could not initialize the home page starfield.", error);
      return;
    }

    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    renderer.setSize(window.innerWidth, window.innerHeight);
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(
      45,
      window.innerWidth / window.innerHeight,
      0.1,
      100,
    );
    camera.position.z = 24;

    const starCount = window.innerWidth < 640 ? 130 : 230;
    const positions = new Float32Array(starCount * 3);
    const colors = new Float32Array(starCount * 3);
    const phases = new Float32Array(starCount);
    const sizes = new Float32Array(starCount);
    const palette = [0x315e3e, 0x3f7650, 0x568b62, 0x709d78].map(
      (color) => new THREE.Color(color),
    );
    const aspect = window.innerWidth / window.innerHeight;
    const fieldHeight = 24;
    const fieldWidth = fieldHeight * aspect;

    for (let index = 0; index < starCount; index += 1) {
      const offset = index * 3;
      positions[offset] = (Math.random() - 0.5) * fieldWidth;
      positions[offset + 1] = (Math.random() - 0.5) * fieldHeight;
      positions[offset + 2] = (Math.random() - 0.5) * 7;
      palette[Math.floor(Math.random() * palette.length)].toArray(colors, offset);
      phases[index] = Math.random() * Math.PI * 2;
      sizes[index] = Math.random();
    }
    const basePositions = Float32Array.from(positions);

    const connectionIndices: number[] = [];
    const maxConnections = window.innerWidth < 640 ? 260 : 620;
    const maxConnectionDistance = 3.6;
    for (let first = 0; first < starCount && connectionIndices.length < maxConnections * 2; first += 1) {
      for (let second = first + 1; second < starCount && connectionIndices.length < maxConnections * 2; second += 1) {
        const x = basePositions[first * 3] - basePositions[second * 3];
        const y = basePositions[first * 3 + 1] - basePositions[second * 3 + 1];
        const z = basePositions[first * 3 + 2] - basePositions[second * 3 + 2];
        if (x * x + y * y + z * z <= maxConnectionDistance * maxConnectionDistance) {
          connectionIndices.push(first, second);
        }
      }
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));

    const linePositions = new Float32Array(connectionIndices.length * 3);
    const lineGeometry = new THREE.BufferGeometry();
    lineGeometry.setAttribute("position", new THREE.BufferAttribute(linePositions, 3));
    const lineMaterial = new THREE.LineBasicMaterial({
      color: 0x426d4c,
      transparent: true,
      opacity: 0.42,
      depthWrite: false,
    });
    const connections = new THREE.LineSegments(lineGeometry, lineMaterial);
    scene.add(connections);

    const sprite = document.createElement("canvas");
    sprite.width = 64;
    sprite.height = 64;
    const context = sprite.getContext("2d");
    let texture: THREE.CanvasTexture | undefined;
    if (context) {
      const glow = context.createRadialGradient(32, 32, 0, 32, 32, 32);
      glow.addColorStop(0, "rgba(255,255,255,1)");
      glow.addColorStop(0.1, "rgba(255,255,255,0.86)");
      glow.addColorStop(0.35, "rgba(255,255,255,0.25)");
      glow.addColorStop(1, "rgba(255,255,255,0)");
      context.fillStyle = glow;
      context.fillRect(0, 0, 64, 64);
      texture = new THREE.CanvasTexture(sprite);
    }

    const material = new THREE.PointsMaterial({
      color: 0xffffff,
      size: 0.55,
      map: texture,
      transparent: true,
      opacity: 1,
      vertexColors: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      sizeAttenuation: true,
    });
    const stars = new THREE.Points(geometry, material);
    scene.add(stars);

    const pointer = new THREE.Vector2();
    const targetCamera = new THREE.Vector2();
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let frameId = 0;
    let previousFrame = 0;
    let elapsed = 0;

    function resize() {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
      renderer.setSize(window.innerWidth, window.innerHeight);
      renderer.render(scene, camera);
    }

    function movePointer(event: PointerEvent) {
      pointer.set(
        (event.clientX / window.innerWidth) * 2 - 1,
        1 - (event.clientY / window.innerHeight) * 2,
      );
      targetCamera.set(pointer.x * 2.4, pointer.y * 1.6);
      if (reducedMotion.matches) scheduleFrame();
    }

    function renderFrame(timestamp: number) {
      frameId = 0;
      const delta = previousFrame === 0 ? 0 : Math.min(timestamp - previousFrame, 50);
      previousFrame = timestamp;
      if (!reducedMotion.matches) elapsed += delta * 0.001;

      const positionAttribute = geometry.attributes.position;
      for (let index = 0; index < starCount; index += 1) {
        const offset = index * 3;
        const phase = phases[index];
        const depth = 0.45 + sizes[index] * 1.1;
        positionAttribute.array[offset + 1] =
          basePositions[offset + 1] +
          pointer.y * depth * 0.42 +
          Math.sin(elapsed * (0.7 + sizes[index] * 0.65) + phase) * 0.48;
        positionAttribute.array[offset] =
          basePositions[offset] + pointer.x * depth * 0.58;
        positionAttribute.array[offset + 2] =
          basePositions[offset + 2] + Math.sin(elapsed * 1.8 + phase) * 0.8;
      }
      positionAttribute.needsUpdate = true;
      const currentStarPositions = positionAttribute.array;
      const currentLinePositions = lineGeometry.attributes.position.array;
      for (let index = 0; index < connectionIndices.length; index += 1) {
        const starOffset = connectionIndices[index] * 3;
        const lineOffset = index * 3;
        currentLinePositions[lineOffset] = currentStarPositions[starOffset];
        currentLinePositions[lineOffset + 1] = currentStarPositions[starOffset + 1];
        currentLinePositions[lineOffset + 2] = currentStarPositions[starOffset + 2];
      }
      lineGeometry.attributes.position.needsUpdate = true;
      camera.position.x += (targetCamera.x - camera.position.x) * 0.075;
      camera.position.y += (targetCamera.y - camera.position.y) * 0.075;
      camera.lookAt(0, 0, 0);
      renderer.render(scene, camera);

      if (!reducedMotion.matches) frameId = window.requestAnimationFrame(renderFrame);
    }

    function scheduleFrame() {
      if (!frameId) frameId = window.requestAnimationFrame(renderFrame);
    }

    function handleMotionPreference() {
      previousFrame = 0;
      if (reducedMotion.matches) {
        if (frameId) window.cancelAnimationFrame(frameId);
        frameId = 0;
        renderer.render(scene, camera);
      } else {
        scheduleFrame();
      }
    }

    window.addEventListener("resize", resize);
    window.addEventListener("pointermove", movePointer, { passive: true });
    reducedMotion.addEventListener("change", handleMotionPreference);
    scheduleFrame();

    return () => {
      if (frameId) window.cancelAnimationFrame(frameId);
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", movePointer);
      reducedMotion.removeEventListener("change", handleMotionPreference);
      geometry.dispose();
      lineGeometry.dispose();
      lineMaterial.dispose();
      material.dispose();
      texture?.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, []);

  return (
    <div
      ref={containerRef}
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden bg-surface"
    >
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_45%,color-mix(in_srgb,var(--color-accent)_12%,transparent),transparent_72%)]" />
    </div>
  );
}
