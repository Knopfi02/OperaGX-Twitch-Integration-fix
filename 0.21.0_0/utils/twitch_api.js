// Copyright (C) 2019 Opera Software AS.  All rights reserved.
//
// This file is an original work developed by Opera Software AS

const BASE_URL = 'https://api.twitch.tv/helix/';

const AUTH_URL = 'https://id.twitch.tv/oauth2/';
const AUTH_PATH_LOGOUT = 'revoke';

export class TwitchAPI {
  constructor(bearerId, clientId) {
    this.bearerId = bearerId;
    this.clientId = clientId;
  }

  logout() {
    return new Promise(resolve => {
      let xhr = new XMLHttpRequest();
      let params = {client_id: this.clientId, token: this.bearerId};
      let url = AUTH_URL + AUTH_PATH_LOGOUT + this._formatParamsInURL(params);
      xhr.open('GET', url, true);
      xhr.onreadystatechange = () => {
        if (xhr.readyState === 4) {
          resolve();
        }
      };
      xhr.send();
    });
  }

  static pageSize(paginate) {
    return paginate ? 100 : 0;
  }

  getStreams(channelId, paginate = true) {
    return this._paginatedApiRequest(
      'streams',
      {user_id: channelId},
      TwitchAPI.pageSize(paginate)
    );
  }

  // DEPRECATED
  getFollowedChannels(userId, paginate = true) {
    return this._paginatedApiRequest(
      'users/follows',
      {from_id: userId},
      TwitchAPI.pageSize(paginate)
    );
  }

  // Same as above but using new endpoint
  getChannelsFollowed(userId, paginate = true) {
    return this._paginatedApiRequest(
      'channels/followed',
      {user_id: userId},
      TwitchAPI.pageSize(paginate)
    );
  }

  // DEPRECATED
  getFollowersChannels(userId, paginate = true) {
    return this._paginatedApiRequest(
      'users/follows',
      {to_id: userId},
      TwitchAPI.pageSize(paginate)
    );
  }

  // Same as above but using new endpoint
  getChannelsFollowers(userId, paginate = true) {
    return this._paginatedApiRequest(
      'channels/followers',
      {broadcaster_id: userId},
      TwitchAPI.pageSize(paginate)
    );
  }

  getUserInfo(userId) {
    if (userId === undefined) {
      return this._apiRequest('users', {first: 100});
    }
    return this._apiRequest('users', {id: userId});
  }

  getStreamsForChannnels(channelIds, paginate = true) {
    return this._multiIdRequest(
        'streams', {user_id: channelIds}, 'user_id',
        TwitchAPI.pageSize(paginate));
  }

  getGamesInfo(gameIds) {
    return this._multiIdRequest('games', {id: gameIds}, 'id');
  }

  getUsersInfo(userIds) {
    return this._multiIdRequest('users', {id: userIds}, 'id');
  }

  getGameInfo(gameId) {
    return this._apiRequest('games', {id: gameId});
  }

  _formatParamsInURL(params) {
    if (params === undefined || Object.keys(params).length === 0) {
      return '';
    }

    const ret = [];
    for (let key in params) {
      const value = params[key];
      if (typeof (value) === 'object') {
        for (const arrayValue of value) {
          ret.push(
              `${encodeURIComponent(key)}=${encodeURIComponent(arrayValue)}`);
        }
      } else {
        ret.push(`${encodeURIComponent(key)}=${encodeURIComponent(value)}`);
      }
    }
    return `?${ret.join('&')}`;
  }

  _multiIdRequest(
      endpoint, params, idName, pageSize = 100, maxIdsPerRequest = 100) {
    const ids = params[idName];
    let promises = [];
    for (let start = 0; start < ids.length; start += maxIdsPerRequest) {
      const idsForRequest = ids.slice(start, start + maxIdsPerRequest);
      const paramsForRequest = Object.assign({}, params);
      paramsForRequest[idName] = idsForRequest;
      promises.push(
          this._paginatedApiRequest(endpoint, paramsForRequest, pageSize));
    }

    return new Promise((resolve, reject) => {
      Promise.all(promises).then(results => {
        let retVal = {data: []};
        for (const result of results) {
          retVal.data = retVal.data.concat(result.data);
        }
        resolve(retVal);
      });
    });
  }

  // Helper method to call _apiRequest request repeatedly while accumulating
  // results in data field of the response.
  // pageSize == 0 means don't fetch multiple pages. Useful if we don't need
  // contents of data but only size. ie. only fetching followers count.
  _paginatedApiRequest(endpoint, params, pageSize = 100) {
    if (pageSize === 0) {
      return this._apiRequest(endpoint, params);
    }
    return new Promise(async (resolve, reject) => {
      try {
        let results = {data: []};
        let cursor = null;
        while (true) {
          let paramsCopy = Object.assign({}, params);
          paramsCopy.first = pageSize;
          if (cursor) {
            paramsCopy.after = cursor;
          }
          let result = await this._apiRequest(endpoint, paramsCopy);
          results.data = results.data.concat(result.data);
          cursor = result.pagination ? result.pagination.cursor : null;
          if (!cursor || results.data.length >= result.total) {
            results.total = results.data.length;
            break;
          }
        }
        resolve(results);
      } catch (e) {
        reject(e);
      }
    });
  }

  _apiRequest(endpoint, params) {
    return new Promise((resolve, reject) => {
      let xhr = new XMLHttpRequest();
      let url = BASE_URL + endpoint + this._formatParamsInURL(params);
      xhr.open('GET', url, true);
      xhr.setRequestHeader('Client-ID', this.clientId);
      if (this.bearerId) {
        xhr.setRequestHeader('Authorization', `Bearer ${this.bearerId}`);
      }
      xhr.onreadystatechange = function() {
        if (xhr.readyState === 4) {
          if (xhr.status === 200) {
            resolve(JSON.parse(xhr.responseText));
          } else {
            reject({status: xhr.status});
          }
        }
      };
      xhr.send();
    });
  }
}
