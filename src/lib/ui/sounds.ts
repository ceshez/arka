let sharedAudioContext: AudioContext | undefined

type AudioContextWindow = Window & {
  webkitAudioContext?: typeof AudioContext
}

function playTone(context: AudioContext, frequency: number, startAt: number, duration: number) {
  const oscillator = context.createOscillator()
  const gain = context.createGain()

  oscillator.type = 'sine'
  oscillator.frequency.setValueAtTime(frequency, startAt)
  gain.gain.setValueAtTime(0.0001, startAt)
  gain.gain.exponentialRampToValueAtTime(0.035, startAt + 0.025)
  gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration)

  oscillator.connect(gain)
  gain.connect(context.destination)
  oscillator.start(startAt)
  oscillator.stop(startAt + duration + 0.02)
}

export function playSuccessChime() {
  const AudioContextConstructor = window.AudioContext ?? (window as AudioContextWindow).webkitAudioContext
  if (!AudioContextConstructor) return

  sharedAudioContext ??= new AudioContextConstructor()

  const play = () => {
    if (!sharedAudioContext) return
    const startAt = sharedAudioContext.currentTime + 0.015
    playTone(sharedAudioContext, 659.25, startAt, 0.2)
    playTone(sharedAudioContext, 880, startAt + 0.1, 0.24)
  }

  if (sharedAudioContext.state === 'suspended') {
    void sharedAudioContext.resume().then(play).catch(() => undefined)
    return
  }

  play()
}
