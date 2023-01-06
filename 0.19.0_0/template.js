const cache = new Map();

export const importTemplate = async path => {
  if (!cache.has(path)) {
    cache.set(
      path,
      fetch(path)
        .then(response => response.text())
        .then(text => {
          const template = document.createElement('template');
          template.innerHTML = text;

          return template;
        }),
    );
  }

  return (await cache.get(path)).content.cloneNode(true);
};
