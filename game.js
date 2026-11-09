const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const hudLives = document.getElementById('lives');
const objectiveText = document.getElementById('objective');
const sequenceText = document.getElementById('sequence');
const messageBox = document.getElementById('messageBox');
const startOverlay = document.getElementById('startOverlay');
const endOverlay = document.getElementById('endOverlay');
const endEyebrow = document.getElementById('endEyebrow');
const endTitle = document.getElementById('endTitle');
const endText = document.getElementById('endText');
const startBtn = document.getElementById('startBtn');
const restartBtn = document.getElementById('restartBtn');
const interactBtn = document.getElementById('interactBtn');
const moveButtons = document.querySelectorAll('.dir');

const world = {
  width: 960,
  height: 540,
  player: { x: 130, y: 360, r: 18, speed: 160, dx: 0, dy: 0 },
  monster: { x: 760, y: 150, r: 25, speed: 110, dir: 1, strength: 1.15, state: 'idle' },
  toys: [
    { id: 'moon', x: 210, y: 120, r: 18, active: false, color: '#d6dcff' },
    { id: 'star', x: 465, y: 120, r: 16, active: false, color: '#ffe08a' },
    { id: 'heart', x: 700, y: 370, r: 17, active: false, color: '#ff9bc4' }
  ],
  exit: { x: 850, y: 460, w: 52, h: 52 },
  door: { x: 820, y: 430, w: 60, h: 65, opened: false },
  obstacles: [
    { x: 0, y: 250, w: 240, h: 25 },
    { x: 300, y: 210, w: 190, h: 25 },
    { x: 510, y: 290, w: 200, h: 25 },
    { x: 220, y: 410, w: 270, h: 25 },
    { x: 650, y: 255, w: 150, h: 25 }
  ],
  particles: [],
  activeToy: null,
  sequence: ['moon', 'star', 'heart'],
  sequenceIndex: 0,
  gameRunning: false,
  won: false,
  lives: 3,
  lastTime: 0,
  messageTimer: 0,
  gameOver: false,
  time: 0,
  ambient: 0,
  monsterAlert: 0,
  exitUnlocked: false,
};

const keyboard = { up: false, down: false, left: false, right: false };
const touchInput = { x: 0, y: 0 };

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function setMessage(text, duration = 1400) {
  messageBox.textContent = text;
  messageBox.classList.remove('hidden');
  world.messageTimer = duration;
}

function hideMessage() {
  messageBox.classList.add('hidden');
}

function updateLives() {
  const hearts = Array.from({ length: 3 }, (_, index) => {
    const heart = document.createElement('span');
    heart.className = `heart ${index < world.lives ? '' : 'empty'}`;
    return heart;
  });

  hudLives.innerHTML = '';
  hearts.forEach((heart) => hudLives.appendChild(heart));
}

function updateHud() {
  const sequence = world.sequence.map((id) => id[0].toUpperCase() + id.slice(1)).join(' → ');
  sequenceText.textContent = sequence;

  const nextToy = world.sequence[world.sequenceIndex];
  if (world.won) {
    objectiveText.textContent = 'Escape through the nursery door';
  } else if (world.exitUnlocked) {
    objectiveText.textContent = 'Run to the exit';
  } else if (nextToy) {
    objectiveText.textContent = `Wake the ${nextToy} toy`;
  } else {
    objectiveText.textContent = 'Return to safety';
  }
}

function addParticles(x, y, color, count = 10) {
  for (let i = 0; i < count; i++) {
    world.particles.push({
      x,
      y,
      vx: (Math.random() - 0.5) * 80,
      vy: (Math.random() - 0.5) * 80,
      life: 0.8 + Math.random() * 0.5,
      color,
      r: 2 + Math.random() * 3,
    });
  }
}

function activateToy(id) {
  const toy = world.toys.find((t) => t.id === id);
  if (!toy || toy.active) return false;
  toy.active = true;
  addParticles(toy.x, toy.y, toy.color, 16);
  setMessage(`${toy.id.toUpperCase()} toy awakened`, 900);
  world.sequenceIndex += 1;
  if (world.sequenceIndex >= world.sequence.length) {
    world.exitUnlocked = true;
    setMessage('Nursery door unlocked! Run!', 1500);
  }
  return true;
}

function resetGame() {
  world.player.x = 130;
  world.player.y = 360;
  world.monster.x = 760;
  world.monster.y = 150;
  world.monster.state = 'idle';
  world.monsterAlert = 0;
  world.lives = 3;
  world.sequenceIndex = 0;
  world.exitUnlocked = false;
  world.won = false;
  world.gameOver = false;
  world.gameRunning = false;
  world.time = 0;
  world.toys.forEach((toy) => {
    toy.active = false;
  });
  updateLives();
  updateHud();
  hideMessage();
}

function startGame() {
  resetGame();
  world.gameRunning = true;
  startOverlay.classList.add('hidden');
  endOverlay.classList.add('hidden');
}

function endGame(win) {
  world.gameRunning = false;
  world.gameOver = true;
  if (win) {
    endEyebrow.textContent = 'Victory';
    endTitle.textContent = 'You escaped the nursery';
    endText.textContent = 'The plush beast watched you go, still softly humming in the dark.';
  } else {
    endEyebrow.textContent = 'Defeat';
    endTitle.textContent = 'The nursery found you';
    endText.textContent = 'The creature woke up and dragged you back into the toy chest.';
  }
  endOverlay.classList.remove('hidden');
}

function playerCircleCollision(x, y, r, target, padding = 0) {
  const dx = x - target.x;
  const dy = y - target.y;
  return Math.hypot(dx, dy) < r + target.r + padding;
}

function rectCircleCollision(rect, circle, padding = 0) {
  const nearestX = clamp(circle.x, rect.x, rect.x + rect.w);
  const nearestY = clamp(circle.y, rect.y, rect.y + rect.h);
  const dx = circle.x - nearestX;
  const dy = circle.y - nearestY;
  return dx * dx + dy * dy < (circle.r + padding) * (circle.r + padding);
}

function collidesWithObstacle(x, y, radius) {
  return world.obstacles.some((ob) => rectCircleCollision(ob, { x, y, r: radius }, 4));
}

function movePlayer(dt) {
  const player = world.player;
  let moveX = 0;
  let moveY = 0;

  if (keyboard.left || keyboard.right || keyboard.up || keyboard.down) {
    moveX = (keyboard.right ? 1 : 0) - (keyboard.left ? 1 : 0);
    moveY = (keyboard.down ? 1 : 0) - (keyboard.up ? 1 : 0);
  }

  if (touchInput.x || touchInput.y) {
    moveX = touchInput.x;
    moveY = touchInput.y;
  }

  if (moveX || moveY) {
    const length = Math.hypot(moveX, moveY) || 1;
    moveX /= length;
    moveY /= length;
    const nextX = player.x + moveX * player.speed * dt;
    const nextY = player.y + moveY * player.speed * dt;

    if (!collidesWithObstacle(nextX, player.y, player.r)) {
      player.x = clamp(nextX, player.r, world.width - player.r);
    }
    if (!collidesWithObstacle(player.x, nextY, player.r)) {
      player.y = clamp(nextY, player.r, world.height - player.r);
    }
  }

  for (const toy of world.toys) {
    if (!toy.active && playerCircleCollision(player.x, player.y, player.r, toy, 8)) {
      const required = world.sequence[world.sequenceIndex];
      if (toy.id === required) {
        activateToy(toy.id);
      } else {
        setMessage('Wrong toy. Listen for the nursery rhythm.', 1000);
        addParticles(player.x, player.y, '#ff5d7a', 12);
      }
    }
  }

  if (world.exitUnlocked && !world.won) {
    const exitRect = world.exit;
    const doorOpen = playerCircleCollision(
      player.x,
      player.y,
      player.r,
      { x: exitRect.x + exitRect.w / 2, y: exitRect.y + exitRect.h / 2, r: 24 },
      0
    );
    if (doorOpen) {
      world.won = true;
      setMessage('Escaped!', 1500);
      endGame(true);
    }
  }
}

function updateMonster(dt) {
  const monster = world.monster;
  const player = world.player;
  const dx = player.x - monster.x;
  const dy = player.y - monster.y;
  const distance = Math.hypot(dx, dy) || 1;

  const isNear = distance < 220;
  monster.state = isNear ? 'chase' : 'idle';
  if (isNear) {
    world.monsterAlert = clamp(world.monsterAlert + dt * 1.3, 0, 1);
  } else {
    world.monsterAlert = clamp(world.monsterAlert - dt * 1.8, 0, 1);
  }

  if (monster.state === 'chase') {
    monster.x += (dx / distance) * monster.speed * dt * (1 + world.monsterAlert * 0.8);
    monster.y += (dy / distance) * monster.speed * dt * (1 + world.monsterAlert * 0.8);
  } else {
    monster.x += Math.cos(world.time * 0.9 + monster.x * 0.01) * 10 * dt;
    monster.y += Math.sin(world.time * 1.5 + monster.y * 0.02) * 10 * dt;
  }

  monster.x = clamp(monster.x, 20, world.width - 20);
  monster.y = clamp(monster.y, 20, world.height - 20);

  if (playerCircleCollision(player.x, player.y, player.r, monster, 8)) {
    world.lives -= 1;
    updateLives();
    addParticles(player.x, player.y, '#ff5d7a', 20);
    setMessage('You were caught!', 900);
    if (world.lives <= 0) {
      endGame(false);
      return;
    }

    player.x = 130;
    player.y = 360;
    monster.x = 760;
    monster.y = 150;
    monster.state = 'idle';
    world.monsterAlert = 0;
  }
}

function updateParticles(dt) {
  for (let i = world.particles.length - 1; i >= 0; i -= 1) {
    const p = world.particles[i];
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.life -= dt;
    if (p.life <= 0) world.particles.splice(i, 1);
  }
}

function update(dt) {
  if (!world.gameRunning) return;
  world.time += dt;

  if (world.messageTimer > 0) {
    world.messageTimer -= dt * 1000;
    if (world.messageTimer <= 0) {
      hideMessage();
    }
  }

  movePlayer(dt);
  updateMonster(dt);
  updateParticles(dt);
  updateHud();
}

function drawBackground() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
  gradient.addColorStop(0, '#17162d');
  gradient.addColorStop(0.7, '#121724');
  gradient.addColorStop(1, '#090d16');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = 'rgba(255,255,255,0.025)';
  for (let i = 0; i < 18; i++) {
    ctx.fillRect(i * 52, 0, 1, canvas.height);
  }

  const moon = { x: 100, y: 70, r: 36 };
  ctx.fillStyle = '#f4efc9';
  ctx.beginPath();
  ctx.arc(moon.x, moon.y, moon.r, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.2)';
  ctx.beginPath();
  ctx.arc(moon.x + 10, moon.y - 10, moon.r * 0.9, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = 'rgba(166, 198, 255, 0.08)';
  ctx.fillRect(0, 230, canvas.width, 40);
  ctx.fillRect(0, 430, canvas.width, 110);
}

function drawRoom() {
  ctx.fillStyle = '#2a2538';
  for (const obstacle of world.obstacles) {
    ctx.fillRect(obstacle.x, obstacle.y, obstacle.w, obstacle.h);
  }

  ctx.fillStyle = '#4d5b86';
  ctx.fillRect(world.exit.x, world.exit.y, world.exit.w, world.exit.h);
  ctx.fillStyle = world.exitUnlocked ? '#8ef0d4' : '#8d8bb3';
  ctx.fillRect(world.exit.x + 8, world.exit.y + 8, world.exit.w - 16, world.exit.h - 16);

  ctx.fillStyle = '#a7b9ff';
  ctx.fillRect(72, 418, 150, 12);
  ctx.fillStyle = '#6d7ad0';
  ctx.fillRect(80, 400, 110, 20);
}

function drawToy(toy) {
  if (toy.active) return;
  ctx.save();
  ctx.translate(toy.x, toy.y);
  ctx.fillStyle = toy.color;
  ctx.beginPath();
  ctx.arc(0, 0, toy.r, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = 'rgba(0,0,0,0.3)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-toy.r * 0.6, 0);
  ctx.lineTo(toy.r * 0.6, 0);
  ctx.moveTo(0, -toy.r * 0.6);
  ctx.lineTo(0, toy.r * 0.6);
  ctx.stroke();
  ctx.restore();
}

function drawPlayer() {
  const p = world.player;
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.fillStyle = '#f4efc9';
  ctx.beginPath();
  ctx.arc(0, 0, p.r, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#1d5d8b';
  ctx.fillRect(-5, 10, 10, 16);
  ctx.restore();
}

function drawMonster() {
  const m = world.monster;
  ctx.save();
  ctx.translate(m.x, m.y);
  const pulse = 1 + Math.sin(world.time * 7) * 0.12;
  ctx.scale(pulse, pulse);
  ctx.fillStyle = '#d2f2ff';
  ctx.beginPath();
  ctx.arc(0, 0, m.r, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#171f35';
  ctx.fillRect(-8, 8, 16, 12);
  ctx.fillStyle = '#ffb1c5';
  ctx.fillRect(-10, -18, 20, 10);
  ctx.restore();

  ctx.strokeStyle = `rgba(255, 93, 122, ${0.15 + world.monsterAlert * 0.85})`;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(m.x, m.y, 210, 0, Math.PI * 2);
  ctx.stroke();
}

function drawParticles() {
  for (const p of world.particles) {
    ctx.fillStyle = p.color;
    ctx.globalAlpha = Math.max(p.life, 0);
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function draw() {
  drawBackground();
  drawRoom();
  world.toys.forEach(drawToy);
  drawPlayer();
  drawMonster();
  drawParticles();
}

function loop(timestamp) {
  const dt = Math.min((timestamp - (world.lastTime || timestamp)) / 1000, 0.033);
  world.lastTime = timestamp;
  update(dt);
  draw();
  requestAnimationFrame(loop);
}

function setDirection(code, pressed) {
  switch (code) {
    case 'ArrowUp':
    case 'KeyW':
      keyboard.up = pressed;
      break;
    case 'ArrowDown':
    case 'KeyS':
      keyboard.down = pressed;
      break;
    case 'ArrowLeft':
    case 'KeyA':
      keyboard.left = pressed;
      break;
    case 'ArrowRight':
    case 'KeyD':
      keyboard.right = pressed;
      break;
    default:
      break;
  }
}

window.addEventListener('keydown', (event) => {
  setDirection(event.code, true);
  if (event.code === 'Space' && world.gameRunning) {
    const required = world.sequence[world.sequenceIndex];
    if (required) {
      const toy = world.toys.find((t) => t.id === required && !t.active);
      if (toy) activateToy(toy.id);
    }
  }
  if (event.code === 'KeyE' && world.gameRunning && world.exitUnlocked) {
    world.won = true;
    setMessage('Escaped!', 1500);
    endGame(true);
  }
});

window.addEventListener('keyup', (event) => {
  setDirection(event.code, false);
});

startBtn.addEventListener('click', startGame);
restartBtn.addEventListener('click', startGame);
interactBtn.addEventListener('click', () => {
  if (!world.gameRunning) return;
  const required = world.sequence[world.sequenceIndex];
  if (required) {
    const toy = world.toys.find((t) => t.id === required && !t.active);
    if (toy) activateToy(toy.id);
  }
});

moveButtons.forEach((button) => {
  const dir = button.dataset.dir;
  const setTouchMove = (pressed) => {
    const map = {
      up: { x: 0, y: pressed ? -1 : 0 },
      down: { x: 0, y: pressed ? 1 : 0 },
      left: { x: pressed ? -1 : 0, y: 0 },
      right: { x: pressed ? 1 : 0, y: 0 },
    };
    const val = map[dir];
    if (pressed) {
      touchInput.x = val.x;
      touchInput.y = val.y;
    } else {
      touchInput.x = 0;
      touchInput.y = 0;
    }
  };

  button.addEventListener('pointerdown', () => setTouchMove(true));
  button.addEventListener('pointerup', () => setTouchMove(false));
  button.addEventListener('pointerleave', () => setTouchMove(false));
  button.addEventListener('pointercancel', () => setTouchMove(false));
});

updateLives();
updateHud();
resetGame();
startOverlay.classList.remove('hidden');
requestAnimationFrame(loop);
