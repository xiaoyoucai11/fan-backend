const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// 当前风扇状态
let fanState = {
  online: false,
  power: 'off',
  speed: 0
};

// 设备端连接
let deviceSocket = null;
// 网页客户端集合
const webClients = new Set();

// 查看状态接口
app.get('/api/state', (req, res) => {
  res.json(fanState);
});

wss.on('connection', (ws) => {
  console.log('新连接进入');
  ws.role = null;
  ws.on('message', (message) => {
    const text = message.toString();
    console.log('收到消息:', text);
    let data;
    try {
      data = JSON.parse(text);
    } catch (err) {
      console.log('JSON解析失败');
      return;
    }
    // 1. 注册身份
    if (data.type === 'register') {
      if (data.role === 'client') {
        ws.role = 'client';
        webClients.add(ws);
        ws.send(JSON.stringify({
          type: 'status',
          online: fanState.online,
          power: fanState.power,
          speed: fanState.speed
        }));
        console.log('网页客户端已注册');
      }
      if (data.role === 'device') {
        ws.role = 'device';
        deviceSocket = ws;
        fanState.online = true;
        broadcastStatus();
        console.log('设备端已注册');
      }
      return;
    }
    // 2. 网页控制命令 -> 转发给设备
    if (data.type === 'control') {
      if (deviceSocket && deviceSocket.readyState === WebSocket.OPEN) {
        deviceSocket.send(JSON.stringify(data));
        console.log('已转发控制命令给设备');
      } else {
        console.log('设备不在线');
      }
      return;
    }
    // 3. 设备上报状态 -> 广播给网页
    if (data.type === 'status') {
      fanState.online = true;
      fanState.power = data.power || fanState.power;
      fanState.speed = Number(data.speed ?? fanState.speed);
      broadcastStatus();
      return;
    }
    // 4. 心跳
    if (data.type === 'heartbeat') {
      fanState.online = true;
      return;
    }
  });
  ws.on('close', () => {
    console.log('连接断开');
    if (ws.role === 'client') {
      webClients.delete(ws);
    }
    if (ws.role === 'device') {
      if (deviceSocket === ws) {
        deviceSocket = null;
        fanState.online = false;
        broadcastStatus();
      }
    }
  });
});

function broadcastStatus() {
  const msg = JSON.stringify({
    type: 'status',
    online: fanState.online,
    power: fanState.power,
    speed: fanState.speed
  });
  webClients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(msg);
    }
  });
}

// ↓↓↓ 只改这一行！Vercel自动端口 ↓↓↓
const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`服务器已启动`);
});
