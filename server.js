const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const defaultConfig = require('./data/defaultConfig');

const app = express();
const server = http.createServer(app);
const io = new Server(server);
const PORT = process.env.PORT || 3000;

const isServerless = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
const runtimeRoot = isServerless ? '/tmp' : __dirname;
const uploadsDir = path.join(runtimeRoot, 'uploads');
const dataDir = path.join(runtimeRoot, 'data');
try {
  if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
} catch (e) {}

const bundledConfigPath = path.join(__dirname, 'data', 'config.json');
const configPath = path.join(dataDir, 'config.json');
const sessionPath = path.join(dataDir, 'session.json');

function loadConfig() {
  try {
    if (fs.existsSync(configPath)) {
      return { ...defaultConfig, ...JSON.parse(fs.readFileSync(configPath, 'utf-8')) };
    }
    if (fs.existsSync(bundledConfigPath)) {
      return { ...defaultConfig, ...JSON.parse(fs.readFileSync(bundledConfigPath, 'utf-8')) };
    }
  } catch (e) {}
  try {
    fs.writeFileSync(configPath, JSON.stringify(defaultConfig, null, 2), 'utf-8');
  } catch (e) {}
  return { ...defaultConfig };
}

function saveConfig(cfg) {
  appConfig = cfg;
  try {
    fs.writeFileSync(configPath, JSON.stringify(appConfig, null, 2), 'utf-8');
  } catch (e) {}
}

let appConfig = loadConfig();

const defaultSessionState = {
  girlfriendOnline: false,
  currentStep: 'idle',
  claimedAt: null,
  giftClaimed: false,
  giftSent: false,
  giftData: null,
  historyLogs: [{ time: new Date().toLocaleTimeString('vi-VN'), message: 'Hệ thống sẵn sàng.' }]
};

function loadSession() {
  try {
    if (fs.existsSync(sessionPath)) {
      return { ...defaultSessionState, ...JSON.parse(fs.readFileSync(sessionPath, 'utf-8')) };
    }
  } catch (e) {}
  return { ...defaultSessionState, historyLogs: [...defaultSessionState.historyLogs] };
}

let sessionState = loadSession();

function saveSession() {
  try {
    fs.writeFileSync(sessionPath, JSON.stringify(sessionState, null, 2), 'utf-8');
  } catch (e) {}
}

function addLog(message) {
  sessionState.historyLogs.unshift({ time: new Date().toLocaleTimeString('vi-VN'), message });
  if (sessionState.historyLogs.length > 25) sessionState.historyLogs.pop();
  saveSession();
}

const storage = isServerless
  ? multer.memoryStorage()
  : multer.diskStorage({
      destination: (req, file, cb) => cb(null, uploadsDir),
      filename: (req, file, cb) => {
        const prefix = file.fieldname === 'musicFile' ? 'music' : 'bill';
        const defaultExt = file.fieldname === 'musicFile' ? '.mp3' : '.png';
        cb(null, `${prefix}_${Date.now()}${path.extname(file.originalname) || defaultExt}`);
      }
    });
const upload = multer({ storage, limits: { fileSize: 50 * 1024 * 1024 } });

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use('/uploads', express.static(uploadsDir));
app.use(express.static(path.join(__dirname, 'public')));

app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, 'public', 'admin.html')));
app.get('/api/state', (req, res) => {
  appConfig = loadConfig();
  sessionState = loadSession();
  res.json({ config: appConfig, session: sessionState });
});
app.get('/api/config', (req, res) => {
  appConfig = loadConfig();
  sessionState = loadSession();
  if (req.query.role === 'girlfriend' && !sessionState.girlfriendOnline) {
    sessionState.girlfriendOnline = true;
    if (sessionState.currentStep === 'idle') sessionState.currentStep = 'intro';
    addLog('🎀 Bạn gái vừa mở trang Web 20/10!');
  }
  res.json({ config: appConfig, session: sessionState });
});

app.post('/api/event', (req, res) => {
  sessionState = loadSession();
  const { type } = req.body || {};
  if (type === 'girlfriend_opened_envelope') {
    sessionState.girlfriendOnline = true;
    if (sessionState.currentStep !== 'waiting_gift' && sessionState.currentStep !== 'gift_received') {
      sessionState.currentStep = 'reading_letter';
    }
    addLog('💌 Bạn gái vừa mở phong bì & đang đọc sổ tay 20/10!');
    io.emit('session_updated', sessionState);
  } else if (type === 'claim_gift') {
    sessionState.girlfriendOnline = true;
    Object.assign(sessionState, {
      giftClaimed: true,
      claimedAt: new Date().toLocaleTimeString('vi-VN'),
      currentStep: 'waiting_gift'
    });
    addLog('🚨 BẠN GÁI ĐÃ BẤM NHẬN QUÀ 20/10!');
    io.emit('gift_claimed_alert', { claimedAt: sessionState.claimedAt, session: sessionState });
    io.emit('session_updated', sessionState);
  }
  saveSession();
  res.json({ success: true, session: sessionState });
});

app.post('/api/config', (req, res) => {
  saveConfig({ ...loadConfig(), ...req.body });
  addLog('✏️ Admin cập nhật nội dung chữ & thư 20/10.');
  io.emit('config_updated', appConfig);
  io.emit('session_updated', sessionState);
  res.json({ success: true, config: appConfig });
});

app.post('/api/upload-music', upload.single('musicFile'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, message: 'Chưa chọn file nhạc!' });
  }
  const musicUrl = req.file.buffer
    ? `data:${req.file.mimetype || 'audio/mpeg'};base64,${req.file.buffer.toString('base64')}`
    : `/uploads/${req.file.filename}`;
  const musicName = req.file.originalname || req.file.filename || 'music.mp3';
  saveConfig({ ...loadConfig(), musicUrl, musicName });
  addLog(`🎵 Admin đã tải lên nhạc nền: ${musicName}`);
  io.emit('config_updated', appConfig);
  io.emit('session_updated', sessionState);
  res.json({ success: true, musicUrl, musicName, config: appConfig });
});

app.post('/api/delete-music', (req, res) => {
  saveConfig({ ...loadConfig(), musicUrl: '', musicName: '' });
  addLog('🔇 Admin đã tắt / xóa nhạc nền.');
  io.emit('config_updated', appConfig);
  io.emit('session_updated', sessionState);
  res.json({ success: true, config: appConfig });
});

app.post('/api/config/reset-default', (req, res) => {
  const current = loadConfig();
  const currentMusicUrl = current.musicUrl || '';
  const currentMusicName = current.musicName || '';
  saveConfig({ ...defaultConfig, musicUrl: currentMusicUrl, musicName: currentMusicName });
  addLog('🔄 Khôi phục nội dung chữ mặc định.');
  io.emit('config_updated', appConfig);
  io.emit('session_updated', sessionState);
  res.json({ success: true, config: appConfig });
});

app.post('/api/send-gift', upload.single('billImage'), (req, res) => {
  appConfig = loadConfig();
  sessionState = loadSession();
  const amount = parseInt(String(req.body.amount || '2010000').replace(/[^\d]/g, ''), 10) || 2010000;
  const message = req.body.message || appConfig.defaultGiftMessage;
  let billUrl = req.body.existingBillUrl || '';

  if (req.file) {
    billUrl = req.file.buffer
      ? `data:${req.file.mimetype || 'image/png'};base64,${req.file.buffer.toString('base64')}`
      : `/uploads/${req.file.filename}`;
  } else if (req.body.pastedImageBase64 && req.body.pastedImageBase64.startsWith('data:image')) {
    if (isServerless) {
      billUrl = req.body.pastedImageBase64;
    } else {
      const m = req.body.pastedImageBase64.match(/^data:image\/([a-zA-Z0-9+]+);base64,(.+)$/);
      if (m) {
        const fileName = `bill_paste_${Date.now()}.${m[1] === 'jpeg' ? 'jpg' : m[1]}`;
        fs.writeFileSync(path.join(uploadsDir, fileName), Buffer.from(m[2], 'base64'));
        billUrl = `/uploads/${fileName}`;
      } else {
        billUrl = req.body.pastedImageBase64;
      }
    }
  }

  const giftData = {
    amount,
    formattedAmount: amount.toLocaleString('vi-VN') + ' VNĐ',
    message,
    billUrl,
    sentAt: new Date().toLocaleTimeString('vi-VN')
  };

  Object.assign(sessionState, { giftSent: true, giftData, currentStep: 'gift_received' });
  addLog(`🎉 Admin đã gửi quà: ${giftData.formattedAmount}`);
  io.emit('gift_sent', giftData);
  io.emit('session_updated', sessionState);
  res.json({ success: true, giftData, session: sessionState });
});

app.post('/api/reset-session', (req, res) => {
  sessionState = loadSession();
  Object.assign(sessionState, {
    giftClaimed: false,
    giftSent: false,
    claimedAt: null,
    giftData: null,
    currentStep: sessionState.girlfriendOnline ? 'intro' : 'idle'
  });
  addLog('🔄 Đặt lại trạng thái phiên nhận quà.');
  io.emit('session_reset', sessionState);
  io.emit('session_updated', sessionState);
  res.json({ success: true, session: sessionState });
});

io.on('connection', (socket) => {
  const role = socket.handshake.query.role || 'client';
  socket.emit('init_data', { config: appConfig, session: sessionState });
  if (role === 'girlfriend') {
    sessionState.girlfriendOnline = true;
    if (sessionState.currentStep === 'idle') sessionState.currentStep = 'intro';
    addLog('🎀 Bạn gái vừa mở trang Web 20/10!');
    io.emit('session_updated', sessionState);
  }
  socket.on('girlfriend_opened_envelope', () => {
    sessionState.currentStep = 'reading_letter';
    addLog('💌 Bạn gái vừa mở phong bì & đang đọc sổ tay 20/10!');
    io.emit('session_updated', sessionState);
  });
  socket.on('step_change', (step) => {
    sessionState.currentStep = step;
    addLog(`📍 Trạng thái: ${step}`);
    io.emit('session_updated', sessionState);
  });
  socket.on('claim_gift', () => {
    Object.assign(sessionState, { giftClaimed: true, claimedAt: new Date().toLocaleTimeString('vi-VN'), currentStep: 'waiting_gift' });
    addLog('🚨 BẠN GÁI ĐÃ BẤM NHẬN QUÀ 20/10!');
    io.emit('gift_claimed_alert', { claimedAt: sessionState.claimedAt, session: sessionState });
    io.emit('session_updated', sessionState);
  });
  socket.on('disconnect', () => {
    if (role === 'girlfriend') {
      const sockets = Array.from(io.sockets.sockets.values());
      sessionState.girlfriendOnline = sockets.some(s => s.id !== socket.id && s.handshake.query.role === 'girlfriend');
      io.emit('session_updated', sessionState);
    }
  });
});

if (require.main === module) {
  server.listen(PORT, () => console.log(`http://localhost:${PORT} | Admin: http://localhost:${PORT}/admin`));
}

module.exports = app;
