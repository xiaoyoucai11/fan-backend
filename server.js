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

// 全局风扇状态
let fanState = {
  online: false, power: "off", speed: 0,
  temp: 0, humi: 0, mode: 1
};

let deviceSocket = null;
const webClients = new Set();

app.get('/', (req, res) => {
  res.send("✅ 智能风扇后端服务运行正常（Render部署）");
});
app.get('/api/state', (req, res) => res.json(fanState));

wss.on('connection', (ws) => {
  ws.role = null;

  ws.on('message', (msg) => {
    try {
      const data = JSON.parse(msg.toString());

      // 注册：区分网页客户端 / ESP设备
      if(data.type === "register") {
        ws.role = data.role;
        if(data.role === "client") { 
          webClients.add(ws); 
          ws.send(JSON.stringify({type:"status",...fanState})); 
        }
        if(data.role === "device") { 
          deviceSocket = ws; 
          fanState.online = true; 
          broadcastStatus(); 
        }
      }

      // ====================== 核心改动：双向控制指令处理 ======================
      if(data.type === "control") {
        // 1. 执行控制逻辑，更新全局状态
        if(data.cmd === "on") fanState.power = "on";
        if(data.cmd === "off") fanState.power = "off";
        if(data.cmd === "speed") fanState.speed = data.value;
        if(data.cmd === "mode") fanState.mode = data.value;

        // 2. 发给ESP执行
        if(deviceSocket?.readyState === WebSocket.OPEN) {
          deviceSocket.send(JSON.stringify(data));
        }

        // 3. 广播给所有网页，实时同步
        broadcastStatus();
      }
      // ======================================================================

      // ESP上传实时数据（温湿度、实时风速）
      if(data.type === "status") {
        fanState.online = true;
        fanState.temp = data.temp;
        fanState.humi = data.humi;
        fanState.power = data.power;
        // 自动模式风速 = ESP发过来的实时风速
        fanState.speed = data.speed;
        broadcastStatus();
      }

      if(data.type === "heartbeat") fanState.online = true;
    } catch(err) {}
  });

  ws.on("close", () => {
    webClients.delete(ws);
    if(ws.role === "device") { 
      deviceSocket = null; 
      fanState.online = false; 
      broadcastStatus(); 
    }
  });
});

// 广播状态给所有网页端
function broadcastStatus() {
  const msg = JSON.stringify({type:"status",...fanState});
  webClients.forEach(c => c.readyState === 1 && c.send(msg));
}

const PORT = process.env.PORT || 10000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ 后端服务启动，端口：${PORT}`);
});
