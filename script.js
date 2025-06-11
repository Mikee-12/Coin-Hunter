// Star Collector Game - JavaScript
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const sounds = {
  collect: new Audio('assets/collect.mp3'),
  Buff: new Audio('assets/collectBuff.mp3'),
  Death:new Audio('assets/death.mp3')
};
const soundtrack = new Audio('assets/soundtrackMenu.mp3');
soundtrack.loop = true;

// Handle tab visibility changes
document.addEventListener('visibilitychange', function() {
    if (document.hidden) {
        // Tab became hidden
        if (gameState.gameStarted && !gameState.gameOver) {
            pauseGame();
        }
        isTabVisible = false;
    } else {
        // Tab became visible
        if (gameState.gameStarted && !gameState.gameOver && gameState.paused) {
            resumeGame();
        }
        isTabVisible = true;
    }
});

// Window focus/blur events as fallback
window.addEventListener('blur', function() {
    if (gameState.gameStarted && !gameState.gameOver && !gameState.paused) {
        pauseGame();
    }
});

window.addEventListener('focus', function() {
    if (gameState.gameStarted && !gameState.gameOver && gameState.paused) {
        resumeGame();
    }
});

// Mobile controls
let mobileControls = {
    joystick: {
        active: false,
        centerX: 0,
        centerY: 0,
        currentX: 0,
        currentY: 0,
        maxDistance: 40,
        inputX: 0,
        inputY: 0
    }
};

// Touch event handlers
function initMobileControls() {
    const joystick = document.getElementById('virtualJoystick');
    const knob = document.getElementById('joystickKnob');
    
    if (!joystick || !knob) return;
    
    // Get joystick center
    const rect = joystick.getBoundingClientRect();
    mobileControls.joystick.centerX = rect.left + rect.width / 2;
    mobileControls.joystick.centerY = rect.top + rect.height / 2;
    
    // Touch start
    joystick.addEventListener('touchstart', (e) => {
        e.preventDefault();
        mobileControls.joystick.active = true;
        const touch = e.touches[0];
        handleJoystickMove(touch.clientX, touch.clientY);
    }, { passive: false });
    
    // Touch move
    joystick.addEventListener('touchmove', (e) => {
        e.preventDefault();
        if (mobileControls.joystick.active) {
            const touch = e.touches[0];
            handleJoystickMove(touch.clientX, touch.clientY);
        }
    }, { passive: false });
    
    // Touch end
    joystick.addEventListener('touchend', (e) => {
        e.preventDefault();
        mobileControls.joystick.active = false;
        mobileControls.joystick.inputX = 0;
        mobileControls.joystick.inputY = 0;
        
        // Return knob to center
        knob.style.transform = 'translate(-50%, -50%)';
    }, { passive: false });
    
    // Update joystick center on window resize
    window.addEventListener('resize', () => {
        const rect = joystick.getBoundingClientRect();
        mobileControls.joystick.centerX = rect.left + rect.width / 2;
        mobileControls.joystick.centerY = rect.top + rect.height / 2;
    });
}

function handleJoystickMove(touchX, touchY) {
    const knob = document.getElementById('joystickKnob');
    
    // Calculate distance from center
    const deltaX = touchX - mobileControls.joystick.centerX;
    const deltaY = touchY - mobileControls.joystick.centerY;
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
    
    // Limit to max distance
    let knobX = deltaX;
    let knobY = deltaY;
    
    if (distance > mobileControls.joystick.maxDistance) {
        knobX = (deltaX / distance) * mobileControls.joystick.maxDistance;
        knobY = (deltaY / distance) * mobileControls.joystick.maxDistance;
    }
    
    // Update knob position
    knob.style.transform = `translate(calc(-50% + ${knobX}px), calc(-50% + ${knobY}px))`;
    
    // Calculate input values (-1 to 1)
    mobileControls.joystick.inputX = knobX / mobileControls.joystick.maxDistance;
    mobileControls.joystick.inputY = knobY / mobileControls.joystick.maxDistance;
}

// Game state
let gameState = {
    score: 0,
    level: 1,
    lives: 3,
    gameOver: false,
    gameStarted: false,
    startTime: Date.now(),
    paused: false,
    pausedTime: 0,
    lastFrameTime: 0,
    stars: [],
    enemies: [],
    particles: [],
    powerUps: [],
    activeBuffs: {
        shield: { active: false, endTime: 0, pausedRemaining: 0 },
        speed: { active: false, endTime: 0, pausedRemaining: 0 }
    },
    shieldEffect: null
};

let isTabVisible = true;
let audioWasPaused = false;

// Player object
const player = {
    x: 0,
    y: 0,
    size: 15,
    speed: 5,
    baseSpeed: 5,
    color: '#00ffff',
    trail: []
};

// Input handling
const keys = {};

document.addEventListener('keydown', (e) => {
    keys[e.key.toLowerCase()] = true;
});

document.addEventListener('keyup', (e) => {
    keys[e.key.toLowerCase()] = false;
});

// Particle system
function createParticle(x, y, color, size = 3) {
    return {
        x: x,
        y: y,
        vx: (Math.random() - 0.5) * 4,
        vy: (Math.random() - 0.5) * 4,
        color: color,
        size: size,
        life: 1,
        decay: 0.02
    };
}

// Star creation
function createStar() {
    return {
        x: Math.random() * (canvas.width - 40) + 20,
        y: Math.random() * (canvas.height - 40) + 20,
        size: 8 + Math.random() * 4,
        color: `hsl(${Math.random() * 60 + 40}, 100%, 70%)`,
        pulse: Math.random() * Math.PI * 2,
        collected: false
    };
}

// Enemy creation
function createEnemy() {
    const side = Math.floor(Math.random() * 4);
    let x, y;
    
    switch(side) {
        case 0: x = -20; y = Math.random() * canvas.height; break;
        case 1: x = canvas.width + 20; y = Math.random() * canvas.height; break;
        case 2: x = Math.random() * canvas.width; y = -20; break;
        case 3: x = Math.random() * canvas.width; y = canvas.height + 20; break;
    }
    
    return {
        x: x,
        y: y,
        size: 12 + Math.random() * 8,
        speed: 1 + Math.random() * 2 + gameState.level * 0.3,
        color: `hsl(${Math.random() * 60}, 100%, 50%)`,
        type: Math.random() < 0.7 ? 'chaser' : 'wanderer',
        angle: Math.random() * Math.PI * 2,
        health: 1
    };
}

// Power-up creation
function createPowerUp() {
    const types = ['shield', 'speed'];
    const type = types[Math.floor(Math.random() * types.length)];
    let color, symbol;
    
    switch(type) {
        case 'shield':
            color = '#00a8ff';
            symbol = '🛡️';
            break;
        case 'speed':
            color = '#00ff9d';
            symbol = '🚀';
            break;
    }
    
    return {
        x: Math.random() * (canvas.width - 40) + 20,
        y: Math.random() * (canvas.height - 40) + 20,
        size: 15,
        color: color,
        type: type,
        symbol: symbol,
        pulse: 0,
        collected: false
    };
}

// Apply buff to player
function applyBuff(type, duration) {
    gameState.activeBuffs[type].active = true;
    gameState.activeBuffs[type].endTime = Date.now() + duration;
    
    // Show buff indicator
    const buffElement = document.getElementById(`${type}Buff`);
    if (buffElement) {
        buffElement.style.display = 'flex';
    }
    
    // Apply effects
    switch(type) {
        case 'shield':
            player.color = '#00ffff';
            // Create shield effect
            gameState.shieldEffect = {
                x: player.x,
                y: player.y,
                size: player.size * 2.5
            };
            break;
        case 'speed':
            player.speed = player.baseSpeed * 1.8;
            player.color = '#ff00aa';
            break;
    }
}

// Update buffs
function updateBuffs() {
    const now = Date.now();
    
    // Update shield buff
    if (gameState.activeBuffs.shield.active) {
        const remaining = gameState.activeBuffs.shield.endTime - now;
        if (remaining <= 0) {
            gameState.activeBuffs.shield.active = false;
            const shieldBuff = document.getElementById('shieldBuff');
            if (shieldBuff) shieldBuff.style.display = 'none';
            player.color = '#00ffff';
            gameState.shieldEffect = null;
        } else {
            const progress = (remaining / 10000) * 100; // 10 second duration
            const shieldTimer = document.getElementById('shieldTimer');
            if (shieldTimer) shieldTimer.style.width = `${progress}%`;
            
            // Update shield effect position
            if (gameState.shieldEffect) {
                gameState.shieldEffect.x = player.x;
                gameState.shieldEffect.y = player.y;
            }
        }
    }
    
    // Update speed buff
    if (gameState.activeBuffs.speed.active) {
        const remaining = gameState.activeBuffs.speed.endTime - now;
        if (remaining <= 0) {
            gameState.activeBuffs.speed.active = false;
            const speedBuff = document.getElementById('speedBuff');
            if (speedBuff) speedBuff.style.display = 'none';
            player.speed = player.baseSpeed;
            player.color = '#00ffff';
        } else {
            const progress = (remaining / 8000) * 100; // 8 second duration
            const speedTimer = document.getElementById('speedTimer');
            if (speedTimer) speedTimer.style.width = `${progress}%`;
        }
    }
}

// Pause game function
function pauseGame() {
    if (gameState.paused) return;
    
    gameState.paused = true;
    gameState.pausedTime = Date.now();
    
    // Pause soundtrack
    if (!soundtrack.paused) {
        soundtrack.pause();
        audioWasPaused = false;
    } else {
        audioWasPaused = true;
    }
    
    // Save remaining buff times
    const now = Date.now();
    Object.keys(gameState.activeBuffs).forEach(buffType => {
        const buff = gameState.activeBuffs[buffType];
        if (buff.active) {
            buff.pausedRemaining = Math.max(0, buff.endTime - now);
        }
    });
    
    console.log('Game paused');
}

// Resume game function
function resumeGame() {
    if (!gameState.paused) return;
    
    const pauseDuration = Date.now() - gameState.pausedTime;
    
    // Adjust start time to account for pause
    gameState.startTime += pauseDuration;
    
    // Resume soundtrack if it was playing
    if (!audioWasPaused && soundtrack.paused) {
        soundtrack.play().catch(e => console.log('Resume audio failed:', e));
    }
    
    // Restore buff timers
    const now = Date.now();
    Object.keys(gameState.activeBuffs).forEach(buffType => {
        const buff = gameState.activeBuffs[buffType];
        if (buff.active && buff.pausedRemaining > 0) {
            buff.endTime = now + buff.pausedRemaining;
            buff.pausedRemaining = 0;
        }
    });
    
    // Reset frame timing to prevent FPS jumps
    gameState.lastFrameTime = now;
    
    gameState.paused = false;
    console.log('Game resumed');
}

// Update player
function updatePlayer() {
    let dx = 0, dy = 0;
    
    // Desktop controls
    if (keys['w'] || keys['arrowup']) dy -= player.speed;
    if (keys['s'] || keys['arrowdown']) dy += player.speed;
    if (keys['a'] || keys['arrowleft']) dx -= player.speed;
    if (keys['d'] || keys['arrowright']) dx += player.speed;
    
    // Mobile controls
    if (mobileControls.joystick.active) {
        dx += mobileControls.joystick.inputX * player.speed;
        dy += mobileControls.joystick.inputY * player.speed;
    }
    
    // Diagonal movement normalization
    if (dx !== 0 && dy !== 0) {
        dx *= 0.707;
        dy *= 0.707;
    }
    
    player.x += dx;
    player.y += dy;
    
    // Boundary checking with slight bounce
    if (player.x < player.size) player.x = player.size;
    if (player.x > canvas.width - player.size) player.x = canvas.width - player.size;
    if (player.y < player.size) player.y = player.size;
    if (player.y > canvas.height - player.size) player.y = canvas.height - player.size;
    
    // Add trail effect
    player.trail.push({x: player.x, y: player.y, alpha: 1});
    if (player.trail.length > 8) player.trail.shift();
    
    // Update trail alpha
    player.trail.forEach((point, index) => {
        point.alpha = index / player.trail.length * 0.5;
    });
}

// Update enemies
function updateEnemies() {
    gameState.enemies.forEach(enemy => {
        if (enemy.type === 'chaser') {
            const dx = player.x - enemy.x;
            const dy = player.y - enemy.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            if (distance > 0) {
                enemy.x += (dx / distance) * enemy.speed;
                enemy.y += (dy / distance) * enemy.speed;
            }
        } else {
            enemy.angle += (Math.random() - 0.5) * 0.2;
            enemy.x += Math.cos(enemy.angle) * enemy.speed;
            enemy.y += Math.sin(enemy.angle) * enemy.speed;
            
            // Bounce off walls
            if (enemy.x < 0 || enemy.x > canvas.width) enemy.angle = Math.PI - enemy.angle;
            if (enemy.y < 0 || enemy.y > canvas.height) enemy.angle = -enemy.angle;
        }
        
        // Create enemy particles
        if (Math.random() < 0.1) {
            gameState.particles.push(createParticle(enemy.x, enemy.y, enemy.color, 2));
        }
    });
}

// Check collisions
// Fixed collision detection function
function checkCollisions() {
    // Player-Star collisions (sudah benar)
    for (let i = gameState.stars.length - 1; i >= 0; i--) {
        const star = gameState.stars[i];
        const dx = player.x - star.x;
        const dy = player.y - star.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance < player.size + star.size && !star.collected) {
            star.collected = true;
            gameState.score += 10;

            // Create collection particles
            for (let j = 0; j < 8; j++) {
                gameState.particles.push(createParticle(star.x, star.y, star.color, 4));
            }
            
            // Remove collected star
            gameState.stars.splice(i, 1);
            
            // Level up logic
            if (gameState.score % 100 === 0) {
                gameState.level++;
            }
            
            // Play collection sound
            if (sounds.collect) {
                sounds.collect.currentTime = 0;
                sounds.collect.volume = 0.8;
                sounds.collect.play().catch(e => console.log('Audio play failed:', e));
            }
        }
    }

    // Player-PowerUp collisions (DIPINDAHKAN KE DALAM FUNGSI)
    for (let i = gameState.powerUps.length - 1; i >= 0; i--) {
        const powerUp = gameState.powerUps[i];
        const dx = player.x - powerUp.x;
        const dy = player.y - powerUp.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance < player.size + powerUp.size && !powerUp.collected) {
            powerUp.collected = true;
            
            // Create collection particles
            for (let j = 0; j < 12; j++) {
                gameState.particles.push(createParticle(powerUp.x, powerUp.y, powerUp.color, 5));
            }
            
            // Apply power-up effect
            switch(powerUp.type) {
                case 'shield':
                    applyBuff('shield', 10000); // 10 seconds
                    break;
                case 'speed':
                    applyBuff('speed', 8000); // 8 seconds
                    break;
            }
            
            // Play collectBuff sound
            if (sounds.Buff) {
                sounds.Buff.currentTime = 0;
                sounds.Buff.volume = 0.6;
                sounds.Buff.play().catch(e => console.log('Buff audio play failed:', e));
            }
            
            // Remove collected power-up
            gameState.powerUps.splice(i, 1);
        }
    }
    
// Player-Enemy collisions (Clean version with death sound)
if (!gameState.activeBuffs.shield.active) { // Only check if no shield
    for (let i = gameState.enemies.length - 1; i >= 0; i--) {
        const enemy = gameState.enemies[i];
        const dx = player.x - enemy.x;
        const dy = player.y - enemy.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance < player.size + enemy.size) {
            gameState.lives--;
            
            // Play death sound
            if (sounds.Death) {
                sounds.Death.currentTime = 0; // Reset audio ke awal
                sounds.Death.volume = 0.7; // Atur volume (0.0 - 1.0)
                sounds.Death.play().catch(e => console.log('Death audio play failed:', e));
            }
            
            // Create damage particles
            for (let j = 0; j < 12; j++) {
                gameState.particles.push(createParticle(player.x, player.y, '#ff0000', 3));
            }
            
            // Remove enemy and reset player position
            gameState.enemies.splice(i, 1);
            player.x = canvas.width / 2;
            player.y = canvas.height / 2;
            
            if (gameState.lives <= 0) {
                gameState.gameOver = true;
            }
            
            // Break to avoid multiple collisions in one frame
            break;
        }
    }
}
}

// Spawn entities
function spawnEntities() {
    // Spawn stars
    if (gameState.stars.length < 3 + gameState.level && Math.random() < 0.02) {
        gameState.stars.push(createStar());
    }
    
    // Spawn enemies
    if (Math.random() < 0.005 + gameState.level * 0.002) {
        gameState.enemies.push(createEnemy());
    }
    
    // Spawn power-ups (less frequent)
    if (gameState.powerUps.length < 1 && Math.random() < 0.003) {
        gameState.powerUps.push(createPowerUp());
    }
    
    // Limit enemy count
    if (gameState.enemies.length > 5 + gameState.level) {
        gameState.enemies.shift();
    }
}

// Update particles
function updateParticles() {
    gameState.particles = gameState.particles.filter(particle => {
        particle.x += particle.vx;
        particle.y += particle.vy;
        particle.life -= particle.decay;
        particle.size *= 0.98;
        return particle.life > 0 && particle.size > 0.5;
    });
}

// Draw functions
function drawPlayer() {
    // Draw trail
    player.trail.forEach(point => {
        ctx.globalAlpha = point.alpha;
        ctx.fillStyle = player.color;
        ctx.beginPath();
        ctx.arc(point.x, point.y, player.size * 0.7, 0, Math.PI * 2);
        ctx.fill();
    });
    
    ctx.globalAlpha = 1;
    
    // Draw player with glow
    ctx.shadowColor = player.color;
    ctx.shadowBlur = 20;
    ctx.fillStyle = player.color;
    ctx.beginPath();
    ctx.arc(player.x, player.y, player.size, 0, Math.PI * 2);
    ctx.fill();
    
    // Draw player core
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(player.x, player.y, player.size * 0.6, 0, Math.PI * 2);
    ctx.fill();
    
    // Draw shield effect if active
    if (gameState.shieldEffect) {
        ctx.strokeStyle = 'rgba(0, 200, 255, 0.7)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(
            gameState.shieldEffect.x, 
            gameState.shieldEffect.y, 
            gameState.shieldEffect.size, 
            0, 
            Math.PI * 2
        );
        ctx.stroke();
        ctx.shadowColor = 'rgba(0, 200, 255, 0.5)';
        ctx.shadowBlur = 10;
        ctx.stroke();
        ctx.shadowBlur = 0;
    }
}

function drawStars() {
    gameState.stars.forEach(star => {
        star.pulse += 0.1;
        const pulseSize = star.size + Math.sin(star.pulse) * 2;
        
        ctx.shadowColor = star.color;
        ctx.shadowBlur = 15;
        
        // Draw star shape
        ctx.fillStyle = star.color;
        ctx.beginPath();
        for (let i = 0; i < 5; i++) {
            const angle = (i * 4 * Math.PI) / 5;
            const x = star.x + Math.cos(angle) * pulseSize;
            const y = star.y + Math.sin(angle) * pulseSize;
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.fill();
        
        ctx.shadowBlur = 0;
    });
}

function drawEnemies() {
    gameState.enemies.forEach(enemy => {
        ctx.shadowColor = enemy.color;
        ctx.shadowBlur = 10;
        
        // Draw enemy with menacing shape
        ctx.fillStyle = enemy.color;
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
            const angle = (i * Math.PI) / 3;
            const radius = enemy.size + Math.sin(Date.now() * 0.01 + i) * 2;
            const x = enemy.x + Math.cos(angle) * radius;
            const y = enemy.y + Math.sin(angle) * radius;
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.fill();
        
        ctx.shadowBlur = 0;
    });
}

function drawPowerUps() {
    gameState.powerUps.forEach(powerUp => {
        powerUp.pulse += 0.05;
        const pulseSize = powerUp.size + Math.sin(powerUp.pulse) * 3;
        
        ctx.shadowColor = powerUp.color;
        ctx.shadowBlur = 15;
        
        // Draw power-up background
        ctx.fillStyle = powerUp.color;
        ctx.beginPath();
        ctx.arc(powerUp.x, powerUp.y, pulseSize, 0, Math.PI * 2);
        ctx.fill();
        
        // Draw power-up symbol
        ctx.fillStyle = '#ffffff';
        ctx.font = `${powerUp.size}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(powerUp.symbol, powerUp.x, powerUp.y);
        
        ctx.shadowBlur = 0;
    });
}

function drawParticles() {
    gameState.particles.forEach(particle => {
        ctx.globalAlpha = particle.life;
        ctx.fillStyle = particle.color;
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
        ctx.fill();
    });
    ctx.globalAlpha = 1;
}

// Update UI
function updateUI() {
    // Desktop UI
    const scoreEl = document.getElementById('score');
    const levelEl = document.getElementById('level');
    const livesEl = document.getElementById('lives');
    const timeEl = document.getElementById('time');
    
    if (scoreEl) scoreEl.textContent = gameState.score;
    if (levelEl) levelEl.textContent = gameState.level;
    if (livesEl) livesEl.textContent = gameState.lives;
    if (timeEl) timeEl.textContent = Math.floor((Date.now() - gameState.startTime) / 1000);
    
    // Mobile UI
    const mobileScoreEl = document.getElementById('mobileScore');
    const mobileLevelEl = document.getElementById('mobileLevel');
    const mobileLivesEl = document.getElementById('mobileLives');
    const mobileTimeEl = document.getElementById('mobileTime');
    
    if (mobileScoreEl) mobileScoreEl.textContent = gameState.score;
    if (mobileLevelEl) mobileLevelEl.textContent = gameState.level;
    if (mobileLivesEl) mobileLivesEl.textContent = gameState.lives;
    if (mobileTimeEl) mobileTimeEl.textContent = Math.floor((Date.now() - gameState.startTime) / 1000);
}

// Game loop
function gameLoop() {
    if (!gameState.gameStarted || gameState.gameOver) {
        if (gameState.gameOver) {
            const gameOverEl = document.getElementById('gameOver');
            const finalScoreEl = document.getElementById('finalScore');
            const starsCollectedEl = document.getElementById('starsCollected');
            
            if (gameOverEl) gameOverEl.style.display = 'block';
            if (finalScoreEl) finalScoreEl.textContent = gameState.score;
            if (starsCollectedEl) starsCollectedEl.textContent = Math.floor(gameState.score / 10);
        }
        return;
    }
    
    // Check if game is paused
    if (gameState.paused) {
        requestAnimationFrame(gameLoop);
        return;
    }
    
    // Clear canvas with subtle trail effect
    ctx.fillStyle = 'rgba(10, 10, 46, 0.1)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Update game objects
    updatePlayer();
    updateEnemies();
    updateParticles();
    updateBuffs();
    spawnEntities();
    checkCollisions();
    updateUI();
    
    // Draw everything
    drawParticles();
    drawStars();
    drawPowerUps();
    drawEnemies();
    drawPlayer();
    
    requestAnimationFrame(gameLoop);
}

// Restart game
function restartGame() {
    gameState = {
        score: 0,
        level: 1,
        lives: 3,
        gameOver: false,
        gameStarted: true,
        startTime: Date.now(),
        paused: false,
        pausedTime: 0,
        lastFrameTime: 0,
        stars: [],
        enemies: [],
        particles: [],
        powerUps: [],
        activeBuffs: {
            shield: { active: false, endTime: 0, pausedRemaining: 0 },
            speed: { active: false, endTime: 0, pausedRemaining: 0 }
        },
        shieldEffect: null
    };
    
    player.x = canvas.width / 2;
    player.y = canvas.height / 2;
    player.trail = [];
    player.speed = player.baseSpeed;
    player.color = '#00ffff';
    
    const gameOverEl = document.getElementById('gameOver');
    const shieldBuffEl = document.getElementById('shieldBuff');
    const speedBuffEl = document.getElementById('speedBuff');
    
    if (gameOverEl) gameOverEl.style.display = 'none';
    if (shieldBuffEl) shieldBuffEl.style.display = 'none';
    if (speedBuffEl) speedBuffEl.style.display = 'none';
    
    // Start with some stars
    for (let i = 0; i < 3; i++) {
        gameState.stars.push(createStar());
    }
    
    gameLoop();
}

// Start game from menu
function startGame() {
    soundtrack.currentTime = 0;
    soundtrack.play();
    soundtrack.volume = 0.1;
    const mainMenuEl = document.getElementById('mainMenu');
    const instructionsEl = document.getElementById('instructions');
    
    if (mainMenuEl) mainMenuEl.style.display = 'none';
    if (instructionsEl) instructionsEl.style.display = 'none';
    
    gameState.gameStarted = true;
    restartGame();
}

// Return to main menu
function returnToMenu() {
    const gameOverEl = document.getElementById('gameOver');
    const mainMenuEl = document.getElementById('mainMenu');
    
    if (gameOverEl) gameOverEl.style.display = 'none';
    if (mainMenuEl) mainMenuEl.style.display = 'block';
    
    gameState.gameStarted = false;
}

// Show instructions
function showInstructions() {
    const instructionsEl = document.getElementById('instructions');
    if (instructionsEl) instructionsEl.style.display = 'block';
}

// Hide instructions
function hideInstructions() {
    const instructionsEl = document.getElementById('instructions');
    if (instructionsEl) instructionsEl.style.display = 'none';
}

// Initialize game
function init() {
    if (!canvas) {
        console.error('Canvas element not found');
        return;
    }
    
    canvas.width = window.innerWidth * 0.9;
    canvas.height = window.innerHeight * 0.8;
    
    // Set initial player position
    player.x = canvas.width / 2;
    player.y = canvas.height / 2;
    
    // Center canvas
    canvas.style.position = 'absolute';
    canvas.style.top = '50%';
    canvas.style.left = '50%';
    canvas.style.transform = 'translate(-50%, -50%)';
    
    // Show main menu
    const mainMenuEl = document.getElementById('mainMenu');
    if (mainMenuEl) mainMenuEl.style.display = 'block';
    
    // Initialize mobile controls
    initMobileControls();
}

// Event listeners
window.addEventListener('load', init);
window.addEventListener('resize', () => {
    if (canvas) {
        canvas.width = window.innerWidth * 0.9;
        canvas.height = window.innerHeight * 0.8;
        
        // Update player position if needed
        if (player.x > canvas.width) player.x = canvas.width / 2;
        if (player.y > canvas.height) player.y = canvas.height / 2;
    }
});

// Make functions available globally for HTML onclick handlers
window.startGame = startGame;
window.restartGame = restartGame;
window.returnToMenu = returnToMenu;
window.showInstructions = showInstructions;
window.hideInstructions = hideInstructions;