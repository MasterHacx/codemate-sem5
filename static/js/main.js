document.addEventListener("DOMContentLoaded", () => {
  // Initialize all UI components when the page is ready.
  setupMobileNav();
  setupThemeToggle();
  setupPasswordToggles();
  setupTutorialSidebar();

  // --- Function Definitions ---

  //Handles the mobile navigation menu (hamburger icon).
  function setupMobileNav() {
    const navToggle = document.querySelector(".nav-toggle");
    const mainNav = document.querySelector(".main-nav");
    if (!navToggle || !mainNav) return;

    const icon = navToggle.querySelector("i");
    const toggleNavIcon = (isOpen) => {
      icon.classList.toggle("fa-times", isOpen);
      icon.classList.toggle("fa-bars", !isOpen);
    };

    navToggle.addEventListener("click", () => {
      mainNav.classList.toggle("mobile-nav");
      toggleNavIcon(mainNav.classList.contains("mobile-nav"));
    });

    mainNav.querySelectorAll("a").forEach((link) => {
      link.addEventListener("click", () => {
        if (mainNav.classList.contains("mobile-nav")) {
          mainNav.classList.remove("mobile-nav");
          toggleNavIcon(false);
        }
      });
    });
  }

  //Handles the light/dark theme toggle and saves the preference.
  // This now works for ALL theme toggle buttons on the page.
  function setupThemeToggle() {
    const themeToggles = document.querySelectorAll(".theme-toggle"); // UPGRADE: Select all buttons
    const body = document.body;
    if (themeToggles.length === 0) return;

    const updateIcons = () => {
      const isDarkMode = body.classList.contains("dark-mode");
      themeToggles.forEach((button) => {
        const icon = button.querySelector("i");
        icon.classList.toggle("fa-sun", isDarkMode);
        icon.classList.toggle("fa-moon", !isDarkMode);
      });
    };

    // On page load, apply the saved theme
    if (localStorage.getItem("theme") === "dark-mode") {
      body.classList.add("dark-mode");
    }
    updateIcons();

    // Add a click event to every theme toggle button
    themeToggles.forEach((button) => {
      button.addEventListener("click", () => {
        body.classList.toggle("dark-mode");
        // Save the new preference
        localStorage.setItem(
          "theme",
          body.classList.contains("dark-mode") ? "dark-mode" : "light-mode"
        );
        updateIcons();
      });
    });
  }

  //Handles all password field show/hide toggles.
  function setupPasswordToggles() {
    document.querySelectorAll(".password-toggle-icon").forEach((icon) => {
      icon.addEventListener("click", function () {
        const passwordField = this.previousElementSibling;
        if (passwordField.type === "password") {
          passwordField.type = "text";
          this.classList.replace("fa-eye", "fa-eye-slash");
        } else {
          passwordField.type = "password";
          this.classList.replace("fa-eye-slash", "fa-eye");
        }
      });
    });
  }

  // Handles the tutorial page's sidebar toggle for mobile.

  function setupTutorialSidebar() {
    const sidebarToggle = document.querySelector(".sidebar-toggle");
    const tutorialSidebar = document.querySelector(".tutorial-sidebar");
    if (!sidebarToggle || !tutorialSidebar) return;

    sidebarToggle.addEventListener("click", () => {
      tutorialSidebar.classList.toggle("open");
    });

    // Close sidebar when clicking outside of it on mobile
    document.addEventListener("click", (event) => {
      if (
        tutorialSidebar.classList.contains("open") &&
        !tutorialSidebar.contains(event.target) &&
        !sidebarToggle.contains(event.target)
      ) {
        tutorialSidebar.classList.remove("open");
      }
    });
  }
});
