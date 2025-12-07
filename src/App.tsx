import { useState, useMemo, useRef, useEffect, Suspense, useCallback, useImperativeHandle, forwardRef } from 'react';
import type React from 'react';
import { Canvas, useFrame, extend, useThree } from '@react-three/fiber';
import {
  OrbitControls,
  Environment,
  PerspectiveCamera,
  shaderMaterial,
  Float,
  Stars,
  Sparkles,
  useTexture
} from '@react-three/drei';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import * as THREE from 'three';
import { MathUtils } from 'three';
import * as random from 'maath/random';
import { GestureRecognizer, FilesetResolver, DrawingUtils } from "@mediapipe/tasks-vision";
import { photos as photoAssets } from 'virtual:photos';
import { musicTracks } from 'virtual:music';
import './App.css';

const FALLBACK_PHOTO = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512" fill="none"><rect width="512" height="512" rx="28" fill="%23004225"/><circle cx="256" cy="180" r="90" fill="%23FFD700"/><text x="50%" y="78%" dominant-baseline="middle" text-anchor="middle" fill="white" font-size="64" font-family="sans-serif">&#127876;</text></svg>';

// --- 视觉配置 ---
const CONFIG = {
  colors: {
    emerald: '#004225', // 纯正祖母绿
    gold: '#FFD700',
    silver: '#ECEFF1',
    red: '#D32F2F',
    green: '#2E7D32',
    white: '#FFFFFF',   // 纯白色
    warmLight: '#FFD54F',
    lights: ['#ff7bac', '#7de0ff', '#ffd86f', '#8cffc1', '#ff9f7a'], // 糖果色彩灯
    // 拍立得边框颜色池 (复古柔和色系)
    borders: ['#FFFAF0', '#F0E68C', '#E6E6FA', '#FFB6C1', '#98FB98', '#87CEFA', '#FFDAB9'],
    // 圣诞元素颜色
    giftColors: ['#D32F2F', '#FFD700', '#1976D2', '#2E7D32'],
    candyColors: ['#FF0000', '#FFFFFF']
  },
  counts: {
    foliage: 20000,
    ornaments: 160,   // 拍立得照片数量（降低密度）
    elements: 180,    // 圣诞元素数量
    lights: 200       // 彩灯数量
  },
  tree: { height: 22, radius: 9 } // 树体尺寸
};

type BackgroundOption = {
  id: string;
  label: string;
  kind: 'preset' | 'image' | 'video';
  base: string;
  overlay: string;
  stars: string;
  sceneBg: string;
  fogColor: string;
  textColor: string;
  mediaUrl?: string;
};

const PRESET_BACKGROUNDS: BackgroundOption[] = [
  {
    id: 'preset-sky',
    label: '柔和蓝',
    kind: 'preset',
    base: 'linear-gradient(180deg, #e4f5ff 0%, #cfe9ff 45%, #b7d9ff 100%)',
    overlay: 'radial-gradient(circle at 25% 35%, rgba(255, 168, 194, 0.16), transparent 32%), radial-gradient(circle at 75% 28%, rgba(255, 237, 173, 0.18), transparent 32%), radial-gradient(circle at 55% 70%, rgba(174, 230, 255, 0.18), transparent 36%)',
    stars: 'radial-gradient(2px 2px at 10% 20%, rgba(255,255,255,0.35), transparent), radial-gradient(2px 2px at 30% 80%, rgba(255,255,255,0.32), transparent), radial-gradient(2px 2px at 70% 50%, rgba(255,255,255,0.28), transparent), radial-gradient(3px 3px at 85% 30%, rgba(255,255,255,0.2), transparent)',
    sceneBg: '#cfe9ff',
    fogColor: '#b7d9ff',
    textColor: '#0f1b29'
  },
  {
    id: 'preset-blush',
    label: '晨曦粉',
    kind: 'preset',
    base: 'linear-gradient(180deg, #ffe9f3 0%, #ffdbe9 45%, #ffd0df 100%)',
    overlay: 'radial-gradient(circle at 20% 35%, rgba(255, 193, 214, 0.2), transparent 32%), radial-gradient(circle at 78% 26%, rgba(255, 230, 180, 0.22), transparent 34%), radial-gradient(circle at 60% 72%, rgba(210, 235, 255, 0.16), transparent 36%)',
    stars: 'radial-gradient(2px 2px at 12% 24%, rgba(255,255,255,0.35), transparent), radial-gradient(2px 2px at 32% 78%, rgba(255,255,255,0.3), transparent), radial-gradient(2px 2px at 70% 52%, rgba(255,255,255,0.26), transparent), radial-gradient(3px 3px at 85% 30%, rgba(255,255,255,0.18), transparent)',
    sceneBg: '#ffe6f2',
    fogColor: '#ffd6e5',
    textColor: '#3a1b25'
  },
  {
    id: 'preset-mist',
    label: '雾白',
    kind: 'preset',
    base: 'linear-gradient(180deg, #f9fbff 0%, #e7f0f8 45%, #dbe6f1 100%)',
    overlay: 'radial-gradient(circle at 22% 34%, rgba(200, 221, 255, 0.18), transparent 32%), radial-gradient(circle at 76% 28%, rgba(240, 228, 200, 0.16), transparent 34%), radial-gradient(circle at 55% 70%, rgba(205, 225, 240, 0.16), transparent 36%)',
    stars: 'radial-gradient(2px 2px at 10% 20%, rgba(255,255,255,0.28), transparent), radial-gradient(2px 2px at 30% 80%, rgba(255,255,255,0.26), transparent), radial-gradient(2px 2px at 70% 50%, rgba(255,255,255,0.22), transparent), radial-gradient(3px 3px at 85% 30%, rgba(255,255,255,0.16), transparent)',
    sceneBg: '#e7f0f8',
    fogColor: '#d6e3ef',
    textColor: '#0f1b29'
  }
];

const BACKGROUND_ASSET_IMPORTS = import.meta.glob('../public/background/**/*.{png,jpg,jpeg,webp,avif,gif,mp4,webm,ogg}', { eager: true, as: 'url' }) as Record<string, string>;

const ASSET_BACKGROUNDS: BackgroundOption[] = Object.entries(BACKGROUND_ASSET_IMPORTS).map(([path, url], idx) => {
  const file = path.split('/').pop() || `asset-${idx}`;
  const label = decodeURIComponent(file.replace(/\.[^.]+$/, ''));
  const ext = (file.split('.').pop() || '').toLowerCase();
  const isVideo = ['mp4', 'webm', 'ogg'].includes(ext);
  const fallback = PRESET_BACKGROUNDS[0];
  return {
    id: `asset-${idx}-${file}`,
    label,
    kind: (isVideo ? 'video' : 'image') as 'video' | 'image',
    mediaUrl: url,
    base: isVideo ? fallback.base : `url("${url}") center/cover no-repeat, ${fallback.base}`,
    overlay: fallback.overlay,
    stars: fallback.stars,
    sceneBg: fallback.sceneBg,
    fogColor: fallback.fogColor,
    textColor: fallback.textColor
  };
}).sort((a, b) => a.label.localeCompare(b.label));

const BACKGROUND_OPTIONS: BackgroundOption[] = ASSET_BACKGROUNDS.length ? [...ASSET_BACKGROUNDS, ...PRESET_BACKGROUNDS] : PRESET_BACKGROUNDS;

const DEFAULT_BACKGROUND_ID = (() => {
  if (ASSET_BACKGROUNDS.length) return BACKGROUND_OPTIONS[0].id;
  const blush = BACKGROUND_OPTIONS.find(b => b.id === 'preset-blush');
  return blush?.id ?? BACKGROUND_OPTIONS[0].id;
})();

// --- Optimized Foliage Shader (GPU-driven) ---
const FoliageMaterial = shaderMaterial(
  { uTime: 0, uColor: new THREE.Color(CONFIG.colors.emerald), uProgress: 0, sizeMultiplier: 1 },
  `uniform float uTime; uniform float uProgress; uniform float sizeMultiplier;
  attribute vec3 aTargetPos; attribute float aRandom;
  varying vec2 vUv; varying float vAlpha;
  
  float cubicInOut(float t) { 
    return t < 0.5 ? 4.0 * t * t * t : 0.5 * pow(2.0 * t - 2.0, 3.0) + 1.0; 
  }
  
  void main() {
    vUv = uv;
    float t = cubicInOut(uProgress);
    
    // Optimize: compute noise inline without function calls
    vec3 noise = vec3(
      sin(uTime * 1.5 + position.x),
      cos(uTime + position.y),
      sin(uTime * 1.5 + position.z)
    ) * 0.15;
    
    vec3 finalPos = mix(position, aTargetPos + noise, t);
    vec4 mvPosition = modelViewMatrix * vec4(finalPos, 1.0);
    
    // Dynamic sizing with depth attenuation
    gl_PointSize = (90.0 * (1.0 + aRandom) * sizeMultiplier) / -mvPosition.z;
    gl_Position = projectionMatrix * mvPosition;
    
    // Pass alpha for fade effects
    vAlpha = mix(0.7, 1.0, t);
  }`,
  `uniform vec3 uColor;
  varying float vAlpha;
  
  void main() {
    vec2 center = gl_PointCoord - 0.5;
    float dist = length(center);
    if (dist > 0.5) discard;
    
    // Soft edges for better blending
    float alpha = smoothstep(0.5, 0.35, dist) * vAlpha;
    
    // Optimized color calculation
    vec3 finalColor = uColor * (0.8 + 0.4 * (1.0 - dist * 2.0));
    gl_FragColor = vec4(finalColor, alpha);
  }`
);
extend({ FoliageMaterial });

// --- Helper: Tree Shape ---
const getTreePosition = () => {
  const h = CONFIG.tree.height; const rBase = CONFIG.tree.radius;
  const y = (Math.random() * h) - (h / 2); const normalizedY = (y + (h/2)) / h;
  const currentRadius = rBase * (1 - normalizedY) * 0.65; // tighter radius
  const theta = Math.random() * Math.PI * 2;
  const r = Math.random() * currentRadius;
  return [r * Math.cos(theta), y, r * Math.sin(theta)];
};

// --- Foliage cache (avoid re-allocations) ---
const MAX_FOLIAGE = CONFIG.counts.foliage;
const FOLIAGE_CACHE = (() => {
  const positions = new Float32Array(MAX_FOLIAGE * 3);
  const targetPositions = new Float32Array(MAX_FOLIAGE * 3);
  const randoms = new Float32Array(MAX_FOLIAGE);
  const spherePoints = random.inSphere(new Float32Array(MAX_FOLIAGE * 3), { radius: 25 }) as Float32Array;
  for (let i = 0; i < MAX_FOLIAGE; i++) {
    positions[i*3] = spherePoints[i*3]; positions[i*3+1] = spherePoints[i*3+1]; positions[i*3+2] = spherePoints[i*3+2];
    const [tx, ty, tz] = getTreePosition();
    targetPositions[i*3] = tx; targetPositions[i*3+1] = ty; targetPositions[i*3+2] = tz;
    randoms[i] = Math.random();
  }
  return { positions, targetPositions, randoms, count: MAX_FOLIAGE };
})();

// --- Component: Foliage ---
const Foliage = ({ state, count, sizeMultiplier = 1 }: { state: 'CHAOS' | 'FORMED', count: number, sizeMultiplier?: number }) => {
  const materialRef = useRef<any>(null);
  const geometryRef = useRef<THREE.BufferGeometry>(null);

  const { positions, targetPositions, randoms } = useMemo(() => {
    const clamped = Math.min(count, FOLIAGE_CACHE.count);
    return {
      positions: FOLIAGE_CACHE.positions.subarray(0, clamped * 3),
      targetPositions: FOLIAGE_CACHE.targetPositions.subarray(0, clamped * 3),
      randoms: FOLIAGE_CACHE.randoms.subarray(0, clamped)
    };
  }, [count]);
  // Optimize: batch uniform updates, avoid per-frame overhead
  useFrame((rootState, delta) => {
    if (!materialRef.current) return;
    
    const mat = materialRef.current;
    mat.uTime = rootState.clock.elapsedTime;
    
    const targetProgress = state === 'FORMED' ? 1 : 0;
    const newProgress = MathUtils.damp(mat.uProgress, targetProgress, 1.5, delta);
    
    // Only update if changed significantly (reduce GPU uploads)
    if (Math.abs(newProgress - mat.uProgress) > 0.001) {
      mat.uProgress = newProgress;
    }
    
    mat.sizeMultiplier = sizeMultiplier;
  });

  useEffect(() => {
    if (geometryRef.current) {
      geometryRef.current.setDrawRange(0, positions.length / 3);
      geometryRef.current.computeBoundingSphere();
    }
  }, [positions]);

  return (
    <points>
      <bufferGeometry ref={geometryRef}>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        <bufferAttribute attach="attributes-aTargetPos" args={[targetPositions, 3]} />
        <bufferAttribute attach="attributes-aRandom" args={[randoms, 1]} />
      </bufferGeometry>
      {/* @ts-ignore */}
      <foliageMaterial ref={materialRef} transparent depthWrite={false} blending={THREE.AdditiveBlending} />
    </points>
  );
};

type PhotoOpenPayload = { url: string; screenPosition: { x: number; y: number } };
type PhotoOrnamentsHandle = { openRandomPhoto: () => PhotoOpenPayload | null };
type PhotoOrnamentsProps = { state: 'CHAOS' | 'FORMED', photoUrls: string[], onPhotoOpen?: (p: PhotoOpenPayload) => void };

// --- Component: Photo Ornaments (Double-Sided Polaroid) ---
const PhotoOrnaments = forwardRef(function PhotoOrnamentsComponent(
  props: PhotoOrnamentsProps & { ornamentCount?: number },
  ref: React.ForwardedRef<PhotoOrnamentsHandle>
) {
  const { state, photoUrls, onPhotoOpen, ornamentCount } = props;
  const textures = useTexture(photoUrls);
  const count = ornamentCount ?? CONFIG.counts.ornaments;
  const groupRef = useRef<THREE.Group>(null);
  const { size, camera } = useThree();

  const borderGeometry = useMemo(() => new THREE.PlaneGeometry(1.2, 1.5), []);
  const photoGeometry = useMemo(() => new THREE.PlaneGeometry(1, 1), []);

  const projectToScreen = useCallback((pos: THREE.Vector3) => {
    const projected = pos.clone().project(camera);
    return {
      x: (projected.x * 0.5 + 0.5) * size.width,
      y: (-projected.y * 0.5 + 0.5) * size.height
    };
  }, [camera, size.height, size.width]);

  const data = useMemo(() => {
    return new Array(count).fill(0).map((_, i) => {
      const chaosPos = new THREE.Vector3((Math.random()-0.5)*70, (Math.random()-0.5)*70, (Math.random()-0.5)*70);
      const h = CONFIG.tree.height; const y = (Math.random() * h) - (h / 2);
      const rBase = CONFIG.tree.radius;
      const baseRadius = (rBase * (1 - (y + (h/2)) / h)) + 0.5;
      const currentRadius = baseRadius * 0.82 + 0.2; // 更靠内，叶子包裹照片
      const theta = Math.random() * Math.PI * 2;
      const targetPos = new THREE.Vector3(currentRadius * Math.cos(theta), y, currentRadius * Math.sin(theta));

      const isBig = Math.random() < 0.2;
      const baseScale = isBig ? 2.2 : 0.8 + Math.random() * 0.6;
      const weight = 0.8 + Math.random() * 1.2;
      const borderColor = CONFIG.colors.borders[Math.floor(Math.random() * CONFIG.colors.borders.length)];

      const rotationSpeed = {
        x: (Math.random() - 0.5) * 1.0,
        y: (Math.random() - 0.5) * 1.0,
        z: (Math.random() - 0.5) * 1.0
      };
      const tilt = {
        x: (Math.random() - 0.5) * 0.3,
        y: (Math.random() - 0.5) * 0.5,
        z: (Math.random() - 0.5) * 0.3
      };
      const chaosRotation = new THREE.Euler(Math.random()*Math.PI, Math.random()*Math.PI, Math.random()*Math.PI);

      return {
        chaosPos, targetPos, scale: baseScale, weight,
        textureIndex: i % textures.length,
        borderColor,
        currentPos: chaosPos.clone(),
        chaosRotation,
        rotationSpeed,
        wobbleOffset: Math.random() * 10,
        wobbleSpeed: 0.5 + Math.random() * 0.5,
        tilt
      };
    });
  }, [textures, count]);

  useFrame((stateObj, delta) => {
    if (!groupRef.current) return;
    const isFormed = state === 'FORMED';
    const time = stateObj.clock.elapsedTime;

    groupRef.current.children.forEach((group, i) => {
      const objData = data[i];
      const target = isFormed ? objData.targetPos : objData.chaosPos;

      objData.currentPos.lerp(target, delta * (isFormed ? 0.8 * objData.weight : 0.5));
      group.position.copy(objData.currentPos);

      if (isFormed) {
         const targetLookPos = new THREE.Vector3(group.position.x * 2, group.position.y + 0.5, group.position.z * 2);
         group.lookAt(targetLookPos);

         const wobbleX = Math.sin(time * objData.wobbleSpeed + objData.wobbleOffset) * 0.05;
         const wobbleZ = Math.cos(time * objData.wobbleSpeed * 0.8 + objData.wobbleOffset) * 0.05;
         group.rotation.x += objData.tilt.x + wobbleX;
         group.rotation.y += objData.tilt.y * 0.6;
         group.rotation.z += objData.tilt.z + wobbleZ;

      } else {
         group.rotation.x += delta * objData.rotationSpeed.x;
         group.rotation.y += delta * objData.rotationSpeed.y;
         group.rotation.z += delta * objData.rotationSpeed.z;
      }
    });
  });

  const openFromGroup = useCallback((group: THREE.Object3D, textureIndex: number) => {
    const worldPos = new THREE.Vector3();
    group.getWorldPosition(worldPos);
    const screenPosition = projectToScreen(worldPos);
    const url = photoUrls[textureIndex % photoUrls.length] || FALLBACK_PHOTO;
    onPhotoOpen?.({ url, screenPosition });
  }, [photoUrls, projectToScreen, onPhotoOpen]);

  useImperativeHandle(ref, () => ({
    openRandomPhoto: () => {
      if (!groupRef.current || !groupRef.current.children.length) return null;
      const child = groupRef.current.children[Math.floor(Math.random() * groupRef.current.children.length)];
      const texIndex = (child as any).userData?.textureIndex ?? 0;
      const worldPos = new THREE.Vector3();
      child.getWorldPosition(worldPos);
      return {
        url: photoUrls[texIndex % photoUrls.length] || FALLBACK_PHOTO,
        screenPosition: projectToScreen(worldPos)
      };
    }
  }), [photoUrls, projectToScreen]);

  return (
    <group ref={groupRef}>
      {data.map((obj, i) => (
        <group
          key={i}
          scale={[obj.scale, obj.scale, obj.scale]}
          rotation={state === 'CHAOS' ? obj.chaosRotation : [0,0,0]}
          userData={{ textureIndex: obj.textureIndex }}
          onPointerDown={(e) => {
            e.stopPropagation();
            openFromGroup(e.object, obj.textureIndex);
          }}
        >
          {/* 正面 */}
          <group position={[0, 0, 0.015]}>
            <mesh geometry={photoGeometry}>
              <meshStandardMaterial
                map={textures[obj.textureIndex]}
                roughness={0.5} metalness={0}
                emissive={CONFIG.colors.white} emissiveMap={textures[obj.textureIndex]} emissiveIntensity={1.0}
                side={THREE.FrontSide}
              />
            </mesh>
            <mesh geometry={borderGeometry} position={[0, -0.15, -0.01]}>
              <meshStandardMaterial color={obj.borderColor} roughness={0.9} metalness={0} side={THREE.FrontSide} />
            </mesh>
          </group>
          {/* 背面 */}
          <group position={[0, 0, -0.015]} rotation={[0, Math.PI, 0]}>
            <mesh geometry={photoGeometry}>
              <meshStandardMaterial
                map={textures[obj.textureIndex]}
                roughness={0.5} metalness={0}
                emissive={CONFIG.colors.white} emissiveMap={textures[obj.textureIndex]} emissiveIntensity={1.0}
                side={THREE.FrontSide}
              />
            </mesh>
            <mesh geometry={borderGeometry} position={[0, -0.15, -0.01]}>
              <meshStandardMaterial color={obj.borderColor} roughness={0.9} metalness={0} side={THREE.FrontSide} />
            </mesh>
          </group>
        </group>
      ))}
    </group>
  );
});

// --- Component: Christmas Elements ---
const ChristmasElements = ({ state, count }: { state: 'CHAOS' | 'FORMED', count: number }) => {
  const groupRef = useRef<THREE.Group>(null);

  const boxGeometry = useMemo(() => new THREE.BoxGeometry(0.8, 0.8, 0.8), []);
  const sphereGeometry = useMemo(() => new THREE.SphereGeometry(0.5, 16, 16), []);
  const caneGeometry = useMemo(() => new THREE.CylinderGeometry(0.15, 0.15, 1.2, 8), []);

  const data = useMemo(() => {
    return new Array(count).fill(0).map(() => {
      const chaosPos = new THREE.Vector3((Math.random()-0.5)*60, (Math.random()-0.5)*60, (Math.random()-0.5)*60);
      const h = CONFIG.tree.height;
      const y = (Math.random() * h) - (h / 2);
      const rBase = CONFIG.tree.radius;
      const currentRadius = (rBase * (1 - (y + (h/2)) / h)) * 0.95;
      const theta = Math.random() * Math.PI * 2;

      const targetPos = new THREE.Vector3(currentRadius * Math.cos(theta), y, currentRadius * Math.sin(theta));

      const type = Math.floor(Math.random() * 3);
      let color; let scale = 1;
      if (type === 0) { color = CONFIG.colors.giftColors[Math.floor(Math.random() * CONFIG.colors.giftColors.length)]; scale = 0.8 + Math.random() * 0.4; }
      else if (type === 1) { color = CONFIG.colors.giftColors[Math.floor(Math.random() * CONFIG.colors.giftColors.length)]; scale = 0.6 + Math.random() * 0.4; }
      else { color = Math.random() > 0.5 ? CONFIG.colors.red : CONFIG.colors.white; scale = 0.7 + Math.random() * 0.3; }

      const rotationSpeed = { x: (Math.random()-0.5)*2.0, y: (Math.random()-0.5)*2.0, z: (Math.random()-0.5)*2.0 };
      return { type, chaosPos, targetPos, color, scale, currentPos: chaosPos.clone(), chaosRotation: new THREE.Euler(Math.random()*Math.PI, Math.random()*Math.PI, Math.random()*Math.PI), rotationSpeed };
    });
  }, [boxGeometry, sphereGeometry, caneGeometry]);

  useFrame((_, delta) => {
    if (!groupRef.current) return;
    const isFormed = state === 'FORMED';
    groupRef.current.children.forEach((child, i) => {
      const mesh = child as THREE.Mesh;
      const objData = data[i];
      const target = isFormed ? objData.targetPos : objData.chaosPos;
      objData.currentPos.lerp(target, delta * 1.5);
      mesh.position.copy(objData.currentPos);
      mesh.rotation.x += delta * objData.rotationSpeed.x; mesh.rotation.y += delta * objData.rotationSpeed.y; mesh.rotation.z += delta * objData.rotationSpeed.z;
    });
  });

  return (
    <group ref={groupRef}>
      {data.map((obj, i) => {
        let geometry; if (obj.type === 0) geometry = boxGeometry; else if (obj.type === 1) geometry = sphereGeometry; else geometry = caneGeometry;
        return ( <mesh key={i} scale={[obj.scale, obj.scale, obj.scale]} geometry={geometry} rotation={obj.chaosRotation}>
          <meshStandardMaterial color={obj.color} roughness={0.3} metalness={0.4} emissive={obj.color} emissiveIntensity={0.2} />
        </mesh> )})}
    </group>
  );
};

const Trunk = () => {
  const geometry = useMemo(() => new THREE.CylinderGeometry(1.4, 1.6, 6, 12), []);
  return (
    <mesh position={[0, -(CONFIG.tree.height / 2) - 3, 0]} geometry={geometry} receiveShadow castShadow>
      <meshStandardMaterial color="#8b5a2b" roughness={0.85} metalness={0.1} />
    </mesh>
  );
};

// --- Component: Fairy Lights ---
const FairyLights = ({ state, count }: { state: 'CHAOS' | 'FORMED', count: number }) => {
  const groupRef = useRef<THREE.Group>(null);
  const geometry = useMemo(() => new THREE.SphereGeometry(0.8, 8, 8), []);

  const data = useMemo(() => {
    return new Array(count).fill(0).map(() => {
      const chaosPos = new THREE.Vector3((Math.random()-0.5)*60, (Math.random()-0.5)*60, (Math.random()-0.5)*60);
      const h = CONFIG.tree.height; const y = (Math.random() * h) - (h / 2); const rBase = CONFIG.tree.radius;
      const currentRadius = (rBase * (1 - (y + (h/2)) / h)) + 0.3; const theta = Math.random() * Math.PI * 2;
      const targetPos = new THREE.Vector3(currentRadius * Math.cos(theta), y, currentRadius * Math.sin(theta));
      const color = CONFIG.colors.lights[Math.floor(Math.random() * CONFIG.colors.lights.length)];
      const speed = 2 + Math.random() * 3;
      return { chaosPos, targetPos, color, speed, currentPos: chaosPos.clone(), timeOffset: Math.random() * 100 };
    });
  }, []);

  useFrame((stateObj, delta) => {
    if (!groupRef.current) return;
    const isFormed = state === 'FORMED';
    const time = stateObj.clock.elapsedTime;
    groupRef.current.children.forEach((child, i) => {
      const objData = data[i];
      const target = isFormed ? objData.targetPos : objData.chaosPos;
      objData.currentPos.lerp(target, delta * 2.0);
      const mesh = child as THREE.Mesh;
      mesh.position.copy(objData.currentPos);
      const intensity = (Math.sin(time * objData.speed + objData.timeOffset) + 1) / 2;
      if (mesh.material) { (mesh.material as THREE.MeshStandardMaterial).emissiveIntensity = isFormed ? 3 + intensity * 4 : 0; }
    });
  });

  return (
    <group ref={groupRef}>
      {data.map((obj, i) => ( <mesh key={i} scale={[0.15, 0.15, 0.15]} geometry={geometry}>
          <meshStandardMaterial color={obj.color} emissive={obj.color} emissiveIntensity={0} toneMapped={false} />
        </mesh> ))}
    </group>
  );
};

// --- Component: Top Star (No Photo, Pure Gold 3D Star) ---
const TopStar = ({ state, onClick }: { state: 'CHAOS' | 'FORMED', onClick: () => void }) => {
  const groupRef = useRef<THREE.Group>(null);

  const starShape = useMemo(() => {
    const shape = new THREE.Shape();
    const outerRadius = 1.3; const innerRadius = 0.7; const points = 5;
    for (let i = 0; i < points * 2; i++) {
      const radius = i % 2 === 0 ? outerRadius : innerRadius;
      const angle = (i / (points * 2)) * Math.PI * 2 - Math.PI / 2;
      i === 0 ? shape.moveTo(radius*Math.cos(angle), radius*Math.sin(angle)) : shape.lineTo(radius*Math.cos(angle), radius*Math.sin(angle));
    }
    shape.closePath();
    return shape;
  }, []);

  const starGeometry = useMemo(() => {
    return new THREE.ExtrudeGeometry(starShape, {
      depth: 0.4, // 增加一点厚度
      bevelEnabled: true, bevelThickness: 0.1, bevelSize: 0.1, bevelSegments: 3,
    });
  }, [starShape]);

  // 纯金材质
  const goldMaterial = useMemo(() => new THREE.MeshStandardMaterial({
    color: CONFIG.colors.gold,
    emissive: CONFIG.colors.gold,
    emissiveIntensity: 1.5, // 适中亮度，既发光又有质感
    roughness: 0.1,
    metalness: 1.0,
  }), []);

  useFrame((_, delta) => {
    if (groupRef.current) {
      groupRef.current.rotation.y += delta * 0.5;
      const targetScale = state === 'FORMED' ? 1 : 0;
      groupRef.current.scale.lerp(new THREE.Vector3(targetScale, targetScale, targetScale), delta * 3);
    }
  });

  return (
    <group ref={groupRef} position={[0, CONFIG.tree.height / 2 + 1.8, 0]}>
      <Float speed={2} rotationIntensity={0.2} floatIntensity={0.2}>
        <mesh
          geometry={starGeometry}
          material={goldMaterial}
          onPointerDown={(e) => {
            e.stopPropagation();
            onClick();
          }}
        />
      </Float>
    </group>
  );
};

// --- Main Scene Experience ---
const Experience = ({ sceneState, photoUrls, onStarClick, onPhotoOpen, ornamentsRef, fogColor, isMobile, counts }: { sceneState: 'CHAOS' | 'FORMED', photoUrls: string[], onStarClick: () => void, onPhotoOpen: (p: PhotoOpenPayload) => void, ornamentsRef: React.RefObject<PhotoOrnamentsHandle>, fogColor: string, isMobile: boolean, counts: typeof CONFIG.counts }) => {
  const controlsRef = useRef<any>(null);
  useFrame(() => {
    if (controlsRef.current) controlsRef.current.update();
  });

  return (
    <>
      <PerspectiveCamera makeDefault position={[0, 8, 60]} fov={45} />
      <OrbitControls
        ref={controlsRef}
        enablePan={false}
        enableZoom={true}
        enableDamping
        dampingFactor={0.08}
        minDistance={30}
        maxDistance={120}
        autoRotate={sceneState === 'FORMED'}
        autoRotateSpeed={-0.6}
        maxPolarAngle={Math.PI / 1.7}
      />

      <fog attach="fog" args={[fogColor, 40, 140]} />
      <Stars radius={100} depth={50} count={1200} factor={3.2} saturation={0} fade speed={1} />
      <Environment preset="night" background={false} />

      <ambientLight intensity={0.4} color="#003311" />
      <pointLight position={[30, 30, 30]} intensity={100} color={CONFIG.colors.warmLight} />
      <pointLight position={[-30, 10, -30]} intensity={50} color={CONFIG.colors.gold} />
      <pointLight position={[0, -20, 10]} intensity={30} color="#ffffff" />

      <group position={[0, 8, 0]}>
        {sceneState === 'FORMED' && <Trunk />}
        <Foliage state={sceneState} count={Math.floor(counts.foliage * 0.5)} sizeMultiplier={1.6} />
        <Suspense fallback={null}>
          <PhotoOrnaments ref={ornamentsRef} state={sceneState} photoUrls={photoUrls} onPhotoOpen={onPhotoOpen} ornamentCount={counts.ornaments} />
           <ChristmasElements state={sceneState} count={counts.elements} />
           <FairyLights state={sceneState} count={counts.lights} />
            <TopStar state={sceneState} onClick={onStarClick} />
        </Suspense>
        <Sparkles count={isMobile ? 120 : 220} scale={45} size={6.5} speed={0.32} opacity={0.3} color={CONFIG.colors.silver} />
      </group>

      {!isMobile && (
        <EffectComposer>
          <Bloom luminanceThreshold={0.8} luminanceSmoothing={0.1} intensity={1.3} radius={0.45} mipmapBlur />
        </EffectComposer>
      )}
    </>
  );
};

// --- Gesture Controller ---
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const GestureController = ({ onGesture, onStatus, onPinchStart, onPinchEnd, debugMode }: any) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pinchActiveRef = useRef(false);
  const pinchBlockUntilRef = useRef(0);

  useEffect(() => {
    let gestureRecognizer: GestureRecognizer;
    let requestRef: number;

    const setup = async () => {
      onStatus("DOWNLOADING AI...");
      try {
        const vision = await FilesetResolver.forVisionTasks("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/wasm");
        gestureRecognizer = await GestureRecognizer.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: "https://storage.googleapis.com/mediapipe-models/gesture_recognizer/gesture_recognizer/float16/1/gesture_recognizer.task",
            delegate: "GPU"
          },
          runningMode: "VIDEO",
          numHands: 1
        });
        onStatus("REQUESTING CAMERA...");
        if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
          const stream = await navigator.mediaDevices.getUserMedia({ video: true });
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            videoRef.current.play();
            onStatus("AI READY: SHOW HAND");
            predictWebcam();
          }
        } else {
            onStatus("ERROR: CAMERA PERMISSION DENIED");
        }
      } catch (err: any) {
        onStatus(`ERROR: ${err.message || 'MODEL FAILED'}`);
      }
    };

    const predictWebcam = () => {
      if (gestureRecognizer && videoRef.current && canvasRef.current) {
        if (videoRef.current.videoWidth > 0) {
            const results = gestureRecognizer.recognizeForVideo(videoRef.current, Date.now());
            const ctx = canvasRef.current.getContext("2d");
            if (ctx && debugMode) {
                ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
                canvasRef.current.width = videoRef.current.videoWidth; canvasRef.current.height = videoRef.current.videoHeight;
                if (results.landmarks) for (const landmarks of results.landmarks) {
                        const drawingUtils = new DrawingUtils(ctx);
                        drawingUtils.drawConnectors(landmarks, GestureRecognizer.HAND_CONNECTIONS, { color: "#FFD700", lineWidth: 2 });
                        drawingUtils.drawLandmarks(landmarks, { color: "#FF0000", lineWidth: 1 });
                }
            } else if (ctx && !debugMode) ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);

            let isPinching = false;
            let isGesturing = false;

            // 优先识别握拳/张手手势
            if (results.gestures.length > 0) {
              const name = results.gestures[0][0].categoryName;
              const score = results.gestures[0][0].score;
              if (score > 0.4 && (name === "Open_Palm" || name === "Closed_Fist")) {
                isGesturing = true;
                if (name === "Open_Palm") onGesture("CHAOS");
                if (name === "Closed_Fist") {
                  onGesture("FORMED");
                  pinchBlockUntilRef.current = Date.now() + 700; // 握拳后短暂屏蔽捏合
                }
                if (debugMode) onStatus(`DETECTED: ${name}`);
              }
            }

            if (results.landmarks.length > 0) {
              const hand = results.landmarks[0];
              const pinchBlocked = Date.now() < pinchBlockUntilRef.current;

              // 只在没有握拳/张手手势且不在屏蔽期时才允许捏合
              if (!isGesturing && !pinchBlocked) {
                const thumbTip = hand[4];
                const indexTip = hand[8];
                const wrist = hand[0];
                const indexMcp = hand[5];
                const palmSpan = Math.hypot(indexMcp.x - wrist.x, indexMcp.y - wrist.y) || 1;
                const pinchDistance = Math.hypot(thumbTip.x - indexTip.x, thumbTip.y - indexTip.y);
                isPinching = pinchDistance < Math.max(0.02, palmSpan * 0.4);

                if (isPinching && !pinchActiveRef.current) {
                  pinchActiveRef.current = true;
                  if (onPinchStart) onPinchStart();
                  if (debugMode) onStatus("PINCH: PHOTO MODE");
                } else if (!isPinching && pinchActiveRef.current) {
                  pinchActiveRef.current = false;
                  if (onPinchEnd) onPinchEnd();
                }
              } else if (pinchActiveRef.current) {
                // 如果在捏合状态但检测到手势或屏蔽期，强制结束捏合
                pinchActiveRef.current = false;
                if (onPinchEnd) onPinchEnd();
              }
            } else { 
              if (debugMode) onStatus("AI READY: NO HAND"); 
            }
        }
        requestRef = requestAnimationFrame(predictWebcam);
      }
    };
    setup();
    return () => cancelAnimationFrame(requestRef);
  }, [onGesture, onStatus, onPinchEnd, onPinchStart, debugMode]);

  return (
    <>
      <video ref={videoRef} style={{ opacity: debugMode ? 0.6 : 0, position: 'fixed', top: 0, right: 0, width: debugMode ? '320px' : '1px', zIndex: debugMode ? 100 : -1, pointerEvents: 'none', transform: 'scaleX(-1)' }} playsInline muted autoPlay />
      <canvas ref={canvasRef} style={{ position: 'fixed', top: 0, right: 0, width: debugMode ? '320px' : '1px', height: debugMode ? 'auto' : '1px', zIndex: debugMode ? 101 : -1, pointerEvents: 'none', transform: 'scaleX(-1)' }} />
    </>
  );
};

// --- App Entry ---
export default function GrandTreeApp() {
  const [sceneState, setSceneState] = useState<'CHAOS' | 'FORMED'>('CHAOS');
  const [debugMode, setDebugMode] = useState(false);
  const [backgroundId, setBackgroundId] = useState<string>(DEFAULT_BACKGROUND_ID);
  const [isMobile, setIsMobile] = useState(() => (typeof window !== 'undefined' ? window.innerWidth <= 820 : false));
  const [floatingPhoto, setFloatingPhoto] = useState<{ url: string; phase: 'grab' | 'release'; key: number; origin: { x: number; y: number } } | null>(null);
  const [isPlayingMusic, setIsPlayingMusic] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const ornamentsRef = useRef<PhotoOrnamentsHandle>(null);

  const photoUrls = useMemo(() => (photoAssets.length ? photoAssets : [FALLBACK_PHOTO]), [photoAssets]);

  const counts = useMemo(() => (
    isMobile ? {
      foliage: 12000,
      ornaments: 90,
      elements: 110,
      lights: 120
    } : CONFIG.counts
  ), [isMobile]);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 820);
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const activeBackground = useMemo(() => {
    const found = BACKGROUND_OPTIONS.find(opt => opt.id === backgroundId) || BACKGROUND_OPTIONS[0];
    return found;
  }, [backgroundId]);

  const openPhoto = useCallback((payload: PhotoOpenPayload | null) => {
    if (!payload) return;
    setFloatingPhoto({
      url: payload.url,
      phase: 'grab',
      key: Date.now(),
      origin: payload.screenPosition
    });
  }, []);

  const handlePinchStart = useCallback(() => {
    const picked = ornamentsRef.current?.openRandomPhoto?.();
    if (picked) {
      openPhoto(picked);
      return;
    }
    if (photoUrls.length) {
      openPhoto({ url: photoUrls[Math.floor(Math.random() * photoUrls.length)], screenPosition: { x: window.innerWidth / 2, y: window.innerHeight / 2 } });
    }
  }, [openPhoto, photoUrls]);

  const handlePinchEnd = useCallback(() => {
    setFloatingPhoto((prev) => (prev ? { ...prev, phase: 'release' } : prev));
  }, []);

  const handlePhotoOpen = useCallback((payload: PhotoOpenPayload) => {
    openPhoto(payload);
  }, [openPhoto]);

  const handlePhotoAnimationEnd = () => {
    setFloatingPhoto((prev) => (prev && prev.phase === 'release' ? null : prev));
  };

  const handleStarClick = useCallback(() => {
    if (!musicTracks.length) return;

    if (!audioRef.current) {
      const pick = musicTracks[Math.floor(Math.random() * musicTracks.length)];
      audioRef.current = new Audio(pick);
      audioRef.current.volume = 0.7;
    }

    const player = audioRef.current;
    if (!player) return;

    if (player.paused) {
      // 继续播放 / 重新播放
      if (player.ended) player.currentTime = 0;
      player.play().then(() => setIsPlayingMusic(true)).catch(() => console.warn('音乐播放需要浏览器授权'));
    } else {
      // 暂停
      player.pause();
      setIsPlayingMusic(false);
    }

    player.onended = () => setIsPlayingMusic(false);
  }, [musicTracks]);

  return (
    <div
      className="app-shell"
      style={{
        ['--bg-base' as string]: activeBackground.base,
        ['--bg-overlay' as string]: activeBackground.overlay,
        ['--bg-stars' as string]: activeBackground.stars,
        ['--text-color' as string]: activeBackground.textColor
      }}
    >
      {!isMobile && activeBackground.kind === 'video' && activeBackground.mediaUrl && (
        <video className="bg-media" src={activeBackground.mediaUrl} autoPlay loop muted playsInline />
      )}
      <div className="canvas-wrap">
        <Canvas
          dpr={isMobile ? [1, 1.3] : [1, 2]}
          gl={{
            toneMapping: THREE.ReinhardToneMapping,
            alpha: true,
            antialias: true,
            preserveDrawingBuffer: !isMobile,
            powerPreference: 'high-performance',
            stencil: false,
            depth: true
          }}
          frameloop="always"
          shadows={!isMobile}
          onCreated={({ gl }) => {
            gl.setClearColor(0x000000, 0);
            gl.autoClearColor = true;
            gl.autoClear = true;
            const canvas = gl.getContext()?.canvas as HTMLCanvasElement | undefined;
            if (canvas) {
              canvas.addEventListener('webglcontextlost', (e) => {
                e.preventDefault();
                console.warn('WebGL context lost');
              }, { passive: false });
            }
          }}
        >
            <Experience
              sceneState={sceneState}
              photoUrls={photoUrls}
              onStarClick={handleStarClick}
              onPhotoOpen={handlePhotoOpen}
              ornamentsRef={ornamentsRef}
              fogColor={activeBackground.fogColor}
              isMobile={isMobile}
              counts={counts}
            />
        </Canvas>
      </div>

      <GestureController
        onGesture={setSceneState}
        onStatus={() => {}}
        onPinchStart={handlePinchStart}
        onPinchEnd={handlePinchEnd}
        debugMode={debugMode}
      />

      {/* AI 状态提示移除，避免弹窗干扰移动端体验 */}

      <div className="hud hud--chip" data-active={isPlayingMusic}>
        {isPlayingMusic ? '♫ 正在播放音乐' : '点亮星星播放音乐'}
      </div>

      <div className="hud hud--controls">
        <div className="ui-select">
          <label htmlFor="bg-select">背景</label>
          <select
            id="bg-select"
            value={backgroundId}
            onChange={(e) => setBackgroundId(e.target.value)}
          >
            {BACKGROUND_OPTIONS.map((opt) => (
              <option key={opt.id} value={opt.id}>{opt.label}{opt.kind === 'video' ? ' (视频)' : ''}</option>
            ))}
          </select>
        </div>
        <button className={`ui-button ${debugMode ? 'ui-button--active' : ''}`} onClick={() => setDebugMode(!debugMode)}>
           {debugMode ? '隐藏调试' : '显示调试'}
        </button>
        <button className="ui-button ui-button--primary" onClick={() => setSceneState(s => s === 'CHAOS' ? 'FORMED' : 'CHAOS')}>
           {sceneState === 'CHAOS' ? '组装圣诞树' : '散开雪花'}
        </button>
      </div>

      {floatingPhoto && (
        <div
          key={floatingPhoto.key}
          className={`floating-photo floating-photo--${floatingPhoto.phase}`}
          style={{ ['--from-x' as string]: `${floatingPhoto.origin.x}px`, ['--from-y' as string]: `${floatingPhoto.origin.y}px` }}
          onClick={() => setFloatingPhoto(prev => (prev ? { ...prev, phase: 'release' } : prev))}
          onAnimationEnd={handlePhotoAnimationEnd}
        >
          <div className="floating-photo__card">
            <img src={floatingPhoto.url} alt="随机照片" />
          </div>
        </div>
      )}
    </div>
  );
}