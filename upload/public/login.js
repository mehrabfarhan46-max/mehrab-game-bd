
const API_URL = "http://localhost:4000/api";

const form = document.getElementById("playerLoginForm");
const button = document.getElementById("loginButton");
const message = document.getElementById("loginMessage");

function showMessage(text, color = "#fca5a5") {
  message.style.color = color;
  message.textContent = text;
}

function getNextPage() {
  const next = new URLSearchParams(location.search).get("next");

  // Only allow a local page path.
  if (next && !next.startsWith("//") && !next.includes("://")) {
    return next;
  }

  return "profile.html";
}

function finishLogin(data) {
  if (!data || !data.success || !data.token || !data.user) {
    throw new Error(data?.message || "Login failed.");
  }

  sessionStorage.setItem("playerToken", data.token);
  sessionStorage.setItem("playerProfile", JSON.stringify(data.user));

  showMessage("Login successful!", "#86efac");
  location.href = getNextPage();
}

// Email + Password Login
form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;

  button.disabled = true;
  button.textContent = "Logging in...";
  showMessage("");

  try {
    const response = await fetch(`${API_URL}/user-auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || "Login failed.");
    }

    finishLogin(data);
  } catch (error) {
    showMessage(
      error.message === "Failed to fetch"
        ? "Server is not connected yet."
        : error.message
    );
  } finally {
    button.disabled = false;
    button.textContent = "Login";
  }
});

// Google Login
window.handleGoogleLogin = async function(response) {
  if (!response || !response.credential) {
    showMessage("Google account verification failed.");
    return;
  }

  const googleContainer = document.getElementById("googleButtonContainer");
  googleContainer.style.pointerEvents = "none";
  googleContainer.style.opacity = "0.6";
  showMessage("Verifying Google account...", "#7dd3fc");

  try {
    const result = await fetch(`${API_URL}/user-auth/google`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        credential: response.credential
      })
    });

    const data = await result.json();

    if (!result.ok) {
      throw new Error(data.message || "Google login failed.");
    }

    finishLogin(data);
  } catch (error) {
    showMessage(
      error.message === "Failed to fetch"
        ? "Server is not connected yet."
        : error.message
    );
  } finally {
    googleContainer.style.pointerEvents = "auto";
    googleContainer.style.opacity = "1";
  }
};
