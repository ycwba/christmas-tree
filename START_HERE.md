# 🎄 开始使用新功能

## 第一步：配置你的 Waline 地址和功能开关

打开项目根目录的 `.env` 文件，配置以下选项：

### 基础配置

```env
# Waline 服务器地址（必填）
VITE_WALINE_SERVER_URL=https://your-waline-server.example.com
```

**把 `https://your-waline-server.example.com` 改成你自己的 Waline 服务器地址！**

### 功能开关配置

```env
# 手势控制开关 (true/false)
# 启用后可通过摄像头手势控制圣诞树
VITE_ENABLE_GESTURE_CONTROL=true

# 评论回复功能 (true/false)
# 启用后可以回复其他人的祝福
VITE_ENABLE_COMMENT_REPLY=false

# 显示评论列表 (true/false)
# 发祝福时是否显示其他人发送的祝福
VITE_SHOW_COMMENT_LIST=true
```

### 配置说明

- **手势控制** (`VITE_ENABLE_GESTURE_CONTROL`)
  - `true`: 启用手势控制，可以用手势操作圣诞树
  - `false`: 禁用手势控制，减少性能消耗
  
- **评论回复** (`VITE_ENABLE_COMMENT_REPLY`)
  - `true`: 可以回复其他人的祝福
  - `false`: 只能发送新祝福，简化交互
  
- **显示评论列表** (`VITE_SHOW_COMMENT_LIST`)
  - `true`: 发祝福时会显示所有人的祝福
  - `false`: 发祝福时只显示输入框，更简洁

## 第二步：启动项目

在终端运行：

```bash
npm run dev
```

## 第三步：开始使用

打开浏览器，你会看到界面底部有新的按钮：

### 🎁 抽照片
点击后从圣诞树上随机抽取一张照片显示

### 💌 写祝福 (数字)
点击打开评论框，写下你的圣诞祝福
- 数字显示当前祝福总数
- 需要填写昵称
- 可选填写邮箱

### 🎄 抽祝福
点击后随机抽取一条祝福显示
- 祝福会在屏幕中央显示 5 秒
- 点击卡片可以提前关闭
- 如果还没有祝福，会提示你先写第一条

## 🚀 如果你还没有 Waline 服务器

### 快速部署（推荐 Vercel，3 分钟搞定）

1. 访问 https://waline.js.org/guide/get-started/
2. 点击 "Deploy with Vercel" 按钮
3. 登录 GitHub 账号授权
4. 等待部署完成
5. 复制你的 Waline 地址到 `.env` 文件

### 部署完全免费！

## ❓ 如果不想配置 Waline

没问题！不配置的话：
- ✅ "抽照片"功能正常使用
- ❌ "写祝福"和"抽祝福"按钮不会显示

其他所有功能都不受影响！

## 🎉 就是这么简单！

配置好后重启项目，就能享受所有新功能了！

---

更多详细信息请查看：
- `QUICKSTART.md` - 快速开始指南
- `README_WALINE.md` - Waline 功能详细说明
- `IMPLEMENTATION_SUMMARY.md` - 实现技术总结
