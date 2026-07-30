(function () {
  var TOKEN_KEY = 'cm_token';
  var LOGIN_TIME_KEY = 'cm_loginTime';
  var SESSION_TIMEOUT = 3600000;

  var token = sessionStorage.getItem(TOKEN_KEY) || localStorage.getItem(TOKEN_KEY);
  var loginTime = parseInt(
    sessionStorage.getItem(LOGIN_TIME_KEY) || localStorage.getItem(LOGIN_TIME_KEY) || '0',
    10
  );

  var authenticated = false;

  if (token && loginTime) {
    var elapsed = Date.now() - loginTime;
    if (elapsed < SESSION_TIMEOUT) {
      authenticated = true;
      sessionStorage.setItem(TOKEN_KEY, token);
      sessionStorage.setItem(LOGIN_TIME_KEY, loginTime.toString());
    } else {
      sessionStorage.removeItem(TOKEN_KEY);
      sessionStorage.removeItem(LOGIN_TIME_KEY);
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(LOGIN_TIME_KEY);
    }
  }

  window.__cosmicMemoirAuth = {
    authenticated: authenticated,
    token: token || null
  };

  if (!authenticated) {
    sessionStorage.setItem('cm_redirect', window.location.pathname);
    window.location.replace('./login.html');
  }
})();
