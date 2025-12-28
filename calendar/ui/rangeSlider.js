// ui/rangeSlider.js
export class RangeSlider {
  constructor({ minValue = 0, maxValue = 100, defaultMin = 0, defaultMax = 100, onChange }) {
    this.minValue = minValue;
    this.maxValue = maxValue;
    this.currentMin = defaultMin;
    this.currentMax = defaultMax;
    this.onChange = onChange;

    this.container = document.createElement("div");
    this.container.className = "range-slider";

    // Label
    const label = document.createElement("label");
    label.className = "range-slider-label";
    label.textContent = `Notes: ${this.currentMin} - ${this.currentMax}`;
    this.labelEl = label;
    this.container.appendChild(label);

    // Slider wrapper
    const wrapper = document.createElement("div");
    wrapper.className = "range-slider-wrapper";

    // Background track
    const track = document.createElement("div");
    track.className = "range-slider-track";
    wrapper.appendChild(track);

    // Fill track
    this.fill = document.createElement("div");
    this.fill.className = "range-slider-fill";
    wrapper.appendChild(this.fill);

    // Min slider
    this.minSlider = document.createElement("input");
    this.minSlider.type = "range";
    this.minSlider.className = "range-slider-input";
    this.minSlider.min = minValue;
    this.minSlider.max = maxValue;
    this.minSlider.value = defaultMin;
    wrapper.appendChild(this.minSlider);

    // Max slider
    this.maxSlider = document.createElement("input");
    this.maxSlider.type = "range";
    this.maxSlider.className = "range-slider-input";
    this.maxSlider.min = minValue;
    this.maxSlider.max = maxValue;
    this.maxSlider.value = defaultMax;
    wrapper.appendChild(this.maxSlider);

    this.container.appendChild(wrapper);
    this.attachEvents();
    this.updateFill();
  }

  attachEvents() {
    // Input events - visual feedback only (real-time)
    this.minSlider.addEventListener("input", () => {
      let minVal = parseInt(this.minSlider.value);
      const maxVal = parseInt(this.maxSlider.value);

      if (minVal > maxVal) {
        this.minSlider.value = maxVal;
      }

      this.currentMin = parseInt(this.minSlider.value);
      this.updateLabel();
      this.updateFill();
    });

    this.maxSlider.addEventListener("input", () => {
      let maxVal = parseInt(this.maxSlider.value);
      const minVal = parseInt(this.minSlider.value);

      if (maxVal < minVal) {
        this.maxSlider.value = minVal;
      }

      this.currentMax = parseInt(this.maxSlider.value);
      this.updateLabel();
      this.updateFill();
    });

    // Change events - trigger filter update (on release)
    this.minSlider.addEventListener("change", () => {
      this.currentMin = parseInt(this.minSlider.value);
      if (this.onChange) {
        this.onChange({ min: this.currentMin, max: this.currentMax });
      }
    });

    this.maxSlider.addEventListener("change", () => {
      this.currentMax = parseInt(this.maxSlider.value);
      if (this.onChange) {
        this.onChange({ min: this.currentMin, max: this.currentMax });
      }
    });
  }

  updateLabel() {
    this.labelEl.textContent = `Notes: ${this.currentMin} - ${this.currentMax}`;
  }

  updateFill() {
    const range = this.maxValue - this.minValue;
    const minPercent = ((this.currentMin - this.minValue) / range) * 100;
    const maxPercent = ((this.currentMax - this.minValue) / range) * 100;
    
    this.fill.style.left = `${minPercent}%`;
    this.fill.style.right = `${100 - maxPercent}%`;
  }

  mount(parent) {
    parent.appendChild(this.container);
  }
}
