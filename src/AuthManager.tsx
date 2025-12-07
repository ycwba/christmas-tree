import { useEffect, useRef, useState } from 'react';
import { init } from '@waline/client';
import type { WalineInstance } from '@waline/client';
import { WALINE_CONFIG } from './waline-config';

interface AuthManagerProps {
  onClose: () => void;
}

export const AuthManager = ({ onClose }: AuthManagerProps) => {
  const walineContainerRef = useRef<HTMLDivElement>(null);
  const walineInstanceRef = useRef<WalineInstance | null>(null);
  const [userEmail, setUserEmail] = useState<string>('');

  // 初始化 Waline，使用原生登录和评论管理
  useEffect(() => {
    if (walineContainerRef.current && !walineInstanceRef.current) {
      walineInstanceRef.current = init({
        el: walineContainerRef.current,
        serverURL: WALINE_CONFIG.serverURL,
        path: WALINE_CONFIG.path,
        lang: WALINE_CONFIG.lang,
        login: 'enable', // 启用原生登录
        meta: ['nick', 'mail', 'link'],
        requiredMeta: ['nick'], // 只要求昵称，邮箱可选
        pageSize: 100,
        dark: false,
        commentSorting: 'latest',
        emoji: [
          '//unpkg.com/@waline/emojis@1.2.0/weibo',
          '//unpkg.com/@waline/emojis@1.2.0/bilibili',
        ],
        imageUploader: true,
        search: {
          search: 'https://tenor.googleapis.com/v2/search?key=AIzaSyAyOtn9wH_v2FhZvfS6oqFMDl9H7UR9_sE&q={{keyword}}&limit=20',
        } as any, // 启用 GIF 搜索
      });

      console.log('📋 已初始化 Waline 评论管理器（原生登录模式）');
      
      // 监听登录状态变化
      const checkLoginStatus = setInterval(() => {
        const userInfo = localStorage.getItem('WALINE_USER');
        if (userInfo) {
          try {
            const user = JSON.parse(userInfo);
            if (user.email && user.email !== userEmail) {
              setUserEmail(user.email);
              console.log('👤 检测到用户登录:', user.email);
              // 延迟一下再过滤，确保评论列表已加载
              setTimeout(() => filterComments(user.email), 1000);
            }
          } catch (e) {
            console.error('解析用户信息失败:', e);
          }
        }
      }, 500);

      return () => {
        clearInterval(checkLoginStatus);
      };
    }

    return () => {
      if (walineInstanceRef.current) {
        walineInstanceRef.current.destroy();
        walineInstanceRef.current = null;
      }
    };
  }, []);

  // 过滤评论：只显示自己发的和收到的回复
  const filterComments = (email: string) => {
    if (!walineContainerRef.current) return;

    // 获取所有评论卡片
    const allComments = walineContainerRef.current.querySelectorAll('.wl-card');
    
    allComments.forEach((card) => {
      const cardElement = card as HTMLElement;
      
      // 检查是否是自己的评论
      const metaElement = cardElement.querySelector('.wl-meta');
      const metaText = metaElement?.textContent || '';
      
      // 检查评论内容中是否包含 @自己 (说明是回复自己的)
      const commentContent = cardElement.querySelector('.wl-content')?.textContent || '';
      const isReplyToMe = commentContent.includes(`@${email}`);
      
      // 通过检查评论数据属性或内容判断是否是自己的评论
      const emailMatch = metaText.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
      const commentEmail = emailMatch ? emailMatch[1] : '';
      
      const isMyComment = commentEmail === email;
      
      // 只显示自己的评论或回复自己的评论
      if (isMyComment || isReplyToMe) {
        cardElement.style.display = '';
      } else {
        cardElement.style.display = 'none';
      }
    });

    console.log(`✅ 已过滤评论，只显示用户 ${email} 的评论和收到的回复`);
  };

  // 当用户邮箱变化时重新过滤
  useEffect(() => {
    if (userEmail) {
      const timer = setInterval(() => {
        filterComments(userEmail);
      }, 1000);

      return () => clearInterval(timer);
    }
  }, [userEmail]);

  return (
    <div className="auth-modal">
      <div className="auth-modal__overlay" onClick={onClose} />
      <div className="auth-modal__content">
        <button className="auth-modal__close" onClick={onClose}>×</button>
        
        <h2>🎄 我的评论</h2>
        <p className="auth-modal__desc">登录后可以查看和管理你的祝福</p>
        
        {!userEmail && (
          <div className="auth-login-hint">
            <div className="auth-login-hint__icon">🎅</div>
            <div className="auth-login-hint__title">请先登录</div>
            <div className="auth-login-hint__desc">
              登录后即可查看你发送的所有祝福和收到的回复。<br />
              请在下方 Waline 评论框中点击登录按钮。
            </div>
          </div>
        )}
        
        <div className="auth-waline-container" ref={walineContainerRef} />
      </div>
    </div>
  );
};
