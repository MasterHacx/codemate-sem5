document.addEventListener("DOMContentLoaded", () => {
  // --- 1. INITIALIZATION ---
  try {
    firebase.initializeApp(firebaseConfig);
  } catch (e) {
    console.error("Firebase could not initialize. Check your config.", e);
    return;
  }

  const auth = firebase.auth();
  const db = firebase.firestore();

  // --- 2. HELPER FUNCTIONS ---
  // --- Helper for showing user-friendly messages (Toasts) ---
  const showToast = (message, type = "success") => {
    const container = document.getElementById("toast-container");
    if (!container) return;

    const toast = document.createElement("div");
    toast.className = `toast ${type}`;
    toast.textContent = message;
    container.appendChild(toast);

    setTimeout(() => toast.classList.add("show"), 100);
    setTimeout(() => {
      toast.classList.remove("show");
      setTimeout(() => toast.remove(), 500);
    }, 4000);
  };

  // --- Helper for showing loading states on buttons ---
  const setButtonLoading = (form, isLoading) => {
    const button = form.querySelector('button[type="submit"]');
    if (!button) return;

    if (!button.dataset.originalText) {
      button.dataset.originalText = button.innerHTML;
    }

    if (isLoading) {
      button.disabled = true;
      button.innerHTML = `<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Loading...`;
    } else {
      button.disabled = false;
      button.innerHTML = button.dataset.originalText;
    }
  };

  // --- 3. CORE LOGIC: AUTH STATE OBSERVER ---
  // This runs on every page and keeps the UI in sync with the user's login state.
  auth.onAuthStateChanged((user) => {
    // First, let the CSS know that JS has checked the auth state to prevent flickering
    document.body.classList.add("firebase-ready");

    const navLoginLink = document.getElementById("nav-login-link");
    const navUserControls = document.getElementById("nav-user-controls");

    if (user) {
      // --- User is LOGGED IN ---
      if (navLoginLink) navLoginLink.style.display = "none";
      if (navUserControls) navUserControls.style.display = "flex";

      // Run page-specific logic for logged-in users
      handleDashboardLogic(user);
      handleTutorialPageLogic(user);
    } else {
      // --- User is LOGGED OUT ---
      if (navLoginLink) navLoginLink.style.display = "list-item";
      if (navUserControls) navUserControls.style.display = "none";

      // Run page-specific logic for logged-out users
      handleDashboardLogic(null);
      handleTutorialPageLogic(null);
    }
  });

  // --- 4. PAGE-SPECIFIC LOGIC ---

  function handleDashboardLogic(user) {
    const userNameHeading = document.getElementById("user-name-heading");
    if (!userNameHeading) return; // Exit if not on the dashboard page
    if (user) {
      db.collection("users")
        .doc(user.uid)
        .get()
        .then((doc) => {
          if (doc.exists) {
            const userData = doc.data();
            userNameHeading.textContent = userData.fullName;

            const completedTopics = userData.completedTopics || {};
            const passedQuizzes = userData.passedQuizzes || {};

            document.getElementById("lessons-completed-stat").textContent =
              Object.keys(completedTopics).length;
            document.getElementById("quizzes-passed-stat").textContent =
              Object.keys(passedQuizzes).length;
          }
        });
    } else {
      userNameHeading.textContent = "Welcome! Please log in.";
    }
  }

  function handleTutorialPageLogic(user) {
    const markCompleteBtn = document.getElementById("mark-complete-btn");
    if (!markCompleteBtn) return; // Exit if not on a tutorial page

    if (user) {
      const topicId = markCompleteBtn.dataset.topicId;
      checkAndUpdateCompletionStatus(user.uid, topicId);

      // Ensure the event listener is only added once
      if (!markCompleteBtn.dataset.listenerAttached) {
        markCompleteBtn.addEventListener("click", () => {
          markTopicAsComplete(user.uid, topicId);
        });
        markCompleteBtn.dataset.listenerAttached = "true";
      }
    } else {
      markCompleteBtn.style.display = "none";
    }
  }

  // --- 5. DATA MANAGEMENT FUNCTIONS (for tutorials) ---
  // Function to update the UI based on completion status
  const checkAndUpdateCompletionStatus = (userId, currentTopicId) => {
    db.collection("users")
      .doc(userId)
      .get()
      .then((doc) => {
        const completed =
          doc.exists && doc.data().completedTopics
            ? doc.data().completedTopics
            : {};

        const mainButton = document.getElementById("mark-complete-btn");
        if (mainButton) {
          if (completed[currentTopicId]) {
            mainButton.textContent = "Completed ✓";
            mainButton.disabled = true;
            mainButton.classList.replace("btn-secondary", "btn-success");
          } else {
            // Ensure button state is reset if not completed
            mainButton.textContent = "Mark as Complete";
            mainButton.disabled = false;
            mainButton.classList.replace("btn-success", "btn-secondary");
          }
        }

        // Update sidebar links (checkmark icons) for ALL topics
        document.querySelectorAll(".tutorial-sidebar a").forEach((link) => {
          const topicId = link.dataset.topicId;
          const checkmarkIcon = link.querySelector(".completion-checkmark");
          if (topicId && checkmarkIcon) {
            if (completed[topicId]) {
              checkmarkIcon.style.display = "inline-block";
            } else {
              // Ensure checkmark is hidden if topic is not completed
              checkmarkIcon.style.display = "none";
            }
          }
        });
      })
      .catch((e) => console.error("Error fetching user progress:", e));
  };

  // Function to save a topic as complete in Firestore
  const markTopicAsComplete = (userId, topicId) => {
    const userProgressRef = db.collection("users").doc(userId);
    const updateData = { [`completedTopics.${topicId}`]: true };

    userProgressRef
      .update(updateData)
      .then(() => {
        showToast("Progress Saved!", "success");
        checkAndUpdateCompletionStatus(userId, topicId);
      })
      .catch((error) => {
        if (
          error.code === "not-found" ||
          error.message.includes("No document to update")
        ) {
          userProgressRef
            .set({ completedTopics: { [topicId]: true } }, { merge: true })
            .then(() => {
              showToast("Progress Saved!", "success");
              checkAndUpdateCompletionStatus(userId, topicId);
            })
            .catch((err) =>
              showToast("Error saving progress: " + err.message, "error")
            );
        } else {
          showToast("Error saving progress: " + error.message, "error");
        }
      });
  };

  // --- 6. AUTHENTICATION ACTION HANDLERS ---

  // Signup Form Handler
  const signupForm = document.getElementById("signup-form");
  if (signupForm) {
    signupForm.addEventListener("submit", (e) => {
      e.preventDefault();
      setButtonLoading(signupForm, true);
      const fullName = signupForm.fullname.value.trim();
      const email = signupForm.email.value.trim();
      const password = signupForm.password.value;

      if (password !== signupForm["confirm-password"].value) {
        showToast("Passwords do not match!", "error");
        setButtonLoading(signupForm, false);
        return;
      }

      auth
        .createUserWithEmailAndPassword(email, password)
        .then((userCredential) => {
          return db.collection("users").doc(userCredential.user.uid).set({
            fullName: fullName,
            email: email,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
          });
        })
        .then(() => {
          showToast(`Welcome, ${fullName}! Account created.`);
          window.location.href = "/dashboard";
        })
        .catch((error) => {
          showToast("Signup failed: " + error.message, "error");
          setButtonLoading(signupForm, false);
        });
    });
  }

  // Login Form Handler
  const loginForm = document.getElementById("login-form");
  if (loginForm) {
    loginForm.addEventListener("submit", (e) => {
      e.preventDefault();
      setButtonLoading(loginForm, true);
      const email = loginForm.email.value.trim();
      const password = loginForm.password.value;

      auth
        .signInWithEmailAndPassword(email, password)
        .then(() => {
          window.location.href = "/dashboard";
        })
        .catch((error) => {
          showToast("Login failed: " + error.message, "error");
          setButtonLoading(loginForm, false);
        });
    });
  }

  // Forgot Password Form Handler
  const forgotPasswordForm = document.getElementById("forgot-password-form");
  if (forgotPasswordForm) {
    forgotPasswordForm.addEventListener("submit", (e) => {
      e.preventDefault();
      setButtonLoading(forgotPasswordForm, true);
      const email = forgotPasswordForm.email.value.trim();

      auth
        .sendPasswordResetEmail(email)
        .then(() => {
          showToast("Password reset link sent! Check your email inbox.");
          setButtonLoading(forgotPasswordForm, false);
        })
        .catch((error) => {
          showToast("Error: " + error.message, "error");
          setButtonLoading(forgotPasswordForm, false);
        });
    });
  }

  // Google Sign-In Handler (for both login and signup pages)
  const handleGoogleSignIn = () => {
    const provider = new firebase.auth.GoogleAuthProvider();
    auth
      .signInWithPopup(provider)
      .then((result) => {
        const user = result.user;
        const userDocRef = db.collection("users").doc(user.uid);
        return userDocRef.get().then((doc) => {
          if (!doc.exists) {
            // Create profile if new user
            return userDocRef.set({
              fullName: user.displayName,
              email: user.email,
              createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            });
          }
        });
      })
      .then(() => {
        window.location.href = "/dashboard";
      })
      .catch((error) => {
        showToast("Google Sign-In failed: " + error.message, "error");
      });
  };

  const googleSignInBtn = document.getElementById("google-signin-btn");
  if (googleSignInBtn)
    googleSignInBtn.addEventListener("click", handleGoogleSignIn);

  const googleSignUpBtn = document.getElementById("google-signup-btn");
  if (googleSignUpBtn)
    googleSignUpBtn.addEventListener("click", handleGoogleSignIn);

  // Logout Button Handler
  const logoutButton = document.getElementById("logout-button");
  if (logoutButton) {
    logoutButton.addEventListener("click", () => {
      auth
        .signOut()
        .then(() => {
          window.location.href = "/";
        })
        .catch((error) => console.error("Logout Error:", error));
    });
  }
});
