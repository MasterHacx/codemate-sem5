document.addEventListener("DOMContentLoaded", () => {
  // This script runs on the tutorial pages to add interactive buttons to code blocks.
  const allCodeBlocks = document.querySelectorAll(".markdown-body pre");

  allCodeBlocks.forEach((preBlock) => {
    const codeElement = preBlock.querySelector("code");
    if (!codeElement) return;

    const buttonContainer = document.createElement("div");
    buttonContainer.className = "code-block-buttons";

    // --- 1. Create and add the "Copy" Button ---
    const copyButton = document.createElement("button");
    copyButton.className = "btn-code-action";
    copyButton.innerHTML = '<i class="fas fa-copy"></i> Copy';
    copyButton.addEventListener("click", () => {
      navigator.clipboard.writeText(codeElement.innerText);
      copyButton.innerHTML = '<i class="fas fa-check"></i> Copied!';
      setTimeout(() => {
        copyButton.innerHTML = '<i class="fas fa-copy"></i> Copy';
      }, 2000);
    });
    buttonContainer.appendChild(copyButton);

    // --- 2. Create and add the "Try This in Compiler" Button ---
    const tryButton = document.createElement("button");
    tryButton.className = "btn-code-action btn-primary";
    tryButton.innerHTML = '<i class="fas fa-play"></i> Try This';

    tryButton.addEventListener("click", () => {
      const codeToSend = codeElement.innerText;

      // Intelligently detect the language from the code block's class name
      let language = "python"; // Default to python if no language is specified
      const langClass = Array.from(codeElement.classList).find((cls) =>
        cls.startsWith("language-")
      );
      if (langClass) {
        language = langClass.replace("language-", "");
      }

      // Store the code and language in the browser's temporary storage
      const dataToLoad = { code: codeToSend, language: language };
      localStorage.setItem("codeToLoadInCompiler", JSON.stringify(dataToLoad));

      // Redirect the user to the compiler page for that specific language
      window.location.href = `/compiler/${language}`;
    });
    buttonContainer.appendChild(tryButton);

    // Add the container with both buttons to the top of the code block
    preBlock.prepend(buttonContainer);
  });
});
