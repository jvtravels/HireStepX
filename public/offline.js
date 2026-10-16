(function () {
  function back() { location.reload(); }

  // The service worker serves this page at the URL the person asked for, so the
  // path says which side of the product they were on.
  if (location.pathname.indexOf("/employer") === 0) {
    var msg = document.getElementById("msg");
    if (msg) msg.textContent = "We can\u2019t reach HireStepX right now. Your jobs and candidates are safe. Anything you changed but hadn\u2019t saved won\u2019t go through until you\u2019re back online.";
  }
  var retry = document.getElementById("retry");
  if (retry) retry.addEventListener("click", function (e) { e.preventDefault(); back(); });

  window.addEventListener("online", back);
  setInterval(function () {
    fetch("/api/ping", { cache: "no-store" }).then(function (r) { if (r.ok || r.status === 204) back(); }).catch(function () {});
  }, 5000);
})();
