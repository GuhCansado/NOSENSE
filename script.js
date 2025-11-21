/* ===========================================
    BUSCAR URL DA API NO GITHUB
=========================================== */

let API = null;

async function carregarConfigAPI() {
    try {
        const r = await fetch(
            "https://raw.githubusercontent.com/GuhCansado/NOSENSE/main/server_status.json"
        );

        const js = await r.json();
        API = js.url_api_base;

        console.log("API carregada:", API);

        atualizarStatus();
        carregarPosts();
    } catch (e) {
        console.error("Erro ao carregar API:", e);
        document.getElementById("status-text").textContent = "Erro ao carregar API";
    }
}

/* CHAMAR CONFIG IMEDIATAMENTE */
carregarConfigAPI();

/* ===========================================
   UTILIDADES
=========================================== */

function escapeHtml(text) {
    return text.replace(/[&<>"']/g, (c) => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;"
    }[c]));
}

function highlightTags(text) {
    return escapeHtml(text).replace(/#([\p{L}\p{N}_-]+)/gu, '<span class="tag">#$1</span>');
}

function extractTags(text) {
    const matches = text.match(/#([\p{L}\p{N}_-]+)/gu) || [];
    return matches.map(t => t.slice(1).toLowerCase());
}

/* ===========================================
   STATUS DO SERVIDOR
=========================================== */

async function atualizarStatus() {
    if (!API) return;

    const dot = document.getElementById("status-dot");
    const txt = document.getElementById("status-text");

    try {
        const r = await fetch(`${API}/api/status`);
        if (!r.ok) throw new Error();

        txt.textContent = "Servidor Online";
        dot.className = "status-dot online";
    } catch {
        txt.textContent = "Servidor Offline";
        dot.className = "status-dot offline";
    }
}

setInterval(() => API && atualizarStatus(), 5000);

/* ===========================================
   MODAL DA PIRÂMIDE
=========================================== */

const classModal = document.getElementById("class-modal-backdrop");
const btnEscolher = document.getElementById("btn-escolher-classe");
const modalClose = document.getElementById("modal-close");
const pyramidSvg = document.getElementById("pyramid-svg");
const btnPostar = document.getElementById("btn-postar");

let classeEscolhida = null;

btnEscolher.onclick = () => classModal.classList.add("show");
modalClose.onclick = () => classModal.classList.remove("show");

pyramidSvg.querySelectorAll("polygon[data-classe]").forEach(poly => {
    poly.addEventListener("click", () => {
        pyramidSvg.querySelectorAll("polygon[data-classe]").forEach(p => p.classList.remove("selected"));
        poly.classList.add("selected");
        classeEscolhida = poly.dataset.classe;
        classModal.classList.remove("show");
        btnPostar.disabled = false;
    });
});

/* ===========================================
   POSTAR
=========================================== */

const postText = document.getElementById("post-text");
const postError = document.getElementById("post-error");

btnPostar.onclick = async () => {
    if (!API) return alert("API não carregada.");

    const texto = postText.value.trim();
    if (!texto) return postError.textContent = "Digite algo.";
    if (!classeEscolhida) return postError.textContent = "Escolha a classe.";

    try {
        const r = await fetch(`${API}/api/posts`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ texto, classe: classeEscolhida })
        });

        const js = await r.json();

        if (js.error) {
            postError.textContent = js.error;
            return;
        }

        postText.value = "";
        classeEscolhida = null;
        carregarPosts();
    } catch {
        postError.textContent = "Erro ao postar";
    }
};

/* ===========================================
   FEED
=========================================== */

const feedEl = document.getElementById("feed");

async function carregarPosts() {
    if (!API) return;

    feedEl.innerHTML = "Carregando...";

    try {
        const r = await fetch(`${API}/api/posts`);
        const posts = await r.json();

        if (!Array.isArray(posts)) throw new Error();

        renderFeed(posts);
    } catch {
        feedEl.innerHTML = "Erro ao carregar.";
    }
}

function renderFeed(posts) {
    feedEl.innerHTML = "";

    posts.forEach(p => {
        const el = document.createElement("div");
        el.className = "post";

        el.innerHTML = `
            <div class="post-header">
                <div class="avatar" style="background:${p.cor_classe}">
                    ${p.avatar?.emoji}
                </div>
                <div>
                    <div class="alias">${p.alias}</div>
                    <div class="meta-line">${new Date(p.created_at).toLocaleString("pt-BR")}</div>
                </div>
            </div>

            <div class="post-text">${highlightTags(p.texto)}</div>

            <button class="secondary small-btn ver-respostas">
                Ver respostas (${p.replies_count})
            </button>

            <div class="reply-box">
                <textarea class="reply-textarea" placeholder="Responder..."></textarea>
                <button class="primary small-btn responder-btn">Enviar</button>
                <div class="replies"></div>
            </div>
        `;

        // toggle respostas
        const btnToggle = el.querySelector(".ver-respostas");
        const box = el.querySelector(".reply-box");

        btnToggle.onclick = () => {
            box.style.display = box.style.display === "block" ? "none" : "block";
            if (box.style.display === "block") carregarRespostas(p.id, el);
        };

        feedEl.appendChild(el);
    });
}

async function carregarRespostas(id, postEl) {
    try {
        const r = await fetch(`${API}/api/posts/${id}/replies`);
        const replies = await r.json();

        const box = postEl.querySelector(".replies");
        box.innerHTML = "";

        replies.forEach(rp => {
            const d = document.createElement("div");
            d.className = "reply";
            d.innerHTML = `
                <div class="reply-alias">${rp.alias}</div>
                <div class="reply-text">${highlightTags(rp.texto)}</div>
            `;
            box.appendChild(d);
        });
    } catch {
        postEl.querySelector(".replies").innerHTML = "Erro.";
    }
}
