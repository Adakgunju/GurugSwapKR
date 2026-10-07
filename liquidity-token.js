(() => {
  "use strict";

  const 레이디움_API = "https://api-v3.raydium.io";
  const SOL_MINT = "So11111111111111111111111111111111111111112";

  function injectStyles() {
    if (document.getElementById("gurug-liquidity-styles")) return;
    const style = document.createElement("style");
    style.id = "gurug-liquidity-styles";
    style.textContent = `
      #liquidity.gurug-liquidity{padding:72px 20px 32px;max-width:1180px;margin:0 auto}
      .liquidity-grid{display:grid;grid-template-columns:minmax(0,1.15fr) minmax(300px,.85fr);gap:24px}
      .liquidity-card,.liquidity-help{border:1px solid rgba(255,255,255,.12);background:rgba(12,12,12,.88);border-radius:22px;padding:28px;box-shadow:0 18px 60px rgba(0,0,0,.22)}
      .liquidity-kicker{font-size:12px;letter-spacing:.18em;color:#ffe500;font-weight:800}
      .liquidity-title{font-size:34px;line-height:1.05;margin:8px 0 8px;color:#fff}
      .liquidity-sub{color:#bdbdbd;margin:0 0 24px;line-height:1.55}
      .liq-label{display:block;font-size:13px;font-weight:800;letter-spacing:.08em;color:#f3f3f3;margin:18px 0 8px}
      .liq-input{width:100%;box-sizing:border-box;min-height:54px;border-radius:12px;border:1px solid rgba(255,255,255,.16);background:#090909;color:#fff;padding:0 15px;font-size:16px;outline:none}
      .liq-input:focus{border-color:#ffe500}
      .liq-row{display:grid;grid-template-columns:1fr 150px;gap:12px}
      .liq-pair{display:grid;grid-template-columns:1fr 1fr;gap:12px}
      .liq-box{border:1px solid rgba(255,255,255,.1);border-radius:14px;padding:15px;background:rgba(255,255,255,.025)}
      .liq-box-head{display:flex;justify-content:space-between;gap:12px;align-items:center;color:#aaa;font-size:11px;letter-spacing:.1em}
      .liq-box strong{display:block;color:#fff;font-size:18px;margin-top:8px}
      .liq-summary{margin-top:20px;border-top:1px solid rgba(255,255,255,.1);padding-top:18px;display:grid;gap:10px}
      .liq-summary div{display:flex;justify-content:space-between;color:#aaa;font-size:14px}
      .liq-summary strong{color:#fff}
      .liq-action{width:100%;min-height:56px;border:0;border-radius:13px;background:#ffe500;color:#090909;font-size:16px;font-weight:900;letter-spacing:.04em;margin-top:22px;cursor:pointer}
      .liq-action:disabled{opacity:.45;cursor:not-allowed}
      .liq-status{margin-top:14px;min-height:22px;color:#aaa;font-size:13px;line-height:1.5}
      .liq-help h3{color:#fff;margin:0 0 18px;font-size:18px}
      .liq-step{display:grid;grid-template-columns:34px 1fr;gap:12px;margin:0 0 18px}
      .liq-num{width:30px;height:30px;border-radius:50%;display:grid;place-items:center;background:#ffe500;color:#090909;font-weight:900;font-size:12px}
      .liq-step strong{color:#fff;display:block;margin-bottom:4px}
      .liq-step p{margin:0;color:#aaa;font-size:13px;line-height:1.5}
      .liq-note{border-top:1px solid rgba(255,255,255,.1);margin-top:22px;padding-top:18px;color:#9e9e9e;font-size:12px;line-height:1.55}
      .liq-link{color:#ffe500;text-decoration:none}
      @media(max-width:760px){#liquidity.gurug-liquidity{padding:44px 14px 24px}.liquidity-grid{grid-template-columns:1fr}.liquidity-card,.liquidity-help{padding:22px}.liquidity-title{font-size:29px}.liq-row{grid-template-columns:1fr}.liq-pair{grid-template-columns:1fr}.liq-input{font-size:17px}}

      /* Keep 03 heading separate while preserving the two-column function boxes. */
      #liquidity.gurug-liquidity .liquidity-grid{
        display:grid!important;
        grid-template-columns:minmax(0,1.15fr) minmax(300px,.85fr)!important;
        gap:24px!important;
        align-items:start!important;
      }
      #liquidity.gurug-liquidity .liquidity-heading{
        grid-column:1 / -1!important;
        grid-row:1!important;
        width:100%!important;
        margin:0 0 4px!important;
        padding:0!important;
        text-align:left!important;
      }
      #liquidity.gurug-liquidity .liquidity-kicker{
        display:block!important;
        margin:0 0 12px!important;
        text-align:left!important;
      }
      #liquidity.gurug-liquidity .liquidity-title{
        display:block!important;
        margin:0 0 14px!important;
        text-align:left!important;
      }
      #liquidity.gurug-liquidity .liquidity-sub{
        display:block!important;
        margin:0!important;
        max-width:760px!important;
        text-align:left!important;
      }
      #liquidity.gurug-liquidity .liquidity-card{
        grid-column:1!important;
        grid-row:2!important;
        width:100%!important;
        margin:0!important;
        box-sizing:border-box!important;
      }
      #liquidity.gurug-liquidity .liquidity-help{
        grid-column:2!important;
        grid-row:2!important;
        width:100%!important;
        margin:0!important;
        box-sizing:border-box!important;
      }
      @media(max-width:900px){
        #liquidity.gurug-liquidity .liquidity-grid{
          grid-template-columns:1fr!important;
          gap:22px!important;
        }
        #liquidity.gurug-liquidity .liquidity-heading{
          grid-column:1!important;
          grid-row:1!important;
        }
        #liquidity.gurug-liquidity .liquidity-card{
          grid-column:1!important;
          grid-row:2!important;
        }
        #liquidity.gurug-liquidity .liquidity-help{
          grid-column:1!important;
          grid-row:3!important;
        }
      }
    `;
    document.head.appendChild(style);
  }

  function provider() {
    if (typeof getPhantomProvider === "function") return getPhantomProvider();
    return window.phantom?.solana || window.solana || null;
  }

  function createSection() {
    if (document.getElementById("liquidity")) return;
    const section = document.createElement("section");
    section.id = "liquidity";
    section.className = "gurug-liquidity";
    section.innerHTML = `
      <div class="liquidity-grid">
        <div class="liquidity-heading">
          <div class="liquidity-kicker">03 / 유동성 풀</div>
          <h2 class="liquidity-title">Create a <span class="section-title-accent">Raydium</span> Pool.</h2>
          <p class="liquidity-sub">Seed your new Solana token with SOL and create a permissionless CPMM pool.</p>
        </div>
        <div class="liquidity-card">
          <label class="liq-label" for="liqMint">토큰 민트 주소</label>
          <input id="liqMint" class="liq-input" placeholder="Paste your token mint address">

          <label class="liq-label">POOL PAIR</label>
          <div class="liq-box">
            <div class="liq-box-head"><span>PAIR</span><span>CPMM</span></div>
            <strong>YOUR TOKEN / SOL</strong>
          </div>

          <div class="liq-pair">
            <div><label class="liq-label" for="liqTokenAmount">TOKEN AMOUNT</label><input id="liqTokenAmount" class="liq-input" inputmode="decimal" type="number" min="0" step="any" placeholder="0"></div>
            <div><label class="liq-label" for="liqSolAmount">SOL AMOUNT</label><input id="liqSolAmount" class="liq-input" inputmode="decimal" type="number" min="0" step="any" placeholder="0"></div>
          </div>

          <div class="liq-row">
            <div><label class="liq-label" for="liqPrice">INITIAL 가격 (SOL)</label><input id="liqPrice" class="liq-input" inputmode="decimal" type="number" min="0" step="any" placeholder="Calculated from deposits"></div>
            <div><label class="liq-label" for="liqFee">FEE TIER</label><select id="liqFee" class="liq-input"><option value="0.25">0.25%</option><option value="0.01">0.01%</option><option value="1">1.00%</option></select></div>
          </div>

          <div class="liq-summary">
            <div><span>POOL TYPE</span><strong>레이디움 CPMM</strong></div>
            <div><span>INITIAL 가격</span><strong id="liqSummaryPrice">—</strong></div>
            <div><span>GURUG스왑 FEE</span><strong>0.10 SOL</strong></div>
            <div><span>EXISTING POOL</span><strong id="liqExisting">CHECKING…</strong></div>
          </div>

          <button id="liqCreateButton" class="liq-action" type="button">CREATE CPMM POOL</button>
          <div class="liq-note">GurugSwap service fee: <b>0.10 SOL</b>. Solana and Raydium network/account fees are separate and paid through your wallet.</div>
          <div id="liqStatus" class="liq-status">Connect your wallet and enter the token mint and initial liquidity.</div>
        </div>

        <aside class="liquidity-help">
          <h3>HOW 유동성 WORKS</h3>
          <div class="liq-step"><span class="liq-num">1</span><div><strong>SELECT YOUR TOKEN</strong><p>Use the mint address of the SPL token you created in Gurug스왑하고.</p></div></div>
          <div class="liq-step"><span class="liq-num">2</span><div><strong>SET THE INITIAL 가격</strong><p>Your token amount and SOL amount determine the starting pool price.</p></div></div>
          <div class="liq-step"><span class="liq-num">3</span><div><strong>SEED THE POOL</strong><p>Both assets are deposited into the Raydium CPMM pool in the same creation transaction.</p></div></div>
          <div class="liq-step"><span class="liq-num">4</span><div><strong>APPROVE IN PHANTOM</strong><p>You remain in control. GurugSwap never receives your private key or takes custody of your funds.</p></div></div>
          <div class="liq-note">Raydium currently recommends CPMM for most new permissionless pools. Pool creation also requires SOL for account creation and network/priority costs. <a class="liq-link" href="https://docs.raydium.io/" target="_blank" rel="noopener noreferrer">Raydium docs ↗</a></div>
        </aside>
      </div>
    `;
    const distribute = document.getElementById("distributeTokens");
    const create = document.getElementById("create-token");
    const swap = document.getElementById("swap");
    const anchor = distribute || create || swap;
    if (anchor?.parentNode) anchor.parentNode.insertBefore(section, anchor.nextSibling);
    else document.querySelector("main")?.appendChild(section);
  }

  function setStatus(message) { const el = document.getElementById("liqStatus"); if (el) el.textContent = message; }

  function decimalToRaw(value, decimals) {
    const text = String(value);
    if (!/^\\d+(\\.\\d+)?$/.test(text)) throw new Error("Invalid amount.");
    const [whole, fraction = ""] = text.split(".");
    if (fraction.length > decimals) throw new Error("Amount has too many decimal places.");
    return BigInt(whole) * (10n ** BigInt(decimals)) +
      BigInt((fraction + "0".repeat(decimals)).slice(0, decimals) || "0");
  }

  function updatePrice() {
    const token = Number(document.getElementById("liqTokenAmount")?.value);
    const sol = Number(document.getElementById("liqSolAmount")?.value);
    const price = token > 0 && sol > 0 ? sol / token : 0;
    const input = document.getElementById("liqPrice");
    const summary = document.getElementById("liqSummaryPrice");
    if (price > 0) { input.value = String(price); summary.textContent = price < 0.000001 ? price.toExponential(6) + " SOL" : price.toFixed(9).replace(/0+$/,"").replace(/\.$/,"") + " SOL"; }
    else summary.textContent = "—";
  }

  async function checkExistingPool() {
    const mint = document.getElementById("liqMint")?.value.trim();
    const el = document.getElementById("liqExisting");
    if (!el) return;
    if (!mint) { el.textContent = "민트 입력"; return; }
    el.textContent = "CHECKING…";
    try {
      const url = 레이디움_API + "/pools/info/list-v2?mint1=" + encodeURIComponent(mint) + "&mint2=" + encodeURIComponent(SOL_MINT) + "&poolType=standard&page=1&pageSize=10";
      const res = await fetch(url, { cache: "no-store" });
      const json = await res.json();
      const count = Array.isArray(json?.data?.data) ? json.data.data.length : Array.isArray(json?.data) ? json.data.length : 0;
      el.textContent = count > 0 ? count + " 풀 발견" : "풀 없음";
    } catch (_) { el.textContent = "확인 불가"; }
  }


  let raydiumSdkPromise = null;

  function formatError(err) {
    const raw = err?.message || String(err || "Unknown error");
    if (/User rejected|User denied|rejected the request|Transaction cancelled/i.test(raw)) {
      return "Transaction cancelled in Phantom.";
    }
    if (/block height exceeded|blockhash not found|expired/i.test(raw)) {
      return "Transaction expired. Please try again with a fresh transaction.";
    }
    return raw.length > 220 ? raw.slice(0, 217) + "…" : raw;
  }

  async function getRpcConnection() {
    const Web3 = window.solanaWeb3;
    if (!Web3?.Connection) throw new Error("Solana web3 library is not available.");
    const rpcs = [
      "https://api.mainnet-beta.solana.com",
      "https://solana-rpc.publicnode.com",
      "https://rpc.solanatracker.io/public"
    ];
    let lastError = null;
    for (const rpc of rpcs) {
      try {
        const conn = new Web3.Connection(rpc, "confirmed");
        await conn.getLatestBlockhash("confirmed");
        return conn;
      } catch (e) {
        lastError = e;
      }
    }
    throw new Error("No Solana RPC endpoint is currently available. " + (lastError?.message || ""));
  }

  async function loadRaydiumSdk() {
    if (!raydiumSdkPromise) {
      setStatus("레이디움 CPMM 엔진을 불러오는 중…");
      raydiumSdkPromise = import("https://esm.sh/@raydium-io/raydium-sdk-v2@0.2.73-alpha?bundle");
    }
    return raydiumSdkPromise;
  }

  function decimalToRawExact(value, decimals) {
    const text = String(value || "").trim();
    if (!/^\d+(\.\d+)?$/.test(text)) throw new Error("Invalid liquidity amount.");
    const [whole, fraction = ""] = text.split(".");
    if (fraction.length > decimals) {
      throw new Error("Amount has more than " + decimals + " decimal places.");
    }
    const padded = (fraction + "0".repeat(decimals)).slice(0, decimals);
    return BigInt(whole) * (10n ** BigInt(decimals)) + BigInt(padded || "0");
  }

  async function getMintInfo(connection, address) {
    const Web3 = window.solanaWeb3;
    const pubkey = new Web3.PublicKey(address);
    const account = await connection.getParsedAccountInfo(pubkey, "confirmed");
    const parsed = account?.value?.data?.parsed;
    const info = parsed?.info;
    if (!info || parsed?.type !== "mint") throw new Error("The token mint could not be read from 토큰을 거래하세요.");
    return {
      address,
      decimals: Number(info.decimals),
      programId: account.value.owner.toBase58()
    };
  }

  async function createCpmmPool({ provider, mintAddress, tokenAmount, solAmount, feeTier }) {
    const Web3 = window.solanaWeb3;
    if (!Web3?.PublicKey) throw new Error("Solana web3 library is not available.");

    const sdk = await loadRaydiumSdk();
    if (!sdk?.Raydium || !sdk?.TxVersion) throw new Error("Raydium browser SDK failed to load.");

    const owner = new Web3.PublicKey(provider.publicKey.toString());
    const connection = await getRpcConnection();

    setStatus("토큰 민트와 지갑 잔액을 확인하는 중…");
    const mintA = await getMintInfo(connection, mintAddress);
    const mintB = {
      address: SOL_MINT,
      decimals: 9,
      programId: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
    };

    const tokenRaw = decimalToRawExact(tokenAmount, mintA.decimals);
    const solRaw = decimalToRawExact(solAmount, 9);
    if (tokenRaw <= 0n || solRaw <= 0n) throw new Error("Liquidity amounts must be greater than zero.");

    // Raydium SDK V2 expects BN amounts for CPMM createPool.
    const bnModule = await import("https://esm.sh/bn.js@5.2.1");
    const BN = bnModule.default || bnModule;
    const tokenAmountBN = new BN(tokenRaw.toString());
    const solAmountBN = new BN(solRaw.toString());

    // Let Raydium SDK resolve the wallet token account. The SDK can create/use
    // the associated token account as part of the pool-creation transaction.
    // A manual public-RPC balance precheck is intentionally avoided because
    // some public RPCs restrict indexed token-account queries even when the
    // wallet definitely owns the 토큰을 민트하세요.
    setStatus("Token amount accepted: " + tokenAmount + ". Preparing wallet token account…");

    setStatus("레이디움 CPMM 설정을 불러오는 중…");
    const raydium = await sdk.Raydium.load({
      owner,
      connection,
      cluster: "mainnet",
      disableFeatureCheck: true,
      disableLoadToken: false,
      blockhashCommitment: "confirmed",
      signAllTransactions: async (transactions) => {
        if (typeof provider.signAllTransactions === "function") {
          return provider.signAllTransactions(transactions);
        }
        if (typeof provider.signTransaction === "function" && transactions.length === 1) {
          return [await provider.signTransaction(transactions[0])];
        }
        throw new Error("이 지갑은 거래 서명을 지원하지 않습니다.");
      }
    });

    // Public RPC providers may reject Raydium SDK's indexed
    // getTokenAccountsByOwner request. We already know the user's ATA,
    // so seed the SDK account cache from a direct getAccountInfo call.
    // This avoids indexed RPC entirely while still letting Raydium build
    // the normal CPMM transaction.
    setStatus("Preparing your token account for Raydium…");
    const tokenAtaInfo = await connection.getAccountInfo(
      new Web3.PublicKey(
        Web3.PublicKey.findProgramAddressSync(
          [
            owner.toBuffer(),
            new Web3.PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA").toBuffer(),
            new Web3.PublicKey(mintAddress).toBuffer()
          ],
          new Web3.PublicKey("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL")
        )[0]
      ),
      "confirmed"
    );

    if (!tokenAtaInfo) {
      throw new Error("Your token's associated token account was not found. Please make sure this wallet owns the tokens and reconnect Phantom.");
    }

    // Raydium only needs mint + amount from tokenAccountRawInfos for CPMM
    // account selection. Decode those fields directly from the SPL account.
    const tokenAta = Web3.PublicKey.findProgramAddressSync(
      [
        owner.toBuffer(),
        new Web3.PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA").toBuffer(),
        new Web3.PublicKey(mintAddress).toBuffer()
      ],
      new Web3.PublicKey("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL")
    )[0];
    const ataBytes = new Uint8Array(tokenAtaInfo.data);
    const ataMint = new Web3.PublicKey(ataBytes.slice(0, 32));
    const ataOwner = new Web3.PublicKey(ataBytes.slice(32, 64));
    const ataAmount = new BN(ataBytes.slice(64, 72), "le");

    raydium.account.updateTokenAccount({
      tokenAccounts: [{
        publicKey: tokenAta,
        mint: ataMint,
        amount: ataAmount,
        isAssociated: true,
        isNative: false,
        programId: new Web3.PublicKey(mintA.programId)
      }],
      tokenAccountRawInfos: [{
        pubkey: tokenAta,
        programId: new Web3.PublicKey(mintA.programId),
        accountInfo: {
          mint: ataMint,
          owner: ataOwner,
          amount: ataAmount,
          delegateOption: 0,
          delegate: Web3.PublicKey.default,
          state: 1,
          isNativeOption: 0,
          isNative: new BN(0),
          delegatedAmount: new BN(0),
          closeAuthorityOption: 0,
          closeAuthority: Web3.PublicKey.default
        }
      }]
    });

    setStatus("Token account verified. 레이디움 CPMM 설정을 불러오는 중…");

    const feeConfigs = await raydium.api.getCpmmConfigs();
    if (!Array.isArray(feeConfigs) || !feeConfigs.length) {
      throw new Error("Raydium returned no CPMM fee configurations.");
    }

    const targetRate = Math.round(feeTier * 10000);
    const feeConfig = feeConfigs.find(x => Number(x.tradeFeeRate) === targetRate);
    if (!feeConfig) {
      const available = feeConfigs
        .map(x => Number(x.tradeFeeRate) / 10000)
        .filter(Number.isFinite)
        .map(x => x + "%")
        .join(", ");
      throw new Error("Selected fee tier is unavailable. Available tiers: " + available);
    }

    const programId = sdk.CREATE_CPMM_POOL_PROGRAM;
    const poolFeeAccount = sdk.CREATE_CPMM_POOL_FEE_ACC;
    if (!programId || !poolFeeAccount) throw new Error("Raydium CPMM program configuration is unavailable.");

    const txVersion = sdk.TxVersion.V0;
    const mintAInfo = {
      address: mintA.address,
      decimals: mintA.decimals,
      programId: mintA.programId
    };
    const mintBInfo = {
      address: mintB.address,
      decimals: mintB.decimals,
      programId: mintB.programId
    };

    setStatus("CPMM 풀 거래를 생성하는 중…");
    const { execute, extInfo, builder, transaction } = await raydium.cpmm.createPool({
      programId,
      poolFeeAccount,
      mintA: mintAInfo,
      mintB: mintBInfo,
      mintAAmount: tokenAmountBN,
      mintBAmount: solAmountBN,
      startTime: new BN(Math.floor(Date.now() / 1000)),
      feeConfig,
      associatedOnly: true,
      ownerInfo: {
        useSOLBalance: true,
        feePayer: owner
      },
      txVersion
    });

    const feeInstruction = Web3.SystemProgram.transfer({
      fromPubkey: owner,
      toPubkey: new Web3.PublicKey(GURUG_FEE_WALLET),
      lamports: GURUG_POOL_FEE_LAMPORTS
    });
    if (builder?.addInstruction) {
      builder.addInstruction({
        instructions: [feeInstruction],
        instructionTypes: ["TransferAmount"]
      });
    } else if (transaction?.add) {
      transaction.add(feeInstruction);
    } else {
      throw new Error("Could not attach the GurugSwap service fee to the pool transaction.");
    }

    setStatus("Phantom에서 풀 생성 거래를 승인해주세요…");
    const result = await execute({ sendAndConfirm: true });
    const txId = result?.txId;
    const poolId = extInfo?.address?.poolId?.toString?.() || extInfo?.address?.poolState?.toString?.() || "";

    if (poolId) {
      setStatus("CPMM pool created. Pool ID: " + poolId);
    } else {
      setStatus("CPMM 풀이 성공적으로 생성되었습니다.");
    }

    const status = document.getElementById("liqStatus");
    if (status && (txId || poolId)) {
      status.textContent = "";
      if (txId) {
        const txLink = document.createElement("a");
        txLink.className = "liq-link";
        txLink.href = "https://solscan.io/tx/" + txId;
        txLink.target = "_blank";
        txLink.rel = "noopener noreferrer";
        txLink.textContent = "거래 내역 보기 ↗";
        status.appendChild(txLink);
      }
      if (txId && poolId) {
        status.appendChild(document.createTextNode("  "));
      }
      if (poolId) {
        const poolLink = document.createElement("a");
        poolLink.className = "liq-link";
        poolLink.href = "https://raydium.io/liquidity/increase/?mode=add&pool_id=" + encodeURIComponent(poolId);
        poolLink.target = "_blank";
        poolLink.rel = "noopener noreferrer";
        poolLink.textContent = "레이디움 풀 보기 ↗";
        status.appendChild(poolLink);
      }
    }
    if (poolId) {
      const existing = document.getElementById("liqExisting");
      if (existing) existing.textContent = "풀 생성 완료";
    }
  }

  function bind() {
    const mint = document.getElementById("liqMint");
    const tokenAmount = document.getElementById("liqTokenAmount");
    const solAmount = document.getElementById("liqSolAmount");
    [tokenAmount, solAmount].forEach(el => el?.addEventListener("input", updatePrice));
    mint?.addEventListener("change", checkExistingPool);
    mint?.addEventListener("blur", checkExistingPool);
    document.getElementById("liqCreateButton")?.addEventListener("click", async () => {
      const p = provider();
      if (!p) { setStatus("먼저 Phantom을 연결해주세요."); return; }
      if (!p.publicKey) { setStatus("먼저 지갑을 연결해주세요."); return; }
      const mintValue = mint?.value.trim();
      const tokenAmountValue = Number(tokenAmount?.value);
      const solAmountValue = Number(solAmount?.value);
      if (!mintValue) { setStatus("토큰 민트 주소를 입력해주세요."); return; }
      if (!Number.isFinite(tokenAmountValue) || tokenAmountValue <= 0) { setStatus("0보다 큰 토큰 수량을 입력해주세요."); return; }
      if (!Number.isFinite(solAmountValue) || solAmountValue <= 0) { setStatus("0보다 큰 SOL 수량을 입력해주세요."); return; }
      updatePrice();
      try {
        await createCpmmPool({
          provider: p,
          mintAddress: mintValue,
          tokenAmount: String(tokenAmount?.value || ""),
          solAmount: String(solAmount?.value || ""),
          feeTier: Number(document.getElementById("liqFee")?.value || 0.25)
        });
      } catch (err) {
        console.error("CPMM 풀 생성 실패:", err);
        setStatus(formatError(err));
      }
    });
  }

  function init() {
    injectStyles(); createSection(); bind();
    window.addEventListener("gurug:token-created", event => {
      const mint = event?.detail?.mint || event?.detail?.mintAddress || "";
      if (mint) { const input = document.getElementById("liqMint"); if (input) { input.value = mint; checkExistingPool(); } }
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();