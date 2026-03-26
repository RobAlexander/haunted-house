// ── Audio Engine ───────────────────────────────────────────────────────────
// All sound synthesized via Web Audio API — no audio files needed.
// Must call AudioEngine.init() on first user gesture (browser requirement).

const AudioEngine = (() => {
  let ctx        = null;
  let master     = null;
  let reverb     = null;
  let musicRunning = false;

  // Music nodes
  let drone1     = null;
  let drone2     = null;
  let droneGain  = null;
  let droneFilter = null;
  let lfo        = null;
  let lfoGain    = null;
  let melodyTimeout = null;
  let bossMode   = false;

  // ── Init ────────────────────────────────────────────────────────────────

  function init() {
    if (ctx) return;
    ctx    = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain();
    master.gain.value = 0.7;
    master.connect(ctx.destination);

    reverb = _makeReverb(3.0, 2.5);
    reverb.connect(master);
  }

  function _makeReverb(duration, decay) {
    const conv   = ctx.createConvolver();
    const rate   = ctx.sampleRate;
    const len    = rate * duration;
    const buf    = ctx.createBuffer(2, len, rate);
    for (let ch = 0; ch < 2; ch++) {
      const data = buf.getChannelData(ch);
      for (let i = 0; i < len; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
      }
    }
    conv.buffer = buf;
    return conv;
  }

  // ── Music ────────────────────────────────────────────────────────────────

  function startMusic() {
    if (!ctx || musicRunning) return;
    musicRunning = true;

    // Drone: two detuned sawtooth oscillators
    droneFilter = ctx.createBiquadFilter();
    droneFilter.type            = 'lowpass';
    droneFilter.frequency.value = 220;
    droneFilter.Q.value         = 1.2;

    droneGain = ctx.createGain();
    droneGain.gain.value = 0.08;

    drone1 = ctx.createOscillator();
    drone1.type            = 'sawtooth';
    drone1.frequency.value = 55;
    drone1.connect(droneFilter);

    drone2 = ctx.createOscillator();
    drone2.type            = 'sawtooth';
    drone2.frequency.value = 55.5;
    drone2.connect(droneFilter);

    droneFilter.connect(droneGain);
    droneGain.connect(reverb);
    droneGain.connect(master);

    drone1.start();
    drone2.start();

    // LFO — slowly modulates drone gain (heartbeat)
    lfoGain = ctx.createGain();
    lfoGain.gain.value = 0.04;

    lfo = ctx.createOscillator();
    lfo.type            = 'sine';
    lfo.frequency.value = 1.2;
    lfo.connect(lfoGain);
    lfoGain.connect(droneGain.gain);
    lfo.start();

    // Random pentatonic melody
    _scheduleMelodyNote();
  }

  function stopMusic() {
    if (!musicRunning) return;
    musicRunning = false;

    clearTimeout(melodyTimeout);
    melodyTimeout = null;

    try {
      drone1.stop(); drone2.stop(); lfo.stop();
    } catch (e) {}
    drone1 = drone2 = lfo = droneGain = droneFilter = lfoGain = null;
  }

  function setBossMode(active) {
    if (!ctx || !lfo) return;
    bossMode = active;
    lfo.frequency.setTargetAtTime(active ? 2.4 : 1.2, ctx.currentTime, 0.5);
    droneFilter.frequency.setTargetAtTime(active ? 400 : 220, ctx.currentTime, 1.0);
  }

  // F# minor pentatonic (eerie)
  const PENTATONIC = [185, 220, 247, 277, 370, 440, 494, 554];

  function _scheduleMelodyNote() {
    if (!musicRunning) return;
    const delay = 2000 + Math.random() * 6000;
    melodyTimeout = setTimeout(() => {
      if (!musicRunning) return;
      _playMelodyNote();
      _scheduleMelodyNote();
    }, delay);
  }

  function _playMelodyNote() {
    if (!ctx) return;
    const freq   = PENTATONIC[Math.floor(Math.random() * PENTATONIC.length)];
    const type   = Math.random() < 0.5 ? 'sine' : 'triangle';
    const now    = ctx.currentTime;
    const dur    = 0.4 + Math.random() * 0.4;

    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type            = type;
    osc.frequency.value = freq * (bossMode ? 0.5 : 1);
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.06, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + dur);

    osc.connect(gain);
    gain.connect(reverb);
    osc.start(now);
    osc.stop(now + dur + 0.05);
  }

  // ── SFX ─────────────────────────────────────────────────────────────────

  function playSFX(name) {
    if (!ctx) return;
    const now = ctx.currentTime;
    switch (name) {
      case 'shoot':      _sfxShoot(now);     break;
      case 'hit':        _sfxHit(now);       break;
      case 'death':      _sfxDeath(now);     break;
      case 'room_enter': _sfxRoomEnter(now); break;
      case 'pickup':     _sfxPickup(now);    break;
      case 'boss_enter': _sfxBossEnter(now); break;
      case 'game_over':  _sfxGameOver(now);  break;
      case 'win':        _sfxWin(now);       break;
    }
  }

  function _noise(dur, gain_val) {
    const len  = Math.ceil(ctx.sampleRate * dur);
    const buf  = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const g = ctx.createGain();
    g.gain.value = gain_val;
    src.connect(g);
    return { src, gain: g };
  }

  // Short crisp noise burst (highpass filtered)
  function _sfxShoot(now) {
    const { src, gain } = _noise(0.07, 0.15);
    const hp = ctx.createBiquadFilter();
    hp.type            = 'highpass';
    hp.frequency.value = 3000;
    gain.gain.setValueAtTime(0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.07);
    src.connect(hp);
    hp.connect(master);
    src.start(now);
    src.stop(now + 0.08);
  }

  // Sine frequency glide downward
  function _sfxHit(now) {
    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(160, now);
    osc.frequency.exponentialRampToValueAtTime(60, now + 0.12);
    gain.gain.setValueAtTime(0.55, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.15);
    osc.connect(gain);
    gain.connect(master);
    osc.start(now);
    osc.stop(now + 0.16);
  }

  // Descending sine + noise burst
  function _sfxDeath(now) {
    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(220, now);
    osc.frequency.exponentialRampToValueAtTime(40, now + 0.4);
    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.4);
    osc.connect(gain);
    gain.connect(reverb);
    osc.start(now);
    osc.stop(now + 0.45);

    const { src, gain: ng } = _noise(0.2, 0.1);
    ng.gain.exponentialRampToValueAtTime(0.0001, now + 0.2);
    ng.connect(reverb);
    src.start(now);
    src.stop(now + 0.22);
  }

  // Soft fade-in sine (entering a room)
  function _sfxRoomEnter(now) {
    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type            = 'sine';
    osc.frequency.value = 330;
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.12, now + 0.08);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.35);
    osc.connect(gain);
    gain.connect(reverb);
    osc.start(now);
    osc.stop(now + 0.4);
  }

  // Ascending arpeggio — three quick notes
  function _sfxPickup(now) {
    const notes = [440, 554, 659];
    notes.forEach((freq, i) => {
      const t    = now + i * 0.06;
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type            = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.18, t);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
      osc.connect(gain);
      gain.connect(master);
      osc.start(t);
      osc.stop(t + 0.14);
    });
  }

  // Ominous swell — sawtooth rumble + high screech
  function _sfxBossEnter(now) {
    // Low rumble
    const low  = ctx.createOscillator();
    const lg   = ctx.createGain();
    low.type = 'sawtooth';
    low.frequency.setValueAtTime(40, now);
    low.frequency.linearRampToValueAtTime(55, now + 1.5);
    lg.gain.setValueAtTime(0, now);
    lg.gain.linearRampToValueAtTime(0.2, now + 0.4);
    lg.gain.exponentialRampToValueAtTime(0.0001, now + 2.0);
    low.connect(lg);
    lg.connect(reverb);
    low.start(now);
    low.stop(now + 2.1);

    // High screech
    const hi  = ctx.createOscillator();
    const hg  = ctx.createGain();
    hi.type = 'sawtooth';
    hi.frequency.setValueAtTime(880, now + 0.3);
    hi.frequency.exponentialRampToValueAtTime(220, now + 1.8);
    hg.gain.setValueAtTime(0, now + 0.3);
    hg.gain.linearRampToValueAtTime(0.08, now + 0.5);
    hg.gain.exponentialRampToValueAtTime(0.0001, now + 1.8);
    hi.connect(hg);
    hg.connect(reverb);
    hi.start(now + 0.3);
    hi.stop(now + 1.9);
  }

  // Slow descending minor chord
  function _sfxGameOver(now) {
    const minor = [220, 261, 311];
    minor.forEach((freq, i) => {
      const t    = now + i * 0.15;
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type            = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.15, t);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 2.5);
      osc.connect(gain);
      gain.connect(reverb);
      osc.start(t);
      osc.stop(t + 2.6);
    });
  }

  // Ascending major arpeggio + shimmer
  function _sfxWin(now) {
    const major = [261, 329, 392, 523, 659, 784];
    major.forEach((freq, i) => {
      const t    = now + i * 0.18;
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type            = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.18, t);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.8);
      osc.connect(gain);
      gain.connect(reverb);
      osc.start(t);
      osc.stop(t + 0.85);
    });

    // Shimmer — high sine sweep
    const shimmer  = ctx.createOscillator();
    const sg       = ctx.createGain();
    shimmer.type = 'sine';
    shimmer.frequency.setValueAtTime(1200, now + 0.5);
    shimmer.frequency.linearRampToValueAtTime(2400, now + 3.0);
    sg.gain.setValueAtTime(0, now + 0.5);
    sg.gain.linearRampToValueAtTime(0.06, now + 1.0);
    sg.gain.exponentialRampToValueAtTime(0.0001, now + 3.5);
    shimmer.connect(sg);
    sg.connect(reverb);
    shimmer.start(now + 0.5);
    shimmer.stop(now + 3.6);
  }

  // ── Public API ───────────────────────────────────────────────────────────

  return { init, startMusic, stopMusic, setBossMode, playSFX };
})();
