/* Vellour mirror: this copy of the site is static, accounts and everything else live on the real server.
   The page's own API calls are sent there (the session token is a header, so no cookies are involved). */
(function () {
  var API = "https://vellour.wintervisuals.workers.dev";
  window.VELLOUR_API = API;
  var nativeFetch = window.fetch ? window.fetch.bind(window) : null;
  if (nativeFetch) window.fetch = function (input, init) {
    if (typeof input === 'string' && /^\/(api\/|configs\/download\/|media\/)/.test(input)) input = API + input;
    return nativeFetch(input, init);
  };
  // links to files that the server hands out (config downloads) are built by the page as /configs/download/<id>
  document.addEventListener('click', function (e) {
    var a = e.target && e.target.closest ? e.target.closest('a[href^="/configs/download/"]') : null;
    if (a) a.href = API + a.getAttribute('href');
  }, true);
})();
