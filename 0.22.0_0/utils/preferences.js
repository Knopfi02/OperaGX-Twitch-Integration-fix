/**
 * Copyright (C) 2019 Opera Software AS. All rights reserved.
 * This file is an original work developed by Opera Software AS
 */
const PREFERENCES_ROOT = 'preferences';

export class Preferences {
  constructor() {
    document.addEventListener('storage', evt => this._onStorageEvent(evt));
    window.addEventListener('storage', evt => this._onStorageEvent(evt));
    this.registeredPrefs = {};
    this._registerEnumPref(
        'avatarHoverEffect', 'small-to-large',
        // details-line is not finished - thus disabled for now
        ['slide-in' /*, 'details-line'*/, 'small-to-large'], x => x);
    this._registerEnumPref(
        'avatarListStyle', 'icons', ['icons', 'details'], x => x);
    this._registerBooleanPref('soundsMuted', false);
    this._registerBooleanPref('showFilter', true);
  }

  migratePrefsIfNeeded() {
    // Migrate old muted state
    if (localStorage.getItem('muted') !== null) {
      this.soundsMuted = localStorage['muted'] === 'true';
      localStorage.removeItem('muted');
    }
  }

  addEventListener(name, listener) {
    if (!Object.keys(this.registeredPrefs).includes(name)) {
      throw `Unknown pref ${name}`;
    }
    this.registeredPrefs[name].listeners.push(listener);
  }

  _onStorageEvent(evt) {
    const prefName = this._prefNameFromStorage(evt.key);
    if (prefName == null ||
        !Object.keys(this.registeredPrefs).includes(prefName)) {
      return;
    }

    this._onPrefChanged(prefName, evt.oldValue, evt.newValue);
  }

  _onPrefChanged(prefName, oldValue, newValue) {
    const pref = this.registeredPrefs[prefName];
    for (let listener of pref.listeners) {
      listener(prefName, pref.parser(oldValue), pref.parser(newValue));
    }
  }

  _registerEnumPref(name, defaultValue, possibleEnumValues, parser) {
    this._registerPref(
        name, defaultValue, x => possibleEnumValues.includes(x), parser);
  }

  _registerBooleanPref(name, defaultValue) {
    this._registerPref(
        name, defaultValue, x => typeof x === 'boolean', x => x === 'true');
  }

  _registerPref(name, defaultValue, validator, parser) {
    // TODO check double registration
    this.registeredPrefs[name] = {
      validator: validator,
      parser: parser,
      listeners: [],
      defaultValue: defaultValue,
    };

    Object.defineProperty(this, name, {
      get: () => this._getPref(name, defaultValue, parser),
      set: val => this._setPref(name, val, validator),
    });
    // TODO add resetting value to default if initial state is invalid
  }

  _prefNameFromStorage(storageName) {
    if (!storageName.startsWith(`${PREFERENCES_ROOT}.`)) {
      return null;
    }

    return storageName.slice(PREFERENCES_ROOT.length + 1);
  }

  _storagePath(prefName) {
    return `${PREFERENCES_ROOT}.${prefName}`;
  }

  _setPref(name, value, validator, parse) {
    if (!validator(value) && value !== null && value !== undefined) {
      throw 'Invalid Pref Value';
    }
    const oldValue = localStorage[this._storagePath(name)];
    localStorage[this._storagePath(name)] = value;
    const newValue = localStorage[this._storagePath(name)];
    // Simulate pref change for current document as we only get storage
    // events from other documents.
    if (oldValue !== newValue) {
      this._onPrefChanged(name, oldValue, newValue);
    }
  }

  _getPref(name, defaultValue, parse) {
    const storedVal = localStorage[this._storagePath(name)];
    if (storedVal === null || storedVal === undefined) {
      return defaultValue;
    }
    return parse(storedVal);
  }
}
