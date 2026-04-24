const express = require('express');
const app = express();

// 解析JSON请求体
app.use(express.json());

// 全局风扇状态
let fan = {
  status: false,   // true开启 / false关闭
  speed: 1,        // 风速 1/2/3档
  temp: 25         // 环境温度
};

// 1. 获取风扇全部状态
app.get('/api/fan/status', (req, res) => {
  res.json({
    code: 200,
    msg: "获取成功",
    data: {
      风扇状态: fan.status ? "开启" : "关闭",
      风速档位: fan.speed,
      环境温度: fan.temp + "℃"
    }
  });
});

// 2. 风扇开关控制
app.post('/api/fan/switch', (req, res) => {
  const { status } = req.body;
  fan.status = status === 'on';
  res.json({
    code: 200,
    msg: fan.status ? "风扇已开启" : "风扇已关闭"
  });
});

// 3. 调节风速
app.post('/api/fan/speed', (req, res) => {
  const { speed } = req.body;
  if (speed >= 1 && speed <= 3) {
    fan.speed = speed;
    res.json({ code: 200, msg: `风速已设为${speed}档` });
  } else {
    res.json({ code: 400, msg: "档位只能是1-3" });
  }
});

// 4. 更新环境温度
app.post('/api/temp', (req, res) => {
  fan.temp = req.body.temp || 25;
  res.json({ code: 200, msg: "温度更新成功", 温度: fan.temp });
});

// 根路径测试
app.get('/', (req, res) => {
  res.send("智能风扇后端服务运行正常 ✅");
});

// Vercel 必须导出，不能写监听端口
module.exports = app;