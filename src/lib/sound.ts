// Tiny synthesized sound effects via the Web Audio API — no audio files to
// ship or fetch, just short generated tones. Every function is wrapped in
// try/catch and fails silently: sound is a nice-to-have and must never
// throw or block actual gameplay (e.g. if the browser blocks audio before
// the user has interacted with the page yet).

let ctx: AudioContext | null = null

function getCtx(): AudioContext | null {
  const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!Ctx) return null
  if (!ctx) ctx = new Ctx()
  if (ctx.state === 'suspended') ctx.resume().catch(() => {})
  return ctx
}

function tone(freqFrom: number, freqTo: number, duration: number, volume: number, type: OscillatorType = 'sine') {
  try {
    const audio = getCtx()
    if (!audio) return
    const osc = audio.createOscillator()
    const gain = audio.createGain()
    osc.type = type
    osc.frequency.setValueAtTime(freqFrom, audio.currentTime)
    osc.frequency.exponentialRampToValueAtTime(Math.max(freqTo, 1), audio.currentTime + duration)
    gain.gain.setValueAtTime(volume, audio.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + duration)
    osc.connect(gain)
    gain.connect(audio.destination)
    osc.start()
    osc.stop(audio.currentTime + duration)
  } catch {
    // ignore — never let a sound glitch break the game
  }
}

/** Call once on any user interaction to satisfy the browser's autoplay
 * policy early, so sounds triggered later by network events (the opponent's
 * move arriving via SignalR, not a click) are allowed to play too. */
export function unlockAudio() {
  getCtx()
}

/** A short, neutral "tock" for a normal move. */
export function playMoveSound() {
  tone(520, 340, 0.09, 0.14)
}

/** A slightly lower, sharper double-tone for a capture. */
export function playCaptureSound() {
  tone(420, 220, 0.07, 0.16, 'triangle')
  setTimeout(() => tone(300, 160, 0.1, 0.14, 'triangle'), 60)
}

/** A brighter rising tone for check/checkmate. */
export function playCheckSound() {
  tone(440, 660, 0.15, 0.16, 'square')
}

/** A short burst of filtered noise, for percussive/wooden sounds (tile taps,
 * knocks) that a pure sine/square tone can't convincingly produce. */
function noiseBurst(duration: number, volume: number, filterFreq: number, filterQ = 0.7) {
  try {
    const audio = getCtx()
    if (!audio) return
    const bufferSize = Math.max(1, Math.floor(audio.sampleRate * duration))
    const buffer = audio.createBuffer(1, bufferSize, audio.sampleRate)
    const data = buffer.getChannelData(0)
    for (let i = 0; i < bufferSize; i++) {
      // Slight downward energy taper so the burst feels like a hit, not a hiss.
      data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize)
    }
    const src = audio.createBufferSource()
    src.buffer = buffer
    const filter = audio.createBiquadFilter()
    filter.type = 'bandpass'
    filter.frequency.setValueAtTime(filterFreq, audio.currentTime)
    filter.Q.value = filterQ
    const gain = audio.createGain()
    gain.gain.setValueAtTime(volume, audio.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + duration)
    src.connect(filter)
    filter.connect(gain)
    gain.connect(audio.destination)
    src.start()
    src.stop(audio.currentTime + duration)
  } catch {
    // ignore — never let a sound glitch break the game
  }
}

/** A solid wooden "tock" — a filtered noise knock layered under a fast-decaying
 * low thump, like an ivory tile actually landing on a felt-topped table
 * (the old back-to-back square-wave beeps read more like a video-game blip). */
export function playDominoPlaceSound() {
  noiseBurst(0.045, 0.5, 1800, 1.1)
  tone(180, 70, 0.09, 0.22, 'sine')
}

/** A quick upward slide — a tile being picked up off the boneyard pile. */
export function playDominoDrawSound() {
  tone(260, 480, 0.11, 0.12, 'triangle')
}

/** A short rising three-note flourish for a win; a duller two-note fall otherwise. */
export function playDominoEndSound(won: boolean) {
  if (won) {
    tone(440, 440, 0.09, 0.15, 'sine')
    setTimeout(() => tone(554, 554, 0.09, 0.15, 'sine'), 100)
    setTimeout(() => tone(659, 880, 0.22, 0.16, 'sine'), 200)
  } else {
    tone(392, 392, 0.1, 0.13, 'sine')
    setTimeout(() => tone(311, 220, 0.22, 0.12, 'sine'), 110)
  }
}

/** A rapid burst of short clicks — like teeth chattering from a shiver — paired with the king's jump-and-shake animation when it's put in check. */
export function playKingTrembleSound() {
  try {
    const audio = getCtx()
    if (!audio) return
    const now = audio.currentTime
    const clicks = 11
    const spacing = 0.055
    for (let i = 0; i < clicks; i++) {
      const t = now + i * spacing + Math.random() * 0.008
      const osc = audio.createOscillator()
      const gain = audio.createGain()
      osc.type = 'square'
      const freq = 650 + Math.random() * 350
      osc.frequency.setValueAtTime(freq, t)
      gain.gain.setValueAtTime(0.0001, t)
      gain.gain.linearRampToValueAtTime(0.13, t + 0.004)
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.03)
      osc.connect(gain)
      gain.connect(audio.destination)
      osc.start(t)
      osc.stop(t + 0.04)
    }
  } catch {
    // ignore — never let a sound glitch break the game
  }
}
