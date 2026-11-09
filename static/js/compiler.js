document.addEventListener("DOMContentLoaded", () => {
  let editor;

  //  Load Code from Tutorial Page
  // This runs ONCE when the compiler page loads.
  const loadCodeFromTutorial = (editorInstance) => {
    const dataToLoadJSON = localStorage.getItem("codeToLoadInCompiler");
    if (dataToLoadJSON) {
      try {
        const dataToLoad = JSON.parse(dataToLoadJSON);

        // Set the code in the editor
        editorInstance.setValue(dataToLoad.code);

        // The language dropdown is already set by the URL, so no need to change it here.
      } catch (e) {
        console.error("Error parsing code from localStorage", e);
      } finally {
        // IMPORTANT: Clear the data so it doesn't load again on refresh.
        localStorage.removeItem("codeToLoadInCompiler");
      }
    }
  };

  // --- Helper function for showing user-friendly messages (Toasts) ---
  const showToast = (message, type = "error") => {
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

  // --- Helper function to add "Copy" buttons to code blocks ---
  const addCopyButtons = (parentElement) => {
    parentElement.querySelectorAll("pre").forEach((block) => {
      if (block.querySelector(".copy-btn")) return;
      const button = document.createElement("button");
      button.innerText = "Copy";
      button.className = "copy-btn";
      block.appendChild(button);
      button.addEventListener("click", () => {
        const code = block.querySelector("code").innerText;
        navigator.clipboard.writeText(code);
        button.innerText = "Copied!";
        setTimeout(() => (button.innerText = "Copy"), 2000);
      });
    });
  };

  // --- All setup functions are called here ---
  setupResizablePanes();
  editor = setupCodeMirror();
  loadCodeFromTutorial(editor);
  setupAIPanel(editor);
  setupMobileTabs();
  setupRunButton(editor);
  setupThemeSync(editor);

  // --- Function Definitions ---
  function setupResizablePanes() {
    if (window.innerWidth > 992) {
      Split(["#editor-pane", "#io-pane"], {
        sizes: [65, 35],
        minSize: [400, 250],
        gutterSize: 8,
      });
      Split(["#input-pane", "#output-pane"], {
        direction: "vertical",
        sizes: [30, 70],
        minSize: [50, 100],
        gutterSize: 8,
      });
    }
  }

  function setupCodeMirror() {
    const editorElement = document.getElementById("code-editor");
    const languageSelect = document.getElementById("language-select");

    // Add "Hello World" for all new languages
    const defaultCode = {
      python: 'print("Hello from CODEMATE!")',
      cpp: '#include <iostream>\n\nint main() {\n    std::cout << "Hello from CODEMATE!";\n    return 0;\n}',
      java: 'class Main {\n    public static void main(String[] args) {\n        System.out.println("Hello from CODEMATE!");\n    }\n}',
      kotlin: 'fun main() {\n    println("Hello from CODEMATE!")\n}',
      javascript: 'console.log("Hello from CODEMATE!");',
      go: 'package main\nimport "fmt"\n\nfunc main() {\n    fmt.Println("Hello from CODEMATE!")\n}',
      c: '#include <stdio.h>\n\nint main() {\n    printf("Hello from CODEMATE!");\n    return 0;\n}',
      csharp:
        'using System;\n\nclass Program {\n    static void Main() {\n        Console.WriteLine("Hello from CODEMATE!");\n    }\n}',
      rust: 'fn main() {\n    println!("Hello from CODEMATE!");\n}',
      swift: 'print("Hello from CODEMATE!")',
    };

    // Read the language from "special note" (data attribute) first.
    const initialLanguage =
      languageSelect.dataset.selectedLanguage || languageSelect.value;

    const initialTheme = document.body.classList.contains("dark-mode")
      ? "dracula"
      : "neat";

    const codeEditorInstance = CodeMirror(editorElement, {
      value: defaultCode[initialLanguage],
      mode: initialLanguage,
      theme: initialTheme,
      lineNumbers: true,
      autofocus: true,
    });

    // This event listener is still needed for manual changes.
    languageSelect.addEventListener("change", () => {
      const newLang = languageSelect.value;
      let mode = newLang;
      if (["cpp", "java", "kotlin"].includes(newLang)) {
        mode = "text/x-c++src";
      }
      codeEditorInstance.setOption("mode", mode);
      codeEditorInstance.setValue(defaultCode[newLang]);
    });

    return codeEditorInstance;
  }

  function setupAIPanel(editorInstance) {
    const aiToggleButton = document.getElementById("ai-toggle-btn");
    const aiCloseButton = document.getElementById("ai-close-btn");
    const aiPanel = document.getElementById("ai-panel");
    const aiSendBtn = document.getElementById("ai-send-btn");
    const aiInput = document.getElementById("ai-input");
    const aiBody = document.querySelector(".ai-panel-body");
    const aiPlaceholder = document.querySelector(".ai-placeholder");

    if (aiToggleButton)
      aiToggleButton.addEventListener("click", () =>
        aiPanel.classList.toggle("open")
      );
    if (aiCloseButton)
      aiCloseButton.addEventListener("click", () =>
        aiPanel.classList.remove("open")
      );

    const handleSendQuery = () => {
      const query = aiInput.value.trim();
      if (!query || !aiSendBtn.disabled === false) return;

      aiSendBtn.disabled = true;

      if (aiPlaceholder) aiPlaceholder.style.display = "none";

      const code = editorInstance.getValue();
      const language = document.getElementById("language-select").value;

      const userMessageDiv = document.createElement("div");
      userMessageDiv.className = "ai-message user-message";
      userMessageDiv.textContent = query;
      aiBody.appendChild(userMessageDiv);
      aiInput.value = "";
      aiBody.scrollTop = aiBody.scrollHeight;

      const typingDiv = document.createElement("div");
      typingDiv.className = "ai-message ai-typing";
      typingDiv.textContent = "CODEMATE is thinking...";
      aiBody.appendChild(typingDiv);
      aiBody.scrollTop = aiBody.scrollHeight;

      fetch("/ask-ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: query, code: code, language: language }),
      })
        .then((response) => response.json())
        .then((result) => {
          typingDiv.remove();

          const aiMessageDiv = document.createElement("div");
          aiMessageDiv.className = "ai-message";

          // Use marked.js to convert Markdown to HTML
          aiMessageDiv.innerHTML = marked.parse(
            result.response || "Sorry, I couldn't generate a response."
          );

          // Add syntax highlighting to the new code blocks
          aiMessageDiv.querySelectorAll("pre code").forEach((block) => {
            hljs.highlightElement(block);
          });

          aiBody.appendChild(aiMessageDiv);
          addCopyButtons(aiMessageDiv);
          aiBody.scrollTop = aiBody.scrollHeight;
        })
        .catch((error) => {
          typingDiv.remove();
          showToast("Error communicating with AI.", "error");
        })
        .finally(() => {
          aiSendBtn.disabled = false;
        });
    };

    aiSendBtn.addEventListener("click", handleSendQuery);
    aiInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSendQuery();
      }
    });
  }

  function setupMobileTabs() {
    const showCodeBtn = document.getElementById("show-code-btn");
    const showIoBtn = document.getElementById("show-io-btn");
    const editorPane = document.getElementById("editor-pane");
    const ioPane = document.getElementById("io-pane");

    if (!showCodeBtn) return;

    showCodeBtn.addEventListener("click", () => {
      editorPane.classList.add("active");
      ioPane.classList.remove("active");
      showCodeBtn.classList.add("active");
      showIoBtn.classList.remove("active");
    });

    showIoBtn.addEventListener("click", () => {
      ioPane.classList.add("active");
      editorPane.classList.remove("active");
      showIoBtn.classList.add("active");
      showCodeBtn.classList.remove("active");
    });
  }

  function setupThemeSync(editorInstance) {
    const themeToggle = document.querySelector(
      ".compiler-controls .theme-toggle"
    );
    if (!themeToggle) return;

    themeToggle.addEventListener("click", () => {
      setTimeout(() => {
        const isDarkMode = document.body.classList.contains("dark-mode");
        editorInstance.setOption("theme", isDarkMode ? "dracula" : "neat");
      }, 10);
    });
  }

  function setupRunButton(editorInstance) {
    const runBtn = document.getElementById("run-btn");
    const outputArea = document.getElementById("output-area");
    const inputArea = document.getElementById("input-area");
    const languageSelect = document.getElementById("language-select");

    runBtn.addEventListener("click", () => {
      const code = editorInstance.getValue();
      const language = languageSelect.value;
      const input = inputArea.value;

      runBtn.disabled = true;
      runBtn.innerHTML = `<span class="spinner-border spinner-border-sm"></span> Running...`;
      outputArea.textContent = "Executing...";

      fetch("/run-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ language, code, input }),
      })
        .then((response) => response.json())
        .then((result) => {
          outputArea.textContent = result.output;
        })
        .catch((error) => {
          outputArea.textContent = "An error occurred: " + error;
        })
        .finally(() => {
          runBtn.disabled = false;
          runBtn.innerHTML = `<i class="fas fa-play"></i> Run`;
        });
    });
  }
});
