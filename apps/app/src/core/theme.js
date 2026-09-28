// Applies the saved color theme before first paint. Loaded as a classic script in <head>.
// Saved per device for now; later also stored in the user's profile.
(function () {
  var THEMES = ['light', 'dark', 'white-blue', 'black-blue'];
  try {
    var t = localStorage.getItem('mx_theme');
    if (THEMES.indexOf(t) !== -1) document.documentElement.setAttribute('data-theme', t);
  } catch (e) { /* storage blocked: follow device setting */ }
})();
