if (new URLSearchParams(location.search).has('error')) {
  document.getElementById('error').textContent = 'Wrong password.';
}
