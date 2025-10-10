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

// ---------- ADD TO CALENDAR (ICS) ----------
(function () {
  // Map iCal weekday abbreviations to JS day numbers
  const DAY_MAP = { SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6 };

  // Find the first BYDAY match on/after a given date
  function nextByDayOnOrAfter(baseDate, bydays) {
    const start = new Date(
      baseDate.getFullYear(),
      baseDate.getMonth(),
      baseDate.getDate()
    );
    for (let i = 0; i < 14; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      const jsDay = d.getDay();
      if (bydays.some((bd) => DAY_MAP[bd] === jsDay)) return d;
    }
    return start;
  }

  function pad2(n) {
    return String(n).padStart(2, "0");
  }
  function dtLocalNY(date, timeHHmm) {
    // Build a "floating" local datetime (no 'Z'), which most calendars accept with TZID
    const [hh, mm] = timeHHmm.split(":").map(Number);
    return (
      date.getFullYear() +
      pad2(date.getMonth() + 1) +
      pad2(date.getDate()) +
      "T" +
      pad2(hh) +
      pad2(mm) +
      "00"
    );
  }

  function sanitizeFileName(s) {
    return s.replace(/[^\w\-]+/g, "_").slice(0, 80);
  }

  // Simple VTIMEZONE for America/New_York (covers modern clients well)
  const VTIMEZONE_NY = [
    "BEGIN:VTIMEZONE",
    "TZID:America/New_York",
    "X-LIC-LOCATION:America/New_York",
    "BEGIN:DAYLIGHT",
    "TZOFFSETFROM:-0500",
    "TZOFFSETTO:-0400",
    "TZNAME:EDT",
    "DTSTART:19700308T020000",
    "RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=2SU",
    "END:DAYLIGHT",
    "BEGIN:STANDARD",
    "TZOFFSETFROM:-0400",
    "TZOFFSETTO:-0500",
    "TZNAME:EST",
    "DTSTART:19701101T020000",
    "RRULE:FREQ=YEARLY;BYMONTH=11;BYDAY=1SU",
    "END:STANDARD",
    "END:VTIMEZONE",
  ].join("\r\n");

  function buildICS({
    title,
    bydayStr,
    startTime,
    endTime,
    anchorDate,
    count = 20,
  }) {
    const bydays = bydayStr.split(",").map((s) => s.trim());
    const base = new Date(anchorDate + "T00:00:00");
    const first = nextByDayOnOrAfter(base, bydays);

    const dtStartLocal = dtLocalNY(first, startTime);
    const dtEndLocal = dtLocalNY(first, endTime);

    const uid =
      Date.now() +
      "-" +
      Math.random().toString(16).slice(2) +
      "@montanarowlanguages";

    const vevent = [
      "BEGIN:VEVENT",
      `UID:${uid}`,
      `DTSTAMP:${dtLocalNY(new Date(), "00:00")}`,
      "CLASS:PUBLIC",
      "TRANSP:OPAQUE",
      `SUMMARY:${title}`,
      `DTSTART;TZID=America/New_York:${dtStartLocal}`,
      `DTEND;TZID=America/New_York:${dtEndLocal}`,
      // 10 weeks × 2 sessions/week = 20 occurrences
      `RRULE:FREQ=WEEKLY;BYDAY=${bydays.join(",")};COUNT=${count};WKST=SU`,
      "END:VEVENT",
    ].join("\r\n");

    const ics = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Montanaro WL//Add to Calendar//EN",
      "CALSCALE:GREGORIAN",
      VTIMEZONE_NY,
      vevent,
      "END:VCALENDAR",
    ].join("\r\n");

    return ics;
  }

  function downloadICS(filename, contents) {
    const blob = new Blob([contents], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  // Delegate clicks for all current/future buttons
  document.addEventListener("click", (e) => {
    const btn = e.target.closest(".add-ics");
    if (!btn) return;

    const title = btn.dataset.title || "Course (Live Online)";
    const byday = btn.dataset.byday || "MO,WE"; // e.g., "MO,WE" or "TU,TH"
    const start = btn.dataset.start || "19:00"; // "HH:MM" 24h
    const end = btn.dataset.end || "20:00";
    const date = btn.dataset.date || "2025-11-03"; // anchor week (any day in the first week)

    const ics = buildICS({
      title,
      bydayStr: byday,
      startTime: start,
      endTime: end,
      anchorDate: date,
      count: 20,
    });

    const fname = sanitizeFileName(`${title}-${byday}-MWL.ics`);
    downloadICS(fname, ics);
  });
})();

//Nav Toggle
const toggle = document.querySelector(".nav-toggle");
const nav = document.querySelector(".primary-nav");

toggle.addEventListener("click", () => {
  const expanded = toggle.getAttribute("aria-expanded") === "true";
  toggle.setAttribute("aria-expanded", String(!expanded));
  nav.classList.toggle("open", !expanded); // <-- this triggers your .primary-nav.open styles
});
