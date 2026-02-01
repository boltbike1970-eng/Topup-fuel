const { useState, useEffect, useRef } = React;
const { Activity, Heart, Zap, Droplets, Battery, Play, Pause, Square, Volume2 } = lucide;

function CyclingNutritionApp() {
  const [screen, setScreen] = useState('setup');
  const [userWeight, setUserWeight] = useState(75);
  const [rideType, setRideType] = useState('moderate');
  const [preRideCalories, setPreRideCalories] = useState(0);

  // Ride tracking
  const [isRiding, setIsRiding] = useState(false);
  const [rideTime, setRideTime] = useState(0);
  const [heartRate, setHeartRate] = useState(0);
  const [avgHeartRate, setAvgHeartRate] = useState(0);
  const [caloriesBurned, setCaloriesBurned] = useState(0);
  const [caloriesConsumed, setCaloriesConsumed] = useState(0);
  const [nextFuelingIn, setNextFuelingIn] = useState(null);
  const [fuelingAlerts, setFuelingAlerts] = useState([]);
  const [voiceAlertsEnabled, setVoiceAlertsEnabled] = useState(true);
  const [voiceCommandEnabled, setVoiceCommandEnabled] = useState(true);
  const [isListening, setIsListening] = useState(false);

  // Bluetooth
  const [hrDevice, setHrDevice] = useState(null);
  const [isConnecting, setIsConnecting] = useState(false);

  // Refs
  const rideIntervalRef = useRef(null);
  const hrReadingsRef = useRef([]);
  const lastFuelingCalRef = useRef(0);
  const audioContextRef = useRef(null);
  const recognitionRef = useRef(null);
  const caloriesBurnedRef = useRef(0);
  const fuelingAlertsRef = useRef([]);

  // Keep refs in sync with state
  useEffect(() => { caloriesBurnedRef.current = caloriesBurned; }, [caloriesBurned]);
  useEffect(() => { fuelingAlertsRef.current = fuelingAlerts; }, [fuelingAlerts]);

  // Intensity presets
  const intensityPresets = {
    recovery: { met: 4.0, name: 'Recovery', hrPercent: 60 },
    moderate: { met: 8.0, name: 'Moderate', hrPercent: 70 },
    tempo:    { met: 10.0, name: 'Tempo',    hrPercent: 80 },
    hard:     { met: 12.0, name: 'Hard',     hrPercent: 85 },
    race:     { met: 14.0, name: 'Race',     hrPercent: 90 }
  };

  const currentIntensity = intensityPresets[rideType];

  // Calories per minute
  const getCaloriesPerMinute = (met, weightKg) => (met * weightKg * 3.5) / 200;

  // HR-adjusted calories
  const getHRAdjustedCalories = (baseCalPerMin, currentHR, restingHR = 60, maxHR = 190) => {
    if (!currentHR || currentHR < restingHR) return baseCalPerMin;
    const hrReserve = maxHR - restingHR;
    const intensity = (currentHR - restingHR) / hrReserve;
    return baseCalPerMin * (0.7 + intensity * 0.6);
  };

  // Bluetooth HR monitor
  const connectHRMonitor = async () => {
    try {
      setIsConnecting(true);
      if (!navigator.bluetooth) {
        alert('Bluetooth is not supported. Please use Chrome on Android or Desktop.');
        setIsConnecting(false);
        return;
      }
      const device = await navigator.bluetooth.requestDevice({
        filters: [{ services: ['heart_rate'] }],
        optionalServices: ['battery_service']
      });
      const server = await device.gatt.connect();
      const service = await server.getPrimaryService('heart_rate');
      const characteristic = await service.getCharacteristic('heart_rate_measurement');
      characteristic.addEventListener('characteristicvaluechanged', (event) => {
        const hr = event.target.value.getUint8(1);
        setHeartRate(hr);
        hrReadingsRef.current.push(hr);
        if (hrReadingsRef.current.length > 20) hrReadingsRef.current.shift();
      });
      await characteristic.startNotifications();
      setHrDevice(device);
      setIsConnecting(false);
    } catch (error) {
      console.error('Bluetooth error:', error);
      alert('Could not connect to heart rate monitor. Make sure it\'s on and nearby.');
      setIsConnecting(false);
    }
  };

  // Beep sound
  const playAlert = () => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
    }
    const ctx = audioContextRef.current;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 800;
    osc.type = 'sine';
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.5);
  };

  // Text-to-speech
  const speakAlert = (message) => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(message);
      utterance.rate = 0.9;
      utterance.pitch = 1.0;
      utterance.volume = 1.0;
      const voices = window.speechSynthesis.getVoices();
      const preferred = voices.find(v => v.lang.startsWith('en') && (v.name.includes('Google') || v.name.includes('Microsoft')));
      if (preferred) utterance.voice = preferred;
      window.speechSynthesis.speak(utterance);
    }
  };

  // Voice recognition
  const startVoiceRecognition = () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return;

    const recognition = new SR();
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.lang = 'en-US';

    recognition.onstart = () => setIsListening(true);

    recognition.onresult = (event) => {
      const text = event.results[event.results.length - 1][0].transcript.toLowerCase().trim();
      if (text.includes('topped up') || text.includes('top up') || text.includes('topped') || text.includes('top it up')) {
        const alerts = fuelingAlertsRef.current;
        if (alerts.length > 0) {
          const latest = alerts[alerts.length - 1];
          markFuelingConsumed(latest.carbs);
          playAlert();
          if (voiceAlertsEnabled) speakAlert('Confirmed. Fueling logged.');
        }
      }
    };

    recognition.onerror = (event) => {
      if (event.error !== 'no-speech') console.error('Speech error:', event.error);
    };

    recognition.onend = () => {
      setIsListening(false);
      if (voiceCommandEnabled && recognitionRef.current) {
        setTimeout(() => { try { recognition.start(); } catch(e) {} }, 1000);
      }
    };

    recognitionRef.current = recognition;
    try { recognition.start(); } catch(e) { console.error('Recognition start failed:', e); }
  };

  const stopVoiceRecognition = () => {
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch(e) {}
      recognitionRef.current = null;
      setIsListening(false);
    }
  };

  // Fueling logic
  const checkFuelingAlert = (currentCaloriesBurned) => {
    const initialThreshold = 150 + (currentIntensity.met - 8) * 50;
    const fuelingInterval  = 200 + (currentIntensity.met - 8) * 25;

    if (currentCaloriesBurned < initialThreshold) {
      setNextFuelingIn(Math.round(initialThreshold - currentCaloriesBurned));
      return;
    }

    const sinceLastFuel = currentCaloriesBurned - lastFuelingCalRef.current;

    if (sinceLastFuel >= fuelingInterval) {
      const carbsNeeded = Math.min(80, Math.max(30, Math.round((sinceLastFuel * 0.55) / 4)));
      playAlert();
      if (voiceAlertsEnabled) speakAlert(`Time to fuel. Take ${carbsNeeded} grams of carbs.`);

      const alert = {
        time: Date.now(),
        calories: Math.round(sinceLastFuel),
        message: `Time to fuel! Take ${carbsNeeded}g carbs`,
        carbs: carbsNeeded
      };
      setFuelingAlerts(prev => [...prev, alert]);
      lastFuelingCalRef.current = currentCaloriesBurned;
      setNextFuelingIn(fuelingInterval);
    } else {
      setNextFuelingIn(Math.round(fuelingInterval - sinceLastFuel));
    }
  };

  const markFuelingConsumed = (carbs) => {
    setCaloriesConsumed(prev => prev + carbs * 4);
    setFuelingAlerts(prev => prev.slice(0, -1));
  };

  // Start ride
  const startRide = () => {
    setIsRiding(true);
    setScreen('riding');
    setCaloriesConsumed(preRideCalories);
    hrReadingsRef.current = [];
    lastFuelingCalRef.current = 0;
    caloriesBurnedRef.current = 0;
    setCaloriesBurned(0);
    setRideTime(0);

    if (voiceCommandEnabled) setTimeout(() => startVoiceRecognition(), 1000);

    rideIntervalRef.current = setInterval(() => {
      setRideTime(prev => prev + 1);

      const baseCalPerMin = getCaloriesPerMinute(currentIntensity.met, userWeight);
      const adjustedCalPerMin = heartRate > 0
        ? getHRAdjustedCalories(baseCalPerMin, heartRate)
        : baseCalPerMin;

      const newCalories = caloriesBurnedRef.current + (adjustedCalPerMin / 60);
      caloriesBurnedRef.current = newCalories;
      setCaloriesBurned(newCalories);

      const avgHR = hrReadingsRef.current.length > 0
        ? hrReadingsRef.current.reduce((a, b) => a + b, 0) / hrReadingsRef.current.length
        : 0;
      if (avgHR > 0) setAvgHeartRate(Math.round(avgHR));

      checkFuelingAlert(newCalories);
    }, 1000);
  };

  // Resume ride (after pause)
  const resumeRide = () => {
    setIsRiding(true);
    if (voiceCommandEnabled) setTimeout(() => startVoiceRecognition(), 1000);

    rideIntervalRef.current = setInterval(() => {
      setRideTime(prev => prev + 1);

      const baseCalPerMin = getCaloriesPerMinute(currentIntensity.met, userWeight);
      const adjustedCalPerMin = heartRate > 0
        ? getHRAdjustedCalories(baseCalPerMin, heartRate)
        : baseCalPerMin;

      const newCalories = caloriesBurnedRef.current + (adjustedCalPerMin / 60);
      caloriesBurnedRef.current = newCalories;
      setCaloriesBurned(newCalories);

      const avgHR = hrReadingsRef.current.length > 0
        ? hrReadingsRef.current.reduce((a, b) => a + b, 0) / hrReadingsRef.current.length
        : 0;
      if (avgHR > 0) setAvgHeartRate(Math.round(avgHR));

      checkFuelingAlert(newCalories);
    }, 1000);
  };

  const pauseRide = () => {
    setIsRiding(false);
    if (rideIntervalRef.current) clearInterval(rideIntervalRef.current);
    stopVoiceRecognition();
  };

  const endRide = () => {
    pauseRide();
    setScreen('summary');
  };

  const resetRide = () => {
    setScreen('setup');
    setRideTime(0);
    setHeartRate(0);
    setAvgHeartRate(0);
    setCaloriesBurned(0);
    caloriesBurnedRef.current = 0;
    setCaloriesConsumed(0);
    setPreRideCalories(0);
    setNextFuelingIn(null);
    setFuelingAlerts([]);
    fuelingAlertsRef.current = [];
    hrReadingsRef.current = [];
    lastFuelingCalRef.current = 0;
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (rideIntervalRef.current) clearInterval(rideIntervalRef.current);
      stopVoiceRecognition();
    };
  }, []);

  // Format time
  const formatTime = (seconds) => {
    const hrs  = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hrs > 0) return `${hrs}:${String(mins).padStart(2,'0')}:${String(secs).padStart(2,'0')}`;
    return `${mins}:${String(secs).padStart(2,'0')}`;
  };

  // ─── SETUP SCREEN ───────────────────────────────────────────
  if (screen === 'setup') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
        <div className="max-w-md mx-auto">
          <div className="bg-white rounded-2xl shadow-xl p-6 mt-8">

            {/* Header */}
            <div className="flex items-center justify-center mb-4">
              <Activity className="w-12 h-12 text-indigo-600 mr-3" />
              <h1 className="text-3xl font-bold text-gray-800">Top-up Fuel</h1>
            </div>
            <p className="text-gray-500 text-center mb-8">Smart fueling alerts for your ride</p>

            {/* Weight */}
            <label className="block text-sm font-medium text-gray-700 mb-2">Your Weight (kg)</label>
            <input
              type="number"
              value={userWeight}
              onChange={(e) => setUserWeight(Number(e.target.value))}
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-indigo-500 focus:outline-none text-lg mb-6"
              min="40" max="150"
            />

            {/* Pre-ride calories */}
            <label className="block text-sm font-medium text-gray-700 mb-2">Pre-Ride Calories (optional)</label>
            <input
              type="number"
              value={preRideCalories}
              onChange={(e) => setPreRideCalories(Number(e.target.value))}
              placeholder="0"
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-indigo-500 focus:outline-none text-lg mb-1"
              min="0" max="2000"
            />
            <p className="text-xs text-gray-500 mb-6">Calories eaten before the ride (breakfast, snacks, etc.)</p>

            {/* Intensity */}
            <label className="block text-sm font-medium text-gray-700 mb-3">Ride Intensity</label>
            <div className="space-y-2 mb-6">
              {Object.entries(intensityPresets).map(([key, preset]) => (
                <button
                  key={key}
                  onClick={() => setRideType(key)}
                  className={`w-full px-4 py-3 rounded-lg font-medium transition-all ${
                    rideType === key ? 'bg-indigo-600 text-white shadow-lg' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  <div className="flex justify-between items-center">
                    <span>{preset.name}</span>
                    <span className="text-sm opacity-80">~{preset.hrPercent}% HR</span>
                  </div>
                </button>
              ))}
            </div>

            {/* HR Monitor */}
            <div className="mb-6 p-4 bg-blue-50 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center">
                  <Heart className="w-5 h-5 text-red-500 mr-2" />
                  <span className="font-medium text-gray-700">Heart Rate Monitor</span>
                </div>
                {hrDevice && <span className="text-green-600 text-sm font-medium">Connected</span>}
              </div>
              {!hrDevice ? (
                <button
                  onClick={connectHRMonitor}
                  disabled={isConnecting}
                  className="w-full mt-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                  {isConnecting ? 'Connecting...' : 'Connect via Bluetooth'}
                </button>
              ) : (
                <p className="text-sm text-gray-600 mt-2">Connected to {hrDevice.name}</p>
              )}
            </div>

            {/* Voice Alerts */}
            <div className="mb-6 p-4 bg-purple-50 rounded-lg">
              <label className="flex items-center justify-between cursor-pointer">
                <div className="flex items-center flex-1">
                  <Volume2 className="w-5 h-5 text-purple-600 mr-3 flex-shrink-0" />
                  <div>
                    <div className="font-medium text-gray-700">Voice Alerts</div>
                    <div className="text-sm text-gray-600">Speak fueling recommendations aloud</div>
                  </div>
                </div>
                <div className="relative ml-3">
                  <input type="checkbox" checked={voiceAlertsEnabled} onChange={(e) => setVoiceAlertsEnabled(e.target.checked)} className="sr-only peer" />
                  <div className="w-14 h-8 bg-gray-300 rounded-full peer peer-checked:bg-purple-600 relative transition-colors">
                    <div className={`absolute top-1 left-1 w-6 h-6 bg-white border border-gray-300 rounded-full shadow transition-transform ${voiceAlertsEnabled ? 'translate-x-6' : ''}`}></div>
                  </div>
                </div>
              </label>
              {voiceAlertsEnabled && (
                <button onClick={() => speakAlert("Time to fuel. Take 50 grams of carbs.")} className="w-full mt-3 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-sm">
                  Test Voice Alert
                </button>
              )}
            </div>

            {/* Voice Commands */}
            <div className="mb-6 p-4 bg-green-50 rounded-lg">
              <label className="flex items-center justify-between cursor-pointer">
                <div className="flex items-center flex-1">
                  <Volume2 className="w-5 h-5 text-green-600 mr-3 flex-shrink-0" />
                  <div>
                    <div className="font-medium text-gray-700">Voice Commands</div>
                    <div className="text-sm text-gray-600">Say "Topped Up" to mark fueling</div>
                  </div>
                </div>
                <div className="relative ml-3">
                  <input type="checkbox" checked={voiceCommandEnabled} onChange={(e) => setVoiceCommandEnabled(e.target.checked)} className="sr-only peer" />
                  <div className="w-14 h-8 bg-gray-300 rounded-full peer peer-checked:bg-green-600 relative transition-colors">
                    <div className={`absolute top-1 left-1 w-6 h-6 bg-white border border-gray-300 rounded-full shadow transition-transform ${voiceCommandEnabled ? 'translate-x-6' : ''}`}></div>
                  </div>
                </div>
              </label>
            </div>

            {/* Start */}
            <button
              onClick={startRide}
              className="w-full py-4 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl font-bold text-lg shadow-lg hover:shadow-xl transition-all"
            >
              <div className="flex items-center justify-center">
                <Play className="w-6 h-6 mr-2" />
                Start Ride
              </div>
            </button>
            {!hrDevice && <p className="text-xs text-gray-500 text-center mt-4">Optional: Connect HR monitor for more accurate calorie tracking</p>}
          </div>
        </div>
      </div>
    );
  }

  // ─── RIDING SCREEN ──────────────────────────────────────────
  if (screen === 'riding') {
    const calorieDeficit = Math.max(0, caloriesBurned - caloriesConsumed);
    const latestAlert = fuelingAlerts[fuelingAlerts.length - 1];

    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100 p-4">
        <div className="max-w-md mx-auto">

          {/* Timer */}
          <div className="bg-white rounded-2xl shadow-xl p-6 mt-4 mb-4 text-center">
            <div className="text-5xl font-bold text-gray-800 mb-2">{formatTime(rideTime)}</div>
            <div className="text-gray-600 font-medium">{currentIntensity.name} Intensity</div>
            {voiceCommandEnabled && isListening && (
              <div className="mt-2 flex items-center justify-center text-green-600 text-sm">
                <Volume2 className="w-4 h-4 mr-1" style={{ animation: 'pulse 1.5s infinite' }} />
                <span>Listening for "Topped Up"</span>
              </div>
            )}
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="bg-white rounded-xl shadow-lg p-4">
              <div className="flex items-center mb-2">
                <Heart className={`w-5 h-5 mr-2 ${heartRate > 0 ? 'text-red-500' : 'text-gray-400'}`} />
                <span className="text-sm text-gray-600">Heart Rate</span>
              </div>
              <div className="text-2xl font-bold text-gray-800">{heartRate > 0 ? heartRate : '--'}</div>
              <div className="text-xs text-gray-500">Avg: {avgHeartRate > 0 ? avgHeartRate : '--'} bpm</div>
            </div>
            <div className="bg-white rounded-xl shadow-lg p-4">
              <div className="flex items-center mb-2">
                <Zap className="w-5 h-5 text-orange-500 mr-2" />
                <span className="text-sm text-gray-600">Burned</span>
              </div>
              <div className="text-2xl font-bold text-gray-800">{Math.round(caloriesBurned)}</div>
              <div className="text-xs text-gray-500">calories</div>
            </div>
            <div className="bg-white rounded-xl shadow-lg p-4">
              <div className="flex items-center mb-2">
                <Droplets className="w-5 h-5 text-blue-500 mr-2" />
                <span className="text-sm text-gray-600">Consumed</span>
              </div>
              <div className="text-2xl font-bold text-gray-800">{Math.round(caloriesConsumed)}</div>
              <div className="text-xs text-gray-500">calories</div>
            </div>
            <div className="bg-white rounded-xl shadow-lg p-4">
              <div className="flex items-center mb-2">
                <Battery className="w-5 h-5 text-purple-500 mr-2" />
                <span className="text-sm text-gray-600">Deficit</span>
              </div>
              <div className="text-2xl font-bold text-gray-800">{Math.round(calorieDeficit)}</div>
              <div className="text-xs text-gray-500">calories</div>
            </div>
          </div>

          {/* Fueling Alert or Countdown */}
          {latestAlert ? (
            <div className="bg-yellow-400 rounded-xl shadow-lg p-5 mb-4" style={{ animation: 'pulse 1.5s infinite' }}>
              <div className="flex items-center mb-3">
                <Zap className="w-6 h-6 text-yellow-900 mr-2" />
                <span className="font-bold text-yellow-900 text-lg">FUEL NOW!</span>
              </div>
              <p className="text-yellow-900 font-medium mb-1">{latestAlert.message}</p>
              <p className="text-yellow-800 text-sm mb-2">({latestAlert.calories} calories burned since last fuel)</p>
              {voiceCommandEnabled && <p className="text-yellow-800 text-sm mb-3 italic">💬 Say "Topped Up" or tap below</p>}
              <button onClick={() => markFuelingConsumed(latestAlert.carbs)} className="w-full py-2 bg-yellow-900 text-yellow-100 rounded-lg font-medium hover:bg-yellow-800 transition-colors">
                Mark as Consumed
              </button>
            </div>
          ) : nextFuelingIn !== null && (
            <div className="bg-white rounded-xl shadow-lg p-5 mb-4">
              <div className="flex items-center justify-center">
                <Zap className="w-5 h-5 text-gray-600 mr-2" />
                <span className="text-gray-700">Next fueling in <span className="font-bold text-indigo-600">{nextFuelingIn} calories</span></span>
              </div>
            </div>
          )}

          {/* Controls */}
          <div className="flex gap-3">
            {isRiding ? (
              <button onClick={pauseRide} className="flex-1 py-4 bg-yellow-500 text-white rounded-xl font-bold shadow-lg hover:bg-yellow-600 transition-colors">
                <div className="flex items-center justify-center"><Pause className="w-5 h-5 mr-2" /> Pause</div>
              </button>
            ) : (
              <button onClick={resumeRide} className="flex-1 py-4 bg-green-600 text-white rounded-xl font-bold shadow-lg hover:bg-green-700 transition-colors">
                <div className="flex items-center justify-center"><Play className="w-5 h-5 mr-2" /> Resume</div>
              </button>
            )}
            <button onClick={endRide} className="flex-1 py-4 bg-red-600 text-white rounded-xl font-bold shadow-lg hover:bg-red-700 transition-colors">
              <div className="flex items-center justify-center"><Square className="w-5 h-5 mr-2" /> End Ride</div>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ─── SUMMARY SCREEN ─────────────────────────────────────────
  if (screen === 'summary') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-100 p-4">
        <div className="max-w-md mx-auto">
          <div className="bg-white rounded-2xl shadow-xl p-6 mt-8">
            <h2 className="text-2xl font-bold text-gray-800 text-center mb-6">Ride Summary</h2>

            <div className="space-y-4 mb-6">
              <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                <span className="text-gray-600">Duration</span>
                <span className="font-bold text-lg">{formatTime(rideTime)}</span>
              </div>
              <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                <span className="text-gray-600">Avg Heart Rate</span>
                <span className="font-bold text-lg">{avgHeartRate > 0 ? avgHeartRate + ' bpm' : '--'}</span>
              </div>
              <div className="flex justify-between items-center p-3 bg-orange-50 rounded-lg">
                <span className="text-gray-600">Calories Burned</span>
                <span className="font-bold text-lg text-orange-600">{Math.round(caloriesBurned)}</span>
              </div>
              {preRideCalories > 0 && (
                <div className="flex justify-between items-center p-3 bg-green-50 rounded-lg">
                  <span className="text-gray-600">Pre-Ride Intake</span>
                  <span className="font-bold text-lg text-green-600">{preRideCalories}</span>
                </div>
              )}
              <div className="flex justify-between items-center p-3 bg-blue-50 rounded-lg">
                <span className="text-gray-600">During-Ride Intake</span>
                <span className="font-bold text-lg text-blue-600">{Math.round(caloriesConsumed - preRideCalories)}</span>
              </div>
              <div className="flex justify-between items-center p-3 bg-indigo-50 rounded-lg">
                <span className="text-gray-600">Total Intake</span>
                <span className="font-bold text-lg text-indigo-600">{Math.round(caloriesConsumed)}</span>
              </div>
              <div className="flex justify-between items-center p-3 bg-purple-50 rounded-lg">
                <span className="text-gray-600">Net Deficit</span>
                <span className="font-bold text-lg text-purple-600">{Math.round(caloriesBurned - caloriesConsumed)}</span>
              </div>
              <div className="flex justify-between items-center p-3 bg-green-50 rounded-lg">
                <span className="text-gray-600">Fueling Events</span>
                <span className="font-bold text-lg text-green-600">{fuelingAlerts.length}</span>
              </div>
            </div>

            <div className="p-4 bg-indigo-50 rounded-lg mb-6">
              <h3 className="font-semibold text-indigo-900 mb-2">Post-Ride Recovery</h3>
              <p className="text-sm text-indigo-800">
                Replenish with {Math.round(caloriesBurned * 0.3)}–{Math.round(caloriesBurned * 0.5)} calories within 30 minutes. Include protein for muscle recovery.
              </p>
            </div>

            <button onClick={resetRide} className="w-full py-4 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl font-bold shadow-lg hover:shadow-xl transition-all">
              Start New Ride
            </button>
            <p className="text-xs text-gray-500 text-center mt-4">Sync your Coros Dura data for complete analysis</p>
          </div>
        </div>
      </div>
    );
  }

  return null;
}

// Pulse animation
const style = document.createElement('style');
style.textContent = '@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }';
document.head.appendChild(style);

// Mount
const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(React.createElement(CyclingNutritionApp));
