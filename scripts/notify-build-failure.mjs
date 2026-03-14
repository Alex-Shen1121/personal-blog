// Build Failure Notification Script
// Supports DingTalk, Lark (Feishu), and Slack webhooks
// Usage: node scripts/notify-build-failure.mjs --type dingtalk --webhook <url> --message <message>
//        node scripts/notify-build-failure.mjs --type lark --webhook <url> --message <message>
//        node scripts/notify-build-failure.mjs --type slack --webhook <url> --message <message>

const https = require('https');
const http = require('http');
const { URL } = require('url');

const args = process.argv.slice(2);
let type = 'dingtalk';
let webhook = '';
let message = 'Build failed';
let extraData = {};

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--type' && args[i + 1]) {
    type = args[i + 1];
    i++;
  } else if (args[i] === '--webhook' && args[i + 1]) {
    webhook = args[i + 1];
    i++;
  } else if (args[i] === '--message' && args[i + 1]) {
    message = args[i + 1];
    i++;
  } else if (args[i] === '--commit' && args[i + 1]) {
    extraData.commit = args[i + 1];
    i++;
  } else if (args[i] === '--branch' && args[i + 1]) {
    extraData.branch = args[i + 1];
    i++;
  } else if (args[i] === '--url' && args[i + 1]) {
    extraData.url = args[i + 1];
    i++;
  }
}

const formatMessage = () => {
  const timestamp = new Date().toISOString();
  let text = `🚨 **构建失败**\n\n`;
  text += `📝 ${message}\n\n`;
  
  if (extraData.commit) {
    text += `🔧 Commit: ${extraData.commit}\n`;
  }
  if (extraData.branch) {
    text += `🌿 Branch: ${extraData.branch}\n`;
  }
  if (extraData.url) {
    text += `🔗 Actions: ${extraData.url}\n`;
  }
  
  text += `\n⏰ 时间: ${timestamp}`;
  
  return text;
};

const sendDingTalk = (webhookUrl, msg) => {
  return new Promise((resolve, reject) => {
    const url = new URL(webhookUrl);
    const data = JSON.stringify({
      msgtype: 'markdown',
      markdown: {
        title: '构建失败通知',
        text: msg
      }
    });
    
    const options = {
      hostname: url.hostname,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data)
      }
    };
    
    const protocol = url.protocol === 'https:' ? https : http;
    const req = protocol.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        if (res.statusCode === 200) {
          console.log('✓ DingTalk notification sent');
          resolve();
        } else {
          reject(new Error(`DingTalk error: ${res.statusCode}`));
        }
      });
    });
    
    req.on('error', reject);
    req.write(data);
    req.end();
  });
};

const sendLark = (webhookUrl, msg) => {
  return new Promise((resolve, reject) => {
    const url = new URL(webhookUrl);
    const data = JSON.stringify({
      msg_type: 'text',
      content: {
        text: msg
      }
    });
    
    const options = {
      hostname: url.hostname,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data)
      }
    };
    
    const protocol = url.protocol === 'https:' ? https : http;
    const req = protocol.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        if (res.statusCode === 200) {
          console.log('✓ Lark notification sent');
          resolve();
        } else {
          reject(new Error(`Lark error: ${res.statusCode}`));
        }
      });
    });
    
    req.on('error', reject);
    req.write(data);
    req.end();
  });
};

const sendSlack = (webhookUrl, msg) => {
  return new Promise((resolve, reject) => {
    const url = new URL(webhookUrl);
    const data = JSON.stringify({
      text: msg,
      username: 'Build Bot',
      icon_emoji: ':warning:'
    });
    
    const options = {
      hostname: url.hostname,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data)
      }
    };
    
    const protocol = url.protocol === 'https:' ? https : http;
    const req = protocol.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        if (res.statusCode === 200) {
          console.log('✓ Slack notification sent');
          resolve();
        } else {
          reject(new Error(`Slack error: ${res.statusCode}`));
        }
      });
    });
    
    req.on('error', reject);
    req.write(data);
    req.end();
  });
};

const sendNotification = async () => {
  if (!webhook) {
    console.log('⚠️  No webhook URL provided, skipping notification');
    return;
  }
  
  const msg = formatMessage();
  
  try {
    switch (type) {
      case 'dingtalk':
        await sendDingTalk(webhook, msg);
        break;
      case 'lark':
      case 'feishu':
        await sendLark(webhook, msg);
        break;
      case 'slack':
        await sendSlack(webhook, msg);
        break;
      default:
        console.log(`⚠️  Unknown notification type: ${type}`);
    }
  } catch (error) {
    console.error('✗ Failed to send notification:', error.message);
    process.exit(1);
  }
};

sendNotification();
