import type { WebSearchResult } from '../types';

export const SERP_PARSER_JS = `(function () {
  try {
    var post = function (msg) {
      window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify(msg));
    };

    var MAX = 10;
    var MIN_TITLE_GENERIC = 15;

    var deref = function (href) {
      var m = /[?&]uddg=([^&]+)/.exec(href || '');
      if (m) { try { return decodeURIComponent(m[1]); } catch (e) {} }
      return href;
    };

    var textOf = function (el) {
      return ((el && (el.innerText || el.textContent)) || '').replace(/\\s+/g, ' ').trim();
    };

    var hrefOf = function (el) {
      return (el && (el.href || (el.getAttribute && el.getAttribute('href')))) || '';
    };

    var hostOf = function (url) {
      var m = /^(?:https?:)?\\/\\/([^\\/?#]+)/.exec(url || '');
      return m ? m[1].toLowerCase() : '';
    };

    var ENGINE_HOST = /(^|\\.)(duckduckgo\\.com|mojeek\\.com)$/;

    var results = [];
    var seen = {};
    var add = function (title, url, snippet, minTitle) {
      url = deref(url);
      if (!url || !/^(https?:)?\\/\\//.test(url)) return;
      if (ENGINE_HOST.test(hostOf(url)) || seen[url]) return;
      title = (title || '').trim();
      if (title.length < minTitle) return;
      seen[url] = 1;
      results.push({ title: title, url: url, snippet: (snippet || '').trim() });
    };

    var CONTAINERS = [
      { box: 'div.result, .result--url-above-snippet, article[data-testid="result"], .result',
        link: 'a.result__a, a[data-testid="result-title-a"], h2 a, h3 a, a',
        snip: '.result__snippet, [data-testid="result-snippet"]' },
      { box: 'ul.results-standard li, ol.results li, li.result',
        link: 'h2 a, a.title, a',
        snip: 'p.s, .s, .snippet' }
    ];
    for (var s = 0; s < CONTAINERS.length && results.length === 0; s++) {
      var boxes = document.querySelectorAll(CONTAINERS[s].box);
      for (var i = 0; i < boxes.length && results.length < MAX; i++) {
        var link = boxes[i].querySelector(CONTAINERS[s].link);
        if (!link) continue;
        add(textOf(link), hrefOf(link), textOf(boxes[i].querySelector(CONTAINERS[s].snip)), 1);
      }
    }

    var nearSnippet = function (el) {
      var SEL = '.result-snippet, .result__snippet, td.result-snippet';
      var hop = el.closest ? el.closest('tr') : null;
      for (var k = 0; k < 3 && hop; k++) {
        hop = hop.nextElementSibling;
        if (!hop) break;
        var found = hop.querySelector ? hop.querySelector(SEL) : null;
        if (found) return found;
        if (String(hop.className || '').indexOf('result-snippet') >= 0) return hop;
      }
      return null;
    };
    if (results.length === 0) {
      var links = document.querySelectorAll(
        'a.result-link, a.result__a, a[data-testid="result-title-a"]'
      );
      for (var j = 0; j < links.length && results.length < MAX; j++) {
        add(textOf(links[j]), hrefOf(links[j]), textOf(nearSnippet(links[j])), 1);
      }
    }

    if (results.length === 0) {
      var all = document.querySelectorAll('a[href]');
      for (var n = 0; n < all.length && results.length < MAX; n++) {
        add(textOf(all[n]), hrefOf(all[n]), '', MIN_TITLE_GENERIC);
      }
    }

    if (results.length > 0) {
      post({ type: 'serp-results', results: results });
      return;
    }

    var challengeEl = document.querySelector(
      'iframe[src*="recaptcha"], iframe[src*="hcaptcha"], iframe[src*="turnstile"],' +
      ' form[action*="challenge"], #challenge-form, #challenge-running,' +
      ' #cf-challenge-running, .cf-browser-verification, #captcha, #captcha-container'
    );
    var text = ((document.body && document.body.innerText) || '').slice(0, 4000);
    var title = document.title || '';
    var phrase = /are you a robot|unusual traffic|verify you are human|verify you're human|checking your browser|enable javascript and cookies|just a moment|attention required/i;
    if (challengeEl || phrase.test(title) || phrase.test(text)) {
      post({ type: 'serp-challenge' });
      return;
    }

    post({ type: 'serp-results', results: [] });
  } catch (e) {
    window.ReactNativeWebView && window.ReactNativeWebView.postMessage(
      JSON.stringify({ type: 'serp-error', message: String(e) })
    );
  }
})();
true;`;

export type SerpMessage =
  | { type: 'serp-results'; results: WebSearchResult[] }
  | { type: 'serp-challenge' }
  | { type: 'serp-error'; message: string };

const isWebSearchResult = (value: unknown): value is WebSearchResult =>
  !!value &&
  typeof value === 'object' &&
  typeof (value as WebSearchResult).url === 'string' &&
  typeof (value as WebSearchResult).title === 'string';

export const parseSerpMessage = (raw: string): SerpMessage | null => {
  try {
    const parsed = JSON.parse(raw) as {
      type?: string;
      results?: unknown;
      message?: unknown;
    };
    if (parsed.type === 'serp-challenge') return { type: 'serp-challenge' };
    if (parsed.type === 'serp-error') {
      return { type: 'serp-error', message: String(parsed.message) };
    }
    if (parsed.type === 'serp-results') {
      const results = Array.isArray(parsed.results)
        ? parsed.results.filter(isWebSearchResult)
        : [];
      return { type: 'serp-results', results };
    }
    return null;
  } catch {
    return null;
  }
};
