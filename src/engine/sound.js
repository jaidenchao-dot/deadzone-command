// ============================================================================
// 2. PROCEDURAL WEB AUDIO SOUND SYNTHESIZER
// ============================================================================
class TacticalSoundEngine {
    constructor() {
        this.ctx = null;
        this.muted = false;
        this.lastTimes = {};
    }

    init() {
        if (!this.ctx) {
            const AudioCtx = window.AudioContext || window.webkitAudioContext;
            if (AudioCtx) this.ctx = new AudioCtx();
        }
        if (this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume().catch(() => {});
        }
    }

    canPlay(key, minInterval = 0.06) {
        if (this.muted) return false;
        this.init();
        if (!this.ctx) return false;
        const now = this.ctx.currentTime;
        if (this.lastTimes[key] && now - this.lastTimes[key] < minInterval) return false;
        this.lastTimes[key] = now;
        return true;
    }

    // Update 5: positional attenuation — sounds far from the camera are quieter (and very distant ones skipped)
    at(x, y) {
        if (this.listener && x !== undefined) {
            const d = Math.hypot(x - this.listener.x, y - this.listener.y);
            this._att = Math.max(0, Math.min(1, 1.15 - d / this.listener.range));
        } else {
            this._att = 1;
        }
        return this;
    }

    takeAtt() {
        const a = this._att === undefined ? 1 : this._att;
        this._att = 1;
        return a;
    }

    playGunshot(type = 'rifle') {
        const att = this.takeAtt();
        if (att < 0.06) return;
        if (!this.canPlay('gun_' + type, type === 'lmg' ? 0.045 : 0.065)) return;
        try {
            const now = this.ctx.currentTime;
            const duration = (type === 'cannon' || type === 'artillery') ? 0.56 :
                             (type === 'sniper' ? 0.34 : (type === 'shotgun' ? 0.28 : 0.13));
            const bufferSize = Math.floor(this.ctx.sampleRate * duration);
            const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
            const data = buffer.getChannelData(0);
            for (let i = 0; i < bufferSize; i++) {
                const env = Math.exp(-i / (bufferSize * 0.22));
                const crack = i < bufferSize * 0.08 ? (Math.random() * 2 - 1) * 1.45 : (Math.random() * 2 - 1);
                data[i] = Math.max(-1, Math.min(1, crack * env));
            }

            const noise = this.ctx.createBufferSource();
            noise.buffer = buffer;

            const filter = this.ctx.createBiquadFilter();
            filter.type = (type === 'cannon' || type === 'artillery') ? 'lowpass' : 'bandpass';
            filter.frequency.setValueAtTime(
                type === 'artillery' ? 320 : (type === 'cannon' ? 410 : (type === 'autocannon' ? 760 : (type === 'sniper' ? 1150 : (type === 'shotgun' ? 680 : 1480)))),
                now
            );
            filter.Q.value = type === 'sniper' ? 2.2 : 1.1;

            const gain = this.ctx.createGain();
            const vol = att * ((type === 'cannon' || type === 'artillery') ? 0.42 : (type === 'sniper' ? 0.30 : (type === 'shotgun' ? 0.28 : 0.15)));
            gain.gain.setValueAtTime(vol, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

            noise.connect(filter);
            filter.connect(gain);
            gain.connect(this.ctx.destination);
            noise.start(now);

            const osc = this.ctx.createOscillator();
            const oscGain = this.ctx.createGain();
            osc.type = (type === 'cannon' || type === 'artillery') ? 'sine' : 'triangle';
            osc.frequency.setValueAtTime((type === 'cannon' || type === 'artillery') ? 105 : (type === 'shotgun' ? 165 : 225), now);
            osc.frequency.exponentialRampToValueAtTime(24, now + duration * 0.85);
            oscGain.gain.setValueAtTime(vol * 1.05, now);
            oscGain.gain.exponentialRampToValueAtTime(0.001, now + duration * 0.85);
            osc.connect(oscGain);
            oscGain.connect(this.ctx.destination);
            osc.start(now);
            osc.stop(now + duration);

            if (type === 'sniper' || type === 'rifle') {
                const snap = this.ctx.createOscillator();
                const snapGain = this.ctx.createGain();
                snap.type = 'sawtooth';
                snap.frequency.setValueAtTime(type === 'sniper' ? 2450 : 1850, now);
                snap.frequency.exponentialRampToValueAtTime(320, now + 0.045);
                snapGain.gain.setValueAtTime(0.085, now);
                snapGain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
                snap.connect(snapGain);
                snapGain.connect(this.ctx.destination);
                snap.start(now);
                snap.stop(now + 0.055);
            }
        } catch (e) {}
    }

    playExplosion(scale = 1.0) {
        const att = this.takeAtt();
        if (att < 0.06) return;
        scale *= att;
        if (!this.canPlay('explosion', 0.08)) return;
        try {
            const now = this.ctx.currentTime;
            const dur = Math.min(1.1, 0.45 * scale);
            const bufferSize = Math.floor(this.ctx.sampleRate * dur);
            const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
            const data = buffer.getChannelData(0);
            for (let i = 0; i < bufferSize; i++) {
                data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.28));
            }
            const noise = this.ctx.createBufferSource();
            noise.buffer = buffer;

            const filter = this.ctx.createBiquadFilter();
            filter.type = 'lowpass';
            filter.frequency.setValueAtTime(360, now);
            filter.frequency.exponentialRampToValueAtTime(55, now + dur);

            const gain = this.ctx.createGain();
            gain.gain.setValueAtTime(Math.min(0.55, 0.34 * scale), now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + dur);

            noise.connect(filter);
            filter.connect(gain);
            gain.connect(this.ctx.destination);
            noise.start(now);

            const boom = this.ctx.createOscillator();
            const boomGain = this.ctx.createGain();
            boom.type = 'sine';
            boom.frequency.setValueAtTime(92, now);
            boom.frequency.exponentialRampToValueAtTime(20, now + dur * 0.9);
            boomGain.gain.setValueAtTime(Math.min(0.6, 0.38 * scale), now);
            boomGain.gain.exponentialRampToValueAtTime(0.001, now + dur * 0.9);
            boom.connect(boomGain);
            boomGain.connect(this.ctx.destination);
            boom.start(now);
            boom.stop(now + dur);
        } catch (e) {}
    }

    playMissileLaunch() {
        if (!this.canPlay('missile', 0.2)) return;
        try {
            const now = this.ctx.currentTime;
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(280, now);
            osc.frequency.exponentialRampToValueAtTime(980, now + 0.55);
            gain.gain.setValueAtTime(0.16, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
            osc.connect(gain);
            gain.connect(this.ctx.destination);
            osc.start(now);
            osc.stop(now + 0.62);
        } catch (e) {}
    }

    playRadioAck(kind = 'confirm') {
        if (!this.canPlay('radio_' + kind, 0.07)) return;
        try {
            const now = this.ctx.currentTime;
            const freqs = kind === 'alert' ? [520, 380, 520] :
                          (kind === 'build' ? [440, 660, 880] :
                          (kind === 'liberate' ? [523, 659, 784, 1046] :
                          (kind === 'select' ? [740, 920] : [620, 840])));
            freqs.forEach((f, idx) => {
                const osc = this.ctx.createOscillator();
                const gain = this.ctx.createGain();
                osc.type = 'square';
                osc.frequency.setValueAtTime(f, now + idx * 0.045);
                gain.gain.setValueAtTime(0.065, now + idx * 0.045);
                gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.045 + 0.055);
                osc.connect(gain);
                gain.connect(this.ctx.destination);
                osc.start(now + idx * 0.045);
                osc.stop(now + idx * 0.045 + 0.06);
            });
        } catch (e) {}
    }

    playDismantle() {
        if (!this.canPlay('dismantle', 0.1)) return;
        try {
            const now = this.ctx.currentTime;
            [320, 210, 140].forEach((freq, i) => {
                const osc = this.ctx.createOscillator();
                const gain = this.ctx.createGain();
                osc.type = 'sawtooth';
                osc.frequency.setValueAtTime(freq, now + i * 0.06);
                osc.frequency.exponentialRampToValueAtTime(60, now + i * 0.06 + 0.12);
                gain.gain.setValueAtTime(0.11, now + i * 0.06);
                gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.06 + 0.13);
                osc.connect(gain);
                gain.connect(this.ctx.destination);
                osc.start(now + i * 0.06);
                osc.stop(now + i * 0.06 + 0.14);
            });
        } catch (e) {}
    }

    playGateToggle(opening = true) {
        if (!this.canPlay('gate', 0.15)) return;
        try {
            const now = this.ctx.currentTime;
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(opening ? 130 : 210, now);
            osc.frequency.linearRampToValueAtTime(opening ? 220 : 115, now + 0.18);
            gain.gain.setValueAtTime(0.08, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
            osc.connect(gain);
            gain.connect(this.ctx.destination);
            osc.start(now);
            osc.stop(now + 0.21);
        } catch (e) {}
    }

    // ===== Update 5: new sound effects =====
    noiseBurst(duration, filterType, freqStart, freqEnd, vol, delay = 0) {
        const now = this.ctx.currentTime + delay;
        const size = Math.max(1, Math.floor(this.ctx.sampleRate * duration));
        const buf = this.ctx.createBuffer(1, size, this.ctx.sampleRate);
        const d = buf.getChannelData(0);
        for (let i = 0; i < size; i++) d[i] = (Math.random() * 2 - 1) * Math.exp(-i / (size * 0.4));
        const src = this.ctx.createBufferSource();
        src.buffer = buf;
        const f = this.ctx.createBiquadFilter();
        f.type = filterType;
        f.frequency.setValueAtTime(freqStart, now);
        f.frequency.exponentialRampToValueAtTime(Math.max(20, freqEnd), now + duration);
        const g = this.ctx.createGain();
        g.gain.setValueAtTime(vol, now);
        g.gain.exponentialRampToValueAtTime(0.001, now + duration);
        src.connect(f); f.connect(g); g.connect(this.ctx.destination);
        src.start(now);
    }

    tone(type, f0, f1, dur, vol, delay = 0) {
        const now = this.ctx.currentTime + delay;
        const o = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        o.type = type;
        o.frequency.setValueAtTime(f0, now);
        o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), now + dur);
        g.gain.setValueAtTime(vol, now);
        g.gain.exponentialRampToValueAtTime(0.001, now + dur);
        o.connect(g); g.connect(this.ctx.destination);
        o.start(now); o.stop(now + dur + 0.02);
    }

    playDryFire() {
        if (!this.canPlay('dry', 0.6)) return;
        try { this.tone('square', 1800, 900, 0.03, 0.05); this.tone('square', 1500, 700, 0.03, 0.04, 0.08); } catch (e) {}
    }

    playResupply() {
        if (!this.canPlay('resupply', 0.5)) return;
        try {
            this.noiseBurst(0.08, 'bandpass', 2200, 1200, 0.12);          // crate latch
            this.tone('triangle', 330, 300, 0.12, 0.08, 0.06);            // thunk
            this.noiseBurst(0.06, 'highpass', 4000, 3000, 0.07, 0.16);    // magazine click
        } catch (e) {}
    }

    playRotorTransition(up) {
        if (!this.canPlay('rotor', 0.4)) return;
        try {
            const now = this.ctx.currentTime;
            for (let i = 0; i < 9; i++) {
                const t = i * 0.12;
                const v = up ? 0.04 + i * 0.012 : 0.14 - i * 0.012;
                this.noiseBurst(0.07, 'lowpass', 900, 300, Math.max(0.02, v), t);
            }
            this.tone('sawtooth', up ? 70 : 140, up ? 140 : 60, 1.1, 0.05);
        } catch (e) {}
    }

    playRappel() {
        if (!this.canPlay('rappel', 0.3)) return;
        try { this.noiseBurst(0.45, 'bandpass', 3000, 900, 0.07); } catch (e) {}
    }

    playCrash() {
        if (!this.canPlay('crash', 0.5)) return;
        try {
            this.noiseBurst(0.9, 'lowpass', 500, 60, 0.5);
            this.tone('sine', 120, 30, 0.9, 0.4);
            this.noiseBurst(0.3, 'highpass', 3000, 1500, 0.12, 0.15); // metal shriek
        } catch (e) {}
    }

    playConstruction() {
        if (!this.canPlay('construct', 0.3)) return;
        try { for (let i = 0; i < 3; i++) this.tone('square', 520, 260, 0.05, 0.06, i * 0.11); this.noiseBurst(0.1, 'bandpass', 1500, 800, 0.06, 0.05); } catch (e) {}
    }

    playEngine() {
        if (!this.canPlay('engine', 0.8)) return;
        try { this.tone('sawtooth', 55, 95, 0.5, 0.07); this.noiseBurst(0.5, 'lowpass', 400, 150, 0.06); } catch (e) {}
    }

    playLaunchWhoosh(heavy) {
        const att = this.takeAtt();
        if (att < 0.06 || !this.canPlay('whoosh', 0.09)) return;
        try { this.noiseBurst(heavy ? 0.6 : 0.35, 'bandpass', 600, 2400, 0.12 * att); } catch (e) {}
    }

    playBombWhistle() {
        const att = this.takeAtt();
        if (att < 0.06 || !this.canPlay('whistle', 0.4)) return;
        try { this.tone('sine', 1400, 500, 0.5, 0.06 * att); } catch (e) {}
    }

    playFlame() {
        const att = this.takeAtt();
        if (att < 0.06 || !this.canPlay('flame', 0.15)) return;
        try { this.noiseBurst(0.25, 'lowpass', 900, 300, 0.16 * att); } catch (e) {}
    }

    playZombieGroan() {
        if (!this.canPlay('groan', 1.4)) return;
        try {
            const now = this.ctx.currentTime;
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(98 + Math.random() * 25, now);
            osc.frequency.linearRampToValueAtTime(62, now + 0.38);
            gain.gain.setValueAtTime(0.055, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
            osc.connect(gain);
            gain.connect(this.ctx.destination);
            osc.start(now);
            osc.stop(now + 0.42);
        } catch (e) {}
    }
}

const sfx = new TacticalSoundEngine();
