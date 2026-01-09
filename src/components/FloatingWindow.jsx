import { useState, useEffect, cloneElement } from 'react';
import { XMarkIcon } from '@heroicons/react/24/solid';
import useDraggable from '../hooks/useDraggable';
import { translations } from './App';

const FloatingWindow = ({ children, onClose, visible }) => {
  const { position, isDragging, dragRef, handleMouseDown } = useDraggable();
  const [language, setLanguage] = useState('zh');

  useEffect(() => {
    if (typeof chrome !== 'undefined' && chrome?.storage?.local) {
      chrome.storage.local.get(['tradeAssistSettings'], (result) => {
        if (result.tradeAssistSettings?.language) {
          setLanguage(result.tradeAssistSettings.language);
        }
      });
    }
  }, []);

  const toggleLanguage = () => {
    const newLang = language === 'zh' ? 'en' : 'zh';
    setLanguage(newLang);
    if (typeof chrome !== 'undefined' && chrome?.storage?.local) {
      chrome.storage.local.get(['tradeAssistSettings'], (result) => {
        const settings = result.tradeAssistSettings || {};
        settings.language = newLang;
        chrome.storage.local.set({ tradeAssistSettings: settings });
      });
    }
  };

  if (!visible) return null;
  if (position.x === null) return null;

  const t = translations[language];

  return (
    <div
      ref={dragRef}
      onMouseDown={handleMouseDown}
      style={{
        position: 'fixed',
        left: `${position.x}px`,
        top: `${position.y}px`,
        zIndex: 2147483647,
        width: '400px',
        cursor: isDragging ? 'grabbing' : 'default',
        border: 'none',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)',
        borderRadius: '12px',
        overflow: 'hidden',
        fontFamily: '"PingFang SC", "Noto Sans SC", -apple-system, BlinkMacSystemFont, "Microsoft YaHei", "Segoe UI", Roboto, sans-serif',
        userSelect: isDragging ? 'none' : 'auto'
      }}
    >
      {/* 可拖动的标题栏 */}
      <div
        data-drag-handle
        style={{
          background: 'linear-gradient(135deg, #1f2937 0%, #111827 100%)',
          padding: '10px 12px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          cursor: isDragging ? 'grabbing' : 'grab',
          borderBottom: '1px solid rgba(255,255,255,0.1)'
        }}
      >
        <span style={{
          color: '#60a5fa',
          fontWeight: 'bold',
          fontSize: '14px',
          userSelect: 'none'
        }}>
          {t.title}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            onClick={(e) => {
              e.stopPropagation();
              toggleLanguage();
            }}
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
            {t.version}
          </span>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              padding: '4px',
              borderRadius: '4px',
              display: 'flex',
              alignItems: 'center',
              transition: 'background 0.2s'
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
          >
            <XMarkIcon style={{ width: '16px', height: '16px', color: '#9ca3af' }} />
          </button>
        </div>
      </div>

      {/* 内容区域 */}
      <div style={{
        background: '#111827',
        maxHeight: '600px',
        overflowY: 'auto'
      }}>
        {cloneElement(children, { currentLanguage: language })}
      </div>
    </div>
  );
};

export default FloatingWindow;
