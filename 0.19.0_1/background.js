/**
 * Copyright (C) 2019 Opera Software AS. All rights reserved.
 * This file is an original work developed by Opera Software AS
 */

import {Colors} from './utils/colors.js';
import {Preferences} from './utils/preferences.js';
import {Sounds} from './utils/sounds.js';
import {StatsReporter} from './utils/stats.js';
import {TwitchAPI} from '/utils/twitch_api.js';
import {Volume} from './utils/volume.js';

const CLIENT_ID = 'ju0ntw6bpd1i0cx1ama5buw1q377qy';

const REDIR_URL_STR = `https://${chrome.runtime.id}.chromiumapp.org/`;
const REDIR_URL = new URL(REDIR_URL_STR);

// maybe id_token not needed?
const RESPONSE_TYPE = 'token+id_token';

const SCOPE = 'openid';

const AUTH_URL =
  `https://id.twitch.tv/oauth2/authorize?client_id=${CLIENT_ID}&` +
  `redirect_uri=${REDIR_URL_STR}&response_type=${RESPONSE_TYPE}&` +
  `scope=${SCOPE}`;

const REDIR_TOKEN_REGEXP = /access_token=(\w+)/;
const STATE_REGEXP = /state=(\w+)/;

// TODO decide on poll interval
const RERESH_INTERVAL_SECONDS = 60;

const CONTEXT_MENU_ID_LOGOUT = 'logout';
const CONTEXT_MENU_ID_MUTE = 'mute';
const CONTEXT_MENU_ID_UNMUTE = 'unmute';

const TILE_PLACEHOLDER_URL = './assets/no-avatar.png';

class TwitchApp {
  constructor() {
    this.color = new Colors({isBackground: true});
    this.color.registerEvents();
    this.stats = new StatsReporter(['gx', 'twitch']);
    this.setupConnections();
    this.prefs = new Preferences();
    this.prefs.migratePrefsIfNeeded();

    const volume = new Volume();
    this.sounds = new Sounds(this.prefs, volume);

    this.twitchAPI = new TwitchAPI(localStorage.accessToken, CLIENT_ID);
    this.initContextMenu();

    if (this.needsAuthentication()) {
      this.waitForAuthentication();
    } else {
      this.init();
    }
  }

  onContextMenuCommand(info) {
    switch (info.menuItemId) {
      case CONTEXT_MENU_ID_LOGOUT:
        this.logout();
        break;
      case CONTEXT_MENU_ID_MUTE:
        this.prefs.soundsMuted = true;
        break;
      case CONTEXT_MENU_ID_UNMUTE:
        this.prefs.soundsMuted = false;
        break;
      default:
        break;
    }
  }

  get followsLocal() {
    try {
      return JSON.parse(localStorage['follows']);
    } catch (e) {
      return [];
    }
  }

  set followsLocal(value) {
    let stringified = JSON.stringify(value);

    if (stringified !== localStorage['follows']) {
      localStorage['follows'] = stringified;
      this.notifyUpdateNeeded();
      this.updateBadge(value);
    }
  }

  initContextMenu() {
    chrome.contextMenus.removeAll();

    const logoutItem = {
      id: CONTEXT_MENU_ID_LOGOUT,
      title: chrome.i18n.getMessage('contextMenuLogout'),
      visible: true,
      contexts: ['sidebar_action', 'browser_action'],
      enabled: !this.needsAuthentication(),
    };
    chrome.contextMenus.create(logoutItem, evt => {});

    const muteItem = {
      id: CONTEXT_MENU_ID_MUTE,
      title: chrome.i18n.getMessage('mute'),
      visible: !this.prefs.soundsMuted,
      contexts: ['sidebar_action', 'browser_action'],
    };
    chrome.contextMenus.create(muteItem, evt => {});

    const unmuteItem = {
      id: CONTEXT_MENU_ID_UNMUTE,
      title: chrome.i18n.getMessage('unmute'),
      visible: this.prefs.soundsMuted,
      contexts: ['sidebar_action', 'browser_action'],
    };
    chrome.contextMenus.create(unmuteItem, evt => {});

    chrome.contextMenus.onClicked.addListener(
      this.onContextMenuCommand.bind(this),
    );
    this.prefs.addEventListener('soundsMuted', () => this.updateContextMenu());
  }

  setBadge(text) {
    opr.sidebarAction.setBadgeText({text});
  }

  clearBadge() {
    opr.sidebarAction.setBadgeText({text: ''});
  }

  updateContextMenu() {
    chrome.contextMenus.update(
      CONTEXT_MENU_ID_LOGOUT,
      {enabled: !this.needsAuthentication()},
      evt => {},
    );

    chrome.contextMenus.update(
      CONTEXT_MENU_ID_MUTE,
      {visible: !this.prefs.soundsMuted},
      evt => {},
    );

    chrome.contextMenus.update(
      CONTEXT_MENU_ID_UNMUTE,
      {visible: this.prefs.soundsMuted},
      evt => {},
    );
  }

  async twitchRequest(func, params = {}) {
    if (this.needsAuthentication() && params.needsAuth !== false) {
      return this._getNeedsAuthData();
    }

    try {
      return await func();
    } catch (err) {
      if (err.status === 401) {
        delete localStorage.accessToken;

        return this._getNeedsAuthData();
      }

      return {error: 'unexpected_error'};
    }
  }

  setupConnections() {
    this.ports = [];
    chrome.runtime.onConnect.addListener(port => {
      this.ports.push(port);
      port.onMessage.addListener(msg => this._onMessage(port, msg));
      port.onDisconnect.addListener(port => {
        let index = this.ports.indexOf(port);

        if (index >= 0) {
          this.ports.splice(index, 1);
        }
      });
    });
  }

  async setupUpdates() {
    // First update should always update the badge.
    let follows;

    try {
      follows = await this.updateStreamsInfo();
    } catch (e) {
      console.error(e);
    }

    if (!follows) {
      follows = [];
    }

    this.updateBadge(follows);

    window.setInterval(() => {
      this.updateStreamsInfo();
    }, 1000 * RERESH_INTERVAL_SECONDS);
  }

  async notifyUpdateNeeded() {
    for (let port of this.ports) {
      port.postMessage({updateNeeded: true});
    }
  }

  updateBadge(follows) {
    let liveCount = 0;

    for (let follow of follows) {
      if (follow.isLive) {
        ++liveCount;
      }
    }

    if (
      this.previousFollowCount !== undefined &&
      liveCount !== this.previousFollowCount
    ) {
      const lightsExtensionId = 'hlgnlpcakcbhfheemdcodfddnojhimjn';
      chrome.runtime.sendMessage(
        lightsExtensionId,
        {
          command: 'trigger_custom_event',
          event_name: 'twitch_notification',
        },
        () => {
          if (chrome.runtime.lastError) {
            // Just ignore if there is no lights extension
          }
        },
      );
    }

    this.previousFollowCount = liveCount;

    // When liveCount = 0, don't show badge nor play sound
    if (liveCount === 0) {
      this.color.setBadgeInactive();
    } else {
      this.color.setBadgeActive();
    }

    this.setBadge(this.capLiveCount(liveCount));
  }

  init() {
    this.twitchAPI = new TwitchAPI(localStorage.accessToken, CLIENT_ID);
    this.updateContextMenu();
    this.setupUpdates();
    this.color.setBadgeInactive();
  }

  getStateString() {
    if (!this.authStateString) {
      const STATE_LENTH = 16;
      let array = new Uint8Array(STATE_LENTH);
      window.crypto.getRandomValues(array);
      // hex encoded
      this.authStateString = Array.prototype.map
        .call(array, x => `00${x.toString(16)}`.slice(-2))
        .join('');
    }

    return this.authStateString;
  }

  getAuthUrl() {
    return `${AUTH_URL}&state=${this.getStateString()}`;
  }

  needsAuthentication() {
    return !localStorage.accessToken;
  }

  parseUrl(url) {
    try {
      return new URL(url);
    } catch (e) {
      return null;
    }
  }

  isRedirURL(parsedUrl) {
    return (
      parsedUrl &&
      parsedUrl.origin === REDIR_URL.origin &&
      parsedUrl.path === REDIR_URL.path
    );
  }

  // Returns the token if correct, null otherwise
  getTokenFromRedirectUrl(url) {
    let parsedUrl = this.parseUrl(url);

    if (!this.isRedirURL(parsedUrl)) {
      return null;
    }

    let stateMatch = parsedUrl.hash.match(STATE_REGEXP);

    if (stateMatch.length !== 2 || stateMatch[1] !== this.getStateString()) {
      return null;
    }

    let tokenMatch = parsedUrl.hash.match(REDIR_TOKEN_REGEXP);

    if (tokenMatch.length === 2) {
      return tokenMatch[1];
    }

    return null;
  }

  login() {
    if (this._loginPromise !== undefined) {
      return this._loginPromise;
    }

    const authInfo = {
      url: this.getAuthUrl(),
      interactive: true,
    };
    this._loginPromise = new Promise(resolve => {
      chrome.identity.launchWebAuthFlow(authInfo, url => {
        const token = this.getTokenFromRedirectUrl(url);

        if (token === null) {
          resolve(false);
        } else {
          localStorage.accessToken = token;
          this.init();
          this.stats.recordBoolean('loggedIn', true);
          resolve(true);
        }

        this._loginPromise = undefined;
      });
    });

    return this._loginPromise;
  }

  waitForAuthentication() {}

  async _onMessage(port, msg) {
    if (msg.id === undefined) {
      // ERROR
    }

    switch (msg.command) {
      case 'getStreamsInfo': {
        const data = await this.twitchRequest(this.getStreamsInfo.bind(this));
        port.postMessage({isReply: true, id: msg.id, data: data});
        break;
      }

      case 'getUserInfo': {
        const data = await this.twitchRequest(this.getUserInfo.bind(this));
        port.postMessage({isReply: true, id: msg.id, data: data});
        break;
      }

      case 'getTopStreamers': {
        const data = await this.twitchRequest(this.getTopStreams.bind(this), {
          needsAuth: false,
        });
        port.postMessage({isReply: true, id: msg.id, data: data});
        break;
      }

      case 'login': {
        let success = await this.login();
        port.postMessage({isReply: true, id: msg.id, data: {success: success}});
        break;
      }

      case 'logout': {
        await this.logout();
        this.stats.recordBoolean('loggedIn', false);
        port.postMessage({isReply: true, id: msg.id, data: {}});
        break;
      }
    }
  }

  async logout() {
    await this.twitchAPI.logout();
    localStorage.removeItem('accessToken');
    localStorage.removeItem('follows');
    this.clearBadge();
    this.notifyUpdateNeeded();

    return;
  }

  capLiveCount(liveCount) {
    if (liveCount > 99) {
      return `${liveCount}+`;
    } else if (liveCount === 0) {
      return '';
    }

    return String(liveCount);
  }

  updateStreamsInfo() {
    this.stats.recordBoolean('loggedIn', !this.needsAuthentication());

    return this.twitchRequest(async () => {
      let api = this.twitchAPI;

      const userInfo = await api.getUserInfo();
      const followedChannels = await api.getFollowedChannels(
        userInfo.data[0].id,
      );

      const followedIds = followedChannels.data.map(folllow => folllow.to_id);
      const users = await api.getUsersInfo(followedIds);
      const streams = await api.getStreamsForChannnels(followedIds, false);
      const uniqueGameIds = [
        ...new Set(
          streams.data
            .map(streamData => streamData.game_id)
            .filter(x => x !== undefined && x !== ''),
        ),
      ];
      const games = await api.getGamesInfo(uniqueGameIds);

      const follows = [];

      for (const follow of followedChannels.data) {
        // Empty user means the channel is deleted/suspended
        // so this is not any user data set for it is best effort, but not
        // fully reliable.
        const user = users.data.find(userData => userData.id === follow.to_id);
        // Empty stream means user isn't streaming now
        const stream = streams.data.find(
          streamData => streamData.user_id === follow.to_id,
        );
        const isLive = !!stream;
        const game =
          stream && stream.game_id
            ? games.data.find(gameData => gameData.id === stream.game_id)
            : null;

        const followInfo = {
          id: follow.to_id,
          name: follow.to_name,
          iconUrl: user ? user.profile_image_url : TILE_PLACEHOLDER_URL,
          followed_at: follow.followed_at,
          login: user ? user.login : follow.to_name,
          isLive: isLive,
          title: stream ? stream.title : '',
          viewerCount: stream ? stream.viewer_count : 0,
          gameTitle: game ? game.name : '',
          gameImageUrl: game ? game.box_art_url : '',
        };
        follows.push(followInfo);
      }

      const sortedFollows = follows
        .filter(x => !!x)
        .sort((a, b) => (a.followed_at >= b.followed_at ? 1 : -1))
        .sort((a, b) =>
          a.isLive === b.isLive ? 0 : a.isLive > b.isLive ? -1 : 1,
        );

      const oldFollows = this.followsLocal.filter(x => !!x);
      const oldIds = new Set(oldFollows.map(follow => follow.id));

      this.followsLocal = sortedFollows;

      if (
        sortedFollows.length > 0 &&
        !sortedFollows.find(follow => oldIds.has(follow.id))
      ) {
        this.sounds.play();
      }

      return sortedFollows;
    });
  }

  async getUserInfo() {
    const userResults = await this.twitchAPI.getUserInfo();
    const user = userResults.data[0];
    const followersResults = await this.twitchAPI.getFollowersChannels(
      user.id,
      false,
    );
    user.followers = followersResults.total || 0;

    return user;
  }

  toStreamsInfo(follows) {
    return {
      channels: follows,
    };
  }

  _getNeedsAuthData() {
    return {
      needsAuthentication: true,
    };
  }

  async getStreamsInfo() {
    let follows = this.followsLocal;

    if (Object.keys(follows).length === 0) {
      await this.updateStreamsInfo();
      follows = this.followsLocal;
    }

    return this.toStreamsInfo(follows);
  }
}

window.twitch = new TwitchApp();
