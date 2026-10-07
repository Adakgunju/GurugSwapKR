(() => {
  const app = document.getElementById("tokenAuthorityApp");
  if (!app || typeof solanaWeb3 === "undefined") return;

  const RPCS = [
    "https://api.mainnet-beta.solana.com",
    "https://solana-rpc.publicnode.com"
  ];
  const TOKEN_PROGRAM = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
  const TOKEN_2022_PROGRAM = "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxwEb";
  const SYSTEM_PROGRAM = "11111111111111111111111111111111";
  const GURUG_REVOKE_FEE_LAMPORTS = 50000000;
  let activeRpc = RPCS[0];
  let mintState = null;

  app.innerHTML = `
    <div class="token-authority-card">
      <div class="token-authority-head">
        <span>AUTHORITY MANAGER</span>
        <span class="token-authority-live">솔라나 메인넷</span>
      </div>

      <div class="token-authority-lookup">
        <label>
          <small>토큰 민트 주소</small>
          <input id="authorityMint" type="text" inputmode="text" autocomplete="off" placeholder="토큰 민트 주소를 입력하세요">
        </label>
        <button id="authorityCheck" class="connect" type="button">CHECK AUTHORITIES</button>
      </div>

      <div id="authorityWalletNote" class="token-authority-note">권한을 변경하거나 해제하려면 우측 상단에서 지갑을 연결해주세요.</div>

      <div class="token-authority-grid">
        <article class="authority-row" data-type="mint">
          <div class="authority-row-top">
            <div>
              <span class="authority-kicker">MINT AUTHORITY</span>
              <h3>민트 권한</h3>
            </div>
            <span id="mintAuthorityState" class="authority-state">확인 전</span>
          </div>
          <div class="authority-current">
            <small>CURRENT AUTHORITY</small>
            <code id="mintAuthorityAddress">—</code>
          </div>
          <label class="authority-new">
            <small>NEW AUTHORITY WALLET</small>
            <input id="mintAuthorityNew" type="text" inputmode="text" autocomplete="off" placeholder="Paste wallet address">
          </label>
          <div class="authority-actions">
            <button id="mintAuthorityChange" class="authority-change" type="button" disabled>권한 변경</button>
            <button id="mintAuthorityRevoke" class="authority-revoke" type="button" disabled>REVOKE PERMANENTLY</button>
          </div>
        </article>

        <article class="authority-row" data-type="freeze">
          <div class="authority-row-top">
            <div>
              <span class="authority-kicker">FREEZE AUTHORITY</span>
              <h3>동결 권한</h3>
            </div>
            <span id="freezeAuthorityState" class="authority-state">확인 전</span>
          </div>
          <div class="authority-current">
            <small>CURRENT AUTHORITY</small>
            <code id="freezeAuthorityAddress">—</code>
          </div>
          <label class="authority-new">
            <small>NEW AUTHORITY WALLET</small>
            <input id="freezeAuthorityNew" type="text" inputmode="text" autocomplete="off" placeholder="Paste wallet address">
          </label>
          <div class="authority-actions">
            <button id="freezeAuthorityChange" class="authority-change" type="button" disabled>권한 변경</button>
            <button id="freezeAuthorityRevoke" class="authority-revoke" type="button" disabled>REVOKE PERMANENTLY</button>
          </div>
        </article>
      </div>

      <div id="authorityStatus" class="token-authority-status">
        <div class="token-authority-status-top"><span class="token-authority-dot"></span><span id="authorityStatusLabel">READY</span></div>
        <div id="authorityStatusMessage">Enter a token mint address to inspect its current 권한을 관리하세요.</div>
        <a id="authorityTxLink" href="#" target="_blank" rel="noopener noreferrer" hidden>거래 내역 보기 ↗</a>
      </div>

      <div class="token-authority-foot">
        <span>비수탁형</span>
        <span>SET AUTHORITY ON-체인</span>
        <span>REVOKE FEE: 0.05 SOL</span>
      </div>
    </div>

    <div id="authorityModal" class="authority-modal" hidden>
      <div class="authority-modal-backdrop" data-close-authority-modal></div>
      <div class="authority-modal-box" role="dialog" aria-modal="true" aria-labelledby="authorityModalTitle">
        <span class="authority-modal-warning">⚠ IRREVERSIBLE ACTION</span>
        <h3 id="authorityModalTitle">Remove Authority permanently?</h3>
        <p id="authorityModalMessage">This action cannot be undone. The authority will be set to NONE on-chain.</p>
        <label id="authorityModalConfirmWrap" hidden>
          <small>TYPE REVOKE TO CONFIRM</small>
          <input id="authorityModalConfirm" type="text" autocomplete="off" placeholder="REVOKE">
        </label>
        <div class="authority-modal-actions">
          <button id="authorityModalCancel" type="button">CANCEL</button>
          <button id="authorityModalConfirmButton" class="authority-revoke" type="button">영구 해제</button>
        </div>
      </div>
    </div>
  `;

  const mintInput = document.getElementById("authorityMint");
  const checkButton = document.getElementById("authorityCheck");
  const status = document.getElementById("authorityStatus");
  const statusLabel = document.getElementById("authorityStatusLabel");
  const statusMessage = document.getElementById("authorityStatusMessage");
  const txLink = document.getElementById("authorityTxLink");
  const modal = document.getElementById("authorityModal");
  const modalTitle = document.getElementById("authorityModalTitle");
  const modalMessage = document.getElementById("authorityModalMessage");
  const modalConfirmWrap = document.getElementById("authorityModalConfirmWrap");
  const modalConfirm = document.getElementById("authorityModalConfirm");
  const modalConfirmButton = document.getElementById("authorityModalConfirmButton");
  const modalCancel = document.getElementById("authorityModalCancel");

  const rows = {
    mint: {
      address: document.getElementById("mintAuthorityAddress"),
      state: document.getElementById("mintAuthorityState"),
      input: document.getElementById("mintAuthorityNew"),
      change: document.getElementById("mintAuthorityChange"),
      revoke: document.getElementById("mintAuthorityRevoke")
    },
    freeze: {
      address: document.getElementById("freezeAuthorityAddress"),
      state: document.getElementById("freezeAuthorityState"),
      input: document.getElementById("freezeAuthorityNew"),
      change: document.getElementById("freezeAuthorityChange"),
      revoke: document.getElementById("freezeAuthorityRevoke")
    }
  };

  function provider() {
    if (typeof getPhantomProvider === "function") return getPhantomProvider();
    if (window.phantom?.solana?.isPhantom) return window.phantom.solana;
    if (window.solana?.isPhantom) return window.solana;
    return null;
  }

  function isAddress(value) {
    try { new solanaWeb3.PublicKey(String(value || "").trim()); return true; }
    catch { return false; }
  }

  function short(value) {
    return value ? value.slice(0, 6) + "…" + value.slice(-6) : "—";
  }

  function setStatus(label, message, type = "") {
    status.className = "token-authority-status" + (type ? " " + type : "");
    statusLabel.textContent = label;
    statusMessage.textContent = message;
    txLink.hidden = true;
  }

  async function rpc(method, params) {
    let lastError = null;
    const candidates = [activeRpc, ...RPCS.filter(url => url !== activeRpc)];
    for (const url of candidates) {
      try {
        const response = await fetch(url, {
          method: "POST",
          headers: {"Content-Type":"application/json"},
          cache: "no-store",
          body: JSON.stringify({jsonrpc:"2.0", id:Date.now(), method, params})
        });
        if (!response.ok) {
          lastError = new Error("RPC HTTP " + response.status);
          continue;
        }
        const json = await response.json();
        if (json?.error) {
          lastError = new Error(json.error.message || "RPC error");
          continue;
        }
        activeRpc = url;
        return json.result;
      } catch (error) {
        lastError = error;
      }
    }
    throw lastError || new Error("RPC unavailable");
  }

  function base64Bytes(encoded) {
    return Uint8Array.from(atob(encoded), c => c.charCodeAt(0));
  }

  function readU32LE(bytes, offset) {
    return (
      bytes[offset] |
      (bytes[offset + 1] << 8) |
      (bytes[offset + 2] << 16) |
      (bytes[offset + 3] << 24)
    ) >>> 0;
  }

  function parseAuthority(bytes, optionOffset, keyOffset) {
    const option = readU32LE(bytes, optionOffset);
    if (option === 0) return null;
    if (option !== 1 || bytes.length < keyOffset + 32) {
      throw new Error("Unsupported mint authority layout.");
    }
    return new solanaWeb3.PublicKey(bytes.slice(keyOffset, keyOffset + 32)).toString();
  }

  async function readMint(mint) {
    // Prefer Solana's parsed mint response. This correctly handles both
    // classic SPL Token mints and Token-2022 mints without relying on
    // extension length or manual byte-layout assumptions.
    const parsedResult = await rpc("getAccountInfo", [
      mint,
      {encoding:"jsonParsed", commitment:"confirmed"}
    ]);
    const parsedValue = parsedResult?.value;
    if (!parsedValue) throw new Error("Token mint account was not found.");
    if (parsedValue.owner !== TOKEN_PROGRAM && parsedValue.owner !== TOKEN_2022_PROGRAM) {
      throw new Error("This address is not an SPL Token or Token-2022 mint.");
    }

    const parsed = parsedValue.data?.parsed;
    const info = parsed?.info;
    const type = parsed?.type;
    if (type === "mint" && info) {
      return {
        mint,
        programId: parsedValue.owner,
        mintAuthority: info.mintAuthority || null,
        freezeAuthority: info.freezeAuthority || null
      };
    }

    // Fallback for RPCs that do not return jsonParsed for this mint.
    const result = await rpc("getAccountInfo", [
      mint,
      {encoding:"base64", commitment:"confirmed"}
    ]);
    const value = result?.value;
    if (!value?.data?.[0]) throw new Error("Token mint account was not found.");
    if (value.owner !== TOKEN_PROGRAM && value.owner !== TOKEN_2022_PROGRAM) {
      throw new Error("This address is not an SPL Token or Token-2022 mint.");
    }

    const bytes = base64Bytes(value.data[0]);
    if (bytes.length < 82) throw new Error("Invalid token mint account.");

    return {
      mint,
      programId: value.owner,
      mintAuthority: parseAuthority(bytes, 0, 4),
      freezeAuthority: parseAuthority(bytes, 36, 40)
    };
  }

  function walletMatches(authority) {
    const wallet = provider()?.publicKey?.toString();
    return Boolean(wallet && authority && wallet === authority);
  }

  function updateRow(type) {
    const row = rows[type];

    // Before a mint has been checked, show a neutral state.
    // Do not imply that the authority has been revoked.
    if (!mintState) {
      row.address.textContent = "—";
      row.address.title = "";
      row.state.textContent = "확인 전";
      row.state.className = "authority-state";
      row.change.disabled = true;
      row.revoke.disabled = true;
      row.input.disabled = true;
      row.input.value = "";
      return;
    }

    const authority = mintState[type + "Authority"] || null;
    row.address.textContent = authority ? short(authority) : "없음 — 영구 해제됨";
    row.address.title = authority || "";
    row.state.textContent = authority ? "ACTIVE" : "REVOKED";
    row.state.className = "authority-state " + (authority ? "active" : "revoked");

    const canManage = Boolean(authority && walletMatches(authority));
    row.change.disabled = !canManage;
    row.revoke.disabled = !canManage;
    row.input.disabled = !canManage;

    if (!authority) row.input.value = "";
  }

  function updateAllRows() {
    updateRow("mint");
    updateRow("freeze");
    const wallet = provider()?.publicKey?.toString();
    document.getElementById("authorityWalletNote").textContent = wallet
      ? "Connected wallet: " + short(wallet) + ". Only the current authority wallet can make changes."
      : "권한을 변경하거나 해제하려면 우측 상단에서 지갑을 연결해주세요.";
  }

  async function checkAuthorities() {
    const mint = mintInput.value.trim();
    if (!isAddress(mint)) {
      setStatus("잘못된 민트 주소", "올바른 솔라나 민트 주소를 입력해주세요.", "error");
      return;
    }

    checkButton.disabled = true;
    setStatus("CHECKING", "Reading the mint authorities directly from Solana…", "active");
    try {
      mintState = await readMint(new solanaWeb3.PublicKey(mint).toString());
      updateAllRows();
      const programName = mintState.programId === TOKEN_2022_PROGRAM ? "Token-2022" : "SPL Token";
      setStatus("권한 조회 완료", programName + " mint checked successfully. Current authorities are shown below.", "success");
    } catch (error) {
      mintState = null;
      updateAllRows();
      setStatus("확인 실패", error?.message || "토큰 민트를 읽을 수 없습니다.", "error");
    } finally {
      checkButton.disabled = false;
    }
  }

  function setModal(mode, type, newAuthority) {
    const label = type === "mint" ? "민트 권한" : "동결 권한";
    const current = mintState?.[type + "Authority"] || "";
    modal.hidden = false;
    modalConfirm.value = "";

    if (mode === "revoke") {
      modalTitle.textContent = "Remove " + label + " permanently?";
      modalMessage.textContent = "This action is irreversible. " + label + " will be set to NONE on-chain and can never be restored.";
      modalConfirmWrap.hidden = false;
      modalConfirmButton.className = "authority-revoke";
      modalConfirmButton.textContent = "영구 해제";
      modalConfirmButton.dataset.mode = "revoke";
    } else {
      modalTitle.textContent = "Change " + label + "?";
      modalMessage.textContent = "Change the current authority " + short(current) + " to " + short(newAuthority) + "?";
      modalConfirmWrap.hidden = true;
      modalConfirmButton.className = "";
      modalConfirmButton.textContent = "권한 변경";
      modalConfirmButton.dataset.mode = "change";
    }

    modalConfirmButton.dataset.type = type;
    modalConfirmButton.dataset.newAuthority = newAuthority || "";
  }

  function closeModal() {
    modal.hidden = true;
    modalConfirm.value = "";
  }

  function setAuthorityInstruction(mint, authorityType, currentAuthority, newAuthority, programId) {
    const authorityTypeValue = authorityType === "mint" ? 0 : 1;
    const newKey = newAuthority ? new solanaWeb3.PublicKey(newAuthority) : null;
    const data = new Uint8Array(newKey ? 35 : 3);
    data[0] = 6;
    data[1] = authorityTypeValue;
    data[2] = newKey ? 1 : 0;
    if (newKey) data.set(newKey.toBytes(), 3);

    return new solanaWeb3.TransactionInstruction({
      programId: new solanaWeb3.PublicKey(programId),
      keys: [
        {pubkey:new solanaWeb3.PublicKey(mint), isSigner:false, isWritable:true},
        {pubkey:new solanaWeb3.PublicKey(currentAuthority), isSigner:true, isWritable:false}
      ],
      data
    });
  }

  async function waitForSignature(txId) {
    const candidates = [activeRpc, ...RPCS.filter(url => url !== activeRpc)];
    let lastError = null;

    for (const url of candidates) {
      try {
        const connection = new solanaWeb3.Connection(url, "confirmed");
        for (let attempt = 0; attempt < 30; attempt++) {
          const result = await connection.getSignatureStatuses([txId], {searchTransactionHistory:true});
          const sig = result?.value?.[0];
          if (sig?.err) throw new Error("The authority transaction failed on-chain.");
          if (sig?.confirmationStatus === "confirmed" || sig?.confirmationStatus === "finalized") return true;
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      } catch (error) {
        lastError = error;
        if (error?.message?.includes("failed on-chain")) throw error;
      }
    }

    if (lastError) throw lastError;
    throw new Error("The transaction was sent, but confirmation could not be verified. Check the transaction before retrying.");
  }

  async function applyAuthority(type, newAuthority) {
    const p = provider();
    if (!p?.publicKey) throw new Error("먼저 우측 상단에서 지갑을 연결해주세요.");
    if (!mintState) throw new Error("Check the token authorities first.");

    const current = mintState[type + "Authority"];
    if (!current || !walletMatches(current)) {
      throw new Error("연결된 지갑이 현재 권한 지갑이 아닙니다.");
    }
    if (newAuthority && !isAddress(newAuthority)) throw new Error("새 지갑 주소를 올바르게 입력해주세요.");
    if (newAuthority === current) throw new Error("The new authority is already the current wallet.");

    const transaction = new solanaWeb3.Transaction();
    const isRevoke = !newAuthority;

    // GurugSwap service fee applies only to permanent revocation.
    // Keep authority changes free; add the 0.05 SOL fee to the same transaction.
    if (isRevoke) {
      // Build the native SOL transfer directly so this browser bundle does
      // not depend on a global Buffer implementation.
      const feeData = new Uint8Array(12);
      feeData[0] = 2; // System Program: Transfer
      let feeLamports = BigInt(GURUG_REVOKE_FEE_LAMPORTS);
      for (let i = 0; i < 8; i++) {
        feeData[4 + i] = Number(feeLamports & 255n);
        feeLamports >>= 8n;
      }
      transaction.add(new solanaWeb3.TransactionInstruction({
        programId: new solanaWeb3.PublicKey(SYSTEM_PROGRAM),
        keys: [
          {pubkey:p.publicKey, isSigner:true, isWritable:true},
          {pubkey:new solanaWeb3.PublicKey("ARmME4KE6oe87TokQf7SmYZL6e5Gpz1UCobU3EEqSwEH"), isSigner:false, isWritable:true}
        ],
        data: feeData
      }));
    }

    transaction.add(setAuthorityInstruction(
      mintState.mint,
      type,
      current,
      newAuthority || null,
      mintState.programId
    ));

    const connection = new solanaWeb3.Connection(activeRpc, "confirmed");
    const latest = await connection.getLatestBlockhash("confirmed");
    transaction.recentBlockhash = latest.blockhash;
    transaction.feePayer = p.publicKey;

    setStatus(
      "승인 대기 중",
      isRevoke
        ? "Phantom에서 영구 권한 해제 및 0.05 SOL GurugSwap 서비스 수수료를 승인해주세요."
        : "지갑에서 권한 변경을 승인해주세요.",
      "active"
    );
    rows[type].change.disabled = true;
    rows[type].revoke.disabled = true;

    const signed = await p.signTransaction(transaction);
    const txId = await connection.sendRawTransaction(signed.serialize(), {skipPreflight:false, maxRetries:3});

    setStatus("CONFIRMING", "Checking the authority transaction on Solana…", "active");
    await waitForSignature(txId);

    setStatus("거래 확인 완료", "솔라나에서 권한 변경이 확인되었습니다.", "success");
    txLink.href = "https://solscan.io/tx/" + txId;
    txLink.hidden = false;

    await new Promise(resolve => setTimeout(resolve, 500));
    await checkAuthorities();
    txLink.href = "https://solscan.io/tx/" + txId;
    txLink.hidden = false;
  }

  checkButton.addEventListener("click", checkAuthorities);
  mintInput.addEventListener("keydown", event => {
    if (event.key === "Enter") checkAuthorities();
  });

  ["mint", "freeze"].forEach(type => {
    rows[type].change.addEventListener("click", () => {
      const value = rows[type].input.value.trim();
      if (!isAddress(value)) {
        setStatus("잘못된 지갑 주소", "새 지갑 주소를 올바르게 입력해주세요.", "error");
        rows[type].input.focus();
        return;
      }
      setModal("change", type, new solanaWeb3.PublicKey(value).toString());
    });

    rows[type].revoke.addEventListener("click", () => {
      setModal("revoke", type, "");
    });
  });

  modalCancel.addEventListener("click", closeModal);
  modal.addEventListener("click", event => {
    if (event.target.matches("[data-close-authority-modal]")) closeModal();
  });

  modalConfirmButton.addEventListener("click", async () => {
    const type = modalConfirmButton.dataset.type;
    const mode = modalConfirmButton.dataset.mode;
    const newAuthority = modalConfirmButton.dataset.newAuthority || null;

    if (mode === "revoke" && modalConfirm.value.trim().toUpperCase() !== "REVOKE") {
      modalConfirm.focus();
      return;
    }

    closeModal();
    try {
      await applyAuthority(type, mode === "revoke" ? null : newAuthority);
    } catch (error) {
      console.error("Token authority update failed:", error);
      setStatus("거래 실패", error?.message || "권한 변경을 완료하지 못했습니다.", "error");
      updateAllRows();
    }
  });

  function refreshForWallet() {
    updateAllRows();
    if (mintState) {
      setStatus("지갑 변경됨", "지갑 연결이 변경되었습니다. 권한 정보를 새로고침했습니다.", "");
    }
  }

  const globalProvider = provider();
  if (globalProvider?.on) {
    globalProvider.on("connect", refreshForWallet);
    globalProvider.on("accountChanged", refreshForWallet);
    globalProvider.on("disconnect", refreshForWallet);
  }

  window.addEventListener("load", refreshForWallet);
  refreshForWallet();
})();
