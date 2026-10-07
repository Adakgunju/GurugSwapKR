(() => {
  "use strict";

  // Avoid indexed-RPC endpoints here. 멀티 Airdrop needs token-account queries
  // such as getParsedAccountInfo/getTokenAccountBalance.
  const RPCS = [
    "https://api.mainnet-beta.solana.com",
    "https://rpc.solanatracker.io/public"
  ];
  const SPL_CDN = "https://esm.sh/@solana/spl-token@0.4.14?bundle";
  const BUFFER_CDN = "https://esm.sh/buffer@6.0.3?bundle";
  const MAX_RECIPIENTS_PER_TX = 5;
  const GURUG_FEE_WALLET = "ARmME4KE6oe87TokQf7SmYZL6e5Gpz1UCobU3EEqSwEH";
  const GURUG_AIRDROP_FEE_PER_WALLET_LAMPORTS = 1000000; // 0.001 SOL

  let splPromise = null;
  let bufferPromise = null;
  let recipientAddresses = [];

  function getProvider() {
    if (typeof getPhantomProvider === "function") return getPhantomProvider();
    if (window.phantom?.solana?.isPhantom) return window.phantom.solana;
    if (window.solana?.isPhantom) return window.solana;
    return null;
  }

  async function getWorkingRpc() {
    for (const rpc of RPCS) {
      try {
        const response = await fetch(rpc, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "getHealth", params: [] }),
          cache: "no-store"
        });
        if (response.ok) {
          const data = await response.json();
          if (data?.result === "ok" || data?.result === "healthy") return rpc;
        }
      } catch {}
    }
    throw new Error("No Solana RPC endpoint is currently available. Please try again.");
  }

  async function loadSpl() {
    if (!bufferPromise) {
      bufferPromise = import(BUFFER_CDN).then(mod => {
        if (!globalThis.Buffer && mod?.Buffer) globalThis.Buffer = mod.Buffer;
        return mod;
      });
    }
    await bufferPromise;
    if (!splPromise) splPromise = import(SPL_CDN);
    return splPromise;
  }

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, ch => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    }[ch]));
  }

  function setStatus(message, state = "") {
    const el = document.getElementById("multiAirdropStatus");
    if (!el) return;
    el.className = "multi-airdrop-status" + (state ? " " + state : "");
    el.textContent = message;
  }

  function getMintText() {
    return String(document.getElementById("multiAirdropMint")?.value || "").trim();
  }

  function getAirdropAmount() {
    return String(document.getElementById("multiAirdropAmount")?.value || "").trim();
  }

  function updateLineNumbers() {
    const input = document.getElementById("multiAirdropAddresses");
    const gutter = document.getElementById("multiAirdropLineNumbers");
    if (!input || !gutter) return;
    const lineCount = Math.max(1, input.value.split("\n").length);
    gutter.textContent = Array.from({ length: lineCount }, (_, i) => String(i + 1)).join("\n");
    gutter.scrollTop = input.scrollTop;
  }

  function renderRecipients() {
    const host = document.getElementById("multiAirdropAddresses");
    if (!host) return;
    host.value = recipientAddresses.join("\n");
    updateLineNumbers();
    updateSummary();
  }

  function updateSummary(txCount = null, decimals = null) {
    const count = recipientAddresses.filter(address => address.trim()).length;
    const amount = Number(getAirdropAmount().replace(/,/g, ""));
    const total = Number.isFinite(amount) && amount > 0 ? amount * count : 0;

    const countEl = document.getElementById("multiAirdropCount");
    const totalEl = document.getElementById("multiAirdropTotal");
    const txEl = document.getElementById("multiAirdropTxCount");
    if (countEl) countEl.textContent = String(count);
    if (totalEl) totalEl.textContent = count && Number.isFinite(total)
      ? total.toLocaleString("en-US", { maximumFractionDigits: decimals == null ? 9 : decimals })
      : "0";
    if (txEl) txEl.textContent = txCount == null ? "—" : String(txCount);
  }

  // The input is always a real token quantity (e.g. 0.01 GURUG).
  // It is never interpreted as a percentage of total supply.
  function uiAmountToRaw(value, decimals) {
    const text = String(value || "").trim().replace(/,/g, "");
    if (!/^\d+(\.\d+)?$/.test(text)) {
      throw new Error("0.01과 같은 올바른 토큰 수량을 입력해주세요.");
    }
    const [whole, fraction = ""] = text.split(".");
    if (fraction.length > decimals) {
      throw new Error(`이 토큰은 소수점 ${decimals}자리까지 지원합니다.`);
    }
    const scale = 10n ** BigInt(decimals);
    return BigInt(whole) * scale +
      BigInt((fraction + "0".repeat(decimals)).slice(0, decimals) || "0");
  }

  function formatUiAmount(rawAmount, decimals) {
    const scale = 10n ** BigInt(decimals);
    const whole = rawAmount / scale;
    const fraction = rawAmount % scale;
    if (fraction === 0n) return whole.toString();
    return `${whole.toString()}.${fraction.toString().padStart(decimals, "0").replace(/0+$/, "")}`;
  }

  async function readMint(connection, mint, owner, spl) {
    const account = await connection.getParsedAccountInfo(mint, "confirmed");
    if (!account?.value?.data?.parsed?.info) throw new Error("토큰 민트를 읽을 수 없습니다.");

    const program = String(account.value.data.program || "");
    let tokenProgram;
    if (program === "spl-token") {
      tokenProgram = spl.TOKEN_PROGRAM_ID;
    } else if (program === "spl-token-2022") {
      tokenProgram = spl.TOKEN_2022_PROGRAM_ID;
    } else {
      throw new Error("This mint is not a supported SPL Token or Token-2022 mint.");
    }

    const info = account.value.data.parsed.info;
    const decimals = Number(info.decimals);
    if (!Number.isInteger(decimals) || decimals < 0 || decimals > 9) {
      throw new Error("Invalid token decimals.");
    }

    const sourceAta = await spl.getAssociatedTokenAddress(
      mint,
      owner,
      false,
      tokenProgram,
      spl.ASSOCIATED_TOKEN_PROGRAM_ID
    );
    const sourceInfo = await connection.getAccountInfo(sourceAta, "confirmed");
    if (!sourceInfo) throw new Error("Your wallet does not have a token account for this token.");

    const balance = await connection.getTokenAccountBalance(sourceAta, "confirmed");
    const rawBalance = BigInt(balance?.value?.amount || "0");

    return { decimals, tokenProgram, sourceAta, rawBalance };
  }

  function validateRows(web3, amount) {
    const addresses = recipientAddresses.map(address => String(address || "").trim()).filter(Boolean);
    if (!addresses.length) throw new Error("수령 지갑 주소를 한 개 이상 입력해주세요.");

    const seen = new Set();
    return addresses.map((address, index) => {
      let publicKey;
      try {
        publicKey = new web3.PublicKey(address);
      } catch {
        throw new Error("Recipient " + (index + 1) + ": invalid Solana wallet address.");
      }

      const key = publicKey.toBase58();
      if (seen.has(key)) throw new Error("중복된 지갑 주소: " + key);
      seen.add(key);

      return { index, address: key, publicKey, amount };
    });
  }

  async function buildBatch(connection, owner, mint, batch, decimals, tokenProgram, sourceAta, spl, feeLamports = 0) {
    const web3 = window.solanaWeb3;
    const tx = new web3.Transaction();
    const latest = await connection.getLatestBlockhash("confirmed");
    tx.recentBlockhash = latest.blockhash;
    tx.feePayer = owner;

    if (feeLamports > 0) {
      tx.add(web3.SystemProgram.transfer({
        fromPubkey: owner,
        toPubkey: new web3.PublicKey(GURUG_FEE_WALLET),
        lamports: feeLamports
      }));
    }

    const prepared = [];
    let newAtaCount = 0;

    for (const item of batch) {
      const destinationAta = await spl.getAssociatedTokenAddress(
        mint,
        item.publicKey,
        false,
        tokenProgram,
        spl.ASSOCIATED_TOKEN_PROGRAM_ID
      );
      const destinationInfo = await connection.getAccountInfo(destinationAta, "confirmed");

      if (!destinationInfo) {
        newAtaCount++;
        tx.add(spl.createAssociatedTokenAccountInstruction(
          owner,
          destinationAta,
          item.publicKey,
          mint,
          tokenProgram,
          spl.ASSOCIATED_TOKEN_PROGRAM_ID
        ));
      }

      // item.amount is already the exact raw token amount (BigInt), prepared in execute에어드롭.
      // Do not call the removed parseAmount() helper here.
      const rawAmount = item.amount;
      if (rawAmount <= 0n) throw new Error(`Recipient ${item.index + 1}: 수량은 0보다 커야 합니다.`);

      tx.add(spl.createTransferCheckedInstruction(
        sourceAta,
        mint,
        destinationAta,
        owner,
        rawAmount,
        decimals,
        [],
        tokenProgram
      ));

      prepared.push({ ...item, rawAmount, destinationAta });
    }

    return { tx, prepared, newAtaCount };
  }

  async function estimateFee(connection, tx) {
    try {
      const message = tx.compileMessage();
      const fee = await connection.getFeeForMessage(message, "confirmed");
      if (fee?.value != null) return Number(fee.value);
    } catch {}
    return 5000;
  }

  async function showResults(batchResults) {
    const host = document.getElementById("multiAirdropResults");
    if (!host) return;

    host.innerHTML = batchResults.map((batch, batchIndex) => `
      <div class="multi-airdrop-result ${batch.ok ? "success" : "failed"}">
        <div class="multi-airdrop-result-head">
          <strong>BATCH ${batchIndex + 1} — ${batch.ok ? "CONFIRMED" : "FAILED"}</strong>
          ${batch.signature ? `<a href="https://solscan.io/tx/${encodeURIComponent(batch.signature)}" target="_blank" rel="noopener noreferrer">VIEW SOLSCAN ↗</a>` : ""}
        </div>
        <div class="multi-airdrop-result-recipients">
          ${batch.items.map(item => `
            <div><span>${escapeHtml(item.address.slice(0, 6) + "…" + item.address.slice(-4))}</span><b>${escapeHtml(formatUiAmount(item.amount, batch.decimals))}</b><em>${batch.ok ? "SENT" : "미전송"}</em></div>
          `).join("")}
        </div>
        ${batch.error ? `<p>${escapeHtml(batch.error)}</p>` : ""}
      </div>
    `).join("");
  }

  async function executeAirdrop() {
    const web3 = window.solanaWeb3;
    if (!web3) throw new Error("Solana Web3 library is not available.");

    const provider = getProvider();
    if (!provider?.publicKey) {
      if (typeof connectPhantom === "function") await connectPhantom();
      throw new Error("먼저 Phantom을 연결해주세요.");
    }

    const mintText = getMintText();
    if (!mintText) throw new Error("토큰 민트 주소를 입력해주세요.");

    const amountText = getAirdropAmount();
    if (!amountText) throw new Error("각 지갑에 보낼 토큰 수량을 입력해주세요.");

    let mint;
    try {
      mint = new web3.PublicKey(mintText);
    } catch {
      throw new Error("올바른 솔라나 토큰 민트 주소를 입력해주세요.");
    }

    const rpc = await getWorkingRpc();
    const connection = new web3.Connection(rpc, "confirmed");
    const spl = await loadSpl();

    setStatus("토큰, 잔액 및 수령 지갑을 확인하는 중...", "active");
    const mintInfo = await readMint(connection, mint, provider.publicKey, spl);
    const amountRaw = uiAmountToRaw(amountText, mintInfo.decimals);

    if (amountRaw <= 0n) throw new Error("Token 수량은 0보다 커야 합니다.");

    const validated = validateRows(web3, amountRaw);
    const totalRaw = amountRaw * BigInt(validated.length);
    const uiAmount = formatUiAmount(amountRaw, mintInfo.decimals);
    const totalUiAmount = formatUiAmount(totalRaw, mintInfo.decimals);

    if (totalRaw > mintInfo.rawBalance) {
      throw new Error("토큰 잔액이 전체 에어드롭 수량보다 적습니다.");
    }

    const batches = [];
    for (let i = 0; i < validated.length; i += MAX_RECIPIENTS_PER_TX) {
      batches.push(validated.slice(i, i + MAX_RECIPIENTS_PER_TX));
    }

    updateSummary(batches.length, mintInfo.decimals);
    const totalEl = document.getElementById("multiAirdropTotal");
    if (totalEl) totalEl.textContent = totalUiAmount;
    setStatus(`Ready: ${validated.length} recipient(s) × ${uiAmount} tokens = ${totalUiAmount} total in ${batches.length} transaction(s).`, "active");

    // GurugSwap service fee is shown separately. Solana network fees are handled by Phantom.
    const feeLamports = validated.length * GURUG_AIRDROP_FEE_PER_WALLET_LAMPORTS;
    const costEl = document.getElementById("multiAirdropCost");
    if (costEl) costEl.textContent = (feeLamports / 1e9).toFixed(3) + " SOL";

    const results = [];
    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      setStatus(`배치 준비 중 ${i + 1} of ${batches.length} — ${batch.length} wallet(s) × ${uiAmount} GURUG...`, "active");

      try {
        const built = await buildBatch(
          connection,
          provider.publicKey,
          mint,
          batch,
          mintInfo.decimals,
          mintInfo.tokenProgram,
          mintInfo.sourceAta,
          spl,
          i === 0 ? validated.length * GURUG_AIRDROP_FEE_PER_WALLET_LAMPORTS : 0
        );

        setStatus(`Approve batch ${i + 1} of ${batches.length} in Phantom: ${batch.length} wallet(s) × ${uiAmount} GURUG.`, "active");
        const signed = await provider.signTransaction(built.tx);
        const signature = await connection.sendRawTransaction(signed.serialize(), {
          skipPreflight: false,
          maxRetries: 3
        });

        setStatus(`배치 확인 중 ${i + 1} of ${batches.length}...`, "active");
        await connection.confirmTransaction(signature, "confirmed");

        results.push({ ok: true, signature, items: batch, decimals: mintInfo.decimals });
        await showResults(results);
      } catch (error) {
        console.error("멀티 에어드롭 batch failed:", error);
        results.push({
          ok: false,
          signature: "",
          items: batch,
          decimals: mintInfo.decimals,
          error: error?.message || "Transaction failed or was cancelled."
        });
        await showResults(results);

        setStatus(
          `Batch ${i + 1} failed. Later batches were not sent. Fix the issue and run the airdrop again.`,
          "error"
        );
        return results;
      }
    }

    setStatus(`멀티 에어드롭 완료 — ${validated.length} recipient(s) received ${uiAmount} GURUG each on 토큰을 거래하세요.`, "success");
    return results;
  }

  let costEstimateTimer = null;
  let costEstimateRequest = 0;

  async function updateEstimatedCost() {
    const costEl = document.getElementById("multiAirdropCost");
    if (!costEl) return;
    const count = recipientAddresses.filter(v => v.trim()).length;
    costEl.textContent = (count * GURUG_AIRDROP_FEE_PER_WALLET_LAMPORTS / 1e9).toFixed(3) + " SOL";
  }

  function scheduleCostEstimate() {
    clearTimeout(costEstimateTimer);
    costEstimateTimer = setTimeout(updateEstimatedCost, 500);
  }

  function loadPastedAddresses(text) {
    const addresses = String(text || "")
      .split(/[,\\s]+/)
      .map(value => value.trim())
      .filter(Boolean);

    if (!addresses.length) throw new Error("지갑 주소를 한 개 이상 입력해주세요.");

    recipientAddresses = addresses;
    renderRecipients();
    setStatus(`Loaded ${addresses.length} wallet address(es). Enter the common token amount, then send.`, "active");
  }

  function addStyles() {
    if (document.getElementById("multiAirdropStyles")) return;
    const style = document.createElement("style");
    style.id = "multiAirdropStyles";
    style.textContent = `
      .multi-airdrop-shell{display:grid;grid-template-columns:minmax(0,1.05fr) minmax(330px,.78fr);gap:28px;align-items:start}
      .multi-airdrop-card,.multi-airdrop-help{background:rgba(27,29,25,.96);border:1px solid rgba(255,255,255,.16);border-radius:18px;box-shadow:0 22px 65px rgba(0,0,0,.42);box-sizing:border-box}
      .multi-airdrop-card{padding:28px}.multi-airdrop-help{padding:28px}
      .multi-airdrop-label{display:block;color:#f7f7f2;font-size:13px;font-weight:800;letter-spacing:.12em;margin-bottom:9px}
      .multi-airdrop-input{width:100%;box-sizing:border-box;min-height:52px;padding:14px;background:#0f100e;border:1px solid #3a3b36;border-radius:10px;color:#fff;outline:0}
      .multi-airdrop-input:focus{border-color:#77786f}
      .multi-airdrop-controls{display:flex;gap:9px;margin-top:12px;flex-wrap:wrap}
      .multi-airdrop-secondary{background:#20221e;color:#ffe500;border:1px solid #494a44;border-radius:9px;padding:10px 13px;font-weight:800;font-size:10px;letter-spacing:.08em;cursor:pointer}
      .multi-airdrop-address-editor{display:grid;grid-template-columns:48px minmax(0,1fr);min-height:330px;border:1px solid #3a3b36;border-radius:10px;overflow:hidden;background:#0f100e}
      .multi-airdrop-line-numbers{padding:15px 10px 15px 0;background:#0b0c0a;color:#686a63;text-align:right;font:500 13px/1.65 monospace;user-select:none;overflow:hidden;white-space:pre}
      .multi-airdrop-addresses{width:100%;min-height:330px;box-sizing:border-box;resize:vertical;padding:15px;background:#0f100e;border:0;border-radius:0;color:#fff;outline:0;font:500 13px/1.65 monospace;overflow:auto}
      .multi-airdrop-address-editor:focus-within{border-color:#77786f}
      .multi-airdrop-addresses:focus{border-color:transparent}
      .multi-airdrop-addresses::placeholder{color:#777871}
      .multi-airdrop-amount-row{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:12px;align-items:end;margin-top:18px}
      .multi-airdrop-amount-wrap{min-width:0}
      .multi-airdrop-amount{width:100%;box-sizing:border-box;min-height:52px;padding:14px;background:#0f100e;border:1px solid #3a3b36;border-radius:10px;color:#fff;outline:0}
      .multi-airdrop-amount:focus{border-color:#77786f}
      .multi-airdrop-hint{color:#777871;font-size:10px;line-height:1.5;margin-top:7px}
      .multi-airdrop-summary{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:17px}
      .multi-airdrop-stat{padding:13px;border:1px solid rgba(255,255,255,.11);border-radius:10px;background:#1b1d19}
      .multi-airdrop-stat span{display:block;color:#8f9087;font-size:9px;letter-spacing:.12em;margin-bottom:5px}
      .multi-airdrop-stat strong{color:#fff;font-size:14px}
      .multi-airdrop-action{width:100%;margin-top:14px;min-height:54px;border:0;border-radius:10px;background:#ffe500;color:#0a0b09;font-weight:900;letter-spacing:.1em;cursor:pointer}
      .multi-airdrop-action:disabled{opacity:.45;cursor:not-allowed}
      .multi-airdrop-status{margin-top:12px;padding:13px;border:1px solid rgba(255,255,255,.11);border-radius:10px;background:#10110e;color:#c9cac3;font-size:11px;line-height:1.5}
      .multi-airdrop-status.active{border-color:rgba(255,229,0,.35)}.multi-airdrop-status.success{border-color:rgba(255,229,0,.5);color:#fff}.multi-airdrop-status.error{border-color:rgba(255,120,120,.4);color:#ffb4b4}
      .multi-airdrop-results{display:grid;gap:8px;margin-top:12px}
      .multi-airdrop-result{padding:12px;border:1px solid rgba(255,255,255,.11);border-radius:10px;background:#191b18}
      .multi-airdrop-result.success{border-color:rgba(255,229,0,.28)}.multi-airdrop-result.failed{border-color:rgba(255,120,120,.35)}
      .multi-airdrop-result-head{display:flex;justify-content:space-between;gap:10px;align-items:center}.multi-airdrop-result-head strong{font-size:10px}.multi-airdrop-result-head a{color:#ffe500;font-size:9px;font-weight:800}
      .multi-airdrop-result-recipients{margin-top:8px;display:grid;gap:5px}.multi-airdrop-result-recipients div{display:grid;grid-template-columns:1fr auto auto;gap:9px;font-size:9px;color:#bbbdb4}.multi-airdrop-result-recipients b{color:#fff}.multi-airdrop-result-recipients em{color:#ffe500;font-style:normal;font-weight:800}.multi-airdrop-result.failed em{color:#ff9f9f}
      .multi-airdrop-result p{margin:9px 0 0;color:#ffb4b4;font-size:10px}
      .multi-airdrop-help h3{margin:0 0 20px;color:#fff;font-size:26px}.multi-airdrop-help-step{display:grid;grid-template-columns:30px 1fr;gap:11px;padding:13px 0;border-top:1px solid rgba(255,255,255,.08)}.multi-airdrop-help-num{width:26px;height:26px;border-radius:50%;display:grid;place-items:center;border:1px solid rgba(255,229,0,.3);color:#ffe500;font-size:10px;font-weight:800}.multi-airdrop-help-step strong{display:block;color:#f5f5ef;font-size:12px;margin-bottom:4px}.multi-airdrop-help-step span{display:block;color:#a5a69e;font-size:10px;line-height:1.55}

      @media(max-width:600px){
        .multi-airdrop-label{
          font-size:16px!important;
          color:#f5f5f0!important;
          font-weight:800!important;
          letter-spacing:.08em!important;
        }
        .multi-airdrop-hint{
          color:#d1d2cc!important;
          font-size:13px!important;
          line-height:1.65!important;
        }
        .multi-airdrop-input,
        .multi-airdrop-amount{
          min-height:58px!important;
          font-size:17px!important;
          color:#ffffff!important;
          background:#0b0c0a!important;
          border-color:#5b5d56!important;
        }
        .multi-airdrop-addresses{
          min-height:280px!important;
          font-size:15px!important;
          line-height:1.7!important;
          color:#ffffff!important;
          background:#0b0c0a!important;
        }
        .multi-airdrop-line-numbers{
          font-size:14px!important;
          line-height:1.7!important;
          color:#aeb0a8!important;
          background:#080907!important;
        }
        .multi-airdrop-summary{
          grid-template-columns:1fr!important;
          gap:8px!important;
        }
        .multi-airdrop-stat{
          padding:16px!important;
          background:#191b17!important;
          border-color:rgba(255,255,255,.22)!important;
        }
        .multi-airdrop-stat span{
          color:#d0d1ca!important;
          font-size:11px!important;
          letter-spacing:.12em!important;
        }
        .multi-airdrop-stat strong{
          color:#ffffff!important;
          font-size:20px!important;
          line-height:1.3!important;
        }
        .multi-airdrop-action{
          min-height:58px!important;
          font-size:14px!important;
        }
        .multi-airdrop-status{
          color:#eeeeea!important;
          font-size:13px!important;
          line-height:1.6!important;
        }
        .multi-airdrop-help h3{
          font-size:24px!important;
          color:#ffffff!important;
        }
        .multi-airdrop-help-step strong{
          font-size:14px!important;
          color:#ffffff!important;
        }
        .multi-airdrop-help-step span{
          font-size:12px!important;
          color:#d0d1ca!important;
          line-height:1.6!important;
        }
      }
      @media(max-width:430px){
        .multi-airdrop-label{font-size:15px!important}
        .multi-airdrop-hint{font-size:13px!important}
        .multi-airdrop-input,.multi-airdrop-amount{font-size:17px!important}
        .multi-airdrop-addresses{font-size:14px!important}
        .multi-airdrop-stat strong{font-size:19px!important}
      }
      @media(max-width:900px){.multi-airdrop-shell{grid-template-columns:1fr}.multi-airdrop-card,.multi-airdrop-help{padding:22px}}
      @media(max-width:600px){.multi-airdrop-address-editor{grid-template-columns:38px minmax(0,1fr)}
      .multi-airdrop-line-numbers{padding-right:8px;font-size:12px}.multi-airdrop-addresses{min-height:260px;font-size:12px}.multi-airdrop-summary{grid-template-columns:1fr 1fr}.multi-airdrop-card,.multi-airdrop-help{padding:18px}.multi-airdrop-addresses{min-height:260px}.multi-airdrop-amount-row{grid-template-columns:1fr}}
      @media(max-width:430px){.multi-airdrop-summary{grid-template-columns:1fr}}
    `;
    document.head.appendChild(style);
  }

  function buildUi() {
    const app = document.getElementById("multiAirdropApp");
    if (!app || app.dataset.ready) return;
    app.dataset.ready = "1";

    app.innerHTML = `
      <div class="multi-airdrop-shell">
        <div class="multi-airdrop-card">
          <label class="multi-airdrop-label" for="multiAirdropMint">토큰 민트 주소</label>
          <input id="multiAirdropMint" class="multi-airdrop-input" type="text" placeholder="Paste the Solana token mint address" autocomplete="off" spellcheck="false">

          <div class="multi-airdrop-controls">
            <button id="multiAirdropUseCreated" class="multi-airdrop-secondary" type="button" hidden>USE NEW TOKEN</button>
            <button id="multiAirdropClear" class="multi-airdrop-secondary" type="button">CLEAR ADDRESSES</button>
          </div>

          <label class="multi-airdrop-label" for="multiAirdropAddresses" style="margin-top:24px">RECIPIENT WALLET ADDRESSES</label>
          <div class="multi-airdrop-address-editor">
            <div id="multiAirdropLineNumbers" class="multi-airdrop-line-numbers" aria-hidden="true">1</div>
            <textarea id="multiAirdropAddresses" class="multi-airdrop-addresses" placeholder="Paste wallet addresses here — one address per line.\n\nYou can paste hundreds or thousands of addresses at once." spellcheck="false"></textarea>
          </div>
          <div class="multi-airdrop-hint">One wallet address per line. Commas and spaces are also accepted. The same amount will be sent to every wallet.</div>

          <div class="multi-airdrop-amount-row">
            <div class="multi-airdrop-amount-wrap">
              <label class="multi-airdrop-label" for="multiAirdropAmount">AMOUNT PER WALLET (TOKEN)</label>
              <input id="multiAirdropAmount" class="multi-airdrop-amount" type="text" inputmode="decimal" placeholder="e.g. 0.01" autocomplete="off">
              <div class="multi-airdrop-hint">Enter the actual token quantity per wallet. This is never a percentage of total supply.</div>
            </div>
          </div>

          <div class="multi-airdrop-summary">
            <div class="multi-airdrop-stat"><span>RECIPIENTS</span><strong id="multiAirdropCount">0</strong></div>
            <div class="multi-airdrop-stat"><span>TOTAL TOKENS</span><strong id="multiAirdropTotal">0</strong></div>
            <div class="multi-airdrop-stat"><span>TRANSACTIONS</span><strong id="multiAirdropTxCount">—</strong></div>
          </div>
          <div class="multi-airdrop-stat" style="margin-top:8px"><span>GURUGURUG FEE</span><strong id="multiAirdropCost">0 SOL</strong></div>
          <div class="multi-airdrop-hint" style="margin-top:8px">Solana network transaction fees are separate and paid through your wallet.</div>

          <button id="multiAirdropSend" class="multi-airdrop-action" type="button">SEND 멀티 에어드롭</button>
          <div id="multiAirdropStatus" class="multi-airdrop-status">Paste your token mint, wallet addresses and one amount per wallet.</div>
          <div id="multiAirdropResults" class="multi-airdrop-results"></div>
        </div>

        <aside class="multi-airdrop-help">
          <h3>HOW IT WORKS</h3>
          <div class="multi-airdrop-help-step"><div class="multi-airdrop-help-num">1</div><div><strong>Select your token</strong><span>Paste the SPL Token or Token-2022 mint address you want to distribute.</span></div></div>
          <div class="multi-airdrop-help-step"><div class="multi-airdrop-help-num">2</div><div><strong>Paste wallet addresses</strong><span>Paste hundreds or thousands of Solana wallet addresses at once. One address per line is easiest.</span></div></div>
          <div class="multi-airdrop-help-step"><div class="multi-airdrop-help-num">3</div><div><strong>Set one amount</strong><span>Enter the token amount once. Every wallet receives the same amount.</span></div></div>
          <div class="multi-airdrop-help-step"><div class="multi-airdrop-help-num">4</div><div><strong>Approve batches in Phantom</strong><span>GurugSwap automatically splits the list into practical Solana transactions and asks Phantom to approve each batch.</span></div></div>
          <div class="multi-airdrop-help-step"><div class="multi-airdrop-help-num">5</div><div><strong>Track every batch</strong><span>Each confirmed batch gets a direct Solscan transaction link.</span></div></div>
        </aside>
      </div>
    `;

    renderRecipients();

    document.getElementById("multiAirdropAddresses")?.addEventListener("input", event => {
      recipientAddresses = event.target.value.split(/[,\s]+/).map(v => v.trim()).filter(Boolean);
      updateLineNumbers();
      updateSummary();
      scheduleCostEstimate();
    });

    document.getElementById("multiAirdropAddresses")?.addEventListener("scroll", event => {
      const gutter = document.getElementById("multiAirdropLineNumbers");
      if (gutter) gutter.scrollTop = event.target.scrollTop;
    });

    document.getElementById("multiAirdropMint")?.addEventListener("input", () => scheduleCostEstimate());
    document.getElementById("multiAirdropAmount")?.addEventListener("input", () => {
      updateSummary();
      scheduleCostEstimate();
    });

    document.getElementById("multiAirdropClear")?.addEventListener("click", () => {
      recipientAddresses = [];
      const input = document.getElementById("multiAirdropAddresses");
      if (input) input.value = "";
      updateLineNumbers();
      const amount = document.getElementById("multiAirdropAmount");
      if (amount) amount.value = "";
      document.getElementById("multiAirdropResults").innerHTML = "";
      document.getElementById("multiAirdropCost").textContent = "0 SOL";
      setStatus("지갑 주소 목록을 지웠습니다.");
      updateSummary();
      scheduleCostEstimate();
    });

    document.getElementById("multiAirdropSend")?.addEventListener("click", async () => {
      const button = document.getElementById("multiAirdropSend");
      if (button) button.disabled = true;
      try {
        await executeAirdrop();
      } catch (error) {
        console.error("멀티 에어드롭 failed:", error);
        setStatus(error?.message || "멀티 에어드롭이 실패했거나 취소되었습니다.", "error");
      } finally {
        if (button) button.disabled = false;
      }
    });

    document.getElementById("multiAirdropUseCreated")?.addEventListener("click", () => {
      const value = document.getElementById("multiAirdropUseCreated")?.dataset.mint;
      const input = document.getElementById("multiAirdropMint");
      if (value && input) input.value = value;
    });

    window.addEventListener("gurug:token-created", event => {
      const mint = event.detail?.mintAddress;
      const input = document.getElementById("multiAirdropMint");
      const button = document.getElementById("multiAirdropUseCreated");
      if (!mint || !input || !button) return;
      input.value = mint;
      button.dataset.mint = mint;
      button.hidden = false;
      setStatus("New token detected. The mint address is ready for your multi airdrop.", "active");
    });
  }

  function bind() {
    addStyles();
    buildUi();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bind, { once: true });
  } else {
    bind();
  }
})();