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
        API = js.url_api_base; // ex: https://wash-amanda-practice-interactions.trycloudflare.com

        console.log("API carregada:", API);

        atualizarStatus();
        carregarPosts();
    } catch (e) {
        console.error("Erro ao carregar API:", e);
        const st = document.getElementById("status-text");
        if (st) st.textContent = "Erro ao carregar API";
    }
}

/* CHAMAR CONFIG IMEDIATAMENTE */
carregarConfigAPI();

/* ===========================================
   UTILIDADES
=========================================== */

function escapeHtml(text) {
    if (!text) return "";
    return text.replace(/[&<>"']/g, (c) => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;"
    }[c]));
}

function highlightTags(text) {
    return escapeHtml(text).replace(
        /#([\p{L}\p{N}_-]+)/gu,
        '<span class="tag">#$1</span>'
    );
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
    if (themeToggle) {
        themeToggle.textContent = salvo === "dark" ? "☾" : "☀";
    }
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

        if (txt) txt.textContent = "Servidor Online";
        if (dot) dot.className = "status-dot online";
    } catch {
        if (txt) txt.textContent = "Servidor Offline";
        if (dot) dot.className = "status-dot offline";
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
// { tipo: "post", texto } ou { tipo: "reply", texto, postId, textarea, postEl }

function abrirModalClasse() {
    if (classModal) classModal.classList.add("show");
}

function fecharModalClasse() {
    if (classModal) classModal.classList.remove("show");
}

if (modalClose) {
    modalClose.onclick = () => fecharModalClasse();
}

if (classModal) {
    classModal.addEventListener("click", (e) => {
        if (e.target === classModal) fecharModalClasse();
    });
}

/* seleção na pirâmide */
if (pyramidSvg) {
    pyramidSvg.querySelectorAll("polygon[data-classe]").forEach(poly => {
        poly.addEventListener("click", () => {
            pyramidSvg.querySelectorAll("polygon[data-classe]").forEach(p =>
                p.classList.remove("selected")
            );
            poly.classList.add("selected");
            classeEscolhida = poly.dataset.classe;

            fecharModalClasse();

            // se tiver alguma ação pendente (post ou reply), executa agora
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
}

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
            if (postError) postError.textContent = js.error;
            return;
        }

        if (postText) postText.value = "";
        carregarPosts();
    } catch {
        if (postError) postError.textContent = "Erro ao postar";
    } finally {
        setButtonLoading(btnPostar, false);
    }
}

if (btnPostar) {
    btnPostar.addEventListener("click", (e) => {
        e.preventDefault();
        const texto = postText ? postText.value.trim() : "";

        if (!texto) {
            if (postError) postError.textContent = "Digite algo.";
            return;
        }

        if (!classeEscolhida) {
            if (postError) postError.textContent = "Escolha a classe.";
            acaoPendente = { tipo: "post", texto };
            abrirModalClasse();
            return;
        }

        enviarPost(texto);
    });
}

/* ===========================================
   SISTEMA DE LIKES (FRONT + LOCALSTORAGE)
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
    if (!API || !feedEl) return;

    feedEl.innerHTML = "Carregando...";

    try {
        const r = await fetch(`${API}/api/posts`);
        const posts = await r.json();

        if (!Array.isArray(posts)) {
            console.error("Formato inesperado de posts:", posts);
            throw new Error();
        }

        renderFeed(posts);
    } catch (err) {
        console.error("Erro ao carregar posts:", err);
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
        const reportBtn = el.querySelector(".report-btn");
        reportBtn.addEventListener("click", () => {
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
                if (postError) postError.textContent = "Escolha a classe para responder.";
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

/* ===========================================
   RESPOSTAS
=========================================== */

async function enviarResposta(idPost, texto, textareaEl, postEl) {
    if (!API) return alert("API não carregada.");

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
    } catch (err) {
        console.error("Erro ao enviar resposta:", err);
        alert("Erro ao enviar resposta.");
    } finally {
        setButtonLoading(btn, false);
    }
}

async function carregarRespostas(id, postEl) {
    try {
        const r = await fetch(`${API}/api/posts/${id}/replies`);
        let data = await r.json();

        // Aceita tanto [ ... ] quanto { replies: [ ... ] }
        let replies = Array.isArray(data) ? data :
            (Array.isArray(data.replies) ? data.replies : []);

        const box = postEl.querySelector(".replies");
        box.innerHTML = "";

        replies.forEach(rp => {
            const alias =
                rp.alias || rp.user || rp.nome || "Anônimo";
            const texto =
                rp.texto || rp.message || rp.msg || rp.reply_text || "";

            const d = document.createElement("div");
            d.className = "reply";
            d.innerHTML = `
                <div class="reply-alias">${escapeHtml(alias)}</div>
                <div class="reply-text">${highlightTags(texto)}</div>
            `;
            box.appendChild(d);
        });

        // atualizar contador no botão "Ver respostas"
        const btn = postEl.querySelector(".ver-respostas");
        btn.textContent = `Ver respostas (${replies.length})`;
    } catch (err) {
        console.error("Erro ao carregar respostas:", err);
        postEl.querySelector(".replies").innerHTML = "Erro ao carregar respostas.";
    }
}
