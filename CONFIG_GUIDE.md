# ⚙️ 功能配置说明

## ⚠️ 重要提示

**修改 `.env` 文件后必须重启开发服务器才能生效！**

1. 停止服务器: `Ctrl+C`
2. 重新启动: `npm run dev`
3. 刷新浏览器页面

## 环境变量配置

在项目根目录的 `.env` 文件中，你可以配置以下选项：

### 1. Waline 服务器地址（必填）

```env
VITE_WALINE_SERVER_URL=https://your-waline-server.example.com
```

填写你部署的 Waline 服务器地址。如果不配置，评论相关功能将不显示。

---

### 2. 手势控制开关

```env
VITE_ENABLE_GESTURE_CONTROL=false
```

**选项：**
- `true` - 启用手势控制
- `false` - 禁用手势控制（默认）

**注意**: **现在只有显式设置为 `true` 才会启用**，不设置或设为其他值均为禁用。

**说明：**
- 启用后可以通过摄像头捕捉手势来控制圣诞树
- 张开手掌 + 握拳 = 抽取照片
- 禁用可以减少性能消耗，避免与点击操作冲突

---

### 3. 评论回复功能

```env
VITE_ENABLE_COMMENT_REPLY=true
```

**选项：**
- `true` - 允许回复评论
- `false` - 禁用回复功能（默认）

**注意**: **现在只有显式设置为 `true` 才会启用**。

**说明：**
- 启用后，抽取祝福卡片上会显示"💌 回复祝福"按钮
- 点击按钮可以回复该祝福
- 禁用后界面更简洁，只能发送新的祝福

---

### 4. 显示评论列表

```env
VITE_SHOW_COMMENT_LIST=false
```

**选项：**
- `true` - 显示评论列表
- `false` - 隐藏评论列表（默认）

**注意**: **现在只有显式设置为 `true` 才会显示**。

**说明：**
- 启用后在发祝福页面会显示所有人的祝福
- 禁用后只显示输入框，界面更简洁
- 用户写的祝福依然会保存，只是不在发送页面显示

---

### 5. 密度配置

控制各种元素在圣诞树上的数量，数值为整数。

```env
# 粒子密度（树叶）- 默认20000，建议范围：5000-30000
VITE_FOLIAGE_DENSITY=20000

# 照片密度（拍立得照片）- 默认160，建议范围：50-300
VITE_PHOTO_DENSITY=160

# 信封密度（评论祝福）- 默认50，建议范围：20-100
VITE_ENVELOPE_DENSITY=50

# 圣诞元素密度（礼物、糖果等）- 默认180，建议范围：50-300
VITE_ELEMENT_DENSITY=180

# 彩灯密度 - 默认200，建议范围：50-400
VITE_LIGHT_DENSITY=200
```

**性能影响：**
- 树叶密度：**高**（影响最大，建议低端设备设为 5000-10000）
- 其他密度：**中低**

**注意：**
- 设置为 `0` 会导致对应元素不显示
- 信封数量受实际评论数限制

---

## 完整配置示例

### 场景 1：简洁模式（性能优先）

```env
VITE_WALINE_SERVER_URL=https://waline.456147.xyz
VITE_ENABLE_GESTURE_CONTROL=false
VITE_ENABLE_COMMENT_REPLY=true
VITE_SHOW_COMMENT_LIST=false
VITE_FOLIAGE_DENSITY=10000
VITE_PHOTO_DENSITY=80
VITE_ENVELOPE_DENSITY=30
VITE_ELEMENT_DENSITY=90
VITE_LIGHT_DENSITY=100
```

适合：低端设备、性能优先

---

### 场景 2：完整体验（推荐）

```env
VITE_WALINE_SERVER_URL=https://waline.456147.xyz
VITE_ENABLE_GESTURE_CONTROL=true
VITE_ENABLE_COMMENT_REPLY=true
VITE_SHOW_COMMENT_LIST=true
VITE_FOLIAGE_DENSITY=20000
VITE_PHOTO_DENSITY=160
VITE_ENVELOPE_DENSITY=50
VITE_ELEMENT_DENSITY=180
VITE_LIGHT_DENSITY=200
```

适合：中高端设备、完整功能体验

---

### 场景 3：豪华版（高端设备）

```env
VITE_WALINE_SERVER_URL=https://waline.456147.xyz
VITE_ENABLE_GESTURE_CONTROL=true
VITE_ENABLE_COMMENT_REPLY=true
VITE_SHOW_COMMENT_LIST=true
VITE_FOLIAGE_DENSITY=30000
VITE_PHOTO_DENSITY=250
VITE_ENVELOPE_DENSITY=80
VITE_ELEMENT_DENSITY=250
VITE_LIGHT_DENSITY=350
```

适合：高端设备、追求视觉效果

---

## 故障排查

### 问题 1: 修改 .env 后没有效果
**解决方案**: 
1. 完全停止开发服务器 (Ctrl+C)
2. 重新启动: `npm run dev`
3. 刷新浏览器页面

### 问题 2: 功能开关不起作用
**原因**: 现在所有开关默认为 `false`，只有显式设为 `true` 才启用
**解决方案**: 
- 确保值是 `true` 或 `false`（不带引号）
- 重启开发服务器

### 问题 3: 看不到信封/照片/树叶
**原因**: 密度值设置为 0
**解决方案**: 
- 检查 .env 中的密度值
- 使用推荐的默认值
- 重启开发服务器

### 问题 4: 无法回复抽到的祝福
**解决方案**:
```env
VITE_ENABLE_COMMENT_REPLY=true
```
然后重启服务器

### 问题 5: 手势与点击抽取冲突
**解决方案**: 禁用手势控制
```env
VITE_ENABLE_GESTURE_CONTROL=false
```

---

## 调试模式

点击界面上的"**显示调试**"按钮，可以实时查看：

- ✅ Waline 配置状态
- ✅ 所有功能开关的实际状态（是否启用）
- ✅ 所有密度配置的当前值
- ✅ 环境变量的原始值

这有助于确认配置是否正确加载。

---

## 修改配置后必读

⚠️ **重要**：修改 `.env` 文件后，必须**完全重启**开发服务器才能生效！

**正确步骤：**
1. 停止当前服务器（按 `Ctrl+C`）
2. 重新运行 `npm run dev`
3. 刷新浏览器页面（`Ctrl+R` 或 `F5`）

**❌ 错误做法：**
- 只刷新浏览器 → 无效
- 热重载 → 无法加载环境变量更改

---

## 防冲突机制

系统已内置防冲突保护：

1. **动画锁定**：抽照片或抽祝福时会自动锁定 800ms，防止重复触发
2. **手势暂停**：动画播放期间手势操作会被暂时禁用
3. **状态管理**：确保同一时间只有一个动画在播放

这些机制自动生效，无需额外配置。

---

如有问题，请参考 `START_HERE.md` 或 `QUICKSTART.md`
