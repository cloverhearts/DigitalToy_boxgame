'use client';

import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';

type WordCard = { word: string; picture: string; tone: number; image?: string };

const publicAsset = (path: string) => `${import.meta.env.BASE_URL}${path.replace(/^\//, '')}`;

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
  { word: '나가요', picture: '🚶☀️', tone: 560, image: publicAsset('images/playground-landscape-14612374.jpg') },
  { word: '배불러', picture: '😌', tone: 400 },
  { word: '아파요', picture: '🤕', tone: 330 },
  { word: '좋아요', picture: '👍', tone: 620 },
  { word: '무서워', picture: '😟', tone: 300 },
  { word: '슬퍼요', picture: '😢', tone: 360 },
  { word: '할머니', picture: '👵', tone: 500 },
  { word: '할아버지', picture: '👴', tone: 460 },
];

const BOX_STYLES = [
  ['#df7991', '#f6cddd', '#f0a5b6'],
  ['#5ba997', '#f3cf79', '#94c8bc'],
  ['#718fc8', '#f1b78f', '#a9bce0'],
  ['#b77dad', '#f1d483', '#d9b1d1'],
  ['#d49452', '#b9dfce', '#e9b879'],
];

const TAP_SAMPLE_URL = publicAsset('sounds/gift-tap-layered.wav');
const OPEN_SAMPLE_URL = publicAsset('sounds/gift-open-layered.wav');

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

function makeRadialTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 256;
  const context = canvas.getContext('2d')!;
  const gradient = context.createRadialGradient(128, 128, 6, 128, 128, 126);
  gradient.addColorStop(0, 'rgba(255,255,238,1)');
  gradient.addColorStop(0.24, 'rgba(255,241,170,.9)');
  gradient.addColorStop(0.58, 'rgba(255,217,125,.3)');
  gradient.addColorStop(1, 'rgba(255,210,110,0)');
  context.fillStyle = gradient;
  context.fillRect(0, 0, 256, 256);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function makeRibbonLoop(side: number, material: THREE.Material) {
  const path = new THREE.CatmullRomCurve3([
    new THREE.Vector3(side * 0.09, 0.02, 0),
    new THREE.Vector3(side * 0.38, 0.3, 0.01),
    new THREE.Vector3(side * 0.82, 0.52, -0.02),
    new THREE.Vector3(side * 0.95, 0.16, -0.03),
    new THREE.Vector3(side * 0.61, -0.06, 0),
    new THREE.Vector3(side * 0.18, 0.01, 0.02),
  ], false, 'catmullrom', 0.42);
  const geometry = new THREE.TubeGeometry(path, 48, 0.14, 10, false);
  const loop = new THREE.Mesh(geometry, material);
  loop.scale.z = 0.62;
  return loop;
}

function makeRibbonTail(side: number, material: THREE.Material) {
  const shape = new THREE.Shape();
  shape.moveTo(-0.17, 0.42);
  shape.quadraticCurveTo(-0.2, 0, -0.11, -0.47);
  shape.lineTo(0, -0.34);
  shape.lineTo(0.12, -0.47);
  shape.quadraticCurveTo(0.21, 0, 0.17, 0.42);
  shape.closePath();
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: 0.09,
    bevelEnabled: true,
    bevelSize: 0.025,
    bevelThickness: 0.025,
    bevelSegments: 3,
  });
  const tail = new THREE.Mesh(geometry, material);
  tail.position.set(side * 0.23, -0.34, -0.02);
  tail.rotation.z = side * 0.3;
  return tail;
}

type TapPose = {
  scaleX: number;
  scaleY: number;
  lift: number;
  tilt: number;
  lidLift: number;
  shadow: number;
};

const TAP_POSES: Array<TapPose & { at: number }> = [
  { at: 0, scaleX: 1, scaleY: 1, lift: 0, tilt: 0, lidLift: 0, shadow: 1 },
  { at: 0.16, scaleX: 1.055, scaleY: 0.89, lift: -0.055, tilt: 0.012, lidLift: 0, shadow: 1.09 },
  { at: 0.38, scaleX: 0.975, scaleY: 1.075, lift: 0.095, tilt: -0.026, lidLift: 0.13, shadow: 0.94 },
  { at: 0.61, scaleX: 1.018, scaleY: 0.985, lift: 0.018, tilt: 0.012, lidLift: 0.035, shadow: 1.025 },
  { at: 0.82, scaleX: 0.994, scaleY: 1.008, lift: 0, tilt: -0.005, lidLift: 0, shadow: 0.995 },
  { at: 1, scaleX: 1, scaleY: 1, lift: 0, tilt: 0, lidLift: 0, shadow: 1 },
];

function sampleTapPose(progress: number): TapPose {
  const p = THREE.MathUtils.clamp(progress, 0, 1);
  const upperIndex = Math.min(TAP_POSES.length - 1, TAP_POSES.findIndex((pose) => pose.at >= p));
  const lowerIndex = Math.max(0, upperIndex - 1);
  const lower = TAP_POSES[lowerIndex];
  const upper = TAP_POSES[upperIndex];
  const span = Math.max(upper.at - lower.at, 0.0001);
  const raw = (p - lower.at) / span;
  const eased = raw * raw * (3 - 2 * raw);
  return {
    scaleX: THREE.MathUtils.lerp(lower.scaleX, upper.scaleX, eased),
    scaleY: THREE.MathUtils.lerp(lower.scaleY, upper.scaleY, eased),
    lift: THREE.MathUtils.lerp(lower.lift, upper.lift, eased),
    tilt: THREE.MathUtils.lerp(lower.tilt, upper.tilt, eased),
    lidLift: THREE.MathUtils.lerp(lower.lidLift, upper.lidLift, eased),
    shadow: THREE.MathUtils.lerp(lower.shadow, upper.shadow, eased),
  };
}

function playTone(
  context: AudioContext,
  destination: AudioNode,
  frequency: number,
  start: number,
  duration: number,
  volume = 0.055,
  type: OscillatorType = 'sine',
  endFrequency = frequency * 1.03,
  attackTime = Math.min(0.018, duration * 0.24),
) {
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, start);
  oscillator.frequency.exponentialRampToValueAtTime(Math.max(endFrequency, 20), start + duration);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(volume, start + Math.min(attackTime, duration * 0.45));
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  oscillator.connect(gain).connect(destination);
  oscillator.start(start); oscillator.stop(start + duration + 0.02);
}

function playBell(context: AudioContext, destination: AudioNode, frequency: number, start: number, duration: number, volume = 0.03) {
  playTone(context, destination, frequency, start, duration, volume, 'sine', frequency * 1.012);
  playTone(context, destination, frequency * 2.01, start + 0.003, duration * 0.62, volume * 0.22, 'sine', frequency * 2.025);
  playTone(context, destination, frequency * 3.98, start + 0.006, duration * 0.38, volume * 0.08, 'sine', frequency * 4.01);
}

function playNoiseSweep(
  context: AudioContext,
  destination: AudioNode,
  start: number,
  duration: number,
  startFrequency: number,
  endFrequency: number,
  volume: number,
  attackFraction = 0.34,
) {
  const sampleCount = Math.max(1, Math.floor(context.sampleRate * duration));
  const buffer = context.createBuffer(1, sampleCount, context.sampleRate);
  const channel = buffer.getChannelData(0);
  for (let index = 0; index < sampleCount; index += 1) channel[index] = Math.random() * 2 - 1;
  const source = context.createBufferSource();
  const filter = context.createBiquadFilter();
  const gain = context.createGain();
  source.buffer = buffer;
  filter.type = 'bandpass';
  filter.Q.value = 0.8;
  filter.frequency.setValueAtTime(startFrequency, start);
  filter.frequency.exponentialRampToValueAtTime(endFrequency, start + duration);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(volume, start + duration * attackFraction);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  source.connect(filter).connect(gain).connect(destination);
  source.start(start); source.stop(start + duration + 0.02);
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
    const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 100);
    const cameraHome = new THREE.Vector3(0, 3.45, 8.9);
    camera.position.copy(cameraHome);
    camera.lookAt(0, 0.65, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    const renderPixelRatio = Math.min(window.devicePixelRatio, 1.75);
    renderer.setPixelRatio(renderPixelRatio);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.VSMShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.88;
    renderer.domElement.setAttribute('aria-label', '선물 상자를 터치해 여는 놀이 화면');
    mount.appendChild(renderer.domElement);

    const environmentGenerator = new THREE.PMREMGenerator(renderer);
    const roomEnvironment = new RoomEnvironment();
    const environmentMap = environmentGenerator.fromScene(roomEnvironment, 0.04).texture;
    scene.environment = environmentMap;
    environmentGenerator.dispose();
    roomEnvironment.dispose();

    const composer = new EffectComposer(renderer);
    composer.setPixelRatio(renderPixelRatio);
    composer.addPass(new RenderPass(scene, camera));
    const bloomPass = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.06, 0.46, 1.04);
    composer.addPass(bloomPass);
    composer.addPass(new OutputPass());

    scene.add(new THREE.HemisphereLight('#fff9ed', '#61766f', 0.9));
    const sun = new THREE.DirectionalLight('#fff0d5', 2.35);
    sun.position.set(-4.5, 7, 5.5);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.bias = -0.0004;
    sun.shadow.radius = 7;
    sun.shadow.camera.left = sun.shadow.camera.bottom = -6;
    sun.shadow.camera.right = sun.shadow.camera.top = 6;
    scene.add(sun);
    const fill = new THREE.RectAreaLight('#c9e9ff', 1.15, 4, 5);
    fill.position.set(4.2, 3.8, 4.5);
    fill.lookAt(0, 0.8, 0);
    scene.add(fill);
    const rim = new THREE.SpotLight('#ffd9ed', 6.5, 14, Math.PI / 5, 0.8, 1.4);
    rim.position.set(-4.5, 4.4, -3.2);
    rim.target.position.set(0, 1, 0);
    scene.add(rim, rim.target);

    const world = new THREE.Group();
    const gift = new THREE.Group();
    const sparkleGroup = new THREE.Group();
    const effectGroup = new THREE.Group();
    scene.add(world, sparkleGroup, effectGroup);
    world.add(gift);

    const radialTexture = makeRadialTexture();
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: radialTexture,
      color: new THREE.Color('#fff2b8').multiplyScalar(1.45),
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }));
    glow.position.set(0, 1.25, -0.25);
    glow.scale.setScalar(0.1);
    effectGroup.add(glow);

    const ringMaterial = new THREE.MeshBasicMaterial({
      color: new THREE.Color('#ffe59a').multiplyScalar(1.7),
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const lightRings = [0, 1].map((index) => {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.75 + index * 0.25, 0.024, 12, 72), ringMaterial.clone());
      ring.position.set(0, 1.22, -0.05 - index * 0.04);
      effectGroup.add(ring);
      return ring;
    });
    const burstLight = new THREE.PointLight('#ffd786', 0, 9, 1.7);
    burstLight.position.set(0, 1.4, 1.2);
    effectGroup.add(burstLight);

    for (let i = 0; i < 30; i += 1) {
      const particleGeometry = i % 3 === 0
        ? new THREE.OctahedronGeometry(0.045 + (i % 4) * 0.009, 0)
        : new THREE.SphereGeometry(0.032 + (i % 5) * 0.007, 10, 8);
      const dot = new THREE.Mesh(
        particleGeometry,
        new THREE.MeshBasicMaterial({
          color: new THREE.Color(i % 2 ? '#ffe49b' : '#fffdf0').multiplyScalar(1.9),
          transparent: true,
          opacity: 0,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        }),
      );
      dot.userData.seed = Math.random();
      sparkleGroup.add(dot);
    }

    const confettiColors = ['#f5a9a1', '#ffe49b', '#91c7b7', '#a9bde4', '#d9add0'];
    for (let i = 0; i < 22; i += 1) {
      const piece = new THREE.Mesh(
        new RoundedBoxGeometry(0.1, 0.19, 0.025, 2, 0.018),
        new THREE.MeshPhysicalMaterial({ color: confettiColors[i % confettiColors.length], roughness: 0.42, clearcoat: 0.25 }),
      );
      piece.visible = false;
      piece.userData.seed = Math.random();
      piece.userData.angle = (i / 22) * Math.PI * 2;
      effectGroup.add(piece);
    }

    const contactShadow = new THREE.Mesh(
      new THREE.PlaneGeometry(4.1, 2.8),
      new THREE.MeshBasicMaterial({ map: radialTexture, color: '#39433f', transparent: true, opacity: 0.22, depthWrite: false }),
    );
    contactShadow.rotation.x = -Math.PI / 2;
    contactShadow.position.set(0, -0.402, 0.22);
    contactShadow.scale.y = 0.62;
    world.add(contactShadow);

    let lid: THREE.Mesh | null = null;
    let lidAssembly: THREE.Group | null = null;
    let bow: THREE.Group | null = null;
    let audio: AudioContext | null = null;
    let audioBus: GainNode | null = null;
    let audioCompressor: DynamicsCompressorNode | null = null;
    let tapSampleBuffer: AudioBuffer | null = null;
    let tapSampleDecode: Promise<AudioBuffer | null> | null = null;
    let openSampleBuffer: AudioBuffer | null = null;
    let openSampleDecode: Promise<AudioBuffer | null> | null = null;
    const tapSampleData = fetch(TAP_SAMPLE_URL)
      .then((response) => (response.ok ? response.arrayBuffer() : null))
      .catch(() => null);
    const openSampleData = fetch(OPEN_SAMPLE_URL)
      .then((response) => (response.ok ? response.arrayBuffer() : null))
      .catch(() => null);
    let boxTouches = 0;
    let phase: 'box' | 'opening' | 'card' | 'ready' = 'box';
    let spawnAt = performance.now();
    let hitAt = -1000;
    let tapDirection = 1;
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

    const ensureAudio = () => {
      if (!audio) {
        audio = new AudioContext();
        audioBus = audio.createGain();
        audioCompressor = audio.createDynamicsCompressor();
        audioBus.gain.value = 0.72;
        audioCompressor.threshold.value = -18;
        audioCompressor.knee.value = 12;
        audioCompressor.ratio.value = 4;
        audioCompressor.attack.value = 0.006;
        audioCompressor.release.value = 0.18;
        audioBus.connect(audioCompressor).connect(audio.destination);
      }
      if (audio.state === 'suspended') void audio.resume();
      return { context: audio, bus: audioBus! };
    };
    const prepareTapSample = () => {
      const { context } = ensureAudio();
      if (tapSampleBuffer) return Promise.resolve(tapSampleBuffer);
      if (!tapSampleDecode) {
        tapSampleDecode = tapSampleData
          .then((data) => (data ? context.decodeAudioData(data.slice(0)) : null))
          .then((buffer) => {
            tapSampleBuffer = buffer;
            return buffer;
          })
          .catch(() => null);
      }
      return tapSampleDecode;
    };
    const prepareOpenSample = () => {
      const { context } = ensureAudio();
      if (openSampleBuffer) return Promise.resolve(openSampleBuffer);
      if (!openSampleDecode) {
        openSampleDecode = openSampleData
          .then((data) => (data ? context.decodeAudioData(data.slice(0)) : null))
          .then((buffer) => {
            openSampleBuffer = buffer;
            return buffer;
          })
          .catch(() => null);
      }
      return openSampleDecode;
    };
    const playTap = (count: number, swipe: boolean) => {
      const { context, bus } = ensureAudio();
      const now = context.currentTime;
      const pitch = swipe ? 210 : 254 + count * 28;
      const accent = 1 + Math.min(count - 1, 4) * 0.035;
      if (tapSampleBuffer) {
        const source = context.createBufferSource();
        const gain = context.createGain();
        source.buffer = tapSampleBuffer;
        source.playbackRate.value = swipe ? 0.94 : 0.96 + Math.min(count - 1, 4) * 0.035;
        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.exponentialRampToValueAtTime(0.78 * accent, now + 0.003);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.41);
        source.connect(gain).connect(bus);
        source.start(now);
        return;
      }
      void prepareTapSample();
      playTone(context, bus, pitch * 0.5, now, 0.082, 0.036 * accent, 'sine', pitch * 0.32, 0.003);
      playTone(context, bus, pitch, now, 0.11, 0.072 * accent, 'triangle', pitch * 0.64, 0.0025);
      playTone(context, bus, pitch * 1.82, now + 0.003, 0.12, 0.043 * accent, 'sine', pitch * 2.02, 0.002);
      playTone(context, bus, pitch * 3.1, now + 0.002, 0.036, 0.014 * accent, 'square', pitch * 2.6, 0.0015);
      playNoiseSweep(context, bus, now, 0.048, 1850, 520, 0.03 * accent, 0.07);
    };
    const playOpen = () => {
      const { context, bus } = ensureAudio();
      const now = context.currentTime;
      if (openSampleBuffer) {
        const source = context.createBufferSource();
        const gain = context.createGain();
        source.buffer = openSampleBuffer;
        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.exponentialRampToValueAtTime(0.9, now + 0.008);
        gain.gain.setValueAtTime(0.9, now + 1.25);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 1.38);
        source.connect(gain).connect(bus);
        source.start(now);
        return;
      }
      void prepareOpenSample();
      playNoiseSweep(context, bus, now, 0.48, 360, 3400, 0.024);
      playTone(context, bus, 285, now, 0.43, 0.018, 'triangle', 980);
      playTone(context, bus, 132, now, 0.16, 0.032, 'sine', 92);
      [523.25, 659.25, 783.99, 1046.5].forEach((frequency, index) => {
        playBell(context, bus, frequency, now + index * 0.078, 0.38 + index * 0.04, 0.03 + index * 0.003);
      });
      [1046.5, 1318.51, 1567.98].forEach((frequency, index) => {
        playBell(context, bus, frequency, now + 0.34 + index * 0.012, 0.78, 0.018);
      });
      [1760, 2093, 2637].forEach((frequency, index) => {
        playBell(context, bus, frequency, now + 0.52 + index * 0.13, 0.34, 0.009);
      });
    };
    const playCard = (word: WordCard) => {
      const { context, bus } = ensureAudio();
      const now = context.currentTime;
      const note = 620 + (word.tone % 170);
      playBell(context, bus, note, now, 0.42, 0.018);
      playBell(context, bus, note * 1.5, now + 0.11, 0.52, 0.014);
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

    const buildGift = () => {
      disposeChildren(gift);
      const styleIndex = Math.floor(Math.random() * BOX_STYLES.length);
      const colors = BOX_STYLES[styleIndex];
      const texture = makePatternTexture(colors, Math.floor(Math.random() * 3));
      texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
      const boxMat = new THREE.MeshPhysicalMaterial({
        color: '#ffffff',
        map: texture,
        bumpMap: texture,
        bumpScale: 0.018,
        roughness: 0.24,
        metalness: 0,
        clearcoat: 0.48,
        clearcoatRoughness: 0.2,
        sheen: 0.22,
        sheenColor: new THREE.Color(colors[2]),
        sheenRoughness: 0.42,
        envMapIntensity: 0.78,
      });
      const lidMat = new THREE.MeshPhysicalMaterial({
        color: colors[0],
        roughness: 0.2,
        metalness: 0,
        clearcoat: 0.72,
        clearcoatRoughness: 0.16,
        sheen: 0.18,
        sheenColor: new THREE.Color('#ffffff'),
        envMapIntensity: 0.88,
      });
      const ribbonMat = new THREE.MeshPhysicalMaterial({
        color: colors[1],
        roughness: 0.22,
        metalness: 0,
        clearcoat: 0.82,
        clearcoatRoughness: 0.13,
        sheen: 0.25,
        sheenColor: new THREE.Color('#ffffff'),
        envMapIntensity: 0.95,
      });
      const innerMat = new THREE.MeshPhysicalMaterial({ color: colors[2], roughness: 0.46, clearcoat: 0.16 });

      const base = new THREE.Mesh(new RoundedBoxGeometry(2.82, 2.03, 2.26, 8, 0.23), boxMat);
      base.position.set(0, 0.56, 0); base.castShadow = true; base.receiveShadow = true; base.userData.isGift = true; gift.add(base);
      const inset = new THREE.Mesh(new RoundedBoxGeometry(2.58, 0.2, 2.02, 4, 0.1), innerMat);
      inset.position.set(0, 1.54, 0); inset.castShadow = true; inset.userData.isGift = true; gift.add(inset);

      const frontRibbon = new THREE.Mesh(new RoundedBoxGeometry(0.48, 2.04, 0.105, 5, 0.045), ribbonMat);
      frontRibbon.position.set(0, 0.57, 1.15); frontRibbon.castShadow = true; frontRibbon.userData.isGift = true; gift.add(frontRibbon);
      const backRibbon = frontRibbon.clone();
      backRibbon.position.z = -1.15; gift.add(backRibbon);
      const bottomRibbon = new THREE.Mesh(new RoundedBoxGeometry(0.48, 0.1, 2.3, 4, 0.035), ribbonMat);
      bottomRibbon.position.set(0, -0.46, 0); bottomRibbon.userData.isGift = true; gift.add(bottomRibbon);

      lidAssembly = new THREE.Group();
      lidAssembly.position.y = 1.72;
      lidAssembly.userData.isGift = true;
      gift.add(lidAssembly);
      lid = new THREE.Mesh(new RoundedBoxGeometry(3.14, 0.52, 2.6, 8, 0.19), lidMat);
      lid.castShadow = true; lid.receiveShadow = true; lid.userData.isGift = true; lidAssembly.add(lid);
      const lidUnderside = new THREE.Mesh(new RoundedBoxGeometry(2.84, 0.1, 2.3, 4, 0.06), innerMat);
      lidUnderside.position.y = -0.29; lidUnderside.castShadow = true; lidUnderside.userData.isGift = true; lidAssembly.add(lidUnderside);
      const topRibbon = new THREE.Mesh(new RoundedBoxGeometry(0.5, 0.14, 2.69, 5, 0.05), ribbonMat);
      topRibbon.position.y = 0.3; topRibbon.castShadow = true; topRibbon.userData.isGift = true; lidAssembly.add(topRibbon);
      const lidFrontRibbon = new THREE.Mesh(new RoundedBoxGeometry(0.5, 0.53, 0.12, 4, 0.045), ribbonMat);
      lidFrontRibbon.position.set(0, 0, 1.32); lidFrontRibbon.castShadow = true; lidFrontRibbon.userData.isGift = true; lidAssembly.add(lidFrontRibbon);
      const lidBackRibbon = lidFrontRibbon.clone(); lidBackRibbon.position.z = -1.32; lidAssembly.add(lidBackRibbon);

      bow = new THREE.Group(); bow.userData.isGift = true;
      const knot = new THREE.Mesh(new RoundedBoxGeometry(0.45, 0.37, 0.43, 6, 0.16), ribbonMat);
      knot.rotation.z = 0.08; knot.castShadow = true; knot.userData.isGift = true; bow.add(knot);
      [-1, 1].forEach((side) => {
        const loop = makeRibbonLoop(side, ribbonMat);
        loop.castShadow = true; loop.userData.isGift = true; bow!.add(loop);
        const tail = makeRibbonTail(side, ribbonMat);
        tail.castShadow = true; tail.userData.isGift = true; bow!.add(tail);
      });
      bow.position.set(0, 0.51, 0.02); bow.rotation.x = -0.16; lidAssembly.add(bow);
    };

    const nextRound = () => {
      window.clearTimeout(cardTimer); window.clearTimeout(readyTimer);
      setCard(null); setCardReady(false); phase = 'box'; boxTouches = 0; dragTarget = dragValue = 0;
      buildGift();
      gift.visible = true; gift.position.set(0, 0, 0); gift.rotation.set(0, 0, 0); gift.scale.setScalar(0.55);
      glow.material.opacity = 0; glow.scale.setScalar(0.1); bloomPass.strength = 0.06; burstLight.intensity = 0;
      lightRings.forEach((ring) => { (ring.material as THREE.MeshBasicMaterial).opacity = 0; ring.scale.setScalar(0.1); });
      sparkleGroup.children.forEach((child) => ((child as THREE.Mesh).material as THREE.MeshBasicMaterial).opacity = 0);
      effectGroup.children.forEach((child) => { if (child.userData.angle !== undefined) child.visible = false; });
      camera.position.copy(cameraHome); camera.lookAt(0, 0.65, 0); contactShadow.material.opacity = 0.22; contactShadow.scale.set(1, 0.62, 1);
      const nextIndex = (previousWord + 1 + Math.floor(Math.random() * (WORDS.length - 1))) % WORDS.length;
      previousWord = nextIndex; currentCard = WORDS[nextIndex];
      spawnAt = performance.now(); hitAt = -1000; tapDirection = 1;
    };

    const openGift = () => {
      phase = 'opening'; openingAt = performance.now(); playOpen();
      cardTimer = window.setTimeout(() => {
        phase = 'card'; setCard(currentCard);
        if (!openSampleBuffer) playCard(currentCard);
        readyTimer = window.setTimeout(() => { phase = 'ready'; setCardReady(true); }, 5000);
      }, prefersLessMotion ? 280 : 1380);
    };

    const reactGift = (swipe: boolean, amount = 0) => {
      if (phase !== 'box') return;
      boxTouches += 1; hitAt = performance.now(); tapDirection = boxTouches % 2 === 0 ? -1 : 1; playTap(boxTouches, swipe);
      dragTarget = THREE.MathUtils.clamp(amount, -1.0, 1.0) * 0.52;
      if (boxTouches >= 5) openGift();
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
    const onPointerDown = (event: PointerEvent) => {
      renderer.domElement.setPointerCapture(event.pointerId); updatePointer(event);
      pointerStart.set(event.clientX, event.clientY); pointerLast.copy(pointerStart); pointerMoved = false;
      if (phase === 'ready') { nextRound(); return; }
      if (phase !== 'box') return;
      pointerOnGift = giftHit();
      if (pointerOnGift) {
        void prepareTapSample();
        void prepareOpenSample();
      }
    };
    const onPointerMove = (event: PointerEvent) => {
      if (phase !== 'box') return; updatePointer(event);
      const dx = event.clientX - pointerStart.x, dy = event.clientY - pointerStart.y;
      if (Math.hypot(dx, dy) > 12) pointerMoved = true;
      if (pointerOnGift) dragTarget = THREE.MathUtils.clamp(dx / 160, -1, 1) * 0.64;
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
      camera.updateProjectionMatrix();
      renderer.setSize(clientWidth, clientHeight, false);
      composer.setSize(clientWidth, clientHeight);
    };
    const observer = new ResizeObserver(resize); observer.observe(mount); resize(); nextRound();

    let lastAnimationTime = performance.now();
    let frame = 0;
    const animate = (time: number) => {
      const dt = Math.min((time - lastAnimationTime) / 1000, 0.034);
      lastAnimationTime = time;
      const spawnProgress = THREE.MathUtils.clamp((time - spawnAt) / (prefersLessMotion ? 180 : 520), 0, 1);
      const tapProgress = THREE.MathUtils.clamp((time - hitAt) / (prefersLessMotion ? 170 : 430), 0, 1);
      dragValue = THREE.MathUtils.damp(dragValue, dragTarget, 9, dt);
      if (phase === 'box') {
        const spawnEase = 1 + 1.45 * Math.pow(spawnProgress - 1, 3) + 0.45 * Math.pow(spawnProgress - 1, 2);
        const spawnScale = THREE.MathUtils.lerp(0.55, 1, THREE.MathUtils.clamp(spawnEase, 0, 1.06));
        const tapPose = sampleTapPose(tapProgress);
        gift.scale.set(spawnScale * tapPose.scaleX, spawnScale * tapPose.scaleY, spawnScale * tapPose.scaleX);
        gift.rotation.z = tapPose.tilt * tapDirection + dragValue * 0.035;
        gift.position.x = dragValue;
        gift.position.y = Math.sin(time * 0.0022) * (prefersLessMotion ? 0.004 : 0.014) + tapPose.lift;
        if (lidAssembly) {
          lidAssembly.position.y = 1.72 + tapPose.lidLift;
          lidAssembly.rotation.set(-tapPose.lidLift * 0.08, 0, -tapPose.tilt * tapDirection * 0.32);
        }
        if (bow) bow.rotation.y = Math.sin(time * 0.0019) * (prefersLessMotion ? 0.015 : 0.07) + Math.sin(tapProgress * Math.PI) * tapDirection * 0.035;
        contactShadow.scale.set(tapPose.shadow, 0.62 * tapPose.shadow, 1);
        camera.position.lerp(cameraHome, 0.08);
        camera.lookAt(0, 0.65, 0);
        bloomPass.strength = THREE.MathUtils.damp(bloomPass.strength, 0.06, 7, dt);
        renderer.toneMappingExposure = THREE.MathUtils.damp(renderer.toneMappingExposure, 0.88, 7, dt);
        contactShadow.material.opacity = THREE.MathUtils.damp(contactShadow.material.opacity, 0.22, 7, dt);
      } else {
        const p = Math.min(1, Math.max(0, (time - openingAt) / (prefersLessMotion ? 320 : 1450)));
        const ease = 1 - Math.pow(1 - p, 3);
        const anticipation = Math.sin(Math.min(p / 0.22, 1) * Math.PI);
        const lift = p < 0.16 ? 0 : 1 - Math.pow(1 - Math.min(1, (p - 0.16) / 0.58), 4);
        gift.scale.set(1 + anticipation * 0.1, 1 - anticipation * 0.07 + Math.sin(Math.min(p * 1.12, 1) * Math.PI) * 0.13, 1 + anticipation * 0.1);
        gift.rotation.z = Math.sin(p * Math.PI * 5) * (1 - p) * 0.055;
        gift.position.y = anticipation * -0.05 + Math.sin(Math.min(1, p * 1.2) * Math.PI) * 0.1;
        if (lidAssembly) {
          lidAssembly.position.y = 1.72 + lift * 2.35;
          lidAssembly.rotation.x = -lift * 1.02;
          lidAssembly.rotation.z = lift * 0.16;
          lidAssembly.rotation.y = lift * -0.08;
        }
        if (bow) bow.rotation.y = Math.sin(p * Math.PI * 3) * (1 - p) * 0.16;

        const flare = Math.pow(Math.sin(Math.min(p / 0.9, 1) * Math.PI), 0.72);
        glow.material.opacity = flare * 0.34;
        glow.scale.setScalar(0.35 + ease * 3.85);
        burstLight.intensity = flare * 18;
        bloomPass.strength = 0.06 + flare * 0.5;
        renderer.toneMappingExposure = 0.88 + flare * 0.07;
        contactShadow.material.opacity = 0.22 * (1 - lift * 0.45);
        lightRings.forEach((ring, index) => {
          const delayed = Math.max(0, Math.min(1, (p - index * 0.09) / 0.72));
          ring.scale.setScalar(0.18 + delayed * (3.4 + index * 0.7));
          ring.rotation.z = p * (index ? -1.2 : 1.5);
          (ring.material as THREE.MeshBasicMaterial).opacity = Math.sin(delayed * Math.PI) * (index ? 0.34 : 0.46);
        });
        sparkleGroup.children.forEach((child, index) => {
          const seed = child.userData.seed as number;
          const angle = (index / sparkleGroup.children.length) * Math.PI * 2 + p * (1.25 + seed);
          const radius = 0.32 + ease * (1.5 + seed * 1.25);
          child.position.set(Math.cos(angle) * radius, 1.2 + Math.sin(angle * 1.75) * radius * 0.46 + ease * (0.35 + seed), Math.sin(angle) * (0.38 + seed * 0.35));
          child.scale.setScalar(0.55 + Math.sin((p + seed) * Math.PI * 4) * 0.22 + seed * 0.6);
          child.rotation.set(p * 7 * seed, p * 6, p * 4);
          ((child as THREE.Mesh).material as THREE.MeshBasicMaterial).opacity = Math.sin(p * Math.PI) * (0.55 + seed * 0.45);
        });
        effectGroup.children.forEach((child) => {
          if (child.userData.angle === undefined) return;
          const seed = child.userData.seed as number;
          const angle = child.userData.angle as number;
          const launch = Math.max(0, Math.min(1, (p - 0.2) / 0.7));
          child.visible = launch > 0 && launch < 0.98;
          const radius = 0.25 + launch * (2.15 + seed * 1.25);
          child.position.set(Math.cos(angle) * radius, 1.35 + launch * (2.0 + seed * 1.2) - launch * launch * 2.2, Math.sin(angle) * radius * 0.55 + 0.35);
          child.rotation.set(launch * (5 + seed * 8), launch * (7 + seed * 6), angle + launch * 5);
        });

        const cameraEase = Math.sin(Math.min(1, p / 0.78) * Math.PI / 2);
        camera.position.set(cameraHome.x, cameraHome.y - cameraEase * 0.12, cameraHome.z - cameraEase * 0.62);
        camera.lookAt(0, 0.78 + cameraEase * 0.18, 0);
      }
      composer.render(); frame = requestAnimationFrame(animate);
    };
    frame = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(frame); window.clearTimeout(cardTimer); window.clearTimeout(readyTimer); observer.disconnect();
      renderer.domElement.removeEventListener('pointerdown', onPointerDown); renderer.domElement.removeEventListener('pointermove', onPointerMove);
      renderer.domElement.removeEventListener('pointerup', onPointerUp); renderer.domElement.removeEventListener('pointercancel', onPointerUp);
      disposeChildren(gift); disposeChildren(sparkleGroup); disposeChildren(effectGroup);
      contactShadow.geometry.dispose(); contactShadow.material.dispose(); radialTexture.dispose(); glow.material.dispose(); ringMaterial.dispose();
      environmentMap.dispose(); composer.dispose(); renderer.dispose(); audioBus?.disconnect(); audioCompressor?.disconnect(); void audio?.close(); mount.removeChild(renderer.domElement);
    };
  }, []);

  return (
    <main className="game-shell">
      <div ref={mountRef} className="game-canvas" />
      {card && (
        <section className={`word-card-wrap ${cardReady ? 'is-ready' : ''}`} aria-live="polite">
          <div className="word-card" role="img" aria-label={card.word}>
            <div className="paper-tape" aria-hidden="true" />
            <div className={`word-picture ${card.image ? 'is-photo' : ''}`} aria-hidden="true">
              {card.image ? <img src={card.image} alt="" /> : card.picture}
            </div>
            <div className="word-label">{card.word}</div>
            <span className="card-shine" aria-hidden="true" />
          </div>
        </section>
      )}
    </main>
  );
}
