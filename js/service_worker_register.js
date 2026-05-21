// Register service worker for offline app
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("js/service_worker.js");
}
