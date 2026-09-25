const app = document.querySelector("#app");
let scenes = [];
let choices = { selected: {}, rejected: {}, feedback: {} };

function slotCss(slot) {
  const [h, s] = slot.hs;
  const v = Math.round((slot.b / 255) * 100);
  return `hsl(${h} ${s}% ${Math.max(8, Math.min(92, v * (0.45 + s / 200)))}%)`;
}

function visible(scene) {
  const rejected = new Set(choices.rejected[scene.id] || []);
  return (scene.images || []).filter((img) => !rejected.has(img.id));
}

function save() {
  localStorage.setItem("palette-picker", JSON.stringify(choices));
  fetch("/api/choices", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(choices),
  }).catch(() => {});
}

function render() {
  const groups = [];
  for (const scene of scenes) {
    if (!groups.length || groups[groups.length - 1].name !== scene.group) {
      groups.push({ name: scene.group, scenes: [] });
    }
    groups[groups.length - 1].scenes.push(scene);
  }
  app.replaceChildren();
  for (const group of groups) {
    const section = document.createElement("section");
    const h2 = document.createElement("h2");
    h2.textContent = group.name;
    section.appendChild(h2);
    for (const scene of group.scenes) {
      section.appendChild(renderScene(scene));
    }
    app.appendChild(section);
  }
}

function renderScene(scene) {
  const article = document.createElement("article");
  const head = document.createElement("div");
  head.className = "head";
  const title = document.createElement("strong");
  title.textContent = scene.name;
  head.appendChild(title);
  const shown = visible(scene);
  const picked = choices.selected[scene.id];
  if (!picked && shown.length < 5) {
    const need = document.createElement("span");
    need.className = "need";
    need.textContent = `${shown.length} of 5 still open — ask for more photos`;
    head.appendChild(need);
  }
  article.appendChild(head);
  const row = document.createElement("div");
  row.className = "row";
  if (!shown.length) {
    const empty = document.createElement("p");
    empty.className = "empty";
    empty.textContent = (choices.rejected[scene.id] || []).length
      ? "No photos left. Ask for more."
      : "No photos yet.";
    row.appendChild(empty);
  }
  for (const img of shown) {
    const figure = document.createElement("figure");
    if (picked === img.id) figure.classList.add("picked");
    const x = document.createElement("button");
    x.type = "button";
    x.className = "x";
    x.textContent = "×";
    x.setAttribute("aria-label", `Drop ${scene.name} photo`);
    x.addEventListener("click", () => {
      const list = choices.rejected[scene.id] || [];
      if (!list.includes(img.id)) list.push(img.id);
      choices.rejected[scene.id] = list;
      if (choices.selected[scene.id] === img.id) delete choices.selected[scene.id];
      save();
      render();
    });
    const photo = document.createElement("img");
    photo.src = img.file;
    photo.alt = "";
    photo.addEventListener("click", () => {
      choices.selected[scene.id] = img.id;
      save();
      render();
    });
    const swatches = document.createElement("div");
    swatches.className = "swatches";
    for (const slot of img.palette || []) {
      const dot = document.createElement("span");
      dot.style.background = slotCss(slot);
      swatches.appendChild(dot);
    }
    const cap = document.createElement("figcaption");
    if (img.page) {
      const a = document.createElement("a");
      a.href = img.page;
      a.target = "_blank";
      a.rel = "noreferrer";
      a.textContent = img.license || "source";
      cap.appendChild(a);
    }
    figure.append(x, photo, swatches, cap);
    row.appendChild(figure);
  }
  article.appendChild(row);
  const label = document.createElement("label");
  label.className = "note";
  label.textContent = "Feedback";
  const note = document.createElement("textarea");
  note.value = choices.feedback[scene.id] || "";
  note.placeholder = "What is wrong with the scene, the photos, or the colors?";
  note.addEventListener("input", () => {
    choices.feedback[scene.id] = note.value;
    save();
  });
  label.appendChild(note);
  article.appendChild(label);
  return article;
}

async function start() {
  const saved = localStorage.getItem("palette-picker");
  if (saved) {
    try { choices = { selected: {}, rejected: {}, feedback: {}, ...JSON.parse(saved) }; } catch (_err) {}
  }
  const [sceneRes, choiceRes] = await Promise.all([
    fetch("scenes.json"),
    fetch("choices.json").catch(() => null),
  ]);
  scenes = await sceneRes.json();
  if (choiceRes && choiceRes.ok) {
    const disk = await choiceRes.json();
    choices = {
      selected: { ...disk.selected, ...choices.selected },
      rejected: { ...disk.rejected, ...choices.rejected },
      feedback: { ...disk.feedback, ...choices.feedback },
    };
  }
  render();
}

start();
