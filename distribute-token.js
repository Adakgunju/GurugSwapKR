(() => {
  "use strict";

  const SOLANA_RPCS = [
    "https://solana-rpc.publicnode.com",
    "https://api.mainnet.solana.com",
    "https://api.mainnet-beta.solana.com"
  ];

  async function getWorkingRpc() {
    for (const rpc of SOLANA_RPCS) {
      try {
        const response = await fetch(rpc, {
          method: "POST",
          headers: {"content-type": "application/json"},
          body: JSON.stringify({jsonrpc:"2.0",id:1,method:"getHealth",params:[]}),
          cache: "no-store"
        });
        if (response.ok) {
          const data = await response.json();
          if (data?.result === "ok" || data?.result === "healthy") return rpc;
        }
      } catch {}
    }
    throw new Error("현재 사용할 수 있는 솔라나 RPC가 없습니다. 잠시 후 다시 시도해주세요.");
  }
  const SPL_TOKEN_CDN = "https://esm.sh/@solana/spl-token@0.4.14?bundle";
  const MAX_수령 지갑_PER_TX = 6;

  let splModulesPromise = null;

  function addStyle() {
    if (document.getElementById("distributeTokenStyles")) return;
    const style = document.createElement("style");
    style.id = "distributeTokenStyles";
    style.textContent = `
      .distribute-section{padding:100px 8vw;border-top:1px solid #2b2b2b;background:linear-gradient(180deg,rgba(255,229,0,.018),transparent 65%)}
      .distribute-wrap{max-width:1180px;margin:0 auto}
      .distribute-kicker{color:#ffe500;font-size:12px;letter-spacing:.22em;font-weight:800}
      .distribute-title{font-family:'Syne',sans-serif;font-size:clamp(48px,6vw,88px);line-height:.84;letter-spacing:-.075em;margin:22px 0 18px}
      .distribute-lead{max-width:720px;color:#c9c9c4;font-size:16px;line-height:1.6}
      .distribute-grid{display:grid;grid-template-columns:minmax(0,1.05fr) minmax(300px,.75fr);gap:18px;margin-top:38px}
      .distribute-card,.distribute-help{background:#141414;border:1px solid #333;border-radius:18px;padding:22px}
      .distribute-card{box-shadow:12px 12px 0 #0e0e0e}
      .distribute-label{display:block;color:#f0f0eb;font-size:11px;font-weight:800;letter-spacing:.14em;margin-bottom:8px}
      .distribute-input,.distribute-row input{width:100%;background:#202020;border:1px solid #444;color:#fff;border-radius:10px;padding:14px 15px;outline:none;min-height:50px}
      .distribute-input:focus,.distribute-row input:focus{border-color:#aaa}
      .distribute-token-line{display:grid;grid-template-columns:1fr auto;gap:9px}
      .distribute-use-created{background:#242424;color:#ffe500;border:1px solid #444;border-radius:10px;padding:0 13px;font-weight:800;font-size:10px;letter-spacing:.08em;cursor:pointer}
      .distribute-recipient-head{display:flex;justify-content:space-between;align-items:center;margin:22px 0 10px}
      .distribute-add{background:transparent;color:#ffe500;border:1px solid #555;border-radius:9px;padding:8px 11px;font-size:10px;font-weight:800;letter-spacing:.08em;cursor:pointer}
      .distribute-row{display:grid;grid-template-columns:minmax(0,1fr) 150px 38px;gap:8px;margin-bottom:8px}
      .distribute-remove{background:#222;color:#bbb;border:1px solid #444;border-radius:9px;cursor:pointer;font-size:18px}
      .distribute-remove:hover{color:#fff;border-color:#888}
      .distribute-summary{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:16px}
      .distribute-stat{background:#1b1b1b;border:1px solid #303030;border-radius:10px;padding:13px}
      .distribute-stat span{display:block;color:#999;font-size:9px;letter-spacing:.12em;margin-bottom:5px}
      .distribute-stat strong{font-size:15px;color:#f3f3ee}
      .distribute-action{width:100%;margin-top:14px;background:#ffe500;color:#090909;border:1px solid #ffe500;border-radius:10px;padding:15px;font-weight:800;letter-spacing:.1em;cursor:pointer;min-height:54px}
      .distribute-action:disabled{opacity:.45;cursor:not-allowed}
      .distribute-status{margin-top:12px;padding:13px;border:1px solid #3b3b3b;background:#101010;border-radius:10px;color:#bdbdb7;font-size:11px;line-height:1.5}
      .distribute-status.active{border-color:#665e18}.distribute-status.success{border-color:#5d6515;color:#f0f0ea}.distribute-status.error{border-color:#6a3838;color:#ffb2b2}
      .distribute-results{margin-top:12px;display:grid;gap:7px}
      .distribute-result{padding:11px 12px;border:1px solid #303030;background:#191919;border-radius:9px;font-size:10px}
      .distribute-result a{color:#ffe500;font-weight:800}.distribute-result strong{display:block;margin-bottom:4px}
      .distribute-help h3{font-family:'Syne',sans-serif;font-size:27px;letter-spacing:-.04em;margin:0 0 18px}
      .distribute-help-step{display:grid;grid-template-columns:30px 1fr;gap:10px;padding:13px 0;border-top:1px solid #2c2c2c}
      .distribute-help-num{width:26px;height:26px;border:1px solid #555;border-radius:50%;display:grid;place-items:center;color:#ffe500;font-size:10px;font-weight:800}
      .distribute-help-step strong{display:block;font-size:12px;margin-bottom:4px}.distribute-help-step span{display:block;color:#999;font-size:10px;line-height:1.5}
      .distribute-note{margin-top:17px;padding:12px;border:1px solid #3b3b3b;border-radius:9px;color:#aaa;font-size:10px;line-height:1.5}
      @media(max-width:850px){.distribute-section{padding:76px 18px}.distribute-grid{grid-template-columns:1fr}.distribute-title{font-size:54px}.distribute-row{grid-template-columns:minmax(0,1fr) 125px 38px}}
      @media(max-width:520px){.distribute-title{font-size:48px}.distribute-lead{font-size:14px}.distribute-card,.distribute-help{padding:16px}.distribute-row{grid-template-columns:1fr 105px 36px}.distribute-row input{font-size:14px;padding:12px 10px}.distribute-summary{grid-template-columns:1fr}.distribute-token-line{grid-template-columns:1fr}.distribute-use-created{min-height:45px}}
    `;
    document.head.appendChild(style);
  }

  function addSection() {
    if (document.getElementById("distribute토큰을")) return;
    const swap = document.getElementById("swap");
    const swapIntro = document.querySelector(".swap-intro");
    if (!swap) return;

    const section = document.createElement("section");
    section.id = "distribute토큰을";
    section.className = "distribute-section";
    section.innerHTML = `
      <div class="distribute-wrap">
        <div class="distribute-kicker">02 / 토큰 배포</div>
        <h2 class="distribute-title"><span class="section-title-accent">토큰을</span> 지갑으로 전송하세요.</h2>
        <p class="distribute-lead">Distribute your SPL tokens directly from your wallet. Add recipient wallets, review the batch, then approve the transfers in Phantom.</p>

        <div class="distribute-grid">
          <div class="distribute-card">
            <label class="distribute-label" for="distributeMint">토큰 민트 주소</label>
            <div class="distribute-token-line">
              <input id="distributeMint" class="distribute-input" type="text" placeholder="Paste the Solana token mint address">
              <button id="distributeUseCreated" class="distribute-use-created" type="button" hidden>USE NEW TOKEN</button>
            </div>

            <div class="distribute-recipient-head">
              <span class="distribute-label" style="margin:0">수령 지갑</span>
              <button id="distributeAdd" class="distribute-add" type="button">+ ADD RECIPIENT</button>
            </div>
            <div id="distributeRows"></div>

            <div class="distribute-summary">
              <div class="distribute-stat"><span>수령 지갑</span><strong id="distributeCount">1</strong></div>
              <div class="distribute-stat"><span>총 토큰 수량</span><strong id="distributeTotal">0</strong></div>
              <div class="distribute-stat"><span>트랜잭션</span><strong id="distributeTxCount">—</strong></div>
              <div class="distribute-stat"><span>네트워크 수수료</span><strong id="distributeCost">서명 시 계산</strong></div>
            </div>

            <button id="distributeSend" class="distribute-action" type="button">DISTRIBUTE TOKENS</button>
            <div id="distributeStatus" class="distribute-status">Connect Phantom, enter a token mint and add the recipient wallets.</div>
            <div id="distributeResults" class="distribute-results"></div>
          </div>

          <aside class="distribute-help">
            <h3>사용 방법</h3>
            <div class="distribute-help-step"><div class="distribute-help-num">1</div><div><strong>토큰 선택</strong><span>배포하려는 SPL 토큰의 민트 주소를 입력하세요.</span></div></div>
            <div class="distribute-help-step"><div class="distribute-help-num">2</div><div><strong>수령 지갑 추가</strong><span>솔라나 지갑 주소와 각 지갑에 보낼 수량을 입력하세요.</span></div></div>
            <div class="distribute-help-step"><div class="distribute-help-num">3</div><div><strong>전송 내용 확인</strong><span>GurugSwap이 주소, 토큰 소수점 및 전체 배포 수량을 확인합니다.</span></div></div>
            <div class="distribute-help-step"><div class="distribute-help-num">4</div><div><strong>Phantom에서 승인</strong><span>토큰은 지갑에서 직접 전송됩니다. GurugSwap은 자산을 보관하지 않습니다.</span></div></div>
            <div class="distribute-help-step"><div class="distribute-help-num">5</div><div><strong>거래별 확인</strong><span>확인된 각 전송에는 Solscan 거래 링크가 제공됩니다.</span></div></div>
            <div class="distribute-note">Transfers are batched into several transactions when needed to keep each Solana transaction within a practical size limit.</div>
          </aside>
        </div>
      </div>
    `;

    const create = document.getElementById("create-token");
    const anchor = create || swapIntro || swap;
    anchor.parentNode.insertBefore(section, anchor.nextSibling);
  }

  function setStatus(message, state = "") {
    const el = document.getElementById("distributeStatus");
    if (!el) return;
    el.className = "distribute-status" + (state ? " " + state : "");
    el.textContent = message;
  }

  function addRecipientRow(address = "", amount = "") {
    const rows = document.getElementById("distributeRows");
    if (!rows) return;
    const row = document.createElement("div");
    row.className = "distribute-row";
    row.innerHTML = `
      <input class="distribute-address" type="text" placeholder="수령 지갑 주소" value="${escapeHtml(address)}" autocomplete="off" spellcheck="false">
      <input class="distribute-amount" type="number" min="0" step="any" placeholder="수량" value="${escapeHtml(amount)}" inputmode="decimal">
      <button class="distribute-remove" type="button" aria-label="수령자 삭제">×</button>
    `;
    row.querySelector(".distribute-remove").addEventListener("click", () => {
      const all = rows.querySelectorAll(".distribute-row");
      if (all.length === 1) {
        row.querySelector(".distribute-address").value = "";
        row.querySelector(".distribute-amount").value = "";
      } else {
        row.remove();
      }
      updateSummary();
    });
    row.querySelectorAll("input").forEach(input => input.addEventListener("input", updateSummary));
    rows.appendChild(row);
    updateSummary();
  }

  function escapeHtml(value) {
    return String(value || "").replace(/[&<>"']/g, ch => ({
      "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
    }[ch]));
  }

  function updateSummary(txCount = "—") {
    const rows = [...document.querySelectorAll("#distributeRows .distribute-row")];
    let total = 0;
    let count = 0;
    for (const row of rows) {
      const amount = Number(row.querySelector(".distribute-amount")?.value || 0);
      if (Number.isFinite(amount) && amount > 0) total += amount;
      count++;
    }
    const countEl = document.getElementById("distributeCount");
    const totalEl = document.getElementById("distributeTotal");
    const txEl = document.getElementById("distributeTxCount");
    if (countEl) countEl.textContent = String(count);
    if (totalEl) totalEl.textContent = Number.isFinite(total) ? total.toLocaleString("en-US", {maximumFractionDigits:9}) : "—";
    if (txEl) txEl.textContent = txCount;
  }

  async function loadSplModules() {
    if (!splModulesPromise) {
      splModulesPromise = import(SPL_TOKEN_CDN);
    }
    return splModulesPromise;
  }

  function getProvider() {
    if (typeof getPhantomProvider === "function") return getPhantomProvider();
    if (window.phantom?.solana?.isPhantom) return window.phantom.solana;
    if (window.solana?.isPhantom) return window.solana;
    return null;
  }

  function parseUi수량(value, decimals) {
    const raw = String(value || "").trim().replace(/,/g, "");
    if (!/^\d+(\.\d+)?$/.test(raw)) throw new Error("올바른 토큰 수량을 입력해주세요.");
    const [whole, fraction = ""] = raw.split(".");
    if (fraction.length > decimals) throw new Error("입력한 수량의 소수점 자릿수가 토큰 설정을 초과했습니다.");
    const padded = (fraction + "0".repeat(decimals)).slice(0, decimals);
    return BigInt(whole) * (10n ** BigInt(decimals)) + BigInt(padded || "0");
  }

  async function getMintInfo(connection, mint, publicKey) {
    const info = await connection.getParsedAccountInfo(mint, "confirmed");
    if (!info?.value?.data?.parsed?.info) throw new Error("토큰 민트를 읽을 수 없습니다.");
    const parsed = info.value.data.parsed.info;
    if (String(info.value.data.program || "") !== "spl-token") throw new Error("이 민트는 현재 배포 기능에서 지원하는 표준 SPL 토큰이 아닙니다.");
    const decimals = Number(parsed.decimals);
    if (!Number.isInteger(decimals) || decimals < 0 || decimals > 9) throw new Error("토큰 소수점 설정이 올바르지 않습니다.");
    const {getAssociatedTokenAddress} = await loadSplModules();
    const sourceAta = await getAssociatedTokenAddress(mint, publicKey);
    const sourceInfo = await connection.getAccountInfo(sourceAta, "confirmed");
    if (!sourceInfo) throw new Error("현재 지갑에 이 토큰의 계정이 없습니다.");
    return {decimals, sourceAta, supply: parsed.supply};
  }

  async function buildTransactions(connection, provider, mint, rows, decimals) {
    const web3 = window.solanaWeb3;
    const {getAssociatedTokenAddress, createAssociatedTokenAccountInstruction, createTransferCheckedInstruction, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID} = await loadSplModules();
    const owner = provider.publicKey;
    const transactions = [];

    for (let start = 0; start < rows.length; start += MAX_수령 지갑_PER_TX) {
      const batch = rows.slice(start, start + MAX_수령 지갑_PER_TX);
      const tx = new web3.Transaction();
      const latest = await connection.getLatestBlockhash("confirmed");
      tx.recentBlockhash = latest.blockhash;
      tx.feePayer = owner;

      for (const item of batch) {
        const destination = new web3.PublicKey(item.address);
        const destinationAta = await getAssociatedTokenAddress(mint, destination);
        const destinationInfo = await connection.getAccountInfo(destinationAta, "confirmed");

        if (!destinationInfo) {
          tx.add(createAssociatedTokenAccountInstruction(
            owner,
            destinationAta,
            destination,
            mint,
            TOKEN_PROGRAM_ID,
            ASSOCIATED_TOKEN_PROGRAM_ID
          ));
        }

        const raw수량 = parseUi수량(item.amount, decimals);
        tx.add(createTransferCheckedInstruction(
          item.sourceAta,
          mint,
          destinationAta,
          owner,
          raw수량,
          decimals,
          [],
          TOKEN_PROGRAM_ID
        ));
      }

      transactions.push(tx);
    }

    return transactions;
  }

  async function sendTransactions(connection, provider, transactions) {
    const signatures = [];
    const useBatchSign = typeof provider.signAllTransactions === "function" && transactions.length > 1;

    if (useBatchSign) {
      setStatus("Phantom에서 전송 내용을 확인하고 승인해주세요...", "active");
      const signed = await provider.signAllTransactions(transactions);
      for (const tx of signed) {
        const signature = await connection.sendRawTransaction(tx.serialize(), {skipPreflight:false, maxRetries:3});
        signatures.push(signature);
      }
    } else {
      for (let i = 0; i < transactions.length; i++) {
        setStatus(`Phantom에서 ${transactions.length}개 중 ${i + 1}번째 거래를 승인해주세요...`, "active");
        const signed = await provider.signTransaction(transactions[i]);
        const signature = await connection.sendRawTransaction(signed.serialize(), {skipPreflight:false, maxRetries:3});
        signatures.push(signature);
      }
    }

    for (let i = 0; i < signatures.length; i++) {
      setStatus(`${signatures.length}개 중 ${i + 1}번째 거래를 확인하는 중...`, "active");
      await connection.confirmTransaction(signatures[i], "confirmed");
    }
    return signatures;
  }

  async function distribute() {
    const web3 = window.solanaWeb3;
    if (!web3) throw new Error("Solana Web3 라이브러리를 불러올 수 없습니다.");

    const provider = getProvider();
    if (!provider?.publicKey) {
      if (typeof connectPhantom === "function") {
        await connectPhantom();
      }
      throw new Error("먼저 Phantom을 연결해주세요.");
    }

    const mintText = String(document.getElementById("distributeMint")?.value || "").trim();
    if (!mintText) throw new Error("토큰 민트 주소를 입력해주세요.");

    let mint;
    try {
      mint = new web3.PublicKey(mintText);
    } catch {
      throw new Error("올바른 솔라나 토큰 민트 주소를 입력해주세요.");
    }

    const rawRows = [...document.querySelectorAll("#distributeRows .distribute-row")].map(row => ({
      address: String(row.querySelector(".distribute-address")?.value || "").trim(),
      amount: String(row.querySelector(".distribute-amount")?.value || "").trim()
    }));

    if (!rawRows.length) throw new Error("수령자를 한 명 이상 추가해주세요.");

    const rows = rawRows.map((row, index) => {
      if (!row.address) throw new Error(`수령 지갑 ${index + 1}: 지갑 주소를 입력해주세요.`);
      try { new web3.PublicKey(row.address); } catch { throw new Error(`수령 지갑 ${index + 1}: 올바른 솔라나 지갑 주소가 아닙니다.`); }
      if (!row.amount || Number(row.amount) <= 0) throw new Error(`수령 지갑 ${index + 1}: 0보다 큰 수량을 입력해주세요.`);
      return row;
    });

    const rpc = await getWorkingRpc();
    const connection = new web3.Connection(rpc, "confirmed");
    setStatus("토큰 계정, 소수점 및 수령 지갑을 확인하는 중...", "active");
    const {decimals, sourceAta} = await getMintInfo(connection, mint, provider.publicKey);

    const prepared = rows.map(row => ({...row, sourceAta}));
    const transactions = await buildTransactions(connection, provider, mint, prepared, decimals);
    updateSummary(transactions.length);

    setStatus(`준비 완료: ${transactions.length}개 트랜잭션으로 ${rows.length}개 지갑에 전송합니다.`, "active");
    const signatures = await sendTransactions(connection, provider, transactions);

    const results = document.getElementById("distributeResults");
    if (results) {
      results.innerHTML = signatures.map((signature, index) =>
        `<div class="distribute-result"><strong>거래 ${index + 1} 확인 완료</strong><a href="https://solscan.io/tx/${encodeURIComponent(signature)}" target="_blank" rel="noopener noreferrer">SOLSCAN에서 보기 ↗</a></div>`
      ).join("");
    }

    setStatus(`배포 완료 — ${rows.length}개 지갑으로 전송이 확인되었습니다.`, "success");
    return signatures;
  }

  function bind() {
    addStyle();
    addSection();
    if (!document.getElementById("distributeRows") || document.body.dataset.distributeBound) return;
    document.body.dataset.distributeBound = "1";

    addRecipientRow();

    document.getElementById("distributeAdd")?.addEventListener("click", () => addRecipientRow());
    document.getElementById("distributeSend")?.addEventListener("click", async () => {
      const button = document.getElementById("distributeSend");
      if (button) button.disabled = true;
      try {
        await distribute();
      } catch (err) {
        console.error("DISTRIBUTE failed:", err);
        setStatus(err?.message || "토큰 배포가 실패했거나 취소되었습니다.", "error");
      } finally {
        if (button) button.disabled = false;
      }
    });

    document.getElementById("distributeUseCreated")?.addEventListener("click", () => {
      const mint = document.getElementById("distributeMint");
      const button = document.getElementById("distributeUseCreated");
      const value = button?.dataset.mint;
      if (mint && value) mint.value = value;
    });

    window.addEventListener("gurug:token-created", event => {
      const value = event.detail?.mintAddress;
      if (!value) return;
      const mint = document.getElementById("distributeMint");
      const button = document.getElementById("distributeUseCreated");
      if (mint) mint.value = value;
      if (button) {
        button.dataset.mint = value;
        button.hidden = false;
      }
      setStatus("새 토큰이 확인되었습니다. 민트 주소가 배포 입력란에 준비되었습니다.", "active");
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bind, {once:true});
  } else {
    bind();
  }
})();
