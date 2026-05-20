/**
 * Shared audio utilities for the 8th Wall project.
 */
(function (global) {
  'use strict';

  function playSound(type) {
    try {
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      if (type === 'found') {
        oscillator.frequency.value = 800;
        gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.3);
      } else if (type === 'tap') {
        oscillator.frequency.value = 1200;
        gainNode.gain.setValueAtTime(0.2, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.1);
      } else if (type === 'kick') {
        oscillator.type = 'square';
        oscillator.frequency.setValueAtTime(220, audioContext.currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(90, audioContext.currentTime + 0.09);
        gainNode.gain.setValueAtTime(0.25, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.1);
      } else if (type === 'goal') {
        oscillator.frequency.setValueAtTime(880, audioContext.currentTime);
        oscillator.frequency.linearRampToValueAtTime(1320, audioContext.currentTime + 0.22);
        gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.4);
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.4);
      } else if (type === 'bonus') {
        oscillator.type = 'triangle';
        oscillator.frequency.setValueAtTime(660, audioContext.currentTime);
        oscillator.frequency.linearRampToValueAtTime(990, audioContext.currentTime + 0.12);
        gainNode.gain.setValueAtTime(0.22, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2);
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.2);
      } else if (type === 'countdown-3') {
        oscillator.type = 'square';
        oscillator.frequency.setValueAtTime(420, audioContext.currentTime);
        oscillator.frequency.linearRampToValueAtTime(460, audioContext.currentTime + 0.1);
        gainNode.gain.setValueAtTime(0.24, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.13);
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.13);
      } else if (type === 'countdown-2') {
        oscillator.type = 'square';
        oscillator.frequency.setValueAtTime(520, audioContext.currentTime);
        oscillator.frequency.linearRampToValueAtTime(560, audioContext.currentTime + 0.1);
        gainNode.gain.setValueAtTime(0.24, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.13);
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.13);
      } else if (type === 'countdown-1') {
        oscillator.type = 'square';
        oscillator.frequency.setValueAtTime(640, audioContext.currentTime);
        oscillator.frequency.linearRampToValueAtTime(680, audioContext.currentTime + 0.1);
        gainNode.gain.setValueAtTime(0.24, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.13);
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.13);
      } else if (type === 'countdown-go') {
        oscillator.type = 'sawtooth';
        oscillator.frequency.setValueAtTime(740, audioContext.currentTime);
        oscillator.frequency.linearRampToValueAtTime(1260, audioContext.currentTime + 0.2);
        gainNode.gain.setValueAtTime(0.28, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.24);

        // Add a short harmony voice (perfect fifth-ish) for extra arcade punch.
        const harmonyOsc = audioContext.createOscillator();
        const harmonyGain = audioContext.createGain();
        harmonyOsc.type = 'triangle';
        harmonyOsc.frequency.setValueAtTime(1110, audioContext.currentTime);
        harmonyOsc.frequency.linearRampToValueAtTime(1680, audioContext.currentTime + 0.2);
        harmonyGain.gain.setValueAtTime(0.12, audioContext.currentTime);
        harmonyGain.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.22);
        harmonyOsc.connect(harmonyGain);
        harmonyGain.connect(audioContext.destination);

        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.24);
        harmonyOsc.start(audioContext.currentTime);
        harmonyOsc.stop(audioContext.currentTime + 0.22);
      }
    } catch (e) { }
  }

  global.AudioUtils = {
    playSound: playSound
  };
})(typeof window !== 'undefined' ? window : globalThis);
