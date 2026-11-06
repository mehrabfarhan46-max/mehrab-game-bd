
const API_URL = "http://localhost:4000/api";

const form = document.getElementById("forgotForm");
const emailSection = document.getElementById("emailSection");
const otpSection = document.getElementById("otpSection");
const passwordSection = document.getElementById("passwordSection");

const message = document.getElementById("message");
const sendButton = document.getElementById("sendButton");
const verifyButton = document.getElementById("verifyButton");
const resendButton = document.getElementById("resendButton");
const resetButton = document.getElementById("resetButton");

let resetToken = "";

function showMessage(text, color = "#fca5a5") {
  message.textContent = text;
  message.style.color = color;
}

function getEmail() {
  return document.getElementById("email").value.trim().toLowerCase();
}

async function postRequest(endpoint, body) {
  const response = await fetch(`${API_URL}/user-auth/${endpoint}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Request failed.");
  }

  return data;
}

// Send OTP
form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const email = getEmail();

  if (!email) {
    showMessage("Please enter your email.");
    return;
  }

  sendButton.disabled = true;
  sendButton.textContent = "Sending OTP...";
  showMessage("");

  try {
    await postRequest("forgot-password/send-otp", { email });

    emailSection.classList.add("hidden");
    otpSection.classList.remove("hidden");

    showMessage(
      "If the account exists, an OTP will be sent to its email.",
      "#86efac"
    );
  } catch (error) {
    showMessage(error.message);
  } finally {
    sendButton.disabled = false;
    sendButton.textContent = "Send OTP";
  }
});

// Verify OTP
verifyButton.addEventListener("click", async () => {
  const email = getEmail();
  const otp = document.getElementById("otp").value.trim();

  if (!/^\d{6}$/.test(otp)) {
    showMessage("Enter a valid 6-digit OTP.");
    return;
  }

  verifyButton.disabled = true;
  verifyButton.textContent = "Verifying...";
  showMessage("");

  try {
    const data = await postRequest("forgot-password/verify-otp", {
      email,
      otp
    });

    if (!data.resetToken) {
      throw new Error("Password reset verification failed.");
    }

    resetToken = data.resetToken;

    otpSection.classList.add("hidden");
    passwordSection.classList.remove("hidden");

    showMessage("OTP verified. Set your new password.", "#86efac");
  } catch (error) {
    showMessage(error.message);
  } finally {
    verifyButton.disabled = false;
    verifyButton.textContent = "Verify OTP";
  }
});

// Resend OTP
resendButton.addEventListener("click", async () => {
  resendButton.disabled = true;
  resendButton.textContent = "Sending...";

  try {
    await postRequest("forgot-password/send-otp", {
      email: getEmail()
    });

    document.getElementById("otp").value = "";
    showMessage("If the account exists, a new OTP will be sent.", "#86efac");
  } catch (error) {
    showMessage(error.message);
  } finally {
    resendButton.disabled = false;
    resendButton.textContent = "Resend OTP";
  }
});

// Reset password
resetButton.addEventListener("click", async () => {
  const newPassword = document.getElementById("newPassword").value;
  const confirmPassword = document.getElementById("confirmPassword").value;

  if (newPassword.length < 8) {
    showMessage("Password must be at least 8 characters.");
    return;
  }

  if (newPassword !== confirmPassword) {
    showMessage("Passwords do not match.");
    return;
  }

  if (!resetToken) {
    showMessage("Please verify your OTP first.");
    return;
  }

  resetButton.disabled = true;
  resetButton.textContent = "Updating...";
  showMessage("");

  try {
    await postRequest("forgot-password/reset", {
      resetToken,
      newPassword
    });

    resetToken = "";
    showMessage("Password updated successfully. Please login.", "#86efac");

    passwordSection.classList.add("hidden");

    setTimeout(() => {
      location.href = "login.html";
    }, 1500);
  } catch (error) {
    showMessage(error.message);
  } finally {
    resetButton.disabled = false;
    resetButton.textContent = "Reset Password";
  }
});
