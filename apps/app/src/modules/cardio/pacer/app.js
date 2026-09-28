(function () {
  "use strict";

  var STORAGE_CURRENT = "kmpacer_current_run";
  var STORAGE_HISTORY = "kmpacer_history";

  // ---------- time helpers ----------

  function parseFlexibleTime(str) {
    // accepts "50:00" (mm:ss) or "1:30:00" (h:mm:ss) -> seconds
    if (!str) return null;
    var parts = str.trim().split(":").map(function (p) { return p.trim(); });
    if (parts.some(function (p) { return p === "" || isNaN(Number(p)); })) return null;
    var nums = parts.map(Number);
    var sec = 0;
    if (nums.length === 3) sec = nums[0] * 3600 + nums[1] * 60 + nums[2];
    else if (nums.length === 2) sec = nums[0] * 60 + nums[1];
    else if (nums.length === 1) sec = nums[0];
    else return null;
    return sec >= 0 ? sec : null;
  }

  function formatClock(totalSeconds) {
    totalSeconds = Math.max(0, Math.round(totalSeconds));
    var h = Math.floor(totalSeconds / 3600);
    var m = Math.floor((totalSeconds % 3600) / 60);
    var s = totalSeconds % 60;
    var mm = (h > 0 ? String(m).padStart(2, "0") : String(m));
    var ss = String(s).padStart(2, "0");
    return h > 0 ? h + ":" + mm + ":" + ss : mm + ":" + ss;
  }

  function formatPace(secPerKm) {
    if (secPerKm == null || !isFinite(secPerKm) || secPerKm <= 0) return "–:––";
    var m = Math.floor(secPerKm / 60);
    var s = Math.round(secPerKm % 60);
    if (s === 60) { m += 1; s = 0; }
    return m + ":" + String(s).padStart(2, "0");
  }

  function formatSigned(seconds) {
    var sign = seconds >= 0 ? "+" : "-";
    return sign + formatClock(Math.abs(seconds));
  }

  function formatDateTime(ts) {
    var d = new Date(ts);
    return d.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" }) +
      " · " + d.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
  }

  function vibrate(ms) {
    try { if (navigator.vibrate) navigator.vibrate(ms); } catch (e) { /* noop */ }
  }

  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  // ---------- storage ----------

  function loadCurrentRun() {
    try {
      var raw = localStorage.getItem(STORAGE_CURRENT);
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  }
  function saveCurrentRun(run) {
    try { localStorage.setItem(STORAGE_CURRENT, JSON.stringify(run)); } catch (e) { /* noop */ }
  }
  function clearCurrentRun() {
    try { localStorage.removeItem(STORAGE_CURRENT); } catch (e) { /* noop */ }
  }
  function loadHistory() {
    try {
      var raw = localStorage.getItem(STORAGE_HISTORY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) { return []; }
  }
  function saveHistory(list) {
    try { localStorage.setItem(STORAGE_HISTORY, JSON.stringify(list)); } catch (e) { /* noop */ }
  }

  // ---------- run math ----------

  // run = { id, distance, goalMode: 'time'|'pace'|'none', goalTimeSec, strategy: 'even'|'negative',
  //         startTime (epoch ms), splits: [{ kmLabel, distanceKm, timestamp, durationSec }], finished }

  function wholeKm(distance) { return Math.floor(distance + 1e-9); }
  function fractionalRemainder(distance) {
    var whole = wholeKm(distance);
    var frac = distance - whole;
    return frac > 1e-6 ? frac : 0;
  }
  function totalSegments(distance) {
    return wholeKm(distance) + (fractionalRemainder(distance) > 0 ? 1 : 0);
  }
  function segmentDistance(distance, segmentIndex1based) {
    // returns the km-length represented by this segment (1..totalSegments)
    var whole = wholeKm(distance);
    if (segmentIndex1based <= whole) return 1;
    return fractionalRemainder(distance);
  }

  function distanceDone(run) {
    return run.splits.reduce(function (sum, s) { return sum + s.distanceKm; }, 0);
  }

  function elapsedSec(run, nowMs) {
    return (nowMs - run.startTime) / 1000;
  }

  function avgPaceSecPerKm(run, nowMs) {
    var done = distanceDone(run);
    if (done <= 0) return null;
    return elapsedSec(run, nowMs) / done;
  }

  function forecastSec(run, nowMs) {
    var pace = avgPaceSecPerKm(run, nowMs);
    if (pace == null) return null;
    return pace * run.distance;
  }

  function bufferSec(run, nowMs) {
    if (run.goalMode === "none") return null;
    var fc = forecastSec(run, nowMs);
    if (fc == null) return null;
    return run.goalTimeSec - fc;
  }

  function requiredPaceForRemaining(run, nowMs) {
    if (run.goalMode === "none") return null;
    var done = distanceDone(run);
    var remaining = run.distance - done;
    if (remaining <= 1e-6) return null;
    var remainingTime = run.goalTimeSec - elapsedSec(run, nowMs);
    if (remainingTime <= 0) return Infinity;
    return remainingTime / remaining;
  }

  function goalAvgPace(run) {
    if (run.goalMode === "none") return null;
    return run.goalTimeSec / run.distance;
  }

  // Negative split: phase target pace for the *next* segment to run.
  function negativeSplitTarget(run) {
    var base = goalAvgPace(run);
    if (base == null) return null;
    var segs = totalSegments(run.distance);
    var nextSegIndex = run.splits.length + 1; // 1-based
    if (nextSegIndex > segs) return null;
    var isLastWhole = nextSegIndex === wholeKm(run.distance) && fractionalRemainder(run.distance) === 0 && nextSegIndex === segs;
    // boundaries based on whole-km count
    var whole = wholeKm(run.distance) || 1;
    var p1End = Math.max(1, Math.round(whole * 0.3));
    var p2End = Math.max(p1End + 1, Math.round(whole * 0.7));

    if (nextSegIndex > whole) {
      // fractional finishing segment -> all out
      return { phase: "allout", pace: base * 0.94, label: "ALL OUT 🔥" };
    }
    if (nextSegIndex === whole && whole > 1) {
      return { phase: "allout", pace: base * 0.94, label: "ALL OUT 🔥" };
    }
    if (nextSegIndex <= p1End) {
      return { phase: 1, pace: base * 1.03, label: "KM 1–" + p1End };
    }
    if (nextSegIndex <= p2End) {
      return { phase: 2, pace: base * 1.0, label: "KM " + (p1End + 1) + "–" + p2End };
    }
    return { phase: 3, pace: base * 0.97, label: "KM " + (p2End + 1) + "–" + (whole - 1) };
  }

  function targetSplitTable(distance, goalTimeSec) {
    var pace = goalTimeSec / distance;
    var segs = totalSegments(distance);
    var rows = [];
    var cum = 0;
    for (var i = 1; i <= segs; i++) {
      var segDist = segmentDistance(distance, i);
      cum += segDist * pace;
      var label = (i <= wholeKm(distance)) ? String(i) + " km" : distance + " km";
      rows.push({ label: label, cumSec: cum });
    }
    return rows;
  }

  // ---------- app state / navigation ----------

  var screens = {};
  var currentRun = null;
  var runTickHandle = null;
  var pendingSummaryRun = null; // run object shown on summary screen (not yet saved)
  var summaryIsHistoryView = false;

  function showScreen(id) {
    Object.keys(screens).forEach(function (k) {
      screens[k].classList.toggle("active", k === id);
    });
  }

  document.addEventListener("DOMContentLoaded", init);

  function init() {
    ["screen-setup", "screen-run", "screen-manual", "screen-summary", "screen-history"].forEach(function (id) {
      screens[id] = document.getElementById(id);
    });

    initServiceWorker();
    initSetupScreen();
    initRunScreen();
    initManualScreen();
    initSummaryScreen();
    initHistoryScreen();

    var existing = loadCurrentRun();
    if (existing && !existing.finished) {
      currentRun = existing;
      showScreen("screen-run");
      startRunTicker();
      renderRun();
    } else {
      showScreen("screen-setup");
    }
  }

  function initServiceWorker() {
    if ("serviceWorker" in navigator) {
      window.addEventListener("load", function () {
        navigator.serviceWorker.register("sw.js").catch(function () { /* noop */ });
      });
    }
  }

  // ---------- SETUP SCREEN ----------

  var setupState = {
    distance: 10,
    goalMode: "time",
    goalTimeSec: null,
    strategy: "even",
    startTime: null // null = now
  };

  function initSetupScreen() {
    var distChips = document.querySelectorAll("#distance-chips .chip");
    var distCustomInput = document.getElementById("distance-custom");
    var goalChips = document.querySelectorAll("#goal-mode-chips .chip");
    var goalTimeField = document.getElementById("goal-time-field");
    var goalPaceField = document.getElementById("goal-pace-field");
    var goalTimeInput = document.getElementById("goal-time-input");
    var goalPaceInput = document.getElementById("goal-pace-input");
    var strategyChips = document.querySelectorAll("#strategy-chips .chip");
    var startNowChip = document.getElementById("start-now-chip");
    var startCustomChip = document.getElementById("start-custom-chip");
    var startTimeInput = document.getElementById("start-time-input");
    var form = document.getElementById("setup-form");

    distChips.forEach(function (chip) {
      chip.addEventListener("click", function () {
        distChips.forEach(function (c) { c.classList.remove("selected"); });
        chip.classList.add("selected");
        if (chip.dataset.distance === "custom") {
          distCustomInput.classList.remove("hidden");
          distCustomInput.focus();
          setupState.distance = parseFloat(distCustomInput.value) || null;
        } else {
          distCustomInput.classList.add("hidden");
          setupState.distance = parseFloat(chip.dataset.distance);
        }
        updateTargetPreview();
      });
    });
    distChips[1].click(); // default 10km selected
    distCustomInput.addEventListener("input", function () {
      setupState.distance = parseFloat(distCustomInput.value) || null;
      updateTargetPreview();
    });

    goalChips.forEach(function (chip) {
      chip.addEventListener("click", function () {
        goalChips.forEach(function (c) { c.classList.remove("selected"); });
        chip.classList.add("selected");
        setupState.goalMode = chip.dataset.goal;
        goalTimeField.classList.toggle("hidden", setupState.goalMode !== "time");
        goalPaceField.classList.toggle("hidden", setupState.goalMode !== "pace");
        document.getElementById("strategy-field").classList.toggle("hidden", setupState.goalMode === "none");
        updateTargetPreview();
      });
    });
    goalChips[0].click();

    goalTimeInput.addEventListener("input", function () {
      setupState.goalTimeSec = parseFlexibleTime(goalTimeInput.value);
      updateTargetPreview();
    });
    goalPaceInput.addEventListener("input", function () {
      var paceSec = parseFlexibleTime(goalPaceInput.value);
      if (paceSec != null && setupState.distance) {
        setupState.goalTimeSec = paceSec * setupState.distance;
      } else {
        setupState.goalTimeSec = null;
      }
      updateTargetPreview();
    });

    strategyChips.forEach(function (chip) {
      chip.addEventListener("click", function () {
        strategyChips.forEach(function (c) { c.classList.remove("selected"); });
        chip.classList.add("selected");
        setupState.strategy = chip.dataset.strategy;
      });
    });

    startNowChip.addEventListener("click", function () {
      startNowChip.classList.add("selected");
      startCustomChip.classList.remove("selected");
      startTimeInput.classList.add("hidden");
      setupState.startTime = null;
    });
    startCustomChip.addEventListener("click", function () {
      startCustomChip.classList.add("selected");
      startNowChip.classList.remove("selected");
      startTimeInput.classList.remove("hidden");
      var now = new Date();
      if (!startTimeInput.value) {
        startTimeInput.value = String(now.getHours()).padStart(2, "0") + ":" + String(now.getMinutes()).padStart(2, "0") + ":" + String(now.getSeconds()).padStart(2, "0");
      }
    });
    startTimeInput.addEventListener("input", function () {
      setupState.startTime = startTimeInput.value;
    });

    document.getElementById("btn-goto-history").addEventListener("click", function () {
      renderHistory();
      showScreen("screen-history");
    });
    document.getElementById("btn-goto-manual").addEventListener("click", function () {
      showScreen("screen-manual");
    });

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      startNewRun();
    });

    updateTargetPreview();
  }

  function updateTargetPreview() {
    var preview = document.getElementById("target-splits-preview");
    if (setupState.goalMode === "none" || !setupState.distance || !setupState.goalTimeSec || setupState.goalTimeSec <= 0) {
      preview.classList.add("hidden");
      preview.innerHTML = "";
      return;
    }
    var rows = targetSplitTable(setupState.distance, setupState.goalTimeSec);
    var pace = setupState.goalTimeSec / setupState.distance;
    var html = '<div class="tp-title">Ziel: ' + formatClock(setupState.goalTimeSec) + ' · Ø ' + formatPace(pace) + '/km</div>';
    rows.forEach(function (r) {
      html += '<div class="tp-row"><span>' + r.label + '</span><span>' + formatClock(r.cumSec) + '</span></div>';
    });
    preview.innerHTML = html;
    preview.classList.remove("hidden");
  }

  function startNewRun() {
    if (!setupState.distance || setupState.distance <= 0) {
      alert("Bitte eine gültige Distanz angeben.");
      return;
    }
    if ((setupState.goalMode === "time" || setupState.goalMode === "pace") && (!setupState.goalTimeSec || setupState.goalTimeSec <= 0)) {
      alert("Bitte eine gültige Zielzeit / Zielpace angeben.");
      return;
    }

    var startTime;
    if (setupState.startTime) {
      var now = new Date();
      var parts = setupState.startTime.split(":").map(Number);
      var d = new Date(now.getFullYear(), now.getMonth(), now.getDate(), parts[0] || 0, parts[1] || 0, parts[2] || 0);
      startTime = d.getTime();
    } else {
      startTime = Date.now();
    }

    currentRun = {
      id: uid(),
      distance: setupState.distance,
      goalMode: setupState.goalMode,
      goalTimeSec: setupState.goalMode === "none" ? null : setupState.goalTimeSec,
      strategy: setupState.strategy,
      startTime: startTime,
      splits: [],
      finished: false
    };
    saveCurrentRun(currentRun);
    showScreen("screen-run");
    startRunTicker();
    renderRun();
  }

  // ---------- RUN SCREEN ----------

  function initRunScreen() {
    document.getElementById("btn-add-km").addEventListener("click", onAddKm);
    document.getElementById("btn-undo-km").addEventListener("click", onUndoKm);
    document.getElementById("btn-cancel-run").addEventListener("click", onCancelRun);
  }

  function startRunTicker() {
    stopRunTicker();
    runTickHandle = setInterval(renderRun, 250);
  }
  function stopRunTicker() {
    if (runTickHandle) { clearInterval(runTickHandle); runTickHandle = null; }
  }

  function onAddKm() {
    if (!currentRun || currentRun.finished) return;
    var now = Date.now();
    var segIndex = currentRun.splits.length + 1;
    var segDist = segmentDistance(currentRun.distance, segIndex);
    var prevTime = currentRun.splits.length ? currentRun.splits[currentRun.splits.length - 1].timestamp : currentRun.startTime;
    var duration = (now - prevTime) / 1000;
    var isFinal = segIndex >= totalSegments(currentRun.distance);
    var label = segIndex <= wholeKm(currentRun.distance) ? String(segIndex) : String(currentRun.distance);

    currentRun.splits.push({
      kmLabel: label,
      distanceKm: segDist,
      timestamp: now,
      durationSec: duration
    });

    vibrate(isFinal ? [40, 60, 40] : 40);
    saveCurrentRun(currentRun);

    if (isFinal) {
      finishRun();
    } else {
      renderRun();
    }
  }

  function onUndoKm() {
    if (!currentRun || !currentRun.splits.length) return;
    currentRun.splits.pop();
    saveCurrentRun(currentRun);
    renderRun();
  }

  function onCancelRun() {
    if (!confirm("Laufenden Lauf wirklich abbrechen? Der Fortschritt geht verloren.")) return;
    stopRunTicker();
    clearCurrentRun();
    currentRun = null;
    showScreen("screen-setup");
  }

  function finishRun() {
    stopRunTicker();
    currentRun.finished = true;
    currentRun.finishTime = Date.now();
    saveCurrentRun(currentRun);
    pendingSummaryRun = currentRun;
    summaryIsHistoryView = false;
    resetSummaryButtons();
    renderSummary(pendingSummaryRun);
    showScreen("screen-summary");
  }

  function renderRun() {
    if (!currentRun) return;
    var now = Date.now();
    var done = distanceDone(currentRun);
    var segs = totalSegments(currentRun.distance);
    var doneSegs = currentRun.splits.length;

    document.getElementById("run-km-label").textContent =
      "KM " + doneSegs + " / " + segs + (currentRun.distance !== wholeKm(currentRun.distance) ? " (" + currentRun.distance + " km)" : "");

    document.getElementById("run-timer").textContent = formatClock(elapsedSec(currentRun, now));

    var avg = avgPaceSecPerKm(currentRun, now);
    document.getElementById("run-pace").textContent = formatPace(avg) + " / KM";

    var goalRow = document.getElementById("run-goal-row");
    var goalLabelEl = document.getElementById("run-goal-label");
    var forecastEl = document.getElementById("run-forecast");
    var bufferEl = document.getElementById("run-buffer");
    var requiredBlock = document.getElementById("run-required-block");
    var requiredPaceEl = document.getElementById("run-required-pace");
    var strategyHintEl = document.getElementById("run-strategy-hint");

    if (currentRun.goalMode === "none") {
      goalLabelEl.textContent = "🏁 KEINE ZIELZEIT";
      forecastEl.textContent = done > 0 ? "Prognose: " + formatClock(forecastSec(currentRun, now)) : "";
      bufferEl.textContent = "";
      requiredBlock.classList.add("hidden");
      strategyHintEl.textContent = "";
    } else {
      requiredBlock.classList.remove("hidden");
      var goalLabel = currentRun.goalMode === "time" ? "SUB " + formatClock(currentRun.goalTimeSec).replace(/^0/, "") : "ZIELPACE";
      goalLabelEl.textContent = "🎯 ZIEL: " + goalLabel;

      var fc = forecastSec(currentRun, now);
      forecastEl.textContent = done > 0 ? formatClock(fc) : formatClock(currentRun.goalTimeSec);

      var buf = bufferSec(currentRun, now);
      if (buf != null && done > 0) {
        bufferEl.textContent = "Puffer: " + formatSigned(buf);
        bufferEl.className = "run-buffer " + (buf >= 0 ? "ahead" : "behind");
      } else {
        bufferEl.textContent = "";
        bufferEl.className = "run-buffer";
      }

      var reqPace = requiredPaceForRemaining(currentRun, now);
      if (reqPace === Infinity) {
        requiredPaceEl.textContent = "—";
        requiredPaceEl.className = "run-required-pace behind";
      } else if (reqPace == null) {
        requiredPaceEl.textContent = "🏆 GESCHAFFT";
        requiredPaceEl.className = "run-required-pace ahead";
      } else {
        requiredPaceEl.textContent = formatPace(reqPace) + "/km";
        var goalP = goalAvgPace(currentRun);
        requiredPaceEl.className = "run-required-pace " + (reqPace <= goalP ? "ahead" : "behind");
      }

      if (currentRun.strategy === "negative" && doneSegs < segs) {
        var target = negativeSplitTarget(currentRun);
        if (target) {
          strategyHintEl.textContent = target.phase === "allout"
            ? "Nächster KM: ALL OUT 🔥"
            : "Nächster KM Ziel: " + formatPace(target.pace) + "/km";
        } else {
          strategyHintEl.textContent = "";
        }
      } else {
        strategyHintEl.textContent = "";
      }
    }

    var last = currentRun.splits[currentRun.splits.length - 1];
    document.getElementById("run-last-km").textContent = last ? "Letzter KM: " + formatPace(last.durationSec / last.distanceKm) : "Letzter KM: –";
  }

  // ---------- MANUAL ENTRY SCREEN ----------

  var manualRowCount = 0;

  function initManualScreen() {
    document.getElementById("btn-manual-back").addEventListener("click", function () {
      showScreen("screen-setup");
    });
    document.getElementById("btn-manual-add-row").addEventListener("click", function () {
      addManualRow();
      updateManualSummary();
    });
    document.getElementById("manual-goal-time").addEventListener("input", updateManualSummary);
    document.getElementById("btn-manual-calc").addEventListener("click", onManualCalc);

    for (var i = 0; i < 5; i++) addManualRow();
  }

  function addManualRow() {
    manualRowCount++;
    var container = document.getElementById("manual-rows");
    var row = document.createElement("div");
    row.className = "manual-row";
    row.innerHTML =
      '<span class="mr-label">KM ' + manualRowCount + '</span>' +
      '<input type="text" class="mr-input" placeholder="mm:ss" inputmode="numeric">' +
      '<button type="button" class="mr-remove">✕</button>';
    row.querySelector(".mr-input").addEventListener("input", updateManualSummary);
    row.querySelector(".mr-remove").addEventListener("click", function () {
      row.remove();
      renumberManualRows();
      updateManualSummary();
    });
    container.appendChild(row);
  }

  function renumberManualRows() {
    var rows = document.querySelectorAll("#manual-rows .manual-row");
    manualRowCount = rows.length;
    rows.forEach(function (row, idx) {
      row.querySelector(".mr-label").textContent = "KM " + (idx + 1);
    });
  }

  function readManualSplits() {
    var rows = document.querySelectorAll("#manual-rows .manual-row .mr-input");
    var splits = [];
    rows.forEach(function (input, idx) {
      var sec = parseFlexibleTime(input.value);
      if (sec != null && sec > 0) {
        splits.push({ kmLabel: String(idx + 1), distanceKm: 1, durationSec: sec });
      }
    });
    return splits;
  }

  function updateManualSummary() {
    var splits = readManualSplits();
    var summaryEl = document.getElementById("manual-summary");
    if (!splits.length) {
      summaryEl.innerHTML = '<div class="ms-row"><span>Noch keine Kilometer eingetragen</span></div>';
      return;
    }
    var totalSec = splits.reduce(function (s, sp) { return s + sp.durationSec; }, 0);
    var totalDist = splits.reduce(function (s, sp) { return s + sp.distanceKm; }, 0);
    var avgPace = totalSec / totalDist;
    var html = '<div class="ms-row"><span>Gesamt</span><span>' + formatClock(totalSec) + '</span></div>' +
      '<div class="ms-row"><span>Ø Pace</span><span>' + formatPace(avgPace) + '/km</span></div>';

    var goalStr = document.getElementById("manual-goal-time").value;
    var goalSec = parseFlexibleTime(goalStr);
    if (goalSec) {
      var forecast = avgPace * totalDist; // if goal distance unset, forecast == total so far
      var buffer = goalSec - totalSec;
      html += '<div class="ms-row"><span>Prognose</span><span>' + formatClock(forecast) + '</span></div>' +
        '<div class="ms-row"><span>Puffer</span><span>' + formatSigned(buffer) + '</span></div>';
    }
    summaryEl.innerHTML = html;
  }

  function onManualCalc() {
    var splits = readManualSplits();
    if (!splits.length) {
      alert("Bitte mindestens einen Kilometer eintragen.");
      return;
    }
    var totalDist = splits.reduce(function (s, sp) { return s + sp.distanceKm; }, 0);
    var goalSec = parseFlexibleTime(document.getElementById("manual-goal-time").value);

    var now = Date.now();
    var cursor = now - splits.reduce(function (s, sp) { return s + sp.durationSec; }, 0) * 1000;
    var withTimestamps = splits.map(function (sp) {
      cursor += sp.durationSec * 1000;
      return { kmLabel: sp.kmLabel, distanceKm: sp.distanceKm, timestamp: cursor, durationSec: sp.durationSec };
    });

    var run = {
      id: uid(),
      distance: totalDist,
      goalMode: goalSec ? "time" : "none",
      goalTimeSec: goalSec || null,
      strategy: "even",
      startTime: withTimestamps[0].timestamp - withTimestamps[0].durationSec * 1000,
      splits: withTimestamps,
      finished: true,
      finishTime: now
    };

    pendingSummaryRun = run;
    summaryIsHistoryView = false;
    resetSummaryButtons();
    renderSummary(run);
    showScreen("screen-summary");
  }

  // ---------- SUMMARY SCREEN ----------

  function initSummaryScreen() {
    document.getElementById("btn-save-run").addEventListener("click", function () {
      if (!pendingSummaryRun) return;
      var history = loadHistory();
      history.unshift(pendingSummaryRun);
      saveHistory(history);
      // Hand over to the coaching app (Cardio module imports it with one tap)
      try {
        var outbox = JSON.parse(localStorage.getItem("mx_pacer_outbox") || "[]");
        outbox.push(pendingSummaryRun);
        localStorage.setItem("mx_pacer_outbox", JSON.stringify(outbox));
      } catch (e) { /* noop */ }
      clearCurrentRun();
      currentRun = null;
      var btn = document.getElementById("btn-save-run");
      btn.textContent = "Gespeichert ✓";
      btn.disabled = true;
    });
    document.getElementById("btn-new-run").addEventListener("click", function () {
      if (summaryIsHistoryView) {
        summaryIsHistoryView = false;
        renderHistory();
        showScreen("screen-history");
        return;
      }
      clearCurrentRun();
      currentRun = null;
      pendingSummaryRun = null;
      resetSummaryButtons();
      showScreen("screen-setup");
    });
  }

  function resetSummaryButtons() {
    var saveBtn = document.getElementById("btn-save-run");
    var newBtn = document.getElementById("btn-new-run");
    saveBtn.textContent = "Lauf speichern";
    saveBtn.disabled = false;
    saveBtn.classList.remove("hidden");
    newBtn.textContent = "Neuer Lauf";
  }

  function openSummaryFromHistory(run) {
    summaryIsHistoryView = true;
    pendingSummaryRun = run;
    renderSummary(run);
    document.getElementById("btn-save-run").classList.add("hidden");
    document.getElementById("btn-new-run").textContent = "Zurück zur Historie";
    showScreen("screen-summary");
  }

  function renderSummary(run) {
    var card = document.getElementById("summary-card");
    var totalSec = run.splits.reduce(function (s, sp) { return s + sp.durationSec; }, 0);
    var totalDist = run.splits.reduce(function (s, sp) { return s + sp.distanceKm; }, 0);
    var avgPace = totalSec / totalDist;

    var madeGoal = run.goalMode !== "none" && run.goalTimeSec && totalSec <= run.goalTimeSec;
    var distLabel = (Number.isInteger(run.distance) ? run.distance : run.distance.toFixed(1)) + " km" +
      (run.goalMode === "time" ? " — Sub " + formatClock(run.goalTimeSec).replace(/^0/, "") : "");

    var html = '<div class="sc-distance">' + distLabel + '</div>' +
      '<div class="sc-time">' + formatClock(totalSec) + (madeGoal ? ' <span class="sc-trophy">🏆</span>' : '') + '</div>' +
      '<div class="sc-pace">Ø Pace <b>' + formatPace(avgPace) + '/km</b></div>' +
      '<table class="splits-table"><thead><tr><th>KM</th><th>Zeit</th></tr></thead><tbody>';

    run.splits.forEach(function (sp) {
      var pace = sp.durationSec / sp.distanceKm;
      var cls = pace < avgPace - 1 ? "fast" : (pace > avgPace + 1 ? "slow" : "");
      html += '<tr><td>' + sp.kmLabel + '</td><td class="' + cls + '">' + formatPace(pace) + '</td></tr>';
    });
    html += '</tbody></table>';
    card.innerHTML = html;
  }

  // ---------- HISTORY SCREEN ----------

  function initHistoryScreen() {
    document.getElementById("btn-history-back").addEventListener("click", function () {
      showScreen("screen-setup");
    });
  }

  function renderHistory() {
    var list = document.getElementById("history-list");
    var history = loadHistory();
    if (!history.length) {
      list.innerHTML = '<div class="history-empty">Noch keine gespeicherten Läufe.</div>';
      return;
    }
    list.innerHTML = "";
    history.forEach(function (run) {
      var totalSec = run.splits.reduce(function (s, sp) { return s + sp.durationSec; }, 0);
      var madeGoal = run.goalMode !== "none" && run.goalTimeSec && totalSec <= run.goalTimeSec;
      var item = document.createElement("div");
      item.className = "history-item";
      var distLabel = (Number.isInteger(run.distance) ? run.distance : run.distance.toFixed(1)) + " km";
      item.innerHTML =
        '<div class="hi-left"><div class="hi-dist">' + distLabel + (madeGoal ? " 🏆" : "") + '</div>' +
        '<div class="hi-date">' + formatDateTime(run.finishTime || run.startTime) + '</div></div>' +
        '<div class="hi-time">' + formatClock(totalSec) + '</div>';
      item.addEventListener("click", function () {
        openSummaryFromHistory(run);
      });
      list.appendChild(item);
    });
  }

})();
