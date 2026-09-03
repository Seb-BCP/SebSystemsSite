(function () {
  'use strict';

  const config = window.SITE_CONFIG || {};
  const root = document.documentElement;
  const nav = document.querySelector('[data-site-nav]');
  const toggle = document.querySelector('[data-menu-toggle]');
  const navLinks = nav ? Array.from(nav.querySelectorAll('a')) : [];
  const pageCache = new Map();
  const pageNodes = new Map();
  const pageNodeCacheOrder = [];
  const pageNodeCacheLimit = 2;
  const warmedImageSources = new Set();
  const reducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let slider = null;
  let pageCacheMount = null;
  let navIndicator = null;
  let activeRoute = null;
  let isNavigating = false;

  const routeKey = function (url) {
    const path = new URL(url, window.location.href).pathname;
    if (path.endsWith('/index.html')) return path.slice(0, -'index.html'.length) || '/';
    return path || '/';
  };

  const isNavigationPage = function (url) {
    const destination = new URL(url, window.location.href);
    return destination.origin === window.location.origin && navLinks.some(function (link) {
      return routeKey(link.href) === routeKey(destination.href);
    });
  };

  const getPageCacheMount = function () {
    if (pageCacheMount) return pageCacheMount;
    pageCacheMount = document.createElement('div');
    pageCacheMount.className = 'page-slider__cache';
    pageCacheMount.setAttribute('aria-hidden', 'true');
    if ('inert' in pageCacheMount) pageCacheMount.inert = true;
    document.body.appendChild(pageCacheMount);
    return pageCacheMount;
  };

  const storePage = function (page) {
    if (!page) return;
    const key = page.dataset.pageRoute;
    page.removeAttribute('id');
    page.setAttribute('aria-hidden', 'true');
    if ('inert' in page) page.inert = true;
    getPageCacheMount().appendChild(page);

    if (!key) return;
    pageNodes.set(key, page);
    const existingIndex = pageNodeCacheOrder.indexOf(key);
    if (existingIndex !== -1) pageNodeCacheOrder.splice(existingIndex, 1);
    pageNodeCacheOrder.push(key);

    while (pageNodeCacheOrder.length > pageNodeCacheLimit) {
      const oldestKey = pageNodeCacheOrder.shift();
      const oldestPage = pageNodes.get(oldestKey);
      if (oldestPage && oldestPage !== page) oldestPage.remove();
      pageNodes.delete(oldestKey);
    }
  };

  const getSlider = function () {
    if (slider) return slider;

    const main = document.querySelector('main#main') || document.querySelector('main');
    if (!main) return null;

    slider = document.createElement('div');
    slider.className = 'page-slider';
    main.parentNode.insertBefore(slider, main);
    slider.appendChild(main);
    return slider;
  };

  const positionNavIndicator = function (link, immediate) {
    if (!navIndicator || !link) return;
    if (immediate) navIndicator.style.transition = 'none';
    navIndicator.style.width = link.offsetWidth + 'px';
    navIndicator.style.height = link.offsetHeight + 'px';
    navIndicator.style.transform = 'translate3d(' + link.offsetLeft + 'px, ' + link.offsetTop + 'px, 0)';
    if (immediate) {
      navIndicator.getBoundingClientRect();
      navIndicator.style.transition = '';
    }
  };

  const updateNavigationState = function (url, immediate) {
    const destination = routeKey(url);
    let selectedLink = null;
    navLinks.forEach(function (link) {
      const selected = routeKey(link.href) === destination;
      if (selected) {
        link.setAttribute('aria-current', 'page');
        selectedLink = link;
      }
      else link.removeAttribute('aria-current');
    });
    positionNavIndicator(selectedLink, immediate);
  };

  const parsePage = function (html, url) {
    const parsed = new DOMParser().parseFromString(html, 'text/html');
    const main = parsed.querySelector('main');
    if (!main) throw new Error('The requested page does not contain main content.');

    const description = parsed.querySelector('meta[name="description"]');
    return {
      url: new URL(url, window.location.href).href,
      title: parsed.title,
      description: description ? description.content : '',
      mainMarkup: main.outerHTML
    };
  };

  const loadPage = function (url) {
    const destination = new URL(url, window.location.href);
    const key = routeKey(destination.href);
    if (!pageCache.has(key)) {
      pageCache.set(key, fetch(destination.href, { credentials: 'same-origin' })
        .then(function (response) {
          if (!response.ok) throw new Error('Page request failed.');
          return response.text();
        })
        .then(function (html) { return parsePage(html, destination.href); })
        .catch(function (error) {
          pageCache.delete(key);
          throw error;
        }));
    }
    return pageCache.get(key);
  };

  const createMain = function (record) {
    const template = document.createElement('template');
    template.innerHTML = record.mainMarkup.trim();
    return template.content.firstElementChild;
  };

  const getPageNode = function (record) {
    const key = routeKey(record.url);
    let page = pageNodes.get(key);
    const existingIndex = pageNodeCacheOrder.indexOf(key);
    if (existingIndex !== -1) pageNodeCacheOrder.splice(existingIndex, 1);
    if (!page) {
      page = createMain(record);
      page.dataset.pageRoute = key;
      page.dataset.pageInitialised = 'true';
      initialisePageContent(page);
      pageNodes.set(key, page);
    }
    page.removeAttribute('aria-hidden');
    if ('inert' in page) page.inert = false;
    return page;
  };

  const warmPageImages = function (record) {
    const template = document.createElement('template');
    template.innerHTML = record.mainMarkup.trim();
    Array.from(template.content.querySelectorAll('img[src]')).slice(0, 2).forEach(function (image) {
      const source = new URL(image.getAttribute('src'), record.url).href;
      if (warmedImageSources.has(source)) return;
      warmedImageSources.add(source);
      const preload = new Image();
      preload.src = source;
    });
  };

  const updateDocumentDetails = function (record) {
    document.title = record.title;
    const description = document.querySelector('meta[name="description"]');
    if (description && record.description) description.content = record.description;
  };

  const initialisePageContent = function (scope) {
    const projectTabs = Array.from(scope.querySelectorAll('[data-project-tab]'));
    if (projectTabs.length) {
      const activateProjectTab = function (tab, focusTab) {
        const panelId = tab.getAttribute('aria-controls');
        const activePanel = panelId ? scope.querySelector('#' + panelId) : null;
        if (!activePanel) return;

        projectTabs.forEach(function (candidate) {
          const selected = candidate === tab;
          candidate.setAttribute('aria-selected', String(selected));
          candidate.tabIndex = selected ? 0 : -1;

          const candidatePanelId = candidate.getAttribute('aria-controls');
          const candidatePanel = candidatePanelId ? scope.querySelector('#' + candidatePanelId) : null;
          if (candidatePanel) candidatePanel.hidden = !selected;
        });

        if (focusTab) tab.focus();
      };

      projectTabs.forEach(function (tab, index) {
        tab.addEventListener('click', function () { activateProjectTab(tab, false); });
        tab.addEventListener('keydown', function (event) {
          let nextIndex = null;
          if (event.key === 'ArrowRight' || event.key === 'ArrowDown') nextIndex = (index + 1) % projectTabs.length;
          if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') nextIndex = (index - 1 + projectTabs.length) % projectTabs.length;
          if (event.key === 'Home') nextIndex = 0;
          if (event.key === 'End') nextIndex = projectTabs.length - 1;

          if (nextIndex !== null) {
            event.preventDefault();
            activateProjectTab(projectTabs[nextIndex], true);
          }
        });
      });
    }

    scope.querySelectorAll('[data-photo]').forEach(function (img) {
      img.addEventListener('error', function () { img.style.display = 'none'; });
      if (img.complete && img.naturalWidth === 0) img.style.display = 'none';
    });

    const loomHost = scope.querySelector('[data-loom-host]');
    if (loomHost && config.loomEmbedUrl) {
      const iframe = document.createElement('iframe');
      iframe.src = config.loomEmbedUrl;
      iframe.title = 'Blue Collar People case example walkthrough';
      iframe.allow = 'autoplay; fullscreen; picture-in-picture';
      iframe.allowFullscreen = true;
      loomHost.innerHTML = '';
      loomHost.appendChild(iframe);
    }

    const loomPlayer = scope.querySelector('[data-loom-player]');
    if (loomPlayer) {
      scope.querySelectorAll('[data-loom-open]').forEach(function (trigger) {
        trigger.addEventListener('click', function () { loomPlayer.src = loomPlayer.dataset.loomSrc; });
      });
      scope.querySelectorAll('[data-loom-close]').forEach(function (trigger) {
        trigger.addEventListener('click', function () { loomPlayer.src = 'about:blank'; });
      });
    }

    scope.querySelectorAll('[data-contact-email]').forEach(function (link) {
      if (config.contactEmail) {
        link.href = 'mailto:' + config.contactEmail;
        link.textContent = config.contactEmail;
      }
    });

    const form = scope.querySelector('[data-contact-form]');
    const status = scope.querySelector('[data-form-status]');
    if (form) {
      if (config.contactFormAction) {
        form.action = config.contactFormAction;
      } else {
        form.addEventListener('submit', function (event) {
          event.preventDefault();
          if (config.contactEmail) {
            const data = new FormData(form);
            const subject = encodeURIComponent('Small business systems inquiry');
            const body = encodeURIComponent(
              'Name: ' + (data.get('name') || '') + '\n' +
              'Business: ' + (data.get('business') || '') + '\n' +
              'Phone: ' + (data.get('phone') || '') + '\n' +
              'Suburb: ' + (data.get('suburb') || '') + '\n\n' +
              'Process causing trouble:\n' + (data.get('problem') || '') + '\n\n' +
              'Current process:\n' + (data.get('current_process') || '') + '\n\n' +
              'What they are after:\n' + (data.get('what_after') || '')
            );
            if (status) status.textContent = 'Message sent, I will be in touch shortly.';
            window.location.href = 'mailto:' + config.contactEmail + '?subject=' + subject + '&body=' + body;
          } else if (status) {
            status.textContent = 'The inquiry form is ready, but the email or form endpoint still needs to be added in assets/site-config.js.';
          }
        });
      }
    }

    scope.querySelectorAll('[data-year]').forEach(function (el) { el.textContent = new Date().getFullYear(); });
  };

  const replacePage = function (record) {
    const stage = getSlider();
    if (!stage) return null;

    const outgoing = stage.querySelector('main');
    const incoming = getPageNode(record);
    incoming.id = 'main';
    if (outgoing && outgoing !== incoming) storePage(outgoing);
    stage.replaceChildren(incoming);
    updateDocumentDetails(record);
    updateNavigationState(record.url);
    return incoming;
  };

  const transitionFallback = function (record, direction) {
    const stage = getSlider();
    const outgoing = stage && stage.querySelector('main');
    if (!stage || !outgoing) return Promise.resolve();

    const incoming = getPageNode(record);
    incoming.id = 'main-incoming';
    incoming.setAttribute('aria-hidden', 'true');
    stage.appendChild(incoming);

    const stageHeight = Math.max(outgoing.offsetHeight, incoming.offsetHeight);
    stage.style.height = stageHeight + 'px';
    outgoing.classList.add('page-slider__pane', 'page-slider__pane--outgoing');
    incoming.classList.add('page-slider__pane', 'page-slider__pane--incoming');
    stage.classList.add('page-slider--transitioning', direction === 'backward' ? 'page-slider--backward' : 'page-slider--forward');
    outgoing.setAttribute('aria-hidden', 'true');
    if ('inert' in outgoing) outgoing.inert = true;

    updateDocumentDetails(record);
    updateNavigationState(record.url);

    return new Promise(function (resolve) {
      requestAnimationFrame(function () {
        requestAnimationFrame(function () { stage.classList.add('page-slider--moving'); });
      });
      window.setTimeout(function () {
        incoming.id = 'main';
        incoming.removeAttribute('aria-hidden');
        storePage(outgoing);
        incoming.classList.remove('page-slider__pane', 'page-slider__pane--incoming');
        stage.classList.remove('page-slider--transitioning', 'page-slider--moving', 'page-slider--backward', 'page-slider--forward');
        stage.style.height = '';
        activeRoute = routeKey(record.url);
        window.scrollTo(0, 0);
        resolve();
      }, 460);
    });
  };

  const navigateTo = async function (url, historyMode) {
    if (isNavigating || !isNavigationPage(url)) return;
    const destination = new URL(url, window.location.href);
    if (routeKey(destination.href) === activeRoute) return;

    isNavigating = true;
    if (nav) nav.classList.remove('is-open');

    try {
      const record = await loadPage(destination.href);
      const currentIndex = navLinks.findIndex(function (link) { return routeKey(link.href) === activeRoute; });
      const nextIndex = navLinks.findIndex(function (link) { return routeKey(link.href) === routeKey(destination.href); });
      const direction = nextIndex < currentIndex ? 'backward' : 'forward';

      if (historyMode === 'push') history.pushState({ pageSlider: true }, '', destination.href);

      if (reducedMotion) {
        replacePage(record);
        activeRoute = routeKey(record.url);
        window.scrollTo(0, 0);
      } else {
        await transitionFallback(record, direction);
      }
    } catch (error) {
      window.location.assign(destination.href);
      return;
    } finally {
      isNavigating = false;
    }
  };

  if (toggle && nav) {
    toggle.addEventListener('click', function () {
      const open = nav.classList.toggle('is-open');
      toggle.setAttribute('aria-expanded', String(open));
      window.requestAnimationFrame(function () {
        positionNavIndicator(nav.querySelector('[aria-current="page"]'), true);
      });
    });

    navLinks.forEach(function (link) {
      link.addEventListener('click', function (event) {
        const isPlainPrimaryClick = !event.defaultPrevented && event.button === 0 &&
          !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey && !link.target;
        if (!isPlainPrimaryClick || !isNavigationPage(link.href)) return;
        event.preventDefault();
        navigateTo(link.href, 'push');
      });
    });
  }

  window.addEventListener('popstate', function () {
    if (isNavigationPage(window.location.href)) navigateTo(window.location.href, 'none');
  });

  activeRoute = routeKey(window.location.href);
  const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  const mayPrefetch = !connection || (!connection.saveData && !/2g/.test(connection.effectiveType || ''));
  if (mayPrefetch && navLinks.length) {
    const prefetch = function () {
      const remainingLinks = navLinks.filter(function (link) { return routeKey(link.href) !== activeRoute; });
      const prefetchNext = function () {
        const link = remainingLinks.shift();
        if (!link) return;
        loadPage(link.href).catch(function () {}).finally(function () {
          window.setTimeout(prefetchNext, 40);
        });
      };
      prefetchNext();
    };
    if (window.requestIdleCallback) window.requestIdleCallback(prefetch, { timeout: 1200 });
    else window.setTimeout(prefetch, 450);
  }

  if (nav) {
    navIndicator = document.createElement('span');
    navIndicator.className = 'site-nav__active-indicator';
    navIndicator.setAttribute('aria-hidden', 'true');
    nav.appendChild(navIndicator);
    nav.classList.add('has-active-indicator');
    positionNavIndicator(nav.querySelector('[aria-current="page"]'), true);

    const refreshIndicator = function () {
      positionNavIndicator(nav.querySelector('[aria-current="page"]'), true);
    };
    if (window.ResizeObserver) new ResizeObserver(refreshIndicator).observe(nav);
    else window.addEventListener('resize', refreshIndicator);

    navLinks.forEach(function (link) {
      const warmDestination = function () {
        loadPage(link.href).then(warmPageImages).catch(function () {});
      };
      link.addEventListener('mouseenter', warmDestination, { once: true });
      link.addEventListener('focus', warmDestination, { once: true });
      link.addEventListener('touchstart', warmDestination, { once: true, passive: true });
    });
  }

  const initialMain = document.querySelector('main#main') || document.querySelector('main');
  if (initialMain) {
    pageNodes.set(activeRoute, initialMain);
    initialMain.dataset.pageRoute = activeRoute;
    initialMain.dataset.pageInitialised = 'true';
    initialisePageContent(initialMain);
  }
})();
