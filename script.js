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

/* Botão com loading elegante */
function setButtonLoading(btn, isLoading, labelLoading = "Carregando...") {
    if (!btn) return;
    if (isLoading) {
        if (!btn.dataset.originalText) {
            btn.dataset.originalText = btn.textContent;
        }
        btn.textContent = labelLoading;
        btn.classList.add("is-loading");
        btn.disabled = true;
    } else {
        btn.classList.remove("is-loading");
        btn.disabled = false;
        if (btn.dataset.originalText) {
            btn.textContent = btn.dataset.originalText;
        }
    }
}

/* ===========================================
   TEMA CLARO / ESCURO
=========================================== */

const themeToggle = document.getElementById("theme-toggle");

function aplicarTemaInicial() {
    const salvo = localStorage.getItem("vozespiramide_tema") || "dark";
    document.body.dataset.theme = salvo;
    themeToggle.textContent = salvo === "dark" ? "☾" : "☀";
}

if (themeToggle) {
    aplicarTemaInicial();

    themeToggle.addEventListener("click", () => {
        const atual = document.body.dataset.theme === "dark" ? "light" : "dark";
        document.body.dataset.theme = atual;
        localStorage.setItem("vozespiramide_tema", atual);
        themeToggle.textContent = atual === "dark" ? "☾" : "☀";
    });
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

/* ação pendente: post ou reply */
let acaoPendente = null;

function abrirModalClasse() {
    classModal.classList.add("show");
}

function fecharModalClasse() {
    classModal.classList.remove("show");
}

modalClose.onclick = () => fecharModalClasse();

/* clicar fora fecha */
classModal.addEventListener("click", (e) => {
    if (e.target === classModal) fecharModalClasse();
});

/* seleção na pirâmide */
pyramidSvg.querySelectorAll("polygon[data-classe]").forEach(poly => {
    poly.addEventListener("click", () => {
        pyramidSvg.querySelectorAll("polygon[data-classe]").forEach(p => p.classList.remove("selected"));
        poly.classList.add("selected");
        classeEscolhida = poly.dataset.classe;

        fecharModalClasse();

        if (acaoPendente) {
            if (acaoPendente.tipo === "post") {
                enviarPost(acaoPendente.texto);
            } else if (acaoPendente.tipo === "reply") {
                enviarResposta(
                    acaoPendente.postId,
                    acaoPendente.texto,
                    acaoPendente.textarea,
                    acaoPendente.postEl
                );
            }
            acaoPendente = null;
        }
    });
});

/* ===========================================
   POSTAR
=========================================== */

const postText = document.getElementById("post-text");
const postError = document.getElementById("post-error");

async function enviarPost(texto) {
    if (!API) return alert("API não carregada.");

    setButtonLoading(btnPostar, true, "Postando...");

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
        carregarPosts();
    } catch {
        postError.textContent = "Erro ao postar";
    } finally {
        setButtonLoading(btnPostar, false);
    }
}

btnPostar.addEventListener("click", (e) => {
    e.preventDefault();
    const texto = postText.value.trim();

    if (!texto) {
        postError.textContent = "Digite algo.";
        return;
    }

    if (!classeEscolhida) {
        postError.textContent = "Escolha a classe.";
        acaoPendente = { tipo: "post", texto };
        abrirModalClasse();
        return;
    }

    enviarPost(texto);
});

/* ===========================================
   SISTEMA DE LIKES
=========================================== */

function getLikes() {
    return JSON.parse(localStorage.getItem("likes_piramide") || "{}");
}

function saveLikes(data) {
    localStorage.setItem("likes_piramide", JSON.stringify(data));
}

function toggleLike(postId, btn) {
    let likes = getLikes();

    if (!likes[postId]) likes[postId] = 0;

    if (btn.classList.contains("active")) {
        btn.classList.remove("active");
        likes[postId] = Math.max(0, likes[postId] - 1);
    } else {
        btn.classList.add("active");
        likes[postId] += 1;
    }

    saveLikes(likes);
    btn.innerHTML = `♥ Curtir (${likes[postId]})`;
}

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

        renderFeed(posts);
    } catch {
        feedEl.innerHTML = "Erro ao carregar.";
    }
}

function renderFeed(posts) {
    feedEl.innerHTML = "";

    let storedLikes = getLikes();

    posts.forEach(p => {
        const el = document.createElement("div");
        el.className = "post";

        let likeCount = storedLikes[p.id] || 0;

        el.innerHTML = `
            <div class="post-header">
                <div class="avatar" style="background:${p.cor_classe}">
                    ${p.avatar?.emoji || "😶"}
                </div>
                <div>
                    <div class="alias">${escapeHtml(p.alias)}</div>
                    <div class="meta-line">${new Date(p.created_at).toLocaleString("pt-BR")}</div>
                </div>
            </div>

            <div class="post-text">${highlightTags(p.texto)}</div>

            <div class="post-actions">
                <button class="like-btn ${likeCount > 0 ? "active" : ""}">
                    ♥ Curtir (${likeCount})
                </button>

                <button class="report-btn">
                    🚩 Denunciar
                </button>

                <button class="ver-respostas">
                    Ver respostas (${p.replies_count || 0})
                </button>
            </div>

            <div class="reply-box">
                <textarea class="reply-textarea" placeholder="Responder..."></textarea>
                <button class="primary-btn responder-btn">Enviar</button>
                <div class="replies"></div>
            </div>
        `;

        /* LIKE */
        const likeBtn = el.querySelector(".like-btn");
        likeBtn.addEventListener("click", () => toggleLike(p.id, likeBtn));

        /* DENÚNCIA */
        el.querySelector(".report-btn").addEventListener("click", () => {
            alert("Obrigado! Sua denúncia será analisada.");
        });

        /* RESPOSTAS */
        const btnToggle = el.querySelector(".ver-respostas");
        const box = el.querySelector(".reply-box");

        btnToggle.onclick = () => {
            const isOpen = box.style.display === "block";
            box.style.display = isOpen ? "none" : "block";
            if (!isOpen) carregarRespostas(p.id, el);
        };

        const replyBtn = el.querySelector(".responder-btn");
        const replyTextarea = el.querySelector(".reply-textarea");

        replyBtn.onclick = () => {
            const texto = replyTextarea.value.trim();
            if (!texto) return;

            if (!classeEscolhida) {
                acaoPendente = {
                    tipo: "reply",
                    texto,
                    postId: p.id,
                    textarea: replyTextarea,
                    postEl: el
                };
                abrirModalClasse();
                return;
            }

            enviarResposta(p.id, texto, replyTextarea, el);
        };

        feedEl.appendChild(el);
    });
}

async function enviarResposta(idPost, texto, textareaEl, postEl) {
    if (!API) return;

    const btn = postEl.querySelector(".responder-btn");
    setButtonLoading(btn, true, "Enviando...");

    try {
        const r = await fetch(`${API}/api/posts/${idPost}/replies`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ texto, classe: classeEscolhida })
        });

        const js = await r.json();

        if (js.error) {
            alert(js.error);
            return;
        }

        textareaEl.value = "";
        carregarRespostas(idPost, postEl);
    } catch {
        alert("Erro ao enviar resposta.");
    } finally {
        setButtonLoading(btn, false);
    }
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
                <div class="reply-alias">${escapeHtml(rp.alias)}</div>
                <div class="reply-text">${highlightTags(rp.texto)}</div>
            `;
            box.appendChild(d);
        });

        // atualizar contador na UI
        const btn = postEl.querySelector(".ver-respostas");
        btn.textContent = `Ver respostas (${replies.length})`;

    } catch {
        postEl.querySelector(".replies").innerHTML = "Erro.";
    }
}
