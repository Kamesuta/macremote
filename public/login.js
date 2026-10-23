const params = new URLSearchParams(location.search);
if (params.has('error')) {
  document.getElementById('error').textContent = 'Wrong password.';
}
document.getElementById('h').value = params.get('h') ?? '';
