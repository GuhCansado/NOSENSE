const API = "/api";

/* ===========================================
   STATUS DO SERVIDOR
=========================================== */

async function atualizarStatus() {
    try {
        const r = await fetch(`${API}/status`);
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


/* ===========================================
   MODAL DA PIRÂMIDE
=========================================== */

const modal = document.getElementById("class-modal-backdrop");
const btnEscolher = document.getElementById("btn-escolher-classe");
const modalClose = document.getElementById("modal-close");
const btnPostar = document.getElementById("btn-postar");

let classeEscolhida = null;

btnEscolher.onclick = () => modal.classList.add("show");
modalClose.onclick = () => modal.classList.remove("show");

// Selecionar bloco da pirâmide
document.querySelectorAll("#pyramid-svg polygon[data-classe]").forEach(poly => {
    poly.addEventListener("click", () => {
        // Remove seleção antiga
        document.querySelectorAll("#pyramid-svg polygon").forEach(p => p.classList.remove("selected"));

        // Marca nova seleção
        poly.classList.add("selected");
        classeEscolhida = poly.dataset.classe;

        // Fecha modal
        modal.classList.remove("show");

        // Habilita botão postar
        btnPostar.disabled = false;
    });
});


/* ===========================================
   POSTAR INDIGNAÇÃO
=========================================== */

let bloqueandoPost = false;

btnPostar.onclick = async () => {
    const texto = document.getElementById("post-text").value.trim();
    const erro = document.getElementById("post-error");

    erro.textContent = "";

    if (!texto) {
        erro.textContent = "Digite algo antes de postar.";
        return;
    }

    if (!classeEscolhida) {
        erro.textContent = "Escolha sua posição na pirâmide.";
        return;
    }

    if (bloqueandoPost) return;
    bloqueandoPost = true;
    btnPostar.disabled = true;

    const r = await fetch(`${API}/posts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ texto, classe: classeEscolhida })
    });

    const js = await r.json();

    if (js.error) {
        erro.textContent = js.error;
        bloqueandoPost = false;
        btnPostar.disabled = false;
        return;
    }

    // Reset
    document.getElementById("post-text").value = "";
    classeEscolhida = null;
    bloqueandoPost = false;

    carregarPosts();
};


/* ===========================================
   FEED
=========================================== */

async function carregarPosts() {
    const feed = document.getElementById("feed");
    feed.innerHTML = `<div class="loading">Carregando...</div>`;

    const r = await fetch(`${API}/posts`);
    const posts = await r.json();

    feed.innerHTML = "";

    posts.forEach(p => {
        const div = document.createElement("div");
        div.className = "post";

        div.innerHTML = `
            <div style="display:flex; gap:12px; align-items:center;">
                <div class="avatar" style="background:${p.cor_classe}">
                    ${p.avatar.emoji}
                </div>

                <div>
                    <div class="alias">${p.alias}</div>
                    <div class="meta-line">${new Date(p.created_at).toLocaleString()} — ${p.classe_label}</div>
                </div>
            </div>

            <div class="post-text">${p.texto}</div>

            <button class="secondary small-btn ver-respostas">
                Ver respostas (${p.replies_count})
            </button>

            <div class="reply-box">
                <textarea class="reply-textarea" placeholder="Escreva sua resposta..."></textarea>
                <button class="primary responder-btn">Responder</button>
                <div class="replies"></div>
            </div>
        `;

        // Mostrar/ocultar caixa de respostas
        const btn = div.querySelector(".ver-respostas");
        const box = div.querySelector(".reply-box");

        btn.onclick = () => {
            if (box.style.display === "block") {
                box.style.display = "none";
            } else {
                box.style.display = "block";
                carregarRespostas(p.id, div);
            }
        };

        // Enviar resposta
        div.querySelector(".responder-btn").onclick = async () => {
            const textarea = div.querySelector(".reply-textarea");
            const texto = textarea.value.trim();
            if (!texto) return;

            textarea.disabled = true;

            await fetch(`${API}/posts/${p.id}/replies`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ texto, classe: p.classe })
            });

            textarea.value = "";
            textarea.disabled = false;

            carregarRespostas(p.id, div);
        };

        feed.appendChild(div);
    });
}

async function carregarRespostas(id, element) {
    const r = await fetch(`${API}/posts/${id}/replies`);
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

carregarPosts();


/* ===========================================
   AJUDA ( ? )
=========================================== */

const helpBtn = document.getElementById("help-btn");
const helpModal = document.getElementById("help-modal");
const helpClose = document.getElementById("help-close");

helpBtn.onclick = () => helpModal.classList.add("show");
helpClose.onclick = () => helpModal.classList.remove("show");
