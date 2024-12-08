// Checkbox script that saves into cache
document.addEventListener("DOMContentLoaded", function () {
  // Get all checkboxes on the page
  const checkboxes = document.querySelectorAll('input[type="checkbox"]');

  // Iterate over each checkbox
  checkboxes.forEach((checkbox) => {
    // Set checkbox state based on sessionStorage
    checkbox.checked = sessionStorage.getItem(checkbox.id) === "true";

    // Add change event listener to update sessionStorage on checkbox change
    checkbox.addEventListener("change", () => {
      sessionStorage.setItem(checkbox.id, checkbox.checked);
    });
  });

  // Save checkbox states to sessionStorage when leaving the page
  window.addEventListener("beforeunload", () => {
    checkboxes.forEach((checkbox) => {
      sessionStorage.setItem(checkbox.id, checkbox.checked);
    });
  });
});

// Script that adds the badge
document.addEventListener("DOMContentLoaded", () => {
  const checkboxes = document.querySelectorAll('input[type="checkbox"]');

  checkboxes.forEach((checkbox) => {
    checkbox.addEventListener("change", (event) => {
      const checkboxId = event.target.id;
      const isChecked = event.target.checked;
      localStorage.setItem(checkboxId, isChecked);
    });

    const savedState = localStorage.getItem(checkbox.id);
    if (savedState !== null) {
      checkbox.checked = savedState === "true";
    }
  });
});
