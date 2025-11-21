/* ============================================================
   AUTO-DETECÇÃO DA API VIA server_status.json
============================================================ */

let API = null;

// Garante que nada roda antes da API carregar
async function esperarAPI() {
    while (!API) await new Promise(r => setTimeout(r, 50));
}

async function carregarAPI() {
    try {
        const r = await fetch("server_status.json?_=" + Date.now());
        const js = await r.json();

        API = js.url_api_base + "/api";

        console.log("🌐 API detectada:", API);

    } catch (e) {
        console.error("❌ Erro ao carregar server_status.json", e);
    }
}

await carregarAPI();


/* ============================================================
   STATUS DO SERVIDOR
============================================================ */

async function atualizarStatus() {
    await esperarAPI();
    try {
        const r = await fetch(API + "/status");
        const js = await r.json();

        document.getElementById("status-text").textContent = "Online";
        document.getElementById("status-dot").className = "status-dot online";

    } catch {
        document.getElementById("status-text").textContent = "Offline";
        document.getElementById("status-dot").className = "status-dot offline";
    }
}
setInterval(atualizarStatus, 5000);
atualizarStatus();


/* ============================================================
   MODAL DA PIRÂMIDE
============================================================ */

const modal = document.getElementById("class-modal-backdrop");
const btnEscolher = document.getElementById("btn-escolher-classe");
const modalClose = document.getElementById("modal-close");

let classeEscolhida = null;

btnEscolher.onclick = () => modal.classList.add("show");
modalClose.onclick = () => modal.classList.remove("show");

// Seleção dos blocos 3D da pirâmide
document.querySelectorAll(".pyramid-block").forEach(block => {
    block.addEventListener("click", () => {
        document.querySelectorAll(".pyramid-block").forEach(b => b.classList.remove("selected"));

        block.classList.add("selected");
        classeEscolhida = block.dataset.classe;

        modal.classList.remove("show");
        document.getElementById("btn-postar").disabled = false;
    });
});


/* ============================================================
   POSTAR INDIGNAÇÃO
============================================================ */

document.getElementById("btn-postar").onclick = async () => {
    await esperarAPI();

    const texto = document.getElementById("post-text").value.trim();
    if (!texto || !classeEscolhida) return;

    const r = await fetch(API + "/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ texto, classe: classeEscolhida })
    });

    const js = await r.json();

    if (js.error) {
        document.getElementById("post-error").textContent = js.error;
        return;
    }

    document.getElementById("post-text").value = "";
    classeEscolhida = null;

    carregarPosts();
};


/* ============================================================
   FEED
============================================================ */

async function carregarPosts() {
    await esperarAPI();

    const r = await fetch(API + "/posts");
    const posts = await r.json();

    const feed = document.getElementById("feed");
    feed.innerHTML = "";

    atualizarTrending(posts);

    posts.forEach(p => {
        const div = document.createElement("div");
        div.className = "post";

        div.innerHTML = `
            <div class="post-header">
                <div class="avatar" style="background:${p.cor_classe}">
                    ${p.avatar.emoji}
                </div>

                <div class="post-meta">
                    <div class="alias">${p.alias}</div>
                    <div class="meta-line">${new Date(p.created_at).toLocaleString()} — ${p.classe_label}</div>
                </div>
            </div>

            <div class="post-text">${p.texto}</div>

            <div class="post-actions">
                <button class="vote-btn up" data-id="${p.id}">👍 ${p.votos_up || 0}</button>
                <button class="vote-btn down" data-id="${p.id}">👎 ${p.votos_down || 0}</button>
                <button class="denunciar-btn" data-id="${p.id}">🚨 Denunciar</button>
            </div>

            <button class="secondary small-btn ver-respostas">Ver respostas (${p.replies_count})</button>

            <div class="reply-box" style="display:none;">
                <textarea class="reply-textarea" placeholder="Escreva sua resposta..."></textarea>
                <button class="primary responder-btn">Responder</button>
                <div class="replies"></div>
            </div>
        `;

        /* -----------------------------
           Toggle das respostas
        ----------------------------- */
        const btn = div.querySelector(".ver-respostas");
        const box = div.querySelector(".reply-box");

        btn.onclick = () => {
            box.style.display = box.style.display === "block" ? "none" : "block";

            if (box.style.display === "block") {
                box.classList.add("open-anim");
                carregarRespostas(p.id, div);
            }
        };

        /* -----------------------------
           Enviar resposta
        ----------------------------- */
        div.querySelector(".responder-btn").onclick = async () => {
            const t = div.querySelector(".reply-textarea").value.trim();
            if (!t) return;

            await fetch(API + `/posts/${p.id}/replies`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ texto: t, classe: p.classe })
            });

            div.querySelector(".reply-textarea").value = "";
            carregarRespostas(p.id, div);
        };

        /* -----------------------------
           Votação
        ----------------------------- */
        div.querySelector(".vote-btn.up").onclick = () => votar(p.id, "up");
        div.querySelector(".vote-btn.down").onclick = () => votar(p.id, "down");

        /* -----------------------------
           Denúncia
        ----------------------------- */
        div.querySelector(".denunciar-btn").onclick = () => denunciar(p.id);

        feed.appendChild(div);
    });
}


/* ============================================================
   RESPOSTAS
============================================================ */

async function carregarRespostas(id, element) {
    await esperarAPI();

    const r = await fetch(API + `/posts/${id}/replies`);
    const replies = await r.json();

    const box = element.querySelector(".replies");
    box.innerHTML = "";

    replies.forEach(rp => {
        const rdiv = document.createElement("div");
        rdiv.className = "reply";

        rdiv.innerHTML = `
            <div class="reply-header">
                <span class="reply-alias">${rp.alias}</span>
                <span class="meta-line">${new Date(rp.created_at).toLocaleString()}</span>
            </div>
            <div class="reply-text">${rp.texto}</div>
        `;

        box.appendChild(rdiv);
    });
}


/* ============================================================
   VOTOS
============================================================ */

async function votar(id, tipo) {
    await esperarAPI();

    await fetch(API + "/vote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, tipo })
    });

    carregarPosts();
}


/* ============================================================
   DENÚNCIA
============================================================ */

async function denunciar(id) {
    await esperarAPI();

    await fetch(API + "/denunciar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id })
    });

    alert("Obrigado! Nossa equipe analisará este post.");
}


/* ============================================================
   TRENDING — assuntos mais comentados
============================================================ */

function atualizarTrending(posts) {
    const trending = document.getElementById("trending");

    const contagem = {};

    posts.forEach(p => {
        const palavras = p.texto.split(/\s+/);
        palavras.forEach(w => {
            if (w.length > 5) {
                contagem[w] = (contagem[w] || 0) + 1;
            }
        });
    });

    const top = Object.entries(contagem)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 2)
        .map(t => `🔥 ${t[0]}`);

    trending.textContent = top.join("    •    ");
}


/* ============================================================
   MODAL DE AJUDA ( ? )
============================================================ */

const helpBtn = document.getElementById("help-btn");
const helpModal = document.getElementById("help-modal");
const helpClose = document.getElementById("help-close");

helpBtn.onclick = () => helpModal.classList.add("show");
helpClose.onclick = () => helpModal.classList.remove("show");


/* ============================================================
   START
============================================================ */

carregarPosts();
