/**
 * Copyright (C) 2019 Opera Software AS. All rights reserved.
 * This file is an original work developed by Opera Software AS
 */

import {importTemplate} from '../template.js';
import './stream_icon.js';

class StreamList extends HTMLElement {
  channelList = [];

  async connectedCallback() {
    const template = await importTemplate('./components/stream_list.html');

    this.attachShadow({mode: 'open'});
    this.shadowRoot.appendChild(template);

    const streamList = this.shadowRoot.querySelector('#stream-list_list');

    streamList.addEventListener('longHover', evt => {
      this.onChannelLongHover(evt.target);
    });
    streamList.addEventListener('mouseout', evt => {
      this.onChannelMouseOut(evt.target);
    });

    this.render();
  }

  static observedAttributes = ['filter', 'hover-mode', 'display-mode'];

  attributeChangedCallback() {
    this.render();
  }

  getActualGameImageUrl(urlTemplate) {
    const GAME_IMAGE_HEIGHT = 70;
    const GAME_IMAGE_WIDTH = parseInt(GAME_IMAGE_HEIGHT * 0.75);

    if (!urlTemplate) {
      return null;
    }

    return urlTemplate
      .replace('{width}', GAME_IMAGE_WIDTH)
      .replace('{height}', GAME_IMAGE_HEIGHT);
  }

  streamFitsFilter(stream, filter) {
    return (
      !filter || stream.name.toLowerCase().indexOf(filter.toLowerCase()) >= 0
    );
  }

  findLastInRow(element) {
    let lastElementInRow = element;

    while (true) {
      const next = lastElementInRow.nextElementSibling;

      if (!next) {
        break;
      }

      const nextElemRect = next.getBoundingClientRect();
      const currentElemRect = lastElementInRow.getBoundingClientRect();

      if (nextElemRect.top > currentElemRect.top) {
        break;
      }

      lastElementInRow = next;
    }

    return lastElementInRow;
  }

  onChannelMouseOut(channelElement) {
    channelElement.removeAttribute('long-hovered');
  }

  onChannelLongHover(channelElement) {
    channelElement.setAttribute('long-hovered', true);
    this.removeDetailsLine();

    if (
      this.getAttribute('hover-mode') === 'slide-in' ||
      this.getAttribute('hover-mode') === 'small-to-large' ||
      channelElement.getAttribute('live') !== 'true'
    ) {
      return;
    }

    const streamsDetails = this.createStreamDetailsElement(channelElement);
    streamsDetails.classList.add('collapsed');

    const streamsElement = this.shadowRoot.querySelector('#stream-list_list');

    let lastElementInRow = this.findLastInRow(channelElement);

    streamsDetails.style.order = parseInt(lastElementInRow.style.order) + 1;
    streamsElement.appendChild(streamsDetails);
    setTimeout(e => streamsDetails.classList.remove('collapsed'), 0);
  }

  // TODO(wmaslowski): move to a component
  createStreamDetailsElement(channelElement) {
    const streamsDetails = document.createElement('span');
    const coverImage = document.createElement('img');
    const gameImageUrlTemplate = channelElement.getAttribute('game-image');

    if (gameImageUrlTemplate) {
      const GAME_IMAGE_HEIGHT = 70;
      const GAME_IMAGE_WIDTH = parseInt(GAME_IMAGE_HEIGHT * 0.75);
      let actualUrl = gameImageUrlTemplate
        .replace('{width}', GAME_IMAGE_WIDTH)
        .replace('{height}', GAME_IMAGE_HEIGHT);

      coverImage.src = actualUrl;
    }

    streamsDetails.appendChild(coverImage);

    const infoElem = document.createElement('div');
    infoElem.classList.add('stream-info');
    infoElem.id = 'info';
    streamsDetails.appendChild(infoElem);

    const gameTitle = document.createElement('div');
    gameTitle.classList.add('game-title');
    gameTitle.textContent = channelElement.getAttribute('game-title');
    infoElem.appendChild(gameTitle);

    const titleElem = document.createElement('div');
    titleElem.classList.add('stream-title');
    titleElem.textContent = channelElement.getAttribute('stream-title');
    infoElem.appendChild(titleElem);

    // TODO: translated strings
    const viewersElem = document.createElement('div');
    viewersElem.classList.add('viewers-count');
    viewersElem.textContent = `Viewers: ${channelElement.getAttribute(
      'viewers-count',
    )}`;
    infoElem.appendChild(viewersElem);
    streamsDetails.id = 'stream-details';

    return streamsDetails;
  }

  setStreamList(streamList) {
    this.channelList = streamList;
    this.render();
  }

  render() {
    if (!this.shadowRoot) {
      return;
    }

    const filter = this.getAttribute('filter');
    const hoverMode = this.getAttribute('hover-mode');
    const displayMode = this.getAttribute('display-mode');

    const listElement = this.shadowRoot.querySelector('#stream-list_list');
    const names = this.channelList.map(x => x.name);
    const nameToElement = {};
    const toRemove = [];

    for (let childElement of listElement.children) {
      if (childElement.tagName === 'STREAM-ICON') {
        const elementName = childElement.getAttribute('name');

        if (!names.includes(elementName)) {
          toRemove.push(childElement);
        } else {
          nameToElement[elementName] = childElement;
        }
      }
    }

    for (let elem of toRemove) {
      listElement.removeChild(elem);
    }

    let lastItem = null;
    let itemCounter = 0;

    for (let channel of this.channelList) {
      const itemInList = Object.keys(nameToElement).includes(channel.name);
      const item = itemInList
        ? nameToElement[channel.name]
        : document.createElement('stream-icon');
      item.setAttribute('name', channel.name);
      item.setAttribute('avatar', channel.iconUrl);
      item.setAttribute('stream-url', `https://www.twitch.tv/${channel.login}`);
      item.setAttribute('stream-title', channel.title);
      item.setAttribute('game-title', channel.gameTitle);
      item.setAttribute('viewers-count', channel.viewerCount);
      item.setAttribute('live', channel.isLive);
      item.setAttribute('dummy', channel.dummy);
      item.setAttribute('game-image', channel.gameImageUrl);

      if (!this.streamFitsFilter(channel, filter)) {
        item.setAttribute('hidden', true);

        if (item.getAttribute('long-hovered') === 'true') {
          this.removeDetailsLine();
        }
      } else {
        item.removeAttribute('hidden');
      }

      switch (hoverMode) {
        case 'details-line':
          item.setAttribute('game-image-display-mode', 'hidden');
          break;
        case 'slide-in':
          item.setAttribute('game-image-display-mode', 'slide-in-start');
          this.removeDetailsLine();
          break;
        case 'small-to-large':
          item.setAttribute('game-image-display-mode', 'small');
          this.removeDetailsLine();
          break;
      }

      item.setAttribute('display-mode', displayMode);

      item.style.order = itemCounter * 2;
      itemCounter++;

      const insertBeforeElement = lastItem
        ? lastItem.nextElementSibling
        : listElement.firstElementChild;
      listElement.insertBefore(item, insertBeforeElement);
      lastItem = item;
    }
  }

  removeDetailsLine() {
    let streamsDetails = this.shadowRoot.querySelector('#stream-details');

    if (streamsDetails) {
      streamsDetails.parentNode.removeChild(streamsDetails);
    }
  }
}

customElements.define('stream-list', StreamList);
