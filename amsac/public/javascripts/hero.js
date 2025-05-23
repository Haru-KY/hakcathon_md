document.addEventListener("DOMContentLoaded", function () {
  const button = document.getElementById("show-about");
  const aboutSection = document.getElementById("about");
  let shown = false;

  if (button && aboutSection) {
    button.addEventListener("click", function () {
      if (shown) return;

      aboutSection.classList.add("show");
      shown = true;

      setTimeout(function () {
        aboutSection.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 100);
    });
  }
});
