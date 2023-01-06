/**
 * Copyright (C) 2019 Opera Software AS. All rights reserved.
 * This file is an original work developed by Opera Software AS
 */

import {importTemplate} from '../template.js';

const LONG_HOVER_TIME = 300; // ms
const GAME_IMAGE_HEIGHT = 70;
const GAME_IMAGE_HEIGHT_TO_WIDTH = 0.75;
const GAME_IMAGE_WIDTH = parseInt(
    GAME_IMAGE_HEIGHT * GAME_IMAGE_HEIGHT_TO_WIDTH,
);

export class StreamIcon extends HTMLElement {
  constructor() {
    super();
    this.addEventListener('mouseenter', evt => this.onMouseEnter());
    this.addEventListener('mouseleave', evt => this.onMouseLeave());
  }

  async connectedCallback() {
    if (!this.shadowRoot) {
      const template = await importTemplate('./components/stream_icon.html');
      const shadowRoot = this.attachShadow({mode: 'open'});
      shadowRoot.appendChild(template);
    }
    this.render();
  }

  static observedAttributes = [
    'name',
    'avatar',
    'stream-url',
    'stream-title',
    'game-title',
    'game-image',
    'live',
    'game-image-display-mode',
    'long-hovered',
    'display-mode',
  ];

  attributeChangedCallback() {
    this.render();
  }

  getActualGameImageUrl(urlTemplate) {
    if (!urlTemplate) {
      return null;
    }

    return urlTemplate.replace('{width}', GAME_IMAGE_WIDTH)
        .replace('{height}', GAME_IMAGE_HEIGHT);
  }

  render() {
    if (!this.shadowRoot) {
      return;
    }

    const streamName = this.getAttribute('name');
    const streamerAvatar = this.getAttribute('avatar');
    const streamUrl = this.getAttribute('stream-url');
    const streamTitle = this.getAttribute('stream-title');
    const gameitle = this.getAttribute('game-title');
    const gameImage = this.getActualGameImageUrl(
        this.getAttribute('game-image'),
    );
    const gameImageDisplayMode = this.getAttribute('game-image-display-mode');
    const displayMode = this.getAttribute('display-mode');
    const isLive = this.getAttribute('live') === 'true';
    const isDummy = this.getAttribute('dummy') === 'true';
    const isLongHovered = this.getAttribute('long-hovered') === 'true';

    const linkElement = this.shadowRoot.querySelector('#stream-icon_link');
    const imageElement = this.shadowRoot.querySelector('#stream-icon_image');
    const gameImageElement = this.shadowRoot.querySelector(
        '#stream-icon_game-image',
    );

    const gameImageFake = this.shadowRoot.querySelector('svg.gameIcon');

    const detailsElement = this.shadowRoot.querySelector(
        '#stream-icon_details',
    );
    const nameElement = this.shadowRoot.querySelector('#stream-icon_name');
    const titleElement = this.shadowRoot.querySelector('#stream-icon_title');
    const gameTitleElement = this.shadowRoot.querySelector(
        '#stream-icon_game-title',
    );

    linkElement.href = streamUrl;
    linkElement.classList.toggle('active', isLive);
    linkElement.classList.toggle('dummy', isDummy);

    linkElement.title =
        streamTitle ? `${streamName} - ${streamTitle}` : streamName;

    if (streamerAvatar) {
      imageElement.src = streamerAvatar;
    } else {
      this.setGameImageClasses(
          [gameImageFake],
          gameImageDisplayMode,
          isLongHovered,
      );
    }

    if (gameImage) {
      gameImageElement.src = gameImage;
      this.setGameImageClasses(
          [gameImageElement, gameImageFake],
          gameImageDisplayMode,
          isLongHovered,
      );
    } else {
      this.setGameImageClasses([gameImageElement], 'hidden');
    }

    nameElement.textContent = streamName;
    titleElement.textContent = streamTitle;
    gameTitleElement.textContent = gameitle;

    switch (displayMode) {
      case 'details':
        detailsElement.classList.toggle('hidden', false);
        break;

      default:
      case 'icons':
        detailsElement.classList.toggle('hidden', true);
        break;
    }
  }

  setGameImageClasses(elements, mode, isLongHovered) {
    elements.forEach(element => {
      element.classList.remove('hidden');
      element.classList.remove('small');
      element.classList.remove('large');
      element.classList.remove('slide-in-start');
      element.classList.remove('slide-in-end');

      element.classList.add(mode);
      element.classList.toggle('long-hovered', isLongHovered);
    });
  }

  onMouseEnter() {
    this.onLongHoverTimer = setTimeout(
        () => this.onLongHover(),
        LONG_HOVER_TIME,
    );
  }

  onLongHover() {
    this.dispatchEvent(new Event('longHover', {bubbles: true}));
  }

  onMouseLeave() {
    clearTimeout(this.onLongHoverTimer);
  }
}

customElements.define('stream-icon', StreamIcon);
