
(() => {
  "use strict";

  const START_POINTS = 10000;
  const STORAGE_KEY = "goal_demo_v1";

  const matches = [
    {
      id: "m1",
      home: "Paris FC",
      away: "London City",
      homeBadge: "🔵",
      awayBadge: "🔴",
      status: "live",
      time: "65′",
      score: "1 – 0",
      odds: { "1": 1.85, "X": 3.20, "2": 4.10 }
    },
    {
      id: "m2",
      home: "Madrid CF",
      away: "Munich FC",
      homeBadge: "⚪",
      awayBadge: "🔴",
      status: "upcoming",
      time: "20:45",
      score: "—",
      odds: { "1": 2.10, "X": 3.30, "2": 2.85 }
    },
    {
      id: "m3",
      home: "Milan AC",
      away: "Amsterdam FC",
      homeBadge: "⚫",
      awayBadge: "🟠",
      status: "upcoming",
      time: "21:00",
      score: "—",
      odds: { "1": 1.95, "X": 3.45, "2": 3.60 }
    },
    {
      id: "m4",
      home: "Lisbon SC",
      away: "Dortmund 09",
      homeBadge: "🟢",
      awayBadge: "🟡",
      status: "live",
      time: "32′",
      score: "0 – 0",
      odds: { "1": 2.40, "X": 2.90, "2": 2.75 }
    }
  ];

  const $ = id => document.getElementById(id);
  const format = n =>
    new Intl.NumberFormat("fr-FR").format(Math.round(n));

  function loadState() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));

      if (
        saved &&
        Number.isFinite(saved.balance) &&
        Array.isArray(saved.history)
      ) return saved;
    } catch (e) {}

    return {
      balance: START_POINTS,
      history: []
    };
  }

  let state = loadState();
  let selection = {};
  let filter = "all";

  function save() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function toast(message) {
    const el = $("toast");
    if (!el) return;

    el.textContent = message;
    el.classList.add("show");

    clearTimeout(toast.timer);

    toast.timer = setTimeout(() => {
      el.classList.remove("show");
    }, 2600);
  }

  function renderMatches() {
    const visible = matches.filter(match =>
      filter === "all" || match.status === filter
    );

    $("matchesList").innerHTML = visible.map(match => `
      <article class="match-card">
        <div>
          <div class="match-meta">
            ${match.status === "live"
              ? '<span class="live-dot"></span> EN DIRECT'
              : "À VENIR"}
            • ${match.time}
          </div>

          <div class="match-teams">
            <span class="team">
              <span class="team-badge">${match.homeBadge}</span>
              <span class="team-name">${match.home}</span>
            </span>

            <span class="versus">VS</span>

            <span class="team">
              <span class="team-badge">${match.awayBadge}</span>
              <span class="team-name">${match.away}</span>
            </span>

            <span class="match-score">${match.score}</span>
          </div>
        </div>

        <div class="odds">
          ${["1", "X", "2"].map(key => {
            const selected =
              selection[match.id]?.choice === key;

            return `
              <button
                class="odd-button ${selected ? "selected" : ""}"
                type="button"
                data-match="${match.id}"
                data-choice="${key}"
                aria-pressed="${selected}"
              >
                <span>${key}</span>
                <strong>${match.odds[key].toFixed(2)}</strong>
              </button>
            `;
          }).join("")}
        </div>
      </article>
    `).join("") ||
      '<div class="table-empty">Aucun match disponible.</div>';
  }

  function countSelections() {
    return Object.keys(selection).length;
  }

  function calculatePotential() {
    const stake = Math.max(
      0,
      Number($("stakeInput").value) || 0
    );

    const multiplier = Object.values(selection)
      .reduce((total, item) => total * item.odds, 1);

    return countSelections() ? stake * multiplier : 0;
  }

  function renderSlip() {
    const items = Object.entries(selection);

    $("selectionCount").textContent = items.length;

    $("emptySlip").classList.toggle(
      "hidden",
      items.length > 0
    );

    $("slipItems").innerHTML = items.map(([id, item]) => `
      <div class="slip-item">
        <div class="slip-item-top">
          <span>${item.home} – ${item.away}</span>

          <button
            class="remove-selection"
            data-remove="${id}"
            type="button"
            aria-label="Retirer"
          >×</button>
        </div>

        <div class="slip-item-bottom">
          <span>Choix : <strong>${item.choice}</strong></span>
          <span>Cote : <strong>${item.odds.toFixed(2)}</strong></span>
        </div>
      </div>
    `).join("");

    const potential = calculatePotential();

    $("potentialValue").innerHTML =
      `${format(potential)} <small>PTS</small>`;

    $("slipPotential").textContent =
      `${format(potential)} PTS`;

    const stake = Number($("stakeInput").value);

    $("submitPrediction").disabled =
      !items.length ||
      !Number.isFinite(stake) ||
      stake < 1 ||
      stake > state.balance;
  }

  function renderHistory() {
    $("historyBody").innerHTML =
      state.history.length
        ? [...state.history].reverse().map(item => `
          <tr>
            <td>${item.date}</td>
            <td>${item.matches}</td>
            <td>${item.choices}</td>
            <td>${format(item.stake)} PTS</td>
            <td>${format(item.potential)} PTS</td>
            <td><span class="status-demo">DÉMO</span></td>
          </tr>
        `).join("")
        : `
          <tr>
            <td colspan="6" class="table-empty">
              Aucun pronostic pour le moment.
            </td>
          </tr>
        `;
  }

  function renderAccount() {
    $("balanceValue").innerHTML =
      `${format(state.balance)} <small>PTS</small>`;

    $("predictionCount").textContent =
      state.history.length;

    renderSlip();
    renderHistory();
  }

  $("matchesList").addEventListener("click", event => {
    const button = event.target.closest("[data-match]");

    if (!button) return;

    const match = matches.find(
      item => item.id === button.dataset.match
    );

    const choice = button.dataset.choice;

    if (selection[match.id]?.choice === choice) {
      delete selection[match.id];
    } else {
      selection[match.id] = {
        home: match.home,
        away: match.away,
        choice,
        odds: match.odds[choice]
      };
    }

    renderMatches();
    renderSlip();
  });

  $("slipItems").addEventListener("click", event => {
    const button = event.target.closest("[data-remove]");

    if (!button) return;

    delete selection[button.dataset.remove];

    renderMatches();
    renderSlip();
  });

  document.querySelectorAll("[data-filter]").forEach(button => {
    button.addEventListener("click", () => {
      filter = button.dataset.filter;

      document.querySelectorAll("[data-filter]")
        .forEach(item => {
          item.classList.toggle("active", item === button);
        });

      renderMatches();
    });
  });

  document.querySelectorAll("[data-stake]").forEach(button => {
    button.addEventListener("click", () => {
      $("stakeInput").value = button.dataset.stake;
      renderSlip();
    });
  });

  $("stakeInput").addEventListener("input", renderSlip);

  $("submitPrediction").addEventListener("click", () => {
    const stake = Math.floor(Number($("stakeInput").value));

    if (!countSelections() || !Number.isFinite(stake) || stake < 1) {
      return toast("Veuillez saisir une mise valide.");
    }

    if (stake > state.balance) {
      return toast("Solde virtuel insuffisant.");
    }

    const entries = Object.values(selection);
    const potential = calculatePotential();

    state.balance -= stake;

    state.history.push({
      id: Date.now(),
      date: new Date().toLocaleString("fr-FR"),
      matches: entries.map(item =>
        `${item.home} – ${item.away}`
      ).join(" / "),
      choices: entries.map(item => item.choice).join(" + "),
      stake,
      potential
    });

    save();

    selection = {};
    $("stakeInput").value = 100;

    renderMatches();
    renderAccount();

    toast("Pronostic enregistré en mode démo.");
  });

  $("resetDemo").addEventListener("click", () => {
    if (!confirm("Réinitialiser la démonstration ?")) return;

    state = {
      balance: START_POINTS,
      history: []
    };

    selection = {};

    save();
    renderMatches();
    renderAccount();

    toast("Démonstration réinitialisée.");
  });

  $("profileButton").addEventListener("click", () => {
    toast("Espace compte : bientôt disponible.");
  });

  $("year").textContent = new Date().getFullYear();

  renderMatches();
  renderAccount();

})();
