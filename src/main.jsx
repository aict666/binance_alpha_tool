import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import App, { translations } from './components/App';
import './index.css';

// 开发环境预览入口
// 模拟 chrome.storage API
if (typeof chrome === 'undefined' || !chrome.storage) {
  window.chrome = {
    storage: {
      local: {
        get: (keys, callback) => {
          const result = {};
          keys.forEach(key => {
            const stored = localStorage.getItem(key);
            if (stored) {
              result[key] = JSON.parse(stored);
            }
          });
          callback(result);
        },
        set: (items) => {
          Object.entries(items).forEach(([key, value]) => {
            localStorage.setItem(key, JSON.stringify(value));
          });
        }
      }
    },
    runtime: {
      onMessage: {
        addListener: () => {}
      }
    }
  };
}

// 开发预览容器（模拟 FloatingWindow 的外观）
const DevContainer = () => {
  const [language, setLanguage] = useState('zh');

  useEffect(() => {
    const stored = localStorage.getItem('tradeAssistSettings');
    if (stored) {
      const settings = JSON.parse(stored);
      if (settings.language) setLanguage(settings.language);
    }
  }, []);

  const toggleLanguage = () => {
    const newLang = language === 'zh' ? 'en' : 'zh';
    setLanguage(newLang);
  };

  return (
    <div style={{
      width: '400px',
      boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)',
      borderRadius: '12px',
      overflow: 'hidden',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    }}>
      {/* 标题栏 */}
      <div style={{
        background: 'linear-gradient(135deg, #1f2937 0%, #111827 100%)',
        padding: '10px 12px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderBottom: '1px solid rgba(255,255,255,0.1)'
      }}>
        <span style={{
          color: '#60a5fa',
          fontWeight: 'bold',
          fontSize: '14px',
        }}>
          {translations[language].title}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            onClick={toggleLanguage}
            style={{
              background: '#374151',
              border: '1px solid #4b5563',
              borderRadius: '4px',
              padding: '2px 6px',
              cursor: 'pointer',
              fontSize: '11px',
              fontFamily: 'monospace',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            <span style={{ color: language === 'zh' ? '#60a5fa' : '#9ca3af' }}>ZH</span>
            <span style={{ color: '#4b5563' }}>/</span>
            <span style={{ color: language === 'en' ? '#60a5fa' : '#9ca3af' }}>EN</span>
          </button>
          <span style={{ color: '#6b7280', fontSize: '11px', fontFamily: 'monospace' }}>
            {translations[language].version}
          </span>
        </div>
      </div>
      {/* 内容区域 */}
      <div style={{ background: '#111827' }}>
        <App currentLanguage={language} />
      </div>
    </div>
  );
};

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <DevContainer />
  </React.StrictMode>
);
