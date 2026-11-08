
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

  // MATCHES CHARGÉS DEPUIS SUPABASE
  let matches = [];

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
        box-sizing:border-box;
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
          <label for="goalUsername">Nom d’utilisateur</label>
          <input id="goalUsername"
            type="text"
            placeholder="Votre nom d’utilisateur"
            autocomplete="username"
            maxlength="30">

          <label for="goalPassword">Mot de passe</label>
          <input id="goalPassword"
            type="password"
            placeholder="6 caractères minimum"
            autocomplete="current-password"
            minlength="6">

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
      currentUser?.user_metadata?.display_name ||
      currentUser?.user_metadata?.username ||
      "Compte GOAL";
  }

  // INTERNAL EMAIL ALIAS FOR SUPABASE
  function usernameToInternalEmail(username) {
    const normalized = username.trim().toLowerCase();

    if (!/^[a-z0-9][a-z0-9._-]{2,29}$/.test(normalized)) {
      return null;
    }

    return `${normalized}@goal-login.invalid`;
  }

  // LOGIN
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

    const { data, error } = await client.auth.signInWithPassword({
      email,
      password
    });

    button.disabled = false;

    if (error) {
      return authMessage(
        "Connexion impossible. Vérifiez vos identifiants."
      );
    }

    currentUser = data.user;
    await loadWallet();
    updateAuthWindow();
    updateProfileButton();

    toast("Connexion réussie !");
  }

  // REGISTER
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

    const { data, error } = await client.auth.signUp({
      email,
      password,
      options: {
        data: {
          display_name: username,
          username: username
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
        "Compte créé. Vérifiez que Confirm email est désactivé dans Supabase."
      );
    }
  }

  // LOGOUT
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

  // LOAD MATCHES AND ODDS
  async function loadMatches() {
    if (!client) {
      toast("Configuration Supabase manquante.");
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
      console.error(error);
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

  // SUBMIT VIRTUAL PREDICTION
  async function submitPrediction(matchId, chosen, stake) {
    if (!client || !currentUser) {
      openAuth();
      return;
    }

    if (!Number.isSafeInteger(stake) || stake <= 0) {
      return toast("Montant de points invalide.");
    }

    try {
      const { data: sessionData } =
        await client.auth.getSession();

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
            match_id: matchId,
            selection: chosen,
            stake_points: stake
          })
        }
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || "Pronostic refusé.");
      }

      databaseBalance = Number(result.remaining_points);
      state.balance = databaseBalance;
      save();

      renderAccount();

      toast(
        `Pronostic confirmé ! Solde : ${format(databaseBalance)} PTS`
      );

    } catch (error) {
      console.error(error);
      toast(error.message || "Erreur lors du pronostic.");
    }
  }
