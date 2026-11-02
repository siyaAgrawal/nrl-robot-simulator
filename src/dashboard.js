// Dashboard JavaScript - Extracted from HTML
        // Connect to socket.io on current port
        const socket = io({ 
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    reconnectionAttempts: Infinity,
    timeout: 20000
        });
        
        // Connection status tracking
        let isConnected = false;
        let connectionAttempts = 0;
        
        // Connection status tracking and handlers
        function updateConnectionStatus(connected, errorMsg = '') {
    // Update status text and dot
    const statusText = document.getElementById('statusText');
    const statusDot = document.getElementById('statusDot');
            
    if (statusText) {
    if (connected) {
    statusText.textContent = '🟢 Connected to Server';
    statusText.style.color = '#4caf50';
    } else {
    statusText.textContent = errorMsg ? `🔴 ${errorMsg.substring(0, 40)}` : '🔴 Disconnected';
    statusText.style.color = '#f44336';
    }
    }
            
    if (statusDot) {
    statusDot.style.backgroundColor = connected ? '#4caf50' : '#f44336';
    statusDot.classList.toggle('disconnected', !connected);
    }
        }
        
        socket.on('connect', () => {
    isConnected = true;
    connectionAttempts = 0;
    console.log('✓ Connected to server');
    updateConnectionStatus(true);
        });
        
        socket.on('disconnect', () => {
    isConnected = false;
    console.log('✗ Disconnected from server');
    updateConnectionStatus(false);
        });
        
        socket.on('connect_error', (error) => {
    connectionAttempts++;
    console.error('Connection error:', error);
    const errorMsg = error.message || 'Connection failed';
    updateConnectionStatus(false, errorMsg);
            
    // Show user-friendly error
    if (connectionAttempts === 1) {
    console.log('💡 Trying to reconnect...');
    }
        });
        
        let lineChart, speedChart;
        let lineData = [], speedData = [];
        const maxDataPoints = 50;

        // Initialize charts
        const lineCtx = document.getElementById('lineChart').getContext('2d');
        lineChart = new Chart(lineCtx, {
    type: 'line',
    data: {
    labels: [],
    datasets: [{
    label: 'Line Error',
    data: [],
    borderColor: '#667eea',
    backgroundColor: 'rgba(102, 126, 234, 0.1)',
    tension: 0.4
    }]
    },
    options: {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
    y: { beginAtZero: true, grid: { color: '#3a3a3a' } },
    x: { display: false }
    },
    plugins: { legend: { display: false } }
    }
        });

        const speedCtx = document.getElementById('speedChart').getContext('2d');
        speedChart = new Chart(speedCtx, {
    type: 'line',
    data: {
    labels: [],
    datasets: [
    {
    label: 'Left Speed',
    data: [],
    borderColor: '#4caf50',
    backgroundColor: 'rgba(76, 175, 80, 0.1)',
    tension: 0.4
    },
    {
    label: 'Right Speed',
    data: [],
    borderColor: '#f44336',
    backgroundColor: 'rgba(244, 67, 54, 0.1)',
    tension: 0.4
    }
    ]
    },
    options: {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
    y: { beginAtZero: true, grid: { color: '#3a3a3a' } },
    x: { display: false }
    }
    }
        });

        // Socket events
        // Connection handlers are already defined above - removed duplicates

        socket.on('telemetry', (data) => {
    // CRITICAL: Store latest telemetry for tools to use
    window.latestTelemetry = data;
    window.simulationRunning = true; // Mark as running when we receive telemetry
            
    // Update simulation status immediately when telemetry arrives
    if (data.mode === 'main_challenge') {
    const toolStatus = document.getElementById('simulation-status');
    if (toolStatus) {
    toolStatus.textContent = 'Main Challenge: Running';
    toolStatus.style.background = 'rgba(76, 175, 80, 0.3)';
    toolStatus.style.color = '#4caf50';
    }
    }
    window.latestTelemetry = data;
            
    // Debug: Log telemetry reception for Main Challenge
    if (data.mode === 'main_challenge') {
    if (!window.telemetryCount) window.telemetryCount = 0;
    window.telemetryCount++;
    if (window.telemetryCount % 20 === 0) { // Log every 20th packet
    console.log(`📊 Telemetry received (${window.telemetryCount} packets):`, {
    mode: data.mode,
    hasPosition: !!data.position,
    position: data.position,
    time: data.challenge_state?.time_remaining
    });
    }
    }
            
    updateMetrics(data);
    updateCharts(data);
    updateSimulations(data);
    // Update health monitor in real-time from telemetry (throttled)
    if (!window.lastHealthUpdate || Date.now() - window.lastHealthUpdate > 2000) {
    const healthTab = document.getElementById('health-tab');
    if (healthTab && healthTab.classList.contains('active')) {
    updateHardwareHealth();
    }
    window.lastHealthUpdate = Date.now();
    }
            
    // Update strategy when Main Challenge telemetry arrives (throttled)
    if (data.mode === 'main_challenge') {
    // Update simulation status immediately
    const toolStatus = document.getElementById('simulation-status');
    if (toolStatus) {
    toolStatus.textContent = 'Main Challenge: Running';
    toolStatus.style.background = 'rgba(76, 175, 80, 0.3)';
    toolStatus.style.color = '#4caf50';
    }
                
    // Update strategy
    if (!window.lastStrategyUpdate || Date.now() - window.lastStrategyUpdate > 2000) {
    updateStrategy();
    window.lastStrategyUpdate = Date.now();
    }
    }
        });
        
        // Debug: Log telemetry for Main Challenge
        socket.on('telemetry', (data) => {
    if (data.mode === 'main_challenge') {
    if (Math.random() < 0.05) { // Log 5% of telemetry packets
    console.log('Main Challenge telemetry:', {
    hasPosition: !!data.position,
    position: data.position,
    hasMainRobot: !!mainRobot,
    hasMainScene: !!mainScene
    });
    }
    }
        });
        
        function updateSimulations(data) {
    // Update Auto Challenge simulation
    if (data.mode === 'auto_challenge' && autoRobot) {
    if (data.position) {
    autoRobot.position.set(data.position.x, 0.1, data.position.y);
    autoRobot.rotation.y = data.position.theta;
    }
    if (data.challenge_state) {
    document.getElementById('auto-time-remaining').textContent = 
    Math.floor(data.challenge_state.time_remaining || 0) + 's';
    document.getElementById('auto-corners').textContent = data.challenge_state.corners || 0;
    document.getElementById('auto-pickup').textContent = data.challenge_state.pickup ? 'Yes' : 'No';
    document.getElementById('auto-dropoff').textContent = data.challenge_state.dropoff ? 'Yes' : 'No';
                    
    // Update predictions
    if (data.challenge_state.time_remaining > 0) {
    fetch('/api/predict-completion?challenge=auto')
    .then(r => r.json())
    .then(pred => {
    document.getElementById('auto-predictions').innerHTML = `
    <p><strong>Will Finish:</strong> ${pred.will_finish ? 'Yes ✓' : 'No ✗'}</p>
    <p><strong>Confidence:</strong> ${(pred.confidence * 100).toFixed(0)}%</p>
    <p><strong>Expected Score:</strong> ${pred.expected_score}/155</p>
    <p><strong>Risk:</strong> ${pred.risk}</p>
    `;
    });
    }
    }
    }
            
    // COMPLETELY REWRITTEN: Update Main Challenge simulation
    if (data.mode === 'main_challenge') {
    // Ensure simulation is initialized
    if (!mainRenderer || !mainRobot || !mainScene) {
    // Auto-initialize if on simulation tab
    const simTab = document.getElementById('simulation-tab');
    if (simTab && simTab.classList.contains('active')) {
    if (!mainRenderer) {
    console.log('🔄 [MAIN CHALLENGE] Auto-initializing 3D simulation...');
    initMainSimulation();
    }
    }
    return; // Skip update if not initialized
    }
                
    // CRITICAL: Update robot position IMMEDIATELY
    // Position should always be in telemetry, but handle missing gracefully
    if (!data.position) {
    console.warn('⚠️ [MAIN CHALLENGE] Telemetry missing position data');
    return; // Skip update if no position
    }
                
    const targetX = data.position.x;
    const targetZ = data.position.y; // Three.js Z = server Y
    const targetY = 0.3; // Height above field
    const targetTheta = data.position.theta || 0;
                
    // Smooth but responsive position update (game-like feel)
    const lerpFactor = 0.3; // Smooth interpolation for visual appeal
    mainRobot.position.x += (targetX - mainRobot.position.x) * lerpFactor;
    mainRobot.position.y = targetY; // Keep height constant
    mainRobot.position.z += (targetZ - mainRobot.position.z) * lerpFactor;
                
    // Smooth rotation update
    let angleDiff = targetTheta - mainRobot.rotation.y;
    // Normalize angle difference to [-PI, PI]
    while (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
    while (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;
    mainRobot.rotation.y += angleDiff * lerpFactor;
                
    // CRITICAL: Force visibility and matrix update
    mainRobot.visible = true;
    mainRobot.updateMatrixWorld(true);
                
    // Update camera to follow robot
    if (window.mainCamera && window.cameraTarget) {
    window.cameraTarget.set(targetX, targetY, targetZ);
    }
                
    // Update position display
    const posEl = document.getElementById('main-robot-pos');
    if (posEl) {
    posEl.textContent = `X: ${targetX.toFixed(2)}, Y: ${data.position.y.toFixed(2)}`;
    }
                
    // Update robot light position
    if (window.robotLight) {
    window.robotLight.position.set(targetX, 2, targetZ);
    }
                
    // Render the scene to ensure updates are visible
    if (mainRenderer && mainScene && window.mainCamera) {
    mainRenderer.render(mainScene, window.mainCamera);
    }
                
    // Debug: Log movement occasionally
    if (!window.lastRobotMoveLog || Date.now() - window.lastRobotMoveLog > 1000) {
    console.log('🤖 [ROBOT MOVED] Position:', {x: targetX.toFixed(2), y: data.position.y.toFixed(2), z: targetZ.toFixed(2), theta: targetTheta.toFixed(2)});
    window.lastRobotMoveLog = Date.now();
    }
                    
    // Update charge indicator if robot has charge - Game-like visual
    const chargeIndicator = mainRobot.children.find(child => child.name === 'chargeIndicator');
    if (data.challenge_state && data.challenge_state.charge_possessed) {
    const chargeType = data.challenge_state.charge_type || 'blue';
    const chargeColor = chargeType === 'red' ? 0xf44336 : 0x2196F3;
                        
    if (!chargeIndicator) {
    // Add charge indicator with color matching charge type
    const chargeGeom = new THREE.BoxGeometry(0.25, 0.25, 0.25);
    const chargeMat = new THREE.MeshStandardMaterial({
    color: chargeColor,
    emissive: chargeColor,
    emissiveIntensity: 0.5
    });
    const newChargeIndicator = new THREE.Mesh(chargeGeom, chargeMat);
    newChargeIndicator.position.set(0, 0.4, 0);
    newChargeIndicator.name = 'chargeIndicator';
    mainRobot.add(newChargeIndicator);
    } else {
    // Update color if charge type changed
    chargeIndicator.material.color.setHex(chargeColor);
    chargeIndicator.material.emissive.setHex(chargeColor);
    }
    } else if (chargeIndicator) {
    // Remove charge indicator with animation
    chargeIndicator.scale.multiplyScalar(0.8);
    setTimeout(() => {
    if (chargeIndicator && chargeIndicator.parent) {
    mainRobot.remove(chargeIndicator);
    }
    }, 100);
    }
                    
    // Handle charge pickup/removal - Game-like mechanics
    if (data.challenge_state) {
    // Update charge visibility based on available_charges list from server
    if (data.challenge_state.available_charges) {
    const availablePositions = new Set();
    data.challenge_state.available_charges.forEach(charge => {
    availablePositions.add(`${charge.x.toFixed(1)}_${charge.y.toFixed(1)}`);
    });
                            
    // Hide charges that have been picked up
    mainScene.children.forEach(child => {
    if (child.name && (child.name.startsWith('charge_blue_') || child.name.startsWith('charge_red_'))) {
    const chargeKey = `${child.position.x.toFixed(1)}_${child.position.z.toFixed(1)}`;
    if (!availablePositions.has(chargeKey)) {
    // This charge was picked up - hide it with animation
    if (child.visible) {
    // Animate charge pickup
    const pickupAnimation = () => {
    child.scale.multiplyScalar(0.9);
    child.position.y += 0.05;
    if (child.scale.x > 0.1) {
    requestAnimationFrame(pickupAnimation);
    } else {
    child.visible = false;
    }
    };
    pickupAnimation();
    }
    } else {
    // Charge is still available - make sure it's visible
    if (!child.visible) {
    child.visible = true;
    child.scale.set(1, 1, 1);
    child.position.y = 0.2;
    }
    }
    }
    });
    }
                        
    // Visual feedback when charge is scored - Track previous state
    if (!window.previousChargePossessed) {
    window.previousChargePossessed = false;
    }
                        
    const hadCharge = window.previousChargePossessed;
    const hasCharge = data.challenge_state.charge_possessed;
    window.previousChargePossessed = hasCharge;
                        
    // If we just scored (had charge, now don't, and we're in drop zone)
    if (hadCharge && !hasCharge && data.challenge_state.in_drop_zone) {
    // Add score popup effect
    const scoreEffect = document.createElement('div');
    scoreEffect.style.cssText = `
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    font-size: 64px;
    color: #4caf50;
    font-weight: bold;
    text-shadow: 0 0 20px rgba(76, 175, 80, 0.8);
    pointer-events: none;
    z-index: 10000;
    animation: scorePop 1.5s ease-out forwards;
    font-family: Arial, sans-serif;
    `;
    scoreEffect.textContent = '+1 CHARGE SCORED!';
    document.body.appendChild(scoreEffect);
    setTimeout(() => {
    if (scoreEffect.parentNode) {
    scoreEffect.remove();
    }
    }, 1500);
    }
    }
    }
    if (data.challenge_state) {
    const timeEl = document.getElementById('main-time-remaining');
    const chargesEl = document.getElementById('main-charges');
    const csEl = document.getElementById('main-cs-status');
                    
    if (timeEl) timeEl.textContent = Math.floor(data.challenge_state.time_remaining || 0) + 's';
    if (chargesEl) chargesEl.textContent = data.challenge_state.charges_scored || 0;
    if (csEl) csEl.textContent = data.challenge_state.charge_station_status || 'None';
                    
    // Update robot position display
    if (data.position) {
    const posEl = document.getElementById('main-robot-pos');
    if (posEl) {
    posEl.textContent = `X: ${data.position.x.toFixed(2)}, Y: ${data.position.y.toFixed(2)}`;
    }
    }
                    
    // Update robot status text
    const robotStatusEl = document.getElementById('robot-status-text');
    if (robotStatusEl) {
    let statusText = '✅ Robot is moving';
    if (data.challenge_state.charge_possessed) {
    statusText += ' - Carrying CHARGE';
    }
    if (data.challenge_state.in_source_zone) {
    statusText += ' - In Source Zone';
    }
    if (data.challenge_state.in_drop_zone) {
    statusText += ' - In Drop Zone';
    }
    if (data.challenge_state.charge_station_status !== 'none') {
    statusText += ` - Charge Station: ${data.challenge_state.charge_station_status}`;
    }
    robotStatusEl.textContent = statusText;
    }
                    
    // Update strategy
    fetch('/api/strategy-engine', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({
    charges_scored: data.challenge_state.charges_scored || 0,
    time_remaining: data.challenge_state.time_remaining || 150,
    golden_available: true
    })
    })
    .then(r => r.json())
    .then(strat => {
    const s = strat.strategy || {};
    const strategyContent = document.getElementById('strategy-content');
    if (strategyContent) {
    strategyContent.innerHTML = `
    <p style="color: #667eea; font-weight: bold; margin-bottom: 8px;">📋 Current Strategy</p>
    <p><strong>Strategy:</strong> ${s.name || 'Continue'}</p>
    <p><strong>Priority:</strong> ${s.priority || 'N/A'}</p>
    <p><strong>Route:</strong> ${s.route || 'N/A'}</p>
    <p><strong>Expected Score:</strong> ${s.expected_score || 0}</p>
    <p><strong>Risk:</strong> ${s.risk || 'N/A'}</p>
    `;
    }
    })
    .catch(err => {
    console.error('Error updating strategy:', err);
    const strategyContent = document.getElementById('strategy-content');
    if (strategyContent) {
    strategyContent.innerHTML = '<p style="color: #888;">Error loading strategy</p>';
    }
    });;
    }
    }
}

function updateMetrics(data) {
    document.getElementById('currentMode').textContent = data.mode || '-';
    document.getElementById('leftPWM').textContent = data.cmd?.left_pwm || 0;
    document.getElementById('rightPWM').textContent = data.cmd?.right_pwm || 0;
    document.getElementById('lineError').textContent = data.line?.error || 0;
    document.getElementById('tofDistance').textContent = data.distance?.tof_front || '-';
    document.getElementById('battery').textContent = data.battery?.raw || '-';

    if (data.mode === 'manual') {
    document.getElementById('driverCard').style.display = 'block';
    updateDriverAnalysis();
    } else {
    document.getElementById('driverCard').style.display = 'none';
    }
        }

        function updateCharts(data) {
    const timestamp = new Date().toLocaleTimeString();
    const lineError = Math.abs(data.line?.error || 0);
    const leftSpeed = Math.abs(data.cmd?.left_pwm || 0);
    const rightSpeed = Math.abs(data.cmd?.right_pwm || 0);

    // Update line chart
    lineChart.data.labels.push(timestamp);
    lineChart.data.datasets[0].data.push(lineError);
    if (lineChart.data.labels.length > maxDataPoints) {
    lineChart.data.labels.shift();
    lineChart.data.datasets[0].data.shift();
    }
    lineChart.update('none');

    // Update speed chart
    speedChart.data.labels.push(timestamp);
    speedChart.data.datasets[0].data.push(leftSpeed);
    speedChart.data.datasets[1].data.push(rightSpeed);
    if (speedChart.data.labels.length > maxDataPoints) {
    speedChart.data.labels.shift();
    speedChart.data.datasets[0].data.shift();
    speedChart.data.datasets[1].data.shift();
    }
    speedChart.update('none');
        }

        function updateAnalysis() {
    fetch('/api/analysis')
    .then(r => r.json())
    .then(data => {
    document.getElementById('avgLineError').textContent = data.avg_line_error?.toFixed(1) || '-';
    document.getElementById('avgSpeed').textContent = data.avg_speed?.toFixed(1) || '-';
    document.getElementById('speedVariance').textContent = data.speed_variance?.toFixed(1) || '-';
                    
    const recList = document.getElementById('recList');
    recList.innerHTML = '';
    (data.recommendations || []).forEach(rec => {
    const li = document.createElement('li');
    li.textContent = rec;
    recList.appendChild(li);
    });
    });
        }

        function updateDriverAnalysis() {
    fetch('/api/driver-analysis')
    .then(r => r.json())
    .then(data => {
    document.getElementById('driverSpeed').textContent = data.avg_speed?.toFixed(1) || '-';
    document.getElementById('driverSmoothness').textContent = data.smoothness?.toFixed(2) || '-';
                    
    const recList = document.getElementById('driverRecList');
    recList.innerHTML = '';
    (data.recommendations || []).forEach(rec => {
    const li = document.createElement('li');
    li.textContent = rec;
    recList.appendChild(li);
    });
    });
        }

        function generateFakeData(skill, duration) {
    const statusDiv = document.getElementById('fakeDataStatus');
    statusDiv.style.display = 'block';
    statusDiv.style.background = '#3a3a3a';
    statusDiv.style.color = '#aaa';
    statusDiv.textContent = `Generating ${skill} driver data (${duration}s)...`;
            
    fetch('/api/generate-fake-driving', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({
    skill: skill,
    duration: duration
    })
    })
    .then(r => r.json())
    .then(data => {
    if (data.success) {
    statusDiv.style.background = 'rgba(76, 175, 80, 0.2)';
    statusDiv.style.color = '#4caf50';
    statusDiv.innerHTML = `✓ ${data.message}<br><small>Now ask the AI assistant: "How can I improve?" or "How am I doing?"</small>`;
                    
    // Show driver card if hidden
    document.getElementById('driverCard').style.display = 'block';
                    
    // Update driver analysis immediately
    setTimeout(() => {
    updateDriverAnalysis();
    updateAnalysis();
    }, 500);
    } else {
    statusDiv.style.background = 'rgba(244, 67, 54, 0.2)';
    statusDiv.style.color = '#f44336';
    statusDiv.textContent = '✗ Failed to generate data';
    }
    })
    .catch(err => {
    console.error('Error generating fake data:', err);
    statusDiv.style.background = 'rgba(244, 67, 54, 0.2)';
    statusDiv.style.color = '#f44336';
    statusDiv.textContent = '✗ Error: ' + err.message;
    });
        }

        function sendMessage() {
    const input = document.getElementById('chatInput');
    const query = input.value.trim();
    if (!query) return;

    // Add user message
    const messages = document.getElementById('chatMessages');
    const userMsg = document.createElement('div');
    userMsg.className = 'message user';
    userMsg.textContent = query;
    messages.appendChild(userMsg);
    messages.scrollTop = messages.scrollHeight;

    input.value = '';

    // Get bot response
    fetch('/api/chatbot', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query })
    })
    .then(r => r.json())
    .then(data => {
    const botMsg = document.createElement('div');
    botMsg.className = 'message bot';
    botMsg.textContent = data.response;
    messages.appendChild(botMsg);
    messages.scrollTop = messages.scrollHeight;
    });
        }

        // Simulation control
        let simulationRunning = false;
        let simulationRunId = null;
        let simulationStartTime = null;

        function toggleSimulation() {
    const button = document.getElementById('simButton');
    const status = document.getElementById('simStatus');
            
    if (simulationRunning) {
    // Stop simulation
    stopSimulation();
    } else {
    // Start simulation
    startSimulation();
    }
        }

        function startSimulation() {
    console.log('🔄 [startSimulation] Called, currentChallenge:', currentChallenge);
            
    // Don't start if already running (unless forced)
    if (simulationRunning && currentChallenge !== 'main') {
    console.log('⚠ [startSimulation] Already running, skipping');
    return;
    }
            
    const button = document.getElementById('simButton');
    const status = document.getElementById('simStatus');
    const toolStatus = document.getElementById('simulation-status');
            
    if (button) {
    button.disabled = true;
    button.textContent = 'Starting...';
    }
            
    // Update status immediately
    if (status) {
    const challengeName = currentChallenge === 'main' ? 'Main Challenge' : 
    currentChallenge === 'auto' ? 'Auto Challenge' : 'Simulation';
    status.textContent = `${challengeName}: Starting...`;
    status.style.background = 'rgba(255, 193, 7, 0.3)';
    }
    if (toolStatus) {
    toolStatus.textContent = 'Starting...';
    toolStatus.style.background = 'rgba(255, 193, 7, 0.3)';
    }
            
    console.log('📡 [startSimulation] Calling /api/start-simulation...');
    fetch('/api/start-simulation', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
    })
    .then(r => {
    console.log('📡 [startSimulation] Response status:', r.status);
    if (!r.ok) {
    throw new Error(`HTTP ${r.status}: ${r.statusText}`);
    }
    return r.json();
    })
    .then(data => {
    console.log('📦 [startSimulation] Response data:', data);
    if (data.success) {
    simulationRunning = true;
    simulationRunId = data.run_id;
    simulationStartTime = Date.now();
                    
    if (button) {
    button.disabled = false;
    button.classList.add('running');
    button.textContent = '⏹ Stop Simulation';
    }
                    
    const challengeName = currentChallenge === 'main' ? 'Main Challenge' : 
    currentChallenge === 'auto' ? 'Auto Challenge' : 'Simulation';
                    
    if (status) {
    status.textContent = `${challengeName}: Running`;
    status.style.background = 'rgba(76, 175, 80, 0.3)';
    }
                    
    if (toolStatus) {
    toolStatus.textContent = `${challengeName}: Running`;
    toolStatus.style.background = 'rgba(76, 175, 80, 0.3)';
    toolStatus.style.color = '#4caf50';
    }
                    
    console.log('✅ [startSimulation] Successfully started');
                    
    // Clear previous data for fresh run
    lineChart.data.labels = [];
    lineChart.data.datasets[0].data = [];
    speedChart.data.labels = [];
    speedChart.data.datasets[0].data = [];
    speedChart.data.datasets[1].data = [];
    lineChart.update();
    speedChart.update();
                    
    // Clear metrics
    document.getElementById('leftPWM').textContent = '0';
    document.getElementById('rightPWM').textContent = '0';
    document.getElementById('lineError').textContent = '0';
    document.getElementById('tofDistance').textContent = '-';
    document.getElementById('currentMode').textContent = '-';
    } else {
    alert('Failed to start simulation: ' + (data.error || 'Unknown error'));
    button.disabled = false;
    }
    })
    .catch(err => {
    console.error('Error starting simulation:', err);
    alert('Error starting simulation. Check console for details.');
    button.disabled = false;
    });
        }

        function stopSimulation() {
    const button = document.getElementById('simButton');
    const status = document.getElementById('simStatus');
    const toolStatus = document.getElementById('simulation-status');
            
    button.disabled = true;
    button.textContent = 'Stopping...';
            
    fetch('/api/stop-simulation', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
    })
    .then(r => r.json())
    .then(data => {
    simulationRunning = false;
                
    button.disabled = false;
    button.classList.remove('running');
    button.textContent = '▶ Run Simulation';
                
    if (data.analysis) {
    const duration = ((Date.now() - simulationStartTime) / 1000).toFixed(1);
    if (status) {
    status.textContent = `Simulation: Completed (${duration}s) - Check analysis below`;
    status.style.background = 'rgba(102, 126, 234, 0.3)';
    }
    if (toolStatus) {
    toolStatus.textContent = `Simulation: Completed (${duration}s)`;
    toolStatus.style.background = 'rgba(102, 126, 234, 0.3)';
    }
                    
    // Show final analysis
    showSimulationResults(data.analysis);
    } else {
    if (status) {
    status.textContent = 'Simulation: Stopped';
    status.style.background = 'rgba(255,255,255,0.2)';
    }
    if (toolStatus) {
    toolStatus.textContent = 'Not running';
    toolStatus.style.background = '#3a3a3a';
    toolStatus.style.color = '#888';
    }
    }
    })
    .catch(err => {
    console.error('Error stopping simulation:', err);
    button.disabled = false;
    });
        }

        function showSimulationResults(analysis) {
    // Update performance metrics
    if (analysis.avg_line_error !== undefined) {
    document.getElementById('avgLineError').textContent = analysis.avg_line_error.toFixed(1);
    }
    if (analysis.avg_speed !== undefined) {
    document.getElementById('avgSpeed').textContent = analysis.avg_speed.toFixed(1);
    }
    if (analysis.speed_variance !== undefined) {
    document.getElementById('speedVariance').textContent = analysis.speed_variance.toFixed(1);
    }
            
    // Show recommendations
    const recList = document.getElementById('recList');
    recList.innerHTML = '';
    if (analysis.recommendations && analysis.recommendations.length > 0) {
    analysis.recommendations.forEach(rec => {
    const li = document.createElement('li');
    li.textContent = rec;
    recList.appendChild(li);
    });
    } else {
    const li = document.createElement('li');
    li.textContent = 'No specific recommendations at this time.';
    recList.appendChild(li);
    }
        }

        // Update simulation timer if running
        setInterval(() => {
    if (simulationRunning && simulationStartTime) {
    const elapsed = ((Date.now() - simulationStartTime) / 1000).toFixed(1);
    const challengeName = currentChallenge === 'auto' ? 'Auto Challenge' : 
    currentChallenge === 'main' ? 'Main Challenge' : 'Simulation';
    document.getElementById('simStatus').textContent = 
    `${challengeName}: Running (${elapsed}s)`;
    }
        }, 100);

        // Tab switching
        function switchTab(tabName) {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    if (event && event.target) {
    event.target.classList.add('active');
    }
    const tabContent = document.getElementById(tabName + '-tab');
    if (tabContent) {
    tabContent.classList.add('active');
    }
            
    // Update health monitor when switching to health tab
    if (tabName === 'health') {
    updateHardwareHealth();
    }
            
    // Initialize simulations when switching to simulation tab
    if (tabName === 'simulation') {
    // Show the appropriate simulation card
    const mainCard = document.getElementById('main-simulation-card');
    const autoCard = document.getElementById('auto-simulation-card');
                
    // Show main challenge card by default or based on current challenge
    if (currentChallenge === 'main' || !currentChallenge) {
    if (mainCard) {
    mainCard.style.display = 'block';
    console.log('✅ Main simulation card shown');
    }
    if (autoCard) autoCard.style.display = 'none';
    } else if (currentChallenge === 'auto') {
    if (mainCard) mainCard.style.display = 'none';
    if (autoCard) autoCard.style.display = 'block';
    } else {
    // Default to main challenge
    if (mainCard) {
    mainCard.style.display = 'block';
    console.log('✅ Main simulation card shown (default)');
    }
    if (autoCard) autoCard.style.display = 'none';
    }
                
    // Auto-initialize if challenge is already running
    if (currentChallenge === 'auto' && !autoRenderer) {
    initAutoSimulation();
    } else if ((currentChallenge === 'main' || !currentChallenge) && !mainRenderer) {
    // Initialize main simulation by default
    setTimeout(() => {
    console.log('🔄 Auto-initializing Main Challenge simulation...');
    initMainSimulation();
    }, 200);
    }
    }
            
    // Update tools when switching to tools tab
    if (tabName === 'tools') {
    updateAllTools();
    }
            
    // Update health when switching to health tab
    if (tabName === 'health') {
    updateHardwareHealth();
    }
            
    // Initialize mind map when switching to mindmap tab
    if (tabName === 'mindmap') {
    setTimeout(initMindMap, 100);
    }
        }

        // Challenge controls
        function startAutoChallenge() {
    fetch('/api/start-auto-challenge', {method: 'POST'})
    .then(r => r.json())
    .then(data => {
    if (data.success) {
    currentChallenge = 'auto';
    // Switch to simulation tab
    document.querySelectorAll('.tab').forEach(t => {
    if (t.textContent.includes('Simulation')) {
    t.click();
    }
    });
    // Show auto simulation
    document.getElementById('auto-simulation-card').style.display = 'block';
    document.getElementById('main-simulation-card').style.display = 'none';
    // Initialize if not already
    setTimeout(() => {
    if (!autoRenderer) {
    initAutoSimulation();
    }
    // Start simulation
    if (!simulationRunning) {
    toggleSimulation();
    }
    }, 100);
    }
    })
    .catch(err => {
    console.error('Error starting auto challenge:', err);
    alert('Failed to start Auto Challenge. Check console for details.');
    });
        }

        // SIMPLIFIED AND ROBUST: Start Main Challenge function
        // Define it as a regular function first, then make it global
        function startMainChallengeFromSim() {
    console.log('🚀🚀🚀 [MAIN CHALLENGE] BUTTON CLICKED - STARTING 🚀🚀🚀');
    console.log('   Function called at:', new Date().toISOString());
            
    try {
    const startBtn = document.getElementById('start-main-challenge-btn');
    const statusEl = document.getElementById('main-sim-status');
                
    if (!startBtn) {
    alert('ERROR: Start button not found! Please refresh the page.');
    console.error('❌ Start button element not found');
    return;
    }
                
    // Update UI immediately
    startBtn.disabled = true;
    startBtn.textContent = 'Starting...';
    startBtn.style.opacity = '0.7';
                
    if (statusEl) {
    statusEl.textContent = 'Initializing...';
    statusEl.style.background = 'rgba(255, 193, 7, 0.3)';
    statusEl.style.color = '#ffc107';
    }
                
    // Step 1: Initialize 3D simulation if needed
    if (!mainRenderer) {
    console.log('📐 [STEP 1] Initializing 3D simulation...');
    try {
    initMainSimulation();
    // Wait a bit for initialization
    setTimeout(() => {
    if (!mainRenderer || !mainRobot) {
    console.error('❌ 3D initialization failed');
    alert('Failed to initialize 3D simulation. Check console.');
    if (startBtn) {
    startBtn.disabled = false;
    startBtn.textContent = '▶ Start Main Challenge';
    startBtn.style.opacity = '1';
    }
    return;
    }
    console.log('✅ [STEP 1] 3D simulation ready');
    proceedWithStart();
    }, 800);
    } catch (err) {
    console.error('❌ Init error:', err);
    alert('Error initializing 3D: ' + err.message);
    if (startBtn) {
    startBtn.disabled = false;
    startBtn.textContent = '▶ Start Main Challenge';
    startBtn.style.opacity = '1';
    }
    }
    } else {
    console.log('✅ [STEP 1] 3D already initialized');
    proceedWithStart();
    }
    } catch (err) {
    console.error('❌ FATAL ERROR in startMainChallengeFromSim:', err);
    console.error('   Error stack:', err.stack);
    alert('Fatal error: ' + err.message + '\nCheck console (F12) for details.');
    }
        }
        
        // Make function globally accessible immediately
        if (typeof window !== 'undefined') {
    window.startMainChallengeFromSim = startMainChallengeFromSim;
    console.log('✅ startMainChallengeFromSim registered globally at', new Date().toISOString());
        } else {
    console.error('❌ window object not available');
        }
        
        function proceedWithStart() {
    console.log('🌐 [STEP 2] Starting server challenge...');
    const startBtn = document.getElementById('start-main-challenge-btn');
    const statusEl = document.getElementById('main-sim-status');
            
    if (statusEl) {
    statusEl.textContent = 'Connecting to server...';
    }
            
    // Start challenge on server
    fetch('/api/start-main-challenge', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'}
    })
    .then(r => {
    console.log('📡 [STEP 2] Server response status:', r.status);
    if (!r.ok) {
    throw new Error(`HTTP ${r.status}: ${r.statusText}`);
    }
    return r.json();
    })
    .then(data => {
    console.log('📦 [STEP 2] Server response:', data);
    if (!data.success) {
    throw new Error(data.error || 'Server returned failure');
    }
                
    console.log('✅ [STEP 2] Server challenge started');
    currentChallenge = 'main';
                
    // Step 3: Start simulation telemetry
    console.log('🔄 [STEP 3] Starting simulation telemetry...');
    startSimulation();
    simulationRunning = true;
    window.simulationRunning = true; // Also set on window for other functions
                
    // CRITICAL: Enable controls immediately
    console.log('🎮 [STEP 3.5] Enabling controls...');
    // Controls should already be set up, but ensure they're active
    if (typeof setupKeyboardControls === 'function') {
    setupKeyboardControls();
    }
    if (typeof setupPS5Controller === 'function') {
    setupPS5Controller();
    }
                
    // Step 4: Update UI
    console.log('🎨 [STEP 4] Updating UI...');
    updateMainChallengeUI(true);
                
    // Step 5: Position robot
    if (mainRobot) {
    mainRobot.position.set(0, 0.3, -4);
    mainRobot.rotation.y = 0;
    mainRobot.visible = true;
    mainRobot.updateMatrixWorld(true);
    console.log('✅ [STEP 5] Robot positioned');
    }
                
    // Step 6: Start animation loop if not already running
    if (mainRenderer && mainScene && window.mainCamera) {
    // Animation loop should already be running from init, but ensure it is
    if (typeof animateMainSimulation === 'function') {
    animateMainSimulation();
    console.log('✅ [STEP 6] Animation loop started');
    }
    }
                
    // Step 7: Update strategy immediately
    console.log('📋 [STEP 7] Updating strategy...');
    updateStrategy();
                
    console.log('🎉🎉🎉 [MAIN CHALLENGE] FULLY STARTED! 🎉🎉🎉');
    })
    .catch(err => {
    console.error('❌ ERROR in proceedWithStart:', err);
    alert('Failed to start: ' + err.message + '\nCheck console (F12)');
    updateMainChallengeUI(false);
    });
        }
        
        
        function updateMainChallengeUI(running) {
    const simStatus = document.getElementById('simStatus');
    const toolStatus = document.getElementById('simulation-status');
    const mainSimStatus = document.getElementById('main-sim-status');
    const startBtn = document.getElementById('start-main-challenge-btn');
    const robotStatus = document.getElementById('robot-status-text');
            
    if (running) {
    if (simStatus) {
    simStatus.textContent = 'Main Challenge: Running';
    simStatus.style.background = 'rgba(76, 175, 80, 0.3)';
    }
    if (toolStatus) {
    toolStatus.textContent = 'Main Challenge: Running';
    toolStatus.style.background = 'rgba(76, 175, 80, 0.3)';
    toolStatus.style.color = '#4caf50';
    }
    if (mainSimStatus) {
    mainSimStatus.textContent = '✅ Running - Controls Active';
    mainSimStatus.style.background = 'rgba(76, 175, 80, 0.3)';
    mainSimStatus.style.color = '#4caf50';
    }
    if (startBtn) {
    startBtn.disabled = false;
    startBtn.textContent = '⏹ Stop Challenge';
    startBtn.style.background = '#f44336';
    startBtn.style.opacity = '1';
    startBtn.onclick = function() {
    stopSimulation();
    updateMainChallengeUI(false);
    if (startBtn) {
    startBtn.textContent = '▶ Start Main Challenge';
    startBtn.style.background = '#9c27b0';
    startBtn.onclick = startMainChallengeFromSim;
    }
    };
    }
    if (robotStatus) {
    robotStatus.textContent = '✅ Simulation Running - Use WASD or PS5 controller to move robot';
    robotStatus.style.color = '#4caf50';
    }
    } else {
    if (startBtn) {
    startBtn.disabled = false;
    startBtn.textContent = '▶ Start Main Challenge';
    startBtn.style.background = '#9c27b0';
    startBtn.style.opacity = '1';
    }
    if (mainSimStatus) {
    mainSimStatus.textContent = 'Not started';
    mainSimStatus.style.background = '#3a3a3a';
    mainSimStatus.style.color = '#888';
    }
    }
        }
        
        // Keep old function for compatibility - redirects to new one
        function startMainChallenge() {
    // Switch to simulation tab first
    const simTab = Array.from(document.querySelectorAll('.tab')).find(t => 
    t.textContent.includes('Simulation') || t.textContent.includes('🎮')
    );
    if (simTab) {
    simTab.click();
    }
            
    // Show main simulation card
    const mainCard = document.getElementById('main-simulation-card');
    const autoCard = document.getElementById('auto-simulation-card');
    if (mainCard) mainCard.style.display = 'block';
    if (autoCard) autoCard.style.display = 'none';
            
    // Wait a bit for tab to switch, then start
    setTimeout(() => {
    startMainChallengeFromSim();
    }, 300);
        }

        // Simulation state
        let currentChallenge = null;
        let autoScene, autoCamera, autoRenderer, autoRobot;
        let mainScene, mainCamera, mainRenderer, mainRobot;
        
        // Initialize Auto Challenge 3D Simulation
        function initAutoSimulation() {
    if (autoRenderer) return; // Already initialized
            
    const container = document.getElementById('auto-simulation-container');
    const canvas = document.getElementById('auto-simulation-canvas');
            
    if (!container || !canvas) {
    console.error('Auto simulation container not found');
    return;
    }
            
    // Scene setup
    autoScene = new THREE.Scene();
    autoScene.background = new THREE.Color(0x1a1a1a);
            
    const width = container.offsetWidth || 800;
    const height = container.offsetHeight || 500;
            
    autoCamera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
    autoCamera.position.set(0, 15, 20);
    autoCamera.lookAt(0, 0, 0);
            
    autoRenderer = new THREE.WebGLRenderer({canvas: canvas, antialias: true});
    autoRenderer.setSize(width, height);
            
    // Lighting
    const light = new THREE.DirectionalLight(0xffffff, 1);
    light.position.set(10, 10, 10);
    autoScene.add(light);
    autoScene.add(new THREE.AmbientLight(0x404040));
            
    // Field (8x8 ft square track)
    const fieldGeometry = new THREE.PlaneGeometry(8, 8);
    const fieldMaterial = new THREE.MeshStandardMaterial({color: 0x2a2a2a});
    const field = new THREE.Mesh(fieldGeometry, fieldMaterial);
    field.rotation.x = -Math.PI / 2;
    autoScene.add(field);
            
    // Line track (black line - square loop)
    const lineWidth = 0.1;
    const trackSize = 3.5;
    // Create square line track
    const lineMaterial = new THREE.MeshStandardMaterial({color: 0x000000});
    const lines = [];
    // Top line
    const topLine = new THREE.Mesh(new THREE.PlaneGeometry(trackSize * 2, lineWidth), lineMaterial);
    topLine.rotation.x = -Math.PI / 2;
    topLine.position.set(0, 0.01, trackSize);
    autoScene.add(topLine);
    // Bottom line
    const bottomLine = new THREE.Mesh(new THREE.PlaneGeometry(trackSize * 2, lineWidth), lineMaterial);
    bottomLine.rotation.x = -Math.PI / 2;
    bottomLine.position.set(0, 0.01, -trackSize);
    autoScene.add(bottomLine);
    // Left line
    const leftLine = new THREE.Mesh(new THREE.PlaneGeometry(lineWidth, trackSize * 2), lineMaterial);
    leftLine.rotation.x = -Math.PI / 2;
    leftLine.position.set(-trackSize, 0.01, 0);
    autoScene.add(leftLine);
    // Right line
    const rightLine = new THREE.Mesh(new THREE.PlaneGeometry(lineWidth, trackSize * 2), lineMaterial);
    rightLine.rotation.x = -Math.PI / 2;
    rightLine.position.set(trackSize, 0.01, 0);
    autoScene.add(rightLine);
            
    // Pickup spur (left branch)
    const pickupSpur = new THREE.Mesh(new THREE.PlaneGeometry(0.5, lineWidth), lineMaterial);
    pickupSpur.rotation.x = -Math.PI / 2;
    pickupSpur.position.set(-trackSize - 0.5, 0.01, 0);
    autoScene.add(pickupSpur);
            
    // Dropoff spur (left branch)
    const dropoffSpur = new THREE.Mesh(new THREE.PlaneGeometry(0.5, lineWidth), lineMaterial);
    dropoffSpur.rotation.x = -Math.PI / 2;
    dropoffSpur.position.set(trackSize + 0.5, 0.01, 0);
    autoScene.add(dropoffSpur);
            
    // Robot
    const robotGeometry = new THREE.BoxGeometry(0.4, 0.2, 0.4);
    const robotMaterial = new THREE.MeshStandardMaterial({color: 0x667eea});
    autoRobot = new THREE.Mesh(robotGeometry, robotMaterial);
    autoRobot.position.set(0, 0.1, 0);
    autoScene.add(autoRobot);
            
    // Charge cube at pickup zone
    const chargeGeometry = new THREE.BoxGeometry(0.2, 0.2, 0.2);
    const chargeMaterial = new THREE.MeshStandardMaterial({color: 0xffd700});
    const charge = new THREE.Mesh(chargeGeometry, chargeMaterial);
    charge.position.set(-trackSize - 0.5, 0.2, 0);
    charge.name = 'charge';
    autoScene.add(charge);
            
    // Handle window resize
    window.addEventListener('resize', () => {
    if (autoRenderer && container) {
    const newWidth = container.offsetWidth;
    const newHeight = container.offsetHeight;
    autoCamera.aspect = newWidth / newHeight;
    autoCamera.updateProjectionMatrix();
    autoRenderer.setSize(newWidth, newHeight);
    }
    });
            
    animateAutoSimulation();
        }
        
        // Initialize Main Challenge 3D Simulation
        function initMainSimulation() {
    if (mainRenderer) return; // Already initialized
            
    const container = document.getElementById('main-simulation-container');
    const canvas = document.getElementById('main-simulation-canvas');
            
    if (!container || !canvas) {
    console.error('Main simulation container not found');
    return;
    }
            
    // Scene setup - Enhanced for better visibility
    mainScene = new THREE.Scene();
    mainScene.background = new THREE.Color(0x0a0a0a); // Darker background for contrast
    mainScene.fog = new THREE.Fog(0x0a0a0a, 20, 50); // Add fog for depth
            
    const width = container.offsetWidth || 800;
    const height = container.offsetHeight || 600;
            
    mainCamera = new THREE.PerspectiveCamera(60, width / height, 0.1, 1000);
    // Better camera angle - higher and further back for better view
    mainCamera.position.set(0, 20, 20);
    mainCamera.lookAt(0, 0, -4); // Look at robot start position
            
    mainRenderer = new THREE.WebGLRenderer({
    canvas: canvas, 
    antialias: true,
    alpha: false,
    powerPreference: "high-performance"
    });
    mainRenderer.setSize(width, height);
    mainRenderer.setPixelRatio(window.devicePixelRatio);
    mainRenderer.shadowMap.enabled = true;
    mainRenderer.shadowMap.type = THREE.PCFSoftShadowMap;
            
    // Enhanced Lighting - Multiple lights for better visibility
    // Main directional light (sun)
    const mainLight = new THREE.DirectionalLight(0xffffff, 1.2);
    mainLight.position.set(10, 20, 10);
    mainLight.castShadow = true;
    mainLight.shadow.mapSize.width = 2048;
    mainLight.shadow.mapSize.height = 2048;
    mainLight.shadow.camera.near = 0.5;
    mainLight.shadow.camera.far = 50;
    mainLight.shadow.camera.left = -10;
    mainLight.shadow.camera.right = 10;
    mainLight.shadow.camera.top = 10;
    mainLight.shadow.camera.bottom = -10;
    mainScene.add(mainLight);
            
    // Fill light from opposite side
    const fillLight = new THREE.DirectionalLight(0xffffff, 0.4);
    fillLight.position.set(-10, 10, -10);
    mainScene.add(fillLight);
            
    // Ambient light for overall illumination
    mainScene.add(new THREE.AmbientLight(0xffffff, 0.6));
            
    // Point light following robot (will be updated in animation)
    const robotLight = new THREE.PointLight(0x667eea, 1, 10);
    robotLight.position.set(0, 2, -4);
    mainScene.add(robotLight);
    window.robotLight = robotLight; // Store for animation updates
            
    // Field (12x12 ft = 144 inches) - Foam tiles (24in x 24in each, 6x6 grid)
    // Create tiled floor effect
    const tileSize = 2; // 2 feet = 24 inches
    for (let i = -6; i < 6; i += 2) {
    for (let j = -6; j < 6; j += 2) {
    const tileGeometry = new THREE.PlaneGeometry(2, 2);
    const tileMaterial = new THREE.MeshStandardMaterial({
    color: (i + j) % 4 === 0 ? 0x2a2a2a : 0x333333
    });
    const tile = new THREE.Mesh(tileGeometry, tileMaterial);
    tile.rotation.x = -Math.PI / 2;
    tile.position.set(i, 0, j);
    mainScene.add(tile);
    }
    }
            
    // Field boundaries (wood frame)
    const boundaryMaterial = new THREE.LineBasicMaterial({color: 0x8B4513, linewidth: 3});
    const boundaryGeometry = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(-6, 0.1, -6),
    new THREE.Vector3(6, 0.1, -6),
    new THREE.Vector3(6, 0.1, 6),
    new THREE.Vector3(-6, 0.1, 6),
    new THREE.Vector3(-6, 0.1, -6)
    ]);
    const boundary = new THREE.Line(boundaryGeometry, boundaryMaterial);
    mainScene.add(boundary);
            
    // Charge Station (center, red top half, blue bottom half)
    const csGeometry = new THREE.BoxGeometry(2, 0.15, 2);
    // Red top half
    const csRedMaterial = new THREE.MeshStandardMaterial({color: 0xf44336});
    const csRed = new THREE.Mesh(new THREE.BoxGeometry(2, 0.15, 1), csRedMaterial);
    csRed.position.set(0, 0.075, 0.5);
    mainScene.add(csRed);
    // Blue bottom half
    const csBlueMaterial = new THREE.MeshStandardMaterial({color: 0x2196F3});
    const csBlue = new THREE.Mesh(new THREE.BoxGeometry(2, 0.15, 1), csBlueMaterial);
    csBlue.position.set(0, 0.075, -0.5);
    mainScene.add(csBlue);
            
    // Source Zones (top-right and bottom-right corners)
    // Top-right Source Zone (blue team)
    const sourceTopRightGeometry = new THREE.PlaneGeometry(2, 2);
    const sourceTopRightMaterial = new THREE.MeshStandardMaterial({
    color: 0x2196F3, transparent: true, opacity: 0.3
    });
    const sourceTopRight = new THREE.Mesh(sourceTopRightGeometry, sourceTopRightMaterial);
    sourceTopRight.rotation.x = -Math.PI / 2;
    sourceTopRight.position.set(5, 0.01, 5);
    mainScene.add(sourceTopRight);
            
    // Bottom-right Source Zone (red team)
    const sourceBottomRightGeometry = new THREE.PlaneGeometry(2, 2);
    const sourceBottomRightMaterial = new THREE.MeshStandardMaterial({
    color: 0xf44336, transparent: true, opacity: 0.3
    });
    const sourceBottomRight = new THREE.Mesh(sourceBottomRightGeometry, sourceBottomRightMaterial);
    sourceBottomRight.rotation.x = -Math.PI / 2;
    sourceBottomRight.position.set(5, 0.01, -5);
    mainScene.add(sourceBottomRight);
            
    // Drop Zones (triangular areas)
    // Top-left Drop Zone (red team - triangular)
    const dropRedPoints = [
    new THREE.Vector3(-6, 0.1, 6),
    new THREE.Vector3(-6, 0.1, 4),
    new THREE.Vector3(-4, 0.1, 6),
    new THREE.Vector3(-6, 0.1, 6)
    ];
    const dropRedGeometry = new THREE.BufferGeometry().setFromPoints(dropRedPoints);
    const dropRedMaterial = new THREE.MeshBasicMaterial({
    color: 0xf44336, transparent: true, opacity: 0.4, side: THREE.DoubleSide
    });
    const dropRedShape = new THREE.Shape();
    dropRedShape.moveTo(-6, 6);
    dropRedShape.lineTo(-6, 4);
    dropRedShape.lineTo(-4, 6);
    dropRedShape.lineTo(-6, 6);
    const dropRedGeom = new THREE.ShapeGeometry(dropRedShape);
    const dropRed = new THREE.Mesh(dropRedGeom, dropRedMaterial);
    dropRed.rotation.x = -Math.PI / 2;
    mainScene.add(dropRed);
            
    // Bottom-right Drop Zone (blue team - triangular)
    const dropBlueShape = new THREE.Shape();
    dropBlueShape.moveTo(6, -6);
    dropBlueShape.lineTo(6, -4);
    dropBlueShape.lineTo(4, -6);
    dropBlueShape.lineTo(6, -6);
    const dropBlueGeom = new THREE.ShapeGeometry(dropBlueShape);
    const dropBlueMaterial = new THREE.MeshBasicMaterial({
    color: 0x2196F3, transparent: true, opacity: 0.4, side: THREE.DoubleSide
    });
    const dropBlue = new THREE.Mesh(dropBlueGeom, dropBlueMaterial);
    dropBlue.rotation.x = -Math.PI / 2;
    mainScene.add(dropBlue);
            
    // Robot Start Zones (top-center red, bottom-center blue)
    const startRedGeometry = new THREE.PlaneGeometry(2, 2);
    const startRedMaterial = new THREE.MeshStandardMaterial({
    color: 0xff4444, transparent: true, opacity: 0.2
    });
    const startRed = new THREE.Mesh(startRedGeometry, startRedMaterial);
    startRed.rotation.x = -Math.PI / 2;
    startRed.position.set(0, 0.01, 5);
    mainScene.add(startRed);
            
    const startBlueGeometry = new THREE.PlaneGeometry(2, 2);
    const startBlueMaterial = new THREE.MeshStandardMaterial({
    color: 0x4444ff, transparent: true, opacity: 0.2
    });
    const startBlue = new THREE.Mesh(startBlueGeometry, startBlueMaterial);
    startBlue.rotation.x = -Math.PI / 2;
    startBlue.position.set(0, 0.01, -5);
    mainScene.add(startBlue);
            
    // Robot (start in bottom start zone) - HIGHLY VISIBLE DESIGN
    // Main robot body - Larger and brighter
    const robotGeometry = new THREE.BoxGeometry(0.8, 0.6, 0.8);
    const robotMaterial = new THREE.MeshStandardMaterial({
    color: 0x00ff00, // Bright green for maximum visibility
    metalness: 0.3,
    roughness: 0.7,
    emissive: 0x00ff00, // Glowing green
    emissiveIntensity: 0.5
    });
    mainRobot = new THREE.Mesh(robotGeometry, robotMaterial);
    mainRobot.castShadow = true;
    mainRobot.receiveShadow = true;
            
    // Bright front indicator (arrow pointing forward)
    const frontArrow = new THREE.Mesh(
    new THREE.ConeGeometry(0.15, 0.4, 8),
    new THREE.MeshStandardMaterial({
    color: 0xffff00, // Bright yellow
    emissive: 0xffff00,
    emissiveIntensity: 0.8
    })
    );
    frontArrow.position.set(0, 0.1, 0.5);
    frontArrow.rotation.x = -Math.PI / 2;
    mainRobot.add(frontArrow);
            
    // Top beacon - Pulsing light
    const topBeacon = new THREE.Mesh(
    new THREE.CylinderGeometry(0.12, 0.12, 0.3, 16),
    new THREE.MeshStandardMaterial({
    color: 0xff0000, // Bright red
    emissive: 0xff0000,
    emissiveIntensity: 1.0
    })
    );
    topBeacon.position.set(0, 0.4, 0);
    topBeacon.rotation.x = Math.PI / 2;
    topBeacon.name = 'topBeacon';
    mainRobot.add(topBeacon);
            
    // Side indicators (left and right)
    const leftIndicator = new THREE.Mesh(
    new THREE.BoxGeometry(0.1, 0.2, 0.1),
    new THREE.MeshStandardMaterial({
    color: 0x0000ff, // Blue
    emissive: 0x0000ff,
    emissiveIntensity: 0.6
    })
    );
    leftIndicator.position.set(-0.45, 0.1, 0);
    mainRobot.add(leftIndicator);
            
    const rightIndicator = new THREE.Mesh(
    new THREE.BoxGeometry(0.1, 0.2, 0.1),
    new THREE.MeshStandardMaterial({
    color: 0xff00ff, // Magenta
    emissive: 0xff00ff,
    emissiveIntensity: 0.6
    })
    );
    rightIndicator.position.set(0.45, 0.1, 0);
    mainRobot.add(rightIndicator);
            
    // Glow effect around robot
    const glowGeometry = new THREE.BoxGeometry(1.0, 0.7, 1.0);
    const glowMaterial = new THREE.MeshBasicMaterial({
    color: 0x00ff00,
    transparent: true,
    opacity: 0.2,
    wireframe: false
    });
    const glow = new THREE.Mesh(glowGeometry, glowMaterial);
    glow.position.set(0, 0, 0);
    glow.name = 'robotGlow';
    mainRobot.add(glow);
            
    // Shadow plane under robot
    const shadowGeometry = new THREE.CircleGeometry(0.6, 16);
    const shadowMaterial = new THREE.MeshBasicMaterial({
    color: 0x000000,
    transparent: true,
    opacity: 0.5
    });
    const shadow = new THREE.Mesh(shadowGeometry, shadowMaterial);
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = 0.01;
    shadow.name = 'robotShadow';
    mainRobot.add(shadow);
            
    mainRobot.position.set(0, 0.3, -4); // Start in bottom robot start zone
    mainRobot.rotation.y = 0; // Facing forward
    mainRobot.name = 'robot';
    mainRobot.visible = true;
    mainRobot.castShadow = true;
    mainScene.add(mainRobot);
            
    // Animate glow and beacon
    setInterval(() => {
    if (mainRobot) {
    const glow = mainRobot.children.find(child => child.name === 'robotGlow');
    const beacon = mainRobot.children.find(child => child.name === 'topBeacon');
    if (glow && glow.material) {
    glow.material.opacity = 0.2 + Math.sin(Date.now() * 0.005) * 0.15;
    }
    if (beacon && beacon.material) {
    beacon.material.emissiveIntensity = 0.8 + Math.sin(Date.now() * 0.01) * 0.4;
    }
    }
    }, 50);
            
    console.log('✅ [MAIN CHALLENGE] Robot initialized - HIGHLY VISIBLE:', {
    position: mainRobot.position,
    visible: mainRobot.visible,
    color: 'Bright Green with Glow',
    inScene: mainScene.children.includes(mainRobot)
    });
            
    // CHARGES in source zones
    // Top-right source zone (blue charges)
    for (let i = 0; i < 5; i++) {
    const chargeGeometry = new THREE.BoxGeometry(0.2, 0.2, 0.2);
    const chargeMaterial = new THREE.MeshStandardMaterial({color: 0x2196F3});
    const charge = new THREE.Mesh(chargeGeometry, chargeMaterial);
    charge.position.set(5 + (i % 3) * 0.3 - 0.3, 0.2, 5 + Math.floor(i / 3) * 0.3 - 0.3);
    charge.name = 'charge_blue_' + i;
    mainScene.add(charge);
    }
            
    // Bottom-right source zone (red charges)
    for (let i = 0; i < 5; i++) {
    const chargeGeometry = new THREE.BoxGeometry(0.2, 0.2, 0.2);
    const chargeMaterial = new THREE.MeshStandardMaterial({color: 0xf44336});
    const charge = new THREE.Mesh(chargeGeometry, chargeMaterial);
    charge.position.set(5 + (i % 3) * 0.3 - 0.3, 0.2, -5 - Math.floor(i / 3) * 0.3 + 0.3);
    charge.name = 'charge_red_' + i;
    mainScene.add(charge);
    }
            
    // Handle window resize
    window.addEventListener('resize', () => {
    if (mainRenderer && container) {
    const newWidth = container.offsetWidth;
    const newHeight = container.offsetHeight;
    mainCamera.aspect = newWidth / newHeight;
    mainCamera.updateProjectionMatrix();
    mainRenderer.setSize(newWidth, newHeight);
    }
    });
            
    // CRITICAL: Attach button click handler when simulation is initialized
    setTimeout(() => {
    attachStartButtonHandler();
    }, 500);
            
    // CRITICAL: Start animation loop immediately
    console.log('✅ [MAIN CHALLENGE] Starting animation loop...');
    animateMainSimulation();
            
    // Setup PS5 controller input
    setupPS5Controller();
            
    // Setup WASD keyboard controls
            
    // CRITICAL: Attach button click handler after initialization
    setTimeout(() => {
    const startBtn = document.getElementById('start-main-challenge-btn');
    if (startBtn) {
    // Remove any existing handlers
    startBtn.onclick = null;
    startBtn.removeEventListener('click', startMainChallengeFromSim);
                    
    // Add fresh event listener
    startBtn.addEventListener('click', function(e) {
    e.preventDefault();
    e.stopPropagation();
    console.log('🔘 [BUTTON] Click event fired!');
    startMainChallengeFromSim();
    }, false);
    console.log('✅ [INIT] Button click handler attached to start-main-challenge-btn');
    } else {
    console.warn('⚠ [INIT] start-main-challenge-btn not found');
    }
    }, 500);
    setupKeyboardControls();
            
    // Verify robot is in scene
    setTimeout(() => {
    if (mainRobot && mainScene) {
    console.log('Main Challenge simulation ready:', {
    robotInScene: mainScene.children.includes(mainRobot),
    robotPosition: mainRobot.position,
    robotVisible: mainRobot.visible,
    sceneChildren: mainScene.children.length
    });
    }
    }, 1000);
        }
        
        // WASD Keyboard Controls
        let keyboardState = {
    w: false, a: false, s: false, d: false,
    q: false, e: false, z: false, x: false
        };
        
        function setupKeyboardControls() {
    document.addEventListener('keydown', (e) => {
    const key = e.key.toLowerCase();
    if (currentChallenge === 'main') {
    if (key === 'w') keyboardState.w = true;
    if (key === 'a') keyboardState.a = true;
    if (key === 's') keyboardState.s = true;
    if (key === 'd') keyboardState.d = true;
    if (key === 'q') keyboardState.q = true;
    if (key === 'e') keyboardState.e = true;
    if (key === 'z') keyboardState.z = true;
    if (key === 'x') keyboardState.x = true;
                    
    sendKeyboardInput();
    e.preventDefault();
    }
    });
            
    document.addEventListener('keyup', (e) => {
    const key = e.key.toLowerCase();
    if (currentChallenge === 'main') {
    if (key === 'w') keyboardState.w = false;
    if (key === 'a') keyboardState.a = false;
    if (key === 's') keyboardState.s = false;
    if (key === 'd') keyboardState.d = false;
    if (key === 'q') keyboardState.q = false;
    if (key === 'e') keyboardState.e = false;
    if (key === 'z') keyboardState.z = false;
    if (key === 'x') keyboardState.x = false;
                    
    sendKeyboardInput();
    e.preventDefault();
    }
    });
        }
        
        function sendKeyboardInput() {
    if (currentChallenge === 'main' && simulationRunning) {
    fetch('/api/keyboard-input', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify(keyboardState)
    })
    .then(r => r.json())
    .then(data => {
    if (!data.success) {
    console.warn('Keyboard input not accepted:', data.error);
    }
    })
    .catch(err => console.error('Error sending keyboard input:', err));
    }
        }
        
        // Send keyboard input periodically (throttled to avoid excessive requests)
        let keyboardThrottle = null;
        setInterval(() => {
    if (currentChallenge === 'main' && simulationRunning && 
    (keyboardState.w || keyboardState.a || keyboardState.s || keyboardState.d ||
    keyboardState.q || keyboardState.e || keyboardState.z || keyboardState.x)) {
    if (!keyboardThrottle || Date.now() - keyboardThrottle > 50) {
    sendKeyboardInput();
    keyboardThrottle = Date.now();
    }
    }
        }, 50);
        
        // PS5 Controller Input
        let ps5State = {
    leftStickY: 0,
    rightStickX: 0,
    triangle: false,
    cross: false,
    square: false,
    circle: false
        };
        
        function setupPS5Controller() {
    const leftStick = document.getElementById('left-stick');
    const rightStick = document.getElementById('right-stick');
    const container = document.getElementById('ps5-controller');
            
    if (!leftStick || !rightStick || !container) {
    console.warn('PS5 controller elements not found');
    return;
    }
            
    // Mouse/touch control for sticks
    let leftDragging = false, rightDragging = false;
            
    function updateStick(stick, x, y, isLeft) {
    const maxDist = 70;
    const dist = Math.min(maxDist, Math.sqrt(x*x + y*y));
    const angle = Math.atan2(y, x);
                
    stick.style.left = (85 + dist * Math.cos(angle)) + 'px';
    stick.style.top = (85 + dist * Math.sin(angle)) + 'px';
                
    const normalizedX = (dist / maxDist) * Math.cos(angle);
    const normalizedY = (dist / maxDist) * Math.sin(angle);
                
    if (isLeft) {
    ps5State.leftStickY = Math.round(normalizedY * -127);
    } else {
    ps5State.rightStickX = Math.round(normalizedX * 127);
    }
                
    // Send input immediately
    sendPS5Input();
    }
            
    // Left stick
    leftStick.addEventListener('mousedown', (e) => {
    leftDragging = true;
    e.preventDefault();
    });
            
    document.addEventListener('mousemove', (e) => {
    if (leftDragging) {
    const rect = container.getBoundingClientRect();
    const leftStickArea = container.querySelector('#left-stick').parentElement.getBoundingClientRect();
    const x = e.clientX - leftStickArea.left - 100;
    const y = e.clientY - leftStickArea.top - 100;
    updateStick(leftStick, x, y, true);
    sendPS5Input();
    }
    });
            
    document.addEventListener('mouseup', () => {
    if (leftDragging) {
    leftDragging = false;
    leftStick.style.left = '85px';
    leftStick.style.top = '85px';
    ps5State.leftStickY = 0;
    sendPS5Input();
    }
    });
            
    // Right stick (similar)
    rightStick.addEventListener('mousedown', (e) => {
    rightDragging = true;
    e.preventDefault();
    });
            
    document.addEventListener('mousemove', (e) => {
    if (rightDragging) {
    const rightStickArea = container.querySelector('#right-stick').parentElement.getBoundingClientRect();
    const x = e.clientX - rightStickArea.left - 100;
    const y = e.clientY - rightStickArea.top - 100;
    updateStick(rightStick, x, y, false);
    sendPS5Input();
    }
    });
            
    document.addEventListener('mouseup', () => {
    if (rightDragging) {
    rightDragging = false;
    rightStick.style.left = '85px';
    rightStick.style.top = '85px';
    ps5State.rightStickX = 0;
    sendPS5Input();
    }
    });
            
    // Buttons
    document.getElementById('btn-triangle').addEventListener('mousedown', () => {
    ps5State.triangle = true;
    sendPS5Input();
    });
    document.getElementById('btn-triangle').addEventListener('mouseup', () => {
    ps5State.triangle = false;
    sendPS5Input();
    });
            
    document.getElementById('btn-cross').addEventListener('mousedown', () => {
    ps5State.cross = true;
    sendPS5Input();
    });
    document.getElementById('btn-cross').addEventListener('mouseup', () => {
    ps5State.cross = false;
    sendPS5Input();
    });
            
    document.getElementById('btn-square').addEventListener('mousedown', () => {
    ps5State.square = true;
    sendPS5Input();
    });
    document.getElementById('btn-square').addEventListener('mouseup', () => {
    ps5State.square = false;
    sendPS5Input();
    });
            
    document.getElementById('btn-circle').addEventListener('mousedown', () => {
    ps5State.circle = true;
    sendPS5Input();
    });
    document.getElementById('btn-circle').addEventListener('mouseup', () => {
    ps5State.circle = false;
    sendPS5Input();
    });
        }
        
        function sendPS5Input() {
    if (currentChallenge === 'main' && simulationRunning) {
    // Send with both camelCase and snake_case for compatibility
    const payload = {
    leftStickY: ps5State.leftStickY,
    left_stick_y: ps5State.leftStickY,
    rightStickX: ps5State.rightStickX,
    right_stick_x: ps5State.rightStickX,
    triangle: ps5State.triangle,
    cross: ps5State.cross,
    square: ps5State.square,
    circle: ps5State.circle
    };
    fetch('/api/ps5-input', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify(payload)
    })
    .then(r => r.json())
    .then(data => {
    if (!data.success) {
    console.warn('PS5 input not accepted:', data.error);
    }
    })
    .catch(err => console.error('Error sending PS5 input:', err));
    }
        }
        
        // Send PS5 input periodically (throttled to avoid excessive requests)
        let ps5Throttle = null;
        setInterval(() => {
    if (currentChallenge === 'main' && simulationRunning) {
    // Send if any input is active (sticks or buttons)
    if (Math.abs(ps5State.leftStickY) > 10 || Math.abs(ps5State.rightStickX) > 10 || 
    ps5State.triangle || ps5State.cross || ps5State.square || ps5State.circle) {
    if (!ps5Throttle || Date.now() - ps5Throttle > 50) {
    sendPS5Input();
    ps5Throttle = Date.now();
    }
    }
    }
        }, 50); // Send every 50ms for responsive control
        
        // Animation loops
        function animateAutoSimulation() {
    if (autoRenderer && autoScene && autoCamera) {
    requestAnimationFrame(animateAutoSimulation);
                
    // Rotate camera slightly for better view
    if (autoCamera) {
    const time = Date.now() * 0.0001;
    autoCamera.position.x = Math.sin(time) * 20;
    autoCamera.position.z = Math.cos(time) * 20;
    autoCamera.lookAt(0, 0, 0);
    }
                
    autoRenderer.render(autoScene, autoCamera);
    }
        }
        
        function animateMainSimulation() {
    if (mainRenderer && mainScene && mainCamera) {
    requestAnimationFrame(animateMainSimulation);
                
    // Camera follows robot with better angles
    if (mainRobot) {
    // Ensure robot is visible
    if (!mainRobot.visible) {
    mainRobot.visible = true;
    }
                    
    // Enhanced camera following - Better viewing angle
    const robotX = mainRobot.position.x;
    const robotZ = mainRobot.position.z;
                    
    // Camera position: Behind and above robot, always looking at it
    const cameraDistance = 15;
    const cameraHeight = 18;
    const angle = Math.atan2(robotZ, robotX) + Math.PI; // Behind robot
                    
    const targetX = robotX + Math.cos(angle) * cameraDistance * 0.3;
    const targetZ = robotZ + Math.sin(angle) * cameraDistance * 0.3;
    const targetY = cameraHeight;
                    
    // Smooth camera movement
    mainCamera.position.x += (targetX - mainCamera.position.x) * 0.2;
    mainCamera.position.y += (targetY - mainCamera.position.y) * 0.2;
    mainCamera.position.z += (targetZ - mainCamera.position.z) * 0.2;
                    
    // Camera always looks at robot
    mainCamera.lookAt(robotX, 0.3, robotZ);
                    
    // Update point light to follow robot
    if (window.robotLight) {
    window.robotLight.position.set(robotX, 2, robotZ);
    }
                    
    // Rotate charge indicator if present
    const chargeIndicator = mainRobot.children.find(child => child.name === 'chargeIndicator');
    if (chargeIndicator) {
    chargeIndicator.rotation.y += 0.05;
    }
    } else {
    // Default camera position if no robot
    mainCamera.position.set(0, 20, 20);
    mainCamera.lookAt(0, 0, 0);
    }
                
    // Always render
    mainRenderer.render(mainScene, mainCamera);
    } else {
    // If renderer not ready, try again next frame
    if (mainRenderer || mainScene || mainCamera) {
    requestAnimationFrame(animateMainSimulation);
    } else {
    console.warn('⚠ Animation loop: Missing renderer, scene, or camera');
    }
    }
        }
        
        // Test function to manually move robot (for debugging)
        window.testRobotMove = function() {
    if (mainRobot && mainScene) {
    console.log('🧪 TEST: Moving robot manually...');
    const testX = Math.random() * 4 - 2; // Random between -2 and 2
    const testZ = Math.random() * 4 - 2;
    mainRobot.position.set(testX, 0.2, testZ);
    mainRobot.updateMatrixWorld(true);
    console.log('🧪 TEST: Robot moved to', {x: testX, z: testZ});
    return true;
    } else {
    console.error('🧪 TEST: Robot not initialized');
    return false;
    }
        };

        // Advanced Tools - Real-time Updates
        function updateAllTools() {
    updatePSI();
    updateAIAssist();
    updatePredictor();
    updateStrategy();
    updateOptimization();
    updateDebugger();
    updateOptimalPath();
    updateMatchStory();
    updateFailureModes();
    updateHardwareHealth();
        }

        let lastHealthWarnings = [];
        let notificationQueue = [];

        function showHealthNotification(warning, type) {
    // Check if notification already shown
    if (notificationQueue.includes(warning)) return;
    notificationQueue.push(warning);
            
    const popup = document.createElement('div');
    popup.className = `popup-notification ${type}`;
            
    const title = type === 'critical' ? '🔴 CRITICAL ALERT' : 
    type === 'warning' ? '⚠️ WARNING' : 'ℹ️ INFO';
            
    popup.innerHTML = `
    <button class="popup-close" onclick="this.parentElement.remove()">×</button>
    <h4>${title}</h4>
    <p>${warning}</p>
    `;
            
    document.body.appendChild(popup);
            
    // Auto-remove after 8 seconds
    setTimeout(() => {
    if (popup.parentElement) {
    popup.style.animation = 'slideIn 0.3s ease-out reverse';
    setTimeout(() => popup.remove(), 300);
    notificationQueue = notificationQueue.filter(w => w !== warning);
    }
    }, 8000);
            
    // Click to dismiss
    popup.addEventListener('click', () => {
    popup.style.animation = 'slideIn 0.3s ease-out reverse';
    setTimeout(() => popup.remove(), 300);
    notificationQueue = notificationQueue.filter(w => w !== warning);
    });
        }

        function updateHardwareHealth() {
    fetch('/api/hardware-health')
    .then(r => {
    if (!r.ok) {
    throw new Error(`HTTP error! status: ${r.status}`);
    }
    return r.json();
    })
    .then(data => {
    if (!data) {
    console.error('No data received from health API');
    return;
    }
                    
    // Update data source indicator
    const sourceEl = document.getElementById('health-data-source');
    if (sourceEl) {
    // Check if simulation is running
    const simStatus = document.getElementById('simStatus');
    const isSimRunning = simStatus && (simStatus.textContent.includes('Running') || simStatus.textContent.includes('Active'));
    if (isSimRunning) {
    sourceEl.textContent = '📡 Monitoring from active simulation';
    sourceEl.style.color = '#4caf50';
    } else {
    sourceEl.textContent = '⏸️ No active simulation - Start a challenge to monitor health';
    sourceEl.style.color = '#888';
    }
    }
                    
    // Update overall status
    const statusIndicator = document.getElementById('health-status-indicator');
    const statusText = document.getElementById('health-status-text');
    const healthScore = document.getElementById('health-score');
                    
    let statusColor, statusLabel;
    if (data.overall_status === 'critical') {
    statusColor = '#f44336';
    statusLabel = 'CRITICAL';
    } else if (data.overall_status === 'warning') {
    statusColor = '#ff9800';
    statusLabel = 'WARNING';
    } else {
    statusColor = '#4caf50';
    statusLabel = 'Healthy';
    }
                    
    statusIndicator.style.background = statusColor;
    statusIndicator.style.boxShadow = `0 0 20px ${statusColor}80`;
    statusText.textContent = statusLabel;
    statusText.style.color = statusColor;
    healthScore.textContent = data.health_score || 100;
                    
    // Show pop-up notifications for new warnings
    if (data.system && data.system.warnings) {
    const currentWarnings = data.system.warnings;
    const newWarnings = currentWarnings.filter(w => !lastHealthWarnings.includes(w));
                        
    newWarnings.forEach(warning => {
    let type = 'info';
    if (warning.includes('CRITICAL') || warning.includes('🔴')) {
    type = 'critical';
    } else if (warning.includes('⚠️') || warning.includes('🟡')) {
    type = 'warning';
    }
    showHealthNotification(warning, type);
    });
                        
    lastHealthWarnings = [...currentWarnings];
    }
                    
    // Update warnings list
    const warningsDiv = document.getElementById('health-warnings-list');
    if (data.system && data.system.warnings && data.system.warnings.length > 0) {
    warningsDiv.innerHTML = data.system.warnings.map(warning => {
    let className = 'info';
    if (warning.includes('CRITICAL') || warning.includes('🔴')) {
    className = 'critical';
    } else if (warning.includes('⚠️') || warning.includes('🟡')) {
    className = 'warning';
    }
    return `<div class="health-warning ${className}">${warning}</div>`;
    }).join('');
    } else {
    warningsDiv.innerHTML = '<p style="color: #888; font-style: italic; text-align: center; padding: 20px;">No warnings at this time. All systems operating normally.</p>';
    }
                    
    // Update detailed motor health
    if (!data.components || !data.components.motors) {
    console.error('Missing components data:', data);
    return;
    }
                    
    const motors = data.components.motors;
                    
    // Left Motor
    if (!motors.left_motor) {
    console.error('Missing left_motor data');
    return;
    }
    const leftMotor = motors.left_motor;
    document.getElementById('left-motor-status').textContent = leftMotor.status.charAt(0).toUpperCase() + leftMotor.status.slice(1);
    document.getElementById('left-motor-status').style.color = leftMotor.status === 'critical' ? '#f44336' : leftMotor.status === 'warning' ? '#ff9800' : '#4caf50';
    document.getElementById('left-motor-runtime').textContent = leftMotor.runtime_hours.toFixed(2);
    document.getElementById('left-motor-cycles').textContent = leftMotor.total_power_cycles;
    document.getElementById('left-motor-overload').textContent = leftMotor.overload_count;
    document.getElementById('left-motor-detail').className = 'health-component ' + (leftMotor.status === 'critical' ? 'critical' : leftMotor.status === 'warning' ? 'warning' : '');
                    
    // Right Motor
    const rightMotor = motors.right_motor;
    document.getElementById('right-motor-status').textContent = rightMotor.status.charAt(0).toUpperCase() + rightMotor.status.slice(1);
    document.getElementById('right-motor-status').style.color = rightMotor.status === 'critical' ? '#f44336' : rightMotor.status === 'warning' ? '#ff9800' : '#4caf50';
    document.getElementById('right-motor-runtime').textContent = rightMotor.runtime_hours.toFixed(2);
    document.getElementById('right-motor-cycles').textContent = rightMotor.total_power_cycles;
    document.getElementById('right-motor-overload').textContent = rightMotor.overload_count;
    document.getElementById('right-motor-detail').className = 'health-component ' + (rightMotor.status === 'critical' ? 'critical' : rightMotor.status === 'warning' ? 'warning' : '');
                    
    // Battery
    const battery = data.components.battery;
    document.getElementById('battery-status-detail').textContent = battery.status.charAt(0).toUpperCase() + battery.status.slice(1);
    document.getElementById('battery-status-detail').style.color = battery.status === 'critical' ? '#f44336' : battery.status === 'warning' ? '#ff9800' : '#4caf50';
    // Handle voltage_history (could be array or deque)
    let voltageHistory = [];
    if (Array.isArray(battery.voltage_history)) {
    voltageHistory = battery.voltage_history;
    } else if (battery.voltage_history && typeof battery.voltage_history === 'object') {
    voltageHistory = Array.from(battery.voltage_history);
    }
    const currentVoltage = voltageHistory.length > 0 ? voltageHistory[voltageHistory.length - 1] : '-';
    document.getElementById('battery-voltage').textContent = currentVoltage;
    document.getElementById('battery-discharges').textContent = battery.deep_discharge_count;
    document.getElementById('battery-overheat').textContent = battery.overheat_count;
    document.getElementById('battery-detail').className = 'health-component ' + (battery.status === 'critical' ? 'critical' : battery.status === 'warning' ? 'warning' : '');
                    
    // Servos
    const servos = data.components.servos;
                    
    // Gripper
    const gripper = servos.gripper;
    document.getElementById('gripper-status').textContent = gripper.status.charAt(0).toUpperCase() + gripper.status.slice(1);
    document.getElementById('gripper-status').style.color = gripper.stall_count > 50 ? '#f44336' : gripper.cycles > 10000 ? '#ff9800' : '#4caf50';
    document.getElementById('gripper-cycles').textContent = gripper.cycles;
    document.getElementById('gripper-stalls').textContent = gripper.stall_count;
    document.getElementById('gripper-detail').className = 'health-component ' + (gripper.stall_count > 50 ? 'critical' : gripper.cycles > 10000 ? 'warning' : '');
                    
    // Arm
    const arm = servos.arm;
    document.getElementById('arm-status').textContent = arm.status.charAt(0).toUpperCase() + arm.status.slice(1);
    document.getElementById('arm-status').style.color = arm.stall_count > 50 ? '#f44336' : arm.cycles > 10000 ? '#ff9800' : '#4caf50';
    document.getElementById('arm-cycles').textContent = arm.cycles;
    document.getElementById('arm-stalls').textContent = arm.stall_count;
    document.getElementById('arm-detail').className = 'health-component ' + (arm.stall_count > 50 ? 'critical' : arm.cycles > 10000 ? 'warning' : '');
                    
    // Sensors
    const sensors = data.components.sensors;
                    
    // Line Sensors
    const lineSensors = sensors.line_sensors;
    document.getElementById('line-sensors-status').textContent = lineSensors.status.charAt(0).toUpperCase() + lineSensors.status.slice(1);
    document.getElementById('line-sensors-status').style.color = lineSensors.status === 'warning' ? '#ff9800' : '#4caf50';
    document.getElementById('line-sensors-drift').textContent = lineSensors.calibration_drift;
    document.getElementById('line-sensors-detail').className = 'health-component ' + (lineSensors.status === 'warning' ? 'warning' : '');
                    
    // IMU
    const imu = sensors.imu;
    document.getElementById('imu-status').textContent = imu.status.charAt(0).toUpperCase() + imu.status.slice(1);
    document.getElementById('imu-status').style.color = imu.status === 'warning' ? '#ff9800' : '#4caf50';
    document.getElementById('imu-drift').textContent = imu.drift_detected ? 'Yes' : 'No';
    document.getElementById('imu-detail').className = 'health-component ' + (imu.status === 'warning' ? 'warning' : '');
                    
    // TOF
    const tof = sensors.tof;
    document.getElementById('tof-status').textContent = tof.status.charAt(0).toUpperCase() + tof.status.slice(1);
    document.getElementById('tof-status').style.color = tof.status === 'warning' ? '#ff9800' : '#4caf50';
    document.getElementById('tof-errors').textContent = tof.error_count;
    document.getElementById('tof-detail').className = 'health-component ' + (tof.status === 'warning' ? 'warning' : '');
                    
    // System information
    if (data.system) {
    const runtimeEl = document.getElementById('system-runtime-detail');
    if (runtimeEl && data.system.total_runtime_hours !== undefined) {
    runtimeEl.textContent = data.system.total_runtime_hours.toFixed(1);
    }
    }
    const criticalEl = document.getElementById('critical-count');
    if (criticalEl) criticalEl.textContent = data.critical_issues || 0;
    const warningEl = document.getElementById('warning-count');
    if (warningEl) warningEl.textContent = data.warnings || 0;
    const lastUpdateEl = document.getElementById('last-update');
    if (lastUpdateEl) lastUpdateEl.textContent = new Date().toLocaleTimeString();
    })
    .catch(err => {
    console.error('Error updating hardware health:', err);
    // Show error in UI
    const statusText = document.getElementById('health-status-text');
    const statusIndicator = document.getElementById('health-status-indicator');
    if (statusText) {
    statusText.textContent = 'Error Loading';
    statusText.style.color = '#f44336';
    }
    if (statusIndicator) {
    statusIndicator.style.background = '#f44336';
    }
    // Show error message
    const warningsDiv = document.getElementById('health-warnings-list');
    if (warningsDiv) {
    warningsDiv.innerHTML = `<div class="health-warning critical">❌ Error loading health data: ${err.message}. Please refresh the page.</div>`;
    }
    });
        }

        function injectFakeHealthData(evt) {
    // Confirm this is for testing only
    if (!confirm('⚠️ This will inject TEST DATA for demonstration purposes.\n\nDuring normal operation, health monitoring uses real simulation telemetry.\n\nContinue with test data injection?')) {
    return;
    }
            
    const button = evt ? evt.target : (event ? event.target : null);
    if (!button) {
    console.error('Could not find button element');
    return;
    }
            
    const originalText = button.textContent;
    button.disabled = true;
    button.textContent = 'Injecting...';
            
    console.log('Injecting TEST health data (for demonstration only)...');
            
    fetch('/api/inject-fake-health', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'}
    })
    .then(r => {
    console.log('Response status:', r.status);
    if (!r.ok) {
    return r.json().then(err => {
    throw new Error(err.error || `HTTP error! status: ${r.status}`);
    });
    }
    return r.json();
    })
    .then(data => {
    console.log('Response data:', data);
    if (data.success) {
    // Clear notification queue to show new warnings
    notificationQueue = [];
    lastHealthWarnings = [];
                        
    // Update health display immediately (multiple times to ensure it updates)
    updateHardwareHealth();
    setTimeout(() => updateHardwareHealth(), 200);
    setTimeout(() => updateHardwareHealth(), 500);
                        
    // Show success message
    const statusCard = document.querySelector('#health-tab .card');
    if (statusCard) {
    // Remove any existing success messages
    const existingMsg = statusCard.querySelector('.injection-success');
    if (existingMsg) existingMsg.remove();
                            
    const successMsg = document.createElement('div');
    successMsg.className = 'injection-success';
    successMsg.style.cssText = 'margin-top: 10px; padding: 10px; background: rgba(255, 152, 0, 0.2); border-radius: 5px; border-left: 4px solid #ff9800; color: #ff9800; font-size: 12px;';
    successMsg.textContent = '⚠️ TEST DATA injected (for demonstration). Normal operation uses simulation telemetry.';
                            
    // Update source indicator
    const sourceEl = document.getElementById('health-data-source');
    if (sourceEl) {
    sourceEl.textContent = '🧪 Showing TEST DATA (not from simulation)';
    sourceEl.style.color = '#ff9800';
    }
    statusCard.appendChild(successMsg);
    setTimeout(() => successMsg.remove(), 8000);
    }
                        
    console.log('✓ Fake health data injected successfully');
    } else {
    const errorMsg = data.error || data.message || 'Unknown error';
    console.error('Failed to inject:', errorMsg);
    alert('Failed to inject fake data: ' + errorMsg);
    }
    button.disabled = false;
    button.textContent = originalText;
    })
    .catch(err => {
    console.error('Error injecting fake health data:', err);
    alert('Error injecting fake health data: ' + err.message + '\n\nCheck browser console (F12) for details.');
    button.disabled = false;
    button.textContent = originalText;
    });
        }

        function updatePSI() {
    fetch('/api/performance-psi')
    .then(r => r.json())
    .then(data => {
    document.getElementById('psi-score').textContent = data.score || 0;
    document.getElementById('psi-smoothness').textContent = (data.breakdown?.smoothness || 0).toFixed(1);
    document.getElementById('psi-precision').textContent = (data.breakdown?.precision || 0).toFixed(1);
    document.getElementById('psi-speed').textContent = (data.breakdown?.speed || 0).toFixed(1);
    document.getElementById('psi-stability').textContent = (data.breakdown?.stability || 0).toFixed(1);
    })
    .catch(err => console.error('Error updating PSI:', err));
        }

        function updateAIAssist() {
    fetch('/api/ai-driver-assist')
    .then(r => r.json())
    .then(data => {
    const container = document.getElementById('ai-suggestions');
    if (data.suggestions && data.suggestions.length > 0) {
    container.innerHTML = data.suggestions.map(s => {
    const typeClass = s.type === 'warning' ? 'warning' : s.type === 'info' ? 'info' : 'success';
    return `<div class="suggestion-item ${typeClass}">${s.message}</div>`;
    }).join('');
    } else {
    container.innerHTML = '<div class="suggestion-item success">✓ All systems normal. No warnings.</div>';
    }
    })
    .catch(err => console.error('Error updating AI Assist:', err));
        }

        function updatePredictor() {
    fetch('/api/predict-completion')
    .then(r => r.json())
    .then(data => {
    const willFinish = data.will_finish ? '✓ Yes' : '✗ No';
    const finishColor = data.will_finish ? '#4caf50' : '#f44336';
    document.getElementById('predict-finish').textContent = willFinish;
    document.getElementById('predict-finish').style.color = finishColor;
    document.getElementById('predict-confidence').textContent = ((data.confidence || 0) * 100).toFixed(0) + '%';
    document.getElementById('predict-score').textContent = data.expected_score || 0;
    document.getElementById('predict-risk').textContent = data.risk || 'Unknown';
    })
    .catch(err => console.error('Error updating Predictor:', err));
        }

        function updateStrategy() {
    // Check if simulation is actually running
    const isRunning = (simulationRunning || window.simulationRunning) && currentChallenge === 'main';
    const strategyEl = document.getElementById('main-strategy');
    const strategyContent = document.getElementById('strategy-content');
            
    // If not running, show message
    if (!isRunning) {
    if (strategyContent) {
    strategyContent.innerHTML = '<p style="color: #888;">Start Main Challenge simulation to see strategy</p>';
    }
    return;
    }
            
    // Get latest telemetry if available
    let requestData = {charges_scored: 0, time_remaining: 150, golden_available: true};
            
    // Try to get data from latest telemetry if simulation is running
    if (window.latestTelemetry && window.latestTelemetry.mode === 'main_challenge') {
    const challenge_state = window.latestTelemetry.challenge_state || {};
    requestData = {
    charges_scored: challenge_state.charges_scored || 0,
    time_remaining: challenge_state.time_remaining || 150,
    golden_available: (challenge_state.golden_charges || 0) > 0
    };
    }
            
    fetch('/api/strategy-engine', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify(requestData)
    })
    .then(r => r.json())
    .then(data => {
    const s = data.strategy || {};
    const nameEl = document.getElementById('strategy-name');
    const priorityEl = document.getElementById('strategy-priority');
    const routeEl = document.getElementById('strategy-route');
    const expectedEl = document.getElementById('strategy-expected');
    const riskEl = document.getElementById('strategy-risk');
                    
    if (nameEl) nameEl.textContent = s.name || 'Loading...';
    if (priorityEl) priorityEl.textContent = s.priority || 'N/A';
    if (routeEl) routeEl.textContent = s.route || 'N/A';
    if (expectedEl) expectedEl.textContent = s.expected_score || 0;
    if (riskEl) riskEl.textContent = s.risk || 'N/A';
                    
    // CRITICAL: Also update the strategy-content div in Simulation tab
    if (strategyContent) {
    strategyContent.innerHTML = `
    <p style="color: #667eea; font-weight: bold; margin-bottom: 8px;">📋 Current Strategy</p>
    <p><strong>Strategy:</strong> ${s.name || 'Continue'}</p>
    <p><strong>Priority:</strong> ${s.priority || 'N/A'}</p>
    <p><strong>Route:</strong> ${s.route || 'N/A'}</p>
    <p><strong>Expected Score:</strong> ${s.expected_score || 0}</p>
    <p><strong>Risk:</strong> ${s.risk || 'N/A'}</p>
    `;
    }
    })
    .catch(err => {
    console.error('Error updating Strategy:', err);
    if (strategyContent) {
    strategyContent.innerHTML = '<p style="color: #888;">Error loading strategy</p>';
    }
    });
        }

        function updateOptimization() {
    fetch('/api/optimization-lab')
    .then(r => r.json())
    .then(data => {
    document.getElementById('pid-kp').textContent = (data.pid_params?.kp || 2.0).toFixed(2);
    document.getElementById('pid-ki').textContent = (data.pid_params?.ki || 0.1).toFixed(3);
    document.getElementById('pid-kd').textContent = (data.pid_params?.kd || 0.5).toFixed(2);
    document.getElementById('pid-confidence').textContent = ((data.pid_params?.confidence || 0) * 100).toFixed(0) + '%';
    document.getElementById('drift-status').textContent = data.drift_detector_ready ? '✓ Trained' : 'Not trained';
    document.getElementById('drift-status').style.color = data.drift_detector_ready ? '#4caf50' : '#ff9800';
    })
    .catch(err => console.error('Error updating Optimization:', err));
        }

        function updateDebugger() {
    fetch('/api/auto-debugger')
    .then(r => r.json())
    .then(data => {
    const container = document.getElementById('debugger-issues');
    if (data.issues && data.issues.length > 0) {
    container.innerHTML = data.issues.map(issue => {
    const severityClass = issue.severity === 'high' ? 'high' : issue.severity === 'medium' ? 'medium' : 'low';
    return `<div class="issue-item ${severityClass}">
    <div><strong>${issue.severity.toUpperCase()}:</strong> ${issue.issue}</div>
    <div style="margin-top: 5px; font-size: 12px; color: #aaa;"><em>Fix: ${issue.fix}</em></div>
    </div>`;
    }).join('');
    } else {
    container.innerHTML = '<div class="issue-item low">✓ No issues detected. Code looks good!</div>';
    }
    })
    .catch(err => console.error('Error updating Debugger:', err));
        }

        function updateOptimalPath() {
    fetch('/api/optimal-path')
    .then(r => r.json())
    .then(data => {
    const container = document.getElementById('optimal-path-content');
    let html = '<div style="margin-bottom: 10px;"><strong>Optimal Path:</strong></div><ol style="margin-left: 20px; line-height: 1.8;">';
    data.path.forEach((p, i) => {
    html += `<li>${p} @ ${data.speeds[i] || 150} speed</li>`;
    });
    html += '</ol>';
    if (data.recommendations && data.recommendations.length > 0) {
    html += '<div style="margin-top: 15px;"><strong>Recommendations:</strong></div><ul style="margin-left: 20px; line-height: 1.8;">';
    data.recommendations.forEach(r => {
    html += `<li style="color: #aaa;">${r}</li>`;
    });
    html += '</ul>';
    }
    container.innerHTML = html;
    })
    .catch(err => console.error('Error updating Optimal Path:', err));
        }

        function updateMatchStory() {
    fetch('/api/match-story')
    .then(r => r.json())
    .then(data => {
    const container = document.getElementById('match-story-content');
    container.innerHTML = `<div style="white-space: pre-wrap; line-height: 1.6; font-size: 13px;">${data.story || 'No match data yet. Start a simulation to generate story.'}</div>`;
    })
    .catch(err => console.error('Error updating Match Story:', err));
        }

        function updateFailureModes() {
    fetch('/api/failure-modes')
    .then(r => r.json())
    .then(data => {
    const container = document.getElementById('failure-modes-list');
                    
    // Mode severity mapping
    const modeMap = {
    'motor_stall': { severity: 'high' },
    'imu_drift': { severity: 'medium' },
    'extra_friction': { severity: 'medium' },
    'battery_sag': { severity: 'high' },
    'sensor_noise': { severity: 'low' },
    'weight_imbalance': { severity: 'medium' }
    };
                    
    let activeCount = 0;
                    
    // Update each failure mode item
    for (const [mode, active] of Object.entries(data)) {
    if (active) activeCount++;
                        
    // Find the item by data-mode attribute
    const item = container.querySelector(`[data-mode="${mode}"]`);
    if (item) {
    const info = modeMap[mode] || { severity: 'medium' };
    const severityColor = info.severity === 'high' ? '#f44336' : info.severity === 'medium' ? '#ff9800' : '#4caf50';
                            
    // Update item styling
    item.style.borderLeftColor = active ? severityColor : '#555';
    item.style.background = active ? 'rgba(102, 126, 234, 0.1)' : '#3a3a3a';
                            
    // Update checkbox
    const checkbox = item.querySelector(`input[data-mode="${mode}"]`);
    if (checkbox) {
    checkbox.checked = active;
    }
                            
    // Update name text
    const nameSpan = item.querySelector('.mode-name');
    if (nameSpan) {
    nameSpan.style.color = active ? '#fff' : '#aaa';
    const baseName = nameSpan.textContent.replace(' (ACTIVE)', '').trim();
    nameSpan.innerHTML = active 
    ? `${baseName} <span style="color: #4caf50; font-size: 12px;"> (ACTIVE)</span>`
    : baseName;
    }
    }
    }
                    
    // Update or create status panel at bottom
    let statusPanel = container.querySelector('div[style*="margin-top: 15px"]:last-child');
    if (!statusPanel || !statusPanel.querySelector('strong')) {
    statusPanel = document.createElement('div');
    statusPanel.style.marginTop = '15px';
    container.appendChild(statusPanel);
    }
                    
    if (activeCount > 0) {
    statusPanel.style.padding = '10px';
    statusPanel.style.background = activeCount > 3 ? 'rgba(244, 67, 54, 0.2)' : 'rgba(255, 152, 0, 0.2)';
    statusPanel.style.borderRadius = '5px';
    statusPanel.style.borderLeft = `4px solid ${activeCount > 3 ? '#f44336' : '#ff9800'}`;
    statusPanel.innerHTML = `
    <strong style="color: ${activeCount > 3 ? '#f44336' : '#ff9800'};">
    ⚠️ ${activeCount} Failure Mode(s) Active
    </strong>
    <div style="font-size: 11px; color: #aaa; margin-top: 5px;">
    Robot is operating under simulated failure conditions. Monitor performance metrics for impact.
    </div>
    `;
    } else {
    statusPanel.style.padding = '10px';
    statusPanel.style.background = 'rgba(76, 175, 80, 0.1)';
    statusPanel.style.borderRadius = '5px';
    statusPanel.style.borderLeft = '4px solid #4caf50';
    statusPanel.innerHTML = `
    <strong style="color: #4caf50;">✓ All Systems Normal</strong>
    <div style="font-size: 11px; color: #aaa; margin-top: 5px;">
    No failure modes active. Robot operating under normal conditions.
    </div>
    `;
    }
    })
    .catch(err => console.error('Error updating Failure Modes:', err));
        }

        function toggleFailureMode(mode, enabled) {
    fetch('/api/failure-modes', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({[mode]: enabled})
    })
    .then(() => {
    // Optionally refresh the list
    updateFailureModes();
    })
    .catch(err => console.error('Error toggling failure mode:', err));
        }

        // Update analysis every 5 seconds
        setInterval(updateAnalysis, 5000);
        setInterval(updateDriverAnalysis, 5000);
        updateAnalysis();
        
        // Throttle function to prevent excessive updates
        function throttle(func, delay) {
    let timeoutId;
    let lastExecTime = 0;
    return function (...args) {
    const currentTime = Date.now();
    if (currentTime - lastExecTime > delay) {
    func.apply(this, args);
    lastExecTime = currentTime;
    } else {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => {
    func.apply(this, args);
    lastExecTime = Date.now();
    }, delay - (currentTime - lastExecTime));
    }
    };
        }
        
        // Throttled update functions
        const throttledUpdateAllTools = throttle(() => {
    const toolsTab = document.getElementById('tools-tab');
    if (toolsTab && toolsTab.classList.contains('active')) {
    updateAllTools();
    }
        }, 5000); // Update every 5 seconds instead of 3
        
        const throttledUpdateHealth = throttle(() => {
    const healthTab = document.getElementById('health-tab');
    if (healthTab && healthTab.classList.contains('active')) {
    updateHardwareHealth();
    }
        }, 3000); // Update every 3 seconds instead of 2
        
        // Update tools only when tab is active
        setInterval(throttledUpdateAllTools, 5000);
        
        // Update health only when tab is active
        setInterval(throttledUpdateHealth, 3000);
        
        // Initial updates (delayed to avoid blocking page load)
        setTimeout(() => {
    const toolsTab = document.getElementById('tools-tab');
    if (toolsTab && toolsTab.classList.contains('active')) {
    updateAllTools();
    }
    const healthTab = document.getElementById('health-tab');
    if (healthTab && healthTab.classList.contains('active')) {
    updateHardwareHealth();
    }
        }, 1000);
        
        // Also update when health tab becomes visible
        const healthTab = document.getElementById('health-tab');
        if (healthTab) {
    const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
    if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
    if (healthTab.classList.contains('active')) {
    throttledUpdateHealth();
    }
    }
    });
    });
    observer.observe(healthTab, { attributes: true });
        }

        // ===== MIND MAP VISUALIZATION =====
        let mindMapNetwork = null;
        let mindMapData = null;
        let mindMapOptions = null;

        function initMindMap() {
    if (mindMapNetwork) return; // Already initialized
            
    const container = document.getElementById('mindmap-container');
    if (!container) return;

    // Define nodes (system components)
    const nodes = new vis.DataSet([
    // Central node
    {id: 'central', label: 'NRL Robot System', level: 0, color: {background: '#667eea', border: '#5568d3'}, font: {size: 24, color: '#fff', face: 'Arial', bold: true}, shape: 'box', size: 40},
                
    // Hardware Layer
    {id: 'hardware', label: 'Hardware Layer', level: 1, color: {background: '#4caf50', border: '#45a049'}, font: {size: 18, color: '#fff'}, shape: 'box'},
    {id: 'esp32', label: 'ESP32\nMicrocontroller', level: 2, color: {background: '#66bb6a', border: '#4caf50'}, shape: 'box'},
    {id: 'sensors', label: 'Sensors\n(QTR, IMU, TOF)', level: 2, color: {background: '#66bb6a', border: '#4caf50'}, shape: 'box'},
    {id: 'motors', label: 'Motors\n(4 Motors)', level: 2, color: {background: '#66bb6a', border: '#4caf50'}, shape: 'box'},
    {id: 'servos', label: 'Servos\n(Gripper, Arm)', level: 2, color: {background: '#66bb6a', border: '#4caf50'}, shape: 'box'},
                
    // Communication Layer
    {id: 'comm', label: 'Communication', level: 1, color: {background: '#ff9800', border: '#f57c00'}, font: {size: 18, color: '#fff'}, shape: 'box'},
    {id: 'serial', label: 'Serial UART\n115200 baud', level: 2, color: {background: '#ffb74d', border: '#ff9800'}, shape: 'box'},
    {id: 'websocket', label: 'WebSocket\nReal-time', level: 2, color: {background: '#ffb74d', border: '#ff9800'}, shape: 'box'},
    {id: 'rest', label: 'REST API\nEndpoints', level: 2, color: {background: '#ffb74d', border: '#ff9800'}, shape: 'box'},
                
    // Server Layer
    {id: 'server', label: 'Python Server', level: 1, color: {background: '#9c27b0', border: '#7b1fa2'}, font: {size: 18, color: '#fff'}, shape: 'box'},
    {id: 'flask', label: 'Flask\nWeb Framework', level: 2, color: {background: '#ba68c8', border: '#9c27b0'}, shape: 'box'},
    {id: 'socketio', label: 'SocketIO\nReal-time Events', level: 2, color: {background: '#ba68c8', border: '#9c27b0'}, shape: 'box'},
    {id: 'telemetry', label: 'Telemetry\nBuffer (1000)', level: 2, color: {background: '#ba68c8', border: '#9c27b0'}, shape: 'box'},
    {id: 'simulation', label: 'Simulation\nEngine', level: 2, color: {background: '#ba68c8', border: '#9c27b0'}, shape: 'box'},
                
    // ML Layer
    {id: 'ml', label: 'Machine Learning', level: 1, color: {background: '#f44336', border: '#d32f2f'}, font: {size: 18, color: '#fff'}, shape: 'box'},
    {id: 'randomforest', label: 'RandomForest\nClassifier/Regressor', level: 2, color: {background: '#ef5350', border: '#f44336'}, shape: 'box'},
    {id: 'drift', label: 'Drift Detector\nML Model', level: 2, color: {background: '#ef5350', border: '#f44336'}, shape: 'box'},
    {id: 'pid_ml', label: 'PID Optimization\nML-Based', level: 2, color: {background: '#ef5350', border: '#f44336'}, shape: 'box'},
    {id: 'scaler', label: 'StandardScaler\nFeature Normalization', level: 2, color: {background: '#ef5350', border: '#f44336'}, shape: 'box'},
                
    // Frontend Layer
    {id: 'frontend', label: 'Frontend Dashboard', level: 1, color: {background: '#2196F3', border: '#1976D2'}, font: {size: 18, color: '#fff'}, shape: 'box'},
    {id: 'html', label: 'HTML/CSS\nUI Components', level: 2, color: {background: '#64b5f6', border: '#2196F3'}, shape: 'box'},
    {id: 'js', label: 'JavaScript\nClient Logic', level: 2, color: {background: '#64b5f6', border: '#2196F3'}, shape: 'box'},
    {id: 'threejs', label: 'Three.js\n3D Simulation', level: 2, color: {background: '#64b5f6', border: '#2196F3'}, shape: 'box'},
    {id: 'chartjs', label: 'Chart.js\nGraphs', level: 2, color: {background: '#64b5f6', border: '#2196F3'}, shape: 'box'},
                
    // Features
    {id: 'features', label: '16 Advanced Tools', level: 1, color: {background: '#00bcd4', border: '#0097a7'}, font: {size: 18, color: '#fff'}, shape: 'box'},
    {id: 'optimization', label: 'Optimization Lab\nPID, ML Training', level: 2, color: {background: '#4dd0e1', border: '#00bcd4'}, shape: 'box'},
    {id: 'strategy', label: 'Strategy Engine\nPath Planning', level: 2, color: {background: '#4dd0e1', border: '#00bcd4'}, shape: 'box'},
    {id: 'ai_assist', label: 'AI Driver Assist\nReal-time Tips', level: 2, color: {background: '#4dd0e1', border: '#00bcd4'}, shape: 'box'},
    {id: 'psi', label: 'PSI Score\nPerformance Index', level: 2, color: {background: '#4dd0e1', border: '#00bcd4'}, shape: 'box'},
    {id: 'debugger', label: 'Auto-Debugger\nCode Analysis', level: 2, color: {background: '#4dd0e1', border: '#00bcd4'}, shape: 'box'},
    {id: 'chatbot', label: 'AI Chatbot\nNatural Language', level: 2, color: {background: '#4dd0e1', border: '#00bcd4'}, shape: 'box'},
                
    // Data Flow
    {id: 'dataflow', label: 'Data Flow', level: 1, color: {background: '#795548', border: '#5d4037'}, font: {size: 18, color: '#fff'}, shape: 'box'},
    {id: 'input', label: 'Input\nSensors, Commands', level: 2, color: {background: '#a1887f', border: '#795548'}, shape: 'box'},
    {id: 'process', label: 'Process\nML, Analysis', level: 2, color: {background: '#a1887f', border: '#795548'}, shape: 'box'},
    {id: 'output', label: 'Output\nVisualization, Control', level: 2, color: {background: '#a1887f', border: '#795548'}, shape: 'box'},
    ]);

    // Define edges (connections)
    const edges = new vis.DataSet([
    // Central connections
    {from: 'central', to: 'hardware', color: {color: '#4caf50'}, width: 3},
    {from: 'central', to: 'comm', color: {color: '#ff9800'}, width: 3},
    {from: 'central', to: 'server', color: {color: '#9c27b0'}, width: 3},
    {from: 'central', to: 'ml', color: {color: '#f44336'}, width: 3},
    {from: 'central', to: 'frontend', color: {color: '#2196F3'}, width: 3},
    {from: 'central', to: 'features', color: {color: '#00bcd4'}, width: 3},
    {from: 'central', to: 'dataflow', color: {color: '#795548'}, width: 3},
                
    // Hardware connections
    {from: 'hardware', to: 'esp32', color: {color: '#66bb6a'}},
    {from: 'hardware', to: 'sensors', color: {color: '#66bb6a'}},
    {from: 'hardware', to: 'motors', color: {color: '#66bb6a'}},
    {from: 'hardware', to: 'servos', color: {color: '#66bb6a'}},
                
    // Communication connections
    {from: 'comm', to: 'serial', color: {color: '#ffb74d'}},
    {from: 'comm', to: 'websocket', color: {color: '#ffb74d'}},
    {from: 'comm', to: 'rest', color: {color: '#ffb74d'}},
    {from: 'esp32', to: 'serial', color: {color: '#888', dashes: true}},
    {from: 'serial', to: 'server', color: {color: '#888', dashes: true}},
                
    // Server connections
    {from: 'server', to: 'flask', color: {color: '#ba68c8'}},
    {from: 'server', to: 'socketio', color: {color: '#ba68c8'}},
    {from: 'server', to: 'telemetry', color: {color: '#ba68c8'}},
    {from: 'server', to: 'simulation', color: {color: '#ba68c8'}},
    {from: 'socketio', to: 'frontend', color: {color: '#888', dashes: true}},
    {from: 'rest', to: 'frontend', color: {color: '#888', dashes: true}},
                
    // ML connections
    {from: 'ml', to: 'randomforest', color: {color: '#ef5350'}},
    {from: 'ml', to: 'drift', color: {color: '#ef5350'}},
    {from: 'ml', to: 'pid_ml', color: {color: '#ef5350'}},
    {from: 'ml', to: 'scaler', color: {color: '#ef5350'}},
    {from: 'telemetry', to: 'drift', color: {color: '#888', dashes: true}},
    {from: 'drift', to: 'ai_assist', color: {color: '#888', dashes: true}},
                
    // Frontend connections
    {from: 'frontend', to: 'html', color: {color: '#64b5f6'}},
    {from: 'frontend', to: 'js', color: {color: '#64b5f6'}},
    {from: 'frontend', to: 'threejs', color: {color: '#64b5f6'}},
    {from: 'frontend', to: 'chartjs', color: {color: '#64b5f6'}},
                
    // Features connections
    {from: 'features', to: 'optimization', color: {color: '#4dd0e1'}},
    {from: 'features', to: 'strategy', color: {color: '#4dd0e1'}},
    {from: 'features', to: 'ai_assist', color: {color: '#4dd0e1'}},
    {from: 'features', to: 'psi', color: {color: '#4dd0e1'}},
    {from: 'features', to: 'debugger', color: {color: '#4dd0e1'}},
    {from: 'features', to: 'chatbot', color: {color: '#4dd0e1'}},
    {from: 'server', to: 'optimization', color: {color: '#888', dashes: true}},
    {from: 'server', to: 'strategy', color: {color: '#888', dashes: true}},
    {from: 'server', to: 'psi', color: {color: '#888', dashes: true}},
                
    // Data flow connections
    {from: 'dataflow', to: 'input', color: {color: '#a1887f'}},
    {from: 'dataflow', to: 'process', color: {color: '#a1887f'}},
    {from: 'dataflow', to: 'output', color: {color: '#a1887f'}},
    {from: 'sensors', to: 'input', color: {color: '#888', dashes: true}},
    {from: 'input', to: 'telemetry', color: {color: '#888', dashes: true}},
    {from: 'telemetry', to: 'process', color: {color: '#888', dashes: true}},
    {from: 'process', to: 'ml', color: {color: '#888', dashes: true}},
    {from: 'process', to: 'output', color: {color: '#888', dashes: true}},
    {from: 'output', to: 'frontend', color: {color: '#888', dashes: true}},
    ]);

    mindMapData = {nodes: nodes, edges: edges};

    // Configure options
    mindMapOptions = {
    nodes: {
    borderWidth: 2,
    shadow: true,
    font: {
    size: 14,
    face: 'Arial'
    },
    margin: 10
    },
    edges: {
    width: 2,
    smooth: {
    type: 'continuous',
    roundness: 0.5
    },
    arrows: {
    to: {
    enabled: true,
    scaleFactor: 0.8
    }
    },
    color: {
    inherit: 'from'
    }
    },
    physics: {
    enabled: true,
    stabilization: {
    iterations: 200,
    fit: true
    },
    barnesHut: {
    gravitationalConstant: -2000,
    centralGravity: 0.1,
    springLength: 200,
    springConstant: 0.04,
    damping: 0.09
    }
    },
    interaction: {
    dragNodes: true,
    dragView: true,
    zoomView: true,
    hover: true,
    tooltipDelay: 200
    },
    layout: {
    improvedLayout: true,
    hierarchical: {
    enabled: false
    }
    }
    };

    // Create network
    mindMapNetwork = new vis.Network(container, mindMapData, mindMapOptions);

    // Add click event to show details
    mindMapNetwork.on('click', function(params) {
    if (params.nodes.length > 0) {
    const nodeId = params.nodes[0];
    const node = nodes.get(nodeId);
    if (node) {
    showNodeDetails(node);
    }
    }
    });

    // Add hover tooltips
    mindMapNetwork.on('hoverNode', function(params) {
    container.style.cursor = 'pointer';
    });

    mindMapNetwork.on('blurNode', function(params) {
    container.style.cursor = 'default';
    });
        }

        function showNodeDetails(node) {
    const details = getNodeDetails(node.id);
    if (details) {
    alert(`${node.label}\n\n${details}`);
    }
        }

        function getNodeDetails(nodeId) {
    const details = {
    'central': 'The central NRL Robot System coordinating all components. This is the main hub that connects hardware, software, ML, and frontend.',
    'esp32': 'ESP32 microcontroller running Arduino firmware. Handles sensor reading, motor control, PID control, and JSON telemetry streaming at 20-50 Hz.',
    'sensors': 'Sensor array: 8 QTR line sensors, IMU (gyro/accelerometer), TOF distance sensor. All sensors feed into the telemetry stream.',
    'motors': '4 differential drive motors controlled via PWM. Left/right motor control for movement and turning.',
    'servos': 'Servo motors for gripper (pickup/drop) and arm (raise/lower) control.',
    'serial': 'Serial UART communication at 115200 baud. Bidirectional: ESP32 → Server (telemetry), Server → ESP32 (commands).',
    'websocket': 'WebSocket (Socket.IO) for real-time bidirectional communication between server and frontend. Broadcasts telemetry at 20 Hz.',
    'rest': 'REST API endpoints for dashboard tools, chatbot, analysis, and control commands. 20+ endpoints available.',
    'flask': 'Flask web framework serving the dashboard, handling API requests, and managing server state.',
    'socketio': 'Flask-SocketIO for WebSocket support. Enables real-time telemetry streaming to frontend.',
    'telemetry': 'Circular buffer storing last 1000 telemetry packets. Used for analysis, ML training, and historical data.',
    'simulation': 'Python simulation engine generating mock telemetry for testing. Supports Auto Challenge and Main Challenge modes.',
    'randomforest': 'Scikit-learn RandomForest models for classification (drift detection) and regression (performance prediction).',
    'drift': 'ML model trained on telemetry to predict motor drift. Uses RandomForestClassifier with features: line error, PWM, encoder diff.',
    'pid_ml': 'ML-based PID parameter optimization. Analyzes performance data to suggest optimal Kp, Ki, Kd values.',
    'scaler': 'StandardScaler for feature normalization before ML inference. Ensures consistent input scaling.',
    'html': 'HTML5/CSS3 dashboard UI with responsive design, dark theme, and modern styling.',
    'js': 'JavaScript client-side logic handling WebSocket events, API calls, chart updates, and user interactions.',
    'threejs': 'Three.js 3D graphics library for rendering field simulations. Shows robot position, field elements, and real-time movement.',
    'chartjs': 'Chart.js for real-time line charts showing line error, motor speed, and performance metrics over time.',
    'optimization': 'Optimization Lab: Auto-tunes PID parameters, trains ML models, provides sensor calibration tools.',
    'strategy': 'Strategy Engine: Calculates optimal paths, recommends routes, predicts scores, and suggests tactics.',
    'ai_assist': 'AI Driver Assist: Real-time collision warnings, drift predictions, battery alerts, and driving tips.',
    'psi': 'Performance Scoring Index (0-100): Calculates smoothness, precision, speed, and stability metrics.',
    'debugger': 'Auto-Debugger: Detects code issues (blocking delays, motor overshoot, sensor problems) and suggests fixes.',
    'chatbot': 'AI Chatbot: Natural language interface answering questions about performance, robot status, and providing recommendations.',
    'input': 'Data Input: Sensor readings (line, IMU, TOF), motor commands, and user inputs (WASD, PS5 controller).',
    'process': 'Data Processing: ML inference, performance analysis, strategy calculation, and real-time decision making.',
    'output': 'Data Output: Visualizations (graphs, 3D simulation), recommendations, alerts, and control commands back to robot.'
    };
    return details[nodeId];
        }
        
        // FINAL FIX: Ensure button works - multiple attempts
        function ensureStartButtonWorks() {
    const btn = document.getElementById('start-main-challenge-btn');
    if (btn) {
    console.log('✅ Button found, attaching handler...');
                
    // Remove all existing handlers by cloning
    const newBtn = btn.cloneNode(true);
    btn.parentNode.replaceChild(newBtn, btn);
                
    // Method 1: Direct onclick
    newBtn.onclick = function(e) {
    e.preventDefault();
    e.stopPropagation();
    console.log('🔘🔘🔘 BUTTON CLICKED - onclick fired!');
    try {
    if (typeof startMainChallengeFromSim === 'function') {
    startMainChallengeFromSim();
    } else {
    console.error('startMainChallengeFromSim is not a function!');
    alert('ERROR: Function not found. Check console.');
    }
    } catch (err) {
    console.error('Error in onclick handler:', err);
    alert('Error: ' + err.message);
    }
    return false;
    };
                
    // Method 2: Event listener
    newBtn.addEventListener('click', function(e) {
    e.preventDefault();
    e.stopPropagation();
    console.log('🔘🔘🔘 BUTTON CLICKED - addEventListener fired!');
    try {
    if (typeof startMainChallengeFromSim === 'function') {
    startMainChallengeFromSim();
    }
    } catch (err) {
    console.error('Error in addEventListener:', err);
    }
    }, true); // Use capture phase
                
    console.log('✅✅✅ Button handler attached successfully!');
    return true;
    } else {
    console.warn('⚠ Button not found');
    return false;
    }
        }
        
        // Try multiple times to ensure it works
        function attachButtonWithRetries() {
    let attempts = 0;
    const maxAttempts = 5;
            
    function tryAttach() {
    attempts++;
    if (ensureStartButtonWorks()) {
    console.log('✅ Button handler attached on attempt', attempts);
    } else if (attempts < maxAttempts) {
    console.log('Retrying button attachment, attempt', attempts + 1);
    setTimeout(tryAttach, 500);
    } else {
    console.error('❌ Failed to attach button handler after', maxAttempts, 'attempts');
    }
    }
            
    tryAttach();
        }
        
        // Try immediately
        if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', attachButtonWithRetries);
        } else {
    attachButtonWithRetries();
        }
        
        // Also retry when switching to simulation tab
        const originalSwitchTab = window.switchTab;
        if (typeof originalSwitchTab === 'function') {
    window.switchTab = function(tabName) {
    if (originalSwitchTab) originalSwitchTab(tabName);
    if (tabName === 'simulation') {
    setTimeout(ensureStartButtonWorks, 300);
    }
    };
        }

    </script>
</body>
</html>

