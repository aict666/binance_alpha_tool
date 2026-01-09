// Background Service Worker
// 监听扩展图标点击事件，向 content script 发送切换消息

chrome.action.onClicked.addListener(async (tab) => {
  try {
    await chrome.tabs.sendMessage(tab.id, { type: 'TOGGLE_FLOATING_WINDOW' });
  } catch (error) {
    console.error('[Background] Error sending toggle message:', error);

    // 如果 content script 还没注入，尝试注入
    if (error.message?.includes('Could not establish connection') ||
        error.message?.includes('Receiving end does not exist')) {
      try {
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ['content-main.js']
        });
        // 等待注入完成后再发送消息
        setTimeout(async () => {
          try {
            await chrome.tabs.sendMessage(tab.id, { type: 'TOGGLE_FLOATING_WINDOW' });
          } catch (e) {
            console.error('[Background] Retry failed:', e);
          }
        }, 100);
      } catch (scriptError) {
        console.error('[Background] Script injection failed:', scriptError);
      }
    }
  }
});
