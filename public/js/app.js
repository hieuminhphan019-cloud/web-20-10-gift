const socket = io({ query: { role: 'girlfriend' } });

let currentScene = 'intro';
let musicPlaying = false;
let currentMusicUrl = '';
let envelopeOpenedWaitingTap = false;
let waitingMsgTimer = null;
let waitingMessages = [
  'Ting ting! Anh ấy vừa nhận được tín hiệu đòi quà 20/10 của em rồi nha... 🎀',
  'Anh đang mở app ngân hàng với tốc độ ánh sáng để bắn lì xì cho công chúa 💸...',
  'Đang gói ghém thật nhiều trà sữa, dâu tây kèm "vitamin ting ting"... 🍓🧋',
  'Đợi anh một xíu xiu thôi nha, giữ nguyên màn hình để đón mưa pháo hoa nhé! ✨'
];
let customCursorSymbols = ['🎀', '👑', '🌷', '🍓', '🧋', '💖', '✨', '🌸', 'Xinh xỉu!'];
let customChalkStickers = [
  '👑 Xinh Đẹp Tuyệt Trần',
  '🧋 Trà Sữa Full Topping',
  '🎀 Ngoan Xinh Yêu Của Anh',
  '💖 Cưng Chiều Số 1 Vũ Trụ',
  '🍓 Ngọt Ngào Hơn Kẹo Bông',
  '💄 Rạng Rỡ Ngày 20/10',
  '🌷 1000 Điểm Đáng Yêu'
];
let potTexts = {
  status0: 'Chạm để tưới trà sữa & vitamin yêu thương cho hoa nở rộ nhé! (0/3)',
  status1: 'Mầm hoa hồng đã nhú lá non rồi kìa! Tưới thêm trà sữa nhé (1/3) 🌱',
  status2: 'Cây lớn nhanh quá! Tưới thêm 1 lần nữa để hoa hồng 20/10 nở bung nha (2/3) 🌷',
  status3: '🎉 Hoa Hồng Tình Yêu 20/10 đã nở rộ tặng Công Chúa Nhỏ Của Anh! 🌷🎀',
  btnDefault: '🍓 Tưới Vitamin Ngọt Ngào',
  btnBloomed: '🌷 Hoa Đã Nở Rộ (Bấm Thả Thêm Tim)'
};
let tapHintDefault = '✨ Chạm vào con dấu hoa để mở quà 20/10 nhé! ✨';
let continueTapHintText = '💌 Lá thư đã mở! Chạm bất kỳ đâu vào màn hình để bước vào sổ tay 20/10 nhé ✨';
let plantWaterCount = 0;

// ==================== 1. BỘ TẠO ÂM THANH MUSIC BOX & HIỆU ỨNG VẼ TAY ====================
const AudioFX = {
  ctx: null,
  init() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) this.ctx = new AudioCtx();
    }
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  },
  playNote(freq, duration = 0.35, type = 'triangle', vol = 0.08, delay = 0) {
    try {
      this.init();
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const now = this.ctx.currentTime + delay;
      osc.type = type;
      osc.frequency.setValueAtTime(freq, now);
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(vol, now + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0008, now + duration);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + duration);
    } catch (e) {}
  },
  playPop() {
    this.playNote(520, 0.12, 'sine', 0.09, 0);
    this.playNote(780, 0.16, 'triangle', 0.08, 0.05);
  },
  playWaterDrop() {
    this.playNote(660, 0.1, 'sine', 0.1, 0);
    this.playNote(990, 0.15, 'sine', 0.09, 0.06);
    this.playNote(1320, 0.2, 'triangle', 0.07, 0.12);
  },
  playStamp() {
    this.playNote(140, 0.18, 'sawtooth', 0.12, 0);
    this.playNote(620, 0.25, 'triangle', 0.09, 0.08);
  },
  playEnvelopeOpen() {
    const notes = [523.25, 659.25, 783.99, 1046.5, 1318.5];
    notes.forEach((f, i) => this.playNote(f, 0.45, 'triangle', 0.09, i * 0.08));
  },
  playRewardFanfare() {
    const chord = [523.25, 659.25, 783.99, 1046.5, 1318.5, 1567.98];
    chord.forEach((f, i) => this.playNote(f, 0.65, 'triangle', 0.11, i * 0.09));
  }
};

function syncMusicPlayer(url) {
  const audio = document.getElementById('bgMusicPlayer');
  const btn = document.getElementById('musicToggle') || document.getElementById('musicToggleBtn');
  if (!audio) return;
  audio.loop = true;

  const nextUrl = url || '';
  if (nextUrl !== currentMusicUrl) {
    currentMusicUrl = nextUrl;
    if (currentMusicUrl) {
      audio.src = currentMusicUrl;
      audio.load();
      if (musicPlaying) {
        audio.play().catch(() => {});
      }
    } else {
      audio.pause();
      audio.removeAttribute('src');
      musicPlaying = false;
      if (btn) btn.classList.remove('playing');
    }
  }
}

function toggleMusic(forcePlay = null) {
  const btn = document.getElementById('musicToggle') || document.getElementById('musicToggleBtn');
  const audio = document.getElementById('bgMusicPlayer');
  if (!audio || !currentMusicUrl) {
    musicPlaying = false;
    if (btn) btn.classList.remove('playing');
    return;
  }
  audio.loop = true;
  const shouldPlay = forcePlay !== null ? forcePlay : !musicPlaying;
  if (shouldPlay) {
    audio.play().then(() => {
      musicPlaying = true;
      if (btn) btn.classList.add('playing');
    }).catch(() => {
      musicPlaying = false;
      if (btn) btn.classList.remove('playing');
    });
  } else {
    audio.pause();
    musicPlaying = false;
    if (btn) btn.classList.remove('playing');
  }
}

// ==================== 2. HIỆU ỨNG STOP-MOTION LINE BOIL (NÉT VẼ RUNG NHẸ 8FPS) ====================
function initStopMotionLineBoil() {
  const disp = document.querySelector('#wobblyLine feDisplacementMap');
  if (!disp) return;
  let scaleToggle = false;
  setInterval(() => {
    scaleToggle = !scaleToggle;
    disp.setAttribute('scale', scaleToggle ? '2.4' : '1.7');
  }, 140);
}

// ==================== 3. HIỆU ỨNG NÉT BÚT SVG TỰ VẼ (SELF-DRAWING DOODLES) ====================
function animateSvgStrokes(container = document) {
  const paths = container.querySelectorAll('.draw-path, .chalk-path');
  paths.forEach((path, idx) => {
    try {
      const len = path.getTotalLength ? path.getTotalLength() : 180;
      path.style.strokeDasharray = len;
      path.style.strokeDashoffset = len;
      if (window.gsap) {
        gsap.to(path, {
          strokeDashoffset: 0,
          duration: 1.4 + (idx % 4) * 0.35,
          delay: (idx % 5) * 0.12,
          ease: 'power2.out'
        });
      } else {
        path.style.strokeDashoffset = 0;
      }
    } catch (e) {}
  });
}

// ==================== 4. CANVAS VẼ TAY PASTEL (HOA CÚC, MÁY BAY GIẤY, SAO, TIM) ====================
function initSketchCanvas() {
  const canvas = document.getElementById('petalsCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  let w = (canvas.width = window.innerWidth);
  let h = (canvas.height = window.innerHeight);
  window.addEventListener('resize', () => {
    w = canvas.width = window.innerWidth;
    h = canvas.height = window.innerHeight;
  });

  const palette = ['#ffd6e0', '#fff1b5', '#d8f3dc', '#dcebff', '#eadcf8', '#ffb3c6'];
  const shapes = ['daisy', 'star', 'heart', 'plane', 'leaf'];
  const items = Array.from({ length: 34 }, () => ({
    x: Math.random() * w,
    y: Math.random() * h,
    size: 11 + Math.random() * 11,
    vx: (Math.random() - 0.5) * 0.8,
    vy: 0.55 + Math.random() * 1.1,
    rot: Math.random() * Math.PI * 2,
    vRot: (Math.random() - 0.5) * 0.025,
    sway: Math.random() * Math.PI * 2,
    color: palette[Math.floor(Math.random() * palette.length)],
    type: shapes[Math.floor(Math.random() * shapes.length)]
  }));

  function drawHandItem(it) {
    ctx.save();
    ctx.translate(it.x, it.y);
    ctx.rotate(it.rot);
    ctx.strokeStyle = '#3d312a';
    ctx.lineWidth = 1.8;
    ctx.fillStyle = it.color;

    if (it.type === 'daisy') {
      for (let i = 0; i < 5; i++) {
        ctx.save();
        ctx.rotate((i * Math.PI * 2) / 5);
        ctx.beginPath();
        ctx.arc(0, -it.size * 0.55, it.size * 0.36, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      }
      ctx.beginPath();
      ctx.fillStyle = '#fff1b5';
      ctx.arc(0, 0, it.size * 0.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    } else if (it.type === 'star') {
      ctx.beginPath();
      for (let i = 0; i < 5; i++) {
        const a1 = (i * 2 * Math.PI) / 5 - Math.PI / 2;
        const a2 = a1 + Math.PI / 5;
        ctx.lineTo(Math.cos(a1) * it.size * 0.75, Math.sin(a1) * it.size * 0.75);
        ctx.lineTo(Math.cos(a2) * it.size * 0.35, Math.sin(a2) * it.size * 0.35);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    } else if (it.type === 'heart') {
      const s = it.size * 0.06;
      ctx.beginPath();
      ctx.moveTo(0, 3 * s);
      ctx.bezierCurveTo(0, 0, -8 * s, 0, -8 * s, 5 * s);
      ctx.bezierCurveTo(-8 * s, 10 * s, 0, 13 * s, 0, 16 * s);
      ctx.bezierCurveTo(0, 13 * s, 8 * s, 10 * s, 8 * s, 5 * s);
      ctx.bezierCurveTo(8 * s, 0, 0, 0, 0, 3 * s);
      ctx.fill();
      ctx.stroke();
    } else if (it.type === 'plane') {
      const s = it.size * 0.7;
      ctx.beginPath();
      ctx.moveTo(-s, -s * 0.4);
      ctx.lineTo(s, 0);
      ctx.lineTo(-s * 0.3, s * 0.6);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.ellipse(0, 0, it.size * 0.65, it.size * 0.34, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
    ctx.restore();
  }

  function tick() {
    ctx.clearRect(0, 0, w, h);
    items.forEach((it) => {
      it.sway += 0.025;
      it.x += it.vx + Math.sin(it.sway) * 0.45;
      it.y += it.vy;
      it.rot += it.vRot;
      if (it.y > h + 30) {
        it.y = -25;
        it.x = Math.random() * w;
      }
      if (it.x > w + 30) it.x = -25;
      if (it.x < -30) it.x = w + 25;
      drawHandItem(it);
    });
    requestAnimationFrame(tick);
  }
  tick();
}

// ==================== 5. VỆT HOA NỞ THEO CHUỘT & CLICK NỔ STICKER VẼ TAY ====================
function spawnDoodleParticle(x, y, burst = false) {
  const symbols = customCursorSymbols.length ? customCursorSymbols : ['🎀', '👑', '🌷', '🍓', '🧋', '💖', '✨', '🌸', 'Xinh xỉu!'];
  const colors = ['#ff6b8b', '#f4a261', '#2a9d8f', '#8338ec', '#e76f51', '#3d312a'];
  const el = document.createElement('div');
  el.className = 'cursor-doodle-particle';
  el.textContent = symbols[Math.floor(Math.random() * symbols.length)];
  el.style.left = `${x}px`;
  el.style.top = `${y}px`;
  el.style.color = colors[Math.floor(Math.random() * colors.length)];
  el.style.fontSize = burst ? `${18 + Math.random() * 14}px` : `${14 + Math.random() * 8}px`;
  document.body.appendChild(el);

  const dx = (Math.random() - 0.5) * (burst ? 160 : 55);
  const dy = burst ? -40 - Math.random() * 110 : -25 - Math.random() * 35;
  const rot = (Math.random() - 0.5) * 90;

  if (window.gsap) {
    gsap.fromTo(
      el,
      { scale: 0.4, opacity: 1, rotation: 0 },
      {
        x: dx,
        y: dy,
        scale: burst ? 1.25 : 1,
        rotation: rot,
        opacity: 0,
        duration: burst ? 1.05 : 0.75,
        ease: 'power2.out',
        onComplete: () => el.remove()
      }
    );
  } else {
    setTimeout(() => el.remove(), 700);
  }
}

function initCursorDoodleTrail() {
  let lastTime = 0;
  window.addEventListener('pointermove', (e) => {
    const now = Date.now();
    if (now - lastTime > 65) {
      lastTime = now;
      spawnDoodleParticle(e.clientX, e.clientY, false);
    }
  });
  window.addEventListener('pointerdown', (e) => {
    for (let i = 0; i < 8; i++) {
      spawnDoodleParticle(e.clientX, e.clientY, true);
    }
  });
}

// ==================== 6. GÓC TƯƠNG TÁC 20/10: GƯƠNG THẦN NỊNH BẠN GÁI & CHẬU HOA HỒNG ====================
function initClassroomInteractions() {
  const addChalkBtn = document.getElementById('addChalkDoodleBtn');
  const chalkArea = document.getElementById('chalkCustomStickers');
  let chalkIdx = 0;

  if (addChalkBtn && chalkArea) {
    addChalkBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      AudioFX.playPop();
      const list = customChalkStickers.length ? customChalkStickers : ['👑 Xinh Đẹp Tuyệt Trần'];
      const tag = document.createElement('span');
      tag.className = 'chalk-mini-item';
      tag.textContent = list[chalkIdx % list.length];
      chalkIdx++;
      chalkArea.appendChild(tag);
      const rect = addChalkBtn.getBoundingClientRect();
      for (let i = 0; i < 6; i++) spawnDoodleParticle(rect.left + rect.width / 2, rect.top, true);
    });
  }

  // Tưới yêu thương cho Chậu Hoa Hồng 20/10
  const waterBtn = document.getElementById('waterPlantBtn');
  const dropsWrap = document.getElementById('waterDropsContainer');
  const stem = document.getElementById('stemPath');
  const leafL = document.getElementById('leafLeft');
  const leafR = document.getElementById('leafRight');
  const bloom = document.getElementById('bloomFlowerGroup');
  const statusTxt = document.getElementById('potStatusText');

  if (waterBtn) {
    waterBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      AudioFX.playWaterDrop();
      plantWaterCount++;

      if (dropsWrap) {
        for (let i = 0; i < 5; i++) {
          const drop = document.createElement('span');
          drop.className = 'water-drop-anim';
          drop.textContent = i % 2 === 0 ? '🍓' : '💖';
          drop.style.left = `${45 + Math.random() * 70}px`;
          drop.style.top = `${5 + Math.random() * 20}px`;
          dropsWrap.appendChild(drop);
          setTimeout(() => drop.remove(), 750);
        }
      }

      if (plantWaterCount === 1) {
        if (stem) stem.style.strokeDashoffset = '35';
        if (leafL) leafL.style.transform = 'scale(1)';
        if (statusTxt) statusTxt.textContent = potTexts.status1;
      } else if (plantWaterCount === 2) {
        if (stem) stem.style.strokeDashoffset = '0';
        if (leafR) leafR.style.transform = 'scale(1)';
        if (statusTxt) statusTxt.textContent = potTexts.status2;
      } else {
        if (bloom) bloom.style.transform = 'scale(1.15)';
        if (statusTxt) statusTxt.textContent = potTexts.status3;
        waterBtn.textContent = potTexts.btnBloomed;
        AudioFX.playRewardFanfare();
        if (window.confetti) {
          confetti({
            particleCount: 45,
            spread: 70,
            origin: { y: 0.65 },
            colors: ['#ffd6e0', '#fff1b5', '#d8f3dc', '#ff6b8b']
          });
        }
      }
    });
  }

  // Tách trà bốc hương thơm trái tim khi click
  const teacup = document.querySelector('.teacup-doodle');
  if (teacup) {
    teacup.addEventListener('click', (e) => {
      e.stopPropagation();
      AudioFX.playPop();
      const r = teacup.getBoundingClientRect();
      for (let i = 0; i < 10; i++) spawnDoodleParticle(r.left + r.width / 2, r.top + 10, true);
    });
  }

  // Đóng dấu mộc đỏ cuối tâm thư
  const stamp = document.getElementById('teacherAwardStamp');
  if (stamp) {
    stamp.addEventListener('click', (e) => {
      e.stopPropagation();
      AudioFX.playStamp();
      if (window.gsap) {
        gsap.fromTo(
          stamp,
          { scale: 1.7, rotation: -30 },
          { scale: 1, rotation: -14, duration: 0.45, ease: 'bounce.out' }
        );
      }
    });
  }

  // Click vào 3 thẻ Sticky Note để nảy lò xo
  document.querySelectorAll('.story-card').forEach((card) => {
    card.addEventListener('click', () => {
      AudioFX.playPop();
      if (window.gsap) {
        gsap.fromTo(card, { scale: 0.92 }, { scale: 1, duration: 0.5, ease: 'elastic.out(1, 0.4)' });
      }
    });
  });
}

// ==================== 7. MỞ PHONG BÌ ĐA TẦNG & BẮN MÁY BAY GIẤY ====================
function launchPaperPlanesBurst() {
  const icons = ['🎀', '👑', '🌷', '🧋', '🍓', '💖', '✨'];
  for (let i = 0; i < 16; i++) {
    const flyer = document.createElement('div');
    flyer.className = 'cursor-doodle-particle';
    flyer.textContent = icons[i % icons.length];
    flyer.style.left = `${window.innerWidth / 2}px`;
    flyer.style.top = `${window.innerHeight / 2}px`;
    flyer.style.fontSize = `${22 + Math.random() * 16}px`;
    document.body.appendChild(flyer);

    if (window.gsap) {
      const angle = (i / 16) * Math.PI * 2;
      const dist = 140 + Math.random() * 220;
      gsap.to(flyer, {
        x: Math.cos(angle) * dist,
        y: Math.sin(angle) * dist - 80,
        rotation: (Math.random() - 0.5) * 140,
        scale: 1.3,
        opacity: 0,
        duration: 1.25 + Math.random() * 0.4,
        ease: 'power2.out',
        onComplete: () => flyer.remove()
      });
    } else {
      setTimeout(() => flyer.remove(), 1200);
    }
  }
}

// ==================== 8. CHUYỂN PHÂN CẢNH & ANIMATION GSAP ĐA TẦNG ====================
function switchScene(targetId) {
  document.querySelectorAll('.scene').forEach((sec) => sec.classList.remove('active'));
  const target = document.getElementById(targetId);
  if (!target) return;
  target.classList.add('active');
  window.scrollTo({ top: 0, behavior: 'smooth' });
  animateSvgStrokes(target);

  if (window.gsap && targetId === 'sceneStory') {
    gsap.from('.bunting-banner', { y: -40, opacity: 0, duration: 0.7, ease: 'back.out(1.6)' });
    gsap.from('.hero-header', { scale: 0.9, y: 25, opacity: 0, duration: 0.7, delay: 0.1, ease: 'back.out(1.4)' });
    gsap.from('.interactive-classroom-grid > div', {
      y: 35,
      opacity: 0,
      stagger: 0.18,
      duration: 0.75,
      delay: 0.25,
      ease: 'back.out(1.3)'
    });
    gsap.from('.story-card', {
      y: 45,
      rotation: (i) => (i % 2 === 0 ? -8 : 8),
      opacity: 0,
      stagger: 0.16,
      duration: 0.8,
      delay: 0.45,
      ease: 'elastic.out(1, 0.65)'
    });
    gsap.from('#letterCard', {
      y: 50,
      opacity: 0,
      duration: 0.85,
      delay: 0.75,
      ease: 'power3.out',
      onComplete: animateLetterWriting
    });
    gsap.from('#giftCtaBox', { scale: 0.88, opacity: 0, duration: 0.8, delay: 1.05, ease: 'back.out(1.5)' });
  }
}

// Hiệu ứng ngòi bút chạy theo từng dòng tâm thư & đóng dấu mộc đỏ
function animateLetterWriting() {
  const paragraphs = document.querySelectorAll('#txtLetterContent p');
  const pen = document.getElementById('floatingPen');
  const stamp = document.getElementById('teacherAwardStamp');
  if (!window.gsap) return;

  gsap.fromTo(
    paragraphs,
    { opacity: 0.15, x: -12 },
    {
      opacity: 1,
      x: 0,
      stagger: 0.35,
      duration: 0.65,
      ease: 'power2.out',
      onStart: () => {
        if (pen) gsap.to(pen, { x: -120, y: 80, rotation: -18, duration: 1.4, yoyo: true, repeat: 1 });
      },
      onComplete: () => {
        if (stamp) {
          AudioFX.playStamp();
          gsap.fromTo(
            stamp,
            { scale: 2.2, opacity: 0, rotation: -35 },
            { scale: 1, opacity: 1, rotation: -14, duration: 0.55, ease: 'bounce.out' }
          );
        }
      }
    }
  );
}

// ==================== 9. CẬP NHẬT NỘI DUNG TỪ CMS & HIỆU ỨNG BÚT DẠ QUANG ====================
function applyContent(content) {
  if (!content) return;
  const setTxt = (id, val) => {
    const el = document.getElementById(id);
    if (el && val !== undefined && val !== null) el.textContent = val;
  };

  if (content.pageTitle) document.title = content.pageTitle;
  setTxt('txtMusicBtnLabel', content.musicBtnLabel);
  syncMusicPlayer(content.musicUrl);

  if (content.cursorParticles) {
    const parsed = String(content.cursorParticles)
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    if (parsed.length > 0) customCursorSymbols = parsed;
  }

  const badge = content.dateBadge || content.pageBadge;
  setTxt('txtPageBadge', badge);
  setTxt('txtDateBadge', badge);
  setTxt('txtEnvelopeTitle', content.envelopeTitle);
  setTxt('txtEnvelopeSubtitle', content.envelopeSubtitle);
  setTxt('txtStickerLeft', content.stickerLeft);
  setTxt('txtStickerRight', content.stickerRight);
  setTxt('txtEnvelopeRecipient', content.recipientName || content.envelopeRecipient);
  setTxt('txtChequeRecipientName', content.recipientName || content.envelopeRecipient);
  setTxt('txtEnvelopeMiniTag', content.envelopeMiniTag);

  if (content.tapHint) tapHintDefault = content.tapHint;
  if (content.continueTapHint) continueTapHintText = content.continueTapHint;
  setTxt('txtTapHint', envelopeOpenedWaitingTap ? continueTapHintText : tapHintDefault);

  setTxt('txtCrownBadge', content.crownBadge);
  setTxt('txtHeroTitle', content.heroTitle);
  setTxt('txtHeroSubtitle', content.heroSubtitle);

  setTxt('txtChalkboardTitle', content.chalkboardTitle);
  setTxt('chalkTextLine1', content.chalkLine1);
  setTxt('chalkTextLine2', content.chalkLine2);
  setTxt('addChalkDoodleBtn', content.chalkBtnText);
  if (Array.isArray(content.chalkStickers) && content.chalkStickers.length > 0) {
    customChalkStickers = content.chalkStickers;
  }

  setTxt('txtPotTitle', content.potTitle);
  if (content.potStatus0) potTexts.status0 = content.potStatus0;
  if (content.potStatus1) potTexts.status1 = content.potStatus1;
  if (content.potStatus2) potTexts.status2 = content.potStatus2;
  if (content.potStatus3) potTexts.status3 = content.potStatus3;
  if (content.potBtnText) potTexts.btnDefault = content.potBtnText;
  if (content.potBtnBloomedText) potTexts.btnBloomed = content.potBtnBloomedText;

  if (plantWaterCount === 0) {
    setTxt('potStatusText', potTexts.status0);
    setTxt('waterPlantBtn', potTexts.btnDefault);
  } else if (plantWaterCount === 1) {
    setTxt('potStatusText', potTexts.status1);
    setTxt('waterPlantBtn', potTexts.btnDefault);
  } else if (plantWaterCount === 2) {
    setTxt('potStatusText', potTexts.status2);
    setTxt('waterPlantBtn', potTexts.btnDefault);
  } else {
    setTxt('potStatusText', potTexts.status3);
    setTxt('waterPlantBtn', potTexts.btnBloomed);
  }

  if (Array.isArray(content.storyCards)) {
    content.storyCards.forEach((c, i) => {
      if (c.stamp !== undefined) setTxt(`cardStamp${i}`, c.stamp);
      setTxt(`cardIcon${i}`, c.icon);
      setTxt(`cardTitle${i}`, c.title);
      setTxt(`cardText${i}`, c.text);
    });
  }

  setTxt('txtLetterDecorTop', content.letterDecorTop);
  setTxt('txtLetterGreeting', content.letterGreeting);
  const letterBody = document.getElementById('txtLetterContent');
  const paragraphs = Array.isArray(content.letterParagraphs)
    ? content.letterParagraphs
    : String(content.letterContent || '')
        .split(/\n\s*\n/)
        .map((s) => s.trim())
        .filter(Boolean);
  if (letterBody && paragraphs.length > 0) {
    letterBody.innerHTML = paragraphs
      .map((p, idx) => {
        if (idx === paragraphs.length - 1) {
          return `<p><span class="sketch-highlight">${p}</span></p>`;
        }
        return `<p>${p}</p>`;
      })
      .join('');
  }
  setTxt('txtStampLine1', content.stampLine1);
  setTxt('txtStampLine2', content.stampLine2);
  setTxt('txtStampLine3', content.stampLine3);
  setTxt('txtLetterClosing', content.letterClosing);
  setTxt('txtSenderName', content.senderName);

  setTxt('txtGiftSectionTitle', content.giftSectionTitle);
  setTxt('txtGiftSectionSubtitle', content.giftSectionSubtitle);
  setTxt('txtGiftComicBurst', content.giftComicBurst);
  setTxt('txtGiftButtonText', content.giftButtonText);

  setTxt('txtWaitingTitle', content.waitingTitle);
  setTxt('txtWaitingNote', content.waitingNote);
  if (Array.isArray(content.waitingMessages) && content.waitingMessages.length > 0) {
    waitingMessages = content.waitingMessages;
  }

  setTxt('txtRewardBadge', content.rewardBadge);
  setTxt('txtRewardTitle', content.rewardTitle);
  setTxt('txtRewardSubtitle', content.rewardSubtitle);
  setTxt('txtChequeBankName', content.chequeBankName);
  setTxt('txtChequeCode', content.chequeCode);
  setTxt('txtChequeCurrency', content.chequeCurrency);
  setTxt('txtChequeRecipientLabel', content.chequeRecipientLabel);
  setTxt('txtChequePaidStamp', content.chequePaidStamp);
  setTxt('txtBillHeader', content.billHeader);
  setTxt('txtPolaroidCaption', content.polaroidCaption);
  setTxt('replayFireworksBtn', content.replayBtnText);
}

// ==================== 10. MÀN HÌNH CHỜ & MÀN HÌNH NỔ QUÀ ====================
function startWaitingScene() {
  currentScene = 'waiting';
  switchScene('sceneWaiting');
  const msgEl = document.getElementById('txtWaitingDynamic');
  let idx = 0;
  if (msgEl && waitingMessages.length) {
    msgEl.textContent = waitingMessages[0];
    clearInterval(waitingMsgTimer);
    waitingMsgTimer = setInterval(() => {
      idx = (idx + 1) % waitingMessages.length;
      msgEl.textContent = waitingMessages[idx];
      if (window.gsap) {
        gsap.fromTo(msgEl, { y: 10, opacity: 0 }, { y: 0, opacity: 1, duration: 0.4, ease: 'back.out(1.5)' });
      }
    }, 2600);
  }
}

function firePastelConfetti() {
  if (!window.confetti) return;
  const colors = ['#ffd6e0', '#fff1b5', '#d8f3dc', '#dcebff', '#ff6b8b', '#f4a261'];
  confetti({ particleCount: 95, spread: 85, origin: { y: 0.6 }, colors });
  setTimeout(() => confetti({ particleCount: 70, angle: 60, spread: 65, origin: { x: 0 }, colors }), 250);
  setTimeout(() => confetti({ particleCount: 70, angle: 120, spread: 65, origin: { x: 1 }, colors }), 450);
}

function showRewardScene(data) {
  clearInterval(waitingMsgTimer);
  currentScene = 'reward';
  switchScene('sceneReward');
  AudioFX.playRewardFanfare();
  firePastelConfetti();
  launchPaperPlanesBurst();

  const amount = Number(data?.amount) || 2010000;
  const msg = data?.message || 'Chúc công chúa nhỏ của anh ngày 20/10 thật rạng rỡ, đi shopping và ăn ngon cùng anh nhé! Yêu em ❤️';
  const billImageUrl = data?.billUrl || data?.billImage || data?.billImageUrl || '';

  const msgEl = document.getElementById('rewardCustomMessage');
  if (msgEl) msgEl.textContent = msg;

  const billWrap = document.getElementById('billImageWrapper');
  const billImg = document.getElementById('rewardBillImg');
  if (billWrap && billImg) {
    if (billImageUrl) {
      billImg.src = billImageUrl;
      billWrap.classList.remove('hidden');
    } else {
      billWrap.classList.add('hidden');
    }
  }

  const numEl = document.getElementById('rewardAmountNumber');
  if (numEl && window.gsap) {
    const counter = { val: 0 };
    gsap.to(counter, {
      val: amount,
      duration: 2.5,
      ease: 'power2.out',
      onUpdate: () => {
        numEl.textContent = Math.floor(counter.val).toLocaleString('vi-VN');
      }
    });
    gsap.from('.love-cheque-box', {
      scale: 0.8,
      rotation: -4,
      opacity: 0,
      duration: 0.8,
      ease: 'elastic.out(1, 0.6)'
    });
  } else if (numEl) {
    numEl.textContent = amount.toLocaleString('vi-VN');
  }
}

// ==================== 11. KHỞI TẠO SỰ KIỆN & ĐỒNG BỘ SOCKET.IO ====================
document.addEventListener('DOMContentLoaded', async () => {
  initStopMotionLineBoil();
  initSketchCanvas();
  initCursorDoodleTrail();
  initClassroomInteractions();
  animateSvgStrokes(document);

  const musicBtn = document.getElementById('musicToggle') || document.getElementById('musicToggleBtn');
  if (musicBtn) {
    musicBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleMusic();
    });
  }

  // 1. Mở phong bì vẽ tay đa tầng: Bấm lần 1 mở lá thư lên, bấm vào màn hình mới chuyển sang trang mới
  const envBtn = document.getElementById('envelopeBtn');
  const sceneIntro = document.getElementById('sceneIntro');
  const goToStoryScene = () => {
    if (currentScene !== 'intro' || !envelopeOpenedWaitingTap) return;
    envelopeOpenedWaitingTap = false;
    currentScene = 'story';
    switchScene('sceneStory');
  };

  if (envBtn) {
    envBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const env = envBtn.querySelector('.envelope');
      if (env && env.classList.contains('open')) {
        goToStoryScene();
        return;
      }
      if (env) env.classList.add('open');
      try {
        socket.emit('girlfriend_opened_envelope');
        fetch('/api/event', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'girlfriend_opened_envelope' })
        }).catch(() => {});
        AudioFX.playEnvelopeOpen();
        launchPaperPlanesBurst();
        if (!musicPlaying && currentMusicUrl) toggleMusic(true);
      } catch (err) {}

      const hintEl = document.getElementById('txtTapHint');
      if (hintEl) {
        hintEl.textContent = continueTapHintText;
        if (window.gsap) {
          gsap.fromTo(hintEl, { scale: 0.9, opacity: 0 }, { scale: 1.04, opacity: 1, duration: 0.45, ease: 'back.out(1.6)' });
        }
      }
      // Đợi 350ms để tránh sự kiện click hiện tại kích hoạt chuyển trang ngay lập tức
      setTimeout(() => {
        envelopeOpenedWaitingTap = true;
      }, 350);
    });
  }

  if (sceneIntro) {
    sceneIntro.addEventListener('click', () => {
      if (envelopeOpenedWaitingTap && currentScene === 'intro') {
        goToStoryScene();
      }
    });
  }

  // 2. Bấm mở hộp quà SVG bung nắp lò xo
  const claimBtn = document.getElementById('claimGiftBtn');
  const claimBox = document.getElementById('claimGiftBoxBtn');
  const triggerClaim = async () => {
    AudioFX.playEnvelopeOpen();
    const lid = document.getElementById('giftLidGroup');
    if (lid && window.gsap) {
      gsap.to(lid, { y: -65, rotation: 18, opacity: 0, duration: 0.55, ease: 'back.in(1.4)' });
    }
    launchPaperPlanesBurst();
    try {
      socket.emit('claim_gift');
      fetch('/api/event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'claim_gift' })
      }).catch(() => {});
    } catch (e) {}
    setTimeout(() => startWaitingScene(), 550);
  };
  if (claimBtn) claimBtn.addEventListener('click', triggerClaim);
  if (claimBox) claimBox.addEventListener('click', triggerClaim);

  // 3. Nút bắn pháo giấy ăn mừng lại
  const replayBtn = document.getElementById('replayFireworksBtn');
  if (replayBtn) {
    replayBtn.addEventListener('click', () => {
      AudioFX.playRewardFanfare();
      firePastelConfetti();
      launchPaperPlanesBurst();
    });
  }

  // 4. Tải cấu hình & trạng thái ban đầu từ Server + Polling dự phòng cho Serverless
  let lastGiftSentState = false;
  let lastConfigHash = '';
  const syncFromServer = async (isInitial = false) => {
    try {
      const res = await fetch('/api/config?role=girlfriend');
      const data = await res.json();
      if (data.config) {
        const cfgHash = JSON.stringify(data.config);
        if (cfgHash !== lastConfigHash) {
          lastConfigHash = cfgHash;
          applyContent(data.config);
        }
      }
      if (data.session) {
        if (data.session.giftSent && data.session.giftData) {
          if (!lastGiftSentState || currentScene !== 'reward') {
            lastGiftSentState = true;
            showRewardScene(data.session.giftData);
          }
        } else {
          if (lastGiftSentState && !data.session.giftSent) {
            lastGiftSentState = false;
            resetToIntro(data.config);
          } else if (isInitial && (data.session.giftClaimed || data.session.claimed)) {
            startWaitingScene();
          }
        }
      }
    } catch (e) {}
  };
  await syncFromServer(true);
  setInterval(() => syncFromServer(false), 2500);
});

socket.on('init_data', ({ config, session }) => {
  if (config) applyContent(config);
  if (session?.giftSent && session?.giftData) {
    showRewardScene(session.giftData);
  } else if (session?.claimed && currentScene !== 'waiting') {
    startWaitingScene();
  }
});

socket.on('config_updated', (config) => applyContent(config));
socket.on('content_updated', (content) => applyContent(content));
socket.on('gift_sent', (giftData) => showRewardScene(giftData));
socket.on('gift_approved', (rewardData) => showRewardScene(rewardData));

function resetToIntro(config) {
  envelopeOpenedWaitingTap = false;
  if (config) applyContent(config);
  clearInterval(waitingMsgTimer);
  const hintEl = document.getElementById('txtTapHint');
  if (hintEl) hintEl.textContent = tapHintDefault;
  const lid = document.getElementById('giftLidGroup');
  if (lid && window.gsap) gsap.set(lid, { y: 0, rotation: 0, opacity: 1 });
  const env = document.querySelector('.envelope');
  if (env) env.classList.remove('open');
  currentScene = 'intro';
  switchScene('sceneIntro');
}

socket.on('session_reset', () => resetToIntro());
socket.on('state_reset', (state) => resetToIntro(state?.content));
