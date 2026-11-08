(() => {
  "use strict";

  const config = window.GOAL_CONFIG || {};
  const STORAGE_KEY = "goal_demo_v1";
  const $ = id => document.getElementById(id);

  let client = null;
  let currentUser = null;
  let databaseBalance = null;
  let matches = [];
  let selection = {};
  let filter = "all";

  const START_POINTS = Number(config.demoStartingPoints) || 10000;

  if (
    window.supabase &&
    config.supabaseUrl &&
    config.supabaseAnonKey &&
    !String(config.supabaseAnonKey).includes("COLLE_ICI")
  ) {
    client = window.supabase.createClient(
      config.supabaseUrl,
      config.supabaseAnonKey
    );
  }

  function loadState() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (
        saved &&
        Number.isFinite(saved.balance) &&
        Array.isArray(saved.history)
      ) {
        return saved;
      }
    } catch (_) {}

    return { balance: START_POINTS, history: [] };
  }

  let state = loadState();

  function format(value) {
    return new Intl.NumberFormat("fr-FR")
      .format(Math.round(Number(value) || 0));
  }

  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (_) {}
  }

  function toast(message) {
    const el = $("toast");
    if (!el) return;

    el.textContent = message;
    el.classList.add("show");

    clearTimeout(toast.timer);
    toast.timer = setTimeout(
      () => el.classList.remove("show"),
      3200
    );
  }

  function usernameToInternalEmail(username) {
    const normalized = username.trim().toLowerCase();

    if (!/^[a-z0-9][a-z0-9._-]{2,29}$/.test(normalized)) {
      return null;
    }

    return `${normalized}@goal-login.invalid`;
  }

  function createAuthWindow() {
    if ($("goalAuthOverlay")) return;

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
        box-sizing:border-box;
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
        box-sizing:border-box;
      }
      .goal-auth-box input:focus {border-color:#b8f36b}
      .goal-auth-box button {cursor:pointer}
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
      .goal-auth-primary {background:#b8f36b;color:#142018}
      .goal-auth-secondary {background:#26382e;color:white}
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
          id="goalAuthClose" type="button"
          aria-label="Fermer">×</button>

        <p class="eyebrow">BIENVENUE SUR GOAL</p>
        <h2 id="goalAuthTitle">Connexion</h2>

        <div id="goalAuthForm">
          <label for="goalUsername">Nom d’utilisateur</label>
          <input id="goalUsername" type="text"
            placeholder="Votre nom d’utilisateur"
            autocomplete="username" maxlength="30">

          <label for="goalPassword">Mot de passe</label>
          <input id="goalPassword" type="password"
            placeholder="6 caractères minimum"
            autocomplete="current-password" minlength="6">

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
          class="goal-auth-message" role="status"></p>
      </div>
    `;

    document.body.appendChild(overlay);

    $("goalAuthClose").addEventListener("click", closeAuth);

    overlay.addEventListener("click", event => {
      if (event.target === overlay) closeAuth();
    });

    $("goalLogin").addEventListener("click", login);
    $("goalRegister").addEventListener("click", register);
    $("goalLogout").addEventListener("click", logout);

    $("goalPassword").addEventListener("keydown", event => {
      if (event.key === "Enter") login();
    });
  }

  function authMessage(message) {
    const el = $("goalAuthMessage");
    if (el) el.textContent = message;
  }

  function openAuth() {
    if (!client) {
      return toast(
        "Configuration Supabase incomplète : vérifiez js/config.js."
      );
    }

    createAuthWindow();
    $("goalAuthOverlay").style.display = "flex";
    updateAuthWindow();
  }

  function closeAuth() {
    const overlay = $("goalAuthOverlay");
    if (overlay) overlay.style.display = "none";
  }

  function updateAuthWindow() {
    if (!$("goalAuthOverlay")) return;

    $("goalAuthForm").hidden = !!currentUser;
    $("goalLoggedIn").hidden = !currentUser;

    $("goalAuthTitle").textContent =
      currentUser ? "Mon compte" : "Connexion";

    $("goalUserEmail").textContent =
      currentUser?.user_metadata?.display_name ||
      currentUser?.user_metadata?.username ||
      "Compte GOAL";

    authMessage("");
  }

  function updateProfileButton() {
    const button = $("profileButton");
    if (!button) return;

    const label = button.querySelector(".profile-label");
    const avatar = button.querySelector(".avatar");

    if (label) {
      label.textContent = currentUser
        ? (
            currentUser.user_metadata?.username ||
            currentUser.user_metadata?.display_name ||
            "Mon compte"
          )
        : "Mon compte";
    }

    if (avatar) {
      avatar.textContent = currentUser
        ? (
            currentUser.user_metadata?.username || "U"
          ).charAt(0).toUpperCase()
        : "U";
    }
  }

  async function login() {
    const username = $("goalUsername").value.trim();
    const password = $("goalPassword").value;
    const email = usernameToInternalEmail(username);

    if (!username || !password) {
      return authMessage(
        "Saisissez votre nom d’utilisateur et votre mot de passe."
      );
    }

    if (!email) {
      return authMessage(
        "Nom d’utilisateur invalide : 3 à 30 caractères, lettres sans accents, chiffres, point, tiret ou underscore."
      );
    }

    if (password.length < 6) {
      return authMessage("Mot de passe : 6 caractères minimum.");
    }

    const button = $("goalLogin");
    button.disabled = true;

    try {
      const { data, error } =
        await client.auth.signInWithPassword({
          email,
          password
        });

      if (error) throw error;

      currentUser = data.user;
      await loadWallet();
      await loadHistory();
      updateAuthWindow();
      updateProfileButton();

      toast("Connexion réussie !");
    } catch (error) {
      console.error(error);
      authMessage(
        "Connexion impossible. Vérifiez vos identifiants."
      );
    } finally {
      button.disabled = false;
    }
  }

  async function register() {
    const username = $("goalUsername").value.trim();
    const email = usernameToInternalEmail(username);
    const password = $("goalPassword").value;

    if (!username || !password) {
      return authMessage(
        "Saisissez un nom d’utilisateur et un mot de passe."
      );
    }

    if (!email) {
      return authMessage(
        "Nom d’utilisateur invalide : 3 à 30 caractères, lettres sans accents, chiffres, point, tiret ou underscore."
      );
    }

    if (password.length < 6) {
      return authMessage("Mot de passe : 6 caractères minimum.");
    }

    const button = $("goalRegister");
    button.disabled = true;

    try {
      const { data, error } = await client.auth.signUp({
        email,
        password,
        options: {
          data: {
            display_name: username,
            username
          }
        }
      });

      if (error) throw error;

      if (data.session) {
        currentUser = data.user;
        await loadWallet();
        await loadHistory();
        updateAuthWindow();
        updateProfileButton();
        toast("Compte GOAL créé !");
      } else {
        authMessage(
          "Compte créé. Si la confirmation e-mail est activée dans Supabase, désactivez Confirm email puis réessayez."
        );
      }
    } catch (error) {
      console.error(error);
      authMessage(error.message || "Création du compte impossible.");
    } finally {
      button.disabled = false;
    }
  }

  async function logout() {
    const { error } = await client.auth.signOut();

    if (error) return authMessage(error.message);

    currentUser = null;
    databaseBalance = null;
    state.history = [];

    updateAuthWindow();
    updateProfileButton();
    renderAccount();
    closeAuth();

    toast("Déconnexion réussie.");
  }

  async function loadWallet() {
    if (!client || !currentUser) return;

    const { data, error } = await client
      .from("wallets")
      .select("points")
      .eq("user_id", currentUser.id)
      .maybeSingle();

    if (error) {
      console.error("Wallet error:", error);
      return toast("Impossible de charger le solde.");
    }

    if (data) {
      databaseBalance = Number(data.points);
      state.balance = databaseBalance;
      save();
      renderAccount();
    }
  }

  function renderAccount() {
    const balance =
      databaseBalance !== null
        ? databaseBalance
        : state.balance;

    const balanceEl = $("balanceValue");
    if (balanceEl) {
      balanceEl.innerHTML =
        `${format(balance)} <small>PTS</small>`;
    }

    const countEl = $("predictionCount");
    if (countEl) {
      countEl.textContent = String(state.history.length);
    }

    renderHistory();
    renderSlip();
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, char => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    })[char]);
  }

  function renderHistory() {
    const body = $("historyBody");
    if (!body) return;

    if (!state.history.length) {
      body.innerHTML =
        '<tr><td colspan="6" class="table-empty">Aucun pronostic pour le moment.</td></tr>';
      return;
    }

    body.innerHTML = state.history.map(item => `
      <tr>
        <td>${escapeHtml(item.date || "")}</td>
        <td>${escapeHtml(item.match || "")}</td>
        <td>${escapeHtml(item.choice || "")}</td>
        <td>${format(item.stake)} PTS</td>
        <td>${format(item.potential)} PTS</td>
        <td><span class="status-pending">${escapeHtml(item.status || "En attente")}</span></td>
      </tr>
    `).join("");
  }

  async function loadHistory() {
    if (!client || !currentUser) {
      state.history = [];
      renderAccount();
      return;
    }

    const { data, error } = await client
      .from("predictions")
      .select(`
        created_at,
        selection,
        odd_snapshot,
        stake_points,
        potential_points,
        status,
        matches(home_team, away_team)
      `)
      .eq("user_id", currentUser.id)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("History error:", error);
      toast("Impossible de charger l'historique.");
      return;
    }

    state.history = (data || []).map(item => ({
      date: item.created_at
        ? new Date(item.created_at).toLocaleString("fr-FR")
        : "",
      match: item.matches
        ? `${item.matches.home_team} — ${item.matches.away_team}`
        : "Match",
      choice: item.selection,
      stake: Number(item.stake_points),
      potential: Number(item.potential_points),
      status: item.status === "pending"
        ? "En attente"
        : item.status
    }));

    renderAccount();
  }

  function renderMatches() {
    const container = $("matchesList");
    if (!container) return;

    const visible = matches.filter(match => {
      if (filter === "live") return match.status === "live";
      if (filter === "upcoming") return match.status === "upcoming";
      return true;
    });

    if (!visible.length) {
      container.innerHTML = `
        <div class="empty-state">
          <strong>Aucun match disponible</strong>
          <p>Ajoutez des matchs de démonstration dans Supabase (matches et odds).</p>
        </div>
      `;
      return;
    }

    container.innerHTML = visible.map(match => {
      const chosen = selection[match.id];
      const statusLabel = match.status === "live" ? "EN DIRECT" : "À VENIR";
      const timeLabel = match.status === "live" && match.score
        ? `Score : ${escapeHtml(match.score)}`
        : escapeHtml(match.time || "Horaire à confirmer");

      const odds = ["1", "X", "2"].map(option => {
        const odd = match.odds[option];
        const disabled = match.status !== "upcoming" || !Number.isFinite(odd);
        return `
          <button type="button"
            class="odd-button ${chosen === option ? "selected" : ""}"
            data-match="${escapeHtml(match.id)}"
            data-choice="${option}"
            ${disabled ? "disabled" : ""}>
            <span>${option}</span>
            <strong>${Number.isFinite(odd) ? odd.toFixed(2) : "—"}</strong>
          </button>
        `;
      }).join("");

      return `
        <article class="match-card">
          <div class="match-meta">
            <span>${escapeHtml(match.league)}</span>
            <span>${statusLabel}</span>
          </div>
          <div class="match-main">
            <div class="team-name">${escapeHtml(match.home)}</div>
            <div class="match-time">${timeLabel}</div>
            <div class="team-name">${escapeHtml(match.away)}</div>
          </div>
          <div class="odds-row">${odds}</div>
        </article>
      `;
    }).join("");

    container.querySelectorAll(".odd-button:not(:disabled)")
      .forEach(button => {
        button.addEventListener("click", () => {
          const id = button.dataset.match;
          const choice = button.dataset.choice;
          selection[id] = selection[id] === choice ? null : choice;
          if (!selection[id]) delete selection[id];
          renderMatches();
          renderSlip();
        });
      });
  }

  function selectedMatch() {
    const entry = Object.entries(selection)
      .find(([, choice]) => !!choice);

    if (!entry) return null;

    const match = matches.find(item => item.id === entry[0]);

    return match
      ? { match, choice: entry[1] }
      : null;
  }

  function stakeValue() {
    const value = Number($("stakeInput")?.value);

    return Number.isSafeInteger(value) && value > 0
      ? value
      : 0;
  }

  function renderSlip() {
    const item = selectedMatch();
    const empty = $("emptySlip");
    const items = $("slipItems");
    const count = $("selectionCount");
    const submit = $("submitPrediction");
    const stake = stakeValue();

    if (count) count.textContent = item ? "1" : "0";
    if (empty) empty.hidden = !!item;

    if (items) {
      items.innerHTML = item ? `
        <div class="slip-item">
          <strong>
            ${escapeHtml(item.match.home)} —
            ${escapeHtml(item.match.away)}
          </strong>
          <span>
            Votre choix : ${escapeHtml(item.choice)}
            · Cote ${Number(item.match.odds[item.choice]).toFixed(2)}
          </span>
          <button type="button" id="removeSelection"
            class="text-button">Retirer</button>
        </div>
      ` : "";

      $("removeSelection")?.addEventListener("click", () => {
        delete selection[item.match.id];
        renderMatches();
        renderSlip();
      });
    }

    const potential = item
      ? stake * Number(item.match.odds[item.choice] || 0)
      : 0;

    if ($("slipPotential")) {
      $("slipPotential").textContent =
        `${format(potential)} PTS`;
    }

    if ($("potentialValue")) {
      $("potentialValue").innerHTML =
        `${format(potential)} <small>PTS</small>`;
    }

    if (submit) {
      submit.disabled =
        !item ||
        !stake ||
        (
          databaseBalance !== null &&
          stake > databaseBalance
        );
    }
  }

  async function loadMatches() {
    if (!client) {
      const container = $("matchesList");

      if (container) {
        container.innerHTML = `
          <div class="empty-state">
            <strong>Connexion à Supabase non configurée</strong>
            <p>Vérifiez les paramètres dans js/config.js.</p>
          </div>
        `;
      }

      return;
    }

    const { data, error } = await client
      .from("matches")
      .select(`
        id,
        home_team,
        away_team,
        kickoff_at,
        status,
        home_score,
        away_score,
        leagues(name),
        odds(selection, odd)
      `)
      .eq("is_demo", true)
      .order("kickoff_at", { ascending: true });

    if (error) {
      console.error("Matches error:", error);
      toast("Erreur chargement des matchs.");
      return;
    }

    matches = (data || []).map(match => {
      const odds = {};

      (match.odds || []).forEach(item => {
        odds[item.selection] = Number(item.odd);
      });

      return {
        id: match.id,
        home: match.home_team,
        away: match.away_team,
        status: match.status,
        time: match.kickoff_at
          ? new Date(match.kickoff_at).toLocaleString("fr-FR")
          : "",
        score:
          match.home_score !== null &&
          match.away_score !== null
            ? `${match.home_score} - ${match.away_score}`
            : "",
        league: match.leagues?.name || "GOAL Demo League",
        odds
      };
    });

    renderMatches();
  }

  async function submitPrediction() {
    const item = selectedMatch();
    const stake = stakeValue();

    if (!item) {
      return toast("Choisissez un match et une issue.");
    }

    if (!stake) {
      return toast("Saisissez une mise valide en points virtuels.");
    }

    if (!client || !currentUser) return openAuth();

    const submit = $("submitPrediction");
    if (submit) submit.disabled = true;

    try {
      const {
        data: sessionData,
        error: sessionError
      } = await client.auth.getSession();

      if (sessionError) throw sessionError;

      const token = sessionData.session?.access_token;

      if (!token) {
        throw new Error("Session expirée. Reconnectez-vous.");
      }

      const response = await fetch(
        `${config.supabaseUrl}/functions/v1/submit-prediction`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`,
            "apikey": config.supabaseAnonKey
          },
          body: JSON.stringify({
            match_id: item.match.id,
            selection: item.choice,
            stake_points: stake
          })
        }
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(
          result.error || "Pronostic refusé."
        );
      }

      databaseBalance = Number(result.remaining_points);
      state.balance = databaseBalance;

      delete selection[item.match.id];

      await loadWallet();
      await loadHistory();

      renderAccount();
      renderMatches();

      toast(
        `Pronostic confirmé ! Solde : ${format(databaseBalance)} PTS`
      );
    } catch (error) {
      console.error(error);
      toast(error.message || "Erreur lors du pronostic.");
    } finally {
      if (submit) submit.disabled = false;
      renderSlip();
    }
  }

  function bindEvents() {
    $("profileButton")?.addEventListener("click", openAuth);
    $("submitPrediction")?.addEventListener("click", submitPrediction);
    $("stakeInput")?.addEventListener("input", renderSlip);

    document.querySelectorAll("[data-stake]").forEach(button => {
      button.addEventListener("click", () => {
        if ($("stakeInput")) {
          $("stakeInput").value = button.dataset.stake;
        }
        renderSlip();
      });
    });

    document.querySelectorAll("[data-filter]").forEach(button => {
      button.addEventListener("click", () => {
        filter = button.dataset.filter;

        document.querySelectorAll("[data-filter]")
          .forEach(tab => {
            tab.classList.toggle("active", tab === button);
          });

        renderMatches();
      });
    });

    $("resetDemo")?.addEventListener("click", () => {
      if (currentUser) {
        toast(
          "Le solde d’un compte connecté ne peut pas être réinitialisé depuis le navigateur."
        );
        return;
      }

      state = { balance: START_POINTS, history: [] };
      selection = {};

      save();
      renderAccount();
      renderMatches();

      toast("Démo réinitialisée.");
    });

    if ($("year")) {
      $("year").textContent = String(new Date().getFullYear());
    }
  }

  async function init() {
    bindEvents();
    createAuthWindow();
    renderAccount();
    renderSlip();

    if (!client) {
      updateProfileButton();
      renderMatches();
      return;
    }

    const { data, error } = await client.auth.getSession();
    if (error) console.error("Session error:", error);

    currentUser = data?.session?.user || null;

    client.auth.onAuthStateChange((_event, session) => {
      currentUser = session?.user || null;
      updateProfileButton();

      if (currentUser) {
        setTimeout(() => {
          loadWallet();
          loadHistory();
        }, 0);
      } else {
        databaseBalance = null;
        state.history = [];
        renderAccount();
      }
    });

    updateProfileButton();

    if (currentUser) {
      await loadWallet();
      await loadHistory();
    }

    await loadMatches();
  }

  document.addEventListener("DOMContentLoaded", init);
})();
