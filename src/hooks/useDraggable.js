import { useState, useCallback, useEffect, useRef } from 'react';

const STORAGE_KEY = 'tradeAssistWindowPosition';

const useDraggable = (initialPosition = { x: null, y: 100 }) => {
  const [position, setPosition] = useState(initialPosition);
  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef(null);
  const offsetRef = useRef({ x: 0, y: 0 });

  // 加载保存的位置
  useEffect(() => {
    if (typeof chrome !== 'undefined' && chrome?.storage?.local) {
      chrome.storage.local.get([STORAGE_KEY], (result) => {
        if (result[STORAGE_KEY]) {
          setPosition(result[STORAGE_KEY]);
        } else {
          // 默认位置：右侧
          setPosition({
            x: window.innerWidth - 380,
            y: 100
          });
        }
      });
    } else {
      // 非扩展环境，使用默认位置
      setPosition({
        x: window.innerWidth - 380,
        y: 100
      });
    }
  }, []);

  // 保存位置
  const savePosition = useCallback((pos) => {
    if (typeof chrome !== 'undefined' && chrome?.storage?.local) {
      chrome.storage.local.set({ [STORAGE_KEY]: pos });
    }
  }, []);

  const handleMouseDown = useCallback((e) => {
    // 只响应标题栏区域的拖动
    if (e.target.closest('[data-drag-handle]')) {
      setIsDragging(true);
      const rect = dragRef.current.getBoundingClientRect();
      offsetRef.current = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      };
      e.preventDefault();
    }
  }, []);

  const handleMouseMove = useCallback((e) => {
    if (!isDragging) return;

    const newX = e.clientX - offsetRef.current.x;
    const newY = e.clientY - offsetRef.current.y;

    // 边界检测
    const maxX = window.innerWidth - (dragRef.current?.offsetWidth || 360);
    const maxY = window.innerHeight - (dragRef.current?.offsetHeight || 500);

    const clampedPosition = {
      x: Math.max(0, Math.min(newX, maxX)),
      y: Math.max(0, Math.min(newY, maxY))
    };

    setPosition(clampedPosition);
  }, [isDragging]);

  const handleMouseUp = useCallback(() => {
    if (isDragging) {
      // 保存位置
      savePosition(position);
    }
    setIsDragging(false);
  }, [isDragging, position, savePosition]);

  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, handleMouseMove, handleMouseUp]);

  return { position, isDragging, dragRef, handleMouseDown };
};

export default useDraggable;
