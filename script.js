const API = "/api";

/* ===========================================
   STATUS DO SERVIDOR
=========================================== */

async function atualizarStatus() {
    try {
        const r = await fetch(API + "/status");
        if (!r.ok) throw new Error();
        const js = await r.json();

        document.getElementById("status-text").textContent = "Online";
        document.getElementById("status-dot").className = "status-dot online";
        document.getElementById("version-text").textContent =
            "API: " + (js.version || "--");
    } catch {
        document.getElementById("status-text").textContent = "Offline";
        document.getElementById("status-dot").className = "status-dot offline";
        document.getElementById("version-text").textContent = "API: --";
    }
}

setInterval(atualizarStatus, 5000);
atualizarStatus();

/* ===========================================
   MODAL DA PIRÂMIDE
=========================================== */

const classModal = document.getElementById("class-modal-backdrop");
const btnEscolher = document.getElementById("btn-escolher-classe");
const modalClose = document.getElementById("modal-close");
const pyramidSvg = document.getElementById("pyramid-svg");

let classeEscolhida = null;

btnEscolher.onclick = () => {
    classModal.classList.add("show");
};

modalClose.onclick = () => {
    classModal.classList.remove("show");
};

pyramidSvg.querySelectorAll("polygon[data-classe]").forEach(poly => {
    poly.addEventListener("click", () => {
        // limpa seleção
        pyramidSvg.querySelectorAll("polygon[data-classe]")
            .forEach(p => p.classList.remove("selected"));

        poly.classList.add("selected");
        classeEscolhida = poly.dataset.classe;

        classModal.classList.remove("show");
        document.getElementById("btn-postar").disabled = false;
    });
});

/* ===========================================
   AJUDA ( ? )
=========================================== */

const helpBtn = document.getElementById("help-btn");
const helpModal = document.getElementById("help-modal");
const helpClose = document.getElementById("help-close");

helpBtn.onclick = () => helpModal.classList.add("show");
helpClose.onclick = () => helpModal.classList.remove("show");

helpModal.addEventListener("click", (e) => {
    if (e.target === helpModal) helpModal.classList.remove("show");
});

/* ===========================================
   POSTAR INDIGNAÇÃO
=========================================== */

const postTextEl = document.getElementById("post-text");
const btnPostar = document.getElementById("btn-postar");
const postErrorEl = document.getElementById("post-error");
const feedEl = document.getElementById("feed");
const feedEmptyEl = document.getElementById("feed-empty");
const btnRecarregar = document.getElementById("btn-recarregar");

btnPostar.onclick = async () => {
    const texto = postTextEl.value.trim();
    postErrorEl.style.display = "none";
    postErrorEl.textContent = "";

    if (!texto) {
        postErrorEl.textContent = "Escreva algo antes de postar.";
        postErrorEl.style.display = "block";
        return;
    }

    if (!classeEscolhida) {
        postErrorEl.textContent = "Escolha sua posição na pirâmide.";
        postErrorEl.style.display = "block";
        return;
    }

    btnPostar.disabled = true;

    try {
        const r = await fetch(API + "/posts", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ texto, classe: classeEscolhida })
        });

        const js = await r.json();

        if (!r.ok || js.error) {
            throw new Error(js.error || "Erro ao criar postagem.");
        }

        postTextEl.value = "";
        classeEscolhida = null;
        pyramidSvg.querySelectorAll("polygon[data-classe]")
            .forEach(p => p.classList.remove("selected"));
        btnPostar.disabled = true;

        await carregarPosts();

    } catch (err) {
        postErrorEl.textContent = err.message || "Erro ao conectar ao servidor.";
        postErrorEl.style.display = "block";
    } finally {
        btnPostar.disabled = false;
    }
};

/* ===========================================
   FEED + TÓPICOS EM ALTA
=========================================== */

btnRecarregar.onclick = () => carregarPosts();

function escapeHtml(text) {
    return text.replace(/[&<>"']/g, (c) => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"
    }[c]));
}

/**
 * Extrai hashtags (#algo) de um texto.
 */
function extrairTags(texto) {
    const tags = [];
    const regex = /#([\p{L}\p{N}_]+)/gu;
    let m;
    while ((m = regex.exec(texto)) !== null) {
        tags.push(m[1].toLowerCase());
    }
    return tags;
}

async function carregarPosts() {
    try {
        const r = await fetch(API + "/posts");
        if (!r.ok) throw new Error("Erro ao buscar posts.");
        const posts = await r.json();

        renderFeed(posts);
        atualizarTrending(posts);
    } catch (err) {
        console.error(err);
    }
}

function atualizarTrending(posts) {
    const tagsContainer = document.getElementById("trending-tags");
    tagsContainer.innerHTML = "";

    const contagem = {};

    posts.forEach(p => {
        extrairTags(p.texto || "").forEach(tag => {
            contagem[tag] = (contagem[tag] || 0) + 1;
        });
    });

    const tagsOrdenadas = Object.entries(contagem)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 2);

    if (tagsOrdenadas.length === 0) {
        const span = document.createElement("span");
        span.className = "trending-tag muted";
        span.textContent = "Nenhum assunto em alta ainda.";
        tagsContainer.appendChild(span);
        return;
    }

    tagsOrdenadas.forEach(([tag, count]) => {
        const span = document.createElement("span");
        span.className = "trending-tag";
        span.textContent = `🔥 #${tag} (${count})`;
        tagsContainer.appendChild(span);
    });
}

function renderFeed(posts) {
    feedEl.innerHTML = "";

    if (!posts || posts.length === 0) {
        feedEmptyEl.style.display = "block";
        return;
    }

    feedEmptyEl.style.display = "none";

    posts.forEach(p => {
        const div = document.createElement("div");
        div.className = "post";
        div.dataset.postId = p.id;

        const up = p.upvotes || 0;
        const down = p.downvotes || 0;

        div.innerHTML = `
            <div class="post-header">
                <div class="avatar" style="background:${p.cor_classe || "#111827"}">
                    ${p.avatar?.emoji || "🙂"}
                </div>
                <div class="post-meta">
                    <div class="alias">${escapeHtml(p.alias || "Anônimo")}</div>
                    <div class="meta-line">
                        ${new Date(p.created_at).toLocaleString("pt-BR")} •
                        ${escapeHtml(p.classe_label || "")}
                    </div>
                </div>
            </div>

            <div class="post-text">${escapeHtml(p.texto || "")}</div>

            <div class="post-actions">
                <div class="actions-left">
                    <button class="vote-btn vote-up" title="Concordo / apoio">
                        👍 <span class="count">${up}</span>
                    </button>
                    <button class="vote-btn vote-down" title="Não faz sentido / discordo">
                        👎 <span class="count">${down}</span>
                    </button>
                </div>
                <div class="actions-right">
                    <button class="flag-btn" title="Denunciar abuso / conteúdo impróprio">
                        🚩 Denunciar
                    </button>
                    <button class="secondary small-btn ver-respostas">
                        Ver respostas (${p.replies_count || 0})
                    </button>
                </div>
            </div>

            <div class="reply-box">
                <textarea class="reply-textarea" placeholder="Escreva sua resposta..."></textarea>
                <div style="margin-top:6px; display:flex; gap:6px; align-items:center;">
                    <button class="primary responder-btn">Responder</button>
                    <div class="error-msg reply-error" style="display:none;"></div>
                </div>
                <div class="replies"></div>
            </div>
        `;

        // Botão Ver respostas (abre/fecha box e carrega replies)
        const btnVer = div.querySelector(".ver-respostas");
        const replyBox = div.querySelector(".reply-box");

        btnVer.addEventListener("click", async () => {
            const opened = replyBox.style.display === "block";
            replyBox.style.display = opened ? "none" : "block";
            btnVer.textContent = opened
                ? `Ver respostas (${p.replies_count || 0})`
                : `Esconder respostas`;
            if (!opened) {
                await carregarRespostas(p.id, div);
            }
        });

        // Enviar resposta
        const btnResponder = div.querySelector(".responder-btn");
        const replyTA = div.querySelector(".reply-textarea");
        const replyError = div.querySelector(".reply-error");

        btnResponder.addEventListener("click", async () => {
            const texto = replyTA.value.trim();
            replyError.style.display = "none";
            replyError.textContent = "";

            if (!texto) {
                replyError.textContent = "Digite algo antes de responder.";
                replyError.style.display = "block";
                return;
            }

            try {
                const r = await fetch(API + `/posts/${p.id}/replies`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ texto, classe: p.classe })
                });

                const js = await r.json();
                if (!r.ok || js.error) {
                    throw new Error(js.error || "Erro ao responder.");
                }

                replyTA.value = "";
                await carregarRespostas(p.id, div);
                await carregarPosts(); // atualiza contagem de replies no cabeçalho
            } catch (err) {
                replyError.textContent = err.message || "Erro ao conectar.";
                replyError.style.display = "block";
            }
        });

        // Votos
        const btnUp = div.querySelector(".vote-up");
        const btnDown = div.querySelector(".vote-down");

        btnUp.addEventListener("click", () => enviarVoto(p.id, "up", div));
        btnDown.addEventListener("click", () => enviarVoto(p.id, "down", div));

        // Denúncia
        const flagBtn = div.querySelector(".flag-btn");
        flagBtn.addEventListener("click", () => enviarDenuncia(p.id, flagBtn));

        feedEl.appendChild(div);
    });
}

async function carregarRespostas(postId, postElement) {
    try {
        const r = await fetch(API + `/posts/${postId}/replies`);
        if (!r.ok) throw new Error();
        const replies = await r.json();

        const box = postElement.querySelector(".replies");
        box.innerHTML = "";

        if (!replies || replies.length === 0) {
            box.innerHTML = `<div class="empty-state" style="padding:4px 0;">Nenhuma resposta ainda.</div>`;
            return;
        }

        replies.forEach(rp => {
            const rdiv = document.createElement("div");
            rdiv.className = "reply";

            rdiv.innerHTML = `
                <div class="reply-header">
                    <div class="reply-alias">${escapeHtml(rp.alias || "Anônimo")}</div>
                    <div class="meta-line">
                        ${new Date(rp.created_at).toLocaleString("pt-BR")}
                    </div>
                </div>
                <div class="reply-text">${escapeHtml(rp.texto || "")}</div>
            `;

            box.appendChild(rdiv);
        });
    } catch {
        const box = postElement.querySelector(".replies");
        box.innerHTML = `<div class="error-msg">Erro ao carregar respostas.</div>`;
    }
}

/* ===========================================
   VOTOS / DENÚNCIAS
   (espera rotas no backend:
    POST /api/posts/<id>/vote  {tipo:"up"|"down"}
    POST /api/posts/<id>/denunciar {motivo}
   )
=========================================== */

async function enviarVoto(postId, tipo, postElement) {
    try {
        const r = await fetch(API + `/posts/${postId}/vote`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ tipo })
        });

        const js = await r.json();
        if (!r.ok || js.error) {
            throw new Error(js.error || "Erro ao votar.");
        }

        const upCount = postElement.querySelector(".vote-up .count");
        const downCount = postElement.querySelector(".vote-down .count");
        if (typeof js.upvotes === "number") upCount.textContent = js.upvotes;
        if (typeof js.downvotes === "number") downCount.textContent = js.downvotes;

        // highlight simples (lado do voto)
        const btnUp = postElement.querySelector(".vote-up");
        const btnDown = postElement.querySelector(".vote-down");
        btnUp.classList.remove("active-up");
        btnDown.classList.remove("active-down");

        if (tipo === "up") btnUp.classList.add("active-up");
        if (tipo === "down") btnDown.classList.add("active-down");

    } catch (err) {
        console.error("Erro voto:", err.message);
    }
}

async function enviarDenuncia(postId, flagBtn) {
    const motivo = prompt("Explique rapidamente o motivo da denúncia (opcional):") || "sem motivo detalhado";

    try {
        const r = await fetch(API + `/posts/${postId}/denunciar`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ motivo })
        });

        const js = await r.json();
        if (!r.ok || js.error) {
            throw new Error(js.error || "Erro ao denunciar.");
        }

        flagBtn.classList.add("active-flag");
        flagBtn.textContent = "🚩 Denunciado";

    } catch (err) {
        console.error("Erro denúncia:", err.message);
    }
}

/* ===========================================
   Inicialização
=========================================== */

carregarPosts();

// Atualização periódica (simulação de "tempo real")
setInterval(() => {
    carregarPosts();
}, 15000);
