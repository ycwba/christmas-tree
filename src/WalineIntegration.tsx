import { useEffect, useState, useRef } from 'react';
import { init, commentCount } from '@waline/client';
import type { WalineInstance } from '@waline/client';
import { WALINE_CONFIG } from './waline-config';

export interface WalineComment {
  nick: string;
  comment: string;
  avatar?: string;
  link?: string;
  mail?: string;
  insertedAt: string;
  objectId: string;
  pid?: string;
  rid?: string;
}

interface CustomCommentBoxProps {
  onClose: () => void;
  onSuccess?: () => void;
  replyTo?: WalineComment | null;
}

export const CustomCommentBox = ({ onClose, onSuccess, replyTo }: CustomCommentBoxProps) => {
  const walineRef = useRef<HTMLDivElement>(null);
  const instanceRef = useRef<WalineInstance | null>(null);
  const hasSubmittedRef = useRef(false);

  useEffect(() => {
    if (!walineRef.current || !WALINE_CONFIG.serverURL) return;

    // 初始化 Waline
    instanceRef.current = init({
      el: walineRef.current,
      serverURL: WALINE_CONFIG.serverURL,
      path: WALINE_CONFIG.path,
      lang: WALINE_CONFIG.lang,
      meta: ['nick', 'mail', 'link'],
      requiredMeta: ['nick'], // 只要求昵称，邮箱可选
      wordLimit: WALINE_CONFIG.wordLimit,
      emoji: [
        '//unpkg.com/@waline/emojis@1.2.0/weibo',
        '//unpkg.com/@waline/emojis@1.2.0/alus',
        '//unpkg.com/@waline/emojis@1.2.0/bilibili',
        '//unpkg.com/@waline/emojis@1.2.0/qq',
        '//unpkg.com/@waline/emojis@1.2.0/tieba',
        '//unpkg.com/@waline/emojis@1.2.0/tw-emoji',
      ],
      imageUploader: true, // 启用图片上传
      search: {
        search: 'https://tenor.googleapis.com/v2/search?key=AIzaSyAyOtn9wH_v2FhZvfS6oqFMDl9H7UR9_sE&q={{keyword}}&limit=20',
      } as any, // 启用 GIF 搜索
      login: 'enable', // 启用 Waline 原生登录
      dark: false,
      commentSorting: 'latest',
    });

    // 监听提交按钮点击事件
    const checkSubmit = () => {
      const submitBtn = walineRef.current?.querySelector('.wl-btn') as HTMLButtonElement;
      if (submitBtn) {
        submitBtn.addEventListener('click', () => {
          // 标记用户已点击提交
          const textarea = walineRef.current?.querySelector('.wl-editor') as HTMLTextAreaElement;
          const nickInput = walineRef.current?.querySelector('input[type="text"]') as HTMLInputElement;
          const mailInput = walineRef.current?.querySelector('input[type="email"]') as HTMLInputElement;
          
          if (textarea && textarea.value.trim()) {
            hasSubmittedRef.current = true;
            console.log('🎯 用户点击了提交按钮');
            
            // 保存用户信息到 localStorage
            if (nickInput && mailInput && nickInput.value && mailInput.value) {
              const authData = {
                nick: nickInput.value.trim(),
                mail: mailInput.value.trim()
              };
              localStorage.setItem('waline_auth', JSON.stringify(authData));
              console.log('💾 保存用户信息:', authData);
            }
            
            // 延迟检查提交结果
            setTimeout(() => {
              const currentValue = (walineRef.current?.querySelector('.wl-editor') as HTMLTextAreaElement)?.value;
              if (currentValue === '' && hasSubmittedRef.current) {
                console.log('✅ 祝福发送成功！');
                onSuccess?.();
                onClose();
              }
            }, 1000);
          }
        });
      }
    };

    // 等待 Waline 完全初始化
    setTimeout(checkSubmit, 500);

    return () => {
      instanceRef.current?.destroy();
    };
  }, [onClose, onSuccess]);

  // 自动从 localStorage 恢复登录状态
  useEffect(() => {
    const savedAuth = localStorage.getItem('waline_auth');
    if (savedAuth && walineRef.current) {
      try {
        const auth = JSON.parse(savedAuth);
        setTimeout(() => {
          const nickInput = walineRef.current?.querySelector('input[type="text"]') as HTMLInputElement;
          const mailInput = walineRef.current?.querySelector('input[type="email"]') as HTMLInputElement;
          if (nickInput) nickInput.value = auth.nick || '';
          if (mailInput) mailInput.value = auth.mail || '';
        }, 100);
      } catch {
        // 忽略错误
      }
    }
  }, []);

  return (
    <div className="custom-comment-modal">
      <div className="custom-comment-modal__overlay" onClick={onClose} />
      <div className="custom-comment-modal__content waline-comment-box">
        <button className="custom-comment-modal__close" onClick={onClose}>×</button>
        <h2>🎄 {replyTo ? `回复 ${replyTo.nick} 的祝福` : '写下你的圣诞祝福'}</h2>
        
        {replyTo && (
          <div className="custom-comment-reply-to">
            <div dangerouslySetInnerHTML={{ __html: replyTo.comment }} />
          </div>
        )}

        <div ref={walineRef} style={{ marginTop: '20px' }} />
      </div>
    </div>
  );
};

// 保留旧组件以兼容
export const WalineCommentBox = CustomCommentBox;

export const useWalineComments = () => {
  const [comments, setComments] = useState<WalineComment[]>([]);
  const [loading, setLoading] = useState(false);
  const [count, setCount] = useState(0);

  const fetchComments = async () => {
    if (!WALINE_CONFIG.serverURL) {
      console.log('没有配置 Waline 服务器 URL');
      return;
    }
    
    setLoading(true);
    try {
      const url = `${WALINE_CONFIG.serverURL}/comment?path=${encodeURIComponent(WALINE_CONFIG.path)}&pageSize=100&sortBy=insertedAt_desc`;
      console.log('📬 正在获取评论，URL:', url);
      const response = await fetch(url);
      const data = await response.json();
      console.log('📬 获取到的评论数据:', data);
      if (data.data) {
        setComments(data.data);
        setCount(data.count || data.data.length);
        console.log('✅ 成功设置评论数组，长度:', data.data.length);
        console.log('📊 评论总数:', data.count || data.data.length);
      } else {
        console.warn('⚠️ 评论数据格式异常:', data);
      }
    } catch (error) {
      console.error('❌ 获取评论失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const getRandomComment = (): WalineComment | null => {
    if (comments.length === 0) return null;
    return comments[Math.floor(Math.random() * comments.length)];
  };

  const updateCommentCount = async () => {
    if (!WALINE_CONFIG.serverURL) return;
    try {
      const result = await commentCount({
        serverURL: WALINE_CONFIG.serverURL,
        path: WALINE_CONFIG.path,
      });
      if (typeof result === 'number') {
        setCount(result);
      }
    } catch (error) {
      console.error('获取评论数失败:', error);
    }
  };

  useEffect(() => {
    fetchComments();
    updateCommentCount();
    
    // 定期刷新评论
    const interval = setInterval(() => {
      fetchComments();
      updateCommentCount();
    }, 30000); // 30秒刷新一次

    return () => clearInterval(interval);
  }, []);

  return {
    comments,
    count,
    loading,
    fetchComments,
    getRandomComment,
    updateCommentCount,
  };
};
