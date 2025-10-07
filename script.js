"use strict";

/* ============================================================
   Montanaro WL — Enrollment Form Frontend (labels-only timeslots)
   ============================================================ */

(function () {
  // ---------- ELEMENTS ----------
  const form = document.getElementById("enrollForm");
  if (!form) return;

  const courseGroup = document.getElementById("courseChoices");
  const courseError = document.getElementById("courseError"); // "Please select at least one course"

  const slotPicker = document.getElementById("slotPicker"); // <fieldset> Preferred time slot(s)
  const slotHelp = document.getElementById("slotHelp");
  const slotOptions = document.getElementById("slotOptions"); // container where we inject checkboxes
  const slotError = document.getElementById("slotError"); // "Please select at least one preferred time slot."

  if (slotHelp && slotOptions) {
    slotOptions.setAttribute("aria-describedby", "slotHelp");
  }

  const statusEl = document.createElement("div");
  statusEl.setAttribute("role", "status");
  statusEl.setAttribute("aria-live", "polite");
  statusEl.style.marginTop = "0.75rem";
  form.appendChild(statusEl);

  // Map form checkbox values -> table "Level" titles
  const COURSE_TABLE_KEYS = {
    "French A1": "French A1 Beginner",
    "French A2": "French A2 High Beginner",
    "French B1": "French B1 Intermediate",
    "Spanish A1": "Spanish A1 Beginner",
    "Spanish A2": "Spanish A2 High Beginner",
    "Spanish B1": "Spanish B1 Intermediate",
  };

  const $all = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));
  const getSelectedCourses = () =>
    $all('input[name="course"]:checked', form).map((cb) => cb.value);

  // Scrape slots from your tables: each ".time-line" line next to its course row
  function buildCourseSlotMap() {
    const map = new Map(); // key: course title (Level cell), val: [{label, idx}]
    $all("table.course-table tbody tr").forEach((row) => {
      const titleCell = row.querySelector(".lvl");
      const timesCell = row.querySelector(".times-td");
      if (!titleCell || !timesCell) return;

      const courseTitle = titleCell.textContent.trim().replace(/\s+/g, " ");
      const items = [];
      $all(".time-line", timesCell).forEach((line, i) => {
        const text = (line.childNodes[0]?.textContent || "")
          .trim()
          .replace(/\s+/g, " ");
        if (text) items.push({ label: text, idx: i });
      });
      if (items.length) map.set(courseTitle, items);
    });
    return map;
  }

  const tableSlotMap = buildCourseSlotMap();

  function renderSlots() {
    const selected = getSelectedCourses();

    if (!selected.length) {
      slotPicker.hidden = true;
      slotOptions.innerHTML = "";
      slotError.hidden = true;
      return;
    }

    const chunks = [];
    selected.forEach((formValue) => {
      const tableKey = COURSE_TABLE_KEYS[formValue];
      const lines = (tableKey && tableSlotMap.get(tableKey)) || [];
      lines.forEach((s, i) => {
        const id = `timeslot_${formValue.replace(/\s+/g, "_")}_${s.idx}_${i}`;
        chunks.push(
          `<label for="${id}" class="slot-line">
             <input type="checkbox" id="${id}" name="timeslot_label" value="${s.label}">
             ${s.label}
           </label>`
        );
      });
    });

    slotOptions.innerHTML = chunks.length
      ? chunks.join("")
      : `<p class="muted">No time slots found for the selected course(s). We’ll follow up by email.</p>`;

    slotPicker.hidden = false;
    slotError.hidden = true;
  }

  courseGroup?.addEventListener("change", () => {
    courseError.hidden = true;
    renderSlots();
  });
  renderSlots();

  // Submit
  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    // Require at least one course
    const hasCourse = getSelectedCourses().length > 0;
    if (!hasCourse) {
      courseError.hidden = false;
      courseError.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }

    // Warn (do not block) if no slot was chosen while options are shown
    const slotInputs = $all('input[name="timeslot_label"]', slotOptions);
    const selectedLabels = slotInputs
      .filter((x) => x.checked)
      .map((x) => x.value);
    if (slotInputs.length && selectedLabels.length === 0) {
      slotError.hidden = false; // show message but continue
    } else {
      slotError.hidden = true;
    }

    try {
      statusEl.textContent = "Submitting…";

      // Build URL-encoded params; send repeated timeslot_label keys
      const params = new URLSearchParams(new FormData(form));
      params.delete("timeslot_label"); // clear any stale auto-collected entries
      selectedLabels.forEach((v) => params.append("timeslot_label", v));

      await fetch(form.action, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: params.toString(),
      });

      window.location.href = "thanks.html";
    } catch (err) {
      console.error("Submission error:", err);
      statusEl.textContent =
        "Sorry, something went wrong. Please try again or email montanarowl@gmail.com.";
    }
  });
})();

// ---------- UPCOMING COURSES TOGGLE ----------
document.addEventListener("DOMContentLoaded", () => {
  const tabButtons = document.querySelectorAll('.tabs .tab[role="tab"]');
  const panels = document.querySelectorAll('.tab-panel[role="tabpanel"]');

  if (!tabButtons.length || !panels.length) return; // safety check

  function activateTab(panelId) {
    panels.forEach((p) => {
      const isActive = p.id === panelId;
      p.hidden = !isActive;
      p.classList.toggle("is-active", isActive);
    });

    tabButtons.forEach((btn) => {
      const isSelected = btn.getAttribute("aria-controls") === panelId;
      btn.setAttribute("aria-selected", String(isSelected));
      btn.classList.toggle("is-active", isSelected);
    });
  }

  tabButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      activateTab(btn.getAttribute("aria-controls"));
    });
  });

  // initialize correct tab on load
  const initial =
    document.querySelector('.tabs .tab[aria-selected="true"]') || tabButtons[0];
  if (initial) activateTab(initial.getAttribute("aria-controls"));
});
