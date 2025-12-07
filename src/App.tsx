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
import { photos as photoAssets } from 'virtual:photos';
import { musicTracks } from 'virtual:music';
import { WalineCommentBox, useWalineComments } from './WalineIntegration';
import type { WalineComment } from './WalineIntegration';
import { AuthManager } from './AuthManager';
import { isWalineConfigured, FEATURE_FLAGS, DENSITY_CONFIG, UI_CONFIG } from './waline-config';
import { GestureController } from './GestureController';
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
    foliage: DENSITY_CONFIG.foliage,
    ornaments: DENSITY_CONFIG.photos,
    elements: DENSITY_CONFIG.elements,
    lights: DENSITY_CONFIG.lights
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

// --- Advanced Foliage Shader with Specularity and Depth (参考1.html的高级光影) ---
const FoliageMaterial = shaderMaterial(
  { 
    uTime: 0, 
    uColor: new THREE.Color(CONFIG.colors.emerald), 
    uProgress: 0, 
    sizeMultiplier: 1,
    uCameraPos: new THREE.Vector3(0, 0, 60)
  },
  `uniform float uTime; uniform float uProgress; uniform float sizeMultiplier;
  attribute vec3 aTargetPos; attribute float aRandom;
  varying vec2 vUv; varying float vAlpha; varying float vRandom; varying float vDepth;
  varying vec3 vWorldPos; varying vec3 vNormal;
  
  float cubicInOut(float t) { 
    return t < 0.5 ? 4.0 * t * t * t : 0.5 * pow(2.0 * t - 2.0, 3.0) + 1.0; 
  }
  
  void main() {
    vUv = uv;
    vRandom = aRandom;
    float t = cubicInOut(uProgress);
    
    // 多层次噪声，创建更自然的树叶摆动
    // 散开状态下 (t=0) 增加更多漂浮感
    float floatScale = mix(2.0, 1.0, t);

    vec3 noise = vec3(
      sin(uTime * 0.8 * floatScale + position.x * 0.5) * 0.2 * floatScale,
      cos(uTime * 1.2 * floatScale + position.y * 0.3) * 0.1 * floatScale,
      sin(uTime * 1.5 * floatScale + position.z * 0.4) * 0.2 * floatScale
    );
    
    vec3 finalPos = mix(position, aTargetPos + noise, t);
    vec4 mvPosition = modelViewMatrix * vec4(finalPos, 1.0);
    vDepth = -mvPosition.z;
    
    // 根据随机数调整尺寸，创建密度变化
    // 散开状态下粒子稍微大一点
    float sizeState = mix(1.5, 1.0, t);
    gl_PointSize = (100.0 * (0.8 + aRandom * 0.4) * sizeMultiplier * sizeState) / vDepth;
    gl_Position = projectionMatrix * mvPosition;
    
    vAlpha = mix(0.8, 1.0, t);
    vWorldPos = (modelMatrix * vec4(finalPos, 1.0)).xyz;
    vNormal = normalize(finalPos); // 简化法线计算
  }`,
  `uniform vec3 uColor; uniform float uTime; uniform float uProgress;
  varying float vAlpha;
  varying float vRandom;
  varying float vDepth;
  varying vec3 vWorldPos;
  varying vec3 vNormal;
  
  void main() {
    vec2 center = gl_PointCoord - 0.5;
    float dist = length(center);
    if (dist > 0.5) discard;
    
    // 柔和边缘，增强羽毛效果
    float alpha = smoothstep(0.5, 0.15, dist) * vAlpha;
    
    // ===== 多层次颜色系统 =====
    vec3 darkGreen = vec3(0.01, 0.15, 0.05);    // 更深暗绿
    vec3 midGreen = vec3(0.05, 0.30, 0.10);     // 降低亮度的中等绿
    vec3 brightGreen = vec3(0.15, 0.50, 0.15);  // 纯正绿色，不发白
    vec3 yellowGreen = vec3(0.25, 0.55, 0.10);  // 暗调黄绿
    
    // 星尘颜色 (散开状态)
    vec3 starGold = vec3(1.0, 0.9, 0.5);
    vec3 starPink = vec3(1.0, 0.7, 0.8);
    vec3 starBlue = vec3(0.6, 0.8, 1.0);
    vec3 starWhite = vec3(1.0, 1.0, 1.0);

    // 基于随机值分层 - 树叶
    vec3 leafColor;
    if (vRandom < 0.3) {
      leafColor = mix(darkGreen, midGreen, vRandom / 0.3);
    } else if (vRandom < 0.7) {
      leafColor = mix(midGreen, brightGreen, (vRandom - 0.3) / 0.4);
    } else {
      leafColor = mix(brightGreen, yellowGreen, (vRandom - 0.7) / 0.3);
    }

    // 基于随机值分层 - 星尘
    vec3 chaosColor;
    if (vRandom < 0.25) chaosColor = starGold;
    else if (vRandom < 0.5) chaosColor = starPink;
    else if (vRandom < 0.75) chaosColor = starBlue;
    else chaosColor = starWhite;
    
    // 混合颜色
    vec3 baseColor = mix(chaosColor, leafColor, smoothstep(0.0, 0.8, uProgress));
    
    // ===== 高光和反光效果 =====
    // 模拟粗糙表面的微观高光
    float specHighlight = pow(1.0 - dist, 3.0) * 0.5; // 降低高光基础强度
    // 降低高光强度，特别是树叶状态 (uProgress 接近 1 时大幅降低高光，保留哑光质感)
    float specIntensity = mix(0.8, 0.05, uProgress);
    vec3 specColor = vec3(1.0) * specHighlight * specIntensity;
    
    // 根据深度的逐渐亮化（模拟光线穿透效果）
    float depthFade = smoothstep(80.0, 15.0, vDepth);
    vec3 depthGlow = vec3(0.05, 0.2, 0.05) * depthFade * 0.2; // 降低深度发光
    
    // 散开状态下的发光
    vec3 chaosGlow = chaosColor * 0.6 * (1.0 - uProgress);

    // ===== 闪光效果（基于时间和位置） =====
    float flicker = sin(uTime * 3.0 + vRandom * 6.28) * 0.5 + 0.5;
    float sparkle = pow(flicker, 3.0) * 0.3;
    // 散开时闪烁明显，成树时大幅减弱闪烁，只保留微弱光泽
    sparkle *= mix(2.0, 0.05, uProgress); // 树叶状态几乎不闪烁

    vec3 sparkleColor = vec3(1.0, 0.95, 0.8) * sparkle * 0.4;
    
    // ===== 径向渐变高光 =====
    float radialShine = (1.0 - dist * 1.5) * 0.4;
    // 成树时减弱径向高光
    radialShine *= mix(1.0, 0.0, uProgress);
    
    // 合并所有颜色分量
    vec3 finalColor = baseColor;
    finalColor += specColor;
    finalColor += depthGlow * uProgress;
    finalColor += chaosGlow;
    finalColor += sparkleColor;
    finalColor += vec3(radialShine * 0.1);
    
    gl_FragColor = vec4(finalColor, alpha * 0.95);
  }`
);
extend({ FoliageMaterial });

// --- Helper: Tree Shape ---
const getTreePosition = () => {
  const h = CONFIG.tree.height; const rBase = CONFIG.tree.radius;
  const y = (Math.random() * h) - (h / 2); const normalizedY = (y + (h/2)) / h;
  const currentRadius = rBase * Math.pow(1 - normalizedY, 1.2) * 0.8; // tighter radius with curve
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
  const spherePoints = random.inSphere(new Float32Array(MAX_FOLIAGE * 3), { radius: 45 }) as Float32Array;
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
    const newProgress = MathUtils.damp(mat.uProgress, targetProgress, 0.8, delta);
    
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
    <points raycast={() => null}>
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

type PhotoOrnamentsProps = { state: 'CHAOS' | 'FORMED', photoUrls: string[] };

type EnvelopeOpenPayload = { comment: any; screenPosition: { x: number; y: number } };
type EnvelopeOrnamentsHandle = { openRandomEnvelope: () => EnvelopeOpenPayload | null };
type EnvelopeOrnamentsProps = { state: 'CHAOS' | 'FORMED', comments: any[], onEnvelopeOpen?: (p: EnvelopeOpenPayload) => void };

// --- Component: Photo Ornaments (简化版,仅展示) ---
const PhotoOrnaments = function PhotoOrnamentsComponent(
  props: PhotoOrnamentsProps & { ornamentCount?: number }
) {
  const { state, photoUrls, ornamentCount } = props;
  const textures = useTexture(photoUrls);
  const count = ornamentCount ?? CONFIG.counts.ornaments;
  const groupRef = useRef<THREE.Group>(null);

  const photoGeometry = useMemo(() => new THREE.PlaneGeometry(1, 1), []);

  const data = useMemo(() => {
    return new Array(count).fill(0).map((_, i) => {
      const chaosPos = new THREE.Vector3((Math.random()-0.5)*70, (Math.random()-0.5)*70, (Math.random()-0.5)*70);
      const h = CONFIG.tree.height; const y = (Math.random() * h) - (h / 2);
      const rBase = CONFIG.tree.radius;
      const baseRadius = (rBase * (1 - (y + (h/2)) / h)) + 0.5;
      const currentRadius = baseRadius * 0.82 + 0.2;
      const theta = Math.random() * Math.PI * 2;
      const targetPos = new THREE.Vector3(currentRadius * Math.cos(theta), y, currentRadius * Math.sin(theta));

      const isBig = Math.random() < 0.2;
      const baseScale = isBig ? 2.2 : 0.8 + Math.random() * 0.6;
      const weight = 0.8 + Math.random() * 1.2;

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

  return (
    <group ref={groupRef}>
      {data.map((obj, i) => (
        <group
          key={i}
          scale={[obj.scale, obj.scale, obj.scale]}
          rotation={state === 'CHAOS' ? obj.chaosRotation : [0,0,0]}
        >
          <mesh geometry={photoGeometry}>
            <meshBasicMaterial map={textures[obj.textureIndex]} side={THREE.DoubleSide} transparent opacity={0.95} />
          </mesh>
        </group>
      ))}
    </group>
  );
};

// --- Component: Envelope Ornaments (信封祝福) ---
const EnvelopeOrnaments = forwardRef(function EnvelopeOrnamentsComponent(
  props: EnvelopeOrnamentsProps & { ornamentCount?: number },
  ref: React.ForwardedRef<EnvelopeOrnamentsHandle>
) {
  const { state, comments, onEnvelopeOpen, ornamentCount } = props;
  // 使用配置的信封数量，如果评论为空则也显示信封（占位符模式）
  const count = ornamentCount ?? 50;
  const groupRef = useRef<THREE.Group>(null);
  const { camera } = useThree();

  const envelopeGeometry = useMemo(() => new THREE.BoxGeometry(1.6, 1.0, 0.06), []);
  const flapGeometry = useMemo(() => {
    const shape = new THREE.Shape();
    shape.moveTo(-0.8, 0);
    shape.lineTo(0, 0.55);
    shape.lineTo(0.8, 0);
    shape.lineTo(-0.8, 0);
    return new THREE.ShapeGeometry(shape);
  }, []);

  const projectToScreen = useCallback((pos: THREE.Vector3) => {
    const projected = pos.clone().project(camera);
    const width = typeof window !== 'undefined' ? window.innerWidth : 1;
    const height = typeof window !== 'undefined' ? window.innerHeight : 1;
    return {
      x: (projected.x * 0.5 + 0.5) * width,
      y: (-projected.y * 0.5 + 0.5) * height
    };
  }, [camera]);

  const data = useMemo(() => {
    if (count === 0) return [];
    return new Array(count).fill(0).map((_, i) => {
      const chaosPos = new THREE.Vector3((Math.random()-0.5)*70, (Math.random()-0.5)*70, (Math.random()-0.5)*70);
      const h = CONFIG.tree.height; const y = (Math.random() * h) - (h / 2);
      const rBase = CONFIG.tree.radius;
      const baseRadius = (rBase * (1 - (y + (h/2)) / h)) + 0.5;
      const currentRadius = baseRadius * 0.75 + 0.3;
      const theta = Math.random() * Math.PI * 2;
      const targetPos = new THREE.Vector3(currentRadius * Math.cos(theta), y, currentRadius * Math.sin(theta));

      const baseScale = 0.6 + Math.random() * 0.4;
      const weight = 0.8 + Math.random() * 1.2;
      const envelopeColor = ['#FFE4E1', '#FFF8DC', '#F0E68C', '#E6E6FA', '#FFB6C1'][Math.floor(Math.random() * 5)];

      const rotationSpeed = {
        x: (Math.random() - 0.5) * 0.8,
        y: (Math.random() - 0.5) * 0.8,
        z: (Math.random() - 0.5) * 0.8
      };
      const tilt = {
        x: (Math.random() - 0.5) * 0.3,
        y: (Math.random() - 0.5) * 0.5,
        z: (Math.random() - 0.5) * 0.3
      };
      const chaosRotation = new THREE.Euler(Math.random()*Math.PI, Math.random()*Math.PI, Math.random()*Math.PI);

      return {
        chaosPos, targetPos, scale: baseScale, weight,
        // 如果没有评论，commentIndex 设为 -1 表示无效
        commentIndex: comments.length > 0 ? i % comments.length : -1,
        envelopeColor,
        currentPos: chaosPos.clone(),
        chaosRotation,
        rotationSpeed,
        wobbleOffset: Math.random() * 10,
        wobbleSpeed: 0.5 + Math.random() * 0.5,
        tilt
      };
    });
  }, [comments, count]);

  useFrame((stateObj, delta) => {
    if (!groupRef.current) return;
    const isFormed = state === 'FORMED';
    const time = stateObj.clock.elapsedTime;

    groupRef.current.children.forEach((group, i) => {
      if (i >= data.length) return;
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

  const openFromGroup = useCallback((mesh: THREE.Object3D, commentIndex: number) => {
    // 如果没有评论，不打开信封
    if (commentIndex < 0 || comments.length === 0) return;

    // 确保矩阵最新
    mesh.updateMatrixWorld(true);

    // 直接取被点击 mesh 的世界坐标，避免 parent 偏差
    const worldPos = new THREE.Vector3();
    mesh.getWorldPosition(worldPos);
    const screenPosition = projectToScreen(worldPos);
    const comment = comments[commentIndex % comments.length];

    console.log('Envelope clicked:', { index: commentIndex, worldPos, screenPosition });

    // 触发信封打开动画，从信封位置飞往中心
    onEnvelopeOpen?.({ comment, screenPosition });
  }, [comments, projectToScreen, onEnvelopeOpen]);

  useImperativeHandle(ref, () => ({
    openRandomEnvelope: () => {
      if (!groupRef.current || !groupRef.current.children.length || comments.length === 0) return null;
      const child = groupRef.current.children[Math.floor(Math.random() * groupRef.current.children.length)];
      const commentIndex = (child as any).userData?.commentIndex ?? -1;
      
      // 如果没有有效评论，返回 null
      if (commentIndex < 0 || comments.length === 0) return null;
      
      // 确保矩阵最新
      groupRef.current.updateMatrixWorld(true);
      child.updateMatrixWorld(true);

      const worldPos = new THREE.Vector3();
      child.getWorldPosition(worldPos);
      return {
        comment: comments[commentIndex % comments.length],
        screenPosition: projectToScreen(worldPos)
      };
    }
  }), [comments, projectToScreen]);

  if (count === 0) return null;

  return (
    <group ref={groupRef}>
      {data.map((obj, i) => (
        <group
          key={i}
          scale={[obj.scale, obj.scale, obj.scale]}
          rotation={state === 'CHAOS' ? obj.chaosRotation : [0,0,0]}
          userData={{ commentIndex: obj.commentIndex }}
          onClick={(e) => {
            e.stopPropagation();
            openFromGroup(e.object, obj.commentIndex);
          }}
        >
          {/* 信封主体 (3D 盒子) */}
          <mesh 
            geometry={envelopeGeometry} 
            position={[0, 0, 0]}
          >
            <meshStandardMaterial 
              color={obj.envelopeColor} 
              roughness={0.3} 
              metalness={0.1}
              emissive={obj.envelopeColor}
              emissiveIntensity={0.05}
            />
          </mesh>
          {/* 信封封口 */}
          <mesh 
            geometry={flapGeometry} 
            position={[0, 0.25, 0.031]}
          >
            <meshStandardMaterial 
              color={obj.envelopeColor}
              roughness={0.3} 
              metalness={0.1}
              emissive={obj.envelopeColor}
              emissiveIntensity={0.05}
            />
          </mesh>
          {/* 火漆印装饰 (扁平球体模拟) */}
          <mesh 
            position={[0, 0, 0.04]}
            scale={[1, 1, 0.5]}
          >
            <sphereGeometry args={[0.18, 32, 16]} />
            <meshStandardMaterial 
              color="#C62828" 
              emissive="#B71C1C"
              emissiveIntensity={0.2}
              roughness={0.2}
              metalness={0.3}
            />
          </mesh>
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
          <meshStandardMaterial 
            color={obj.color} 
            roughness={0.2} 
            metalness={0.6} 
            emissive={obj.color} 
            emissiveIntensity={0.3}
          />
        </mesh> )})}
    </group>
  );
};

const Trunk = () => {
  const geometry = useMemo(() => new THREE.CylinderGeometry(1.4, 1.6, 6, 16), []);
  return (
    <mesh position={[0, -(CONFIG.tree.height / 2) - 3, 0]} geometry={geometry} receiveShadow castShadow>
      <meshStandardMaterial 
        color="#6B4423" 
        roughness={0.9} 
        metalness={0.05}
        emissive="#4a2f1a"
        emissiveIntensity={0.1}
      />
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
      if (mesh.material) { 
        (mesh.material as THREE.MeshStandardMaterial).emissiveIntensity = isFormed ? 4 + intensity * 6 : 0; 
      }
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

// --- Component: Spiral Light Strip (螺旋灯带) ---
const SpiralLightStrip = ({ state, isLit }: { state: 'CHAOS' | 'FORMED', isLit: boolean }) => {
  const groupRef = useRef<THREE.Group>(null);
  const meshRef = useRef<THREE.Mesh>(null);

  // 生成螺旋路径
  const spiralPoints = useMemo(() => {
    const points: THREE.Vector3[] = [];
    const height = CONFIG.tree.height;
    const turns = 8; // 螺旋圈数
    const segments = 200; // 路径点数

    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      const y = (t * height) - (height / 2);
      const angle = t * Math.PI * 2 * turns;
      const rBase = CONFIG.tree.radius;
      const radius = (rBase * (1 - (y + (height/2)) / height)) * 0.85;
      
      const x = radius * Math.cos(angle);
      const z = radius * Math.sin(angle);
      points.push(new THREE.Vector3(x, y, z));
    }
    return points;
  }, []);

  const curve = useMemo(() => new THREE.CatmullRomCurve3(spiralPoints), [spiralPoints]);
  const tubeGeometry = useMemo(() => new THREE.TubeGeometry(curve, 200, 0.08, 8, false), [curve]);

  useFrame((stateObj) => {
    if (meshRef.current && state === 'FORMED') {
      const time = stateObj.clock.elapsedTime;
      const material = meshRef.current.material as THREE.MeshStandardMaterial;
      if (isLit) {
        // 点亮时：流动的彩色效果，更强烈的脉动
        const intensity = 3.5 + Math.sin(time * 4) * 1.5;
        material.emissiveIntensity = intensity;
        material.roughness = 0.1;
        material.metalness = 0.9;
      } else {
        // 未点亮时：微妙的呼吸效果 + 金属光泽
        const breathe = Math.sin(time * 0.5) * 0.15 + 0.35;
        material.emissiveIntensity = breathe;
        material.roughness = 0.2;
        material.metalness = 0.85;
      }
    }
    
    if (groupRef.current) {
      const targetScale = state === 'FORMED' ? 1 : 0;
      groupRef.current.scale.lerp(new THREE.Vector3(targetScale, targetScale, targetScale), 0.05);
    }
  });

  const lightColor = isLit ? '#FFD700' : '#C9A961';  // 点亮时金黄，未点亮时古铜金
  const emissiveColor = isLit ? '#FFD700' : '#8B7355'; // 未点亮时更暗的发光色

  return (
    <group ref={groupRef}>
      <mesh ref={meshRef} geometry={tubeGeometry}>
        <meshStandardMaterial
          color={lightColor}
          emissive={emissiveColor}
          emissiveIntensity={isLit ? 3.5 : 0.35}
          toneMapped={false}
          roughness={isLit ? 0.1 : 0.2}
          metalness={isLit ? 0.9 : 0.85}
        />
      </mesh>
    </group>
  );
};

// --- Component: Top Star (No Photo, Pure Gold 3D Star) ---
const TopStar = ({ state, onClick, isLit }: { state: 'CHAOS' | 'FORMED', onClick: () => void, isLit: boolean }) => {
  const groupRef = useRef<THREE.Group>(null);
  const materialRef = useRef<THREE.MeshStandardMaterial>(null);

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
      depth: 0.4,
      bevelEnabled: true, bevelThickness: 0.1, bevelSize: 0.1, bevelSegments: 3,
    });
  }, [starShape]);

  useFrame((stateObj, delta) => {
    if (groupRef.current) {
      groupRef.current.rotation.y += delta * 0.5;
      const targetScale = state === 'FORMED' ? 1 : 0;
      groupRef.current.scale.lerp(new THREE.Vector3(targetScale, targetScale, targetScale), delta * 3);
    }
    
    if (materialRef.current) {
      const time = stateObj.clock.elapsedTime;
      if (isLit) {
        // 点亮时：闪耀效果
        const intensity = 2 + Math.sin(time * 4) * 0.8;
        materialRef.current.emissiveIntensity = intensity;
      } else {
        // 未点亮时：柔和发光
        materialRef.current.emissiveIntensity = 0.6;
      }
    }
  });

  return (
    <group ref={groupRef} position={[0, CONFIG.tree.height / 2 + 1.8, 0]}>
      <Float speed={2} rotationIntensity={0.2} floatIntensity={0.2}>
        <mesh
          geometry={starGeometry}
          onPointerDown={(e) => {
            e.stopPropagation();
            onClick();
          }}
        >
          <meshStandardMaterial
            ref={materialRef}
            color={CONFIG.colors.gold}
            emissive={CONFIG.colors.gold}
            emissiveIntensity={isLit ? 2 : 0.6}
            roughness={0.1}
            metalness={1.0}
          />
        </mesh>
      </Float>
    </group>
  );
};

// --- Main Scene Experience ---
const Experience = ({ 
  sceneState, 
  photoUrls, 
  onStarClick, 
  envelopesRef,
  comments,
  onEnvelopeOpen,
  fogColor, 
  isMobile, 
  counts,
  isLightStripLit,
  handYRef
}: { 
  sceneState: 'CHAOS' | 'FORMED', 
  photoUrls: string[], 
  onStarClick: () => void, 
  envelopesRef: React.RefObject<EnvelopeOrnamentsHandle>,
  comments: any[],
  onEnvelopeOpen: (p: EnvelopeOpenPayload) => void,
  fogColor: string, 
  isMobile: boolean, 
  counts: typeof CONFIG.counts,
  isLightStripLit: boolean,
  handYRef: React.MutableRefObject<number | null>
}) => {
  const controlsRef = useRef<any>(null);
  const groupRef = useRef<THREE.Group>(null);
  
  useFrame((_state, delta) => {
    if (controlsRef.current) controlsRef.current.update();
    
    if (groupRef.current) {
      // 默认位置
      let targetY = 8;
      
      // 如果检测到手势，根据手的位置调整 Y 轴
      // handYRef.current 范围 0 (top) -> 1 (bottom)
      // 映射: 0 -> 20, 1 -> -4 (范围 24)
      if (handYRef.current !== null) {
        // 反转 Y 轴，手向上 (0) 树向上，手向下 (1) 树向下
        const offset = (0.5 - handYRef.current) * 35;
        targetY = 8 + offset;
      }
      
      // 平滑移动
      groupRef.current.position.y = MathUtils.damp(groupRef.current.position.y, targetY, 2.5, delta);
    }
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
        autoRotate={sceneState === 'FORMED' && UI_CONFIG.treeRotationSpeed > 0}
        autoRotateSpeed={-0.6 * UI_CONFIG.treeRotationSpeed}
        maxPolarAngle={Math.PI / 1.7}
      />

      <fog attach="fog" args={[fogColor, 40, 140]} />
      <Stars radius={100} depth={50} count={1200} factor={3.2} saturation={0} fade speed={1} />
      <Environment preset="night" background={false} />

      {/* 增强光源系统 - 参考1.html的多光源设计 */}
      <ambientLight intensity={0.5} color="#003311" />
      
      {/* 主内部光源（树内部的温暖光） */}
      <pointLight position={[0, 5, 0]} intensity={120} color="#ffaa00" distance={25} decay={2} />
      
      {/* 金色聚光（侧边高光） */}
      <pointLight position={[30, 30, 30]} intensity={100} color={CONFIG.colors.warmLight} decay={2} />
      
      {/* 蓝色补光（冷色调平衡） */}
      <pointLight position={[-30, 10, -30]} intensity={60} color="#6688ff" decay={2} />
      
      {/* 底部填光（白光） */}
      <pointLight position={[0, -20, 10]} intensity={40} color="#ffffff" decay={2} />

      <group ref={groupRef} position={[0, 8, 0]}>
        {sceneState === 'FORMED' && <Trunk />}
        <Foliage state={sceneState} count={Math.floor(counts.foliage * 0.7)} sizeMultiplier={1.8} />
        <Foliage state={sceneState} count={Math.floor(counts.foliage * 0.3)} sizeMultiplier={1.2} />
        <Suspense fallback={null}>
          <PhotoOrnaments state={sceneState} photoUrls={photoUrls} ornamentCount={counts.ornaments} />
          <EnvelopeOrnaments ref={envelopesRef} state={sceneState} comments={comments} onEnvelopeOpen={onEnvelopeOpen} ornamentCount={DENSITY_CONFIG.envelopes} />
          <ChristmasElements state={sceneState} count={counts.elements} />
          <FairyLights state={sceneState} count={counts.lights} />
          <SpiralLightStrip state={sceneState} isLit={isLightStripLit} />
          <TopStar state={sceneState} onClick={onStarClick} isLit={isLightStripLit} />
        </Suspense>
        <Sparkles count={isMobile ? 120 : 220} scale={45} size={6.5} speed={0.32} opacity={0.3} color={CONFIG.colors.silver} raycast={() => null} />
      </group>

      {!isMobile && (
        <EffectComposer>
          {/* 增强Bloom以突出闪光和反光效果 */}
          <Bloom 
            luminanceThreshold={0.7} 
            luminanceSmoothing={0.08} 
            intensity={1.8} 
            radius={0.6} 
            mipmapBlur 
          />
        </EffectComposer>
      )}
    </>
  );
};

// --- Gesture Controller ---
// (Moved to src/GestureController.tsx)

// --- App Entry ---
export default function GrandTreeApp() {
  const [sceneState, setSceneState] = useState<'CHAOS' | 'FORMED'>('CHAOS');
  const [debugMode, setDebugMode] = useState(false);
  const [backgroundId, setBackgroundId] = useState<string>(DEFAULT_BACKGROUND_ID);
  const [isMobile, setIsMobile] = useState(() => (typeof window !== 'undefined' ? window.innerWidth <= 820 : false));
  const [isPlayingMusic, setIsPlayingMusic] = useState(false);
  const [showCommentBox, setShowCommentBox] = useState(false);
  const [floatingComment, setFloatingComment] = useState<{ comment: any; phase: 'show' | 'hide'; key: number; origin: { x: number; y: number } } | null>(null);
  const [isAnimating, setIsAnimating] = useState(false); // 防止手势冲突
  const [replyToComment, setReplyToComment] = useState<WalineComment | null>(null);
  const [showAuthManager, setShowAuthManager] = useState(false);
  const [isLightStripLit, setIsLightStripLit] = useState(false); // 灯带是否点亮
  // 用户认证状态（用于未来功能扩展，如显示当前用户）
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [userAuth, setUserAuth] = useState<{ nick: string; mail: string } | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const envelopesRef = useRef<EnvelopeOrnamentsHandle>(null);
  const handYRef = useRef<number | null>(null);

  // Waline 评论集成
  const { comments, count: commentCount, getRandomComment, fetchComments } = useWalineComments();
  const walineEnabled = isWalineConfigured();

  // 恢复登录状态
  useEffect(() => {
    const savedAuth = localStorage.getItem('waline_auth');
    if (savedAuth) {
      try {
        const auth = JSON.parse(savedAuth);
        setUserAuth(auth);
        console.log('已自动恢复登录状态:', auth.nick);
      } catch {
        localStorage.removeItem('waline_auth');
      }
    }
  }, []);

  // 调试信息
  useEffect(() => {
    console.log('=== Waline 配置检查 ===');
    console.log('- 环境变量:', import.meta.env.VITE_WALINE_SERVER_URL);
    console.log('- walineEnabled:', walineEnabled);
    console.log('- commentCount:', commentCount);
    console.log('- comments数组长度:', comments.length);
    console.log('- comments数据:', comments);
    console.log('- DENSITY_CONFIG.envelopes:', DENSITY_CONFIG.envelopes);
    console.log('- 信封配置数量（固定显示）:', DENSITY_CONFIG.envelopes);
    console.log('- 信封是否有评论关联:', comments.length > 0 ? `是 (${comments.length} 条)` : '否（显示占位符信封）');
    console.log('- 当前登录用户:', userAuth?.nick || '未登录');
  }, [walineEnabled, commentCount, comments, userAuth]);

  const photoUrls = useMemo(() => (photoAssets.length ? photoAssets : [FALLBACK_PHOTO]), [photoAssets]);

  const counts = useMemo(() => {
    // 基础配置数量
    const baseConfig = isMobile ? {
      foliage: 16000,
      ornaments: 90,
      elements: 110,
      lights: 120
    } : CONFIG.counts;

    // 自动调整照片挂件数量：
    // 1. 至少显示所有照片 (photoUrls.length)
    // 2. 至少达到基础密度 (baseConfig.ornaments)
    // 这样如果照片少，会重复显示以保证美观；如果照片多，会全部显示
    const adjustedOrnaments = Math.max(baseConfig.ornaments, photoUrls.length);

    return {
      ...baseConfig,
      ornaments: adjustedOrnaments
    };
  }, [isMobile, photoUrls.length]);

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

  const handleStarClick = useCallback(() => {
    // 切换灯带状态
    setIsLightStripLit(prev => !prev);
    
    // 播放音乐
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

  // 随机抽取评论
  const handleRandomComment = useCallback(() => {
    // 防止动画期间重复操作
    if (isAnimating) return;
    
    setIsAnimating(true);

    // 如果配置为不显示其他人的祝福，则只显示自己的
    if (!UI_CONFIG.showOthersBlessings) {
      const savedAuth = localStorage.getItem('waline_auth');
      if (savedAuth) {
        try {
          const auth = JSON.parse(savedAuth);
          const myComments = comments.filter(c => c.mail === auth.mail);
          if (myComments.length === 0) {
            setIsAnimating(false);
            alert('你还没有发送祝福，快来发送第一条吧！');
            return;
          }
          const randomComment = myComments[Math.floor(Math.random() * myComments.length)];
          setFloatingComment({
            comment: randomComment,
            phase: 'show',
            key: Date.now(),
            origin: { x: window.innerWidth / 2, y: window.innerHeight / 2 }
          });
          setTimeout(() => setIsAnimating(false), 1000);
          return;
        } catch {
          setIsAnimating(false);
          alert('请先登录后查看你的祝福');
          return;
        }
      } else {
        setIsAnimating(false);
        alert('请先登录后查看你的祝福');
        return;
      }
    }
    
    // 优先从树上的信封中抽取（带位置信息）
    const picked = envelopesRef.current?.openRandomEnvelope?.();
    if (picked) {
      setFloatingComment({
        comment: picked.comment,
        phase: 'show',
        key: Date.now(),
        origin: picked.screenPosition
      });
      setTimeout(() => setIsAnimating(false), 1000);
      return;
    }
    // 降级方案：直接从评论列表随机选择
    const randomComment = getRandomComment();
    if (!randomComment) {
      setIsAnimating(false);
      alert('暂无评论，快来发送第一条祝福吧！');
      return;
    }
    setFloatingComment({
      comment: randomComment,
      phase: 'show',
      key: Date.now(),
      origin: { x: window.innerWidth / 2, y: window.innerHeight / 2 }
    });
    setTimeout(() => setIsAnimating(false), 1000);
  }, [getRandomComment, isAnimating, comments]);

  const handlePinchStart = useCallback(() => {
    // 捏合手势改为抽取祝福
    handleRandomComment();
  }, [handleRandomComment]);

  // 评论框关闭后刷新评论
  const handleCommentBoxClose = useCallback(() => {
    setShowCommentBox(false);
    setReplyToComment(null);
  }, []);

  const handleCommentSuccess = useCallback(() => {
    fetchComments();
  }, [fetchComments]);

  const handleWriteComment = useCallback(() => {
    // 检查是否已登录，如果已登录则更新状态
    const savedAuth = localStorage.getItem('waline_auth');
    if (savedAuth) {
      try {
        const auth = JSON.parse(savedAuth);
        setUserAuth(auth);
        console.log('已恢复登录状态:', auth.nick);
      } catch {
        // 忽略错误
      }
    }
    setShowCommentBox(true);
  }, []);

  // 处理回复评论
  const handleReplyToComment = useCallback((comment: WalineComment) => {
    if (!FEATURE_FLAGS.enableCommentReply) return;
    setReplyToComment(comment);
    setShowCommentBox(true);
    setFloatingComment(null);
  }, []);

  const handleCommentAnimationEnd = () => {
    // 动画结束时清除状态
    if (floatingComment?.phase === 'hide') {
      setFloatingComment(null);
    }
  };

  const handleEnvelopeOpen = useCallback((payload: EnvelopeOpenPayload) => {
    setFloatingComment({
      comment: payload.comment,
      phase: 'show',
      key: Date.now(),
      origin: payload.screenPosition
    });
    // 用户需要手动关闭，不自动消失
  }, []);

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
              envelopesRef={envelopesRef}
              comments={comments}
              onEnvelopeOpen={handleEnvelopeOpen}
              fogColor={activeBackground.fogColor}
              isMobile={isMobile}
              counts={counts}
              isLightStripLit={isLightStripLit}
              handYRef={handYRef}
            />
        </Canvas>
      </div>

      <GestureController
        onGesture={setSceneState}
        onStatus={(msg: string) => console.log('[Gesture]', msg)}
        onPinchStart={handlePinchStart}
        onHandMove={(y: number | null) => { handYRef.current = y; }}
        debugMode={debugMode}
      />

      {/* AI 状态提示移除，避免弹窗干扰移动端体验 */}

      <div className="hud hud--chip" data-active={isPlayingMusic}>
        {isPlayingMusic ? '♫ 正在播放音乐' : '点亮星星播放音乐'}
      </div>

      {/* 调试信息 */}
      {debugMode && (
        <div style={{ position: 'fixed', top: '60px', left: '10px', background: 'rgba(0,0,0,0.8)', color: 'white', padding: '10px', fontSize: '12px', zIndex: 1000, borderRadius: '8px', maxWidth: '300px' }}>
          <div><strong>Waline 配置:</strong></div>
          <div>ENV: {import.meta.env.VITE_WALINE_SERVER_URL || 'undefined'}</div>
          <div>Enabled: {walineEnabled ? 'YES' : 'NO'}</div>
          <div>Count: {commentCount}</div>
          <div>评论数组长度: {comments.length}</div>
          <div>信封密度配置: {DENSITY_CONFIG.envelopes}</div>
          <div>实际信封数: {Math.min(DENSITY_CONFIG.envelopes, comments.length)}</div>
          <div style={{ marginTop: '8px' }}><strong>功能开关:</strong></div>
          <div>手势控制: {FEATURE_FLAGS.enableGestureControl ? '✅' : '❌'} ({import.meta.env.VITE_ENABLE_GESTURE_CONTROL})</div>
          <div>评论回复: {FEATURE_FLAGS.enableCommentReply ? '✅' : '❌'} ({import.meta.env.VITE_ENABLE_COMMENT_REPLY})</div>
          <div>评论列表: {FEATURE_FLAGS.showCommentList ? '✅' : '❌'} (强制false)</div>
          <div style={{ marginTop: '8px' }}><strong>密度配置:</strong></div>
          <div>树叶: {DENSITY_CONFIG.foliage}</div>
          <div>照片: {DENSITY_CONFIG.photos}</div>
          <div>信封: {DENSITY_CONFIG.envelopes}</div>
          <div>元素: {DENSITY_CONFIG.elements}</div>
          <div>彩灯: {DENSITY_CONFIG.lights}</div>
        </div>
      )}

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
        {UI_CONFIG.showDebugButton && (
          <button className={`ui-button ${debugMode ? 'ui-button--active' : ''}`} onClick={() => setDebugMode(!debugMode)}>
             {debugMode ? '隐藏调试' : '显示调试'}
          </button>
        )}
        <button className="ui-button ui-button--primary" onClick={() => setSceneState(s => s === 'CHAOS' ? 'FORMED' : 'CHAOS')}>
           {sceneState === 'CHAOS' ? '组装圣诞树' : '散开雪花'}
        </button>
        {walineEnabled && (
          <>
            <button className="ui-button ui-button--comment" onClick={handleWriteComment} title="写圣诞祝福">
              💌 写祝福
            </button>
            <button className="ui-button ui-button--random-comment" onClick={handleRandomComment} title="随机抽取祝福" disabled={commentCount === 0}>
              🎄 抽祝福
            </button>
            <button className="ui-button ui-button--auth" onClick={() => setShowAuthManager(true)} title="登录查看我的祝福">
              👤 我的
            </button>
          </>
        )}
      </div>

      {floatingComment && (
        <>
          {/* 背景遮罩，点击关闭 */}
          <div
            className="floating-comment-overlay"
            onClick={() => setFloatingComment(prev => prev ? { ...prev, phase: 'hide' } : null)}
          />
          <div
            key={floatingComment.key}
            className={`floating-comment floating-comment--${floatingComment.phase}`}
            style={{ ['--from-x' as string]: `${floatingComment.origin.x}px`, ['--from-y' as string]: `${floatingComment.origin.y}px` }}
            onAnimationEnd={handleCommentAnimationEnd}
          >
            <div className="floating-comment__card">
              <div className="floating-comment__avatar">
                {floatingComment.comment.avatar ? (
                  <img src={floatingComment.comment.avatar} alt={floatingComment.comment.nick} />
                ) : (
                  <div className="floating-comment__avatar-placeholder">
                    {floatingComment.comment.nick?.charAt(0).toUpperCase() || '🎄'}
                  </div>
                )}
              </div>
              <div className="floating-comment__content">
                <div className="floating-comment__text" dangerouslySetInnerHTML={{ __html: floatingComment.comment.comment }} />
                <div className="floating-comment__author">
                  — {floatingComment.comment.nick}
                  {UI_CONFIG.showSenderEmail && floatingComment.comment.mail && (
                    <span style={{ fontSize: '0.85em', color: '#999', marginLeft: '8px' }}>
                      ({floatingComment.comment.mail})
                    </span>
                  )}
                </div>
                {FEATURE_FLAGS.enableCommentReply && (
                  <button 
                    className="floating-comment__reply-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleReplyToComment(floatingComment.comment);
                    }}
                  >
                    💌 回复祝福
                  </button>
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {showAuthManager && (
        <AuthManager onClose={() => setShowAuthManager(false)} />
      )}

      {showCommentBox && walineEnabled && (
        <WalineCommentBox onClose={handleCommentBoxClose} onSuccess={handleCommentSuccess} replyTo={replyToComment} />
      )}
    </div>
  );
}