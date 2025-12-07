import { useEffect, useRef, useCallback } from 'react';
import { GestureRecognizer, FilesetResolver, DrawingUtils } from "@mediapipe/tasks-vision";
import { FEATURE_FLAGS } from './waline-config';

interface GestureControllerProps {
  onGesture: (state: 'CHAOS' | 'FORMED') => void;
  onStatus: (status: string) => void;
  onPinchStart?: () => void;
  onPinchEnd?: () => void;
  onHandMove?: (x: number | null, y: number | null) => void;
  debugMode: boolean;
}

export const GestureController = ({ 
  onGesture, 
  onStatus, 
  onPinchStart, 
  onPinchEnd,
  onHandMove, 
  debugMode 
}: GestureControllerProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const recognizerRef = useRef<GestureRecognizer | null>(null);
  const requestRef = useRef<number>(0);
  const pinchActiveRef = useRef(false);
  const pinchBlockUntilRef = useRef(0);

  // 初始化 AI 模型
  useEffect(() => {
    if (!FEATURE_FLAGS.enableGestureControl) {
      onStatus("GESTURE CONTROL DISABLED");
      return;
    }

    let isMounted = true;

    const initialize = async () => {
      try {
        onStatus("INITIALIZING AI...");
        
        // 使用与 package.json 兼容的 wasm 路径
        const vision = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm"
        );
        
        if (!isMounted) return;

        const recognizer = await GestureRecognizer.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: "https://storage.googleapis.com/mediapipe-models/gesture_recognizer/gesture_recognizer/float16/1/gesture_recognizer.task",
            delegate: "GPU"
          },
          runningMode: "VIDEO",
          numHands: 1,
          minHandDetectionConfidence: 0.5,
          minHandPresenceConfidence: 0.5,
          minTrackingConfidence: 0.5
        });

        if (!isMounted) return;
        
        recognizerRef.current = recognizer;
        onStatus("AI MODEL LOADED");
        
        // 请求摄像头权限
        await startCamera();
        
      } catch (error: any) {
        console.error("Gesture initialization failed:", error);
        if (isMounted) onStatus(`INIT ERROR: ${error.message || 'Unknown error'}`);
      }
    };

    initialize();

    return () => {
      isMounted = false;
      if (recognizerRef.current) {
        recognizerRef.current.close();
        recognizerRef.current = null;
      }
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
      }
      stopCamera();
    };
  }, []);

  const startCamera = async () => {
    try {
      onStatus("REQUESTING CAMERA...");
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          width: 640,
          height: 480,
          frameRate: { ideal: 30 }
        } 
      });
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        // 等待视频元数据加载完成
        videoRef.current.onloadedmetadata = () => {
          if (videoRef.current) {
            videoRef.current.play();
            onStatus("AI READY: SHOW HAND");
            predictWebcam();
          }
        };
      }
    } catch (error: any) {
      console.error("Camera access failed:", error);
      onStatus("CAMERA ERROR: PERMISSION DENIED");
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
  };

  const predictWebcam = useCallback(() => {
    if (!recognizerRef.current || !videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");

    // 确保视频正在播放且有数据
    if (video.readyState === 4 && video.videoWidth > 0) {
      try {
        const startTimeMs = performance.now();
        const results = recognizerRef.current.recognizeForVideo(video, startTimeMs);

        // 绘制调试信息
        if (ctx) {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          if (debugMode) {
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            
            if (results.landmarks) {
              for (const landmarks of results.landmarks) {
                const drawingUtils = new DrawingUtils(ctx);
                drawingUtils.drawConnectors(landmarks, GestureRecognizer.HAND_CONNECTIONS, { color: "#FFD700", lineWidth: 2 });
                drawingUtils.drawLandmarks(landmarks, { color: "#FF0000", lineWidth: 1 });
              }
            }
          } else {
            // 非调试模式保持 canvas 尺寸最小以减少开销
            if (canvas.width !== 1) {
              canvas.width = 1;
              canvas.height = 1;
            }
          }
        }

        // 处理识别结果
        if (results.landmarks.length > 0) {
          const hand = results.landmarks[0];
          
          // 1. 手部位置追踪 (X, Y轴)
          // MediaPipe 坐标: 0 (top/left) -> 1 (bottom/right)
          if (onHandMove) {
            onHandMove(hand[0].x, hand[0].y);
          }

          // 2. 手势识别
          let isGesturing = false;
          if (results.gestures.length > 0) {
            const gesture = results.gestures[0][0];
            const name = gesture.categoryName;
            const score = gesture.score;

            if (score > 0.5) {
              if (name === "Open_Palm") {
                isGesturing = true;
                onGesture("CHAOS");
                if (debugMode) onStatus(`DETECTED: OPEN PALM (${(score*100).toFixed(0)}%)`);
              } else if (name === "Closed_Fist") {
                isGesturing = true;
                onGesture("FORMED");
                pinchBlockUntilRef.current = Date.now() + 1000; // 握拳后屏蔽捏合 1秒
                if (debugMode) onStatus(`DETECTED: FIST (${(score*100).toFixed(0)}%)`);
              }
            }
          }

          // 3. 捏合检测 (仅在未识别出明确手势时)
          const pinchBlocked = Date.now() < pinchBlockUntilRef.current;
          
          // 如果正在做手势（如握拳），强制结束捏合状态
          if (isGesturing) {
             if (pinchActiveRef.current) {
                pinchActiveRef.current = false;
                if (onPinchEnd) onPinchEnd();
             }
          } else if (!pinchBlocked) {
            const thumbTip = hand[4];
            const indexTip = hand[8];
            const wrist = hand[0];
            const indexMcp = hand[5];
            
            // 动态计算手掌大小作为参考
            const palmSize = Math.hypot(indexMcp.x - wrist.x, indexMcp.y - wrist.y) || 0.1;
            const pinchDist = Math.hypot(thumbTip.x - indexTip.x, thumbTip.y - indexTip.y);
            
            // 捏合阈值：手掌大小的 30%
            const isPinching = pinchDist < (palmSize * 0.35);

            if (isPinching) {
              if (!pinchActiveRef.current) {
                pinchActiveRef.current = true;
                if (onPinchStart) onPinchStart();
                if (debugMode) onStatus("ACTION: PINCH");
              }
            } else {
              if (pinchActiveRef.current) {
                pinchActiveRef.current = false;
                if (onPinchEnd) onPinchEnd();
                if (debugMode) onStatus("ACTION: RELEASE");
              }
            }
          }

        } else {
          // 未检测到手
          if (onHandMove) onHandMove(null, null);
          if (debugMode) onStatus("AI RUNNING: NO HAND");
        }

      } catch (err) {
        console.warn("Gesture prediction error:", err);
      }
    }

    requestRef.current = requestAnimationFrame(predictWebcam);
  }, [debugMode, onGesture, onHandMove, onPinchStart, onStatus]);

  return (
    <>
      <video 
        ref={videoRef} 
        style={{ 
          position: 'fixed', 
          top: 0, 
          right: 0, 
          width: debugMode ? '320px' : '1px', 
          opacity: debugMode ? 0.6 : 0,
          zIndex: debugMode ? 100 : -1, 
          pointerEvents: 'none', 
          transform: 'scaleX(-1)' 
        }} 
        playsInline 
        muted 
        autoPlay 
      />
      <canvas 
        ref={canvasRef} 
        style={{ 
          position: 'fixed', 
          top: 0, 
          right: 0, 
          width: debugMode ? '320px' : '1px', 
          height: debugMode ? 'auto' : '1px', 
          zIndex: debugMode ? 101 : -1, 
          pointerEvents: 'none', 
          transform: 'scaleX(-1)' 
        }} 
      />
    </>
  );
};
