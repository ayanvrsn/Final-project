import { ethers } from "ethers";
import { APP, EXPLORERS } from "./config.js";
import { CROWDFUND_ABI, ERC20_ABI } from "./abi.js";

const ui = {
  connectBtn: document.getElementById("connectBtn"),
  refreshBtn: document.getElementById("refreshBtn"),
  createBtn: document.getElementById("createBtn"),
  walletAddress: document.getElementById("walletAddress"),
  networkStatus: document.getElementById("networkStatus"),
  ethBalance: document.getElementById("ethBalance"),
  tokenBalance: document.getElementById("tokenBalance"),
  tokenLabel: document.getElementById("tokenLabel"),
  networkHelp: document.getElementById("networkHelp"),
  configHelp: document.getElementById("configHelp"),
  statusMessage: document.getElementById("statusMessage"),
  errorMessage: document.getElementById("errorMessage"),
  campaignList: document.getElementById("campaignList"),
  campaignCount: document.getElementById("campaignCount"),
  titleInput: document.getElementById("titleInput"),
  goalInput: document.getElementById("goalInput"),
  deadlineInput: document.getElementById("deadlineInput"),
  deadlineError: document.getElementById("deadlineError"),
  plusMinuteBtn: document.getElementById("plusMinuteBtn")
};

const state = {
  provider: null,
  signer: null,
  address: null,
  chainId: null,
  crowd: null,
  token: null,
  tokenSymbol: "TOKEN",
  tokenDecimals: 18
};

function short(addr) {
  if (!addr) return "";
  return addr.slice(0, 6) + "…" + addr.slice(-4);
}

function nowSec() {
  return Math.floor(Date.now() / 1000);
}

function isContractsReady() {
  return (
    APP.TOKEN_ADDRESS?.startsWith("0x") &&
    APP.CROWDFUND_ADDRESS?.startsWith("0x")
  );
}

function isAllowedNetwork() {
  return state.chainId != null && APP.ALLOWED_CHAIN_IDS.includes(state.chainId);
}

function setNotice(el, message, variant) {
  if (!message) {
    el.classList.add("hidden");
    el.textContent = "";
    return;
  }
  el.classList.remove("hidden", "success", "warning", "error");
  el.classList.add(variant);
  el.textContent = message;
}

function setStatus(message, txHash, pending) {
  if (!message) {
    ui.statusMessage.classList.add("hidden");
    ui.statusMessage.textContent = "";
    return;
  }

  ui.statusMessage.classList.remove("hidden", "success", "warning");
  ui.statusMessage.classList.add(pending ? "warning" : "success");

  const link = txHash ? getTxLink(txHash) : "";
  if (link) {
    ui.statusMessage.innerHTML = `${message} <a class="link" href="${link}" target="_blank" rel="noreferrer">View tx</a>`;
  } else if (txHash) {
    ui.statusMessage.textContent = `${message} (tx: ${txHash})`;
  } else {
    ui.statusMessage.textContent = message;
  }
}

function setError(message) {
  if (!message) {
    ui.errorMessage.classList.add("hidden");
    ui.errorMessage.textContent = "";
    return;
  }
  ui.errorMessage.classList.remove("hidden");
  ui.errorMessage.textContent = message;
}

function getTxLink(hash) {
  if (!hash || !state.chainId) return "";
  const base = EXPLORERS[state.chainId];
  return base ? `${base}${hash}` : "";
}

function parseDeadlineInput(raw) {
  const value = raw.trim();
  const match = value.match(/^([0-9]{2})\/([0-9]{2})\/([0-9]{2})\s+([0-9]{2}):([0-9]{2})(?::([0-9]{2}))?$/);
  if (!match) {
    return { error: "Invalid format. Use dd/mm/yy hh:ss (24h)." };
  }

  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = 2000 + Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const second = match[6] ? Number(match[6]) : 0;

  if (month < 1 || month > 12) return { error: "Invalid month." };
  if (day < 1 || day > 31) return { error: "Invalid day." };
  if (hour > 23) return { error: "Invalid hour." };
  if (minute > 59) return { error: "Invalid minutes." };
  if (second > 59) return { error: "Invalid seconds." };

  const date = new Date(year, month - 1, day, hour, minute, second, 0);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day ||
    date.getHours() !== hour ||
    date.getMinutes() !== minute ||
    date.getSeconds() !== second
  ) {
    return { error: "Invalid date." };
  }

  const timestamp = Math.floor(date.getTime() / 1000);
  if (timestamp <= nowSec() + 60) {
    return { error: "Deadline must be at least 60 seconds in the future." };
  }

  return { timestamp };
}

function formatDeadlineInput(date) {
  const dd = String(date.getDate()).padStart(2, "0");
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const yy = String(date.getFullYear()).slice(-2);
  const hh = String(date.getHours()).padStart(2, "0");
  const min = String(date.getMinutes()).padStart(2, "0");
  const ss = String(date.getSeconds()).padStart(2, "0");
  return `${dd}/${mm}/${yy} ${hh}:${min}:${ss}`;
}



function formatEth(value) {
  try {
    return ethers.formatEther(value);
  } catch {
    return "0";
  }
}

function statusLabel(c) {
  const now = nowSec();
  if (c.finalized) return c.successful ? "Successful" : "Failed";
  if (now >= c.deadline) return "Ended (needs finalize)";
  return "Active";
}

function updateUIState() {
  ui.connectBtn.disabled = !window.ethereum;
  ui.refreshBtn.disabled = !state.address || !isAllowedNetwork() || !isContractsReady();
  ui.createBtn.disabled = !state.address || !isAllowedNetwork() || !isContractsReady();

  if (!window.ethereum) {
    setError("MetaMask not found. Please install it to continue.");
  }

  if (!isContractsReady()) {
    setNotice(ui.configHelp, "Update config.js with deployed contract addresses.", "warning");
  } else {
    setNotice(ui.configHelp, "", "warning");
  }

  if (state.chainId == null) {
    ui.networkStatus.textContent = "-";
    setNotice(ui.networkHelp, "", "warning");
  } else if (!isAllowedNetwork()) {
    ui.networkStatus.textContent = `Wrong network (${state.chainId})`;
    setNotice(
      ui.networkHelp,
      "Please switch MetaMask to Sepolia (11155111), Holesky (17000), or Localhost (31337).",
      "warning"
    );
  } else {
    ui.networkStatus.textContent = APP.CHAIN_NAMES[state.chainId] || String(state.chainId);
    setNotice(ui.networkHelp, "", "warning");
  }

  ui.walletAddress.textContent = state.address ? state.address : "Not connected";
}

async function syncWallet(requestAccounts) {
  if (!window.ethereum) {
    updateUIState();
    return;
  }

  const provider = new ethers.BrowserProvider(window.ethereum);
  const accounts = await provider.send(requestAccounts ? "eth_requestAccounts" : "eth_accounts", []);

  if (!accounts || accounts.length === 0) {
    state.provider = provider;
    state.signer = null;
    state.address = null;
    state.chainId = null;
    state.crowd = null;
    state.token = null;
    updateUIState();
    return;
  }

  const signer = await provider.getSigner();
  const net = await provider.getNetwork();

  state.provider = provider;
  state.signer = signer;
  state.address = accounts[0];
  state.chainId = Number(net.chainId);

  if (isContractsReady()) {
    state.crowd = new ethers.Contract(APP.CROWDFUND_ADDRESS, CROWDFUND_ABI, signer);
    state.token = new ethers.Contract(APP.TOKEN_ADDRESS, ERC20_ABI, provider);
  } else {
    state.crowd = null;
    state.token = null;
  }

  updateUIState();
  await refreshBalances();
  await loadCampaigns();
}

async function connectWallet() {
  setError("");
  setStatus("");
  try {
    await syncWallet(true);
  } catch (err) {
    if (err?.code === 4001) {
      setError("Connection request rejected.");
      return;
    }
    setError(err?.message || "Failed to connect.");
  }
}

async function refreshBalances() {
  if (!state.provider || !state.address) return;
  try {
    const balance = await state.provider.getBalance(state.address);
    ui.ethBalance.textContent = Number(ethers.formatEther(balance)).toFixed(4);

    if (state.token) {
      const [bal, decimals, symbol] = await Promise.all([
        state.token.balanceOf(state.address),
        state.token.decimals(),
        state.token.symbol()
      ]);
      state.tokenDecimals = Number(decimals);
      state.tokenSymbol = symbol;
      ui.tokenLabel.textContent = symbol;
      ui.tokenBalance.textContent = Number(ethers.formatUnits(bal, decimals)).toFixed(4);
    } else {
      ui.tokenLabel.textContent = "Token";
      ui.tokenBalance.textContent = "0.0000";
    }
  } catch (err) {
    setError(err?.message || "Failed to fetch balances.");
  }
}

async function loadCampaigns() {
  if (!state.provider || !isContractsReady()) {
    ui.campaignList.innerHTML = "";
    ui.campaignCount.textContent = "0";
    return;
  }

  try {
    const readCrowd = new ethers.Contract(APP.CROWDFUND_ADDRESS, CROWDFUND_ABI, state.provider);
    const count = await readCrowd.campaignCount();
    const items = [];

    for (let i = 0; i < Number(count); i += 1) {
      const c = await readCrowd.getCampaign(i);
      const contrib = state.address ? await readCrowd.getContribution(i, state.address) : 0n;
      items.push({
        id: i,
        creator: c.creator,
        title: c.title,
        goalWei: c.goalWei,
        deadline: Number(c.deadline),
        raisedWei: c.raisedWei,
        finalized: c.finalized,
        successful: c.successful,
        contributionWei: contrib
      });
    }

    renderCampaigns(items);
  } catch (err) {
    setError(err?.message || "Failed to load campaigns.");
  }
}

function renderCampaigns(items) {
  ui.campaignCount.textContent = String(items.length);
  if (items.length === 0) {
    ui.campaignList.innerHTML = '<div class="muted">No campaigns yet.</div>';
    return;
  }

  const html = items
    .map((c) => {
      const goal = formatEth(c.goalWei);
      const raised = formatEth(c.raisedWei);
      const mine = formatEth(c.contributionWei);
      const ended = nowSec() >= c.deadline;
      const status = statusLabel(c);
      const statusClass = c.finalized ? (c.successful ? "ok" : "bad") : ended ? "warn" : "";
      const deadlineStr = new Date(c.deadline * 1000).toLocaleString();
      const goalNum = Number(goal);
      const raisedNum = Number(raised);
      const progressPct = goalNum > 0 ? Math.min(100, (raisedNum / goalNum) * 100) : 0;
      const badge =
        c.finalized && c.successful
          ? '<span class="badge success">Successful</span>'
          : c.finalized && !c.successful
            ? '<span class="badge fail">Failed</span>'
            : "";

      return `
        <div class="campaign" data-id="${c.id}">
          <h3>#${c.id} · ${c.title}</h3>
          ${badge}
          <div class="campaign-meta">
            <div>
              <div class="label">Creator</div>
              <div>${short(c.creator)}</div>
            </div>
            <div>
              <div class="label">Goal</div>
              <div>${goal} ETH</div>
            </div>
            <div>
              <div class="label">Raised</div>
              <div>${raised} ETH</div>
            </div>
            <div>
              <div class="label">Deadline</div>
              <div>${deadlineStr}</div>
            </div>
            <div>
              <div class="label">Finalized</div>
              <div>${c.finalized ? "Yes" : "No"}</div>
            </div>
            <div>
              <div class="label">Successful</div>
              <div>${c.successful ? "Yes" : "No"}</div>
            </div>
            <div>
              <div class="label">My Contribution</div>
              <div>${mine} ETH</div>
            </div>
            <div>
              <div class="label">Status</div>
              <div class="status-pill ${statusClass}">${status}</div>
            </div>
          </div>
          <div class="progress" aria-label="Progress">
            <div class="progress-bar" style="width: ${progressPct}%;"></div>
          </div>
          <div class="row">
            <input id="contrib-${c.id}" placeholder="Amount ETH" />
            <button data-action="contribute" data-id="${c.id}" ${!state.address || !isAllowedNetwork() || c.finalized || ended ? "disabled" : ""}>
              Contribute
            </button>
            <button data-action="finalize" data-id="${c.id}" ${!state.address || !isAllowedNetwork() || (!ended && !c.finalized) ? "disabled" : ""}>
              Finalize / Claim
            </button>
            <button data-action="refund" data-id="${c.id}" ${!state.address || !isAllowedNetwork() || !c.finalized || c.successful ? "disabled" : ""}>
              Refund
            </button>
          </div>
        </div>
      `;
    })
    .join("");

  ui.campaignList.innerHTML = html;
}

async function createCampaign() {
  if (!state.crowd) return;
  setError("");
  setStatus("");
  ui.deadlineError.textContent = "";

  const title = ui.titleInput.value.trim();
  const goal = ui.goalInput.value.trim();
  const deadlineRaw = ui.deadlineInput.value.trim();

  if (!title) {
    setError("Title is required.");
    return;
  }
  if (!goal || Number(goal) <= 0) {
    setError("Goal must be greater than 0.");
    return;
  }

  const parsed = parseDeadlineInput(deadlineRaw);
  if (parsed.error) {
    ui.deadlineError.textContent = parsed.error;
    return;
  }

  try {
    const goalWei = ethers.parseEther(goal || "0");
    const tx = await state.crowd.createCampaign(title, goalWei, parsed.timestamp);
    setStatus("Transaction sent. Creating campaign...", tx.hash, true);
    await tx.wait();
    setStatus("Campaign created.", tx.hash, false);
    ui.titleInput.value = "";
    await loadCampaigns();
  } catch (err) {
    if (err?.code === 4001) {
      setError("Transaction rejected.");
      return;
    }
    setError(err?.message || "Failed to create campaign.");
  }
}

async function contribute(id) {
  if (!state.crowd) return;
  setError("");
  setStatus("");

  const input = document.getElementById(`contrib-${id}`);
  const amount = input?.value?.trim() || "0";

  try {
    if (!amount || Number(amount) <= 0) {
      setError("Contribution amount must be greater than 0.");
      return;
    }
    const tx = await state.crowd.contribute(id, { value: ethers.parseEther(amount) });
    setStatus("Transaction sent. Contributing...", tx.hash, true);
    await tx.wait();
    setStatus("Contribution confirmed.", tx.hash, false);
    await loadCampaigns();
    await refreshBalances();
  } catch (err) {
    if (err?.code === 4001) {
      setError("Transaction rejected.");
      return;
    }
    setError(err?.message || "Failed to contribute.");
  }
}

async function finalize(id) {
  if (!state.crowd) return;
  setError("");
  setStatus("");

  try {
    const tx = await state.crowd.finalize(id);
    setStatus("Transaction sent. Finalizing...", tx.hash, true);
    await tx.wait();
    setStatus("Finalized and reward claimed (if eligible).", tx.hash, false);
    await loadCampaigns();
    await refreshBalances();
  } catch (err) {
    if (err?.code === 4001) {
      setError("Transaction rejected.");
      return;
    }
    setError(err?.message || "Failed to finalize.");
  }
}

async function refund(id) {
  if (!state.crowd) return;
  setError("");
  setStatus("");

  try {
    const tx = await state.crowd.refund(id);
    setStatus("Transaction sent. Refunding...", tx.hash, true);
    await tx.wait();
    setStatus("Refund confirmed.", tx.hash, false);
    await loadCampaigns();
    await refreshBalances();
  } catch (err) {
    if (err?.code === 4001) {
      setError("Transaction rejected.");
      return;
    }
    setError(err?.message || "Failed to refund.");
  }
}

async function refreshAll() {
  setError("");
  setStatus("");
  await refreshBalances();
  await loadCampaigns();
}

ui.connectBtn.addEventListener("click", connectWallet);
ui.refreshBtn.addEventListener("click", refreshAll);
ui.createBtn.addEventListener("click", createCampaign);
ui.plusMinuteBtn.addEventListener("click", setPlusOneMinute);

ui.campaignList.addEventListener("click", (event) => {
  const action = event.target?.dataset?.action;
  const id = event.target?.dataset?.id;
  if (!action || id == null) return;
  const campaignId = Number(id);

  if (action === "contribute") contribute(campaignId);
  if (action === "finalize") finalize(campaignId);
  if (action === "refund") refund(campaignId);
});

if (window.ethereum) {
  window.ethereum.on("accountsChanged", () => syncWallet(false));
  window.ethereum.on("chainChanged", () => syncWallet(false));
}

updateUIState();
syncWallet(false);
