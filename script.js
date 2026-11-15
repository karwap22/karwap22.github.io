const shortcuts = { h: "home", p: "projects", e: "experience", b: "education", s: "skills", a: "achievements" };

document.addEventListener("keydown", (event) => {
  if (event.metaKey || event.ctrlKey || event.altKey || event.target.matches("input, textarea, select, [contenteditable='true']")) return;

  const section = shortcuts[event.key.toLowerCase()];
  if (section) document.getElementById(section).scrollIntoView({ behavior: "smooth" });
});
