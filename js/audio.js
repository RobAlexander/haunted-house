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
  let bossMode      = false;
  let mummyBossMode = false;

  // ── Init ────────────────────────────────────────────────────────────────

  function init() {
    if (ctx) return;
    ctx    = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain();
    master.gain.value = 0.7;
    master.connect(ctx.destination);

    reverb = _makeReverb(3.0, 2.5);
    reverb.connect(master);

    // Resume AudioContext if the browser suspends it (e.g. tab backgrounded)
    ctx.onstatechange = () => {
      if (ctx.state === 'suspended') ctx.resume();
    };
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
    musicRunning  = false;
    bossMode      = false;
    mummyBossMode = false;
    victoryMode   = false;

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

  function setBossMode(active, isMummy) {
    if (!ctx || !lfo) return;
    bossMode      = active;
    mummyBossMode = active && !!isMummy;
    if (active && isMummy) {
      // Mummy boss: very deep, slow drone — tomb-like
      lfo.frequency.setTargetAtTime(0.55, ctx.currentTime, 0.8);
      droneFilter.frequency.setTargetAtTime(110, ctx.currentTime, 1.5);
      drone1.frequency.setTargetAtTime(40,   ctx.currentTime, 2.0);
      drone2.frequency.setTargetAtTime(40.4, ctx.currentTime, 2.0);
    } else if (active) {
      // Skull boss: faster LFO, brighter filter
      lfo.frequency.setTargetAtTime(2.4, ctx.currentTime, 0.5);
      droneFilter.frequency.setTargetAtTime(400, ctx.currentTime, 1.0);
      drone1.frequency.setTargetAtTime(55,   ctx.currentTime, 1.0);
      drone2.frequency.setTargetAtTime(55.5, ctx.currentTime, 1.0);
    } else {
      // Normal: restore defaults
      lfo.frequency.setTargetAtTime(1.2, ctx.currentTime, 0.5);
      droneFilter.frequency.setTargetAtTime(220, ctx.currentTime, 1.0);
      drone1.frequency.setTargetAtTime(55,   ctx.currentTime, 1.0);
      drone2.frequency.setTargetAtTime(55.5, ctx.currentTime, 1.0);
    }
  }

  // F# minor pentatonic (eerie — normal + skull boss)
  const PENTATONIC  = [185, 220, 247, 277, 370, 440, 494, 554];
  // C major pentatonic (bright — post-boss victory)
  const MAJOR_PENT  = [261, 329, 392, 440, 523, 659, 784];
  // D diminished / chromatic (dark, dissonant — mummy boss)
  const MUMMY_SCALE = [146, 155, 174, 196, 207, 233, 277, 311];

  function _scheduleMelodyNote() {
    if (!musicRunning) return;
    const delay = victoryMode    ? 900  + Math.random() * 2200
                : mummyBossMode  ? 3500 + Math.random() * 8000
                :                  2000 + Math.random() * 6000;
    melodyTimeout = setTimeout(() => {
      if (!musicRunning) return;
      _playMelodyNote();
      _scheduleMelodyNote();
    }, delay);
  }

  function _playMelodyNote() {
    if (!ctx) return;
    const scale  = victoryMode   ? MAJOR_PENT
                 : mummyBossMode ? MUMMY_SCALE
                 :                 PENTATONIC;
    const freq   = scale[Math.floor(Math.random() * scale.length)];
    const type   = mummyBossMode ? 'sawtooth' : Math.random() < 0.5 ? 'sine' : 'triangle';
    const now    = ctx.currentTime;
    const dur    = victoryMode    ? 0.18 + Math.random() * 0.28
                 : mummyBossMode  ? 0.8  + Math.random() * 1.2
                 :                  0.4  + Math.random() * 0.4;
    const vol    = victoryMode ? 0.09 : mummyBossMode ? 0.045 : 0.06;

    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type            = type;
    // Skull boss: half-pitch; mummy boss: quarter-pitch (very low, ominous)
    osc.frequency.value = freq * (mummyBossMode ? 0.25 : bossMode ? 0.5 : 1);
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
      case 'shoot':       _sfxShoot(now);      break;
      case 'power_shoot': _sfxPowerShoot(now); break;
      case 'hit':        _sfxHit(now);       break;
      case 'death':      _sfxDeath(now);     break;
      case 'room_enter': _sfxRoomEnter(now); break;
      case 'pickup':     _sfxPickup(now);    break;
      case 'ghost_lunge': _sfxGhostLunge(now); break;
      case 'ghoul_leap':       _sfxGhoulLeap(now);      break;
      case 'long_ghoul_leap':  _sfxLongGhoulLeap(now);  break;
      case 'ghoul_boss_leap':  _sfxGhoulBossLeap(now);  break;
      case 'mummy_awaken':     _sfxMummyAwaken(now);    break;
      case 'mummy_flies':      _sfxMummyFlies(now);     break;
      case 'skull_boss_arrive':  _sfxSkullBossArrive(now);  break;
      case 'ghoul_boss_land':    _sfxGhoulBossLand(now);   break;
      case 'ashtaroth_lump':     _sfxAshtarothLump(now);   break;
      case 'ashtaroth_barrage':  _sfxAshtarothBarrage(now); break;
      case 'boss_enter':  _sfxBossEnter(now);  break;
      case 'boss_phase':  _sfxBossPhase(now);  break;
      case 'game_over':   _sfxGameOver(now);   break;
      case 'maxhp_fanfare':   _sfxMaxhpFanfare(now);   break;
      case 'win':             _sfxWin(now);            break;
      case 'symbol_pickup':       _sfxSymbolPickup(now);      break;
      case 'final_symbol':        _sfxFinalSymbol(now);       break;
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

  // Deep bassy noise burst + sub-bass thud for power shots
  function _sfxPowerShoot(now) {
    // Lowpass noise — thick, not crispy
    const { src, gain } = _noise(0.14, C.SFX_VOL_SHOOT * 3.5);
    const lp = ctx.createBiquadFilter();
    lp.type            = 'lowpass';
    lp.frequency.value = 900;
    lp.Q.value         = 1.4;
    gain.gain.setValueAtTime(C.SFX_VOL_SHOOT * 3.5, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.14);
    gain.connect(lp);
    lp.connect(master);
    src.start(now);
    src.stop(now + 0.15);

    // Sub-bass sine thud — descending punch
    const osc = ctx.createOscillator();
    const og  = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(140, now);
    osc.frequency.exponentialRampToValueAtTime(45, now + 0.20);
    og.gain.setValueAtTime(0.20, now);
    og.gain.exponentialRampToValueAtTime(0.0001, now + 0.20);
    osc.connect(og);
    og.connect(master);
    osc.start(now);
    osc.stop(now + 0.22);
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

  function _sfxLongGhoulLeap(now) {
    // Main squeal: higher and more shrill than regular ghoul — starts sharp, rockets higher, drops nastily
    const osc = ctx.createOscillator();
    const g   = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(600, now);
    osc.frequency.linearRampToValueAtTime(1750, now + 0.08);
    osc.frequency.exponentialRampToValueAtTime(850, now + 0.35);
    g.gain.setValueAtTime(0.001, now);
    g.gain.linearRampToValueAtTime(0.18, now + 0.04);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.38);
    osc.connect(g); g.connect(master);
    osc.start(now); osc.stop(now + 0.40);

    // Rapid tremolo layer: faster LFO and higher frequency range than ghoul
    const osc2  = ctx.createOscillator();
    const lfo   = ctx.createOscillator();
    const lfoG  = ctx.createGain();
    const g2    = ctx.createGain();
    osc2.type = 'square';
    osc2.frequency.setValueAtTime(1100, now + 0.02);
    osc2.frequency.linearRampToValueAtTime(2100, now + 0.12);
    lfo.type = 'sine';
    lfo.frequency.setValueAtTime(55, now);
    lfoG.gain.setValueAtTime(0.09, now);
    lfo.connect(lfoG); lfoG.connect(g2.gain);
    g2.gain.setValueAtTime(0.001, now + 0.02);
    g2.gain.linearRampToValueAtTime(0.12, now + 0.08);
    g2.gain.exponentialRampToValueAtTime(0.001, now + 0.30);
    osc2.connect(g2); g2.connect(reverb);
    lfo.start(now); lfo.stop(now + 0.35);
    osc2.start(now + 0.02); osc2.stop(now + 0.35);

    // Piercing high screech — extra nastiness layer
    const osc3 = ctx.createOscillator();
    const g3   = ctx.createGain();
    osc3.type = 'sawtooth';
    osc3.frequency.setValueAtTime(2400, now);
    osc3.frequency.linearRampToValueAtTime(3200, now + 0.05);
    osc3.frequency.exponentialRampToValueAtTime(1800, now + 0.25);
    g3.gain.setValueAtTime(0.001, now);
    g3.gain.linearRampToValueAtTime(0.06, now + 0.03);
    g3.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
    osc3.connect(g3); g3.connect(master);
    osc3.start(now); osc3.stop(now + 0.30);
  }

  function _sfxGhoulBossLeap(now) {
    // Deep bass version of long_ghoul_leap — all frequencies ~¼, heavier body
    const osc = ctx.createOscillator();
    const g   = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(150, now);
    osc.frequency.linearRampToValueAtTime(440, now + 0.10);
    osc.frequency.exponentialRampToValueAtTime(210, now + 0.40);
    g.gain.setValueAtTime(0.001, now);
    g.gain.linearRampToValueAtTime(0.28, now + 0.05);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
    osc.connect(g); g.connect(reverb); g.connect(master);
    osc.start(now); osc.stop(now + 0.50);

    // Slow tremolo layer — square wave at low frequencies
    const osc2 = ctx.createOscillator();
    const lfo  = ctx.createOscillator();
    const lfoG = ctx.createGain();
    const g2   = ctx.createGain();
    osc2.type = 'square';
    osc2.frequency.setValueAtTime(275, now + 0.02);
    osc2.frequency.linearRampToValueAtTime(525, now + 0.14);
    lfo.type = 'sine';
    lfo.frequency.setValueAtTime(14, now);
    lfoG.gain.setValueAtTime(0.09, now);
    lfo.connect(lfoG); lfoG.connect(g2.gain);
    g2.gain.setValueAtTime(0.001, now + 0.02);
    g2.gain.linearRampToValueAtTime(0.18, now + 0.10);
    g2.gain.exponentialRampToValueAtTime(0.001, now + 0.38);
    osc2.connect(g2); g2.connect(reverb);
    lfo.start(now); lfo.stop(now + 0.45);
    osc2.start(now + 0.02); osc2.stop(now + 0.45);

    // Sub-bass thud — sine body impact
    const osc3 = ctx.createOscillator();
    const g3   = ctx.createGain();
    osc3.type = 'sine';
    osc3.frequency.setValueAtTime(80, now);
    osc3.frequency.exponentialRampToValueAtTime(35, now + 0.25);
    g3.gain.setValueAtTime(0.001, now);
    g3.gain.linearRampToValueAtTime(0.35, now + 0.02);
    g3.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
    osc3.connect(g3); g3.connect(master);
    osc3.start(now); osc3.stop(now + 0.30);
  }

  function _sfxSkullBossArrive(now) {
    // 3-second ominous coalescing sound: low rising drone + eerie spinning high tone + crash
    // Low drone — sub-bass sawtooth swelling upward
    const osc1 = ctx.createOscillator();
    const g1   = ctx.createGain();
    osc1.type = 'sawtooth';
    osc1.frequency.setValueAtTime(38, now);
    osc1.frequency.linearRampToValueAtTime(72, now + 2.6);
    g1.gain.setValueAtTime(0.001, now);
    g1.gain.linearRampToValueAtTime(0.16, now + 1.2);
    g1.gain.exponentialRampToValueAtTime(0.001, now + 3.1);
    osc1.connect(g1); g1.connect(reverb);
    osc1.start(now); osc1.stop(now + 3.2);

    // Eerie spinning tone — square wave tremolo that slows as it materialises
    const osc2 = ctx.createOscillator();
    const lfo2 = ctx.createOscillator();
    const lfoG = ctx.createGain();
    const g2   = ctx.createGain();
    osc2.type = 'square';
    osc2.frequency.setValueAtTime(220, now);
    osc2.frequency.linearRampToValueAtTime(440, now + 2.8);
    lfo2.type = 'sine';
    lfo2.frequency.setValueAtTime(9, now);
    lfo2.frequency.linearRampToValueAtTime(2, now + 2.8);  // slows as it lands
    lfoG.gain.setValueAtTime(0.07, now);
    lfo2.connect(lfoG); lfoG.connect(g2.gain);
    g2.gain.setValueAtTime(0.001, now);
    g2.gain.linearRampToValueAtTime(0.09, now + 0.6);
    g2.gain.linearRampToValueAtTime(0.13, now + 2.2);
    g2.gain.exponentialRampToValueAtTime(0.001, now + 3.1);
    osc2.connect(g2); g2.connect(reverb);
    lfo2.start(now); lfo2.stop(now + 3.1);
    osc2.start(now); osc2.stop(now + 3.1);

    // Final crash at end — sharp sawtooth impact + sub thud
    const osc3 = ctx.createOscillator();
    const g3   = ctx.createGain();
    osc3.type = 'sawtooth';
    osc3.frequency.setValueAtTime(110, now + 2.85);
    osc3.frequency.exponentialRampToValueAtTime(28, now + 3.6);
    g3.gain.setValueAtTime(0.001, now + 2.85);
    g3.gain.linearRampToValueAtTime(0.32, now + 2.90);
    g3.gain.exponentialRampToValueAtTime(0.001, now + 3.6);
    osc3.connect(g3); g3.connect(reverb); g3.connect(master);
    osc3.start(now + 2.85); osc3.stop(now + 3.65);
  }

  function _sfxGhoulBossLand(now) {
    // Massive floor-impact thud when Philip lands — very fast attack, deep sub-bass
    // Primary sub-bass thud
    const osc1 = ctx.createOscillator();
    const g1   = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(65, now);
    osc1.frequency.exponentialRampToValueAtTime(18, now + 0.55);
    g1.gain.setValueAtTime(0.001, now);
    g1.gain.linearRampToValueAtTime(0.60, now + 0.012);  // very fast attack
    g1.gain.exponentialRampToValueAtTime(0.001, now + 0.55);
    osc1.connect(g1); g1.connect(master);
    osc1.start(now); osc1.stop(now + 0.60);

    // Body impact — sawtooth crunch
    const osc2 = ctx.createOscillator();
    const g2   = ctx.createGain();
    osc2.type = 'sawtooth';
    osc2.frequency.setValueAtTime(90, now);
    osc2.frequency.exponentialRampToValueAtTime(28, now + 0.40);
    g2.gain.setValueAtTime(0.001, now);
    g2.gain.linearRampToValueAtTime(0.38, now + 0.018);
    g2.gain.exponentialRampToValueAtTime(0.001, now + 0.42);
    osc2.connect(g2); g2.connect(reverb); g2.connect(master);
    osc2.start(now); osc2.stop(now + 0.48);

    // Floor rumble — low-pass noise burst
    const { src, gain } = _noise(0.7, 0.28);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 280;
    gain.gain.setValueAtTime(0.28, now);
    gain.gain.linearRampToValueAtTime(0.28, now + 0.04);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.65);
    gain.connect(lp); lp.connect(master);
    src.start(now); src.stop(now + 0.72);
  }

  function _sfxAshtarothLump(now) {
    // Wet meaty thud — lowpass noise burst + short sine thud
    const { src, gain } = _noise(0.18, 0.30);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 420; lp.Q.value = 1.5;
    gain.gain.setValueAtTime(0.30, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
    gain.connect(lp); lp.connect(reverb); lp.connect(master);
    src.start(now); src.stop(now + 0.20);

    const osc = ctx.createOscillator();
    const g   = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(110, now);
    osc.frequency.exponentialRampToValueAtTime(55, now + 0.14);
    g.gain.setValueAtTime(0.001, now);
    g.gain.linearRampToValueAtTime(0.22, now + 0.012);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
    osc.connect(g); g.connect(master);
    osc.start(now); osc.stop(now + 0.20);
  }

  function _sfxAshtarothBarrage(now) {
    // Rapid wet splat burst — staggered noise pops
    for (let i = 0; i < 4; i++) {
      const t = now + i * 0.045;
      const { src, gain } = _noise(0.09, 0.18);
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass'; bp.frequency.value = 600 + i * 120; bp.Q.value = 2.0;
      gain.gain.setValueAtTime(0.18, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.09);
      gain.connect(bp); bp.connect(master);
      src.start(t); src.stop(t + 0.10);
    }
    // Low sub-thud underneath
    const osc = ctx.createOscillator();
    const g   = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(80, now);
    osc.frequency.exponentialRampToValueAtTime(30, now + 0.22);
    g.gain.setValueAtTime(0.001, now);
    g.gain.linearRampToValueAtTime(0.20, now + 0.015);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
    osc.connect(g); g.connect(reverb);
    osc.start(now); osc.stop(now + 0.28);
  }

  function _sfxMummyAwaken(now) {
    // Deep, tomb-resonant groan as the mummy fully rises — low sawtooth rumble + pitched shriek
    const osc = ctx.createOscillator();
    const g   = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(55, now);
    osc.frequency.linearRampToValueAtTime(90, now + 0.5);
    osc.frequency.exponentialRampToValueAtTime(45, now + 1.8);
    g.gain.setValueAtTime(0.001, now);
    g.gain.linearRampToValueAtTime(0.22, now + 0.2);
    g.gain.exponentialRampToValueAtTime(0.001, now + 2.0);
    osc.connect(g); g.connect(reverb);
    osc.start(now); osc.stop(now + 2.1);

    // Mid harmonic layer — old dry cloth / creak
    const osc2 = ctx.createOscillator();
    const g2   = ctx.createGain();
    osc2.type = 'square';
    osc2.frequency.setValueAtTime(220, now + 0.3);
    osc2.frequency.linearRampToValueAtTime(180, now + 1.2);
    g2.gain.setValueAtTime(0.001, now + 0.3);
    g2.gain.linearRampToValueAtTime(0.08, now + 0.5);
    g2.gain.exponentialRampToValueAtTime(0.001, now + 1.4);
    osc2.connect(g2); g2.connect(reverb);
    osc2.start(now + 0.3); osc2.stop(now + 1.5);
  }

  function _sfxMummyFlies(now) {
    // Wet, fluttery release — brief burst of noise + buzzy rattle
    const bufSize = ctx.sampleRate * 0.18;
    const buf     = ctx.createBuffer(1, bufSize, ctx.sampleRate);
    const data    = buf.getChannelData(0);
    for (let i = 0; i < bufSize; i++) data[i] = (Math.random() * 2 - 1);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const bpf = ctx.createBiquadFilter();
    bpf.type = 'bandpass'; bpf.frequency.value = 800; bpf.Q.value = 0.8;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.001, now);
    g.gain.linearRampToValueAtTime(0.12, now + 0.03);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
    src.connect(bpf); bpf.connect(g); g.connect(master);
    src.start(now); src.stop(now + 0.25);

    // Short low buzz accent
    const osc = ctx.createOscillator();
    const g2  = ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(160, now);
    osc.frequency.linearRampToValueAtTime(120, now + 0.15);
    g2.gain.setValueAtTime(0.001, now);
    g2.gain.linearRampToValueAtTime(0.09, now + 0.04);
    g2.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
    osc.connect(g2); g2.connect(reverb);
    osc.start(now); osc.stop(now + 0.20);
  }

  // Called directly (not via playSFX) with per-fly random frequency
  function playFlyBuzz(freq) {
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const lfoO = ctx.createOscillator();
    const lfoG = ctx.createGain();
    const g    = ctx.createGain();
    osc.type  = 'square';
    osc.frequency.value = freq;
    // Fast AM flutter — insect wing beat
    lfoO.type = 'sine';
    lfoO.frequency.value = 38 + Math.random() * 22;
    lfoG.gain.value = freq * 0.35;
    lfoO.connect(lfoG); lfoG.connect(osc.frequency);
    g.gain.setValueAtTime(0.001, now);
    g.gain.linearRampToValueAtTime(0.04, now + 0.02);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
    osc.connect(g); g.connect(reverb);
    lfoO.start(now); lfoO.stop(now + 0.25);
    osc.start(now);  osc.stop(now + 0.25);
  }

  // Slow descending minor chord
  function _sfxGameOver(now) {
    // Synth strangulation: vocal-like sawtooth choked off, blood-gargle noise bursts,
    // megaphone bandpass + hard clipper, detuned bee-swarm AM buzz, sub-bass death thud.

    // ── Megaphone chain: bandpass ~1800 Hz + hard waveshaper clip ──────────
    const megaBP = ctx.createBiquadFilter();
    megaBP.type = 'bandpass';
    megaBP.frequency.value = 1800;
    megaBP.Q.value = 2.2;
    const clipper = ctx.createWaveShaper();
    const cc = new Float32Array(256);
    for (let i = 0; i < 256; i++) {
      const x = (i * 2) / 256 - 1;
      cc[i] = (Math.PI + 120) * x / (Math.PI + 120 * Math.abs(x));
    }
    clipper.curve = cc;
    megaBP.connect(clipper);
    clipper.connect(master);
    clipper.connect(reverb);

    // ── Layer 1: The strangle — sawtooth vocal, pitch rises then collapses ──
    const vocal  = ctx.createOscillator();
    const vGain  = ctx.createGain();
    const vLFO   = ctx.createOscillator();
    const vLFOG  = ctx.createGain();
    vocal.type = 'sawtooth';
    vocal.frequency.setValueAtTime(155, now);
    vocal.frequency.linearRampToValueAtTime(235, now + 0.28);   // constriction jacks pitch up
    vocal.frequency.linearRampToValueAtTime(185, now + 0.65);
    vocal.frequency.exponentialRampToValueAtTime(90,  now + 1.4);
    vocal.frequency.exponentialRampToValueAtTime(42,  now + 2.0);
    // Choking tremor — speeds up as they go
    vLFO.type = 'sine';
    vLFO.frequency.setValueAtTime(9,  now);
    vLFO.frequency.linearRampToValueAtTime(16, now + 1.0);
    vLFOG.gain.setValueAtTime(20, now);
    vLFOG.gain.linearRampToValueAtTime(32, now + 0.9);
    vLFO.connect(vLFOG); vLFOG.connect(vocal.frequency);
    // Sputtering gain envelope
    vGain.gain.setValueAtTime(0.001, now);
    vGain.gain.linearRampToValueAtTime(0.42, now + 0.07);
    vGain.gain.linearRampToValueAtTime(0.22, now + 0.28);  // first choke
    vGain.gain.linearRampToValueAtTime(0.40, now + 0.42);  // gasp
    vGain.gain.linearRampToValueAtTime(0.16, now + 0.68);  // weakening
    vGain.gain.linearRampToValueAtTime(0.32, now + 0.88);  // last effort
    vGain.gain.exponentialRampToValueAtTime(0.001, now + 1.85);
    vocal.connect(vGain);
    vGain.connect(megaBP);
    vGain.connect(reverb);
    vLFO.start(now); vLFO.stop(now + 2.1);
    vocal.start(now); vocal.stop(now + 2.1);

    // ── Layer 2: Blood gargle — noise bursts through wobbling bandpass ───────
    const gurgleDef = [
      { t: 0.06, dur: 0.18, freq: 640, q: 0.9 },
      { t: 0.33, dur: 0.22, freq: 410, q: 1.1 },
      { t: 0.56, dur: 0.15, freq: 720, q: 0.8 },
      { t: 0.80, dur: 0.24, freq: 370, q: 1.3 },
      { t: 1.08, dur: 0.20, freq: 490, q: 1.0 },
      { t: 1.32, dur: 0.30, freq: 290, q: 1.5 },  // final deep rattle
    ];
    gurgleDef.forEach(({ t, dur, freq, q }) => {
      const { src, gain: ng } = _noise(dur + 0.08, 1.0);
      const gBP = ctx.createBiquadFilter();
      gBP.type = 'bandpass';
      gBP.frequency.value = freq;
      gBP.Q.value = q;
      ng.gain.setValueAtTime(0.001, now + t);
      ng.gain.linearRampToValueAtTime(0.30, now + t + 0.03);
      ng.gain.exponentialRampToValueAtTime(0.001, now + t + dur);
      src.connect(gBP);
      gBP.connect(megaBP);
      src.start(now + t); src.stop(now + t + dur + 0.08);
    });

    // ── Layer 3: Bees — 3 detuned square waves with fast AM ──────────────────
    [
      { freq: 204, amFreq: 183 },
      { freq: 217, amFreq: 197 },
      { freq: 231, amFreq: 211 },
    ].forEach(({ freq, amFreq }) => {
      const bee  = ctx.createOscillator();
      const beeG = ctx.createGain();
      const am   = ctx.createOscillator();
      const amG  = ctx.createGain();
      bee.type = 'square';
      bee.frequency.value = freq;
      am.type = 'sine';
      am.frequency.value = amFreq;
      amG.gain.value = 0.055;
      am.connect(amG); amG.connect(beeG.gain);
      beeG.gain.setValueAtTime(0.055, now);
      beeG.gain.linearRampToValueAtTime(0.095, now + 0.12);
      beeG.gain.exponentialRampToValueAtTime(0.001, now + 1.65);
      bee.connect(beeG);
      beeG.connect(megaBP);
      am.start(now); am.stop(now + 1.7);
      bee.start(now); bee.stop(now + 1.7);
    });

    // ── Layer 4: The final choke — pitch spikes then cuts ────────────────────
    const choke  = ctx.createOscillator();
    const chokeG = ctx.createGain();
    choke.type = 'sawtooth';
    choke.frequency.setValueAtTime(195, now + 1.52);
    choke.frequency.linearRampToValueAtTime(440, now + 1.68);
    chokeG.gain.setValueAtTime(0.001, now + 1.52);
    chokeG.gain.linearRampToValueAtTime(0.25, now + 1.54);
    chokeG.gain.exponentialRampToValueAtTime(0.001, now + 1.75);
    choke.connect(chokeG);
    chokeG.connect(megaBP);
    choke.start(now + 1.52); choke.stop(now + 1.78);

    // ── Layer 5: Sub-bass death thud ─────────────────────────────────────────
    const thud  = ctx.createOscillator();
    const thudG = ctx.createGain();
    thud.type = 'sine';
    thud.frequency.setValueAtTime(88, now + 0.04);
    thud.frequency.exponentialRampToValueAtTime(28, now + 0.55);
    thudG.gain.setValueAtTime(0.001, now + 0.04);
    thudG.gain.linearRampToValueAtTime(0.32, now + 0.06);
    thudG.gain.exponentialRampToValueAtTime(0.001, now + 0.58);
    thud.connect(thudG);
    thudG.connect(master);
    thud.start(now + 0.04); thud.stop(now + 0.62);
  }

  // Triumphant rising run + chord bloom — max-HP pickup fanfare
  function _sfxMaxhpFanfare(now) {
    // Five ascending triangle-wave notes (C major pentatonic, two octaves)
    const run = [523, 659, 784, 988, 1047];
    run.forEach((freq, i) => {
      const t   = now + i * 0.09;
      const osc = ctx.createOscillator();
      const g   = ctx.createGain();
      osc.type            = 'triangle';
      osc.frequency.value = freq;
      g.gain.setValueAtTime(0.16, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
      osc.connect(g); g.connect(reverb); g.connect(master);
      osc.start(t); osc.stop(t + 0.25);
    });

    // Chord bloom: C major triad one octave up, sustained with reverb tail
    const chordT = now + run.length * 0.09;
    [1047, 1319, 1568].forEach(freq => {
      const osc = ctx.createOscillator();
      const g   = ctx.createGain();
      osc.type            = 'sine';
      osc.frequency.value = freq;
      g.gain.setValueAtTime(0.12, chordT);
      g.gain.exponentialRampToValueAtTime(0.0001, chordT + 0.9);
      osc.connect(g); g.connect(reverb);
      osc.start(chordT); osc.stop(chordT + 0.95);
    });

    // High sparkle sweep above the chord
    const sparkOsc = ctx.createOscillator();
    const sparkG   = ctx.createGain();
    sparkOsc.type = 'sine';
    sparkOsc.frequency.setValueAtTime(2093, chordT);
    sparkOsc.frequency.linearRampToValueAtTime(3136, chordT + 0.45);
    sparkG.gain.setValueAtTime(0, chordT);
    sparkG.gain.linearRampToValueAtTime(0.05, chordT + 0.1);
    sparkG.gain.exponentialRampToValueAtTime(0.0001, chordT + 0.75);
    sparkOsc.connect(sparkG); sparkG.connect(reverb);
    sparkOsc.start(chordT); sparkOsc.stop(chordT + 0.8);
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

  // Discordant jangle — clashing tritone cluster with a scraping metallic overtone.
  // A minor second (B+C) beating against a tritone (F#) gives an unsettling, wrong sound.
  function _sfxSymbolPickup(now) {
    // Layer 1: tritone stab — triangle wave pair a tritone apart
    [[246.9, 0], [369.9, 0.01]].forEach(([freq, delay]) => {
      const osc = ctx.createOscillator();
      const g   = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + delay);
      osc.frequency.exponentialRampToValueAtTime(freq * 0.85, now + delay + 0.35);
      g.gain.setValueAtTime(0.22, now + delay);
      g.gain.exponentialRampToValueAtTime(0.0001, now + delay + 0.45);
      osc.connect(g); g.connect(reverb); g.connect(master);
      osc.start(now + delay); osc.stop(now + delay + 0.5);
    });

    // Layer 2: semitone clash — two square waves a minor second apart; beating effect
    [[261.6, 0.0], [277.2, 0.0]].forEach(([freq, delay]) => {
      const osc = ctx.createOscillator();
      const g   = ctx.createGain();
      osc.type = 'square';
      osc.frequency.value = freq;
      g.gain.setValueAtTime(0.0, now + delay);
      g.gain.linearRampToValueAtTime(0.08, now + delay + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, now + delay + 0.55);
      osc.connect(g); g.connect(reverb);
      osc.start(now + delay); osc.stop(now + delay + 0.6);
    });

    // Layer 3: scraping metallic decay — short sawtooth burst with harsh highpass
    const saw = ctx.createOscillator();
    const hp  = ctx.createBiquadFilter();
    const sg  = ctx.createGain();
    saw.type = 'sawtooth';
    saw.frequency.setValueAtTime(880, now + 0.02);
    saw.frequency.exponentialRampToValueAtTime(440, now + 0.30);
    hp.type = 'highpass'; hp.frequency.value = 1800;
    sg.gain.setValueAtTime(0.0, now + 0.02);
    sg.gain.linearRampToValueAtTime(0.10, now + 0.04);
    sg.gain.exponentialRampToValueAtTime(0.0001, now + 0.32);
    saw.connect(hp); hp.connect(sg); sg.connect(master);
    saw.start(now + 0.02); saw.stop(now + 0.35);
  }

  // Final symbol collected — longer, more strident version of symbol_pickup
  function _sfxFinalSymbol(now) {
    // Tritone stabs: same pair plus octave doublings above and below, louder + longer
    [[123.5, 0.0], [246.9, 0.0], [369.9, 0.02], [554.4, 0.04]].forEach(([freq, delay]) => {
      const osc = ctx.createOscillator();
      const g   = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + delay);
      osc.frequency.exponentialRampToValueAtTime(freq * 0.80, now + delay + 0.9);
      g.gain.setValueAtTime(0.28, now + delay);
      g.gain.exponentialRampToValueAtTime(0.0001, now + delay + 1.1);
      osc.connect(g); g.connect(reverb); g.connect(master);
      osc.start(now + delay); osc.stop(now + delay + 1.2);
    });

    // Beating minor seconds: two octaves, louder + longer
    [[261.6, 0.0], [277.2, 0.0], [523.2, 0.05], [554.4, 0.05]].forEach(([freq, delay]) => {
      const osc = ctx.createOscillator();
      const g   = ctx.createGain();
      osc.type = 'square';
      osc.frequency.value = freq;
      g.gain.setValueAtTime(0.0, now + delay);
      g.gain.linearRampToValueAtTime(0.12, now + delay + 0.03);
      g.gain.exponentialRampToValueAtTime(0.0001, now + delay + 1.3);
      osc.connect(g); g.connect(reverb);
      osc.start(now + delay); osc.stop(now + delay + 1.4);
    });

    // Ascending strident shriek: sawtooth climbs through dissonant register then drops
    const shriek = ctx.createOscillator();
    const shHp   = ctx.createBiquadFilter();
    const shg    = ctx.createGain();
    shriek.type = 'sawtooth';
    shriek.frequency.setValueAtTime(220,  now + 0.05);
    shriek.frequency.exponentialRampToValueAtTime(1760, now + 0.65);
    shriek.frequency.exponentialRampToValueAtTime(880,  now + 1.05);
    shHp.type = 'highpass'; shHp.frequency.value = 600;
    shg.gain.setValueAtTime(0.0,  now + 0.05);
    shg.gain.linearRampToValueAtTime(0.16, now + 0.12);
    shg.gain.exponentialRampToValueAtTime(0.0001, now + 1.05);
    shriek.connect(shHp); shHp.connect(shg); shg.connect(reverb); shg.connect(master);
    shriek.start(now + 0.05); shriek.stop(now + 1.1);

    // Sub-bass thud for weight and finality
    const sub  = ctx.createOscillator();
    const subg = ctx.createGain();
    sub.type = 'sine';
    sub.frequency.setValueAtTime(110, now);
    sub.frequency.exponentialRampToValueAtTime(40, now + 0.7);
    subg.gain.setValueAtTime(0.20, now);
    subg.gain.exponentialRampToValueAtTime(0.0001, now + 0.7);
    sub.connect(subg); subg.connect(master);
    sub.start(now); sub.stop(now + 0.8);
  }

  // ── Public API ───────────────────────────────────────────────────────────

  function resumeIfSuspended() {
    if (ctx && ctx.state === 'suspended') ctx.resume();
  }

  return { init, startMusic, stopMusic, startVictoryMusic, setBossMode, playSFX, playFlyBuzz, resumeIfSuspended };
})();
