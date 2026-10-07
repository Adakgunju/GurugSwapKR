/* GURUG스왑 — CREATE TOKEN v2
 * Creates a standard SPL Token + Metaplex Token Metadata on Solana mainnet.
 * Logo + metadata are uploaded to permanent Arweave storage through Irys.
 * The connected wallet signs all Solana/storage transactions; GurugSwap never
 * receives or stores the user's private key.
 */
(() => {
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
  const UMI_CDN = "https://esm.sh/@metaplex-foundation/umi@1.5.1?bundle";
  const UMI_DEFAULTS_CDN = "https://esm.sh/@metaplex-foundation/umi-bundle-defaults@1.5.1?bundle";
  const UMI_WALLET_CDN = "https://esm.sh/@metaplex-foundation/umi-signer-wallet-adapters@1.5.1?bundle";
  const MPL_METADATA_CDN = "https://esm.sh/@metaplex-foundation/mpl-token-metadata@3.4.0?bundle";
  const MPL_TOOLBOX_CDN = "https://esm.sh/@metaplex-foundation/mpl-toolbox@0.11.4?bundle";
  const BUFFER_CDN = "https://esm.sh/buffer@6.0.3?bundle";
  const STYLE_ID = "gurug-create-token-style";
  const SECTION_ID = "create-token";
  const GURUG_FEE_WALLET = "ARmME4KE6oe87TokQf7SmYZL6e5Gpz1UCobU3EEqSwEH";
  const GURUG_TOKEN_CREATION_FEE_LAMPORTS = 500000000;

  const css = `
#create-token{padding:42px 5vw 18px}
.create-token-card{max-width:760px;margin:0 auto;padding:24px;border:1px solid rgba(255,229,0,.34);border-radius:22px;background:linear-gradient(145deg,rgba(27,29,17,.94),rgba(12,14,9,.94));box-shadow:0 18px 55px rgba(0,0,0,.34),inset 0 0 35px rgba(255,229,0,.018)}
.create-token-head{display:flex;align-items:flex-start;justify-content:space-between;gap:18px;margin-bottom:20px}
.create-token-kicker{color:#ffe500;font-size:10px;font-weight:800;letter-spacing:.18em}
.create-token-title{margin:7px 0 0;color:#fff;font-size:25px;line-height:1.05}
.create-token-copy{margin:8px 0 0;color:#8f8f82;font-size:10px;line-height:1.6;max-width:510px}
.create-token-network{flex:0 0 auto;padding:7px 9px;border:1px solid rgba(255,229,0,.28);border-radius:9px;color:#ffe500;font-size:8px;font-weight:800;letter-spacing:.12em}
.create-token-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.create-token-field{display:flex;flex-direction:column;gap:7px}
.create-token-field.full{grid-column:1/-1}
.create-token-field label{color:#85867a;font-size:8px;font-weight:800;letter-spacing:.14em}
.create-token-field input{width:100%;box-sizing:border-box;border:1px solid rgba(255,255,255,.08);border-radius:11px;background:#10110d;color:#fff;padding:13px 12px;outline:0;font-size:12px}
.create-token-field input:focus{border-color:rgba(255,229,0,.55);box-shadow:0 0 0 2px rgba(255,229,0,.05)}
.create-token-field small{color:#66685f;font-size:8px;line-height:1.4}
.create-token-options{margin-top:14px;padding:13px 14px;border:1px solid rgba(255,255,255,.065);border-radius:12px;background:#10110d}
.create-token-check{display:flex;align-items:flex-start;gap:10px;cursor:pointer}
.create-token-check input{margin-top:2px;accent-color:#ffe500}
.create-token-check strong{display:block;color:#ddd;font-size:10px}
.create-token-check span{display:block;margin-top:4px;color:#77786e;font-size:8px;line-height:1.45}
.create-token-warning{margin-top:10px;color:#b5b5a9;font-size:8px;line-height:1.5}
.create-token-warning b{color:#ffe500}
.create-token-button{width:100%;margin-top:16px;min-height:48px;border:0;border-radius:11px;background:#ffe500;color:#10110d;font-size:11px;font-weight:900;letter-spacing:.13em;cursor:pointer}
.create-token-button:hover{filter:brightness(1.04)}
.create-token-button:disabled{opacity:.5;cursor:not-allowed}
.create-token-status{margin-top:12px;padding:13px 14px;border:1px solid rgba(255,255,255,.07);border-radius:11px;background:#10110d;color:#929388;font-size:9px;line-height:1.55}
.create-token-status.active{border-color:rgba(255,229,0,.35);color:#ddd}
.create-token-status.success{border-color:rgba(255,229,0,.5);color:#fff}
.create-token-status.error{border-color:rgba(255,120,120,.35);color:#ffadad}
.create-token-result{margin-top:12px;padding:14px;border:1px solid rgba(255,229,0,.25);border-radius:12px;background:rgba(255,229,0,.035)}
.create-token-result[hidden]{display:none}
.create-token-result-label{color:#7f8074;font-size:7px;letter-spacing:.14em}
.create-token-result-address{display:flex;align-items:center;gap:10px;margin-top:7px}
.create-token-result-address code{min-width:0;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#fff;font-size:9px}
.create-token-copy{border:0;background:transparent;color:#ffe500;font-size:8px;font-weight:800;letter-spacing:.1em;cursor:pointer}
.create-token-result-links{display:flex;gap:14px;margin-top:10px}
.create-token-result-links a{color:#ffe500;text-decoration:none;font-size:8px;letter-spacing:.1em}
.create-token-note{margin-top:13px;color:#66685f;font-size:8px;line-height:1.55}
@media(max-width:520px){#create-token{padding:30px 18px 14px}.create-token-card{padding:17px;border-radius:18px}.create-token-head{gap:10px}.create-token-title{font-size:21px}.create-token-grid{grid-template-columns:1fr}.create-token-field.full{grid-column:auto}.create-token-network{font-size:7px}.create-token-button{min-height:46px}}
/* GurugSwap Create Token visual upgrade */
/* GurugSwap hero character — visual identity */
#create-token{position:relative;overflow:hidden}
#create-token .create-token-shell{position:relative;z-index:1}
#create-token .create-token-head{position:relative;z-index:3;max-width:760px}
.gurug-create-hero-art{
  position:absolute;
  z-index:0;
  width:min(430px,38vw);
  height:430px;
  right:1.5vw;
  top:70px;
  pointer-events:none;
  display:flex;
  align-items:center;
  justify-content:center;
}
.gurug-create-hero-art img{
  position:relative;
  z-index:2;
  width:100%;
  height:100%;
  object-fit:contain;
  object-position:center;
  filter:drop-shadow(0 22px 35px rgba(0,0,0,.48)) drop-shadow(0 0 30px rgba(255,229,0,.20));
  opacity:.96;
}
.gurug-art-glow{
  position:absolute;
  width:72%;
  height:72%;
  border-radius:50%;
  background:radial-gradient(circle,rgba(255,229,0,.24) 0%,rgba(255,229,0,.08) 34%,transparent 70%);
  filter:blur(12px);
}
.gurug-art-orb{
  position:absolute;
  border-radius:50%;
  background:rgba(255,229,0,.8);
  box-shadow:0 0 20px rgba(255,229,0,.65);
}
.gurug-art-orb.orb-a{width:8px;height:8px;right:18%;top:15%}
.gurug-art-orb.orb-b{width:5px;height:5px;left:12%;bottom:18%}
#create-token .create-token-card,
#create-token .create-token-help{position:relative;z-index:2}
@media(max-width:1050px){
  .gurug-create-hero-art{right:-70px;opacity:.20;width:420px;height:420px}
}
@media(max-width:700px){
  .gurug-create-hero-art{right:-95px;top:105px;width:330px;height:330px;opacity:.12}
}

/* Mobile readability pass */
/* Mobile alignment correction */
#create-token .create-token-head{align-items:flex-start}
#create-token .create-token-copy{letter-spacing:normal!important;word-spacing:normal!important;max-width:none!important;width:100%!important;display:block!important;text-align:left!important}
#create-token .create-token-title{letter-spacing:-.02em!important;word-spacing:normal!important}
@media(max-width:560px){
  #create-token .create-token-head{display:block!important}
  #create-token .create-token-network{display:inline-block!important;margin-top:16px!important}
  #create-token .create-token-copy{font-size:15px!important;line-height:1.55!important;letter-spacing:normal!important;word-spacing:normal!important}
  #create-token .create-token-title{font-size:28px!important;line-height:1.08!important}
}

#create-token .create-token-title{color:#ffffff!important}
#create-token .create-token-copy{color:#f2f2ec!important;font-weight:600}
#create-token .create-token-field label{color:#f1f1e9!important;font-size:15px!important}
#create-token .create-token-field small{color:#c8c9bd!important;font-size:13px!important}
#create-token .create-token-field input{color:#ffffff!important;background:#0b0d0a!important;border-color:rgba(255,255,255,.22)!important}
#create-token .create-token-field input::placeholder{color:#bfc0b8!important;opacity:1!important}
#create-token .create-token-options-title,
#create-token .create-token-check strong,
#create-token .create-token-cost-title{color:#ffffff!important}
#create-token .create-token-check span{color:#d2d3c9!important;font-size:14px!important}
#create-token .create-token-warning{color:#c9cabf!important;font-size:13px!important}
#create-token .create-token-cost-row{color:#d4d5ca!important;font-size:14px!important}
#create-token .create-token-cost-row strong{color:#ffffff!important}
#create-token .create-token-help h3,
#create-token .create-token-help-section h4{color:#ffffff!important}
#create-token .create-token-help-step strong{color:#f5f5ee!important}
#create-token .create-token-help-step span,
#create-token .create-token-help-section p{color:#d0d1c7!important}
#create-token .create-token-note{color:#bfc0b6!important;font-size:13px!important}
@media(max-width:560px){
  #create-token{padding:28px 14px 18px!important}
  #create-token .create-token-card{padding:22px 18px!important}
  #create-token .create-token-title{font-size:28px!important;line-height:1.08!important}
  #create-token .create-token-copy{font-size:15px!important;line-height:1.65!important}
  #create-token .create-token-network{font-size:10px!important}
  #create-token .create-token-field label{font-size:15px!important}
  #create-token .create-token-field input{font-size:17px!important;min-height:56px!important}
  #create-token .create-token-field small{font-size:13px!important}
  #create-token .create-token-check strong{font-size:16px!important}
  #create-token .create-token-check span{font-size:14px!important}
  #create-token .create-token-cost-row{font-size:14px!important}
  #create-token .create-token-cost-total{font-size:16px!important}
  #create-token .create-token-cost-total strong{font-size:20px!important}
  #create-token .create-token-button{font-size:15px!important;min-height:56px!important}
  #create-token .create-token-status{font-size:14px!important}
}

#create-token{padding:54px 5vw 24px}
.create-token-card{max-width:1180px;margin:0 auto;padding:30px}
.create-token-head{margin-bottom:28px}
.create-token-kicker{font-size:12px}
.create-token-title{font-size:30px}
.create-token-copy{font-size:15px}
.create-token-field label{font-size:14px}
.create-token-field input{padding:15px 14px;font-size:16px}
.create-token-field small{font-size:12px}
.create-token-options{margin-top:24px;padding:19px}
.create-token-check strong{font-size:15px}
.create-token-check span{font-size:13px}
.create-token-button{min-height:54px;font-size:14px}
.create-token-status{font-size:13px}
.create-token-shell{max-width:1180px;margin:0 auto;display:grid;grid-template-columns:minmax(0,1.05fr) minmax(330px,.78fr);gap:28px;align-items:start}
.create-token-shell .create-token-card{max-width:none;margin:0}
.create-token-help{padding:30px;position:sticky;top:24px;border:1px solid rgba(255,229,0,.26);border-radius:24px;background:linear-gradient(145deg,rgba(27,29,17,.97),rgba(10,12,9,.97));box-shadow:0 18px 55px rgba(0,0,0,.34)}
.create-token-help-kicker{color:#ffe500;font-size:12px;font-weight:900;letter-spacing:.15em}
.create-token-help h3{margin:9px 0 22px;color:#fff;font-size:26px;line-height:1.12}
.create-token-help-step{display:flex;gap:13px;padding:14px 0;border-bottom:1px solid rgba(255,255,255,.065)}
.create-token-help-num{width:27px;height:27px;flex:0 0 27px;border-radius:50%;background:rgba(255,229,0,.12);border:1px solid rgba(255,229,0,.28);display:flex;align-items:center;justify-content:center;color:#ffe500;font-size:12px;font-weight:900}
.create-token-help-step strong{display:block;color:#eee;font-size:15px}
.create-token-help-step span{display:block;margin-top:4px;color:#929388;font-size:13px;line-height:1.5}
.create-token-help-section{margin-top:25px;padding-top:20px;border-top:1px solid rgba(255,255,255,.08)}
.create-token-help-section h4{margin:0 0 11px;color:#fff;font-size:17px}
.create-token-help-section p{margin:0 0 13px;color:#929388;font-size:13px;line-height:1.6}
.create-token-help-tip{padding:13px 14px;border-radius:11px;background:rgba(255,229,0,.055);border:1px solid rgba(255,229,0,.13);color:#b9baae;font-size:12px;line-height:1.55}
.create-token-logo-wrap{display:grid;grid-template-columns:1fr 118px;gap:14px;align-items:center}
.create-token-logo-upload{min-height:118px;border:1px dashed rgba(255,229,0,.35);border-radius:14px;background:#10110d;display:flex;align-items:center;justify-content:center;cursor:pointer;overflow:hidden;position:relative}
.create-token-logo-upload input{display:none}
.create-token-logo-placeholder{text-align:center;color:#a9aa9f;font-size:14px;line-height:1.5;padding:15px}
.create-token-logo-placeholder b{display:block;color:#ffe500;font-size:16px;margin-bottom:4px}
.create-token-logo-preview{width:100%;height:100%;object-fit:cover;display:none}
.create-token-logo-preview.visible{display:block}
.create-token-logo-preview.visible + .create-token-logo-placeholder{display:none}
.create-token-cost{margin-top:22px;padding:19px;border:1px solid rgba(255,229,0,.22);border-radius:15px;background:rgba(255,229,0,.035)}
.create-token-cost-title{color:#fff;font-size:17px;font-weight:900;margin-bottom:12px}
.create-token-cost-row{display:flex;justify-content:space-between;gap:18px;color:#aaaBA0;font-size:14px;line-height:1.8}
.create-token-cost-row strong{color:#fff}
.create-token-cost-total{margin-top:9px;padding-top:10px;border-top:1px solid rgba(255,255,255,.08);font-size:16px;color:#fff}
.create-token-cost-total strong{color:#ffe500;font-size:19px}
@media(max-width:900px){.create-token-shell{grid-template-columns:1fr}.create-token-help{position:static}}
@media(max-width:560px){#create-token{padding:34px 18px 18px}.create-token-card,.create-token-help{padding:21px}.create-token-title{font-size:25px}.create-token-copy{font-size:14px}.create-token-grid{grid-template-columns:1fr}.create-token-field.full{grid-column:auto}.create-token-logo-wrap{grid-template-columns:1fr 100px}.create-token-logo-upload{min-height:100px}}

/* Final section-heading layout: kicker, title, and description are stacked vertically. */
#create-token .create-token-head{
  position:relative!important;
  display:block!important;
  grid-column:1 / -1!important;
  width:100%!important;
  margin:0 0 28px!important;
  padding:0!important;
  text-align:left!important;
}
#create-token .create-token-kicker{
  display:block!important;
  margin:0 0 12px!important;
}
#create-token .create-token-title{
  display:block!important;
  margin:0 0 14px!important;
  width:100%!important;
  text-align:left!important;
}
#create-token .create-token-copy{
  display:block!important;
  margin:0!important;
  width:min(100%,760px)!important;
  max-width:760px!important;
  text-align:left!important;
}
#create-token .create-token-network{
  position:absolute!important;
  top:0!important;
  right:0!important;
  margin:0!important;
}
@media(max-width:900px){
  #create-token .create-token-network{
    position:static!important;
    display:inline-block!important;
    margin-top:16px!important;
  }
}

/* Keep the original two-column function layout. Only the section heading stacks. */
#create-token .create-token-shell{
  display:grid!important;
  grid-template-columns:minmax(0,1.05fr) minmax(330px,.78fr)!important;
  column-gap:28px!important;
  row-gap:28px!important;
  align-items:start!important;
}
#create-token .create-token-head{
  grid-column:1 / -1!important;
  grid-row:1!important;
}
#create-token .create-token-card{
  grid-column:1!important;
  grid-row:2!important;
  width:100%!important;
  max-width:none!important;
  box-sizing:border-box!important;
  margin:0!important;
}
#create-token .create-token-help{
  grid-column:2!important;
  grid-row:2!important;
  width:100%!important;
  box-sizing:border-box!important;
  margin:0!important;
}
#create-token .create-token-grid{
  display:grid!important;
  grid-template-columns:minmax(0,1fr) minmax(0,1fr)!important;
  gap:12px!important;
}
#create-token .create-token-field.full{
  grid-column:1 / -1!important;
}
@media(max-width:900px){
  #create-token .create-token-shell{
    grid-template-columns:1fr!important;
    row-gap:22px!important;
  }
  #create-token .create-token-head{
    grid-column:1!important;
    grid-row:1!important;
  }
  #create-token .create-token-card{
    grid-column:1!important;
    grid-row:2!important;
  }
  #create-token .create-token-help{
    grid-column:1!important;
    grid-row:3!important;
  }
  #create-token .create-token-grid{
    grid-template-columns:1fr!important;
  }
  #create-token .create-token-field.full{
    grid-column:auto!important;
  }
}
`;
  
  function addStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = css;
    document.head.appendChild(style);
  }

  function addSection() {
    if (document.getElementById(SECTION_ID)) return;
    const swap = document.getElementById("swap");
    if (!swap) return;
    swap.insertAdjacentHTML("beforebegin", `
      <section id="create-token" aria-label="솔라나 토큰 생성">
        <div class="create-token-shell">
          <div class="create-token-head">
            <div class="create-token-kicker">01 / 토큰 생성</div>
            <h2 class="create-token-title">나만의 <span class="section-title-accent">SPL 토큰.</span></h2>
            <p class="create-token-copy">GurugSwap에서 새로운 SPL 토큰을 직접 생성하세요. 거래에는 지갑이 서명하며 GurugSwap은 개인키를 받지 않습니다.</p>
            <span class="create-token-network">솔라나 메인넷</span>
          </div>
          <div class="gurug-create-hero-art" aria-hidden="true">
            <div class="gurug-art-glow"></div>
            <img src="https://raw.githubusercontent.com/Adakgunju/Gurug/main/assets/logo/gurug-logo2.png" alt="">
            <div class="gurug-art-orb orb-a"></div>
            <div class="gurug-art-orb orb-b"></div>
          </div>
          <div class="create-token-card">
          <div class="create-token-grid">
            <div class="create-token-field">
              <label for="createTokenName">토큰 이름</label>
              <input id="createTokenName" maxlength="32" type="text" placeholder="My Token" autocomplete="off">
              <small>최대 32자입니다.</small>
            </div>
            <div class="create-token-field">
              <label for="createTokenSymbol">심볼</label>
              <input id="createTokenSymbol" maxlength="6" type="text" placeholder="MYTKN" autocomplete="off">
              <small>최대 6자입니다.</small>
            </div>
            <div class="create-token-field">
              <label for="createTokenSupply">총 발행량</label>
              <input id="createTokenSupply" inputmode="decimal" type="text" placeholder="1000000000" autocomplete="off">
              <small>초기 발행량은 지갑으로 전송됩니다.</small>
            </div>
            <div class="create-token-field">
              <label for="createTokenDecimals">소수점</label>
              <input id="createTokenDecimals" inputmode="numeric" type="number" min="0" max="9" step="1" value="9">
              <small>소수점 0~9자리까지 지원합니다.</small>
            </div>
            <div class="create-token-field full">
              <label>토큰 로고</label>
              <div class="create-token-logo-wrap">
                <label class="create-token-logo-upload" for="createTokenLogo">
                  <input id="createTokenLogo" type="file" accept="image/png,image/jpeg,image/webp">
                  <img id="createTokenLogoPreview" class="create-token-logo-preview" alt="Token logo preview">
                  <span class="create-token-logo-placeholder"><b>로고 업로드</b>PNG, JPG 또는 WEBP</span>
                </label>
                <small>정사각형 이미지를 사용하세요. 최대 2MB이며 선택한 로고를 여기에서 미리 볼 수 있습니다.</small>
              </div>
            </div>
          </div>

          <div class="create-token-options">
            <label class="create-token-check">
              <input id="createTokenFixed" type="checkbox" checked>
              <span>
                <strong>FIX 총 발행량</strong>
                <span>초기 발행 후 민트 권한을 영구 해제합니다. 추가 토큰을 발행할 수 없습니다.</span>
              </span>
            </label>
            <label class="create-token-check">
              <input id="createTokenRevokeFreeze" type="checkbox" checked>
              <span>
                <strong>동결 권한 해제</strong>
                <span>나중에 동결 권한으로 토큰 계정을 동결할 수 없게 합니다. 공개 유동성 풀에 권장됩니다.</span>
              </span>
            </label>
            <div class="create-token-warning"><b>주의:</b> 솔라나 메인넷에 실제 토큰을 생성하며 계정 생성 및 네트워크 수수료에 SOL이 필요합니다. Phantom에서 승인하기 전에 모든 내용을 확인하세요.</div>
          </div>

          <div class="create-token-cost">
            <div class="create-token-cost-title">CREATION COST</div>
            <div class="create-token-cost-row"><span>GurugSwap 서비스 수수료</span><strong>0.50 SOL</strong></div>
            <div class="create-token-warning"><b>Service fee:</b> 0.50 SOL is paid to GurugSwap. Solana network and storage transaction fees are separate and paid through your wallet.</div>
          </div>
          <button id="createTokenButton" class="create-token-button" type="button">CREATE TOKEN</button>
          <div id="createTokenStatus" class="create-token-status">Connect your Phantom wallet, enter the token details, then create the token.</div>

          <div id="createTokenResult" class="create-token-result" hidden>
            <div class="create-token-result-label">NEW MINT ADDRESS</div>
            <div class="create-token-result-address">
              <code id="createTokenMintAddress">—</code>
              <button id="createTokenCopy" class="create-token-copy" type="button">복사</button>
            </div>
            <div class="create-token-result-links">
              <a id="createTokenSolscan" href="#" target="_blank" rel="noopener noreferrer">VIEW SOLSCAN ↗</a>
              <a id="createTokenAccount" href="#" target="_blank" rel="noopener noreferrer">VIEW TOKEN ACCOUNT ↗</a>
              <a id="createTokenMetadata" href="#" target="_blank" rel="noopener noreferrer" hidden>VIEW METADATA ↗</a>
            </div>
          </div>

          <div class="create-token-note">로고와 토큰 메타데이터는 Irys를 통해 영구 저장되며 Metaplex Token Metadata로 민트에 연결됩니다. GurugSwap은 지갑이나 개인키를 보관하지 않습니다.</div>
        </div>
        <aside class="create-token-help">
          <div class="create-token-help-kicker">HOW IT WORKS</div>
          <h3>솔라나 토큰 만드는 방법</h3>
          <div class="create-token-help-step"><div class="create-token-help-num">1</div><div><strong>지갑 연결</strong><span>Phantom을 연결하세요. 지갑과 자산은 계속 본인이 직접 관리합니다.</span></div></div>
          <div class="create-token-help-step"><div class="create-token-help-num">2</div><div><strong>토큰 정보 입력</strong><span>이름, 심볼, 발행량, 소수점을 설정하세요.</span></div></div>
          <div class="create-token-help-step"><div class="create-token-help-num">3</div><div><strong>로고 업로드</strong><span>PNG, JPG 또는 WEBP 파일을 업로드하고 생성 전에 미리 확인하세요.</span></div></div>
          <div class="create-token-help-step"><div class="create-token-help-num">4</div><div><strong>발행량 관리 설정</strong><span>총 발행량 고정과 동결 권한 해제가 기본으로 활성화됩니다.</span></div></div>
          <div class="create-token-help-step"><div class="create-token-help-num">5</div><div><strong>메타데이터 업로드</strong><span>로고와 메타데이터 JSON은 Irys를 통해 영구 저장됩니다. 저장 비용은 지갑에서 지불합니다.</span></div></div>
          <div class="create-token-help-step"><div class="create-token-help-num">6</div><div><strong>Phantom에서 승인</strong><span>지갑에서 토큰 생성 및 메타데이터 거래에 서명합니다.</span></div></div>
          <div class="create-token-help-section"><h4>총 발행량 고정이란?</h4><p>초기 발행 후 민트 권한을 해제하면 해당 권한으로 추가 토큰을 발행할 수 없습니다.</p></div>
          <div class="create-token-help-section"><h4>동결 권한이란?</h4><p>동결 권한은 토큰 계정을 동결할 수 있습니다. 이를 해제하면 해당 민트에는 동결 권한이 남지 않습니다.</p><div class="create-token-help-tip">공개 유동성 풀과 투명한 토큰 출시를 위해 권장합니다.</div></div>
          <div class="create-token-help-section"><h4>생성 후에는 어떻게 되나요?</h4><p>지갑으로 초기 발행량이 전송되고, GurugSwap에서 새로운 민트 주소와 Solscan 링크를 확인할 수 있습니다.</p></div>
        </aside>
        </div>
      </section>

    `);
  }

  function setStatus(message, state = "") {
    const el = document.getElementById("createTokenStatus");
    if (!el) return;
    el.className = "create-token-status" + (state ? " " + state : "");
    el.textContent = message;
  }

  function parseSupply(value, decimals) {
    const raw = String(value || "").trim().replace(/,/g, "");
    if (!/^\d+(\.\d+)?$/.test(raw)) throw new Error("올바른 총 발행량을 입력해주세요.");
    const parts = raw.split(".");
    const whole = parts[0] || "0";
    const fraction = parts[1] || "";
    if (fraction.length > decimals) throw new Error("입력한 발행량의 소수점 자릿수가 설정값보다 많습니다.");
    const padded = (fraction + "0".repeat(decimals)).slice(0, decimals);
    const amount = BigInt(whole) * (10n ** BigInt(decimals)) + BigInt(padded || "0");
    const max = 18446744073709551615n;
    if (amount <= 0n || amount > max) throw new Error("총 발행량이 유효한 SPL 토큰 범위를 벗어났습니다.");
    return amount;
  }

  function normalizeSymbol(value) {
    return String(value || "").trim().toUpperCase().replace(/\s+/g, "");
  }

  let estimatedNetworkSol = NaN;
  let estimatedStorageSol = NaN;

  function updateEstimatedTotal() {
    const totalEl = document.getElementById("createTokenTotalCost");
    if (!totalEl) return;
    if (Number.isFinite(estimatedNetworkSol) && Number.isFinite(estimatedStorageSol)) {
      const total = estimatedNetworkSol + estimatedStorageSol;
      totalEl.textContent = total < 0.000001
        ? "<0.000001 SOL"
        : total.toFixed(6).replace(/0+$/, "").replace(/\.$/, "") + " SOL";
      return;
    }
    if (Number.isFinite(estimatedNetworkSol)) {
      totalEl.textContent = formatSol(estimatedNetworkSol * 1e9);
      return;
    }
    totalEl.textContent = "Calculated at signing";
  }

  function formatSol(lamports) {
    const value = Number(lamports || 0) / 1e9;
    if (!Number.isFinite(value)) return "Calculated at signing";
    if (value < 0.000001) return "<0.000001 SOL";
    return value.toFixed(6).replace(/0+$/, "").replace(/\.$/, "") + " SOL";
  }

  function solAmountToNumber(amount) {
    const basisPoints = amount?.basisPoints;
    if (basisPoints === undefined || basisPoints === null) return NaN;
    try {
      return Number(basisPoints) / 1e9;
    } catch {
      return NaN;
    }
  }

  function updateStorageCost(sol) {
    const el = document.getElementById("createTokenStorageCost");
    if (!el) return;
    if (!Number.isFinite(sol)) {
      estimatedStorageSol = NaN;
      el.textContent = "Calculated when uploaded";
      updateEstimatedTotal();
      return;
    }
    estimatedStorageSol = sol;
    el.textContent = sol < 0.000001
      ? "<0.000001 SOL"
      : sol.toFixed(6).replace(/0+$/, "").replace(/\.$/, "") + " SOL";
    updateEstimatedTotal();
  }

  function updateNetworkCost(lamports) {
    const networkEl = document.getElementById("createTokenNetworkCost");
    const totalEl = document.getElementById("createTokenTotalCost");
    estimatedNetworkSol = Number(lamports || 0) / 1e9;
    const formatted = formatSol(lamports);
    if (networkEl) networkEl.textContent = formatted;
    updateEstimatedTotal();
  }

  function bindLogoPreview() {
    const logoInput = document.getElementById("createTokenLogo");
    const logoPreview = document.getElementById("createTokenLogoPreview");
    if (!logoInput || !logoPreview || logoInput.dataset.bound) return;
    logoInput.dataset.bound = "1";

    logoInput.addEventListener("change", () => {
      const file = logoInput.files?.[0];
      if (!file) {
        logoPreview.removeAttribute("src");
        logoPreview.classList.remove("visible");
        updateStorageCost(NaN);
        return;
      }
      if (!/^image\/(png|jpeg|webp)$/.test(file.type)) {
        logoInput.value = "";
        logoPreview.removeAttribute("src");
        logoPreview.classList.remove("visible");
        setStatus("Please choose a PNG, JPG 또는 WEBP image.", "error");
        return;
      }
      if (file.size > 2 * 1024 * 1024) {
        logoInput.value = "";
        logoPreview.removeAttribute("src");
        logoPreview.classList.remove("visible");
        setStatus("로고 이미지는 2MB 이하이어야 합니다.", "error");
        return;
      }
      if (logoPreview.dataset.objectUrl) URL.revokeObjectURL(logoPreview.dataset.objectUrl);
      const objectUrl = URL.createObjectURL(file);
      logoPreview.dataset.objectUrl = objectUrl;
      logoPreview.src = objectUrl;
      logoPreview.classList.add("visible");
      setStatus("로고가 선택되었습니다. Phantom을 연결한 후 생성하세요.", "active");
      updateStorageCost(NaN);
    });
  }

  let metadataModulesPromise = null;

  async function loadMetadataModules() {
    if (!metadataModulesPromise) {
      metadataModulesPromise = Promise.all([
        import(UMI_CDN),
        import(UMI_DEFAULTS_CDN),
        import(UMI_WALLET_CDN),
        import(MPL_METADATA_CDN),
        import(MPL_TOOLBOX_CDN),
        import(BUFFER_CDN)
      ]).then(([umi, defaults, walletAdapters, metadata, toolbox, bufferModule]) => {
        if (!globalThis.Buffer && bufferModule?.Buffer) globalThis.Buffer = bufferModule.Buffer;
        return {
          umi,
          defaults,
          walletAdapters,
          metadata,
          toolbox
        };
      });
    }
    return metadataModulesPromise;
  }

  function createPhantomWalletAdapter(provider) {
    return {
      publicKey: provider.publicKey,
      signTransaction: async transaction => provider.signTransaction(transaction),
      signAllTransactions: async transactions => {
        if (typeof provider.signAllTransactions === "function") {
          return provider.signAllTransactions(transactions);
        }
        const signed = [];
        for (const transaction of transactions) {
          signed.push(await provider.signTransaction(transaction));
        }
        return signed;
      },
      signMessage: async message => {
        if (typeof provider.signMessage !== "function") {
          throw new Error("This wallet does not support message signing required for storage upload.");
        }
        const result = await provider.signMessage(message);
        return result?.signature || result;
      },
      sendTransaction: async (transaction, connection, options = {}) => {
        // Phantom's legacy provider may expose signAndSendTransaction rather
        // than sendTransaction. Irys needs a wallet adapter with a generic
        // sendTransaction method, so support both provider APIs.
        if (typeof provider.sendTransaction === "function") {
          const result = await provider.sendTransaction(transaction, connection, options);
          return result?.signature || result;
        }

        if (typeof provider.signAndSendTransaction === "function") {
          const result = await provider.signAndSendTransaction(transaction, options);
          return result?.signature || result;
        }

        if (typeof provider.signTransaction === "function" && connection?.sendRawTransaction) {
          const signed = await provider.signTransaction(transaction);
          return await connection.sendRawTransaction(signed.serialize(), options);
        }

        throw new Error("This wallet does not expose a compatible Solana transaction signing method for Irys storage.");
      }
    };
  }

  async function createUmiForWallet(provider) {
    const modules = await loadMetadataModules();
    const { createUmi } = modules.defaults;
    const { walletAdapterIdentity } = modules.walletAdapters;
    const { mplTokenMetadata } = modules.metadata;
    const { mplToolbox } = modules.toolbox;
    const wallet = createPhantomWalletAdapter(provider);
    const rpc = await getWorkingRpc();
    const umi = createUmi(rpc)
      .use(walletAdapterIdentity(wallet))
      .use(mplTokenMetadata())
      .use(mplToolbox());

    return {umi, modules};
  }

  function utf8(value) {
    return new TextEncoder().encode(String(value));
  }

  function concatBytes(...arrays) {
    const total = arrays.reduce((sum, a) => sum + a.length, 0);
    const out = new Uint8Array(total);
    let offset = 0;
    for (const a of arrays) {
      out.set(a, offset);
      offset += a.length;
    }
    return out;
  }

  function littleEndianNumber(value, bytes) {
    const out = new Uint8Array(bytes);
    let n = Number(value);
    for (let i = 0; i < bytes; i++) {
      out[i] = n & 255;
      n = Math.floor(n / 256);
    }
    return out;
  }

  function avscLong(value) {
    let n = Number(value);
    if (!Number.isSafeInteger(n) || n < 0) throw new Error("Invalid Irys tag length.");
    let m = n * 2;
    const out = [];
    do {
      let b = m % 128;
      m = Math.floor(m / 128);
      if (m) b |= 128;
      out.push(b);
    } while (m);
    return new Uint8Array(out);
  }

  function serializeIrysTags(tags) {
    if (!tags?.length) return new Uint8Array(0);
    const parts = [avscLong(tags.length)];
    for (const tag of tags) {
      const name = utf8(tag.name);
      const value = utf8(tag.value);
      parts.push(avscLong(name.length), name, avscLong(value.length), value);
    }
    parts.push(avscLong(0));
    return concatBytes(...parts);
  }

  async function sha256(bytes) {
    return new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
  }

  async function sha384(bytes) {
    return new Uint8Array(await crypto.subtle.digest("SHA-384", bytes));
  }

  async function irysDeepHash(data) {
    if (Array.isArray(data)) {
      let acc = await sha384(concatBytes(utf8("list"), utf8(String(data.length))));
      for (const item of data) {
        const child = await irysDeepHash(item);
        acc = await sha384(concatBytes(acc, child));
      }
      return acc;
    }

    const bytes = data instanceof Uint8Array ? data : utf8(data);
    const tag = concatBytes(utf8("blob"), utf8(String(bytes.length)));
    const taggedHash = concatBytes(await sha384(tag), await sha384(bytes));
    return sha384(taggedHash);
  }

  function toHex(bytes) {
    return Array.from(bytes, b => b.toString(16).padStart(2, "0")).join("");
  }

  async function createSignedIrysDataItem(provider, data, tags) {
    const owner = new Uint8Array(provider.publicKey.toBytes ? provider.publicKey.toBytes() : provider.publicKey.toBuffer());
    if (owner.length !== 32) throw new Error("Phantom public key has an invalid length.");

    const anchor = crypto.getRandomValues(new Uint8Array(32));
    const target = new Uint8Array(0);
    const rawTags = serializeIrysTags(tags);
    const rawData = data instanceof Uint8Array ? data : utf8(data);

    // ANS-104 stores an 8-byte tag count and 8-byte tag-byte-length
    // immediately before the serialized tag payload.
    const tagHeader = concatBytes(
      littleEndianNumber(tags.length, 8),
      littleEndianNumber(rawTags.length, 8)
    );

    // Irys Solana DataItem signature type 4.
    const signatureType = littleEndianNumber(4, 2);
    const header = concatBytes(
      signatureType,
      new Uint8Array([0]), // signature placeholder
      owner,
      new Uint8Array([0]), // no target
      new Uint8Array([1]), // anchor present
      anchor,
      rawTags,
      rawData
    );

    const signatureData = await irysDeepHash([
      utf8("dataitem"),
      utf8("1"),
      utf8("4"),
      owner,
      target,
      anchor,
      rawTags,
      rawData
    ]);

    // Irys HexInjectedSolanaSigner signs the ASCII hex representation.
    const message = utf8(toHex(signatureData));
    if (typeof provider.signMessage !== "function") {
      throw new Error("Phantom does not expose signMessage required for Irys storage.");
    }
    const signed = await provider.signMessage(message);
    const signature = new Uint8Array(signed?.signature ?? signed);
    if (signature.length !== 64) throw new Error("Phantom returned an invalid Irys signature.");

    const binary = concatBytes(
      signatureType,
      signature,
      owner,
      new Uint8Array([0]),
      new Uint8Array([1]),
      anchor,
      tagHeader,
      rawTags,
      rawData
    );

    return binary;
  }

  async function irysRequest(path, options = {}) {
    const response = await fetch("https://node1.irys.xyz" + path, {
      ...options,
      headers: {
        "x-irys-js-sdk-version": "web-direct",
        ...(options.headers || {})
      }
    });
    const text = await response.text();
    let data = text;
    try { data = text ? JSON.parse(text) : null; } catch {}
    if (!response.ok) {
      const message = typeof data === "string" ? data : (data?.message || data?.error || response.statusText);
      throw new Error("Irys request failed: " + response.status + " " + message);
    }
    return data;
  }

  async function createIrysWebClient(provider) {
    return {
      provider,
      address: provider.publicKey.toString()
    };
  }

  async function getIrysPrice(byteLength, tags, address) {
    const query = new URLSearchParams();
    query.set("address", address);
    for (const tag of (tags || [])) {
      query.append("tags", tag.name + "|" + tag.value);
    }
    return BigInt(String(await irysRequest("/price/solana/" + byteLength + "?" + query.toString())));
  }

  async function getIrysBalance(address) {
    const data = await irysRequest("/account/balance/solana?address=" + encodeURIComponent(address));
    return BigInt(String(data?.balance ?? "0"));
  }

  async function fundIrysIfNeeded(provider, amount, address) {
    if (amount <= 0n) return;
    const bundlerInfo = await irysRequest("/info");
    const destination = bundlerInfo?.addresses?.solana;
    if (!destination) throw new Error("Irys did not return a Solana funding address.");

    const rpc = await getWorkingRpc();
    const connection = new window.solanaWeb3.Connection(rpc, "confirmed");
    // The wallet popup can remain open long enough for a recent blockhash to expire.
    // Fetch the blockhash immediately before signing and rebuild the transaction if needed.
    for (let attempt = 1; attempt <= 2; attempt++) {
      const latest = await connection.getLatestBlockhash("confirmed");
      const transaction = new window.solanaWeb3.Transaction({
        recentBlockhash: latest.blockhash,
        feePayer: new window.solanaWeb3.PublicKey(address)
      }).add(
        window.solanaWeb3.SystemProgram.transfer({
          fromPubkey: new window.solanaWeb3.PublicKey(address),
          toPubkey: new window.solanaWeb3.PublicKey(destination),
          lamports: Number(amount)
        })
      );

      setStatus(
        attempt === 1
          ? "STEP 1/4 — Approve the Irys storage funding transaction in Phantom..."
          : "STEP 1/4 — The funding transaction expired. Refreshing it — please approve again...",
        "active"
      );

      try {
        const signed = await provider.signTransaction(transaction);
        const signature = await connection.sendRawTransaction(signed.serialize(), {
          skipPreflight: false,
          preflightCommitment: "confirmed",
          maxRetries: 0
        });
        await waitForConfirmation(connection, signature);

        await irysRequest("/account/balance/solana", {
          method: "POST",
          headers: {"content-type":"application/json"},
          body: JSON.stringify({tx_id: signature})
        });
        return;
      } catch (error) {
        if (attempt === 2 || !isBlockhashExpiredError(error)) throw error;
      }
    }
  }

  async function uploadToPermanentStorage(irys, provider, data, contentType, label) {
    const bytes = data instanceof Uint8Array ? data : utf8(data);
    // Upload without custom Irys tags. This keeps the ANS-104 DataItem minimal and avoids
    // browser-side tag encoding differences; Arweave/Irys still stores the payload permanently.
    const tags = [];

    // Exact ANS-104 DataItem size: header + signature + owner + target/anchor + tags + data.
    const itemSize = 2 + 64 + 32 + 1 + 1 + 32 + 16 + bytes.length;
    const price = await getIrysPrice(itemSize, tags, irys.address);
    if (price <= 0n) throw new Error(label + " storage price could not be calculated.");

    const currentBalance = await getIrysBalance(irys.address);
    if (currentBalance < price) {
      await fundIrysIfNeeded(provider, price - currentBalance, irys.address);
    }

    setStatus("STEP 2/4 — Sign " + label.toLowerCase() + " for permanent Arweave storage...", "active");
    const binary = await createSignedIrysDataItem(provider, bytes, tags);

    const response = await fetch("https://node1.irys.xyz/tx/solana", {
      method: "POST",
      headers: {
        "Content-Type": "application/octet-stream",
        "x-irys-js-sdk-version": "web-direct"
      },
      body: binary
    });

    const text = await response.text();
    let result = text;
    try { result = text ? JSON.parse(text) : null; } catch {}

    if (!response.ok) {
      const message = typeof result === "string" ? result : (result?.message || result?.error || response.statusText);
      throw new Error(label + " upload failed: " + response.status + " " + message);
    }

    const id = result?.id;
    if (!id) throw new Error(label + " upload completed without a storage ID.");
    return {
      uri: "https://arweave.net/" + id,
      atomicCost: price.toString()
    };
  }

  function isBlockhashExpiredError(error) {
    const message = String(error?.message || error || "").toLowerCase();
    return (
      message.includes("block height exceeded") ||
      message.includes("blockhash expired") ||
      message.includes("blockhash not found") ||
      message.includes("transactionexpiredblockheight")
    );
  }

  async function waitForConfirmation(connection, signature) {
    for (let i = 0; i < 40; i++) {
      const result = await connection.getSignatureStatuses([signature], {searchTransactionHistory:true});
      const status = result?.value?.[0];
      if (status?.err) {
        const detail = typeof status.err === "string" ? status.err : JSON.stringify(status.err);
        if (String(detail).toLowerCase().includes("blockhash")) {
          throw new Error("Transaction expired: blockhash is no longer valid.");
        }
        throw new Error("온체인 거래가 실패했습니다.");
      }
      if (status?.confirmationStatus === "confirmed" || status?.confirmationStatus === "finalized") return;
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    throw new Error("거래가 전송되었지만 확인 시간이 초과되었습니다. Solscan에서 확인해주세요.");
  }

  async function refreshCreationCost() {
    try {
      if (!window.solanaWeb3) return;
      const rpc = await getWorkingRpc();
      const connection = new window.solanaWeb3.Connection(rpc, "confirmed");
      const mintRent = await connection.getMinimumBalanceForRentExemption(82);
      const tokenAccountRent = await connection.getMinimumBalanceForRentExemption(165);
      const recentFee = await connection.getFeeForMessage(
        new window.solanaWeb3.TransactionMessage({
          payerKey: new window.solanaWeb3.PublicKey("11111111111111111111111111111111"),
          recentBlockhash: (await connection.getLatestBlockhash("confirmed")).blockhash,
          instructions: []
        }).compileToV0Message(),
        "confirmed"
      ).catch(() => null);

      updateNetworkCost(mintRent + tokenAccountRent + Number(recentFee?.value || 5000));
    } catch {
      const networkEl = document.getElementById("createTokenNetworkCost");
      const totalEl = document.getElementById("createTokenTotalCost");
      if (networkEl) networkEl.textContent = "Calculated at signing";
      if (totalEl) totalEl.textContent = "Calculated at signing";
    }
  }

  async function withTimeout(promise, ms, message) {
    let timer;
    try {
      return await Promise.race([
        promise,
        new Promise((_, reject) => {
          timer = setTimeout(() => reject(new Error(message)), ms);
        })
      ]);
    } finally {
      clearTimeout(timer);
    }
  }

  async function recoverCreatedTokenIfPresent(mintAddress, ataAddress, expectedAmount) {
    if (!window.solanaWeb3 || !mintAddress || !ataAddress) return false;

    const rpc = await getWorkingRpc();
    const connection = new window.solanaWeb3.Connection(rpc, "confirmed");

    for (let attempt = 0; attempt < 24; attempt++) {
      try {
        const mintInfo = await connection.getAccountInfo(
          new window.solanaWeb3.PublicKey(mintAddress),
          "confirmed"
        );

        if (mintInfo) {
          const balance = await connection.getTokenAccountBalance(
            new window.solanaWeb3.PublicKey(ataAddress),
            "confirmed"
          );
          const actualAmount = BigInt(balance?.value?.amount || "0");

          if (actualAmount === expectedAmount) return true;
        }
      } catch (error) {
        console.warn("Created-token recovery check failed:", error);
      }

      await new Promise(resolve => setTimeout(resolve, 1500));
    }

    return false;
  }

  async function verifyCreatedToken(mintAddress, ataAddress, expectedAmount) {
    if (!window.solanaWeb3) throw new Error("Solana Web3 library is not available for verification.");
    const rpc = await getWorkingRpc();
    const connection = new window.solanaWeb3.Connection(rpc, "confirmed");
    const mintInfo = await connection.getAccountInfo(new window.solanaWeb3.PublicKey(mintAddress), "confirmed");
    if (!mintInfo) throw new Error("Token mint was not found on Solana after confirmation.");

    const balance = await connection.getTokenAccountBalance(
      new window.solanaWeb3.PublicKey(ataAddress),
      "confirmed"
    );
    const actualAmount = BigInt(balance?.value?.amount || "0");
    if (actualAmount !== expectedAmount) {
      throw new Error("토큰 생성 transaction was confirmed, but the initial token balance could not be verified.");
    }
    return actualAmount;
  }

  async function createToken() {
    const logoInput = document.getElementById("createTokenLogo");
    const logoFile = logoInput?.files?.[0];
    const name = String(document.getElementById("createTokenName")?.value || "").trim();
    const symbol = normalizeSymbol(document.getElementById("createTokenSymbol")?.value);
    const supplyText = document.getElementById("createTokenSupply")?.value;
    const decimals = Number(document.getElementById("createTokenDecimals")?.value);
    const fixedSupply = !!document.getElementById("createTokenFixed")?.checked;
    const revokeFreeze = !!document.getElementById("createTokenRevokeFreeze")?.checked;

    if (!name) throw new Error("Enter a token name.");
    if (name.length > 32) throw new Error("토큰 이름은 32자 이하여야 합니다.");
    if (!/^[A-Z0-9]{1,6}$/.test(symbol)) throw new Error("심볼은 영문 대문자와 숫자를 1~6자까지 사용할 수 있습니다.");
    if (!Number.isInteger(decimals) || decimals < 0 || decimals > 9) throw new Error("소수점은 0~9 사이여야 합니다.");
    const amount = parseSupply(supplyText, decimals);

    if (!logoFile) throw new Error("토큰을 생성하기 전에 로고를 업로드해주세요.");
    if (!/^image\/(png|jpeg|webp)$/.test(logoFile.type)) throw new Error("Please choose a PNG, JPG 또는 WEBP image.");
    if (logoFile.size > 2 * 1024 * 1024) throw new Error("로고 이미지는 2MB 이하이어야 합니다.");

    const provider = typeof getPhantomProvider === "function" ? getPhantomProvider() : null;
    if (!provider?.publicKey) {
      setStatus("먼저 Phantom을 연결해주세요.", "error");
      if (typeof connectPhantom === "function") await connectPhantom();
      return;
    }

    if (!window.solanaWeb3) throw new Error("Solana Web3 라이브러리를 불러올 수 없습니다.");

    setStatus("1/4단계 — 영구 메타데이터 저장을 준비하는 중...", "active");
    const {umi, modules} = await createUmiForWallet(provider);
    const {createGenericFile, generateSigner, percentAmount, some, publicKey, sol} = modules.umi;
    const {createV1, TokenStandard} = modules.metadata;
    const {
      createMint,
      createTokenIfMissing,
      findAssociatedTokenPda,
      mintTokensTo,
      setAuthority,
      AuthorityType,
      transferSol
    } = modules.toolbox;

    const mint = generateSigner(umi);
    const imageBuffer = new Uint8Array(await logoFile.arrayBuffer());
    const imageFile = createGenericFile(imageBuffer, logoFile.name, {
      contentType: logoFile.type
    });

    const irys = await createIrysWebClient(provider);
    setStatus("1/4단계 — 로고를 영구 저장소에 업로드하는 중...", "active");

    const imageData = new Uint8Array(await logoFile.arrayBuffer());
    const imageUpload = await uploadToPermanentStorage(
      irys,
      provider,
      imageData,
      logoFile.type,
      "Logo"
    );
    const imageUri = imageUpload.uri;
    updateStorageCost(Number(imageUpload.atomicCost) / 1e9);

    const metadataJson = {
      name,
      symbol,
      description: name + " — created on GurugSwap",
      image: imageUri,
      properties: {
        files: [{uri: imageUri, type: logoFile.type}],
        category: "image"
      }
    };

    setStatus("2/4단계 — 토큰 메타데이터 JSON을 업로드하는 중...", "active");
    const metadataUpload = await uploadToPermanentStorage(
      irys,
      provider,
      JSON.stringify(metadataJson),
      "application/json",
      "Metadata"
    );
    const metadataUri = metadataUpload.uri;
    const totalStorageAtomic =
      BigInt(imageUpload.atomicCost) + BigInt(metadataUpload.atomicCost);
    updateStorageCost(Number(totalStorageAtomic) / 1e9);

    setStatus("3/4단계 — 토큰 생성 거래를 준비하는 중...", "active");

    const tokenBuilder = createMint(umi, {
      mint,
      decimals,
      mintAuthority: umi.identity.publicKey,
      freezeAuthority: revokeFreeze ? null : umi.identity.publicKey
    })
      .add(createV1(umi, {
        mint,
        authority: umi.identity,
        payer: umi.payer,
        updateAuthority: umi.identity.publicKey,
        name,
        symbol,
        uri: metadataUri,
        sellerFeeBasisPoints: percentAmount(0),
        tokenStandard: TokenStandard.Fungible,
        decimals: some(decimals),
        isMutable: true
      }))
      .add(
        createTokenIfMissing(umi, {
          mint: mint.publicKey,
          owner: umi.identity.publicKey
        }).add(
          mintTokensTo(umi, {
            mint: mint.publicKey,
            token: findAssociatedTokenPda(umi, {
              mint: mint.publicKey,
              owner: umi.identity.publicKey
            }),
            amount
          })
        )
      )
      .add(transferSol(umi, {
        source: umi.identity,
        destination: publicKey(GURUG_FEE_WALLET),
        amount: sol(0.5)
      }));

    const finalBuilder = fixedSupply
      ? tokenBuilder.add(
          setAuthority(umi, {
            authorityType: AuthorityType.MintTokens,
            newAuthority: null,
            owned: mint.publicKey,
            owner: umi.identity.publicKey
          })
        )
      : tokenBuilder;

    setStatus("3/4단계 — Phantom에서 실제 토큰 생성 거래를 승인해주세요...", "active");
    let result;
    let lastError = null;

    // Solana recent blockhashes normally remain valid for roughly 60–90 seconds.
    // If the wallet popup or RPC path takes too long, rebuild the transaction with
    // a fresh blockhash instead of making the user restart the entire token flow.
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        result = await withTimeout(
          finalBuilder.sendAndConfirm(umi, {send: {commitment: "confirmed", skipPreflight: true}}),
          180000,
          "토큰 생성 timed out. Check Phantom/Solscan before retrying."
        );
        lastError = null;
        break;
      } catch (error) {
        lastError = error;
        console.error("토큰 생성 transaction attempt " + attempt + " failed:", error);

        if (!isBlockhashExpiredError(error) || attempt === 2) break;

        // Before asking Phantom to sign again, check whether the mint already landed.
        const retryRpc = await getWorkingRpc();
        const retryConnection = new window.solanaWeb3.Connection(retryRpc, "confirmed");
        const existingMint = await retryConnection.getAccountInfo(
          new window.solanaWeb3.PublicKey(mint.publicKey.toString()),
          "confirmed"
        );
        if (existingMint) {
          result = {signature: null};
          lastError = null;
          break;
        }

        setStatus("STEP 3/4 — The token transaction expired. Refreshing it — please approve again...", "active");
      }
    }

    const mintAddress = mint.publicKey.toString();
    const ata = findAssociatedTokenPda(umi, {
      mint: mint.publicKey,
      owner: umi.identity.publicKey
    });
    const ataAddress = ata?.toString ? ata.toString() : String(ata);

    if (lastError) {
      // sendAndConfirm can time out even after Solana has accepted the transaction.
      // Never show a failure until the mint and expected ATA balance have been checked on-chain.
      setStatus("4/4단계 — 솔라나 블록체인에서 토큰을 확인하는 중...", "active");
      const recovered = await recoverCreatedTokenIfPresent(mintAddress, ataAddress, amount);

      if (!recovered) {
        console.error("토큰 생성 could not be recovered after client error:", lastError);
        throw new Error(lastError?.message || "토큰 생성 could not be confirmed on 토큰을 거래하세요. Check Solscan before retrying.");
      }

      console.warn("토큰 생성 recovered from client-side confirmation error:", lastError);
    }

    setStatus("4/4단계 — 토큰 민트와 초기 잔액을 확인하는 중...", "active");
    await verifyCreatedToken(mintAddress, ataAddress, amount);

    const solscan = "https://solscan.io/token/" + mintAddress;
    const account = "https://solscan.io/account/" + ataAddress;

    const resultEl = document.getElementById("createTokenResult");
    const addressEl = document.getElementById("createTokenMintAddress");
    const solscanEl = document.getElementById("createTokenSolscan");
    const accountEl = document.getElementById("createTokenAccount");
    const metadataEl = document.getElementById("createTokenMetadata");

    if (addressEl) addressEl.textContent = mintAddress;
    if (solscanEl) solscanEl.href = solscan;
    if (accountEl) accountEl.href = account;
    if (metadataEl) {
      metadataEl.href = metadataUri;
      metadataEl.hidden = false;
    }
    if (resultEl) resultEl.hidden = false;

    updateStorageCost(storageSol > 0 ? storageSol : NaN);
    setStatus("토큰 생성 완료 — 토큰, 메타데이터, 로고 및 초기 잔액이 확인되었습니다.", "success");
    window.dispatchEvent(new CustomEvent("gurug:token-created", { detail: { mintAddress, metadataUri, signature: result?.signature || null } }));
    return {mintAddress, metadataUri, signature: result?.signature || null};
  }

  function bind() {
    addStyle();
    addSection();
    bindLogoPreview();
    refreshCreationCost();

    const button = document.getElementById("createTokenButton");
    if (!button || button.dataset.bound) return;
    button.dataset.bound = "1";

    button.addEventListener("click", async () => {
      button.disabled = true;
      try {
        await createToken();
      } catch (err) {
        console.error("CREATE TOKEN failed:", err);
        setStatus(err?.message || "토큰 생성 failed or was cancelled.", "error");
      } finally {
        button.disabled = false;
      }
    });

    const copy = document.getElementById("createTokenCopy");
    if (copy) copy.addEventListener("click", async () => {
      const value = document.getElementById("createTokenMintAddress")?.textContent || "";
      if (!value || value === "—") return;
      try {
        await navigator.clipboard.writeText(value);
        copy.textContent = "복사 완료!";
        setTimeout(() => copy.textContent = "복사", 1400);
      } catch { alert(value); }
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bind, {once:true});
  } else {
    bind();
  }
})();
