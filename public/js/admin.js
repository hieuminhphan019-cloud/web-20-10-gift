const isServerlessHost = window.location.hostname.includes('vercel.app');
const socket = (!isServerlessHost && typeof io === 'function')
  ? io({ query: { role: 'admin' } })
  : { on() {}, emit() {} };

let pastedImageBase64 = '';
let alarmInterval = null;
let audioCtx = null;

function playAlarmBeep() {
  try {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const now = audioCtx.currentTime;
    [880, 1174.66, 880, 1318.5].forEach((freq, idx) => {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, now + idx * 0.14);
      gain.gain.setValueAtTime(0.12, now + idx * 0.14);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.14 + 0.12);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start(now + idx * 0.14);
      osc.stop(now + idx * 0.14 + 0.12);
    });
  } catch (e) {}
}

function startAlarm() {
  document.getElementById('claimAlertBanner').classList.remove('hidden');
  playAlarmBeep();
  if (alarmInterval) clearInterval(alarmInterval);
  alarmInterval = setInterval(playAlarmBeep, 2000);
}

function stopAlarm() {
  if (alarmInterval) clearInterval(alarmInterval);
  alarmInterval = null;
  document.getElementById('claimAlertBanner').classList.add('hidden');
}

document.getElementById('muteAlarmBtn').addEventListener('click', stopAlarm);

// Chuyển đổi Tab
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById(btn.dataset.tab).classList.add('active');
  });
});

// Cập nhật trạng thái phiên trực tiếp
const stepLabels = {
  idle: 'Chưa mở trang',
  intro: 'Đang ở màn hình Phong bì 3D mở đầu',
  reading_letter: 'Đã mở phong bì - Đang đọc thư & xem animation 20/10',
  waiting_gift: '🚨 ĐÃ BẤM NHẬN QUÀ - Đang chờ bạn chuyển khoản!',
  gift_received: '🎉 Đã nhận hiệu ứng nổ tiền & ảnh bill thành công!'
};

function renderSession(session) {
  if (!session) return;
  const stOnline = document.getElementById('stOnline');
  stOnline.textContent = session.girlfriendOnline ? '🟢 Đang trực tuyến (Online)' : '⚪ Chưa mở / Đã đóng tab';
  stOnline.className = session.girlfriendOnline ? 'badge-on' : 'badge-off';

  document.getElementById('stStep').textContent = stepLabels[session.currentStep] || session.currentStep;

  const stClaimed = document.getElementById('stClaimed');
  stClaimed.textContent = session.giftClaimed ? `🚨 Đã bấm lúc ${session.claimedAt}` : 'Chưa bấm';
  stClaimed.className = session.giftClaimed ? 'badge-warn' : 'badge-off';

  const stSent = document.getElementById('stSent');
  stSent.textContent = session.giftSent && session.giftData
    ? `✅ Đã bắn ${session.giftData.formattedAmount} (${session.giftData.sentAt})`
    : 'Chưa gửi';
  stSent.className = session.giftSent ? 'badge-on' : 'badge-off';

  const logList = document.getElementById('historyLogList');
  logList.innerHTML = (session.historyLogs || [])
    .map(item => `<li><span>[${item.time}]</span> ${item.message}</li>`)
    .join('');
}

// Đổ dữ liệu cấu hình văn bản & nhạc nền vào Form CMS
function populateCmsForm(cfg) {
  if (!cfg) return;
  const setVal = (id, v) => { const el = document.getElementById(id); if (el) el.value = v !== undefined && v !== null ? v : ''; };

  // Hiển thị trạng thái nhạc nền
  const musicStatus = document.getElementById('musicUploadStatus');
  const musicPreview = document.getElementById('adminMusicPreview');
  if (cfg.musicUrl) {
    if (musicStatus) {
      musicStatus.textContent = `🎵 Đang dùng nhạc: ${cfg.musicName || cfg.musicUrl} (Tự động phát lặp lại từ đầu)`;
      musicStatus.style.color = '#2b8a3e';
    }
    if (musicPreview && musicPreview.getAttribute('src') !== cfg.musicUrl) {
      musicPreview.src = cfg.musicUrl;
    }
  } else {
    if (musicStatus) {
      musicStatus.textContent = '🔇 Chưa có bài nhạc nào được tải lên (Đã tắt nhạc mặc định).';
      musicStatus.style.color = '#d6336c';
    }
    if (musicPreview) {
      musicPreview.pause();
      musicPreview.removeAttribute('src');
    }
  }

  setVal('cfg_pageTitle', cfg.pageTitle);
  setVal('cfg_musicBtnLabel', cfg.musicBtnLabel);
  setVal('cfg_cursorParticles', cfg.cursorParticles);
  setVal('cfg_dateBadge', cfg.dateBadge);
  setVal('cfg_envelopeTitle', cfg.envelopeTitle);
  setVal('cfg_envelopeSubtitle', cfg.envelopeSubtitle);
  setVal('cfg_stickerLeft', cfg.stickerLeft);
  setVal('cfg_stickerRight', cfg.stickerRight);
  setVal('cfg_recipientName', cfg.recipientName);
  setVal('cfg_envelopeMiniTag', cfg.envelopeMiniTag);
  setVal('cfg_tapHint', cfg.tapHint);
  setVal('cfg_continueTapHint', cfg.continueTapHint);

  setVal('cfg_crownBadge', cfg.crownBadge);
  setVal('cfg_heroTitle', cfg.heroTitle);
  setVal('cfg_heroSubtitle', cfg.heroSubtitle);

  if (Array.isArray(cfg.storyCards)) {
    cfg.storyCards.forEach((c, i) => {
      setVal(`cfg_cardStamp${i}`, c.stamp);
      setVal(`cfg_cardIcon${i}`, c.icon);
      setVal(`cfg_cardTitle${i}`, c.title);
      setVal(`cfg_cardText${i}`, c.text);
    });
  }

  setVal('cfg_chalkboardTitle', cfg.chalkboardTitle);
  setVal('cfg_chalkLine1', cfg.chalkLine1);
  setVal('cfg_chalkLine2', cfg.chalkLine2);
  setVal('cfg_chalkBtnText', cfg.chalkBtnText);
  setVal('cfg_chalkStickers', Array.isArray(cfg.chalkStickers) ? cfg.chalkStickers.join('\n') : '');

  setVal('cfg_potTitle', cfg.potTitle);
  setVal('cfg_potStatus0', cfg.potStatus0);
  setVal('cfg_potStatus1', cfg.potStatus1);
  setVal('cfg_potStatus2', cfg.potStatus2);
  setVal('cfg_potStatus3', cfg.potStatus3);
  setVal('cfg_potBtnText', cfg.potBtnText);
  setVal('cfg_potBtnBloomedText', cfg.potBtnBloomedText);

  setVal('cfg_letterDecorTop', cfg.letterDecorTop);
  setVal('cfg_letterGreeting', cfg.letterGreeting);
  setVal('cfg_letterContent', cfg.letterContent);
  setVal('cfg_stampLine1', cfg.stampLine1);
  setVal('cfg_stampLine2', cfg.stampLine2);
  setVal('cfg_stampLine3', cfg.stampLine3);
  setVal('cfg_letterClosing', cfg.letterClosing);
  setVal('cfg_senderName', cfg.senderName);

  setVal('cfg_giftSectionTitle', cfg.giftSectionTitle);
  setVal('cfg_giftSectionSubtitle', cfg.giftSectionSubtitle);
  setVal('cfg_giftComicBurst', cfg.giftComicBurst);
  setVal('cfg_giftButtonText', cfg.giftButtonText);

  setVal('cfg_waitingTitle', cfg.waitingTitle);
  setVal('cfg_waitingMessages', Array.isArray(cfg.waitingMessages) ? cfg.waitingMessages.join('\n') : '');
  setVal('cfg_waitingNote', cfg.waitingNote);

  setVal('cfg_rewardBadge', cfg.rewardBadge);
  setVal('cfg_rewardTitle', cfg.rewardTitle);
  setVal('cfg_rewardSubtitle', cfg.rewardSubtitle);
  setVal('cfg_chequeBankName', cfg.chequeBankName);
  setVal('cfg_chequeCode', cfg.chequeCode);
  setVal('cfg_chequeCurrency', cfg.chequeCurrency);
  setVal('cfg_chequeRecipientLabel', cfg.chequeRecipientLabel);
  setVal('cfg_chequePaidStamp', cfg.chequePaidStamp);
  setVal('cfg_defaultGiftMessage', cfg.defaultGiftMessage);
  setVal('cfg_billHeader', cfg.billHeader);
  setVal('cfg_polaroidCaption', cfg.polaroidCaption);
  setVal('cfg_replayBtnText', cfg.replayBtnText);

  const giftMsgInput = document.getElementById('giftMessageInput');
  if (giftMsgInput && !giftMsgInput.value) giftMsgInput.value = cfg.defaultGiftMessage || '';
}

// Xử lý chọn nhanh số tiền & format dấu chấm
const amountInput = document.getElementById('giftAmountInput');
amountInput.addEventListener('input', () => {
  const raw = amountInput.value.replace(/[^\d]/g, '');
  amountInput.value = raw ? Number(raw).toLocaleString('vi-VN') : '';
});

document.querySelectorAll('.chip').forEach(chip => {
  chip.addEventListener('click', () => {
    amountInput.value = Number(chip.dataset.val).toLocaleString('vi-VN');
  });
});

// Xử lý chọn ảnh hoặc Ctrl + V dán ảnh Bill
const billFileInput = document.getElementById('billFileInput');
const billPreviewBox = document.getElementById('billPreviewBox');
const billPreviewImg = document.getElementById('billPreviewImg');

billFileInput.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (file) {
    pastedImageBase64 = '';
    billPreviewImg.src = URL.createObjectURL(file);
    billPreviewBox.classList.remove('hidden');
  }
});

window.addEventListener('paste', (e) => {
  const items = (e.clipboardData || e.originalEvent.clipboardData).items;
  for (const item of items) {
    if (item.type.indexOf('image') === 0) {
      const blob = item.getAsFile();
      const reader = new FileReader();
      reader.onload = (ev) => {
        pastedImageBase64 = ev.target.result;
        billFileInput.value = '';
        billPreviewImg.src = pastedImageBase64;
        billPreviewBox.classList.remove('hidden');
      };
      reader.readAsDataURL(blob);
    }
  }
});

document.getElementById('removeBillBtn').addEventListener('click', () => {
  billFileInput.value = '';
  pastedImageBase64 = '';
  billPreviewImg.src = '';
  billPreviewBox.classList.add('hidden');
});

// Gửi quà & ảnh Bill sang màn hình bạn gái
document.getElementById('sendGiftForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  stopAlarm();
  const btn = document.getElementById('submitGiftBtn');
  const oldText = btn.textContent;
  btn.textContent = '⏳ Đang bắn pháo hoa & quà sang màn hình bạn gái...';
  btn.disabled = true;

  try {
    const formData = new FormData();
    formData.append('amount', amountInput.value);
    formData.append('message', document.getElementById('giftMessageInput').value);
    if (billFileInput.files[0]) {
      formData.append('billImage', billFileInput.files[0]);
    } else if (pastedImageBase64) {
      formData.append('pastedImageBase64', pastedImageBase64);
    }

    const res = await fetch('/api/send-gift', { method: 'POST', body: formData });
    const data = await res.json();
    if (data.success) {
      btn.textContent = '✅ ĐÃ NỔ QUÀ TRÊN MÀN HÌNH BẠN GÁI THÀNH CÔNG!';
      setTimeout(() => { btn.textContent = oldText; btn.disabled = false; }, 2500);
    }
  } catch (err) {
    alert('Lỗi khi gửi quà: ' + err.message);
    btn.textContent = oldText;
    btn.disabled = false;
  }
});

// Xử lý Upload Nhạc Nền (Tự động lặp lại từ đầu)
const musicFileInput = document.getElementById('musicFileInput');
const uploadMusicBtn = document.getElementById('uploadMusicBtn');
const deleteMusicBtn = document.getElementById('deleteMusicBtn');

if (uploadMusicBtn && musicFileInput) {
  uploadMusicBtn.addEventListener('click', async () => {
    if (!musicFileInput.files || !musicFileInput.files[0]) {
      alert('Vui lòng chọn một file nhạc (.mp3, .m4a, .wav...) trước khi bấm Tải Lên!');
      return;
    }
    const oldText = uploadMusicBtn.textContent;
    uploadMusicBtn.textContent = '⏳ Đang tải nhạc lên...';
    uploadMusicBtn.disabled = true;
    try {
      const formData = new FormData();
      formData.append('musicFile', musicFileInput.files[0]);
      const res = await fetch('/api/upload-music', { method: 'POST', body: formData });
      const data = await res.json();
      if (data.success) {
        musicFileInput.value = '';
        populateCmsForm(data.config);
      } else {
        alert(data.message || 'Lỗi khi tải nhạc lên!');
      }
    } catch (err) {
      alert('Lỗi khi tải nhạc: ' + err.message);
    }
    uploadMusicBtn.textContent = oldText;
    uploadMusicBtn.disabled = false;
  });
}

if (deleteMusicBtn) {
  deleteMusicBtn.addEventListener('click', async () => {
    const res = await fetch('/api/delete-music', { method: 'POST' });
    const data = await res.json();
    if (data.success) populateCmsForm(data.config);
  });
}

// Lưu chỉnh sửa toàn bộ văn bản & bức thư 20/10 (CMS)
document.getElementById('cmsForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const getVal = (id) => {
    const el = document.getElementById(id);
    return el ? el.value : '';
  };
  const payload = {
    pageTitle: getVal('cfg_pageTitle'),
    musicBtnLabel: getVal('cfg_musicBtnLabel'),
    cursorParticles: getVal('cfg_cursorParticles'),
    dateBadge: getVal('cfg_dateBadge'),
    envelopeTitle: getVal('cfg_envelopeTitle'),
    envelopeSubtitle: getVal('cfg_envelopeSubtitle'),
    stickerLeft: getVal('cfg_stickerLeft'),
    stickerRight: getVal('cfg_stickerRight'),
    recipientName: getVal('cfg_recipientName'),
    envelopeMiniTag: getVal('cfg_envelopeMiniTag'),
    tapHint: getVal('cfg_tapHint'),
    continueTapHint: getVal('cfg_continueTapHint'),
    crownBadge: getVal('cfg_crownBadge'),
    heroTitle: getVal('cfg_heroTitle'),
    heroSubtitle: getVal('cfg_heroSubtitle'),
    storyCards: [
      { stamp: getVal('cfg_cardStamp0'), icon: getVal('cfg_cardIcon0'), title: getVal('cfg_cardTitle0'), text: getVal('cfg_cardText0') },
      { stamp: getVal('cfg_cardStamp1'), icon: getVal('cfg_cardIcon1'), title: getVal('cfg_cardTitle1'), text: getVal('cfg_cardText1') },
      { stamp: getVal('cfg_cardStamp2'), icon: getVal('cfg_cardIcon2'), title: getVal('cfg_cardTitle2'), text: getVal('cfg_cardText2') }
    ],
    chalkboardTitle: getVal('cfg_chalkboardTitle'),
    chalkLine1: getVal('cfg_chalkLine1'),
    chalkLine2: getVal('cfg_chalkLine2'),
    chalkBtnText: getVal('cfg_chalkBtnText'),
    chalkStickers: getVal('cfg_chalkStickers').split('\n').map(s => s.trim()).filter(Boolean),
    potTitle: getVal('cfg_potTitle'),
    potStatus0: getVal('cfg_potStatus0'),
    potStatus1: getVal('cfg_potStatus1'),
    potStatus2: getVal('cfg_potStatus2'),
    potStatus3: getVal('cfg_potStatus3'),
    potBtnText: getVal('cfg_potBtnText'),
    potBtnBloomedText: getVal('cfg_potBtnBloomedText'),
    letterDecorTop: getVal('cfg_letterDecorTop'),
    letterGreeting: getVal('cfg_letterGreeting'),
    letterContent: getVal('cfg_letterContent'),
    stampLine1: getVal('cfg_stampLine1'),
    stampLine2: getVal('cfg_stampLine2'),
    stampLine3: getVal('cfg_stampLine3'),
    letterClosing: getVal('cfg_letterClosing'),
    senderName: getVal('cfg_senderName'),
    giftSectionTitle: getVal('cfg_giftSectionTitle'),
    giftSectionSubtitle: getVal('cfg_giftSectionSubtitle'),
    giftComicBurst: getVal('cfg_giftComicBurst'),
    giftButtonText: getVal('cfg_giftButtonText'),
    waitingTitle: getVal('cfg_waitingTitle'),
    waitingMessages: getVal('cfg_waitingMessages').split('\n').map(s => s.trim()).filter(Boolean),
    waitingNote: getVal('cfg_waitingNote'),
    rewardBadge: getVal('cfg_rewardBadge'),
    rewardTitle: getVal('cfg_rewardTitle'),
    rewardSubtitle: getVal('cfg_rewardSubtitle'),
    chequeBankName: getVal('cfg_chequeBankName'),
    chequeCode: getVal('cfg_chequeCode'),
    chequeCurrency: getVal('cfg_chequeCurrency'),
    chequeRecipientLabel: getVal('cfg_chequeRecipientLabel'),
    chequePaidStamp: getVal('cfg_chequePaidStamp'),
    defaultGiftMessage: getVal('cfg_defaultGiftMessage'),
    billHeader: getVal('cfg_billHeader'),
    polaroidCaption: getVal('cfg_polaroidCaption'),
    replayBtnText: getVal('cfg_replayBtnText')
  };

  const res = await fetch('/api/config', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const data = await res.json();
  if (data.success) {
    const st = document.getElementById('cmsSaveStatus');
    st.textContent = '✅ Đã lưu và cập nhật trực tiếp toàn bộ chữ sang trang bạn gái!';
    setTimeout(() => { st.textContent = ''; }, 3000);
  }
});

// Khôi phục nội dung chữ mặc định
document.getElementById('resetDefaultTextBtn').addEventListener('click', async () => {
  if (!confirm('Bạn có chắc muốn khôi phục toàn bộ câu chữ và bức thư về mặc định ban đầu?')) return;
  const res = await fetch('/api/config/reset-default', { method: 'POST' });
  const data = await res.json();
  if (data.success) populateCmsForm(data.config);
});

// Reset phiên nhận quà để test lại
document.getElementById('resetSessionBtn').addEventListener('click', async () => {
  stopAlarm();
  await fetch('/api/reset-session', { method: 'POST' });
});

// Lắng nghe sự kiện Socket.IO & HTTP Polling dự phòng cho Serverless
let lastClaimedState = false;
let formPopulated = false;

async function pollAdminState() {
  try {
    const res = await fetch('/api/state');
    const data = await res.json();
    if (data.config && !formPopulated) {
      formPopulated = true;
      populateCmsForm(data.config);
    }
    if (data.session) {
      renderSession(data.session);
      if (data.session.giftClaimed && !data.session.giftSent) {
        if (!lastClaimedState) {
          lastClaimedState = true;
          startAlarm();
        }
      } else {
        lastClaimedState = false;
      }
    }
  } catch (e) {}
}

pollAdminState();
setInterval(pollAdminState, 2500);

socket.on('init_data', ({ config, session }) => {
  formPopulated = true;
  populateCmsForm(config);
  renderSession(session);
  if (session.giftClaimed && !session.giftSent) {
    lastClaimedState = true;
    startAlarm();
  }
});
socket.on('session_updated', renderSession);
socket.on('config_updated', populateCmsForm);
socket.on('gift_claimed_alert', () => {
  lastClaimedState = true;
  startAlarm();
});

