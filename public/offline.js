(function () {
  function back() { location.reload(); }
  window.addEventListener("online", back);
  setInterval(function () {
    fetch("/api/ping", { cache: "no-store" }).then(function (r) { if (r.ok || r.status === 204) back(); }).catch(function () {});
  }, 5000);
})();
