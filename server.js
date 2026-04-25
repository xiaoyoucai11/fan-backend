const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const cors = require('cors');

const app = express();
// 允许跨域（适配你的GitHub前端域名）
app.use(cors({
  origin: "https://xiaoyoucai11.github.io/fan-frontend",
  credentials: true
}));

const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// 全局风扇状态
let fanState = { online: false, power: "off", speed: 0 };
let deviceSocket = null; // ESP8266设备连接
const webClients = new Set(); // 网页前端连接

// ✅ 根路径响应：解决Cannot GET /
app.get('/', (req, res) => {
  res.send("✅ 智能风扇后端服务运行正常（Render部署）");
});

// ✅ 状态查询接口
app.get('/api/state', (req, res) => {
  res.json(fanState);
});

// WebSocket连接处理
wss.on('connection', (ws) => {
  ws.role = null;

  ws.on('message', (msg) => {
    try {
      const data = JSON.parse(msg.toString());
      
      // 注册身份：device（ESP8266）/ client（网页前端）
      if (data.type === "register") {
        ws.role = data.role;
        if (data.role === "client") {
          webClients.add(ws);
          ws.send(JSON.stringify({ type: "status", ...fanState }));
        }
        if (data.role === "device") {
          deviceSocket = ws;
          fanState.online = true;
          broadcastStatus();
        }
      }

      // 前端控制命令转发给设备
      if (data.type === "control" && deviceSocket?.readyState === WebSocket.OPEN) {
        deviceSocket.send(JSON.stringify(data));
      }

      // 设备状态同步给所有前端
      if (data.type === "status") {
        fanState.online = true;
        fanState.power = data.power || fanState.power;
        fanState.speed = Number(data.speed ?? fanState.speed);
        broadcastStatus();
      }

      // 心跳包保持连接
      if (data.type === "heartbeat") fanState.online = true;
    } catch (err) {
      console.error("消息处理错误:", err);
    }
  });

  ws.on("close", () => {
    webClients.delete(ws);
    if (ws.role === "device") {
      deviceSocket = null;
      fanState.online = false;
      broadcastStatus();
    }
  });
});

// 广播状态给所有前端
function broadcastStatus() {
  const msg = JSON.stringify({ type: "status", ...fanState });
  webClients.forEach(c => c.readyState === 1 && c.send(msg));
}

// Render自动分配端口，无需修改
const PORT = process.env.PORT || 10000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ 后端服务启动，端口：${PORT}`);
});
