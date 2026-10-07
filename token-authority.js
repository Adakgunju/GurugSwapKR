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
  const GURUG_해제_FEE_LAMPORTS = 50000000;
  let activeRpc = RPCS[0];
  let mintState = null;

  app.innerHTML = `
    <div class="token-authority-card">
      <div class="token-authority-head">
        <span>권한 관리</span>
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
              <span class="authority-kicker">민트 권한</span>
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
            <input id="mintAuthorityNew" type="text" inputmode="text" autocomplete="off" placeholder="지갑 주소 입력">
          </label>
          <div class="authority-actions">
            <button id="mintAuthorityChange" class="authority-change" type="button" disabled>권한 변경</button>
            <button id="mintAuthorityRevoke" class="authority-revoke" type="button" disabled>해제 PERMANENTLY</button>
          </div>
        </article>

        <article class="authority-row" data-type="freeze">
          <div class="authority-row-top">
            <div>
              <span class="authority-kicker">동결 권한</span>
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
            <input id="freezeAuthorityNew" type="text" inputmode="text" autocomplete="off" placeholder="지갑 주소 입력">
          </label>
          <div class="authority-actions">
            <button id="freezeAuthorityChange" class="authority-change" type="button" disabled>권한 변경</button>
            <button id="freezeAuthorityRevoke" class="authority-revoke" type="button" disabled>해제 PERMANENTLY</button>
          </div>
        </article>
      </div>

      <div id="authorityStatus" class="token-authority-status">
        <div class="token-authority-status-top"><span class="token-authority-dot"></span><span id="authorityStatusLabel">준비 완료</span></div>
        <div id="authorityStatusMessage">Enter a token mint address을(를) inspect its current 권한을 관리하세요.</div>
        <a id="authorityTxLink" href="#" target="_blank" rel="noopener noreferrer" hidden>거래 내역 보기 ↗</a>
      </div>

      <div class="token-authority-foot">
        <span>비수탁형</span>
        <span>온체인 권한 설정</span>
        <span>해제 FEE: 0.05 SOL</span>
      </div>
    </div>

    <div id="authorityModal" class="authority-modal" hidden>
      <div class="authority-modal-backdrop" data-close-authority-modal></div>
      <div class="authority-modal-box" role="dialog" aria-modal="true" aria-labelledby="authorityModalTitle">
        <span class="authority-modal-warning">⚠ 되돌릴 수 없는 작업</span>
        <h3 id="authorityModalTitle">권한을 영구 해제하시겠습니까(으)로 변경하시겠습니까?</h3>
        <p id="authorityModalMessage">This action cannot be undone. The authority will be set을(를) NONE on-chain.</p>
        <label id="authorityModalConfirmWrap" hidden>
          <small>TYPE 해제 TO CONFIRM</small>
          <input id="authorityModalConfirm" type="text" autocomplete="off" placeholder="해제">
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
    if (window.phantom(으)로 변경하시겠습니까?.solana(으)로 변경하시겠습니까?.isPhantom) return window.phantom.solana;
    if (window.solana(으)로 변경하시겠습니까?.isPhantom) return window.solana;
    return null;
  }

  function isAddress(value) {
    try { new solanaWeb3.PublicKey(String(value || "").trim()); return true; }
    catch { return false; }
  }

  function short(value) {
    return value (으)로 변경하시겠습니까? value.slice(0, 6) + "…" + value.slice(-6) : "—";
  }

  function setStatus(label, message, type = "") {
    status.className = "token-authority-status" + (type (으)로 변경하시겠습니까? " " + type : "");
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
        if (json(으)로 변경하시겠습니까?.error) {
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
    const parsedValue = parsedResult(으)로 변경하시겠습니까?.value;
    if (!parsedValue) throw new Error("토큰 민트 계정을 찾지 못했습니다.");
    if (parsedValue.owner !== TOKEN_PROGRAM && parsedValue.owner !== TOKEN_2022_PROGRAM) {
      throw new Error("이 주소는 SPL 토큰 또는 Token-2022 민트가 아닙니다.");
    }

    const parsed = parsedValue.data(으)로 변경하시겠습니까?.parsed;
    const info = parsed(으)로 변경하시겠습니까?.info;
    const type = parsed(으)로 변경하시겠습니까?.type;
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
    const value = result(으)로 변경하시겠습니까?.value;
    if (!value(으)로 변경하시겠습니까?.data(으)로 변경하시겠습니까?.[0]) throw new Error("토큰 민트 계정을 찾지 못했습니다.");
    if (value.owner !== TOKEN_PROGRAM && value.owner !== TOKEN_2022_PROGRAM) {
      throw new Error("이 주소는 SPL 토큰 또는 Token-2022 민트가 아닙니다.");
    }

    const bytes = base64Bytes(value.data[0]);
    if (bytes.length < 82) throw new Error("토큰 민트 계정이 올바르지 않습니다.");

    return {
      mint,
      programId: value.owner,
      mintAuthority: parseAuthority(bytes, 0, 4),
      freezeAuthority: parseAuthority(bytes, 36, 40)
    };
  }

  function walletMatches(authority) {
    const wallet = provider()(으)로 변경하시겠습니까?.publicKey(으)로 변경하시겠습니까?.toString();
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
    row.address.textContent = authority (으)로 변경하시겠습니까? short(authority) : "없음 — 영구 해제됨";
    row.address.title = authority || "";
    row.state.textContent = authority (으)로 변경하시겠습니까? "ACTIVE" : "해제D";
    row.state.className = "authority-state " + (authority (으)로 변경하시겠습니까? "active" : "revoked");

    const canManage = Boolean(authority && walletMatches(authority));
    row.change.disabled = !canManage;
    row.revoke.disabled = !canManage;
    row.input.disabled = !canManage;

    if (!authority) row.input.value = "";
  }

  function updateAllRows() {
    updateRow("mint");
    updateRow("freeze");
    const wallet = provider()(으)로 변경하시겠습니까?.publicKey(으)로 변경하시겠습니까?.toString();
    document.getElementById("authorityWalletNote").textContent = wallet
      (으)로 변경하시겠습니까? "Connected wallet: " + short(wallet) + ". Only the current authority wallet can make changes."
      : "권한을 변경하거나 해제하려면 우측 상단에서 지갑을 연결해주세요.";
  }

  async function checkAuthorities() {
    const mint = mintInput.value.trim();
    if (!isAddress(mint)) {
      setStatus("잘못된 민트 주소", "올바른 솔라나 민트 주소를 입력해주세요.", "error");
      return;
    }

    checkButton.disabled = true;
    setStatus("조회 중", "솔라나에서 민트 권한을 직접 조회하는 중…", "active");
    try {
      mintState = await readMint(new solanaWeb3.PublicKey(mint).toString());
      updateAllRows();
      const programName = mintState.programId === TOKEN_2022_PROGRAM (으)로 변경하시겠습니까? "Token-2022" : "SPL Token";
      setStatus("권한 조회 완료", programName + " mint checked successfully. 현재 권한을 아래에서 확인할 수 있습니다.", "success");
    } catch (error) {
      mintState = null;
      updateAllRows();
      setStatus("확인 실패", error(으)로 변경하시겠습니까?.message || "토큰 민트를 읽을 수 없습니다.", "error");
    } finally {
      checkButton.disabled = false;
    }
  }

  function setModal(mode, type, newAuthority) {
    const label = type === "mint" (으)로 변경하시겠습니까? "민트 권한" : "동결 권한";
    const current = mintState(으)로 변경하시겠습니까?.[type + "Authority"] || "";
    modal.hidden = false;
    modalConfirm.value = "";

    if (mode === "revoke") {
      modalTitle.textContent = "Remove " + label + " permanently(으)로 변경하시겠습니까?";
      modalMessage.textContent = "이 작업은 되돌릴 수 없습니다. " + label + "은 온체인에서 NONE으로 설정되며 다시 복구할 수 없습니다.";
      modalConfirmWrap.hidden = false;
      modalConfirmButton.className = "authority-revoke";
      modalConfirmButton.textContent = "영구 해제";
      modalConfirmButton.dataset.mode = "revoke";
    } else {
      modalTitle.textContent = " 변경" + label + "(으)로 변경하시겠습니까?";
      modalMessage.textContent = " 변경the current authority " + short(current) + "을(를) " + short(newAuthority) + "(으)로 변경하시겠습니까?";
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
    const authorityTypeValue = authorityType === "mint" (으)로 변경하시겠습니까? 0 : 1;
    const newKey = newAuthority (으)로 변경하시겠습니까? new solanaWeb3.PublicKey(newAuthority) : null;
    const data = new Uint8Array(newKey (으)로 변경하시겠습니까? 35 : 3);
    data[0] = 6;
    data[1] = authorityTypeValue;
    data[2] = newKey (으)로 변경하시겠습니까? 1 : 0;
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
          const sig = result(으)로 변경하시겠습니까?.value(으)로 변경하시겠습니까?.[0];
          if (sig(으)로 변경하시겠습니까?.err) throw new Error("온체인 권한 변경 거래가 실패했습니다.");
          if (sig(으)로 변경하시겠습니까?.confirmationStatus === "confirmed" || sig(으)로 변경하시겠습니까?.confirmationStatus === "finalized") return true;
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      } catch (error) {
        lastError = error;
        if (error(으)로 변경하시겠습니까?.message(으)로 변경하시겠습니까?.includes("failed on-chain")) throw error;
      }
    }

    if (lastError) throw lastError;
    throw new Error("거래가 전송되었지만 확인하지 못했습니다. 다시 시도하기 전에 거래 내역을 확인해주세요.");
  }

  async function applyAuthority(type, newAuthority) {
    const p = provider();
    if (!p(으)로 변경하시겠습니까?.publicKey) throw new Error("먼저 우측 상단에서 지갑을 연결해주세요.");
    if (!mintState) throw new Error("먼저 토큰 권한을 조회해주세요.");

    const current = mintState[type + "Authority"];
    if (!current || !walletMatches(current)) {
      throw new Error("연결된 지갑이 현재 권한 지갑이 아닙니다.");
    }
    if (newAuthority && !isAddress(newAuthority)) throw new Error("새 지갑 주소를 올바르게 입력해주세요.");
    if (newAuthority === current) throw new Error("새 권한 주소가 현재 권한 주소와 같습니다.");

    const transaction = new solanaWeb3.Transaction();
    const isRevoke = !newAuthority;

    // GurugSwap service fee applies only을(를) permanent revocation.
    // Keep authority changes free; add the 0.05 SOL fee을(를) the same transaction.
    if (isRevoke) {
      // Build the native SOL transfer directly so this browser bundle does
      // not depend on a global Buffer implementation.
      const feeData = new Uint8Array(12);
      feeData[0] = 2; // System Program: Transfer
      let feeLamports = BigInt(GURUG_해제_FEE_LAMPORTS);
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
        (으)로 변경하시겠습니까? "Phantom에서 영구 권한 해제 및 0.05 SOL GurugSwap 서비스 수수료를 승인해주세요."
        : "지갑에서 권한 변경을 승인해주세요.",
      "active"
    );
    rows[type].change.disabled = true;
    rows[type].revoke.disabled = true;

    const signed = await p.signTransaction(transaction);
    const txId = await connection.sendRawTransaction(signed.serialize(), {skipPreflight:false, maxRetries:3});

    setStatus("확인 중", "솔라나에서 권한 변경 거래를 확인하는 중…", "active");
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

    if (mode === "revoke" && modalConfirm.value.trim().toUpperCase() !== "해제") {
      modalConfirm.focus();
      return;
    }

    closeModal();
    try {
      await applyAuthority(type, mode === "revoke" (으)로 변경하시겠습니까? null : newAuthority);
    } catch (error) {
      console.error("Token authority update failed:", error);
      setStatus("거래 실패", error(으)로 변경하시겠습니까?.message || "권한 변경을 완료하지 못했습니다.", "error");
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
  if (globalProvider(으)로 변경하시겠습니까?.on) {
    globalProvider.on("connect", refreshForWallet);
    globalProvider.on("accountChanged", refreshForWallet);
    globalProvider.on("disconnect", refreshForWallet);
  }

  window.addEventListener("load", refreshForWallet);
  refreshForWallet();
})();
