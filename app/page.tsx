'use client';

import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

type WordCard = { word: string; picture: string; tone: number };
type SurfaceKind = 'sand' | 'soil' | 'concrete' | 'wood';

const WORDS: WordCard[] = [
  { word: '물', picture: '💧', tone: 520 },
  { word: '밥', picture: '🍚', tone: 440 },
  { word: '신발', picture: '👟', tone: 390 },
  { word: '강아지', picture: '🐶', tone: 660 },
  { word: '야옹이', picture: '🐱', tone: 720 },
  { word: '오리', picture: '🦆', tone: 610 },
  { word: '먹어요', picture: '🥄😋', tone: 470 },
  { word: '마셔요', picture: '🥤😋', tone: 530 },
  { word: '또 줘요', picture: '🙌', tone: 580 },
  { word: '안녕', picture: '👋', tone: 640 },
  { word: '자요', picture: '😴', tone: 350 },
  { word: '안아', picture: '🤗', tone: 430 },
  { word: '나가요', picture: '🚶☀️', tone: 560 },
  { word: '배불러', picture: '😌', tone: 400 },
  { word: '아파요', picture: '🤕', tone: 330 },
  { word: '좋아요', picture: '👍', tone: 620 },
  { word: '무서워', picture: '😟', tone: 300 },
  { word: '슬퍼요', picture: '😢', tone: 360 },
  { word: '할머니', picture: '👵', tone: 500 },
  { word: '할아버지', picture: '👴', tone: 460 },
];

const BOX_STYLES = [
  ['#eea39a', '#fff0a8', '#f9c5bc'],
  ['#78b9aa', '#ffe0a3', '#9fd1c5'],
  ['#91a9d5', '#ffd3b2', '#b7c5e5'],
  ['#d6a8cb', '#fff2bd', '#e7c7df'],
  ['#e7b06d', '#d7f0df', '#f3cb95'],
];

const SURFACES: SurfaceKind[] = ['sand', 'soil', 'concrete', 'wood'];

function makePatternTexture(colors: string[], variant: number) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = colors[0];
  ctx.fillRect(0, 0, 256, 256);
  ctx.globalAlpha = 0.34;
  ctx.fillStyle = colors[2];
  if (variant % 3 === 0) {
    for (let y = 28; y < 256; y += 58) for (let x = 28; x < 256; x += 58) {
      ctx.beginPath(); ctx.arc(x + (y % 116 ? 18 : 0), y, 10, 0, Math.PI * 2); ctx.fill();
    }
  } else if (variant % 3 === 1) {
    ctx.lineWidth = 18;
    for (let x = -250; x < 500; x += 58) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + 256, 256); ctx.strokeStyle = colors[2]; ctx.stroke(); }
  } else {
    ctx.lineWidth = 9;
    for (let x = 0; x < 256; x += 52) { ctx.strokeStyle = colors[2]; ctx.strokeRect(x, 0, 26, 256); }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(1.4, 1.2);
  return texture;
}

function playTone(context: AudioContext, frequency: number, start: number, duration: number, volume = 0.055) {
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.type = 'sine';
  oscillator.frequency.setValueAtTime(frequency, start);
  oscillator.frequency.exponentialRampToValueAtTime(frequency * 1.06, start + duration);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(volume, start + 0.025);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  oscillator.connect(gain).connect(context.destination);
  oscillator.start(start); oscillator.stop(start + duration + 0.02);
}

export default function Home() {
  const mountRef = useRef<HTMLDivElement>(null);
  const [card, setCard] = useState<WordCard | null>(null);
  const [cardReady, setCardReady] = useState(false);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    const prefersLessMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#b8ddcf');
    scene.fog = new THREE.Fog('#b8ddcf', 10, 19);
    const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 100);
    camera.position.set(0, 3.5, 8.8);
    camera.lookAt(0, 0.65, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.domElement.setAttribute('aria-label', '선물 상자와 바닥을 만지는 놀이 화면');
    mount.appendChild(renderer.domElement);

    scene.add(new THREE.HemisphereLight('#fff9e7', '#688379', 2.7));
    const sun = new THREE.DirectionalLight('#fff1cf', 3.6);
    sun.position.set(-4.5, 7, 5.5);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.camera.left = sun.shadow.camera.bottom = -6;
    sun.shadow.camera.right = sun.shadow.camera.top = 6;
    scene.add(sun);
    const fill = new THREE.PointLight('#bfe9ff', 1.4, 15);
    fill.position.set(4, 2, 4);
    scene.add(fill);

    const world = new THREE.Group();
    const gift = new THREE.Group();
    const surfaceGroup = new THREE.Group();
    const traceGroup = new THREE.Group();
    const sparkleGroup = new THREE.Group();
    scene.add(world, sparkleGroup);
    world.add(surfaceGroup, traceGroup, gift);

    const glow = new THREE.Mesh(
      new THREE.SphereGeometry(1.2, 32, 24),
      new THREE.MeshBasicMaterial({ color: '#fff7c8', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }),
    );
    glow.position.y = 1.25;
    scene.add(glow);
    for (let i = 0; i < 16; i += 1) {
      const dot = new THREE.Mesh(
        new THREE.SphereGeometry(0.035 + (i % 4) * 0.012, 10, 8),
        new THREE.MeshBasicMaterial({ color: i % 2 ? '#fff1a8' : '#fff9e8', transparent: true, opacity: 0 }),
      );
      sparkleGroup.add(dot);
    }

    let floorMesh: THREE.Mesh | null = null;
    let lid: THREE.Mesh | null = null;
    let bow: THREE.Group | null = null;
    let audio: AudioContext | null = null;
    let surface: SurfaceKind = 'sand';
    let boxTouches = 0;
    let phase: 'box' | 'opening' | 'card' | 'ready' = 'box';
    let hitAt = -1000;
    let openingAt = -1000;
    let dragTarget = 0;
    let dragValue = 0;
    let cardTimer = 0;
    let readyTimer = 0;
    let previousWord = -1;
    let currentCard = WORDS[0];
    let pointerStart = new THREE.Vector2();
    let pointerLast = new THREE.Vector2();
    let pointerOnGift = false;
    let pointerMoved = false;
    let lastTraceAt = 0;

    const ensureAudio = () => {
      if (!audio) audio = new AudioContext();
      if (audio.state === 'suspended') void audio.resume();
      return audio;
    };
    const playTap = (count: number, swipe: boolean) => {
      const ctx = ensureAudio();
      const now = ctx.currentTime;
      playTone(ctx, swipe ? 205 : 245 + count * 34, now, 0.13, 0.05);
      playTone(ctx, swipe ? 138 : 150, now + 0.02, 0.09, 0.025);
    };
    const playOpen = () => {
      const ctx = ensureAudio(); const now = ctx.currentTime;
      [392, 523, 659, 784].forEach((frequency, index) => playTone(ctx, frequency, now + index * 0.105, 0.32, 0.048));
    };
    const playCard = (word: WordCard) => {
      const ctx = ensureAudio(); const now = ctx.currentTime;
      playTone(ctx, word.tone, now, 0.2, 0.05);
      playTone(ctx, word.tone * 1.25, now + 0.16, 0.28, 0.045);
    };

    const disposeChildren = (group: THREE.Group) => {
      group.traverse((object) => {
        if (!(object instanceof THREE.Mesh)) return;
        object.geometry.dispose();
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        materials.forEach((material) => { const mapped = material as THREE.MeshStandardMaterial; mapped.map?.dispose(); material.dispose(); });
      });
      group.clear();
    };

    const buildSurface = (kind: SurfaceKind) => {
      disposeChildren(surfaceGroup);
      traceGroup.clear();
      const settings = {
        sand: ['#d9bb83', '#b8ddcf', 1.0],
        soil: ['#9b8062', '#bad6b6', 0.92],
        concrete: ['#aeb4ae', '#c9d9d2', 1.0],
        wood: ['#c49266', '#c8d8cb', 0.72],
      }[kind] as [string, string, number];
      scene.background = new THREE.Color(settings[1]);
      if (scene.fog) scene.fog.color.set(settings[1]);
      floorMesh = new THREE.Mesh(
        new THREE.CylinderGeometry(6.5, 7, 0.7, 64),
        new THREE.MeshStandardMaterial({ color: settings[0], roughness: settings[2], metalness: 0 }),
      );
      floorMesh.position.y = -0.78;
      floorMesh.receiveShadow = true;
      floorMesh.userData.isFloor = true;
      surfaceGroup.add(floorMesh);

      if (kind === 'sand') {
        for (let i = 0; i < 26; i += 1) {
          const grain = new THREE.Mesh(new THREE.SphereGeometry(0.025 + Math.random() * 0.035, 8, 6), new THREE.MeshStandardMaterial({ color: i % 2 ? '#ead09f' : '#cda971', roughness: 1 }));
          const angle = Math.random() * Math.PI * 2, radius = 1.9 + Math.random() * 3.8;
          grain.position.set(Math.cos(angle) * radius, -0.4, Math.sin(angle) * radius);
          surfaceGroup.add(grain);
        }
      }
      if (kind === 'soil') {
        for (let i = 0; i < 7; i += 1) {
          const plant = new THREE.Group(); plant.userData.plant = true;
          const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.04, 0.62, 8), new THREE.MeshStandardMaterial({ color: '#668c62', roughness: 0.8 }));
          stem.position.y = 0.3; plant.add(stem);
          [-1, 1].forEach((side) => {
            const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.14, 12, 8), new THREE.MeshStandardMaterial({ color: side > 0 ? '#81a978' : '#739b6d', roughness: 0.85 }));
            leaf.scale.set(1.5, 0.45, 0.8); leaf.position.set(side * 0.12, 0.36 + side * 0.07, 0); leaf.rotation.z = side * 0.45; plant.add(leaf);
          });
          const angle = (i / 7) * Math.PI * 2 + 0.35, radius = 3.2 + (i % 2) * 0.7;
          plant.position.set(Math.cos(angle) * radius, -0.4, Math.sin(angle) * radius);
          surfaceGroup.add(plant);
        }
      }
      if (kind === 'concrete') {
        for (let i = 0; i < 34; i += 1) {
          const pebble = new THREE.Mesh(new THREE.DodecahedronGeometry(0.035 + Math.random() * 0.045, 0), new THREE.MeshStandardMaterial({ color: i % 2 ? '#c5c9c3' : '#929b96', roughness: 1 }));
          const angle = Math.random() * Math.PI * 2, radius = 1.9 + Math.random() * 3.8;
          pebble.position.set(Math.cos(angle) * radius, -0.39, Math.sin(angle) * radius); pebble.scale.y = 0.35; surfaceGroup.add(pebble);
        }
      }
      if (kind === 'wood') {
        for (let i = -5; i <= 5; i += 1) {
          const seam = new THREE.Mesh(new THREE.BoxGeometry(0.027, 0.008, 10), new THREE.MeshStandardMaterial({ color: '#8f684c', roughness: 1 }));
          seam.position.set(i * 1.08, -0.415, 0); surfaceGroup.add(seam);
          if (i % 2 === 0) {
            const grain = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.018, 6, 30), new THREE.MeshStandardMaterial({ color: '#a87550', roughness: 1 }));
            grain.rotation.x = -Math.PI / 2; grain.scale.y = 0.42; grain.position.set(i * 1.08 + 0.32, -0.402, 1.5 - (i % 3)); surfaceGroup.add(grain);
          }
        }
      }
    };

    const buildGift = () => {
      disposeChildren(gift);
      const styleIndex = Math.floor(Math.random() * BOX_STYLES.length);
      const colors = BOX_STYLES[styleIndex];
      const texture = makePatternTexture(colors, Math.floor(Math.random() * 3));
      const boxMat = new THREE.MeshStandardMaterial({ color: '#ffffff', map: texture, roughness: 0.48 });
      const lidMat = new THREE.MeshStandardMaterial({ color: colors[0], roughness: 0.44 });
      const ribbonMat = new THREE.MeshStandardMaterial({ color: colors[1], roughness: 0.42 });
      const base = new THREE.Mesh(new RoundedBoxGeometry(2.76, 2.0, 2.22, 5, 0.18), boxMat);
      base.position.set(0, 0.56, 0); base.castShadow = true; base.receiveShadow = true; base.userData.isGift = true; gift.add(base);
      lid = new THREE.Mesh(new THREE.BoxGeometry(3.06, 0.48, 2.54, 5, 2, 4), lidMat);
      lid.position.y = 1.74; lid.castShadow = true; lid.userData.isGift = true; gift.add(lid);
      const vertical = new THREE.Mesh(new THREE.BoxGeometry(0.5, 2.28, 2.38), ribbonMat);
      vertical.position.y = 0.62; vertical.castShadow = true; vertical.userData.isGift = true; gift.add(vertical);
      const topRibbon = new THREE.Mesh(new THREE.BoxGeometry(3.16, 0.23, 2.63), ribbonMat);
      topRibbon.position.y = 1.74; topRibbon.userData.isGift = true; gift.add(topRibbon);

      bow = new THREE.Group(); bow.userData.isGift = true;
      const knot = new THREE.Mesh(new THREE.SphereGeometry(0.24, 22, 16), ribbonMat); knot.userData.isGift = true; bow.add(knot);
      [-1, 1].forEach((side) => {
        const loop = new THREE.Mesh(new THREE.TorusGeometry(0.37, 0.12, 12, 30), ribbonMat);
        loop.scale.set(1.16, 0.78, 1); loop.position.x = side * 0.36; loop.rotation.z = side * 0.55; loop.userData.isGift = true; bow!.add(loop);
        const tail = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.72, 0.1), ribbonMat);
        tail.position.set(side * 0.25, -0.32, 0); tail.rotation.z = side * 0.28; tail.userData.isGift = true; bow!.add(tail);
      });
      bow.position.set(0, 2.18, 0); bow.rotation.x = -0.2; gift.add(bow);
    };

    const nextRound = () => {
      window.clearTimeout(cardTimer); window.clearTimeout(readyTimer);
      setCard(null); setCardReady(false); phase = 'box'; boxTouches = 0; dragTarget = dragValue = 0;
      surface = SURFACES[Math.floor(Math.random() * SURFACES.length)];
      buildSurface(surface); buildGift();
      gift.visible = true; gift.position.set(0, 0, 0); gift.rotation.set(0, 0, 0); gift.scale.setScalar(0.4);
      glow.material.opacity = 0; sparkleGroup.children.forEach((child) => ((child as THREE.Mesh).material as THREE.MeshBasicMaterial).opacity = 0);
      const nextIndex = (previousWord + 1 + Math.floor(Math.random() * (WORDS.length - 1))) % WORDS.length;
      previousWord = nextIndex; currentCard = WORDS[nextIndex];
      hitAt = performance.now();
    };

    const openGift = () => {
      phase = 'opening'; openingAt = performance.now(); playOpen();
      cardTimer = window.setTimeout(() => {
        phase = 'card'; setCard(currentCard); playCard(currentCard);
        readyTimer = window.setTimeout(() => { phase = 'ready'; setCardReady(true); }, 5000);
      }, prefersLessMotion ? 250 : 1050);
    };

    const reactGift = (swipe: boolean, amount = 0) => {
      if (phase !== 'box') return;
      boxTouches += 1; hitAt = performance.now(); playTap(boxTouches, swipe);
      dragTarget = THREE.MathUtils.clamp(amount, -1.0, 1.0) * (surface === 'concrete' ? 0.18 : 0.52);
      if (boxTouches >= 3) openGift();
    };

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    const updatePointer = (event: PointerEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.set(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1);
      raycaster.setFromCamera(pointer, camera);
    };
    const giftHit = () => raycaster.intersectObjects(gift.children, true).some((hit) => {
      let object: THREE.Object3D | null = hit.object;
      while (object) { if (object.userData.isGift) return true; object = object.parent; }
      return false;
    });
    const addSandTrace = () => {
      if (!floorMesh || performance.now() - lastTraceAt < 45) return;
      const hit = raycaster.intersectObject(floorMesh)[0]; if (!hit) return;
      lastTraceAt = performance.now();
      const mark = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.018, 8, 24), new THREE.MeshStandardMaterial({ color: '#b9935d', transparent: true, opacity: 0.55, roughness: 1 }));
      mark.rotation.x = -Math.PI / 2; mark.position.copy(hit.point); mark.position.y = -0.395; mark.scale.x = 1.5; mark.userData.born = performance.now(); traceGroup.add(mark);
      if (traceGroup.children.length > 38) { const old = traceGroup.children[0] as THREE.Mesh; old.geometry.dispose(); (old.material as THREE.Material).dispose(); traceGroup.remove(old); }
    };
    const brushPlants = () => {
      surfaceGroup.children.forEach((child) => { if (child.userData.plant) child.userData.brushed = performance.now(); });
    };
    const onPointerDown = (event: PointerEvent) => {
      renderer.domElement.setPointerCapture(event.pointerId); updatePointer(event);
      pointerStart.set(event.clientX, event.clientY); pointerLast.copy(pointerStart); pointerMoved = false;
      if (phase === 'ready') { nextRound(); return; }
      if (phase !== 'box') return;
      pointerOnGift = giftHit();
      if (!pointerOnGift && surface === 'sand') addSandTrace();
      if (!pointerOnGift && surface === 'soil') brushPlants();
    };
    const onPointerMove = (event: PointerEvent) => {
      if (phase !== 'box') return; updatePointer(event);
      const dx = event.clientX - pointerStart.x, dy = event.clientY - pointerStart.y;
      if (Math.hypot(dx, dy) > 12) pointerMoved = true;
      if (pointerOnGift) dragTarget = THREE.MathUtils.clamp(dx / 160, -1, 1) * (surface === 'concrete' ? 0.2 : 0.64);
      else if (surface === 'sand') addSandTrace();
      else if (surface === 'soil') brushPlants();
      pointerLast.set(event.clientX, event.clientY);
    };
    const onPointerUp = (event: PointerEvent) => {
      if (phase !== 'box') return;
      const dx = event.clientX - pointerStart.x;
      if (pointerOnGift) reactGift(pointerMoved, dx / 140);
      pointerOnGift = false; dragTarget = 0;
    };
    renderer.domElement.addEventListener('pointerdown', onPointerDown);
    renderer.domElement.addEventListener('pointermove', onPointerMove);
    renderer.domElement.addEventListener('pointerup', onPointerUp);
    renderer.domElement.addEventListener('pointercancel', onPointerUp);

    const resize = () => {
      const { clientWidth, clientHeight } = mount;
      camera.aspect = clientWidth / Math.max(clientHeight, 1);
      camera.fov = clientWidth < clientHeight ? 43 : 34;
      camera.updateProjectionMatrix(); renderer.setSize(clientWidth, clientHeight, false);
    };
    const observer = new ResizeObserver(resize); observer.observe(mount); resize(); nextRound();

    let lastAnimationTime = performance.now();
    let frame = 0;
    const animate = (time: number) => {
      const dt = Math.min((time - lastAnimationTime) / 1000, 0.034);
      lastAnimationTime = time;
      const hitProgress = Math.max(0, 1 - (time - hitAt) / (prefersLessMotion ? 180 : 540));
      dragValue = THREE.MathUtils.damp(dragValue, dragTarget, surface === 'concrete' ? 5 : 9, dt);
      if (phase === 'box') {
        const settleScale = 1 - hitProgress;
        gift.scale.setScalar(0.4 + 0.6 * (1 - Math.pow(1 - Math.min(1, settleScale * 2.2), 3)));
        const wobble = Math.sin(hitProgress * Math.PI * 4.5) * 0.095 * hitProgress;
        gift.rotation.z = wobble + dragValue * 0.08;
        gift.scale.y *= 1 - Math.sin(hitProgress * Math.PI) * 0.075;
        gift.position.x = dragValue;
        gift.position.y = Math.sin(time * 0.0022) * (prefersLessMotion ? 0.004 : 0.018) + Math.sin(hitProgress * Math.PI) * 0.13;
        if (lid) { lid.position.y = 1.74 + Math.sin(hitProgress * Math.PI) * 0.09; lid.rotation.z = wobble * -0.22; }
        if (bow) bow.rotation.y = Math.sin(time * 0.0019) * (prefersLessMotion ? 0.015 : 0.09);
      } else {
        const p = Math.min(1, Math.max(0, (time - openingAt) / (prefersLessMotion ? 300 : 1150)));
        const ease = 1 - Math.pow(1 - p, 3);
        gift.scale.setScalar(1 + Math.sin(Math.min(p * 1.3, 1) * Math.PI) * 0.16);
        gift.rotation.z = Math.sin(p * Math.PI * 4) * (1 - p) * 0.06;
        if (lid) { lid.position.y = 1.74 + ease * 2.0; lid.rotation.x = -ease * 0.9; lid.rotation.z = ease * 0.18; }
        if (bow && lid) { bow.position.y = 2.18 + ease * 2.0; bow.rotation.x = -0.2 - ease * 0.9; bow.rotation.z = ease * 0.18; }
        glow.material.opacity = Math.sin(Math.min(p, 0.92) * Math.PI) * 0.44;
        glow.scale.setScalar(0.5 + ease * 2.35);
        sparkleGroup.children.forEach((child, index) => {
          const angle = (index / sparkleGroup.children.length) * Math.PI * 2 + p * 1.8;
          const radius = 0.45 + ease * (1.6 + (index % 4) * 0.22);
          child.position.set(Math.cos(angle) * radius, 1.2 + Math.sin(angle * 1.7) * radius * 0.54 + ease * 0.5, Math.sin(angle) * 0.45);
          ((child as THREE.Mesh).material as THREE.MeshBasicMaterial).opacity = Math.sin(p * Math.PI) * 0.9;
        });
      }
      surfaceGroup.children.forEach((child, index) => {
        if (!child.userData.plant) return;
        const brush = Math.max(0, 1 - (time - (child.userData.brushed || -1000)) / 900);
        child.rotation.z = Math.sin(time * 0.002 + index) * 0.035 + Math.sin(brush * Math.PI * 3) * brush * 0.35;
      });
      traceGroup.children.forEach((child) => {
        const age = (time - child.userData.born) / 9000;
        ((child as THREE.Mesh).material as THREE.MeshStandardMaterial).opacity = Math.max(0.08, 0.55 * (1 - age));
      });
      renderer.render(scene, camera); frame = requestAnimationFrame(animate);
    };
    frame = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(frame); window.clearTimeout(cardTimer); window.clearTimeout(readyTimer); observer.disconnect();
      renderer.domElement.removeEventListener('pointerdown', onPointerDown); renderer.domElement.removeEventListener('pointermove', onPointerMove);
      renderer.domElement.removeEventListener('pointerup', onPointerUp); renderer.domElement.removeEventListener('pointercancel', onPointerUp);
      disposeChildren(gift); disposeChildren(surfaceGroup); disposeChildren(traceGroup); disposeChildren(sparkleGroup);
      glow.geometry.dispose(); glow.material.dispose(); renderer.dispose(); void audio?.close(); mount.removeChild(renderer.domElement);
    };
  }, []);

  return (
    <main className="game-shell">
      <div ref={mountRef} className="game-canvas" />
      {card && (
        <section className={`word-card-wrap ${cardReady ? 'is-ready' : ''}`} aria-live="polite">
          <div className="word-card" role="img" aria-label={card.word}>
            <div className="paper-tape" aria-hidden="true" />
            <div className="word-picture" aria-hidden="true">{card.picture}</div>
            <div className="word-label">{card.word}</div>
            <span className="card-shine" aria-hidden="true" />
          </div>
        </section>
      )}
    </main>
  );
}
