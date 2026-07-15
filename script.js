// Lógica del Juego y Cálculos Estadísticos - "Busca las Cartas Doradas"

// Parámetros dinámicos de la distribución hipergeométrica
let paramN = 30; // Tamaño de la población (N)
let paramK = 8;  // Número de éxitos en la población (K)
let paramn = 5;  // Tamaño de la muestra (n)
let paramx = 2;  // Número de éxitos obtenidos en la muestra (x)

// Elementos del DOM del Juego
const btnDraw = document.getElementById('btn-draw');
const btnReset = document.getElementById('btn-reset');
const handContainer = document.getElementById('hand-container');
const handPlaceholder = document.getElementById('hand-placeholder');
const deckCounter = document.getElementById('deck-counter');

// Elementos del DOM del Registro de Jugadores
const playerInput = document.getElementById('player-name-input');
const btnRegisterPlayer = document.getElementById('btn-register-player');
const activePlayerBanner = document.getElementById('active-player-banner');
const activePlayerName = document.getElementById('active-player-name');
const playersList = document.getElementById('players-list');
const btnClearHistory = document.getElementById('btn-clear-history');
const btnDownloadJSON = document.getElementById('btn-download-json');

// Estado del registro de jugadores
let players = [];
let activePlayerIndex = -1;

// Paneles de Resultados y Matemáticos
const resultBox = document.getElementById('result-box');
const resultDetails = document.getElementById('result-details');
const noGamesYetText = resultBox.querySelector('.no-games-yet');
const resX = document.getElementById('res-x');
const resNX = document.getElementById('res-nx');
const resPercentage = document.getElementById('res-percentage');
const descX = document.getElementById('desc-x');

const calcBreakdown = document.getElementById('calc-breakdown');
const mathX = document.getElementById('math-x');
const mathNX = document.getElementById('math-nx');
const mathValX = document.getElementById('math-val-x');

// Selectors for dynamic equation labels
const mathTopK = document.getElementById('math-top-K');
const mathTopNK = document.getElementById('math-top-NK');
const mathNTotal = document.getElementById('math-N-total');
const mathnTotal = document.getElementById('math-n-total');

const mathCK = document.getElementById('math-C-K');
const mathCNK = document.getElementById('math-C-NK');
const mathCN = document.getElementById('math-C-N');
const mathCn = document.getElementById('math-C-n');

const mathCXN = document.getElementById('math-c-x-n');
const mathCNXN = document.getElementById('math-c-nx-n');

const mathComb1 = document.getElementById('math-comb-1');
const mathComb2 = document.getElementById('math-comb-2');
const mathCombTotal = document.getElementById('math-comb-total');

const mathNumFinal1 = document.getElementById('math-num-final-1');
const mathNumFinal2 = document.getElementById('math-num-final-2');
const mathDenFinal1 = document.getElementById('math-den-final-1');
const mathDenFinal2 = document.getElementById('math-den-final-2');

const mathNumTotal = document.getElementById('math-num-total');
const mathFinalDec = document.getElementById('math-final-dec');
const mathFinalPct = document.getElementById('math-final-pct');

// Legend labels
const legN = document.getElementById('leg-N');
const legK = document.getElementById('leg-K');
const legNK = document.getElementById('leg-NK');
const legn = document.getElementById('leg-n');
const legx = document.getElementById('leg-x');
const legnx = document.getElementById('leg-nx');

// --- MATEMÁTICAS (SOPORTE DE NÚMEROS ILIMITADOS Y EVITACIÓN DE DESBORDAMIENTO) ---

/**
 * Calcula combinaciones exactas usando BigInt para prevenir desbordamientos numéricos en pantalla.
 * C(n, r) = n! / (r! * (n-r)!)
 */
function bigChoose(n, r) {
    if (r < 0 || r > n) return 0n;
    if (r === 0 || r === n) return 1n;
    let k = r;
    if (k > n / 2) k = n - k;
    let res = 1n;
    for (let i = 1n; i <= BigInt(k); i++) {
        res = res * (BigInt(n) - i + 1n) / i;
    }
    return res;
}

/**
 * Calcula el logaritmo natural de combinaciones para realizar operaciones hipergeométricas seguras sin desbordamientos float (N > 1000).
 * ln(C(n, r)) = ln(n!) - ln(r!) - ln((n-r)!)
 */
function logChoose(n, r) {
    if (r < 0 || r > n) return -Infinity;
    if (r === 0 || r === n) return 0;
    
    let logNumerator = 0;
    for (let i = n - r + 1; i <= n; i++) {
        logNumerator += Math.log(i);
    }
    let logDenominator = 0;
    for (let i = 1; i <= r; i++) {
        logDenominator += Math.log(i);
    }
    return logNumerator - logDenominator;
}

/**
 * Calcula la probabilidad hipergeométrica exacta.
 * Retorna las combinaciones en BigInt para el panel visual y el float de probabilidad seguro.
 */
function calculateHypergeometric(x, N_val = paramN, K_val = paramK, n_val = paramn) {
    const successComb = bigChoose(K_val, x);
    const failureComb = bigChoose(N_val - K_val, n_val - x);
    const totalComb = bigChoose(N_val, n_val);
    
    // Cálculo seguro con logaritmos para evitar división Infinity / Infinity
    const logP = logChoose(K_val, x) + logChoose(N_val - K_val, n_val - x) - logChoose(N_val, n_val);
    const probability = Math.exp(logP);
    
    return {
        successComb,
        failureComb,
        totalComb,
        probability: isNaN(probability) ? 0 : probability
    };
}

// --- RENDERIZADO DEL GRÁFICO ---

/**
 * Genera y escala dinámicamente las barras del gráfico.
 * Si n > 20, muestra una ventana de hasta 20 columnas centradas en x para evitar colapsar la pantalla.
 */
function renderChart() {
    const chartContainer = document.getElementById('prob-chart');
    chartContainer.innerHTML = '';
    
    const maxVisibleColumns = 20;
    let startX = 0;
    let endX = paramn;
    
    // Ventana deslizante de visualización si el tamaño de muestra es muy grande
    if (paramn > maxVisibleColumns) {
        startX = Math.max(0, paramx - Math.floor(maxVisibleColumns / 2));
        endX = startX + maxVisibleColumns;
        if (endX > paramn) {
            endX = paramn;
            startX = Math.max(0, endX - maxVisibleColumns);
        }
    }
    
    // Obtener la probabilidad máxima dentro de la ventana (para escala vertical del 100%)
    let maxProb = 0.00001;
    let probabilities = {};
    
    // También revisamos la probabilidad en la media teórica (donde suele estar la cresta)
    const peakX = Math.round(paramn * paramK / paramN);
    const checkColumns = new Set([peakX]);
    for (let i = startX; i <= endX; i++) {
        checkColumns.add(i);
    }
    
    checkColumns.forEach(i => {
        const stats = calculateHypergeometric(i, paramN, paramK, paramn);
        probabilities[i] = stats.probability;
        if (stats.probability > maxProb) {
            maxProb = stats.probability;
        }
    });
    
    // Mostrar puntos suspensivos iniciales si recortamos el gráfico
    if (startX > 0) {
        const ellipsis = document.createElement('div');
        ellipsis.className = 'chart-column';
        ellipsis.innerHTML = `
            <div class="bar-wrapper" style="justify-content: center; height: 100%; opacity: 0.3;">
                <span style="font-size: 1.1rem; font-weight: bold; color: var(--color-text-muted);">...</span>
            </div>
            <div class="bar-label">0 - ${startX - 1}</div>
        `;
        chartContainer.appendChild(ellipsis);
    }
    
    // Renderizar las columnas de la ventana activa
    for (let i = startX; i <= endX; i++) {
        let prob = probabilities[i];
        if (prob === undefined) {
            prob = calculateHypergeometric(i, paramN, paramK, paramn).probability;
        }
        const percentValue = (prob * 100).toFixed(2);
        const relativeHeight = (prob / maxProb) * 100;
        
        const column = document.createElement('div');
        column.className = 'chart-column';
        column.setAttribute('data-k', i); // Se conserva el data-k para compatibilidad CSS
        if (i === paramx) {
            column.classList.add('is-active');
        }
        
        column.innerHTML = `
            <div class="bar-wrapper">
                <div class="bar-value">${percentValue}%</div>
                <div class="bar-fill" style="height: 0%"></div>
            </div>
            <div class="bar-label">${i} Éxito${i === 1 ? '' : 's'}</div>
        `;
        
        column.addEventListener('click', () => {
            document.getElementById('param-x').value = i;
            onParamChange();
        });
        
        chartContainer.appendChild(column);
        
        // Animación de barras
        setTimeout(() => {
            const barFill = column.querySelector('.bar-fill');
            if (barFill) {
                barFill.style.height = `${Math.max(relativeHeight, 1.5)}%`;
            }
        }, 50 + (i - startX) * 20);
    }
    
    // Mostrar puntos suspensivos finales si recortamos el gráfico
    if (endX < paramn) {
        const ellipsis = document.createElement('div');
        ellipsis.className = 'chart-column';
        ellipsis.innerHTML = `
            <div class="bar-wrapper" style="justify-content: center; height: 100%; opacity: 0.3;">
                <span style="font-size: 1.1rem; font-weight: bold; color: var(--color-text-muted);">...</span>
            </div>
            <div class="bar-label">${endX + 1} - ${paramn}</div>
        `;
        chartContainer.appendChild(ellipsis);
    }
}

// --- PARÁMETROS Y VALIDACIONES SUAVES ---

/**
 * Se ejecuta mientras el usuario escribe (input).
 * Actualiza la matemática e interfaces en tiempo real SOLO si el valor parcial ingresado es consistente.
 * NO sobreescribe el texto del input para permitir que el usuario borre y digite varios dígitos sin interrupción.
 */
function onParamInput() {
    let N_val = parseInt(document.getElementById('param-N').value);
    let K_val = parseInt(document.getElementById('param-K').value);
    let n_val = parseInt(document.getElementById('param-n').value);
    let x_val = parseInt(document.getElementById('param-x').value);
    
    if (isNaN(N_val) || isNaN(K_val) || isNaN(n_val) || isNaN(x_val)) {
        return;
    }
    
    if (N_val < 2 || N_val > 100000) return;
    if (K_val < 1 || K_val > N_val) return;
    if (n_val < 1 || n_val > N_val || n_val > 10000) return;
    if (x_val < 0 || x_val > Math.min(n_val, K_val)) return;
    
    paramN = N_val;
    paramK = K_val;
    paramn = n_val;
    paramx = x_val;
    
    document.getElementById('val-NK').textContent = (paramN - paramK).toLocaleString();
    legN.textContent = paramN.toLocaleString();
    legK.textContent = paramK.toLocaleString();
    legNK.textContent = (paramN - paramK).toLocaleString();
    legn.textContent = paramn.toLocaleString();
    legx.textContent = paramx.toLocaleString();
    legnx.textContent = (paramn - paramx).toLocaleString();
    
    document.querySelector('.deck-info h3').textContent = `Mazo de ${paramN.toLocaleString()} Cartas`;
    document.querySelector('.deck-info p').textContent = `${paramK.toLocaleString()} éxitos (doradas), ${(paramN - paramK).toLocaleString()} normales`;
    deckCounter.textContent = paramN.toLocaleString();
    
    renderChart();
    mostrarResultados(paramx, true);
    sincronizarManoManual();
}

/**
 * Se ejecuta al perder foco (blur) o al pulsar Enter.
 * Aquí sí aplicamos filtros estrictos, corregimos inconsistencias y volvemos a escribir los valores sanitizados en el input.
 */
function onParamBlur() {
    let N_val = parseInt(document.getElementById('param-N').value);
    let K_val = parseInt(document.getElementById('param-K').value);
    let n_val = parseInt(document.getElementById('param-n').value);
    let x_val = parseInt(document.getElementById('param-x').value);
    
    if (isNaN(N_val)) N_val = paramN;
    if (isNaN(K_val)) K_val = paramK;
    if (isNaN(n_val)) n_val = paramn;
    if (isNaN(x_val)) x_val = paramx;
    
    if (N_val < 2) N_val = 2;
    if (N_val > 100000) N_val = 100000;
    
    if (K_val < 1) K_val = 1;
    if (K_val > N_val) K_val = N_val;
    
    if (n_val < 1) n_val = 1;
    if (n_val > N_val) n_val = N_val;
    if (n_val > 10000) n_val = 10000;
    
    if (x_val < 0) x_val = 0;
    if (x_val > Math.min(n_val, K_val)) x_val = Math.min(n_val, K_val);
    
    paramN = N_val;
    paramK = K_val;
    paramn = n_val;
    paramx = x_val;
    
    document.getElementById('param-N').value = paramN;
    document.getElementById('param-K').value = paramK;
    document.getElementById('param-n').value = paramn;
    document.getElementById('param-x').value = paramx;
    
    document.getElementById('param-K').max = paramN;
    document.getElementById('param-n').max = Math.min(paramN, 10000);
    document.getElementById('param-x').max = Math.min(paramn, paramK);
    
    document.getElementById('val-NK').textContent = (paramN - paramK).toLocaleString();
    legN.textContent = paramN.toLocaleString();
    legK.textContent = paramK.toLocaleString();
    legNK.textContent = (paramN - paramK).toLocaleString();
    legn.textContent = paramn.toLocaleString();
    legx.textContent = paramx.toLocaleString();
    legnx.textContent = (paramn - paramx).toLocaleString();
    
    document.querySelector('.deck-info h3').textContent = `Mazo de ${paramN.toLocaleString()} Cartas`;
    document.querySelector('.deck-info p').textContent = `${paramK.toLocaleString()} éxitos (doradas), ${(paramN - paramK).toLocaleString()} normales`;
    deckCounter.textContent = paramN.toLocaleString();
    
    renderChart();
    mostrarResultados(paramx, true);
    sincronizarManoManual();
}

function onParamChange() {
    onParamBlur();
}

function sincronizarManoManual() {
    handContainer.innerHTML = '';
    handPlaceholder.classList.add('hidden');
    
    const maxCardsToRender = 10;
    const cardsToRenderCount = Math.min(paramn, maxCardsToRender);
    const hasMore = paramn > maxCardsToRender;
    
    for (let i = 0; i < cardsToRenderCount; i++) {
        const isGold = i < paramx;
        const cardDOM = crearCartaDOM({ id: i, isGold: isGold }, 0);
        handContainer.appendChild(cardDOM);
        cardDOM.classList.add('is-flipped');
    }
    
    if (hasMore) {
        const remainingCount = paramn - maxCardsToRender;
        const moreCard = document.createElement('div');
        moreCard.className = 'card-wrapper card-normal';
        moreCard.innerHTML = `
            <div class="card-inner is-flipped">
                <div class="card-face card-front" style="background: rgba(255,255,255,0.015); border: 2px dashed var(--color-panel-border); justify-content: center;">
                    <i class="fa-solid fa-plus-minus" style="font-size: 1.5rem; color: var(--color-text-muted); margin-bottom: 0.35rem;"></i>
                    <span class="card-name" style="color: var(--color-text-muted); text-align: center; font-size: 0.7rem;">+${remainingCount.toLocaleString()} extraídas</span>
                </div>
            </div>
        `;
        handContainer.appendChild(moreCard);
    }
}

// --- JUEGO Y SIMULACIÓN ---

let mazo = [];

function crearMazo() {
    mazo = [];
    for (let i = 0; i < paramK; i++) {
        mazo.push({ id: i, isGold: true });
    }
    for (let i = paramK; i < paramN; i++) {
        mazo.push({ id: i, isGold: false });
    }
}

function mezclarMazo() {
    for (let i = mazo.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        const temp = mazo[i];
        mazo[i] = mazo[j];
        mazo[j] = temp;
    }
}

function crearCartaDOM(cardInfo, delayIndex) {
    const wrapper = document.createElement('div');
    wrapper.className = `card-wrapper ${cardInfo.isGold ? 'card-gold' : 'card-normal'}`;
    wrapper.style.animationDelay = `${delayIndex * 0.15}s`;
    
    let frontContent = '';
    if (cardInfo.isGold) {
        frontContent = `
            <div class="card-inner-border">
                <div class="card-corner top-left">
                    <span>${paramK.toLocaleString()}</span>
                    <i class="fa-solid fa-crown"></i>
                </div>
                <i class="fa-solid fa-crown card-icon-main"></i>
                <span class="card-name">Éxito (x)</span>
                <div class="card-corner bottom-right">
                    <span>${paramK.toLocaleString()}</span>
                    <i class="fa-solid fa-crown"></i>
                </div>
            </div>
        `;
    } else {
        frontContent = `
            <div class="card-corner top-left">
                <span>${(paramN - paramK).toLocaleString()}</span>
                <i class="fa-solid fa-gem"></i>
            </div>
            <i class="fa-solid fa-gem card-icon-main"></i>
            <span class="card-name">Fracaso</span>
            <div class="card-corner bottom-right">
                <span>${(paramN - paramK).toLocaleString()}</span>
                <i class="fa-solid fa-gem"></i>
            </div>
        `;
    }

    wrapper.innerHTML = `
        <div class="card-inner">
            <div class="card-face card-back">
                <div class="card-back-pattern">
                    <i class="fa-solid fa-crown"></i>
                </div>
            </div>
            <div class="card-face card-front">
                ${frontContent}
            </div>
        </div>
    `;

    return wrapper;
}

function jugarRonda() {
    if (activePlayerIndex === -1) {
        autoRegistrarInvitado();
    }

    btnDraw.disabled = true;
    btnReset.disabled = true;
    
    handContainer.innerHTML = '';
    handPlaceholder.classList.add('hidden');
    
    crearMazo();
    mezclarMazo();
    
    const mano = mazo.slice(0, paramn);
    const goldCount = mano.filter(c => c.isGold).length;
    
    deckCounter.textContent = (paramN - paramn).toLocaleString();

    const maxCardsToRender = 10;
    const cardsToRender = mano.slice(0, maxCardsToRender);
    const hasMore = paramn > maxCardsToRender;

    cardsToRender.forEach((card, index) => {
        const cardDOM = crearCartaDOM(card, index);
        handContainer.appendChild(cardDOM);
        
        setTimeout(() => {
            cardDOM.classList.add('is-flipped');
        }, (index * 220) + 400);
    });

    if (hasMore) {
        const remainingCount = paramn - maxCardsToRender;
        const moreCard = document.createElement('div');
        moreCard.className = 'card-wrapper card-normal';
        moreCard.style.animationDelay = `${maxCardsToRender * 0.15}s`;
        moreCard.innerHTML = `
            <div class="card-inner is-flipped">
                <div class="card-face card-front" style="background: rgba(255,255,255,0.015); border: 2px dashed var(--color-panel-border); justify-content: center;">
                    <i class="fa-solid fa-plus-minus" style="font-size: 1.5rem; color: var(--color-text-muted); margin-bottom: 0.35rem;"></i>
                    <span class="card-name" style="color: var(--color-text-muted); text-align: center; font-size: 0.7rem;">+${remainingCount.toLocaleString()} extraídas</span>
                </div>
            </div>
        `;
        handContainer.appendChild(moreCard);
    }

    const totalAnimTime = (Math.min(paramn, maxCardsToRender) * 220) + 800;
    setTimeout(() => {
        document.getElementById('param-x').value = goldCount;
        onParamBlur();
        
        mostrarResultados(paramx, false); // Rondas reales
        
        btnDraw.disabled = false;
        btnReset.disabled = false;
    }, totalAnimTime);
}

function mostrarResultados(x, isManual = false) {
    const stats = calculateHypergeometric(x, paramN, paramK, paramn);
    const probPercentageText = `${(stats.probability * 100).toFixed(4)}%`;
    
    noGamesYetText.classList.add('hidden');
    resultDetails.classList.remove('hidden');
    
    resX.textContent = x.toLocaleString();
    resNX.textContent = (paramn - x).toLocaleString();
    descX.textContent = x.toLocaleString();
    resPercentage.textContent = `${(stats.probability * 100).toFixed(2)}%`;
    
    if (x >= Math.ceil(paramn / 2)) {
        resultBox.classList.add('win-accent');
    } else {
        resultBox.classList.remove('win-accent');
    }

    calcBreakdown.classList.remove('hidden');
    
    mathX.textContent = x.toLocaleString();
    mathNX.textContent = (paramn - x).toLocaleString();
    mathValX.textContent = x.toLocaleString();
    
    mathCXN.textContent = x.toLocaleString();
    mathCNXN.textContent = (paramn - x).toLocaleString();
    
    mathTopK.textContent = paramK.toLocaleString();
    mathTopNK.textContent = (paramN - paramK).toLocaleString();
    mathNTotal.textContent = paramN.toLocaleString();
    mathnTotal.textContent = paramn.toLocaleString();
    
    mathCK.textContent = paramK.toLocaleString();
    mathCNK.textContent = (paramN - paramK).toLocaleString();
    mathCN.textContent = paramN.toLocaleString();
    mathCn.textContent = paramn.toLocaleString();
    
    mathComb1.textContent = stats.successComb.toLocaleString();
    mathComb2.textContent = stats.failureComb.toLocaleString();
    mathCombTotal.textContent = stats.totalComb.toLocaleString();
    
    mathNumFinal1.textContent = stats.successComb.toLocaleString();
    mathNumFinal2.textContent = stats.failureComb.toLocaleString();
    mathDenFinal1.textContent = stats.totalComb.toLocaleString();
    
    const totalNumerador = stats.successComb * stats.failureComb;
    mathNumTotal.textContent = totalNumerador.toLocaleString();
    mathDenFinal2.textContent = stats.totalComb.toLocaleString();
    
    mathFinalDec.textContent = stats.probability.toFixed(6);
    mathFinalPct.textContent = probPercentageText;

    const columns = document.querySelectorAll('.chart-column');
    columns.forEach(column => {
        const colX = parseInt(column.getAttribute('data-k'));
        if (colX === x) {
            column.classList.add('is-active');
        } else {
            column.classList.remove('is-active');
        }
    });

    // Guardar estadísticas auditadas de rondas con fecha y hora
    if (!isManual && activePlayerIndex !== -1) {
        const player = players[activePlayerIndex];
        player.attempts += 1;
        player.latestResult = x;
        player.latestProb = `${(stats.probability * 100).toFixed(2)}%`;
        
        if (!player.history) {
            player.history = [];
        }
        
        player.history.push({
            N: paramN,
            K: paramK,
            n: paramn,
            x: x,
            probability: probPercentageText,
            timestamp: new Date().toLocaleString('es-ES')
        });
        
        savePlayers();
        renderPlayers();
    }
}

function reiniciarJuego() {
    document.getElementById('param-N').value = 30;
    document.getElementById('param-K').value = 8;
    document.getElementById('param-n').value = 5;
    document.getElementById('param-x').value = 2;
    
    onParamBlur();
    
    handContainer.innerHTML = '';
    handPlaceholder.classList.remove('hidden');
    deckCounter.textContent = paramN.toString();
    
    resultDetails.classList.add('hidden');
    noGamesYetText.classList.remove('hidden');
    resultBox.classList.remove('win-accent');
    calcBreakdown.classList.add('hidden');
}

// --- REGISTRO DE JUGADORES (LOCAL STORAGE E HILO JSON DE AUDITORÍA) ---

function loadPlayers() {
    const data = localStorage.getItem('hipergeom_players');
    if (data) {
        try {
            players = JSON.parse(data);
        } catch (e) {
            players = [];
        }
    } else {
        players = [];
    }
    
    const activeIndex = localStorage.getItem('hipergeom_active_index');
    if (activeIndex !== null) {
        activePlayerIndex = parseInt(activeIndex);
        if (activePlayerIndex >= players.length) activePlayerIndex = -1;
    } else {
        activePlayerIndex = -1;
    }
    
    renderPlayers();
}

function savePlayers() {
    localStorage.setItem('hipergeom_players', JSON.stringify(players));
    localStorage.setItem('hipergeom_active_index', activePlayerIndex.toString());
}

function renderPlayers() {
    playersList.innerHTML = '';
    
    if (players.length === 0) {
        playersList.innerHTML = '<li class="empty-list-msg">No hay jugadores registrados todavía.</li>';
        activePlayerBanner.classList.add('hidden');
        btnClearHistory.classList.add('hidden');
        btnDownloadJSON.classList.add('hidden');
        return;
    }
    
    btnClearHistory.classList.remove('hidden');
    btnDownloadJSON.classList.remove('hidden');
    
    players.forEach((player, index) => {
        const li = document.createElement('li');
        if (index === activePlayerIndex) {
            li.className = 'active-row';
        }
        
        let resultText = 'Sin partidas';
        if (player.attempts > 0) {
            resultText = `Último: ${player.latestResult.toLocaleString()} éxito${player.latestResult === 1 ? '' : 's'} (${player.latestProb}) - Intentos: ${player.attempts.toLocaleString()}`;
        }
        
        li.innerHTML = `<strong>${player.name}</strong> <span style="color: var(--color-text-muted); font-size: 0.8rem; margin-left: 0.5rem;">— ${resultText}</span>`;
        
        li.addEventListener('click', () => {
            selectPlayer(index);
        });
        
        playersList.appendChild(li);
    });
    
    if (activePlayerIndex !== -1) {
        activePlayerName.textContent = players[activePlayerIndex].name;
        activePlayerBanner.classList.remove('hidden');
    } else {
        activePlayerBanner.classList.add('hidden');
    }
}

function registrarJugador(name) {
    name = name.trim();
    if (!name) return;
    
    const existingIndex = players.findIndex(p => p.name.toLowerCase() === name.toLowerCase());
    if (existingIndex !== -1) {
        selectPlayer(existingIndex);
        return;
    }
    
    const newPlayer = {
        name: name,
        attempts: 0,
        latestResult: null,
        latestProb: null,
        history: []
    };
    
    players.push(newPlayer);
    activePlayerIndex = players.length - 1;
    
    savePlayers();
    renderPlayers();
}

function autoRegistrarInvitado() {
    const invitadoNum = players.filter(p => p.name.startsWith('Invitado')).length + 1;
    registrarJugador(`Invitado ${invitadoNum}`);
}

function selectPlayer(index) {
    if (index >= 0 && index < players.length) {
        activePlayerIndex = index;
        savePlayers();
        renderPlayers();
    }
}

function borrarHistorial() {
    players = [];
    activePlayerIndex = -1;
    localStorage.removeItem('hipergeom_players');
    localStorage.removeItem('hipergeom_active_index');
    renderPlayers();
    reiniciarJuego();
}

/**
 * Descarga los datos guardados en un archivo JSON formateado con fecha y horas auditadas
 */
function descargarHistorialJSON() {
    if (players.length === 0) {
        alert("No hay registros que exportar.");
        return;
    }
    
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(players, null, 2));
    const downloadAnchor = document.createElement('a');
    
    const date = new Date();
    const dateString = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `registro_hipergeometrica_${dateString}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
}

// --- RELOJ DINÁMICO EN LA ESQUINA ---

function updateClock() {
    const clockEl = document.getElementById('live-clock-time');
    if (clockEl) {
        const date = new Date();
        const options = { 
            year: 'numeric', 
            month: 'short', 
            day: 'numeric', 
            hour: '2-digit', 
            minute: '2-digit', 
            second: '2-digit',
            hour12: false
        };
        clockEl.textContent = date.toLocaleString('es-ES', options);
    }
}

// --- EVENTOS DE INICIO ---

document.addEventListener('DOMContentLoaded', () => {
    // Reloj dinámico
    updateClock();
    setInterval(updateClock, 1000);
    
    // Validar parámetros iniciales
    onParamBlur();
    
    // Cargar historial de jugadores
    loadPlayers();
    
    // Listeners del juego
    btnDraw.addEventListener('click', jugarRonda);
    btnReset.addEventListener('click', reiniciarJuego);
    
    // Listeners para cambio de parámetros (mientras escriben)
    document.getElementById('param-N').addEventListener('input', onParamInput);
    document.getElementById('param-K').addEventListener('input', onParamInput);
    document.getElementById('param-n').addEventListener('input', onParamInput);
    document.getElementById('param-x').addEventListener('input', onParamInput);
    
    // Listeners para cuando pierden el foco (validación y limpieza estricta de rangos)
    document.getElementById('param-N').addEventListener('blur', onParamBlur);
    document.getElementById('param-K').addEventListener('blur', onParamBlur);
    document.getElementById('param-n').addEventListener('blur', onParamBlur);
    document.getElementById('param-x').addEventListener('blur', onParamBlur);
    
    // Validar al pulsar Enter en cualquier input de parámetro
    const paramInputs = [
        document.getElementById('param-N'),
        document.getElementById('param-K'),
        document.getElementById('param-n'),
        document.getElementById('param-x')
    ];
    paramInputs.forEach(input => {
        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                input.blur(); // Dispara onParamBlur automáticamente
            }
        });
    });
    
    // Listeners de registro de usuarios
    btnRegisterPlayer.addEventListener('click', () => {
        const name = playerInput.value;
        if (name.trim()) {
            registrarJugador(name);
            playerInput.value = '';
        }
    });
    
    playerInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            const name = playerInput.value;
            if (name.trim()) {
                registrarJugador(name);
                playerInput.value = '';
            }
        }
    });
    
    btnClearHistory.addEventListener('click', borrarHistorial);
    btnDownloadJSON.addEventListener('click', descargarHistorialJSON);
});
