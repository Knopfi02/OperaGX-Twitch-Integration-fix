/**
 * Copyright (C) 2019 Opera Software AS. All rights reserved.
 * This file is an original work developed by Opera Software AS
 */

export class Sounds {
  constructor(prefs, volume) {
    this._prefs = prefs;
    this._audio = new Audio('assets/notification.mp3');
    this._volume = volume;
    this._onVolumeChange = this._onVolumeChange.bind(this);
    this._registerEvents();
  }

  async _registerEvents() {
    this._volume.connect(this._onVolumeChange);
  }

  _onVolumeChange(volume) {
    this._audio.volume = volume;
  }

  play() {
    if (!this.isMuted()) {
      this._audio.pause();
      this._audio.currentTime = 0;
      this._audio.play();
    }
  }

  setMuted(muted) {
    this._prefs.soundsMuted = !!muted;
  }

  isMuted() {
    return this._prefs.soundsMuted;
  }
}
