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

// 全局状态（所有控制都改这里，然后广播给网页）
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

      // 注册
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

      // ========== 双向控制：网页 / 设备发指令都生效，网页实时同步 ==========
      if(data.type === "control") {
        // 更新全局状态
        if(data.cmd === "on") fanState.power = "on";
        if(data.cmd === "off") fanState.power = "off";
        if(data.cmd === "speed") fanState.speed = data.value;
        if(data.cmd === "mode") fanState.mode = data.value;

        // 发给设备执行
        if(deviceSocket?.readyState === WebSocket.OPEN) {
          deviceSocket.send(JSON.stringify(data));
        }

        // 广播给所有网页同步UI
        broadcastStatus();
      }

      // 设备上传温湿度、实时风速（自动模式用这个风速）
      if(data.type === "status") {
        fanState.online = true;
        fanState.temp = data.temp || 0;
        fanState.humi = data.humi || 0;
        fanState.power = data.power || fanState.power;
        fanState.speed = data.speed || 0; // 自动模式风速=ESP实时风速
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

// 广播状态给网页，网页自动更新：图标、风速、模式、按钮全同步
function broadcastStatus() {
  const msg = JSON.stringify({type:"status",...fanState});
  webClients.forEach(c => c.readyState === 1 && c.send(msg));
}

const PORT = process.env.PORT || 10000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ 后端服务启动，端口：${PORT}`);
});
