const mint = "G8zUWL2mz8DJ16BrfDJPCo7657kJU3Y5NcrGZ6jtpBm5";

const copyMintBtn = document.getElementById("copyMint");
if (copyMintBtn) {
  copyMintBtn.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(mint);
      const copyText = document.getElementById("copyText");
      if (copyText) {
        copyText.textContent = "복사 완료!";
        setTimeout(() => copyText.textContent = "복사", 1400);
      }
    } catch (e) {
      alert(mint);
    }
  });
}

const connectWalletBtn = document.getElementById("connectWallet");

function getPhantomProvider() {
  if (window.phantom?.solana?.isPhantom) return window.phantom.solana;
  if (window.solana?.isPhantom) return window.solana;
  return null;
}

function shortAddress(address) {
  return address ? address.slice(0, 4) + "..." + address.slice(-4) : "지갑 연결";
}

function updateWalletButton(publicKey) {
  const label = publicKey ? shortAddress(publicKey.toString()) : "지갑 연결";
  if (connectWalletBtn) connectWalletBtn.textContent = label;
  const heroBtn = document.getElementById("heroConnectWallet");
  if (heroBtn) heroBtn.textContent = label;
}

function isMobileDevice() {
  return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
}

function openInPhantom() {
  const pageUrl = encodeURIComponent(window.location.href);
  const ref = encodeURIComponent(window.location.origin);
  window.location.href = `https://phantom.app/ul/browse/${pageUrl}?ref=${ref}`;
}

async function connectPhantom() {
  const provider = getPhantomProvider();

  if (!provider) {
    if (isMobileDevice()) {
      // Regular mobile browsers do not inject Phantom's provider.
      // Open this exact page inside Phantom's in-app browser so the
      // normal provider connection path becomes available.
      openInPhantom();
      return;
    }

    if (swapStatus) {
      setSwapStatus("Phantom 지갑을 여는 중...");
    }
    return;
  }

  try {
    const response = await provider.connect();
    const connectedKey = response?.publicKey || provider.publicKey;
    updateWalletButton(connectedKey);
    if (connectedKey) {
      setTimeout(() => updateWalletButton(provider.publicKey || connectedKey), 250);
    }
  } catch (err) {
    console.log("지갑 연결이 취소되었거나 실패했습니다.", err);
  }
}

if (connectWalletBtn) {
  connectWalletBtn.addEventListener("click", async () => {
    const provider = getPhantomProvider();
    if (provider?.publicKey) {
      try {
        await provider.disconnect();
        updateWalletButton(null);
      } catch (err) {
        console.log(err);
      }
    } else {
      await connectPhantom();
    }
  });
}

const provider = getPhantomProvider();
if (provider) {
  provider.on("connect", (publicKey) => {
    updateWalletButton(publicKey);
    refreshBalancesSoon();
  });
  provider.on("disconnect", () => {
    updateWalletButton(null);
    refreshBalancesSoon();
  });
  provider.on("accountChanged", (publicKey) => {
    updateWalletButton(publicKey);
    refreshBalancesSoon();
  });
  if (provider.publicKey) updateWalletButton(provider.publicKey);
  // Phantom may finish restoring the session shortly after the page loads.
  setTimeout(() => {
    if (provider.publicKey) updateWalletButton(provider.publicKey);
  }, 500);
}


const 레이디움_API = "https://transaction-v1.raydium.io";
const 레이디움_BASE_API = "https://api-v3.raydium.io";
const SOL_MINT = "So11111111111111111111111111111111111111112";
const TX_VERSION = "V0";
const solAmountInput = document.getElementById("solAmount");
const gurugAmountEl = document.getElementById("gurugAmount");
const slippageEl = document.getElementById("slippage");
const fromTokenButton = document.getElementById("fromTokenButton");
const toTokenButton = document.getElementById("toTokenButton");
const tokenPicker = document.getElementById("tokenPicker");
const tokenSearch = document.getElementById("tokenSearch");
const tokenList = document.getElementById("tokenList");
const closeTokenPicker = document.getElementById("closeTokenPicker");
const swapDirectionButton = document.getElementById("swapDirection");

const TOKEN_CATALOG = [
  {symbol:"SOL", name:"Solana", mint:SOL_MINT, decimals:9, icon:"sol"},
  {symbol:"GURUG", name:"Gurug", mint, decimals:null, icon:"https://raw.githubusercontent.com/Adakgunju/Gurug/main/assets/logo/gurug-logo2.png"},
  {symbol:"USDC", name:"USD 코인", mint:"EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", decimals:6},
  {symbol:"RAY", name:"Raydium", mint:"4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R", decimals:6},
  {symbol:"JUP", name:"Jupiter", mint:"JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN", decimals:6}
];

const CANONICAL_TOKEN_ICONS = new Map([
  [SOL_MINT, "sol"],
  [mint, "https://raw.githubusercontent.com/Adakgunju/Gurug/main/assets/logo/gurug-logo2.png"]
]);

function applyCanonicalTokenIcon(token) {
  if (!token) return token;
  const canonicalIcon = CANONICAL_TOKEN_ICONS.get(token.mint);
  if (canonicalIcon) {
    token.icon = canonicalIcon;
    // GURUG 스왑's own token gets a local verified badge in this UI.
    // This is a site-level display badge, not a Jupiter verification claim.
    if (token.mint === mint) token.verified = true;
  }
  return token;
}

let fromToken = TOKEN_CATALOG[0];
let toToken = TOKEN_CATALOG[1];
const swapButton = document.getElementById("swapButton");
const swapStatus = document.getElementById("swapStatus");
const fromBalanceEl = document.getElementById("fromBalance");
const toBalanceEl = document.getElementById("toBalance");

let walletTokenBalance = null;
let walletSolBalance = null;
let balanceRefreshTimer = null;
let balanceRequestId = 0;

let gurugDecimals = null;
let lastSwapResponse = null;

const JUPITER_TOKEN_SEARCH = "https://lite-api.jup.ag/tokens/v2/search";

function isLikelyMint(value) {
  const q = String(value || "").trim();
  return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(q);
}

async function fetchTokenByMint(mintAddress) {
  const address = String(mintAddress || "").trim();
  if (!isLikelyMint(address)) return null;

  try {
    const res = await fetch(
      JUPITER_TOKEN_SEARCH + "?query=" + encodeURIComponent(address),
      {cache:"no-store"}
    );
    if (res.ok) {
      const data = await res.json();
      const found = Array.isArray(data)
        ? data.find(token => token?.id === address)
        : null;

      if (found) {
        return {
          symbol: found.symbol || "TOKEN",
          name: found.name || "솔라나 토큰",
          mint: found.id,
          decimals: Number.isInteger(found.decimals) ? found.decimals : null,
          icon: found.icon || found.logoURI || "",
          verified: !!found.isVerified,
          source: "jupiter"
        };
      }
    }
  } catch (err) {
    console.warn("Mint lookup failed:", err);
  }

  // Keep mint-address lookup usable even if the token directory is unavailable.
  try {
    const supply = await rpcRequest(BALANCE_RPCS[0], "getTokenSupply", [address]);
    const decimals = Number(supply?.value?.decimals);
    if (Number.isInteger(decimals)) {
      return {
        symbol: address.slice(0, 4) + "…",
        name: "솔라나 토큰",
        mint: address,
        decimals,
        icon: "",
        verified: false,
        source: "rpc"
      };
    }
  } catch (err) {
    console.warn("Mint RPC lookup failed:", err);
  }

  return null;
}

function updateSwapButtonState() {
  if (!swapButton) return;

  const amount = Number(solAmountInput?.value || 0);
  const hasAmount = Number.isFinite(amount) && amount > 0;
  const hasWallet = !!getPhantomProvider()?.publicKey;

  swapButton.textContent = hasWallet
    ? "스왑"
    : "지갑 연결";

  // Do not block the existing swap flow just because a public RPC is temporarily
  // unavailable. When a balance is available, enforce the insufficient-balance check.
  const insufficient =
    hasAmount &&
    walletTokenBalance !== null &&
    amount > walletTokenBalance;

  swapButton.disabled = insufficient;

  if (insufficient) {
    setSwapStatus(
      "INSUFFICIENT " + fromToken.symbol + " BALANCE",
      true
    );
  }
}

function setBalanceUnavailable(el) {
  if (!el) return;
  el.hidden = false;
  el.textContent = "잔액 확인 불가";
}

const BALANCE_RPCS = [
  "https://rpc.solanatracker.io/public",
  "https://api.mainnet-beta.solana.com",
  "https://api.mainnet.solana.com",
  "https://solana-rpc.publicnode.com"
];

async function rpcRequest(rpcUrl, method, params) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 7000);

  try {
    const res = await fetch(rpcUrl, {
      method: "POST",
      headers: {"Content-Type":"application/json"},
      cache: "no-store",
      signal: controller.signal,
      body: JSON.stringify({
        jsonrpc:"2.0",
        id:1,
        method,
        params
      })
    });

    if (!res.ok) throw new Error("RPC HTTP " + res.status);

    const json = await res.json();
    if (json?.error) throw new Error(json.error.message || "RPC 오류");
    return json.result;
  } finally {
    clearTimeout(timeout);
  }
}

async function getJupiterHoldingBalance(owner, token) {
  const url = "https://api.jup.ag/ultra/v1/holdings/" + encodeURIComponent(owner);
  const res = await fetch(url, {
    cache: "no-store"
  });

  if (!res.ok) throw new Error("Jupiter 자산 조회 HTTP " + res.status);

  const data = await res.json();

  // Jupiter's holdings response can evolve, so locate the holding by mint
  // while accepting the common amount field shapes.
  const candidates = [];

  function collect(value) {
    if (!value) return;
    if (Array.isArray(value)) {
      value.forEach(collect);
      return;
    }
    if (typeof value !== "object") return;

    if (value.mint === token.mint || value.address === token.mint || value.id === token.mint) {
      candidates.push(value);
    }

    Object.values(value).forEach(collect);
  }

  collect(data);

  for (const item of candidates) {
    const raw =
      item.uiAmountString ??
      item.uiAmount ??
      item.balance ??
      item.amount;

    const amount = Number(raw);
    if (Number.isFinite(amount)) return amount;

    const rawAmount = Number(item.rawAmount ?? item.raw_amount);
    const decimals = Number(item.decimals);
    if (Number.isFinite(rawAmount) && Number.isInteger(decimals)) {
      return rawAmount / Math.pow(10, decimals);
    }
  }

  return null;
}

async function getOwnerTokenAccount(token) {
  const provider = getPhantomProvider();
  if (!provider?.publicKey || !token || token.symbol === "SOL") return null;

  const owner = provider.publicKey.toString();
  const tokenPrograms = [
    "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
    "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb"
  ];

  // Query by mint directly instead of scanning every 토큰 계정.
  // This is more reliable for wallets with many SPL holdings and avoids
  // RPC providers returning incomplete owner-account scans.
  for (const rpcUrl of BALANCE_RPCS) {
    for (const programId of tokenPrograms) {
      try {
        const result = await rpcRequest(rpcUrl, "getTokenAccountsByOwner", [
          owner,
          {mint: token.mint},
          {encoding:"jsonParsed", commitment:"confirmed"}
        ]);

        const account = (result?.value || []).find(item =>
          item?.account?.data?.parsed?.info?.mint === token.mint
        );

        if (account?.pubkey) return account.pubkey;
      } catch (err) {
        console.warn("Token account lookup failed:", token.symbol, rpcUrl, err);
      }
    }
  }

  // Final fallback: derive the standard ATA. Raydium can use it when the
  // account already exists, even if an RPC provider did not return it above.
  try {
    const ownerKey = new solanaWeb3.PublicKey(owner);
    const mintKey = new solanaWeb3.PublicKey(token.mint);
    const associatedProgram = new solanaWeb3.PublicKey(
      "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"
    );
    const tokenProgram = new solanaWeb3.PublicKey(
      "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
    );

    const [ata] = solanaWeb3.PublicKey.findProgramAddressSync(
      [ownerKey.toBuffer(), tokenProgram.toBuffer(), mintKey.toBuffer()],
      associatedProgram
    );

    return ata.toBase58();
  } catch (err) {
    console.warn("ATA derivation failed:", token.symbol, err);
  }

  return null;
}

async function getWalletTokenBalance(token) {
  const provider = getPhantomProvider();
  if (!provider?.publicKey) throw new Error("지갑이 연결되지 않았습니다.");

  const owner = provider.publicKey.toString();
  let lastError = null;

  // Prefer Jupiter's wallet-holdings service for SPL 토큰을 민트하세요. It is designed
  // specifically for wallet holdings and avoids browser RPC token-account
  // edge cases. Fall back to direct Solana RPC below.
  if (token.symbol !== "SOL") {
    try {
      const jupiterBalance = await getJupiterHoldingBalance(owner, token);
      if (jupiterBalance !== null) return jupiterBalance;
    } catch (jupiterError) {
      lastError = jupiterError;
      console.warn("Jupiter holdings balance failed:", jupiterError);
    }
  }

  for (const rpcUrl of BALANCE_RPCS) {
    try {
      if (token.symbol === "SOL") {
        const result = await rpcRequest(rpcUrl, "getBalance", [
          owner,
          {commitment:"confirmed"}
        ]);
        const lamports = Number(result?.value);
        if (!Number.isFinite(lamports)) {
          throw new Error("Invalid SOL balance response");
        }
        walletSolBalance = lamports / 1e9;
        return walletSolBalance;
      }

      // For SPL tokens, first resolve the deterministic Associated Token
      // Account (ATA) and ask the RPC directly for that account's balance.
      // This is much lighter and more reliable than scanning every token
      // account owned by the wallet.
      const ownerKey = new solanaWeb3.PublicKey(owner);
      const mintKey = new solanaWeb3.PublicKey(token.mint);
      const associatedProgram = new solanaWeb3.PublicKey(
        "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"
      );

      const tokenPrograms = [
        "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
        "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb"
      ];

      let foundAccount = false;

      for (const programId of tokenPrograms) {
        const tokenProgram = new solanaWeb3.PublicKey(programId);
        const [ata] = solanaWeb3.PublicKey.findProgramAddressSync(
          [
            ownerKey.toBuffer(),
            tokenProgram.toBuffer(),
            mintKey.toBuffer()
          ],
          associatedProgram
        );

        try {
          const result = await rpcRequest(rpcUrl, "getTokenAccountBalance", [
            ata.toBase58(),
            {commitment:"confirmed"}
          ]);

          const amount = Number(result?.value?.uiAmountString ?? 0);
          if (Number.isFinite(amount)) {
            foundAccount = true;
            return amount;
          }
        } catch (ataError) {
          lastError = ataError;
        }
      }

      // Fallback for wallets that hold the token in an ancillary account
      // rather than the standard ATA.
      let total = 0;
      let successfulProgramReads = 0;

      for (const programId of tokenPrograms) {
        try {
          const result = await rpcRequest(rpcUrl, "getTokenAccountsByOwner", [
            owner,
            {programId},
            {encoding:"jsonParsed", commitment:"confirmed"}
          ]);

          successfulProgramReads++;

          for (const account of result?.value || []) {
            const info = account?.account?.data?.parsed?.info;
            if (info?.mint !== token.mint) continue;

            const amount = Number(info?.tokenAmount?.uiAmountString ?? 0);
            if (Number.isFinite(amount)) total += amount;
          }
        } catch (programError) {
          lastError = programError;
        }
      }

      if (successfulProgramReads > 0) return total;
    } catch (err) {
      lastError = err;
      console.warn("Balance RPC failed:", rpcUrl, token.symbol, err);
    }
  }

  throw lastError || new Error("Could not read " + token.symbol + " balance");
}

async function refreshWalletBalances(fromSnapshot = fromToken, toSnapshot = toToken) {
  const provider = getPhantomProvider();
  const requestId = ++balanceRequestId;

  if (!provider?.publicKey) {
    walletTokenBalance = null;
    walletSolBalance = null;
    if (fromBalanceEl) {
      fromBalanceEl.hidden = false;
      fromBalanceEl.textContent = "잔액 —";
    }
    if (toBalanceEl) {
      toBalanceEl.hidden = false;
      toBalanceEl.textContent = "잔액 —";
    }
    updateSwapButtonState();
    return;
  }

  const results = await Promise.allSettled([
    getWalletTokenBalance(fromSnapshot),
    getWalletTokenBalance(toSnapshot)
  ]);

  if (requestId !== balanceRequestId) return;

  const fromResult = results[0];
  const toResult = results[1];

  if (fromResult.status === "fulfilled") {
    walletTokenBalance = fromResult.value;
    setBalanceMessage(fromBalanceEl, fromSnapshot, fromResult.value);
  } else {
    setBalanceUnavailable(fromBalanceEl);
    console.warn("FROM balance failed:", fromResult.reason);
  }

  if (toResult.status === "fulfilled") {
    setBalanceMessage(toBalanceEl, toSnapshot, toResult.value);
  } else {
    setBalanceUnavailable(toBalanceEl);
    console.warn("TO balance failed:", toResult.reason);
  }

  updateSwapButtonState();
}

function refreshBalancesSoon() {
  clearTimeout(balanceRefreshTimer);
  balanceRequestId++;

  const fromSnapshot = fromToken;
  const toSnapshot = toToken;

  balanceRefreshTimer = setTimeout(() => {
    refreshWalletBalances(fromSnapshot, toSnapshot);
  }, 120);
}

function formatBalance(value, decimals = 6) {
  if (!Number.isFinite(value)) return "0";
  return value.toLocaleString("en-US", {maximumFractionDigits: Math.min(decimals, 6)});
}

function setBalanceMessage(el, token, amount) {
  if (!el) return;
  el.hidden = false;
  el.textContent = "잔액 " + formatBalance(amount, token.decimals ?? 6);
}

const SOL_MAX_RESERVE = 0.005;

function getMaxSwapAmount() {
  if (walletTokenBalance === null || !Number.isFinite(walletTokenBalance)) return null;

  const reserve = fromToken.symbol === "SOL" ? SOL_MAX_RESERVE : 0;
  const maxAmount = Math.max(0, walletTokenBalance - reserve);
  const decimals = Number.isInteger(fromToken.decimals) ? fromToken.decimals : 6;

  return Number(maxAmount.toFixed(Math.min(decimals, 9)));
}

function applyMaxAmount() {
  const maxAmount = getMaxSwapAmount();

  if (maxAmount === null) {
    setSwapStatus("지갑을 연결하고 잔액이 표시될 때까지 기다려주세요.", true);
    return;
  }

  if (maxAmount <= 0) {
    setSwapStatus("잔액 부족: " + fromToken.symbol + " balance to swap.", true);
    return;
  }

  if (solAmountInput) {
    solAmountInput.value = String(maxAmount);
    solAmountInput.dispatchEvent(new Event("input", {bubbles:true}));
    solAmountInput.focus();
  }
}

function tokenIconMarkup(token) {
  if (token.icon === "sol") {
    return '<span class="sol-logo" aria-hidden="true"><i></i><i></i><i></i></span>';
  }
  return token.icon ? '<img src="' + token.icon + '" alt="">' : '<span class="token-fallback">' + token.symbol.slice(0,1) + '</span>';
}

const TOKEN_ICON_CACHE = new Map(
  TOKEN_CATALOG
    .filter(token => token.icon && token.icon !== "sol")
    .map(token => [token.mint, token.icon])
);

async function hydrateTokenIcon(token) {
  if (!token) return token;

  applyCanonicalTokenIcon(token);
  if (token.icon === "sol" || token.icon) return token;

  const cached = TOKEN_ICON_CACHE.get(token.mint);
  if (cached) {
    token.icon = cached;
    return token;
  }

  try {
    const found = await fetchTokenByMint(token.mint);
    if (found?.icon) {
      token.icon = found.icon;
      token.name = found.name || token.name;
      token.decimals = found.decimals ?? token.decimals;
      token.verified = found.verified ?? token.verified;
      TOKEN_ICON_CACHE.set(token.mint, found.icon);

      const catalogToken = TOKEN_CATALOG.find(item => item.mint === token.mint);
      if (catalogToken) Object.assign(catalogToken, token);
    }
  } catch (err) {
    console.warn("Token icon lookup failed:", token.symbol, err);
  }

  return token;
}

function attachTokenImageFallback(img, symbol) {
  img.addEventListener("error", () => {
    const fallback = document.createElement("span");
    fallback.className = "token-fallback token-dynamic-icon";
    fallback.textContent = String(symbol || "?").slice(0, 1).toUpperCase();
    img.replaceWith(fallback);
  }, {once:true});
}

async function hydrateCatalogIcons() {
  const targets = TOKEN_CATALOG.filter(token =>
    token.symbol !== "SOL" && token.icon !== "sol" && !token.icon
  );
  await Promise.allSettled(targets.map(token => hydrateTokenIcon(token)));
  updateTokenButtons();
}

function updateTokenButtons() {
  const fromSymbol = document.getElementById("fromTokenSymbol");
  const toSymbol = document.getElementById("toTokenSymbol");
  const toIcon = document.getElementById("toTokenIcon");
  const fromButton = document.getElementById("fromTokenButton");
  const toButton = document.getElementById("toTokenButton");

  if (fromSymbol) fromSymbol.textContent = fromToken.symbol;
  if (toSymbol) toSymbol.textContent = toToken.symbol;

  // FROM: remove every old icon, including the original HTML SOL icon.
  if (fromButton) {
    fromButton.querySelectorAll("img, .sol-logo, .token-dynamic-icon, .token-fallback").forEach(el => el.remove());

    if (fromToken.symbol === "SOL") {
      const solLogo = document.createElement("span");
      solLogo.className = "sol-logo";
      solLogo.setAttribute("aria-hidden", "true");
      solLogo.innerHTML = "<i></i><i></i><i></i>";
      fromButton.insertBefore(solLogo, fromButton.firstChild);
    } else if (fromToken.icon && fromToken.icon !== "sol") {
      const img = document.createElement("img");
      img.className = "token-dynamic-icon";
      img.src = fromToken.icon;
      img.alt = "";
      attachTokenImageFallback(img, fromToken.symbol);
      fromButton.insertBefore(img, fromButton.firstChild);
    } else {
      const fallback = document.createElement("span");
      fallback.className = "token-fallback token-dynamic-icon";
      fallback.textContent = fromToken.symbol.slice(0, 1);
      fromButton.insertBefore(fallback, fromButton.firstChild);
    }
  }

  // TO: rebuild the icon just like FROM so SOL also gets the real Solana mark.
  if (toButton) {
    toButton.querySelectorAll("img, .sol-logo, .token-dynamic-icon, .token-fallback").forEach(el => el.remove());

    if (toToken.symbol === "SOL") {
      const solLogo = document.createElement("span");
      solLogo.className = "sol-logo";
      solLogo.setAttribute("aria-hidden", "true");
      solLogo.innerHTML = "<i></i><i></i><i></i>";
      toButton.insertBefore(solLogo, toButton.firstChild);
    } else if (toToken.icon && toToken.icon !== "sol") {
      const img = document.createElement("img");
      img.className = "token-dynamic-icon";
      img.src = toToken.icon;
      img.alt = toToken.symbol;
      attachTokenImageFallback(img, toToken.symbol);
      toButton.insertBefore(img, toButton.firstChild);
    } else {
      const fallback = document.createElement("span");
      fallback.className = "token-fallback token-dynamic-icon";
      fallback.textContent = toToken.symbol.slice(0, 1);
      toButton.insertBefore(fallback, toButton.firstChild);
    }
  }

  if (toButton) toButton.classList.toggle("is-gurug", toToken.symbol === "GURUG");

  refreshBalancesSoon();
  updateSwapButtonState();
}
const TOKEN_최근 사용S_KEY = "gurug스왑하고.recentTokens";

function getRecentTokenMints() {
  try {
    const data = JSON.parse(localStorage.getItem(TOKEN_최근 사용S_KEY) || "[]");
    return Array.isArray(data) ? data.filter(isLikelyMint).slice(0, 6) : [];
  } catch {
    return [];
  }
}

function rememberToken(token) {
  if (!token?.mint) return;
  try {
    const next = [token.mint, ...getRecentTokenMints().filter(mint => mint !== token.mint)].slice(0, 6);
    localStorage.setItem(TOKEN_최근 사용S_KEY, JSON.stringify(next));
  } catch {}
}

function tokenSearchLabel(token) {
  const symbol = token.symbol || "TOKEN";
  const name = token.name || "솔라나 토큰";
  return symbol === name ? symbol : symbol + " · " + name;
}

async function renderTokenList(query = "") {
  if (!tokenList) return;
  const q = query.trim().toLowerCase();

  let remoteTokens = [];
  if (q.length >= 2) {
    try {
      const res = await fetch(JUPITER_TOKEN_SEARCH + "?query=" + encodeURIComponent(query.trim()), {
        cache: "no-store"
      });
      if (res.ok) {
        const remote = await res.json();
        if (Array.isArray(remote)) {
          remoteTokens = remote
            .filter(token => token?.id && token?.symbol)
            .map(token => ({
              symbol: token.symbol,
              name: token.name || "솔라나 토큰",
              mint: token.id,
              decimals: Number.isInteger(token.decimals) ? token.decimals : null,
              icon: token.icon || token.logoURI || "",
              verified: !!token.isVerified,
              source: "jupiter"
            }));
        }
      }
    } catch (err) {
      console.warn("Token search failed:", err);
    }
  }

  remoteTokens.forEach(token => {
    applyCanonicalTokenIcon(token);

    const existing = TOKEN_CATALOG.find(item => item.mint === token.mint);
    if (existing) {
      Object.assign(existing, token);
      applyCanonicalTokenIcon(existing);
    } else {
      TOKEN_CATALOG.push(token);
    }
  });

  const all = [...TOKEN_CATALOG, ...remoteTokens];
  const seen = new Set();
  let matches = all.filter(token => {
    if (seen.has(token.mint)) return false;
    seen.add(token.mint);
    if (!q) return true;
    return token.symbol.toLowerCase().includes(q) ||
      token.name.toLowerCase().includes(q) ||
      token.mint.toLowerCase() === q;
  });

  const recentMints = getRecentTokenMints();
  const recentRank = mint => recentMints.indexOf(mint);
  const pinnedMints = new Set(TOKEN_CATALOG.slice(0, 3).map(token => token.mint));

  matches.sort((a, b) => {
    if (!q) {
      const ap = pinnedMints.has(a.mint);
      const bp = pinnedMints.has(b.mint);
      if (ap !== bp) return ap ? -1 : 1;

      const ar = recentRank(a.mint);
      const br = recentRank(b.mint);
      if (ar !== -1 || br !== -1) {
        if (ar === -1) return 1;
        if (br === -1) return -1;
        return ar - br;
      }
      return 0;
    }

    const aExact = a.symbol.toLowerCase() === q || a.name.toLowerCase() === q;
    const bExact = b.symbol.toLowerCase() === q || b.name.toLowerCase() === q;
    if (aExact !== bExact) return aExact ? -1 : 1;

    const av = !!a.verified;
    const bv = !!b.verified;
    if (av !== bv) return av ? -1 : 1;
    return 0;
  });

  matches = matches.slice(0, 30);
  tokenList.innerHTML = "";

  if (!matches.length) {
    const empty = document.createElement("div");
    empty.className = "token-empty";
    empty.textContent = isLikelyMint(q)
      ? "Looking up this mint address..."
      : "일치하는 솔라나 토큰을 찾지 못했습니다.";
    tokenList.appendChild(empty);

    if (isLikelyMint(q)) {
      const token = await fetchTokenByMint(query.trim());
      if (token) {
        renderTokenList(token.symbol);
      } else {
        empty.textContent = "민트 주소를 찾지 못했거나 지원되지 않는 토큰입니다.";
      }
    }
    return;
  }

  matches.forEach(token => {
    applyCanonicalTokenIcon(token);

    const button = document.createElement("button");
    button.type = "button";
    button.className = "token-option";

    const badge = token.verified
      ? '<span class="token-verified" title="검증된 토큰">✓</span>'
      : "";
    const recent = !q && recentMints.includes(token.mint)
      ? '<span class="token-recent">최근 사용</span>'
      : "";
    const side = token.mint === fromToken.mint
      ? "FROM"
      : token.mint === toToken.mint
        ? "TO"
        : "";

    button.innerHTML =
      tokenIconMarkup(token) +
      '<span><strong>' + token.symbol + badge + '</strong><small>' +
      tokenSearchLabel(token) + '</small></span><em>' +
      (side || recent) +
      '</em>';

    button.addEventListener("click", async () => {
      const target = tokenPicker.dataset.target;

      // Update the selected token immediately. 토큰 정보 uses this exact
      // selected object, so it cannot fall back to the initial GURUG token.
      if (target === "from") {
        if (token.mint === toToken.mint) toToken = fromToken;
        fromToken = token;
      } else {
        if (token.mint === fromToken.mint) fromToken = toToken;
        toToken = token;
        // Commit the selected TO token to 토큰 정보 immediately.
        activeTokenInfoMint = token.mint;
        updateTokenInfo(token);
      }

      if (tokenPicker) tokenPicker.hidden = true;
      updateTokenButtons();
      resetQuoteForTokenChange();

      // Hydrate the icon after selection without changing which token
      // 토큰 정보 is showing.
      await hydrateTokenIcon(token);
      rememberToken(token);
    });

    tokenList.appendChild(button);
  });
}

function openTokenPicker(target) {
  if (!tokenPicker) return;
  tokenPicker.dataset.target = target;
  tokenPicker.hidden = false;
  if (tokenSearch) {
    tokenSearch.value = "";
    renderTokenList();
    setTimeout(() => tokenSearch.focus(), 0);
  }
}

function resetQuoteForTokenChange() {
  clearTimeout(quoteTimer);
  lastSwapResponse = null;
  if (gurugAmountEl) gurugAmountEl.textContent = "0.00";
  if (solAmountInput) {
    solAmountInput.value = "";
    solAmountInput.placeholder = "0.00";
  }
  setSwapStatus("수량을 입력하면 실시간 견적을 확인할 수 있습니다.");
}

if (fromTokenButton) fromTokenButton.addEventListener("click", () => openTokenPicker("from"));
if (toTokenButton) toTokenButton.addEventListener("click", () => openTokenPicker("to"));
if (closeTokenPicker) closeTokenPicker.addEventListener("click", () => { if (tokenPicker) tokenPicker.hidden = true; });
let tokenSearchTimer;
if (tokenSearch) tokenSearch.addEventListener("input", () => {
  clearTimeout(tokenSearchTimer);
  tokenSearchTimer = setTimeout(() => renderTokenList(tokenSearch.value), 250);
});
if (tokenPicker) tokenPicker.addEventListener("click", (event) => { if (event.target === tokenPicker) tokenPicker.hidden = true; });
document.addEventListener("keydown", (event) => { if (event.key === "Escape" && tokenPicker) tokenPicker.hidden = true; });

if (swapDirectionButton) {
  swapDirectionButton.addEventListener("click", () => {
    const oldFrom = fromToken;
    fromToken = toToken;
    toToken = oldFrom;
    updateTokenButtons();
    resetQuoteForTokenChange();
    refreshBalancesSoon();
  });
}

updateTokenButtons();
refreshBalancesSoon();
hydrateCatalogIcons();
setInterval(refreshWalletBalances, 30000);

function setSwapStatus(message, error = false, state = "") {
  if (!swapStatus) return;
  const label = document.getElementById("swapStatusLabel");
  const messageEl = document.getElementById("swapStatusMessage");
  const progress = document.getElementById("swapProgressFill");
  const txLink = document.getElementById("swapTxLink");

  swapStatus.classList.remove("error", "success", "active");
  if (state === "active") swapStatus.classList.add("active");
  if (state === "success") swapStatus.classList.add("success");
  if (error) swapStatus.classList.add("error");

  if (label) {
    label.textContent = error ? "스왑 실패"
      : state === "success" ? "스왑 성공"
      : state === "active" ? "처리 중"
      : "스왑 준비 완료";
  }
  if (messageEl) messageEl.textContent = message;
  if (progress) progress.style.width = error ? "100%" : state === "success" ? "100%" : state === "active" ? "72%" : "0%";
  if (txLink && state !== "success") {
    txLink.hidden = true;
    txLink.removeAttribute("href");
  }
}

function showSwapSuccess(solAmount, gurugAmount, signature) {
  if (!swapStatus) return;
  const label = document.getElementById("swapStatusLabel");
  const messageEl = document.getElementById("swapStatusMessage");
  const progress = document.getElementById("swapProgressFill");
  const txLink = document.getElementById("swapTxLink");

  swapStatus.classList.remove("error", "active");
  swapStatus.classList.add("success");

  if (label) label.textContent = "스왑 성공";
  if (messageEl) messageEl.textContent = solAmount + " " + fromToken.symbol + " → " + gurugAmount + " " + toToken.symbol;
  if (progress) progress.style.width = "100%";
  if (txLink && signature) {
    txLink.href = "https://solscan.io/tx/" + signature;
    txLink.hidden = false;
  }
}

async function getGurugDecimals() {
  if (gurugDecimals !== null) return gurugDecimals;
  const res = await fetch("https://api.mainnet-beta.solana.com", {
    method: "POST",
    headers: {"Content-Type":"application/json"},
    body: JSON.stringify({
      jsonrpc:"2.0", id:1, method:"getTokenSupply",
      params:[mint]
    })
  });
  const json = await res.json();
  gurugDecimals = json?.result?.value?.decimals ?? 6;
  return gurugDecimals;
}

function parseSolToLamports(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n * 1000000000).toString();
}

function formatToken(raw, decimals) {
  const n = Number(raw) / Math.pow(10, decimals);
  if (!Number.isFinite(n)) return "0.00";
  return n.toLocaleString("en-US", {maximumFractionDigits: 4});
}

function parseTokenAmount(value, decimals) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n * Math.pow(10, decimals)).toString();
}

async function getTokenDecimals(token) {
  if (token.decimals !== null && token.decimals !== undefined) return token.decimals;
  if (token.mint === mint) return await getGurugDecimals();
  const res = await fetch("https://api.mainnet-beta.solana.com", {
    method:"POST", headers:{"Content-Type":"application/json"},
    body:JSON.stringify({jsonrpc:"2.0",id:1,method:"getTokenSupply",params:[token.mint]})
  });
  const json = await res.json();
  token.decimals = json?.result?.value?.decimals ?? 6;
  return token.decimals;
}

async function getQuote() {
  if (isSwapping) return;
  const decimals = await getTokenDecimals(fromToken);
  const amount = parseTokenAmount(solAmountInput?.value, decimals);
  if (!amount) {
    if (gurugAmountEl) gurugAmountEl.textContent = "0.00";
    lastSwapResponse = null;
    setSwapStatus("수량을 입력하면 실시간 견적을 확인할 수 있습니다.");
    return;
  }

  try {
    setSwapStatus("레이디움 실시간 견적을 불러오는 중...");
    const slippageBps = Math.round(Number(slippageEl?.value || 0.5) * 100);
    const url = 레이디움_API + "/compute/swap-base-in"
      + "?inputMint=" + encodeURIComponent(fromToken.mint)
      + "&outputMint=" + encodeURIComponent(toToken.mint)
      + "&amount=" + amount
      + "&slippageBps=" + slippageBps
      + "&txVersion=" + TX_VERSION;

    const res = await fetch(url);
    const json = await res.json();
    if (!res.ok || !json.success || !json.data) throw new Error(json.msg || "견적을 불러오지 못했습니다.");

    lastSwapResponse = json;
    const outputDecimals = await getTokenDecimals(toToken);
    if (gurugAmountEl) gurugAmountEl.textContent = formatToken(json.data.outputAmount, outputDecimals);
    setSwapStatus("견적이 준비되었습니다. 수량을 확인한 후 Phantom에서 승인해주세요.");
  } catch (err) {
    lastSwapResponse = null;
    if (gurugAmountEl) gurugAmountEl.textContent = "—";
    setSwapStatus("견적을 가져오지 못했습니다. 잠시 후 다시 시도해주세요.", true);
    console.error(err);
  }
}

let quoteTimer;
let isSwapping = false;
const maxButton = document.getElementById("maxButton");
if (maxButton) {
  maxButton.addEventListener("click", applyMaxAmount);
}

if (solAmountInput) {
  solAmountInput.addEventListener("input", () => {
    clearTimeout(quoteTimer);
    if (swapStatus?.classList.contains("success")) {
      swapStatus.classList.remove("success");
      const label = document.getElementById("swapStatusLabel");
      const messageEl = document.getElementById("swapStatusMessage");
      const progress = document.getElementById("swapProgressFill");
      const txLink = document.getElementById("swapTxLink");
      if (label) label.textContent = "처리 중";
      if (messageEl) messageEl.textContent = "새 Raydium 실시간 견적을 불러오는 중...";
      if (progress) progress.style.width = "35%";
      if (txLink) {
        txLink.hidden = true;
        txLink.removeAttribute("href");
      }
    }
    updateSwapButtonState();
    quoteTimer = setTimeout(getQuote, 350);
  });
}
if (slippageEl) slippageEl.addEventListener("change", getQuote);

async function executeGurugSwap() {
  const provider = getPhantomProvider();
  if (!provider?.publicKey) {
    setSwapStatus("먼저 Phantom을 연결해주세요.", true);
    await connectPhantom();
    return;
  }

  const inputDecimals = await getTokenDecimals(fromToken);
  const amount = parseTokenAmount(solAmountInput?.value, inputDecimals);

  await refreshWalletBalances();
  const requestedAmount = Number(solAmountInput?.value || 0);
  if (walletTokenBalance !== null && requestedAmount > walletTokenBalance) {
    updateSwapButtonState();
    return;
  }
  if (!amount) {
    setSwapStatus("먼저 수량을 입력해주세요.", true);
    return;
  }

  clearTimeout(quoteTimer);
  isSwapping = true;
  swapButton.disabled = true;
  setSwapStatus("거래를 준비하는 중...", false, "active");

  try {
    if (!lastSwapResponse) {
      await getQuote();
      if (!lastSwapResponse) throw new Error("유효한 견적이 없습니다.");
    }

    const feeRes = await fetch(레이디움_BASE_API + "/main/auto-fee");
    const feeJson = await feeRes.json();
    const priorityFee = String(feeJson?.data?.default?.h || feeJson?.data?.default?.m || 0);

    // Raydium needs the user's actual SPL token accounts when SOL is not
    // the input/output side. Native SOL is handled by wrapSol/unwrapSol.
    const inputAccount = fromToken.symbol === "SOL"
      ? undefined
      : await getOwnerTokenAccount(fromToken);

    const outputAccount = toToken.symbol === "SOL"
      ? undefined
      : await getOwnerTokenAccount(toToken);

    if (fromToken.symbol !== "SOL" && !inputAccount) {
      throw new Error("현재 지갑에서 찾을 수 없습니다: " + fromToken.symbol + " 토큰 계정.");
    }

    const txRes = await fetch(레이디움_API + "/transaction/swap-base-in", {
      method: "POST",
      headers: {"Content-Type":"application/json"},
      body: JSON.stringify({
        computeUnitPriceMicroLamports: priorityFee,
        swapResponse: lastSwapResponse,
        txVersion: TX_VERSION,
        wallet: provider.publicKey.toString(),
        wrapSol: fromToken.symbol === "SOL",
        unwrapSol: toToken.symbol === "SOL",
        inputAccount,
        outputAccount
      })
    });

    const txJson = await txRes.json();
    if (!txRes.ok || !txJson.success || !txJson.data?.length) {
      throw new Error(txJson.msg || "거래 생성에 실패했습니다.");
    }

    const transactions = txJson.data.map(item =>
      solanaWeb3.VersionedTransaction.deserialize(
        Uint8Array.from(atob(item.transaction), c => c.charCodeAt(0))
      )
    );

    const signatures = [];
    for (const tx of transactions) {
      setSwapStatus("Phantom 승인을 기다리는 중...");
      const signed = await provider.signAndSendTransaction(tx);
      signatures.push(signed.signature);
    }

    setSwapStatus("거래가 전송되었습니다. 온체인 확인을 기다리는 중...", false, "active");
    // Use a fallback RPC list for confirmation. The public Solana RPC can rate-limit
    // browser traffic with HTTP 403 even when the swap itself has already landed.
    const confirmationRpcs = [
      "https://solana-rpc.publicnode.com",
      "https://api.mainnet-beta.solana.com"
    ];

    for (const signature of signatures) {
      setSwapStatus("솔라나에서 스왑을 확인하는 중...", false, "active");
      let confirmed = false;
      let lastRpcError = null;

      for (const rpcUrl of confirmationRpcs) {
        try {
          const connection = new solanaWeb3.Connection(rpcUrl, "confirmed");

          for (let attempt = 0; attempt < 45; attempt++) {
            const statusResult = await connection.getSignatureStatuses([signature], {
              searchTransactionHistory: true
            });
            const status = statusResult?.value?.[0];

            if (status?.err) {
              throw new Error("온체인 거래가 실패했습니다. 거래 내역을 확인해주세요.");
            }

            if (status?.confirmationStatus === "confirmed" || status?.confirmationStatus === "finalized") {
              confirmed = true;
              break;
            }

            await new Promise(resolve => setTimeout(resolve, 1000));
          }

          if (confirmed) break;
        } catch (rpcError) {
          lastRpcError = rpcError;
          console.warn("Confirmation RPC failed:", rpcUrl, rpcError);
        }
      }

      if (!confirmed) {
        const explorerUrl = "https://solscan.io/tx/" + signature;
        throw new Error("스왑은 전송되었지만 자동으로 확인하지 못했습니다. 거래 내역을 확인해주세요: " + explorerUrl);
      }
    }

    const confirmedFromAmount = Number(solAmountInput?.value || 0).toLocaleString("en-US", { maximumFractionDigits: 6 });
    const confirmedToAmount = gurugAmountEl?.textContent || "0.00";
    const finalSignature = signatures[signatures.length - 1];

    showSwapSuccess(confirmedFromAmount, confirmedToAmount, finalSignature);

    lastSwapResponse = null;
    if (solAmountInput) solAmountInput.value = "";
    if (gurugAmountEl) gurugAmountEl.textContent = "0.00";
  } catch (err) {
    console.error("GURUG swap failed:", err);
    const message = err?.message || "스왑이 취소되었거나 실패했습니다.";
    setSwapStatus(message, true);
  } finally {
    isSwapping = false;
    swapButton.disabled = false;
  }
}

if (swapButton) swapButton.addEventListener("click", executeGurugSwap);


/* --- 토큰 정보 / 실시간 시세 PANEL --- */
const TOKEN_INFO_DEX = "https://api.dexscreener.com/latest/dex/tokens/";

function formatUsd(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  if (n >= 1) return "$" + n.toLocaleString("en-US", {maximumFractionDigits:2});
  if (n >= 0.01) return "$" + n.toLocaleString("en-US", {maximumFractionDigits:4});
  return "$" + n.toLocaleString("en-US", {maximumFractionDigits:8});
}

function formatCompactUsd(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  if (n >= 1000000000) return "$" + (n / 1000000000).toFixed(2) + "B";
  if (n >= 1000000) return "$" + (n / 1000000).toFixed(2) + "M";
  if (n >= 1000) return "$" + (n / 1000).toFixed(1) + "K";
  return "$" + n.toFixed(0);
}

function tokenInfoIconMarkup(token) {
  applyCanonicalTokenIcon(token);
  if (token?.symbol === "SOL") {
    return '<span class="token-info-icon sol-logo" aria-hidden="true"><i></i><i></i><i></i></span>';
  }
  if (token?.icon) {
    return '<img class="token-info-icon" src="' + token.icon + '" alt="">';
  }
  return '<span class="token-info-icon token-info-placeholder">' + String(token?.symbol || "?").slice(0,1).toUpperCase() + '</span>';
}

let tokenInfoRequestId = 0;
let activeTokenInfoMint = null;

async function updateTokenInfo(token) {
  if (!token?.mint) return;
  activeTokenInfoMint = token.mint;
  const requestId = ++tokenInfoRequestId;
  const nameEl = document.getElementById("tokenInfoName");
  const symbolEl = document.getElementById("tokenInfoSymbol");
  const identityEl = document.getElementById("tokenInfoIdentity");
  const mintEl = document.getElementById("tokenInfoMint");
  const statusEl = document.getElementById("tokenInfoStatus");
  const priceEl = document.getElementById("tokenInfoPrice");
  const changeEl = document.getElementById("tokenInfoChange");
  const liquidityEl = document.getElementById("tokenInfoLiquidity");
  const volumeEl = document.getElementById("tokenInfoVolume");
  const networkEl = document.getElementById("tokenInfoNetwork");
  const chartEl = document.getElementById("tokenInfoChart");
  const swapEl = document.getElementById("tokenInfoSwap");

  if (!nameEl || !token) return;

  applyCanonicalTokenIcon(token);
  nameEl.textContent = token.name || "솔라나 토큰";
  symbolEl.textContent = "$" + (token.symbol || "TOKEN");
  mintEl.textContent = token.mint || "—";
  networkEl.textContent = "SOLANA";
  if (swapEl) swapEl.hidden = false;
  identityEl.innerHTML =
    tokenInfoIconMarkup(token) +
    '<div><strong>' + (token.name || "솔라나 토큰") +
    '</strong><small>$' + (token.symbol || "TOKEN") + '</small></div>';

  statusEl.textContent = "시세 불러오는 중";
  priceEl.textContent = "—";
  changeEl.textContent = "—";
  changeEl.style.color = "";
  liquidityEl.textContent = "—";
  volumeEl.textContent = "—";
  chartEl.href = "https://dexscreener.com/solana/" + encodeURIComponent(token.mint);

  try {
    const res = await fetch(TOKEN_INFO_DEX + encodeURIComponent(token.mint), {cache:"no-store"});
    const json = await res.json();
    if (requestId !== tokenInfoRequestId || activeTokenInfoMint !== token.mint || toToken.mint !== token.mint) return;
    const pairs = Array.isArray(json?.pairs) ? json.pairs : [];
    const solanaPairs = pairs.filter(pair => pair?.chainId === "solana");
    const pair = solanaPairs.sort((a,b) =>
      Number(b?.liquidity?.usd || 0) - Number(a?.liquidity?.usd || 0)
    )[0];

    if (!pair) {
      statusEl.textContent = "시세 정보 없음";
      return;
    }

    const price = Number(pair.priceUsd);
    const change = Number(pair.priceChange?.h24);
    const liquidity = Number(pair.liquidity?.usd);
    const volume = Number(pair.volume?.h24);

    priceEl.textContent = formatUsd(price);
    changeEl.textContent = Number.isFinite(change)
      ? (change >= 0 ? "+" : "") + change.toFixed(2) + "%"
      : "—";
    changeEl.style.color = Number.isFinite(change) && change < 0 ? "#ff8f8f" : "#ffe500";
    liquidityEl.textContent = formatCompactUsd(liquidity);
    volumeEl.textContent = formatCompactUsd(volume);
    statusEl.textContent = "실시간 시세";
    chartEl.href = pair.url || chartEl.href;
  } catch (err) {
    console.warn("Token info market lookup failed:", err);
    statusEl.textContent = "시세 정보를 불러올 수 없습니다.";
  }
}

const tokenInfoCopyButton = document.getElementById("tokenInfoCopy");
if (tokenInfoCopyButton) {
  tokenInfoCopyButton.addEventListener("click", async () => {
    const value = document.getElementById("tokenInfoMint")?.textContent || "";
    if (!value || value === "—") return;
    try {
      await navigator.clipboard.writeText(value);
      const label = document.getElementById("tokenInfoCopyText");
      if (label) {
        label.textContent = "복사 완료!";
        setTimeout(() => label.textContent = "복사", 1400);
      }
    } catch {
      alert(value);
    }
  });
}

const tokenInfoSwapButton = document.getElementById("tokenInfoSwap");
if (tokenInfoSwapButton) {
  tokenInfoSwapButton.addEventListener("click", () => {
    document.getElementById("swap")?.scrollIntoView({behavior:"smooth", block:"start"});
  });
}

// Initial 토큰 정보 follows the default TO token (GURUG).
// Later TO selections call updateTokenInfo() directly with the selected token.
updateTokenInfo(toToken);

/* --- LIVE GURUG MARKET TICKER --- */
async function updateGurugMarketTicker() {
  const priceEl = document.getElementById("gurugPrice");
  const changeEl = document.getElementById("gurugChange");
  if (!priceEl || !changeEl) return;

  try {
    const res = await fetch("https://api.dexscreener.com/latest/dex/pairs/solana/88a3L9i5KHddtUEPJ1crt8yp8RJNoWrgb7sSGGoU1qqe", {
      cache: "no-store"
    });
    const json = await res.json();
    const pair = json?.pair;
    const price = Number(pair?.priceUsd);
    const change = Number(pair?.priceChange?.h24);

    if (Number.isFinite(price)) {
      priceEl.textContent = price < 0.000001
        ? "$" + price.toFixed(10)
        : price < 0.001
          ? "$" + price.toFixed(7)
          : "$" + price.toFixed(6);
    }

    if (Number.isFinite(change)) {
      changeEl.textContent = (change >= 0 ? "▲ " : "▼ ") + Math.abs(change).toFixed(2) + "%";
      changeEl.classList.toggle("down", change < 0);
    }
  } catch (err) {
    console.log("GURUG 시세 업데이트 실패.", err);
  }
}

updateGurugMarketTicker();
setInterval(updateGurugMarketTicker, 30000);


const heroConnectWalletBtn = document.getElementById("heroConnectWallet");
if (heroConnectWalletBtn) {
  heroConnectWalletBtn.addEventListener("click", async () => {
    const provider = getPhantomProvider();
    if (provider?.publicKey) {
      try {
        await provider.disconnect();
        updateWalletButton(null);
      } catch (err) {
        console.log(err);
      }
    } else {
      await connectPhantom();
    }
  });
}


