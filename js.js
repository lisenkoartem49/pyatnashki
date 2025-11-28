// --- Элементы DOM ---
const gridElement = document.getElementById('puzzle-grid');
const messageElement = document.getElementById('message');
const shuffleButton = document.getElementById('shuffle-button');
const sizeSelect = document.getElementById('size-select');
const timerElement = document.getElementById('timer');
const modeSelect = document.getElementById('mode-select');
const movesCounterElement = document.getElementById('moves-counter');
const movesCountElement = document.getElementById('moves-count');

// --- Состояние игры ---
let puzzleSize = parseInt(sizeSelect.value);
const emptyTileValue = null;
let tiles = [];
let emptyIndex = -1;
let timerInterval = null;
let startTime = 0;
let gameInProgress = false;
let movesCount = 0; // Счетчик ходов
let gameMode = 'classic'; // Режим игры: 'classic', 'timed', 'moves'
let movesLimit = 0; // Лимит ходов для режима 'moves'

// --- Звуковые эффекты (Tone.js) ---
const moveSynth = new Tone.Synth().toDestination();
const winSynth = new Tone.Synth().toDestination();
const shuffleSynth = new Tone.Synth().toDestination();

function playMoveSound() {
    moveSynth.triggerAttackRelease("C4", "8n");
}

function playWinSound() {
    // Более сложный звук (короткая аккордовая прогрессия)
    const now = Tone.now();
    winSynth.triggerAttackRelease("C5", "8n", now);
    winSynth.triggerAttackRelease("E5", "8n", now + 0.2);
    winSynth.triggerAttackRelease("G5", "8n", now + 0.4);
    winSynth.triggerAttackRelease("C6", "1n", now + 0.6);
}

function playShuffleSound() {
    // Более сложный звук (быстрое скольжение)
    const now = Tone.now();
    shuffleSynth.triggerAttackRelease("C3", "8n", now);
    shuffleSynth.triggerAttackRelease("D3", "8n", now + 0.1);
    shuffleSynth.triggerAttackRelease("E3", "8n", now + 0.2);
    shuffleSynth.triggerAttackRelease("F3", "8n", now + 0.3);
}



// --- Инициализация Пазла (1D массив) ---
function initializePuzzle() {
    puzzleSize = parseInt(sizeSelect.value);
    const totalTiles = puzzleSize * puzzleSize;
    tiles = [];
    for (let i = 1; i < totalTiles; i++) {
        tiles.push(i);
    }
    tiles.push(emptyTileValue);
    emptyIndex = totalTiles - 1;
    messageElement.textContent = '';
    gameInProgress = false;
    resetTimer();
    movesCount = 0; // Сбрасываем счетчик ходов
    movesCountElement.textContent = movesCount; // Обновляем отображение ходов
    if (gameMode === 'moves') {
        movesCounterElement.style.display = 'flex';
        movesLimit = puzzleSize * puzzleSize * 2; // Примерное значение лимита ходов
        messageElement.textContent = `Лимит ходов: ${movesLimit}`;
    } else {
        movesCounterElement.style.display = 'none';
    }
}

// --- Отрисовка Пазла ---
function renderPuzzle() {
    gridElement.innerHTML = '';
    gridElement.style.gridTemplateColumns = `repeat(${puzzleSize}, 1fr)`;
    gridElement.style.gap = `${Math.max(1, 6 - puzzleSize)}px`;

    const gridWidth = gridElement.clientWidth;
    // Расчет размера плитки с учетом отступов (gap)
    const gapValue = parseFloat(gridElement.style.gap);
    const tileSize = (gridWidth - (puzzleSize + 1) * gapValue) / puzzleSize;
    const fontSize = Math.max(8, tileSize * 0.4);

    tiles.forEach((value, index) => {
        const tile = document.createElement('div');
        tile.classList.add('tile');
        tile.style.fontSize = `${fontSize}px`;

        if (value === emptyTileValue) {
            tile.classList.add('empty');
            tile.textContent = '';
        } else {
            tile.textContent = value;
            tile.addEventListener('click', () => handleTileClick(index));
        }
        // Установка размеров плитки через grid уже должна быть достаточной, но оставляем для наглядности
        // tile.style.width = `${tileSize}px`; 
        // tile.style.height = `${tileSize}px`;
        gridElement.appendChild(tile);
    });
}

// --- Обработка Клика по Плитке ---
function handleTileClick(tileIndex) {
    if (!gameInProgress) return;

    if (isAdjacent(tileIndex, emptyIndex)) {
        swapTiles(tileIndex, emptyIndex);
        emptyIndex = tileIndex;
        renderPuzzle();
        movesCount++; // Увеличиваем счетчик ходов
        movesCountElement.textContent = movesCount; // Обновляем счетчик ходов на экране
        playMoveSound(); // Воспроизводим звук при перемещении плитки

        if (gameMode === 'moves' && movesCount >= movesLimit) {
            stopTimer();
            messageElement.textContent = `☹️ Вы проиграли! Ходы закончились.`;
            gameInProgress = false;
            return;
        }

        if (isSolved()) {
            stopTimer();
            playWinSound(); // Воспроизводим звук победы
            let message = `🎉 Пазл ${puzzleSize}x${puzzleSize} собран! `;
            if (gameMode === 'timed') {
                message += `Время: ${timerElement.textContent}! `;
            }
            message += `Количество ходов: ${movesCount} 🎉`;
            messageElement.textContent = message;
            gameInProgress = false;
        }
    }
}

// --- Проверка Соседства Плиток (1D) ---
function isAdjacent(index1, index2) {
    const row1 = Math.floor(index1 / puzzleSize);
    const col1 = index1 % puzzleSize;
    const row2 = Math.floor(index2 / puzzleSize);
    const col2 = index2 % puzzleSize;

    // Проверка, что плитки находятся рядом по вертикали или горизонтали, но не по диагонали
    return (Math.abs(row1 - row2) === 1 && col1 === col2) || (Math.abs(col1 - col2) === 1 && row1 === row2);
}

// --- Обмен Плиток (1D) ---
function swapTiles(index1, index2) {
    [tiles[index1], tiles[index2]] = [tiles[index2], tiles[index1]];
}

// --- Перемешивание Пазла (делает случайные ходы) ---
function shufflePuzzle() {
    initializePuzzle();

    const shuffleMoves = puzzleSize * puzzleSize * (5 + puzzleSize);
    let lastMovedIndex = -1;

    // Выполнение случайных, но допустимых ходов для перемешивания
    for (let i = 0; i < shuffleMoves; i++) {
        const possibleMoves = [];
        const emptyRow = Math.floor(emptyIndex / puzzleSize);
        const emptyCol = emptyIndex % puzzleSize;

        const directions = [
            { dr: -1, dc: 0 }, // Вверх
            { dr: 1, dc: 0 },  // Вниз
            { dr: 0, dc: -1 }, // Влево
            { dr: 0, dc: 1 }   // Вправо
        ];

        for (const dir of directions) {
            const neighborRow = emptyRow + dir.dr;
            const neighborCol = emptyCol + dir.dc;

            if (neighborRow >= 0 && neighborRow < puzzleSize && neighborCol >= 0 && neighborCol < puzzleSize) {
                const neighborIndex = neighborRow * puzzleSize + neighborCol;
                // Избегаем немедленного возврата к предыдущему состоянию
                if (neighborIndex !== lastMovedIndex) {
                    possibleMoves.push(neighborIndex);
                }
            }
        }

        if (possibleMoves.length > 0) {
            const randomMoveIndex = possibleMoves[Math.floor(Math.random() * possibleMoves.length)];
            lastMovedIndex = emptyIndex;
            swapTiles(randomMoveIndex, emptyIndex);
            emptyIndex = randomMoveIndex;
        } else {
            // Если нет возможных ходов (что не должно произойти в 15-пазле), пробуем снова
            i--;
        }
    }

    messageElement.textContent = '';
    renderPuzzle();
    startTimer();
    gameInProgress = true;
    movesCount = 0; // Начинаем считать ходы после перемешивания
    movesCountElement.textContent = movesCount;
    playShuffleSound(); // Воспроизводим звук при перемешивании
}

// --- Проверка, Решен ли Пазл (1D) ---
function isSolved() {
    for (let i = 0; i < tiles.length - 1; i++) {
        // Проверяем, что значение плитки соответствует ожидаемому (i + 1)
        if (tiles[i] !== i + 1) {
            return false;
        }
    }
    // Последняя плитка должна быть пустой
    return tiles[tiles.length - 1] === emptyTileValue;
}

// --- Управление Таймером ---
function formatTime(milliseconds) {
    const totalSeconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function startTimer() {
    if (gameMode === 'classic' || gameMode === 'moves') return; // Таймер только для режима 'timed'

    stopTimer();
    startTime = Date.now();
    timerElement.textContent = formatTime(0);
    timerInterval = setInterval(() => {
        const elapsedTime = Date.now() - startTime;
        timerElement.textContent = formatTime(elapsedTime);
    }, 1000);
}

function stopTimer() {
    clearInterval(timerInterval);
    timerInterval = null;
}

function resetTimer() {
    stopTimer();
    timerElement.textContent = '00:00';
    startTime = 0;
}

// --- Логика Эффекта Дождя ---
const canvas = document.getElementById('rain-canvas');
const ctx = canvas.getContext('2d');
let drops = [];

function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    initializeDrops();
}

class RainDrop {
    constructor() {
        this.x = Math.random() * canvas.width;
        this.y = Math.random() * -canvas.height;
        this.length = Math.random() * 20 + 10;
        this.speed = Math.random() * 5 + 2;
        this.opacity = Math.random() * 0.5 + 0.3;
    }
    update() {
        this.y += this.speed;
        if (this.y > canvas.height) {
            this.y = Math.random() * -50 - 20;
            this.x = Math.random() * canvas.width;
            this.speed = Math.random() * 5 + 2;
            this.length = Math.random() * 20 + 10;
            this.opacity = Math.random() * 0.5 + 0.3;
        }
    }
    draw() {
        ctx.beginPath();
        ctx.moveTo(this.x, this.y);
        ctx.lineTo(this.x, this.y + this.length);
        ctx.strokeStyle = `rgba(173, 216, 230, ${this.opacity})`;
        ctx.lineWidth = 1.5;
        ctx.lineCap = 'round';
        ctx.stroke();
    }
}

function initializeDrops() {
    drops = [];
    const numberOfDrops = Math.floor(canvas.width / 5);
    for (let i = 0; i < numberOfDrops; i++) {
        drops.push(new RainDrop());
    }
}

function animateRain() {
    // Используем небольшую прозрачность для создания эффекта следа
    ctx.fillStyle = 'rgba(163, 163, 163, 0.1)'; // Цвет фона #a3a3a3 с прозрачностью
    ctx.fillRect(0, 0, canvas.width, canvas.height); 
    
    drops.forEach(drop => {
        drop.update();
        drop.draw();
    });
    requestAnimationFrame(animateRain);
}

// --- Обработчики событий ---
shuffleButton.addEventListener('click', shufflePuzzle);
sizeSelect.addEventListener('change', () => {
    initializePuzzle();
    renderPuzzle();
    messageElement.textContent = getStartMessage();
});
modeSelect.addEventListener('change', () => {
    gameMode = modeSelect.value;
    initializePuzzle();
    renderPuzzle();
    resetTimer();
    movesCount = 0;
    movesCountElement.textContent = movesCount;
    if (gameMode === 'moves') {
        movesCounterElement.style.display = 'flex';
        movesLimit = puzzleSize * puzzleSize * 2;
        messageElement.textContent = `Лимит ходов: ${movesLimit}`;
    } else {
        movesCounterElement.style.display = 'none';
        messageElement.textContent = getStartMessage();
    }
});

window.addEventListener('resize', () => {
    resizeCanvas();
    renderPuzzle();
});

// --- Функции-помощники ---

function getStartMessage() {
    switch (gameMode) {
        case 'classic':
            return 'Выберите размер и нажмите "Начать / Перемешать"';
        case 'timed':
            return 'Выберите размер и нажмите "Начать / Перемешать".  Игра на время!';
        case 'moves':
            return `Выберите размер и нажмите "Начать / Перемешать".  Лимит ходов: ${movesLimit}`;
        default:
            return 'Выберите размер и нажмите "Начать / Перемешать"';
    }
}

// --- Инициализация и Запуск ---
window.onload = () => {
    resizeCanvas();
    animateRain();
    initializePuzzle();
    renderPuzzle();
    messageElement.textContent = getStartMessage();
};