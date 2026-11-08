
(() => {
  "use strict";

  const config = window.GOAL_CONFIG;
  const STORAGE_KEY = "goal_demo_v1";

  const $ = id => document.getElementById(id);

  // SUPABASE CONNECTION
  let client = null;
  let currentUser = null;
  let databaseBalance = null;

  if (
    window.supabase &&
    config &&
    config.supabaseUrl &&
    config.supabaseAnonKey &&
    !config.supabaseAnonKey.includes("COLLE_ICI")
  ) {
    client = window.supabase.createClient(
      config.supabaseUrl,
      config.supabaseAnonKey
    );
  }

  const START_POINTS = Number(config?.demoStartingPoints) || 10000;

  // DEMO MATCHES
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
      odds: { "1": 1.85, X: 3.20, "2": 4.10 }
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
      odds: { "1": 2.10, X: 3.30, "2": 2.85 }
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
      odds: { "1": 1.95, X: 3.45, "2": 3.60 }
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
      odds: { "1": 2.40, X: 2.90, "2": 2.75 }
    }
  ];

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

  function format(number) {
    return new Intl.NumberFormat("fr-FR")
      .format(Math.round(number));
  }

  function save() {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(state)
    );
  }

  function toast(message) {
    const el = $("toast");
    if (!el) return;

    el.textContent = message;
    el.classList.add("show");

    clearTimeout(toast.timer);

    toast.timer = setTimeout(() => {
      el.classList.remove("show");
    }, 3000);
  }

  // AUTHENTICATION WINDOW
  function createAuthWindow() {
    const style = document.createElement("style");

    style.textContent = `
      .goal-auth-overlay {
        position:fixed; inset:0; z-index:1000;
        background:#000c; display:none;
        align-items:center; justify-content:center;
        padding:18px;
      }
      .goal-auth-box {
        width:100%; max-width:390px;
        background:#141e19; color:#f3f7f4;
        border:1px solid #34473b;
        border-radius:18px; padding:25px;
      }
      .goal-auth-box h2 {margin:5px 0 20px}
      .goal-auth-box label {
        display:block; color:#91a399;
        font-size:12px; margin:12px 0 6px;
      }
      .goal-auth-box input {
        width:100%; padding:12px;
        background:#0d1411; color:white;
        border:1px solid #34473b;
        border-radius:8px; outline:none;
      }
      .goal-auth-box input:focus {
        border-color:#b8f36b;
      }
      .goal-auth-box button {
        cursor:pointer;
      }
      .goal-auth-close {
        float:right; background:none;
        border:0; color:white; font-size:22px;
      }
      .goal-auth-actions {
        display:grid; gap:9px; margin-top:18px;
      }
      .goal-auth-actions button {
        padding:12px; border:0;
        border-radius:8px; font-weight:800;
      }
      .goal-auth-primary {
        background:#b8f36b; color:#142018;
      }
      .goal-auth-secondary {
        background:#26382e; color:white;
      }
      .goal-auth-message {
        font-size:12px; color:#b8f36b;
        margin-top:12px; line-height:1.5;
      }
      .goal-auth-account {
        color:#91a399; font-size:12px;
        overflow-wrap:anywhere;
      }
    `;

    document.head.appendChild(style);

    const overlay = document.createElement("div");
    overlay.className = "goal-auth-overlay";
    overlay.id = "goalAuthOverlay";

    overlay.innerHTML = `
      <div class="goal-auth-box">
        <button class="goal-auth-close"
          id="goalAuthClose" type="button">×</button>

        <p class="eyebrow">BIENVENUE SUR GOAL</p>
        <h2 id="goalAuthTitle">Connexion</h2>

        <div id="goalAuthForm">
          <label for="goalName">Nom</label>
          <input id="goalName"
            type="text" placeholder="Votre nom">

          <label for="goalEmail">Adresse e-mail</label>
          <input id="goalEmail"
            type="email" placeholder="nom@email.com"
            autocomplete="email">

          <label for="goalPassword">Mot de passe</label>
          <input id="goalPassword"
            type="password" placeholder="Minimum 6 caractères"
            autocomplete="current-password">

          <div class="goal-auth-actions">
            <button id="goalLogin"
              class="goal-auth-primary" type="button">
              Se connecter
            </button>

            <button id="goalRegister"
              class="goal-auth-secondary" type="button">
              Créer un compte
            </button>
          </div>
        </div>

        <div id="goalLoggedIn" hidden>
          <p class="goal-auth-account" id="goalUserEmail"></p>

          <div class="goal-auth-actions">
            <button id="goalLogout"
              class="goal-auth-primary" type="button">
              Déconnexion
            </button>
          </div>
        </div>

        <p id="goalAuthMessage"
          class="goal-auth-message"></p>
      </div>
    `;

    document.body.appendChild(overlay);

    $("goalAuthClose").onclick = closeAuth;

    overlay.addEventListener("click", event => {
      if (event.target === overlay) closeAuth();
    });

    $("goalLogin").onclick = login;
    $("goalRegister").onclick = register;
    $("goalLogout").onclick = logout;
  }

  function openAuth() {
    if (!client) {
      return toast("Configuration Supabase incomplète.");
    }

    $("goalAuthOverlay").style.display = "flex";
    updateAuthWindow();
  }

  function closeAuth() {
    $("goalAuthOverlay").style.display = "none";
  }

  function authMessage(message) {
    $("goalAuthMessage").textContent = message;
  }

  function updateAuthWindow() {
    $("goalAuthForm").hidden = !!currentUser;
    $("goalLoggedIn").hidden = !currentUser;

    $("goalAuthTitle").textContent =
      currentUser ? "Mon compte" : "Connexion";

    $("goalUserEmail").textContent =
      currentUser?.email || "";
  }

  async function login() {
    const email = $("goalEmail").value.trim();
    const password = $("goalPassword").value;

    if (!email || !password) {
      return authMessage("Veuillez remplir les champs.");
    }

    const button = $("goalLogin");
    button.disabled = true;

    const { data, error } = await client.auth.signInWithPassword({
      email,
      password
    });

    button.disabled = false;

    if (error) {
      return authMessage(error.message);
    }

    currentUser = data.user;
    await loadWallet();
    updateAuthWindow();
    updateProfileButton();

    toast("Connexion réussie !");
  }

  async function register() {
    const name = $("goalName").value.trim();
    const email = $("goalEmail").value.trim();
    const password = $("goalPassword").value;

    if (!name || !email || !password) {
      return authMessage("Remplissez tous les champs.");
    }

    if (password.length < 6) {
      return authMessage("Mot de passe : 6 caractères minimum.");
    }

    const button = $("goalRegister");
    button.disabled = true;

    const { data, error } = await client.auth.signUp({
      email,
      password,
      options: {
        data: {
          display_name: name
        }
      }
    });

    button.disabled = false;

    if (error) {
      return authMessage(error.message);
    }

    if (data.session) {
      currentUser = data.user;
      await loadWallet();
      updateAuthWindow();
      updateProfileButton();

      toast("Compte GOAL créé !");
    } else {
      authMessage(
        "Compte créé ! Vérifiez votre boîte e-mail pour confirmer votre inscription."
      );
    }
  }

  async function logout() {
    const { error } = await client.auth.signOut();

    if (error) {
      return authMessage(error.message);
    }

    currentUser = null;
    databaseBalance = null;

    updateAuthWindow();
    updateProfileButton();
    renderAccount();
    closeAuth();

    toast("Déconnexion réussie.");
  }

  // LOAD WALLET FROM SUPABASE
  async function loadWallet() {
    if (!client || !currentUser) return;

    const { data, error } = await client
      .from("wallets")
      .select("points")
      .eq("user_id", currentUser.id)
      .maybeSingle();

    if (error) {
      console.error("Wallet error:", error.message);
      toast("Impossible de charger le portefeuille.");
      return;
    }

    if (data) {
      databaseBalance = Number(data.points);
      renderAccount();
    } else {
      databaseBalance = null;
      toast("Portefeuille non trouvé. Vérifiez le trigger SQL.");
    }
  }

  function updateProfileButton() {
    const button = $("profileButton");

    if (!button) return;

    button.innerHTML = currentUser
      ? `<span class="avatar">✓</span>
         <span class="profile-label">Mon compte</span>`
      : `<span class="avatar">U</span>
         <span class="profile-label">Mon compte</span>`;
  }

  // MATCHES
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
              : "À VENIR"} • ${match.time}
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
          ${["1","X","2"].map(key => `
            <button
              class="odd-button ${
                selection[match.id]?.choice === key ? "selected" : ""
              }"
              data-match="${match.id}"
              data-choice="${key}"
              type="button"
            >
              <span>${key}</span>
              <strong>${match.odds[key].toFixed(2)}</strong>
            </button>
          `).join("")}
        </div>
      </article>
    `).join("");
  }

  function countSelections() {
    return Object.keys(selection).length;
  }

  function potential() {
    const stake = Number($("stakeInput").value) || 0;

    return Object.values(selection).reduce(
      (total, item) => total * item.odds,
      countSelections() ? stake : 0
    );
  }

  function renderSlip() {
    const entries = Object.entries(selection);

    $("selectionCount").textContent = entries.length;

    $("emptySlip").classList.toggle(
      "hidden",
      entries.length > 0
    );

    $("slipItems").innerHTML = entries.map(([id, item]) => `
      <div class="slip-item">
        <div class="slip-item-top">
          <span>${item.home} – ${item.away}</span>
          <button data-remove="${id}"
            class="remove-selection" type="button">×</button>
        </div>

        <div class="slip-item-bottom">
          <span>Choix : <strong>${item.choice}</strong></span>
          <span>Cote : <strong>${item.odds.toFixed(2)}</strong></span>
        </div>
      </div>
    `).join("");

    $("potentialValue").innerHTML =
      `${format(potential())} <small>PTS</small>`;

    $("slipPotential").textContent =
      `${format(potential())} PTS`;

    const stake = Number($("stakeInput").value);
    const balance = databaseBalance ?? state.balance;

    $("submitPrediction").disabled =
      !entries.length ||
      !Number.isFinite(stake) ||
      stake < 1 ||
      stake > balance;
  }

  function renderHistory() {
    $("historyBody").innerHTML = state.history.length
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
      : `<tr>
          <td colspan="6" class="table-empty">
            Aucun pronostic pour le moment.
          </td>
        </tr>`;
  }

  function renderAccount() {
    const balance = databaseBalance ?? state.balance;

    $("balanceValue").innerHTML =
      `${format(balance)} <small>PTS</small>`;

    $("predictionCount").textContent =
      state.history.length;

    renderSlip();
    renderHistory();
  }

  // EVENT HANDLERS
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

      document.querySelectorAll("[data-filter]").forEach(item => {
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
    const balance = databaseBalance ?? state.balance;

    if (!currentUser) {
      toast("Connectez-vous pour continuer.");
      openAuth();
      return;
    }

    if (!countSelections() || stake < 1) {
      return toast("Mise invalide.");
    }

    if (stake > balance) {
      return toast("Solde insuffisant.");
    }

    toast(
      "Les pronostics en compte seront activés après la sécurisation du serveur."
    );
  });

  $("resetDemo").addEventListener("click", () => {
    if (currentUser) {
      return toast("Réinitialisation réservée au mode démo.");
    }

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

  $("profileButton").addEventListener("click", openAuth);

  // INITIALIZATION
  createAuthWindow();

  renderMatches();
  renderAccount();

  $("year").textContent = new Date().getFullYear();

  if (!client) {
    toast("Supabase non configuré.");
  } else {
    client.auth.getSession().then(async ({ data, error }) => {
      if (error) {
        console.error(error.message);
        return;
      }

      currentUser = data.session?.user || null;

      updateProfileButton();

      if (currentUser) {
        await loadWallet();
      }
    });

    client.auth.onAuthStateChange((event, session) => {
      currentUser = session?.user || null;

      if (event === "SIGNED_OUT") {
        databaseBalance = null;
      }

      updateProfileButton();

      if (event === "SIGNED_IN") {
        setTimeout(loadWallet, 0);
      }

      if (event === "SIGNED_OUT") {
        renderAccount();
      }
    });
  }

})();
