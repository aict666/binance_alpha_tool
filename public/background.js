// Background Service Worker
// 监听扩展图标点击事件，向 content script 发送切换消息

// 带重试的消息发送
async function sendMessageWithRetry(tabId, message, maxRetries = 3, delay = 300) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await chrome.tabs.sendMessage(tabId, message);
      return response;
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}

// 检查并确保 content script 已注入
async function ensureContentScriptInjected(tabId) {
  try {
    // 先尝试 ping content script
    await chrome.tabs.sendMessage(tabId, { type: 'PING' });
    return true;
  } catch (error) {
    // content script 不存在，尝试注入
    try {
      await chrome.scripting.executeScript({
        target: { tabId: tabId },
        files: ['content-main.js']
      });
      // 等待足够的时间让 React 初始化
      await new Promise(resolve => setTimeout(resolve, 500));
      return true;
    } catch (scriptError) {
      // 某些页面（如 chrome:// 页面）无法注入脚本，这是正常的
      return false;
    }
  }
}

// 监听标签页激活，确保 content script 可用
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  try {
    const tab = await chrome.tabs.get(activeInfo.tabId);
    // 只处理 http/https 页面
    if (tab.url && (tab.url.startsWith('http://') || tab.url.startsWith('https://'))) {
      await ensureContentScriptInjected(activeInfo.tabId);
    }
  } catch (error) {
    // 忽略无法访问的标签页
  }
});

// 监听来自 content script 的通知请求
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'SHOW_NOTIFICATION') {
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48"><rect width="48" height="48" fill="#f44336" rx="8"/><text x="24" y="32" fill="white" font-size="24" text-anchor="middle">!</text></svg>'),
      title: message.title || '委托监控警报',
      message: message.message || '监控的委托发生变化',
      priority: 2
    });
    sendResponse({ success: true });
  }
  return false;
});

chrome.action.onClicked.addListener(async (tab) => {
  // 只处理 http/https 页面
  if (!tab.url || (!tab.url.startsWith('http://') && !tab.url.startsWith('https://'))) {
    return;
  }

  try {
    await sendMessageWithRetry(tab.id, { type: 'TOGGLE_FLOATING_WINDOW' });
  } catch (error) {
    // 如果重试失败，尝试注入 content script
    if (error.message?.includes('Could not establish connection') ||
        error.message?.includes('Receiving end does not exist')) {
      const injected = await ensureContentScriptInjected(tab.id);
      if (injected) {
        try {
          await sendMessageWithRetry(tab.id, { type: 'TOGGLE_FLOATING_WINDOW' });
        } catch (retryError) {
          console.error('[Background] Toggle failed after injection:', retryError);
        }
      }
    }
  }
});
