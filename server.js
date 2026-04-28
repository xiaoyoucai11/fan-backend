const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const cors = require('cors');
const app = express();

// ✅ 保留你原来的前端域名
app.use(cors({
  origin: "https://xiaoyoucai11.github.io/fan-frontend",
  credentials: true
}));

const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// 全局状态：保留原有字段，新增温湿度+模式
let fanState = {
  online: false, power: "off", speed: 0,
  temp: 0, humi: 0, mode: 1 // 1自动 0手动
};

let deviceSocket = null;
const webClients = new Set();

// ✅ DHT11自动调速算法（温度优先）
function autoSpeedAlgorithm(t, h) {
  if(t < 26 && h < 60) return 0;
  else if((t>=26&&t<30) || (h>=60&&h<75)) return 30;
  else if((t>=30&&t<35) || (h>=75&&h<85)) return 60;
  else return 100;
}

// ✅ 保留原有根路径，兼容旧访问
app.get('/', (req, res) => {
  res.send("✅ 智能风扇后端服务运行正常（Render部署）");
});
app.get('/api/state', (req, res) => res.json(fanState));

wss.on('connection', (ws) => {
  ws.role = null;
  ws.on('message', (msg) => {
    try {
      const data = JSON.parse(msg.toString());
      // 保留原有注册逻辑
      if(data.type === "register") {
        ws.role = data.role;
        if(data.role === "client") { webClients.add(ws); ws.send(JSON.stringify({type:"status",...fanState})); }
        if(data.role === "device") { deviceSocket = ws; fanState.online = true; broadcastStatus(); }
      }

      // 保留原有控制指令：on/off/speed，新增mode
      if(data.type === "control" && deviceSocket?.readyState === WebSocket.OPEN) {
        if(data.cmd === "mode") fanState.mode = data.value;
        deviceSocket.send(JSON.stringify(data));
        broadcastStatus();
      }

      // 设备上传温湿度+状态，自动模式算转速
      if(data.type === "status") {
        fanState.online = true;
        fanState.temp = data.temp || 0;
        fanState.humi = data.humi || 0;
        fanState.power = data.power || fanState.power;
        
        // 自动模式后端计算转速，手动模式用硬件/网页值
        if(fanState.mode === 1) fanState.speed = autoSpeedAlgorithm(fanState.temp, fanState.humi);
        else fanState.speed = data.speed || fanState.speed;
        
        broadcastStatus();
      }
      if(data.type === "heartbeat") fanState.online = true;
    } catch(err) {}
  });

  ws.on("close", () => {
    webClients.delete(ws);
    if(ws.role === "device") { deviceSocket = null; fanState.online = false; broadcastStatus(); }
  });
});

// 广播给所有网页
function broadcastStatus() {
  const msg = JSON.stringify({type:"status",...fanState});
  webClients.forEach(c => c.readyState===1 && c.send(msg));
}

// ✅ 保留原有端口配置
const PORT = process.env.PORT || 10000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ 后端服务启动，端口：${PORT}`);
});
