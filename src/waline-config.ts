// Waline 配置
export const WALINE_CONFIG = {
  serverURL: import.meta.env.VITE_WALINE_SERVER_URL || '',
  path: '/christmas-tree',
  lang: 'zh-CN',
  meta: ['nick', 'mail'],
  requiredMeta: ['nick'],
  pageSize: 10,
  wordLimit: 300,
} as const;

// 功能开关配置
const isTrue = (val: string | undefined) => val?.trim() === 'true';

export const FEATURE_FLAGS = {
  enableGestureControl: isTrue(import.meta.env.VITE_ENABLE_GESTURE_CONTROL), // 显式设为 true 才启用
  enableCommentReply: isTrue(import.meta.env.VITE_ENABLE_COMMENT_REPLY), // 显式设为 true 才启用
  showCommentList: false, // 强制不显示评论列表
};

// 密度配置
const parseNumber = (value: string | undefined, defaultValue: number): number => {
  const parsed = parseInt(value || '', 10);
  return isNaN(parsed) ? defaultValue : parsed;
};

export const DENSITY_CONFIG = {
  foliage: parseNumber(import.meta.env.VITE_FOLIAGE_DENSITY, 30000), // 增加树叶密度
  photos: parseNumber(import.meta.env.VITE_PHOTO_DENSITY, 160),
  envelopes: parseNumber(import.meta.env.VITE_ENVELOPE_DENSITY, 50),
  elements: parseNumber(import.meta.env.VITE_ELEMENT_DENSITY, 180),
  lights: parseNumber(import.meta.env.VITE_LIGHT_DENSITY, 200),
};

// 解析浮点数
const parseFloatValue = (value: string | undefined, defaultValue: number): number => {
  const parsed = parseFloat(value || '');
  return isNaN(parsed) ? defaultValue : parsed;
};

// 界面配置
export const UI_CONFIG = {
  treeRotationSpeed: parseFloatValue(import.meta.env.VITE_TREE_ROTATION_SPEED, 1.0),
  showOthersBlessings: import.meta.env.VITE_SHOW_OTHERS_BLESSINGS !== 'false', // 默认true
  showDebugButton: import.meta.env.VITE_SHOW_DEBUG_BUTTON === 'true', // 默认false
  showSenderEmail: import.meta.env.VITE_SHOW_SENDER_EMAIL === 'true', // 默认false
};

export const isWalineConfigured = () => {
  return !!WALINE_CONFIG.serverURL && WALINE_CONFIG.serverURL !== 'https://your-waline-server.example.com';
};
