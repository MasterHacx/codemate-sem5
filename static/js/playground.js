document.addEventListener("DOMContentLoaded", () => {
  // We assume firebase is already initialized from base.html
  const db = firebase.firestore();
  const auth = firebase.auth();

  // --- 1. Get references to all HTML elements ---
  const categorySelect = document.getElementById("category-select");
  const lessonSelect = document.getElementById("lesson-select");
  const topicSelect = document.getElementById("topic-select");
  const quizContainer = document.getElementById("quiz-container");
  const submitBtn = document.getElementById("submit-quiz-btn");
  const quizResult = document.getElementById("quiz-result");

  // These variables will hold the state of the current quiz
  let currentQuizData = null;
  let currentTopicId = null;

  // --- 2. Logic to populate the dropdowns dynamically ---

  const populateCategories = () => {
    db.collection("quizzes")
      .get()
      .then((snapshot) => {
        snapshot.forEach((doc) => {
          const option = new Option(
            doc.id.charAt(0).toUpperCase() + doc.id.slice(1),
            doc.id
          );
          categorySelect.appendChild(option);
        });
      });
  };

  categorySelect.addEventListener("change", () => {
    const categoryId = categorySelect.value;
    lessonSelect.innerHTML = '<option value="">Select Lesson</option>';
    topicSelect.innerHTML = '<option value="">Select Topic</option>';
    lessonSelect.disabled = !categoryId;
    topicSelect.disabled = true;
    if (!categoryId) return;

    db.collection("quizzes")
      .doc(categoryId)
      .collection("lessons")
      .get()
      .then((snapshot) => {
        snapshot.forEach((doc) => {
          const option = new Option(
            doc.id.charAt(0).toUpperCase() + doc.id.slice(1),
            doc.id
          );
          lessonSelect.appendChild(option);
        });
      });
  });

  lessonSelect.addEventListener("change", () => {
    const categoryId = categorySelect.value;
    const lessonId = lessonSelect.value;
    topicSelect.innerHTML = '<option value="">Select Topic</option>';
    topicSelect.disabled = !lessonId;
    if (!lessonId) return;

    db.collection("quizzes")
      .doc(categoryId)
      .collection("lessons")
      .doc(lessonId)
      .collection("topics")
      .get()
      .then((snapshot) => {
        snapshot.forEach((doc) => {
          const text =
            doc.id.replace(/-/g, " ").charAt(0).toUpperCase() +
            doc.id.replace(/-/g, " ").slice(1);
          const option = new Option(text, doc.id);
          topicSelect.appendChild(option);
        });
      });
  });

  // --- 3. Logic to fetch and render the selected quiz ---

  topicSelect.addEventListener("change", () => {
    const categoryId = categorySelect.value;
    const lessonId = lessonSelect.value;
    const topicId = topicSelect.value;

    if (!topicId) {
      quizContainer.innerHTML =
        '<p class="quiz-placeholder">Please select a topic to begin a quiz.</p>';
      submitBtn.style.display = "none";
      return;
    }
    currentTopicId = `${categoryId}-${lessonId}-${topicId}`;

    db.collection("quizzes")
      .doc(categoryId)
      .collection("lessons")
      .doc(lessonId)
      .collection("topics")
      .doc(topicId)
      .get()
      .then((doc) => {
        if (doc.exists) {
          currentQuizData = doc.data();
          renderQuiz(currentQuizData.questions);
        }
      });
  });

  const renderQuiz = (questions) => {
    quizContainer.innerHTML = "";
    questions.forEach((q, index) => {
      const questionBlock = document.createElement("div");
      questionBlock.className = "question-block";
      let optionsHTML = '<ul class="options-list">';
      q.options.forEach((optionText, i) => {
        optionsHTML += `
                    <li class="option-item">
                        <input type="radio" id="q${index}_option${i}" name="question_${index}" value="${optionText}">
                        <label for="q${index}_option${i}">${optionText}</label>
                    </li>`;
      });
      optionsHTML += "</ul>";
      questionBlock.innerHTML = `<p>${index + 1}. ${
        q.question
      }</p>${optionsHTML}`;
      quizContainer.appendChild(questionBlock);
    });
    submitBtn.style.display = "block";
    submitBtn.textContent = "Submit Answers";
    submitBtn.disabled = false;
    quizResult.innerHTML = "";
  };

  // --- 4. Logic to handle quiz submission and results ---

  submitBtn.addEventListener("click", () => {
    const buttonText = submitBtn.textContent;

    if (buttonText === "Try Again") {
      renderQuiz(currentQuizData.questions);
      return;
    }

    if (buttonText === "Next Quiz →") {
      const nextIndex = topicSelect.selectedIndex + 1;
      if (nextIndex < topicSelect.options.length) {
        topicSelect.selectedIndex = nextIndex;
        topicSelect.dispatchEvent(new Event("change"));
      } else {
        quizResult.textContent =
          "You have completed all quizzes in this lesson!";
        quizResult.className = "quiz-result pass";
        submitBtn.style.display = "none";
      }
      return;
    }

    if (!currentQuizData) return;

    let score = 0;
    const userAnswers = currentQuizData.questions.map((q, index) => {
      const selected = document.querySelector(
        `input[name="question_${index}"]:checked`
      );
      if (selected && selected.value === q.answer) score++;
      return selected ? selected.value : null;
    });

    showFeedback(userAnswers);

    const total = currentQuizData.questions.length;
    if (score === total) {
      quizResult.textContent = `Congratulations! You passed! (${score}/${total})`;
      quizResult.className = "quiz-result pass";
      submitBtn.textContent = "Next Quiz →";
      submitBtn.disabled = false;
      saveQuizProgress(currentTopicId);
    } else {
      quizResult.textContent = `Not quite. Keep trying! (${score}/${total})`;
      quizResult.className = "quiz-result fail";
      submitBtn.textContent = "Try Again";
    }
  });

  const showFeedback = (userAnswers) => {
    currentQuizData.questions.forEach((q, index) => {
      document
        .querySelectorAll(`input[name="question_${index}"]`)
        .forEach((input) => {
          const label = input.nextElementSibling;
          if (input.value === q.answer) {
            label.classList.add("correct");
          } else if (input.value === userAnswers[index]) {
            label.classList.add("incorrect");
          }
        });
    });
  };

  const saveQuizProgress = (quizId) => {
    const user = auth.currentUser;
    if (!user) return;
    const userRef = db.collection("users").doc(user.uid);

    userRef
      .get()
      .then((doc) => {
        const data = doc.exists ? doc.data() : {};
        if (!data.passedQuizzes) data.passedQuizzes = {};
        data.passedQuizzes[quizId] = true;
        return userRef.set(data, { merge: true });
      })
      .then(() => console.log("Quiz progress saved!"));
  };

  // --- 5. Initial Load ---
  populateCategories();
});
