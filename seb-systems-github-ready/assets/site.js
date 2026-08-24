
(function () {
  const config = window.SITE_CONFIG || {};

  const toggle = document.querySelector('[data-menu-toggle]');
  const nav = document.querySelector('[data-site-nav]');
  if (toggle && nav) {
    toggle.addEventListener('click', function () {
      const open = nav.classList.toggle('is-open');
      toggle.setAttribute('aria-expanded', String(open));
    });
    nav.querySelectorAll('a').forEach(function (link) {
      link.addEventListener('click', function () { nav.classList.remove('is-open'); });
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
