// ui/dropdown.js
export class Dropdown {
  constructor({ options, defaultIndex = 0, onChange }) {
    this.options = options;
    this.selectedIndex = defaultIndex;
    this.onChange = onChange;

    this.container = document.createElement("div");
    this.container.className = "dropdown";

    this.selectedEl = document.createElement("div");
    this.selectedEl.className = "dropdown-selected";
    this.selectedEl.textContent = this.options[this.selectedIndex];
    this.container.appendChild(this.selectedEl);

    this.optionsEl = document.createElement("ul");
    this.optionsEl.className = "dropdown-options";
    this.container.appendChild(this.optionsEl);

    this.renderOptions();
    this.attachEvents();
  }

  renderOptions() {
    this.optionsEl.innerHTML = "";
    this.options.forEach((opt, index) => {
      const li = document.createElement("li");
      li.textContent = opt;
      li.className = index === this.selectedIndex ? "active" : "";
      li.addEventListener("click", () => this.select(index));
      this.optionsEl.appendChild(li);
    });
  }

  attachEvents() {
    this.selectedEl.addEventListener("click", () => {
      this.optionsEl.classList.toggle("show");
    });

    document.addEventListener("click", (e) => {
      if (!this.container.contains(e.target)) {
        this.optionsEl.classList.remove("show");
      }
    });
  }

  select(index) {
    this.selectedIndex = index;
    this.selectedEl.textContent = this.options[index];
    this.optionsEl.classList.remove("show");
    this.renderOptions();
    if (this.onChange) this.onChange(this.options[index], index);
  }

  mount(parent) {
    parent.appendChild(this.container);
  }
}
