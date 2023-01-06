/**
 * Copyright (C) 2019 Opera Software AS. All rights reserved.
 * This file is an original work developed by Opera Software AS
 */

const COLOR_DARKER_FACTOR = 0.52;
const COLOR_BACKGROUND_FACTOR = 0.27;

const BADGE_ACTIVE_BACKGROUND_COLOR = '#FFF';
const BADGE_ACTIVE_FONT_COLOR = '#000';

function HSLToRGB({h, s, l}) {
  let c = (1 - Math.abs(2 * l - 1)) * s,
      x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m = l - c / 2, r = 0, g = 0,
      b = 0;

  if (0 <= h && h < 60) {
    r = c;
    g = x;
    b = 0;
  } else if (60 <= h && h < 120) {
    r = x;
    g = c;
    b = 0;
  } else if (120 <= h && h < 180) {
    r = 0;
    g = c;
    b = x;
  } else if (180 <= h && h < 240) {
    r = 0;
    g = x;
    b = c;
  } else if (240 <= h && h < 300) {
    r = x;
    g = 0;
    b = c;
  } else if (300 <= h && h < 360) {
    r = c;
    g = 0;
    b = x;
  }
  r = Math.round((r + m) * 255);
  g = Math.round((g + m) * 255);
  b = Math.round((b + m) * 255);
  return {r, g, b};
}

export class Colors {
  constructor({isBackground = false} = {}) {
    this.isBackground = isBackground;
    this.isActive = false;

    this.setColor();
    this.registerEvents();
  }

  registerEvents() {
    opr.palette.onPaletteChanged.addListener(() => {
      this.setColor();
    });
  }

  async getColor() {
    return new Promise(resolve => {
      opr.palette.getColorHSL('gx_accent', colorObj => {
        resolve(HSLToRGB(colorObj), colorObj);
      });
    });
  }

  async setColor() {
    if (!this.isBackground) {
      this.changeTopBarColor();
    }

    if (this.isActive) {
      this.setBadgeActive();
    } else {
      this.setBadgeInactive();
    }

    opr.palette.getPalette(palette => {
      this.updatePalette(palette);
    });
  }

  updatePalette(palette) {
    const styles = document.documentElement.style;

    for (const paletteColor of palette) {
      opr.palette.getColorHSL(paletteColor, colorHSL => {
        const color = HSLToRGB(colorHSL);
        const cssStr = this.parseColor(color);
        styles.setProperty(`--palette-${paletteColor}`, cssStr);
        const valuesStr =
            `${colorHSL.h} ${colorHSL.s * 100}% ${colorHSL.l * 100}%`;
        styles.setProperty(`--palette-${paletteColor}-values`, valuesStr);
      });
    }
  }

  setBadgeActive() {
    this.isActive = true;

    opr.sidebarAction.setBadgeTextColor({
      color: BADGE_ACTIVE_FONT_COLOR,
    });

    opr.sidebarAction.setBadgeBackgroundColor({
      color: BADGE_ACTIVE_BACKGROUND_COLOR,
    });
  }

  async setBadgeInactive() {
    this.isActive = false;

    const colorObj = await this.getColor();

    this.isLighter(this.getLightness(colorObj));

    opr.sidebarAction.setBadgeTextColor({
      color: this.isLighter(this.getLightness(colorObj)) ? 'black' : 'white',
    });

    opr.sidebarAction.setBadgeBackgroundColor({
      color: [
        Math.round(colorObj.r),
        Math.round(colorObj.g),
        Math.round(colorObj.b),
        255,
      ],
    });
  }

  parseColor(color, factor = 1, alpha = undefined) {
    color.alpha = alpha !== undefined ? alpha : color.alpha || 255;
    const r = Math.min(Math.round(color.r * factor), 255);
    const g = Math.min(Math.round(color.g * factor), 255);
    const b = Math.min(Math.round(color.b * factor), 255);
    const a = Math.min(Math.round(color.alpha), 255);

    return `#${this.toHex(r)}${this.toHex(g)}${this.toHex(b)}${this.toHex(a)}`;
  }

  getLightness(colorObj) {
    return Math.round(((colorObj.r + colorObj.g + colorObj.b) * 20) / 153);
  }

  isLighter(lightness) {
    return lightness > 50;
  }

  async changeTopBarColor() {
    const colorObj = await this.getColor();

    const color = this.parseColor(colorObj);
    const darkerColor = this.parseColor(colorObj, COLOR_DARKER_FACTOR);
    const backgroundColor = this.parseColor(colorObj, COLOR_BACKGROUND_FACTOR);
    const transparentBackground = this.parseColor(colorObj, 1, 0.08 * 255);

    const styles = document.documentElement.style;

    const fontColor = this.isLighter(this.getLightness(colorObj))
      ? 'black'
      : 'white';

    styles.setProperty('--main-color', color);
    styles.setProperty('--main-darker-color', darkerColor);
    styles.setProperty('--main-background-color', backgroundColor);
    styles.setProperty(
        '--main-transparent-background-color',
        transparentBackground,
    );
    styles.setProperty('--main-font-color', fontColor);
  }

  toHex(number) {
    let hex = number.toString(16);
    while (hex.length < 2) {
      hex = `0${hex}`;
    }
    return hex;
  }
}
