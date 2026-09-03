
(function () {
  const config = window.SITE_CONFIG || {};

  const toggle = document.querySelector('[data-menu-toggle]');
  const nav = document.querySelector('[data-site-nav]');
  const root = document.documentElement;
  const reducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const supportsCrossDocumentTransitions = window.CSS && CSS.supports && CSS.supports('view-transition-name: site-nav-active');

  if (root.classList.contains('site-page-slide-enter')) {
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        root.classList.add('site-page-slide-enter-active');
        window.setTimeout(function () {
          root.classList.remove('site-page-slide-enter', 'site-page-slide-enter-active');
        }, 260);
      });
    });
  }

  if (toggle && nav) {
    toggle.addEventListener('click', function () {
      const open = nav.classList.toggle('is-open');
      toggle.setAttribute('aria-expanded', String(open));
    });
    nav.querySelectorAll('a').forEach(function (link) {
      link.addEventListener('click', function (event) {
        nav.classList.remove('is-open');

        const destination = new URL(link.href, window.location.href);
        const isInternalPage = destination.origin === window.location.origin &&
          destination.pathname !== window.location.pathname &&
          !link.target && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;

        if (!isInternalPage || reducedMotion || supportsCrossDocumentTransitions) return;

        event.preventDefault();
        try { sessionStorage.setItem('site-page-slide-enter', destination.pathname); } catch (error) {}
        root.classList.add('site-page-slide-leave');
        window.setTimeout(function () { window.location.assign(destination.href); }, 220);
      });
    });
  }

  const projectTabs = Array.from(document.querySelectorAll('[data-project-tab]'));
  if (projectTabs.length) {
    const activateProjectTab = function (tab, focusTab) {
      const panelId = tab.getAttribute('aria-controls');
      const activePanel = panelId ? document.getElementById(panelId) : null;
      if (!activePanel) return;

      projectTabs.forEach(function (candidate) {
        const selected = candidate === tab;
        candidate.setAttribute('aria-selected', String(selected));
        candidate.tabIndex = selected ? 0 : -1;

        const candidatePanelId = candidate.getAttribute('aria-controls');
        const candidatePanel = candidatePanelId ? document.getElementById(candidatePanelId) : null;
        if (candidatePanel) candidatePanel.hidden = !selected;
      });

      if (focusTab) tab.focus();
    };

    projectTabs.forEach(function (tab, index) {
      tab.addEventListener('click', function () {
        activateProjectTab(tab, false);
      });

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

  document.querySelectorAll('[data-photo]').forEach(function (img) {
    img.addEventListener('error', function () { img.style.display = 'none'; });
    if (img.complete && img.naturalWidth === 0) img.style.display = 'none';
  });

  const loomHost = document.querySelector('[data-loom-host]');
  if (loomHost && config.loomEmbedUrl) {
    const iframe = document.createElement('iframe');
    iframe.src = config.loomEmbedUrl;
    iframe.title = 'Blue Collar People case example walkthrough';
    iframe.allow = 'autoplay; fullscreen; picture-in-picture';
    iframe.allowFullscreen = true;
    loomHost.innerHTML = '';
    loomHost.appendChild(iframe);
  }

  const loomPlayer = document.querySelector('[data-loom-player]');
  if (loomPlayer) {
    document.querySelectorAll('[data-loom-open]').forEach(function (trigger) {
      trigger.addEventListener('click', function () {
        loomPlayer.src = loomPlayer.dataset.loomSrc;
      });
    });
    document.querySelectorAll('[data-loom-close]').forEach(function (trigger) {
      trigger.addEventListener('click', function () {
        loomPlayer.src = 'about:blank';
      });
    });
  }

  document.querySelectorAll('[data-contact-email]').forEach(function (link) {
    if (config.contactEmail) {
      link.href = 'mailto:' + config.contactEmail;
      link.textContent = config.contactEmail;
    }
  });

  const form = document.querySelector('[data-contact-form]');
  const status = document.querySelector('[data-form-status]');
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
          if (status) {
            status.textContent = 'Message sent, I will be in touch shortly.';
          }
          window.location.href = 'mailto:' + config.contactEmail + '?subject=' + subject + '&body=' + body;
        } else if (status) {
          status.textContent = 'The inquiry form is ready, but the email or form endpoint still needs to be added in assets/site-config.js.';
        }
      });
    }
  }

  document.querySelectorAll('[data-year]').forEach(function (el) {
    el.textContent = new Date().getFullYear();
  });
})();
