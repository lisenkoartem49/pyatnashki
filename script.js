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

/**
 * Воспроизводит короткий звук при перемещении плитки.
 */
function playMoveSound() {
    // Включаем Tone.js, если он еще не запущен (для совместимости с автозапуском браузера)
    if (Tone.context.state !== 'running') {
        Tone.start();
    }
    moveSynth.triggerAttackRelease("C4", "8n");
}

/**
 * Воспроизводит звук победы (аккорд).
 */
function playWinSound() {
    if (Tone.context.state !== 'running') {
        Tone.start();
    }
    const now = Tone.now();
    winSynth.triggerAttackRelease("C5", "8n", now);
    winSynth.triggerAttackRelease("E5", "8n", now + 0.2);
    winSynth.triggerAttackRelease("G5", "8n", now + 0.4);
    winSynth.triggerAttackRelease("C6", "1n", now + 0.6);
}

/**
 * Воспроизводит звук перемешивания (глиссандо).
 */
function playShuffleSound() {
    if (Tone.context.state !== 'running') {
        Tone.start();
    }
    const now = Tone.now();
    shuffleSynth.triggerAttackRelease("C3", "8n", now);
    shuffleSynth.triggerAttackRelease("D3", "8n", now + 0.1);
    shuffleSynth.triggerAttackRelease("E3", "8n", now + 0.2);
    shuffleSynth.triggerAttackRelease("F3", "8n", now + 0.3);
}


// --- Инициализация Пазла (1D массив) ---
/**
 * Устанавливает начальное состояние пазла в упорядоченном виде.
 */
function initializePuzzle() {
    puzzleSize = parseInt(sizeSelect.value);
    const totalTiles = puzzleSize * puzzleSize;
    tiles = [];
    // Заполняем плитки значениями от 1 до N*N - 1
    for (let i = 1; i < totalTiles; i++) {
        tiles.push(i);
    }
    // Последняя плитка - пустая
    tiles.push(emptyTileValue);
    emptyIndex = totalTiles - 1;
    messageElement.textContent = '';
    gameInProgress = false;
    resetTimer();
    movesCount = 0; // Сбрасываем счетчик ходов
    movesCountElement.textContent = movesCount; // Обновляем отображение ходов
    
    // Устанавливаем лимит ходов для режима 'moves'
    if (gameMode === 'moves') {
        movesCounterElement.style.display = 'flex';
        // Лимит ходов: 2 * (N*N) - разумное начальное значение
        movesLimit = puzzleSize * puzzleSize * 2; 
        messageElement.textContent = `Лимит ходов: ${movesLimit}`;
    } else {
        movesCounterElement.style.display = 'none';
        messageElement.textContent = getStartMessage();
    }
}

// --- Отрисовка Пазла ---
/**
 * Отрисовывает плитки на основе текущего массива tiles.
 */
function renderPuzzle() {
    gridElement.innerHTML = '';
    // Устанавливаем grid-шаблон и отступы в зависимости от размера
    gridElement.style.gridTemplateColumns = `repeat(${puzzleSize}, 1fr)`;
    gridElement.style.gap = `${Math.max(1, 6 - puzzleSize)}px`;

    const gridWidth = gridElement.clientWidth;
    // Вычисляем размер плитки, вычитая отступы
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
            // Добавляем обработчик клика только для непустых плиток
            tile.addEventListener('click', () => handleTileClick(index));
        }
        gridElement.appendChild(tile);
    });
}

// --- Обработка Клика по Плитке ---
/**
 * Обрабатывает клик по плитке, перемещая ее, если это возможно.
 * @param {number} tileIndex - Индекс плитки, по которой кликнули.
 */
function handleTileClick(tileIndex) {
    if (!gameInProgress) return;

    if (isAdjacent(tileIndex, emptyIndex)) {
        swapTiles(tileIndex, emptyIndex);
        emptyIndex = tileIndex;
        renderPuzzle();
        movesCount++; // Увеличиваем счетчик ходов
        movesCountElement.textContent = movesCount;
        playMoveSound();

        // Проверка условия поражения в режиме 'moves'
        if (gameMode === 'moves' && movesCount >= movesLimit) {
            stopTimer();
            messageElement.textContent = `☹️ Вы проиграли! Ходы закончились.`;
            gameInProgress = false;
            return;
        }

        // Проверка условия победы
        if (isSolved()) {
            stopTimer();
            playWinSound();
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
/**
 * Проверяет, являются ли две плитки соседними (по горизонтали или вертикали).
 * @param {number} index1 - Индекс первой плитки.
 * @param {number} index2 - Индекс второй плитки.
 * @returns {boolean} - true, если плитки соседние.
 */
function isAdjacent(index1, index2) {
    const row1 = Math.floor(index1 / puzzleSize);
    const col1 = index1 % puzzleSize;
    const row2 = Math.floor(index2 / puzzleSize);
    const col2 = index2 % puzzleSize;

    // Сосед по горизонтали или вертикали
    return (Math.abs(row1 - row2) === 1 && col1 === col2) || (Math.abs(col1 - col2) === 1 && row1 === row2);
}

// --- Обмен Плиток (1D) ---
/**
 * Меняет местами две плитки в массиве.
 * @param {number} index1 - Индекс первой плитки.
 * @param {number} index2 - Индекс второй плитки.
 */
function swapTiles(index1, index2) {
    [tiles[index1], tiles[index2]] = [tiles[index2], tiles[index1]];
}

// --- Перемешивание Пазла (делает случайные ходы) ---
/**
 * Перемешивает пазл, выполняя последовательность случайных допустимых ходов.
 */
function shufflePuzzle() {
    initializePuzzle();

    // Количество ходов для перемешивания
    const shuffleMoves = puzzleSize * puzzleSize * (5 + puzzleSize);
    let lastMovedIndex = -1; 

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
                // Исключаем плитку, которую только что переместили
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
            i--;
        }
    }
    
    // Проверка на решенное состояние после перемешивания (очень маловероятно, но нужно)
    if (isSolved()) {
        shufflePuzzle(); // Перемешиваем еще раз
        return;
    }

    messageElement.textContent = '';
    renderPuzzle();
    // Запускаем таймер, если режим 'timed'
    if (gameMode === 'timed') {
        startTimer();
    }
    gameInProgress = true;
    movesCount = 0; // Начинаем считать ходы
    movesCountElement.textContent = movesCount;
    playShuffleSound();
}

// --- Проверка, Решен ли Пазл (1D) ---
/**
 * Проверяет, находится ли пазл в решенном состоянии.
 * @returns {boolean} - true, если пазл решен.
 */
function isSolved() {
    for (let i = 0; i < tiles.length - 1; i++) {
        if (tiles[i] !== i + 1) {
            return false;
        }
    }
    // Проверяем, что последняя позиция - пустая плитка
    return tiles[tiles.length - 1] === emptyTileValue;
}

// --- Управление Таймером ---
/**
 * Форматирует миллисекунды в строку "ММ:СС".
 * @param {number} milliseconds - Время в миллисекундах.
 * @returns {string} - Отформатированное время.
 */
function formatTime(milliseconds) {
    const totalSeconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

/**
 * Запускает или возобновляет таймер.
 */
function startTimer() {
    if (gameMode !== 'timed') return; 

    stopTimer();
    startTime = Date.now();
    timerElement.textContent = formatTime(0);
    timerInterval = setInterval(() => {
        const elapsedTime = Date.now() - startTime;
        timerElement.textContent = formatTime(elapsedTime);
    }, 1000);
}

/**
 * Останавливает таймер.
 */
function stopTimer() {
    clearInterval(timerInterval);
    timerInterval = null;
}

/**
 * Сбрасывает таймер.
 */
function resetTimer() {
    stopTimer();
    timerElement.textContent = '00:00';
    startTime = 0;
}


// --- Логика Эффекта Дождя ---
const canvas = document.getElementById('rain-canvas');
const ctx = canvas.getContext('2d');
let drops = [];

/**
 * Изменяет размер холста под размер окна и инициализирует капли дождя.
 */
function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    initializeDrops();
}

/**
 * Класс для отдельной капли дождя.
 */
class RainDrop {
    constructor() {
        this.reset();
    }
    
    // Сброс параметров капли для создания новой
    reset() {
        this.x = Math.random() * canvas.width;
        this.y = Math.random() * -canvas.height;
        this.length = Math.random() * 20 + 10;
        this.speed = Math.random() * 5 + 2;
        this.opacity = Math.random() * 0.5 + 0.3;
    }
    
    /**
     * Обновляет положение капли.
     */
    update() {
        this.y += this.speed;
        if (this.y > canvas.height) {
            this.reset();
            this.y = Math.random() * -50 - 20; 
        }
    }
    
    /**
     * Отрисовывает каплю на холсте.
     */
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

/**
 * Инициализирует массив капель дождя.
 */
function initializeDrops() {
    drops = [];
    const numberOfDrops = Math.floor(canvas.width / 5);
    for (let i = 0; i < numberOfDrops; i++) {
        drops.push(new RainDrop());
    }
}

/**
 * Главный цикл анимации дождя.
 */
function animateRain() {
    ctx.clearRect(0, 0, canvas.width, canvas.height); // Очистка холста
    drops.forEach(drop => {
        drop.update();
        drop.draw();
    });
    requestAnimationFrame(animateRain);
}


// --- Вспомогательные Функции ---

/**
 * Возвращает стартовое сообщение в зависимости от режима игры.
 * @returns {string} - Сообщение для пользователя.
 */
function getStartMessage() {
    switch (gameMode) {
        case 'classic':
            return 'Выберите размер и нажмите "Начать / Перемешать"';
        case 'timed':
            return 'Выберите размер и нажмите "Начать / Перемешать".  Игра на время!';
        case 'moves':
            // Пересчитываем movesLimit для отображения
            const size = parseInt(sizeSelect.value);
            const limit = size * size * 2;
            return `Выберите размер и нажмите "Начать / Перемешать".  Лимит ходов: ${limit}`;
        default:
            return 'Выберите размер и нажмите "Начать / Перемешать"';
    }
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
    
    // Обновляем видимость счетчика ходов
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


// --- Инициализация и Запуск ---

/**
 * Запускает начальную инициализацию после загрузки DOM.
 */
document.addEventListener('DOMContentLoaded', () => {
    // Убедитесь, что начальное значение размера установлено корректно
    puzzleSize = parseInt(sizeSelect.value); 
    resizeCanvas();
    animateRain();
    initializePuzzle();
    renderPuzzle();
    messageElement.textContent = getStartMessage();
});
