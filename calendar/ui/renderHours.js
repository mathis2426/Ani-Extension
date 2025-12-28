
export function renderHourLabels(hours) {
  const hoursContainer = document.querySelector(".hours");
  hoursContainer.innerHTML = "";

  const headerSpacer = document.createElement("div");
  headerSpacer.className = "hour header-spacer";
  headerSpacer.style.height = "50px";
  hoursContainer.appendChild(headerSpacer);

  hours.forEach((h) => {
    const div = document.createElement("div");
    div.className = "hour";
    div.style.height = "120px";
    div.textContent = `${h.toString().padStart(2, "0")}:00`;
    hoursContainer.appendChild(div);
  });
}
