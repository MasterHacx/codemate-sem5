document.addEventListener("DOMContentLoaded", () => {
  // We can only run this logic if firebase is available and a user is logged in
  if (typeof firebase === "undefined") return;

  const auth = firebase.auth();
  const db = firebase.firestore();

  auth.onAuthStateChanged((user) => {
    if (user) {
      // User is logged in, let's fetch and render their progress
      initializeProgressDashboard(user.uid);
    }
  });

  const initializeProgressDashboard = async (userId) => {
    const progressGrid = document.getElementById("progress-cards-grid");
    if (!progressGrid) return;

    try {
      // Step 1: Fetch the entire structure of all available tutorials
      const tutorialsStructure = await fetchAllTutorialsStructure();

      // Step 2: Fetch the user's specific progress
      const userProgress = await fetchUserProgress(userId);

      // Step 3: Combine the data and render the cards
      renderProgressCards(tutorialsStructure, userProgress, progressGrid);
    } catch (error) {
      console.error("Error initializing dashboard progress:", error);
      progressGrid.innerHTML = "<p>Could not load your progress.</p>";
    }
  };

  // Fetches the structure (total lessons) for all languages/categories
  const fetchAllTutorialsStructure = async () => {
    const structure = {};
    const categoriesSnapshot = await db.collection("tutorials").get();

    for (const categoryDoc of categoriesSnapshot.docs) {
      const categoryId = categoryDoc.id;
      structure[categoryId] = { totalTopics: 0, lessons: {} };

      const lessonsSnapshot = await db
        .collection("tutorials")
        .doc(categoryId)
        .collection("lessons")
        .get();
      for (const lessonDoc of lessonsSnapshot.docs) {
        const lessonId = lessonDoc.id;
        const topicsSnapshot = await db
          .collection("tutorials")
          .doc(categoryId)
          .collection("lessons")
          .doc(lessonId)
          .collection("topics")
          .get();
        const topicCount = topicsSnapshot.size;

        structure[categoryId].totalTopics += topicCount;
        // We can add more detailed lesson info here if needed in the future
      }
    }
    return structure;
  };

  // Fetches the user's completed topics
  const fetchUserProgress = async (userId) => {
    const userDoc = await db.collection("users").doc(userId).get();
    if (userDoc.exists) {
      return userDoc.data().completedTopics || {};
    }
    return {};
  };

  // Renders the final progress cards
  const renderProgressCards = (structure, userProgress, gridElement) => {
    gridElement.innerHTML = ""; // Clear the "Loading..." message

    for (const categoryId in structure) {
      if (structure[categoryId].totalTopics === 0) continue; // Skip empty categories

      // Calculate progress for this category
      let completedCount = 0;
      for (const topicId in userProgress) {
        if (topicId.startsWith(categoryId)) {
          completedCount++;
        }
      }

      const totalCount = structure[categoryId].totalTopics;
      const percentage =
        totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

      // Determine button text and link
      let buttonText = "Start Learning";
      let buttonLink = `/tutorials/${categoryId}`;
      if (completedCount > 0 && completedCount < totalCount) {
        buttonText = "Continue Learning";
      } else if (completedCount === totalCount) {
        buttonText = "Completed! 🎉";
      }

      const cardHTML = `
                <div class="progress-card">
                    <div class="progress-card-header">
                        <img src="/static/img/${categoryId}.svg" alt="${categoryId} icon">
                        <h4>${
                          categoryId.charAt(0).toUpperCase() +
                          categoryId.slice(1)
                        }</h4>
                    </div>
                    <p class="progress-stats-text">${completedCount} / ${totalCount} Topics Completed</p>
                    <div class="progress-bar-container">
                        <div class="progress-bar-fill" style="width: ${percentage}%;"></div>
                    </div>
                    <a href="${buttonLink}" class="btn ${
        completedCount === totalCount ? "btn-success" : "btn-primary"
      }">${buttonText}</a>
                </div>
            `;
      gridElement.insertAdjacentHTML("beforeend", cardHTML);
    }
  };
});
