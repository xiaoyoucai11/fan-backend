const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const cors = require('cors');

const app = express();
app.use(cors({
  origin: "https://xiaoyoucai11.github.io/fan-frontend",
  credentials: true
}));

const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// 全局状态
let fanState = {
  online: false, power: "off", speed: 0,
  temp: 0, humi: 0, mode: 1 // 1自动 0手动
};

let deviceSocket = null;
const webClients = new Set();

// 接口
app.get('/', (req, res) => {
  res.send("✅ 智能风扇后端服务运行正常（Render部署）");
});
app.get('/api/state', (req, res) => res.json(fanState));

wss.on('connection', (ws) => {
  ws.role = null;

  ws.on('message', (msg) => {
    try {
      const data = JSON.parse(msg.toString());

      // 注册
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

      // 网页控制指令下发给设备
      if (data.type === "control" && deviceSocket?.readyState === WebSocket.OPEN) {
        if (data.cmd === "mode") fanState.mode = data.value;
        deviceSocket.send(JSON.stringify(data));
        broadcastStatus();
      }

      // ✅ ESP 上传状态：自动模式风速 = ESP 实时上传值
      if (data.type === "status") {
        fanState.online = true;
        fanState.temp = data.temp || 0;
        fanState.humi = data.humi || 0;
        fanState.power = data.power || fanState.power;
        
        // ✅ 关键修改：无论自动/手动，风速都用 ESP 发过来的 real-time speed
        fanState.speed = data.speed || 0;

        broadcastStatus();
      }

      if (data.type === "heartbeat") {
        fanState.online = true;
      }
    } catch (err) {}
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

// 广播状态给所有网页
function broadcastStatus() {
  const msg = JSON.stringify({ type: "status", ...fanState });
  webClients.forEach(c => c.readyState === 1 && c.send(msg));
}

const PORT = process.env.PORT || 10000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ 后端服务启动，端口：${PORT}`);
});
