// Smoke test: confirm the frontend can reach the Flask backend.
fetch("/api/health")
  .then((res) => res.json())
  .then((data) => {
    document.getElementById("status").textContent =
      "Backend says: " + data.status;
  })
  .catch(() => {
    document.getElementById("status").textContent =
      "Could not reach backend.";
  });
