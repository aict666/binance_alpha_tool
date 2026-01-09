import React from 'react';
import ReactDOM from 'react-dom/client';
import App from '../components/App';
import FloatingWindow from '../components/FloatingWindow';
import cssText from '../index.css?inline';
import './fill-logic.js';

const CONTAINER_ID = 'binance-alpha-assistant-root';

let isVisible = false;
let root = null;
let container = null;
let shadowRoot = null;

// 创建悬浮窗容器（使用 Shadow DOM 隔离样式）
function createFloatingContainer() {
  if (container && shadowRoot) {
    return shadowRoot.getElementById('app-root');
  }

  // 创建宿主元素
  container = document.createElement('div');
  container.id = CONTAINER_ID;
  document.body.appendChild(container);

  // 创建 Shadow DOM
  shadowRoot = container.attachShadow({ mode: 'open' });

  // 注入样式到 Shadow DOM
  const style = document.createElement('style');
  style.textContent = cssText;
  shadowRoot.appendChild(style);

  // 创建 React 挂载点
  const appRoot = document.createElement('div');
  appRoot.id = 'app-root';
  shadowRoot.appendChild(appRoot);

  return appRoot;
}

// 渲染应用
function renderApp(visible) {
  const appRoot = createFloatingContainer();

  if (!root) {
    root = ReactDOM.createRoot(appRoot);
  }

  root.render(
    <React.StrictMode>
      <FloatingWindow visible={visible} onClose={hideFloatingWindow}>
        <App />
      </FloatingWindow>
    </React.StrictMode>
  );
}

// 显示悬浮窗
function showFloatingWindow() {
  isVisible = true;
  renderApp(true);
}

// 隐藏悬浮窗
function hideFloatingWindow() {
  isVisible = false;
  renderApp(false);
}

// 切换显示状态
function toggleFloatingWindow() {
  if (isVisible) {
    hideFloatingWindow();
  } else {
    showFloatingWindow();
  }
}

// 监听来自 background 的消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'TOGGLE_FLOATING_WINDOW') {
    toggleFloatingWindow();
    sendResponse({ success: true, visible: isVisible });
  }
  return true;
});

// 初始化
console.log('[TradeAssist] Content script loaded');
