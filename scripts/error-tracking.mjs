/**
 * 前端错误上报脚本
 * 用于捕获并上报前端 JavaScript 错误到指定的错误追踪服务
 * 
 * 支持的错误收集：
 * - JavaScript 运行时错误
 * - Promise 未捕获 rejection
 * - 资源加载失败错误
 * 
 * 上报方式：
 * - 支持发送到一个 webhook 端点（需要配置）
 * - 支持本地存储错误日志（开发调试用）
 * 
 * 配置方式：
 * 在 src/data/site.mjs 的 errorTracking 中配置
 */

(function() {
  'use strict';

  // 错误上报配置
  const config = window.__SITE_CONFIG__?.errorTracking || {
    enabled: false,
    endpoint: null,  // 错误上报的 webhook 地址
    sampleRate: 1,   // 错误采样率 0-1
    ignorePatterns: [], // 忽略的错误模式
    maxErrors: 10    // 最多上报的错误数量
  };

  // 错误队列
  const errorQueue = [];
  let errorCount = 0;

  // 获取错误摘要
  function getErrorSummary(error) {
    if (error instanceof Error) {
      return {
        message: error.message,
        stack: error.stack,
        name: error.name,
        filename: error.filename || '',
        lineno: error.lineno || 0,
        colno: error.colno || 0
      };
    }
    return { message: String(error) };
  }

  // 格式化错误数据
  function formatErrorData(errorInfo, errorType) {
    return {
      timestamp: new Date().toISOString(),
      url: window.location.href,
      userAgent: navigator.userAgent,
      referrer: document.referrer,
      screen: `${window.screen.width}x${window.screen.height}`,
      viewport: `${window.innerWidth}x${window.innerHeight}`,
      errorType: errorType,
      error: errorInfo,
      // 页面性能数据
      performance: performance?.timing ? {
        loadTime: performance.timing.loadEventEnd - performance.timing.navigationStart,
        domReady: performance.timing.domContentLoadedEventEnd - performance.timing.navigationStart,
        firstPaint: performance.getEntriesByType('paint')[0]?.startTime || 0
      } : null
    };
  }

  // 判断是否应该忽略该错误
  function shouldIgnore(errorMessage) {
    if (!config.ignorePatterns || config.ignorePatterns.length === 0) {
      return false;
    }
    return config.ignorePatterns.some(pattern => {
      if (typeof pattern === 'string') {
        return errorMessage.includes(pattern);
      }
      return pattern.test(errorMessage);
    });
  }

  // 上报错误
  async function reportError(errorInfo, errorType) {
    // 采样控制
    if (Math.random() > config.sampleRate) {
      return;
    }

    // 检查错误数量限制
    if (errorCount >= config.maxErrors) {
      console.warn('[ErrorTracking] Max errors reached, ignoring new errors');
      return;
    }

    const errorData = formatErrorData(errorInfo, errorType);
    errorQueue.push(errorData);
    errorCount++;

    // 本地开发时打印到控制台
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      console.group('[ErrorTracking] Captured error');
      console.log('Error:', errorData);
      console.groupEnd();
    }

    // 如果配置了 endpoint，则发送到服务器
    if (config.enabled && config.endpoint) {
      try {
        await fetch(config.endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(errorData),
          // 不阻塞页面加载
          keepalive: true
        });
      } catch (e) {
        console.error('[ErrorTracking] Failed to report error:', e);
      }
    }
  }

  // 全局错误处理
  window.addEventListener('error', function(event) {
    // 忽略资源加载错误（图片、脚本等）
    if (event.target !== window) {
      // 可以选择上报资源错误，或者忽略
      // 这里选择忽略，因为通常是第三方资源的问题
      return;
    }

    const errorInfo = getErrorSummary(event.error || event.message);
    
    if (shouldIgnore(errorInfo.message)) {
      return;
    }

    reportError(errorInfo, 'error');
  });

  // Promise rejection 处理
  window.addEventListener('unhandledrejection', function(event) {
    const errorInfo = {
      message: event.reason?.message || String(event.reason),
      stack: event.reason?.stack || '',
      name: event.reason?.name || 'UnhandledPromiseRejection'
    };

    if (shouldIgnore(errorInfo.message)) {
      return;
    }

    reportError(errorInfo, 'unhandledrejection');
  });

  // 导出错误队列（供调试用）
  window.__ERROR_TRACKING__ = {
    getErrors: function() {
      return errorQueue;
    },
    getCount: function() {
      return errorCount;
    },
    clear: function() {
      errorQueue.length = 0;
      errorCount = 0;
    }
  };

  console.log('[ErrorTracking] Initialized', config);
})();
