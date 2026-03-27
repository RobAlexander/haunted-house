// ── Audio Engine ───────────────────────────────────────────────────────────
// All sound synthesized via Web Audio API — no audio files needed.
// Must call AudioEngine.init() on first user gesture (browser requirement).

const AudioEngine = (() => {
  let ctx        = null;
  let master     = null;
  let reverb     = null;
  let musicRunning  = false;
  let victoryMode   = false;

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
    bossMode     = false;
    victoryMode  = false;

    clearTimeout(melodyTimeout);
    melodyTimeout = null;

    try {
      drone1.stop(); drone2.stop(); lfo.stop();
    } catch (e) {}
    drone1 = drone2 = lfo = droneGain = droneFilter = lfoGain = null;
  }

  // Post-boss victory music: calmer, brighter, slightly upbeat
  function startVictoryMusic() {
    if (!ctx) return;
    stopMusic();
    musicRunning = true;
    victoryMode  = true;

    // Softer drone: triangle waves an octave up, open filter
    droneFilter = ctx.createBiquadFilter();
    droneFilter.type            = 'lowpass';
    droneFilter.frequency.value = 520;
    droneFilter.Q.value         = 0.7;

    droneGain = ctx.createGain();
    droneGain.gain.value = 0.05;

    drone1 = ctx.createOscillator();
    drone1.type            = 'triangle';
    drone1.frequency.value = 110;
    drone1.connect(droneFilter);

    drone2 = ctx.createOscillator();
    drone2.type            = 'triangle';
    drone2.frequency.value = 110.6;
    drone2.connect(droneFilter);

    droneFilter.connect(droneGain);
    droneGain.connect(reverb);
    droneGain.connect(master);

    drone1.start();
    drone2.start();

    // Lighter, faster LFO flutter (less oppressive than normal)
    lfoGain = ctx.createGain();
    lfoGain.gain.value = 0.022;

    lfo = ctx.createOscillator();
    lfo.type            = 'sine';
    lfo.frequency.value = 2.1;
    lfo.connect(lfoGain);
    lfoGain.connect(droneGain.gain);
    lfo.start();

    _scheduleMelodyNote();
  }

  function setBossMode(active) {
    if (!ctx || !lfo) return;
    bossMode = active;
    lfo.frequency.setTargetAtTime(active ? 2.4 : 1.2, ctx.currentTime, 0.5);
    droneFilter.frequency.setTargetAtTime(active ? 400 : 220, ctx.currentTime, 1.0);
  }

  // F# minor pentatonic (eerie — normal + boss)
  const PENTATONIC  = [185, 220, 247, 277, 370, 440, 494, 554];
  // C major pentatonic (bright — post-boss victory)
  const MAJOR_PENT  = [261, 329, 392, 440, 523, 659, 784];

  function _scheduleMelodyNote() {
    if (!musicRunning) return;
    const delay = victoryMode ? 900 + Math.random() * 2200 : 2000 + Math.random() * 6000;
    melodyTimeout = setTimeout(() => {
      if (!musicRunning) return;
      _playMelodyNote();
      _scheduleMelodyNote();
    }, delay);
  }

  function _playMelodyNote() {
    if (!ctx) return;
    const scale  = victoryMode ? MAJOR_PENT : PENTATONIC;
    const freq   = scale[Math.floor(Math.random() * scale.length)];
    const type   = Math.random() < 0.5 ? 'sine' : 'triangle';
    const now    = ctx.currentTime;
    const dur    = victoryMode ? 0.18 + Math.random() * 0.28 : 0.4 + Math.random() * 0.4;
    const vol    = victoryMode ? 0.09 : 0.06;

    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type            = type;
    osc.frequency.value = freq * (bossMode ? 0.5 : 1);
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(vol, now + 0.02);
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
      case 'ghost_lunge': _sfxGhostLunge(now); break;
      case 'ghoul_leap':  _sfxGhoulLeap(now);  break;
      case 'boss_enter':  _sfxBossEnter(now);  break;
      case 'boss_phase':  _sfxBossPhase(now);  break;
      case 'game_over':   _sfxGameOver(now);   break;
      case 'win':         _sfxWin(now);        break;
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
    const { src, gain } = _noise(0.07, C.SFX_VOL_SHOOT);
    const hp = ctx.createBiquadFilter();
    hp.type            = 'highpass';
    hp.frequency.value = 3000;
    gain.gain.setValueAtTime(C.SFX_VOL_SHOOT, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.07);
    gain.connect(hp);
    hp.connect(master);
    src.start(now);
    src.stop(now + 0.08);
  }

  // Sine frequency glide downward
  function _sfxHit(now) {
    // Layer 1: sawtooth sting — harsh buzzy frequency drop
    const osc   = ctx.createOscillator();
    const oGain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(420, now);
    osc.frequency.exponentialRampToValueAtTime(65, now + 0.09);
    oGain.gain.setValueAtTime(C.SFX_VOL_HIT, now);
    oGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);
    osc.connect(oGain); oGain.connect(master);
    osc.start(now); osc.stop(now + 0.13);

    // Layer 2: noise crack — short bandpass burst for impact thud
    const bufLen = Math.ceil(ctx.sampleRate * 0.09);
    const buf    = ctx.createBuffer(1, bufLen, ctx.sampleRate);
    const data   = buf.getChannelData(0);
    for (let i = 0; i < bufLen; i++) data[i] = Math.random() * 2 - 1;
    const noise   = ctx.createBufferSource();
    noise.buffer  = buf;
    const nFilt   = ctx.createBiquadFilter();
    nFilt.type    = 'bandpass';
    nFilt.frequency.value = 950;
    nFilt.Q.value = 1.8;
    const nGain   = ctx.createGain();
    nGain.gain.setValueAtTime(C.SFX_VOL_HIT * 0.96, now);
    nGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.07);
    noise.connect(nFilt); nFilt.connect(nGain); nGain.connect(master);
    noise.start(now); noise.stop(now + 0.09);
  }

  // Descending sine + noise burst
  function _sfxDeath(now) {
    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(220, now);
    osc.frequency.exponentialRampToValueAtTime(40, now + 0.4);
    gain.gain.setValueAtTime(C.SFX_VOL_DEATH, now);
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

  // Angry scheming sound — duration matches boss phase-transition glow
  function _sfxBossPhase(now) {
    const dur = C.BOSS_PHASE_TRANSITION_FRAMES / C.FPS;

    // Layer 1: Low growl that swells and breathes — filter sweeps open then closes
    {
      const osc = ctx.createOscillator();
      const flt = ctx.createBiquadFilter();
      const g   = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(52, now);
      osc.frequency.linearRampToValueAtTime(72, now + dur * 0.5);
      osc.frequency.linearRampToValueAtTime(58, now + dur);
      flt.type = 'lowpass';
      flt.frequency.setValueAtTime(160, now);
      flt.frequency.linearRampToValueAtTime(950, now + dur * 0.4);
      flt.frequency.exponentialRampToValueAtTime(200, now + dur);
      g.gain.setValueAtTime(0.001, now);
      g.gain.linearRampToValueAtTime(0.26, now + 0.35);
      g.gain.linearRampToValueAtTime(0.20, now + dur * 0.75);
      g.gain.exponentialRampToValueAtTime(0.001, now + dur);
      osc.connect(flt); flt.connect(g); g.connect(reverb);
      osc.start(now); osc.stop(now + dur + 0.1);
    }

    // Layer 2: Three slightly detuned sawtooth oscillators — beating creates
    // natural-feeling amplitude flutter, like a living thing
    [0, -16, 21].forEach(detune => {
      const osc = ctx.createOscillator();
      const g   = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(220, now);
      osc.frequency.linearRampToValueAtTime(196, now + dur);
      osc.detune.setValueAtTime(detune, now);
      g.gain.setValueAtTime(0.001, now);
      g.gain.linearRampToValueAtTime(0.065, now + 0.5);
      g.gain.linearRampToValueAtTime(0.065, now + dur * 0.65);
      g.gain.exponentialRampToValueAtTime(0.001, now + dur);
      osc.connect(g); g.connect(reverb);
      osc.start(now); osc.stop(now + dur + 0.1);
    });

    // Layer 3: Scheming irregular melodic motif — diminished seventh arpeggio
    // (B, D, F, Ab) in a purposefully uneven rhythm, like a sinister theme
    const motif = [
      { t: 0.04, f: 246.9, d: 0.10 },
      { t: 0.17, f: 293.7, d: 0.08 },
      { t: 0.27, f: 174.6, d: 0.17 },
      { t: 0.47, f: 246.9, d: 0.07 },
      { t: 0.57, f: 349.2, d: 0.07 },
      { t: 0.66, f: 293.7, d: 0.11 },
      { t: 0.80, f: 174.6, d: 0.20 },
      { t: 1.03, f: 207.7, d: 0.07 },
      { t: 1.13, f: 293.7, d: 0.06 },
      { t: 1.22, f: 415.3, d: 0.30 },
    ];
    motif.forEach(({ t, f, d }) => {
      if (t >= dur) return;
      const osc = ctx.createOscillator();
      const g   = ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(f, now + t);
      g.gain.setValueAtTime(0.075, now + t);
      g.gain.exponentialRampToValueAtTime(0.001, now + t + d);
      osc.connect(g); g.connect(master);
      osc.start(now + t); osc.stop(now + t + d + 0.02);
    });

    // Layer 4: High eerie tremolo — LFO vibrato that accelerates, growing urgency
    {
      const osc     = ctx.createOscillator();
      const lfo     = ctx.createOscillator();
      const lfoGain = ctx.createGain();
      const g       = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(880, now + 0.15);
      osc.frequency.linearRampToValueAtTime(740, now + dur);
      lfo.type = 'sine';
      lfo.frequency.setValueAtTime(5, now + 0.15);
      lfo.frequency.linearRampToValueAtTime(11, now + dur);  // speeds up
      lfoGain.gain.setValueAtTime(14, now + 0.15);
      lfo.connect(lfoGain);
      lfoGain.connect(osc.frequency);
      g.gain.setValueAtTime(0.001, now + 0.15);
      g.gain.linearRampToValueAtTime(0.05, now + 0.5);
      g.gain.linearRampToValueAtTime(0.05, now + dur * 0.8);
      g.gain.exponentialRampToValueAtTime(0.001, now + dur);
      osc.connect(g); g.connect(reverb);
      lfo.start(now + 0.15); lfo.stop(now + dur + 0.1);
      osc.start(now + 0.15); osc.stop(now + dur + 0.1);
    }
  }

  // Ghostly "hoooo" — smooth sine glide, breathy and eerie
  function _sfxGhostLunge(now) {
    // Core "hoo" tone: sine rises gently then settles, like an exhaled vowel
    const osc = ctx.createOscillator();
    const g   = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(200, now);
    osc.frequency.linearRampToValueAtTime(290, now + 0.25);
    osc.frequency.linearRampToValueAtTime(230, now + 0.65);
    const v = C.SFX_VOL_GHOST_LUNGE;
    g.gain.setValueAtTime(0.001, now);
    g.gain.linearRampToValueAtTime(0.20 * v, now + 0.18);
    g.gain.linearRampToValueAtTime(0.15 * v, now + 0.45);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.75);
    osc.connect(g); g.connect(reverb);
    osc.start(now); osc.stop(now + 0.8);

    // Breathy noise layer — bandpass filtered around the same pitch region
    const bufLen = Math.ceil(ctx.sampleRate * 0.65);
    const buf    = ctx.createBuffer(1, bufLen, ctx.sampleRate);
    const data   = buf.getChannelData(0);
    for (let i = 0; i < bufLen; i++) data[i] = Math.random() * 2 - 1;
    const noise = ctx.createBufferSource();
    noise.buffer = buf;
    const flt = ctx.createBiquadFilter();
    flt.type = 'bandpass';
    flt.frequency.setValueAtTime(260, now);
    flt.Q.value = 1.2;
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(0.001, now);
    ng.gain.linearRampToValueAtTime(0.08 * v, now + 0.2);
    ng.gain.exponentialRampToValueAtTime(0.001, now + 0.65);
    noise.connect(flt); flt.connect(ng); ng.connect(reverb);
    noise.start(now); noise.stop(now + 0.7);

    // Faint upper harmonic — adds a ghostly "hollow" quality
    const osc2 = ctx.createOscillator();
    const g2   = ctx.createGain();
    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(580, now + 0.05);
    osc2.frequency.linearRampToValueAtTime(460, now + 0.6);
    g2.gain.setValueAtTime(0.001, now + 0.05);
    g2.gain.linearRampToValueAtTime(0.04 * v, now + 0.25);
    g2.gain.exponentialRampToValueAtTime(0.001, now + 0.65);
    osc2.connect(g2); g2.connect(reverb);
    osc2.start(now + 0.05); osc2.stop(now + 0.7);
  }

  // Weird squealing leap — rapid pitch slide with tremolo flutter
  function _sfxGhoulLeap(now) {
    // Main squeal: sawtooth rockets up then drops, like a panicked animal
    const osc = ctx.createOscillator();
    const g   = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(380, now);
    osc.frequency.linearRampToValueAtTime(1050, now + 0.10);
    osc.frequency.exponentialRampToValueAtTime(520, now + 0.38);
    g.gain.setValueAtTime(0.001, now);
    g.gain.linearRampToValueAtTime(0.16, now + 0.05);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.42);
    osc.connect(g); g.connect(master);
    osc.start(now); osc.stop(now + 0.45);

    // Tremolo layer: rapid LFO amplitude flutter adds "weird" organic quality
    const osc2  = ctx.createOscillator();
    const lfo   = ctx.createOscillator();
    const lfoG  = ctx.createGain();
    const g2    = ctx.createGain();
    osc2.type = 'square';
    osc2.frequency.setValueAtTime(700, now + 0.03);
    osc2.frequency.linearRampToValueAtTime(1300, now + 0.15);
    lfo.type = 'sine';
    lfo.frequency.setValueAtTime(32, now);
    lfoG.gain.setValueAtTime(0.07, now);
    lfo.connect(lfoG); lfoG.connect(g2.gain);
    g2.gain.setValueAtTime(0.001, now + 0.03);
    g2.gain.linearRampToValueAtTime(0.10, now + 0.10);
    g2.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
    osc2.connect(g2); g2.connect(reverb);
    lfo.start(now); lfo.stop(now + 0.4);
    osc2.start(now + 0.03); osc2.stop(now + 0.4);
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

  return { init, startMusic, stopMusic, startVictoryMusic, setBossMode, playSFX };
})();
