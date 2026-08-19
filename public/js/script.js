// ==========================================
// 1. CONFIGURAÇÃO GERAL
// ==========================================
let configSistema = {
    chavePix: "",
    nomePix: "",
    cidadePix: "",
    metaMensal: 0
};

const firebaseConfig = {
  apiKey: "AIzaSyCpNsnwOVDLSZfXn-g6SE1V69BXHs8cYEc",
  authDomain: "mainhasite.firebaseapp.com",
  databaseURL: "https://mainhasite-default-rtdb.firebaseio.com",
  projectId: "mainhasite",
  storageBucket: "mainhasite.firebasestorage.app",
  messagingSenderId: "11190400668",
  appId: "1:11190400668:web:b59e8c134fbaee3e121f59"
};

if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
const db = firebase.database();
const auth = firebase.auth(); 

// Estado Global
let store = {
    servicos: [],
    clientes: [],
    atendimentos: [],
    despesas: [],
    estoque: [], 
    profissionais: [],
    carrinho: []
};

// Variáveis de Controle
let chartTop = null;
let chartSemana = null;
let idDespesaEdicao = null;
let idServicoEdicao = null;
let idAtendimentoEdicao = null; 
let idProdutoEdicao = null; 
let idClienteEdicao = null; 
let idProfissionalEdicao = null; 
let clienteAnamneseAtual = null;

// Controle de Item Pendente (Novo Preço)
let itemPendente = null;

// Controle de Carregamento (HTML Modular)
let htmlCarregado = false;
let usuarioLogado = null;
let sistemaIniciado = false; // Evita rodar inicializarSistema 2x

// ==========================================
// 2. CONTROLE DE INICIALIZAÇÃO (NOVO)
// ==========================================

// Escuta o evento que vem do index.html quando os arquivos .html terminam de carregar
document.addEventListener('sistemaPronto', () => {
    console.log("DOM Modular carregado.");
    htmlCarregado = true;
    
    // Inicia efeitos visuais
    lucide.createIcons();
    initRippleEffect();
    
    // Configura data do header
    const options = { weekday: 'long', day: 'numeric', month: 'long' };
    const dateEl = document.getElementById("data-hoje");
    if(dateEl) dateEl.innerText = new Date().toLocaleDateString('pt-BR', options);

    tentarIniciarSistema();
});

// Listener de Autenticação do Firebase
auth.onAuthStateChanged((user) => {
    const loader = document.getElementById("loader-overlay");
    
    if (user) {
        console.log("Logado como:", user.email);
        usuarioLogado = user;

        if(document.getElementById("user-email-display")) {
            document.getElementById("user-email-display").innerText = user.email;
        }

        // Esconde loader
        if(loader) {
            loader.style.opacity = '0';
            setTimeout(() => loader.style.display = 'none', 500);
        }

        // Verifica se precisa fechar login
        const deviceOverlay = document.getElementById('device-selection');
        if (deviceOverlay && deviceOverlay.style.display === 'none') {
            document.getElementById("login-overlay").style.display = 'none';
        }

        tentarIniciarSistema();

    } else {
        usuarioLogado = null;
        sistemaIniciado = false; // Reseta flag se deslogar
        
        if(loader) {
            loader.style.opacity = '0';
            setTimeout(() => loader.style.display = 'none', 500);
        }
    }
});

function tentarIniciarSistema() {
    if (htmlCarregado && usuarioLogado && !sistemaIniciado) {
        console.log("Iniciando lógica do sistema...");
        sistemaIniciado = true;
        initAgenda(); // Configura o input date da agenda
        inicializarSistema(); // Conecta com o Firebase
        
        // Define a data inicial do PDV como hoje
        const inputPDV = document.getElementById("pdv-data");
        if(inputPDV) inputPDV.value = new Date().toISOString().split('T')[0];
    }
}

// ==========================================
// 3. LÓGICA DE SELEÇÃO DE DISPOSITIVO
// ==========================================
function escolherDispositivo(tipo) {
    const overlay = document.getElementById('device-selection');
    if (tipo === 'mobile') {
        document.body.classList.add('mobile-mode');
        setTimeout(() => lucide.createIcons(), 100);
    }
    overlay.style.opacity = '0';
    setTimeout(() => {
        overlay.style.display = 'none';
        if (!auth.currentUser) {
            document.getElementById('login-overlay').style.display = 'flex';
        }
    }, 300);
}

// ==========================================
// 4. FUNÇÕES DO SISTEMA
// ==========================================

function verificarSenha() {
    const email = document.getElementById("input-email").value.trim();
    const senha = document.getElementById("input-senha").value;
    const btn = document.querySelector('.btn-glow');
    const erro = document.getElementById("erro-senha");
    
    if(!email || !senha) {
        erro.style.display = "block";
        erro.innerText = "Preencha e-mail e senha";
        return;
    }
    btn.innerText = "CONECTANDO...";
    
    auth.signInWithEmailAndPassword(email, senha)
        .then(() => {
            btn.innerText = "SUCESSO!";
            erro.style.display = "none";
            document.getElementById("login-overlay").style.display = 'none';
        })
        .catch((error) => {
            erro.style.display = "block";
            erro.innerText = "Erro ao acessar.";
            btn.innerText = "ENTRAR";
        });
}

function logout() {
    auth.signOut().then(() => {
        location.reload();
    });
}

function resetarSistema() {
    const user = auth.currentUser;
    if (!user) {
        alert("Você precisa estar logado para fazer isso.");
        return;
    }
    const senhaLogin = prompt("⚠️ PERIGO: Esta ação apagará TODOS os dados.\n\nPara confirmar, digite sua SENHA DE LOGIN:");
    if (!senhaLogin) return; 

    const credencial = firebase.auth.EmailAuthProvider.credential(user.email, senhaLogin);

    user.reauthenticateWithCredential(credencial)
        .then(() => {
            if (confirm("⚠️ ÚLTIMA CHANCE: Tem certeza absoluta que deseja zerar o sistema?")) {
                db.ref('/').set(null)
                    .then(() => {
                        alert("♻️ Sistema resetado com segurança!");
                        location.reload();
                    })
                    .catch((erro) => {
                        console.error(erro);
                        alert("Erro ao apagar dados: " + erro.message);
                    });
            }
        })
        .catch((error) => {
            console.error("Erro de autenticação:", error);
            alert("⛔ Senha incorreta! Ação bloqueada por segurança.");
        });
}

function fazerBackup() {
    if (typeof XLSX === 'undefined') {
        alert("Erro: Biblioteca Excel não carregada.");
        return;
    }

    const wb = XLSX.utils.book_new(); 
    const dataHoje = new Date().toISOString().split('T')[0];

    // --- ABA 1: CLIENTES ---
    const dadosClientes = store.clientes.map(c => ({
        "Nome": c.nome,
        "Telefone": c.telefone,
        "Pontos Fidelidade": c.pontos || 0,
        "Última Visita": formatarData(c.ultimaVisita),
        "Previsão Retorno": formatarData(c.previsaoRetorno),
        "Data Cadastro": c.dataCadastro ? formatarData(c.dataCadastro.split('T')[0]) : '-'
    }));
    const wsClientes = XLSX.utils.json_to_sheet(dadosClientes);
    XLSX.utils.book_append_sheet(wb, wsClientes, "Clientes VIP");

    // --- ABA 2: VENDAS (ATENDIMENTOS) ---
    const dadosVendas = store.atendimentos.map(a => ({
        "Data": formatarData(a.data),
        "Hora": a.hora,
        "Cliente": a.nomeCliente,
        "Profissional": a.nomeProfissional || "-",
        "Itens Vendidos": a.servicos ? a.servicos.map(s => s.nome).join(", ") : "",
        "Total (R$)": a.total,
        "Forma Pagto": a.pagamento,
        "Observações": a.obs
    }));
    const wsVendas = XLSX.utils.json_to_sheet(dadosVendas);
    XLSX.utils.book_append_sheet(wb, wsVendas, "Relatório Vendas");

    // --- ABA 3: ESTOQUE ---
    const dadosEstoque = store.estoque.map(e => ({
        "Produto": e.nome,
        "Quantidade Atual": e.qtd,
        "Preço Venda (R$)": e.preco
    }));
    const wsEstoque = XLSX.utils.json_to_sheet(dadosEstoque);
    XLSX.utils.book_append_sheet(wb, wsEstoque, "Controle Estoque");

    // --- ABA 4: DESPESAS ---
    const dadosDespesas = store.despesas.map(d => ({
        "Data": formatarData(d.data),
        "Descrição": d.descricao,
        "Categoria": d.categoria,
        "Valor (R$)": d.valor
    }));
    const wsDespesas = XLSX.utils.json_to_sheet(dadosDespesas);
    XLSX.utils.book_append_sheet(wb, wsDespesas, "Despesas");

    // --- ABA 5: PROFISSIONAIS ---
    const dadosProfissionais = store.profissionais.map(p => ({
        "Nome": p.nome,
        "Especialidade": p.especialidade || "-",
        "Telefone": p.telefone || "-"
    }));
    const wsProfissionais = XLSX.utils.json_to_sheet(dadosProfissionais);
    XLSX.utils.book_append_sheet(wb, wsProfissionais, "Profissionais");

    // --- DOWNLOAD ---
    XLSX.writeFile(wb, `Gestao_CassiaNunes_${dataHoje}.xlsx`);
    dispararToast("📁 Planilha Excel gerada e baixada!");
}

function initRippleEffect() {
    document.addEventListener('click', function (e) {
        const target = e.target.closest('.btn-primary, .btn-glow, .btn-checkout, .btn-danger, .device-option, .nav-item, .mobile-nav-item');
        if (target) {
            const ripple = document.createElement('span');
            ripple.classList.add('ripple');
            const rect = target.getBoundingClientRect();
            const size = Math.max(rect.width, rect.height);
            ripple.style.width = ripple.style.height = `${size}px`;
            ripple.style.left = `${e.clientX - rect.left - size / 2}px`;
            ripple.style.top = `${e.clientY - rect.top - size / 2}px`;
            target.appendChild(ripple);
            setTimeout(() => ripple.remove(), 600);
        }
    });
}

function inicializarSistema() {
    console.log("Conectando Listeners do Firebase...");
    
    // CARREGAR CONFIGURAÇÕES
    db.ref('config').on('value', snap => {
        if(snap.val()) {
            configSistema = snap.val();
        }
    });
    
    db.ref('servicos').on('value', snap => {
        store.servicos = snap.val() ? Object.values(snap.val()) : [];
        renderServicosPDV();
        renderListaServicosCad();
    });

    db.ref('clientes').on('value', snap => {
        store.clientes = snap.val() ? Object.values(snap.val()) : [];
        renderClientesPDV();
        renderTabelaClientes();
        atualizarKPIs();
        filtrarRetornosDashboard();
    });

    db.ref('atendimentos').on('value', snap => {
        store.atendimentos = snap.val() ? Object.values(snap.val()) : [];
        atualizarKPIs();
        renderTabelaFinanceiro();
        atualizarGraficos(); 
        renderAgenda();
        
        // --- NOVO: CHECA SE TEM GENTE PARA AMANHÃ ---
        verificarNotificacoes(); 
    });

    db.ref('despesas').on('value', snap => {
        store.despesas = snap.val() ? Object.values(snap.val()) : [];
        renderTabelaFinanceiro();
        renderListaGestaoDespesas();
        atualizarKPIs();
    });

    // NOVO: Estoque
    db.ref('estoque').on('value', snap => {
        store.estoque = snap.val() ? Object.values(snap.val()) : [];
        renderEstoque();
        renderServicosPDV(); 
    });

    // NOVO: Profissionais
    db.ref('profissionais').on('value', snap => {
        store.profissionais = snap.val() ? Object.values(snap.val()) : [];
        renderListaProfissionaisCad();
        renderSelectsProfissionais();
        renderAgenda();
        renderTabelaFinanceiro();
        atualizarKPIs();
        atualizarGraficos();
        renderTabelaClientes();
    });
}

// ==========================================
// 5. CONFIGURAÇÕES & MODAL
// ==========================================
function abrirModalConfig() {
    document.getElementById("cfg-chave-pix").value = configSistema.chavePix || "";
    document.getElementById("cfg-nome-pix").value = configSistema.nomePix || "";
    document.getElementById("cfg-cidade-pix").value = configSistema.cidadePix || "";
    document.getElementById("cfg-meta-mensal").value = configSistema.metaMensal || "";
    
    document.getElementById("modal-config").style.display = 'flex';
}

function salvarConfiguracoes() {
    const novaConfig = {
        chavePix: document.getElementById("cfg-chave-pix").value,
        nomePix: document.getElementById("cfg-nome-pix").value,
        cidadePix: document.getElementById("cfg-cidade-pix").value,
        metaMensal: parseFloat(document.getElementById("cfg-meta-mensal").value) || 0
    };

    db.ref('config').set(novaConfig)
        .then(() => {
            configSistema = novaConfig;
            dispararToast("⚙️ Configurações salvas!");
            fecharModal('modal-config');
            atualizarKPIs(); 
        })
        .catch(erro => alert("Erro ao salvar: " + erro.message));
}

// ==========================================
// 6. NAVEGAÇÃO E UI
// ==========================================
function abrirAba(idAba) {
    const abasAtivas = document.querySelectorAll('.aba');
    abasAtivas.forEach(el => {
        el.style.opacity = '0';
        el.style.transform = 'translateY(10px)';
        setTimeout(() => el.style.display = 'none', 200);
    });

    document.querySelectorAll('.nav-item, .mobile-nav-item').forEach(el => el.classList.remove('active'));
    
    const btnMenu = document.querySelector(`.nav-item[onclick*="${idAba}"]`);
    if(btnMenu) btnMenu.classList.add('active');
    
    const btnMobile = document.querySelector(`.mobile-nav-item[onclick*="${idAba}"]`);
    if(btnMobile) btnMobile.classList.add('active');
    
    setTimeout(() => {
        const aba = document.getElementById(idAba);
        if(aba) {
            aba.style.display = 'block';
            void aba.offsetWidth; // Força reflow
            aba.classList.add('fade-in');
            aba.style.opacity = '1';
            aba.style.transform = 'translateY(0)';
        }
        lucide.createIcons();
    }, 200);

    // LÓGICA DE SINCRONIZAÇÃO DE DATA (AGENDA -> PDV)
    if (idAba === 'novo_atendimento') {
        const dataAgenda = document.getElementById("agenda-date-input");
        const dataPDV = document.getElementById("pdv-data");
        
        // Se estivermos editando um atendimento, não mexe na data, usa a original
        if (idAtendimentoEdicao) return;

        // Se veio da Agenda e tem data selecionada, aplica no PDV
        if (dataAgenda && dataAgenda.value && dataPDV) {
            dataPDV.value = dataAgenda.value;
        } else if (dataPDV && !dataPDV.value) {
            // Se não, usa hoje como fallback
            dataPDV.value = new Date().toISOString().split('T')[0];
        }
    }
}

function dispararToast(msg, tipo = 'success') {
    const container = document.getElementById('toast-container');
    if(!container) return;
    const el = document.createElement('div');
    el.className = 'glass-panel';
    el.style.padding = '15px 20px';
    el.style.marginBottom = '10px';
    el.style.borderLeft = tipo === 'error' ? '4px solid #f43f5e' : '4px solid #10b981';
    el.style.color = 'white';
    el.innerText = msg;
    el.style.boxShadow = "0 10px 30px rgba(0,0,0,0.5)";
    
    container.style.position = 'fixed';
    if (document.body.classList.contains('mobile-mode')) {
        container.style.bottom = '80px'; 
    } else {
        container.style.bottom = '20px';
    }
    container.style.right = '20px';
    container.style.zIndex = '9999';

    container.appendChild(el);
    setTimeout(() => el.remove(), 3000);
}

// ==========================================
// 7. MÓDULO: PDV & PIX (COM PREÇO VARIÁVEL)
// ==========================================
function renderServicosPDV() {
    const sel = document.getElementById("pdv-servico");
    if(!sel) return;
    
    let html = '<option value="">Selecione...</option>';
    
    // Grupo de Serviços
    html += '<optgroup label="✨ Serviços">';
    store.servicos.forEach(s => {
        html += `<option value="${s.id}" data-tipo="servico" data-preco="${s.preco}">${s.nome} - R$ ${parseFloat(s.preco).toFixed(2)}</option>`;
    });
    html += '</optgroup>';

    // Grupo de Produtos (Estoque) - NOVO
    html += '<optgroup label="📦 Produtos / Estoque">';
    store.estoque.forEach(p => {
        html += `<option value="${p.id}" data-tipo="produto" data-preco="${p.preco}">${p.nome} (Estoque: ${p.qtd}) - R$ ${parseFloat(p.preco).toFixed(2)}</option>`;
    });
    html += '</optgroup>';

    sel.innerHTML = html;
}

function renderClientesPDV() {
    const sel = document.getElementById("pdv-cliente");
    if(!sel) return;
    sel.innerHTML = '<option value="">Cliente Avulso / Sem Cadastro</option>' + 
        store.clientes.map(c => `<option value="${c.id}">${c.nome}</option>`).join("");
}

// ALTERAÇÃO: Ao clicar em adicionar, abrimos a confirmação de preço
function adicionarAoCarrinho() {
    const sel = document.getElementById("pdv-servico");
    const option = sel.options[sel.selectedIndex];
    
    if(!sel.value) return dispararToast("Selecione algo!", "error");

    // Captura se é serviço ou produto
    itemPendente = {
        id: sel.value,
        nome: option.text.split(' - R$')[0].split(' (Estoque')[0], // Limpa o nome para o carrinho
        preco: option.getAttribute('data-preco'),
        tipo: option.getAttribute('data-tipo') // 'servico' ou 'produto'
    };

    // Abre o Modal de Confirmação em vez de adicionar direto
    abrirModalPreco(itemPendente);
}

// === FUNÇÕES DO MODAL DE PREÇO ===
function abrirModalPreco(item) {
    document.getElementById("txt-modal-produto").innerText = item.nome;
    document.getElementById("txt-modal-preco-original").innerText = `Valor Padrão: R$ ${parseFloat(item.preco).toFixed(2)}`;
    
    // Reseta o estado do modal
    document.getElementById("etapa-pergunta-preco").style.display = 'block';
    document.getElementById("etapa-novo-preco").style.display = 'none';
    document.getElementById("input-novo-preco").value = "";
    
    document.getElementById("modal-confirmar-preco").style.display = "flex";
}

function mostrarInputPreco() {
    document.getElementById("etapa-pergunta-preco").style.display = 'none';
    document.getElementById("etapa-novo-preco").style.display = 'block';
    document.getElementById("input-novo-preco").focus();
}

function fecharModalPreco() {
    document.getElementById("modal-confirmar-preco").style.display = "none";
    itemPendente = null;
}

function confirmarPreco(isOriginal) {
    if (!itemPendente) return;

    if (isOriginal) {
        // Usa o preço original já salvo em itemPendente
        store.carrinho.push(itemPendente);
        dispararToast("Item adicionado com valor original.");
    } else {
        // Pega o novo valor do input
        const novoValor = parseFloat(document.getElementById("input-novo-preco").value);
        if (isNaN(novoValor) || novoValor < 0) {
            alert("Digite um valor válido!");
            return;
        }
        itemPendente.preco = novoValor; // Atualiza SÓ para esta venda
        store.carrinho.push(itemPendente);
        dispararToast("Item adicionado com novo valor!");
    }

    renderCarrinho();
    fecharModalPreco();
}
// ==========================================

function renderCarrinho() {
    const lista = document.getElementById("lista-carrinho");
    let total = 0;
    
    if(store.carrinho.length === 0) {
        lista.innerHTML = '<li class="empty-state">Carrinho vazio...</li>';
        document.getElementById("pdv-total").innerText = "R$ 0,00";
        if(document.getElementById("pdv-troco-display")) document.getElementById("pdv-troco-display").innerText = "R$ 0,00";
        return;
    }

    lista.innerHTML = store.carrinho.map((item, index) => {
        total += parseFloat(item.preco);
        return `<li>
            <span>${item.tipo === 'produto' ? '📦 ' : '✨ '} ${item.nome}</span>
            <div style="display:flex; align-items:center; gap:10px">
                <strong>R$ ${parseFloat(item.preco).toFixed(2)}</strong>
                <i data-lucide="trash-2" onclick="removerDoCarrinho(${index})" style="width:14px; cursor:pointer; color:#f43f5e"></i>
            </div>
        </li>`;
    }).join("");
    
    lucide.createIcons();
    document.getElementById("pdv-total").innerText = `R$ ${total.toFixed(2)}`;
    
    if(document.getElementById("pdv-pagamento").value === "Pix") {
        gerarPix(total);
    } else if(document.getElementById("pdv-pagamento").value === "Dinheiro") {
        calcularTroco();
    }
}

function removerDoCarrinho(index) {
    store.carrinho.splice(index, 1);
    renderCarrinho();
}

function calcularDataRetorno() {
    const diasInput = document.getElementById("pdv-dias-retorno");
    const inputData = document.getElementById("pdv-retorno");
    if(!diasInput || !inputData) return;
    const dias = parseInt(diasInput.value);
    if(!isNaN(dias) && dias > 0) {
        const dataFutura = new Date();
        dataFutura.setDate(dataFutura.getDate() + dias);
        inputData.value = dataFutura.toISOString().split('T')[0];
    } else {
        inputData.value = "";
    }
}

function toggleTroco() {
    const tipo = document.getElementById("pdv-pagamento").value;
    const areaTroco = document.getElementById("area-troco");
    const areaPix = document.getElementById("area-pix");
    
    areaTroco.style.display = "none";
    areaPix.style.display = "none";
    
    if(tipo === "Dinheiro") {
        areaTroco.style.display = "block";
    } else if (tipo === "Pix") {
        areaPix.style.display = "block";
        const total = store.carrinho.reduce((acc, i) => acc + parseFloat(i.preco), 0);
        if(total > 0) gerarPix(total);
    }
}

function calcularTroco() {
    const total = store.carrinho.reduce((acc, i) => acc + parseFloat(i.preco), 0);
    const pago = parseFloat(document.getElementById("pdv-valor-pago").value) || 0;
    const troco = pago - total;
    const display = document.getElementById("pdv-troco-display");
    
    if(troco >= 0) {
        display.innerText = `R$ ${troco.toFixed(2)}`;
        display.style.color = "var(--success)";
    } else {
        display.innerText = "Faltam R$ " + Math.abs(troco).toFixed(2);
        display.style.color = "var(--danger)";
    }
}

// ==========================================
// FUNÇÕES AVANÇADAS DE PIX (CRC16 REAL)
// ==========================================

// 1. Função auxiliar para formatar os campos do Pix (ID + Tamanho + Valor)
function formatField(id, value) {
    const valStr = value.toString();
    const len = valStr.length.toString().padStart(2, '0');
    return `${id}${len}${valStr}`;
}

// 2. Remove acentos e caracteres especiais (O Banco Central exige isso)
function removeAcentos(str) {
    return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9 ]/g, "");
}

// 3. Cálculo Matemático do CRC16 (Obrigatório para o banco aceitar)
function crc16(buffer) {
    let crc = 0xFFFF;
    for (let i = 0; i < buffer.length; i++) {
        let x = ((crc >> 8) ^ buffer.charCodeAt(i)) & 0xFF;
        x ^= x >> 4;
        crc = ((crc << 8) ^ (x << 12) ^ (x << 5) ^ x) & 0xFFFF;
    }
    return crc.toString(16).toUpperCase().padStart(4, '0');
}

// 4. Função Principal Atualizada
function gerarPix(valor) {
    if(!configSistema.chavePix || !configSistema.nomePix) {
        document.getElementById("pix-copia-cola").value = "Configure a Chave Pix nas Configurações!";
        return;
    }

    // Limpa os dados para evitar erros de acentuação
    const chave = configSistema.chavePix.trim();
    const nome = removeAcentos(configSistema.nomePix.trim()).substring(0, 25); // Limita tamanho
    const cidade = removeAcentos(configSistema.cidadePix || "Cidade").trim().substring(0, 15);
    const valorFormatado = valor.toFixed(2);

    // Monta a estrutura oficial do Pix (EMV QRCPS)
    let payload = 
        formatField("00", "01") +                          // Payload Format Indicator
        formatField("26",                                  // Merchant Account Information
            formatField("00", "BR.GOV.BCB.PIX") +
            formatField("01", chave)
        ) +
        formatField("52", "0000") +                        // Merchant Category Code
        formatField("53", "986") +                         // Transaction Currency (BRL)
        formatField("54", valorFormatado) +                // Transaction Amount
        formatField("58", "BR") +                          // Country Code
        formatField("59", nome) +                          // Merchant Name
        formatField("60", cidade) +                        // Merchant City
        formatField("62",                                  // Additional Data Field
            formatField("05", "***")                       // Reference Label
        );

    // Adiciona o ID do CRC16 no final
    payload += "6304";
    
    // Calcula o código verificador real baseado nos dados acima
    payload += crc16(payload);

    // Gera o QR Code visual
    const qr = new QRious({
        element: document.getElementById('qr-pix'),
        value: payload, 
        size: 200,
        level: 'M' // Nível médio de correção de erro (melhor leitura)
    });
    
    // Coloca o código no input para copiar
    document.getElementById("pix-copia-cola").value = payload;
}

function copiarPix() {
    const input = document.getElementById("pix-copia-cola");
    input.select();
    document.execCommand("copy");
    dispararToast("Chave Pix copiada!");
}

function finalizarVenda() {
    if(store.carrinho.length === 0) return dispararToast("Carrinho vazio!", "error");

    const idCliente = document.getElementById("pdv-cliente").value;
    const idProfissional = document.getElementById("pdv-profissional") ? document.getElementById("pdv-profissional").value : "";
    const pagamento = document.getElementById("pdv-pagamento").value;
    const retorno = document.getElementById("pdv-retorno").value;
    const obs = document.getElementById("pdv-obs").value;
    
    // Captura a data que está no campo visual
    const dataSelecionada = document.getElementById("pdv-data").value;

    if(!idProfissional) return dispararToast("Selecione quem atendeu!", "error");

    const total = store.carrinho.reduce((acc, i) => acc + parseFloat(i.preco), 0);

    let nomeCliente = "Cliente Avulso";
    let pontosGanhos = Math.floor(total); 

    if(idCliente) {
        const c = store.clientes.find(x => x.id == idCliente);
        if(c) nomeCliente = c.nome;
    }

    let nomeProfissional = "";
    const prof = store.profissionais.find(x => x.id == idProfissional);
    if(prof) nomeProfissional = prof.nome;

    const id = idAtendimentoEdicao || Date.now();
    const atendimento = {
        id,
        // Usa a data do campo ou hoje se estiver vazio
        data: dataSelecionada || new Date().toISOString().split('T')[0],
        hora: new Date().toLocaleTimeString('pt-BR').substr(0,5),
        timestamp: Date.now(),
        clienteId: idCliente || null,
        nomeCliente: nomeCliente,
        profissionalId: idProfissional,
        nomeProfissional: nomeProfissional,
        servicos: store.carrinho,
        total: total,
        pagamento: pagamento,
        obs: obs,
        previsaoRetorno: retorno || null
    };

    if (idAtendimentoEdicao) {
        // --- MODO EDIÇÃO ---
        db.ref(`atendimentos/${id}`).update(atendimento);
        dispararToast("Atendimento atualizado com sucesso!");
    } else {
        // --- MODO NOVA VENDA ---
        db.ref(`atendimentos/${id}`).set(atendimento);
        dispararToast("✅ Venda Finalizada!");
        
        if(idCliente) {
            db.ref(`clientes/${idCliente}/pontos`).transaction((pontosAtuais) => {
                return (pontosAtuais || 0) + pontosGanhos;
            });
        }

        // Baixa no Estoque (apenas se for venda nova)
        store.carrinho.forEach(item => {
            if(item.tipo === 'produto') {
                const produtoNoEstoque = store.estoque.find(p => p.id == item.id);
                if(produtoNoEstoque) {
                    let novaQtd = parseInt(produtoNoEstoque.qtd) - 1;
                    if(novaQtd < 0) novaQtd = 0; 
                    db.ref(`estoque/${item.id}`).update({ qtd: novaQtd });
                }
            }
        });
    }

    if(idCliente) {
        let updates = { ultimaVisita: atendimento.data };
        if(retorno) updates.previsaoRetorno = retorno;
        db.ref(`clientes/${idCliente}`).update(updates);
    }

    // === LIMPEZA E RESET ===
    store.carrinho = [];
    document.getElementById("pdv-obs").value = "";
    document.getElementById("pdv-retorno").value = "";
    document.getElementById("pdv-cliente").value = "";
    if(document.getElementById("pdv-profissional")) document.getElementById("pdv-profissional").value = "";
    if(document.getElementById("pdv-dias-retorno")) document.getElementById("pdv-dias-retorno").value = "";

    // Reseta a data para HOJE para a próxima venda
    const inputData = document.getElementById("pdv-data");
    if(inputData) inputData.value = new Date().toISOString().split('T')[0];

    toggleTroco();
    renderCarrinho();

    // === RESETAR O VISUAL (SAIR DO MODO EDIÇÃO) ===
    idAtendimentoEdicao = null; // Limpa a variável de controle
    
    const btnFinalizar = document.getElementById("btn-finalizar-pdv");
    const badgeStatus = document.getElementById("badge-status-pdv");

    if(btnFinalizar) {
        btnFinalizar.innerText = "FINALIZAR";
        btnFinalizar.style.background = ""; // Volta ao original (gradiente verde)
        btnFinalizar.style.color = "";
    }
    if(badgeStatus) {
        badgeStatus.innerText = "Aberto";
        badgeStatus.style.background = ""; 
        badgeStatus.style.color = "";
    }
}

function editarAtendimento(id) {
    const a = store.atendimentos.find(item => item.id === id);
    if (!a) return;
    
    // Define o ID global para sabermos que é uma edição
    idAtendimentoEdicao = id;
    
    // 1. Carrega a Data Original do Atendimento
    const inputData = document.getElementById("pdv-data");
    if(inputData) inputData.value = a.data;

    // 2. Carrega os outros dados
    document.getElementById("pdv-cliente").value = a.clienteId || "";
    if(document.getElementById("pdv-profissional")) document.getElementById("pdv-profissional").value = a.profissionalId || "";
    store.carrinho = a.servicos ? [...a.servicos] : [];
    document.getElementById("pdv-pagamento").value = a.pagamento || "Dinheiro";
    document.getElementById("pdv-obs").value = a.obs || "";
    document.getElementById("pdv-retorno").value = a.previsaoRetorno || "";
    
    // 3. Renderiza o carrinho
    renderCarrinho();
    
    // 4. Abre a aba
    abrirAba('novo_atendimento');
    
    // 5. ATUALIZAÇÃO VISUAL (Para saber que está editando)
    const btnFinalizar = document.getElementById("btn-finalizar-pdv");
    const badgeStatus = document.getElementById("badge-status-pdv");

    if(btnFinalizar) {
        btnFinalizar.innerText = "SALVAR ALTERAÇÕES";
        btnFinalizar.style.background = "var(--warning)"; // Fica amarelo/laranja
        btnFinalizar.style.color = "black";
    }
    if(badgeStatus) {
        badgeStatus.innerText = "EDITANDO";
        badgeStatus.style.background = "var(--warning)";
        badgeStatus.style.color = "black";
    }

    // 6. ROLA A TELA PARA O TOPO (Correção do Celular)
    window.scrollTo({ top: 0, behavior: 'smooth' });
    
    dispararToast("Modo de edição ativado: " + a.nomeCliente);
}

// ==========================================
// 8. AGENDA
// ==========================================
function initAgenda() {
    const hoje = new Date().toISOString().split('T')[0];
    const input = document.getElementById("agenda-date-input");
    if(input) {
        input.value = hoje;
        renderAgenda();
    }
}

function renderAgenda() {
    const div = document.getElementById("lista-agenda");
    const inputDate = document.getElementById("agenda-date-input");
    
    if(!inputDate || !div) return; // Segurança extra

    const dataSelecionada = inputDate.value;
    
    const dataObj = new Date(dataSelecionada + 'T00:00:00');
    const options = { weekday: 'long', day: 'numeric', month: 'long' };
    const diaEl = document.getElementById("agenda-dia-semana");
    if(diaEl) diaEl.innerText = dataObj.toLocaleDateString('pt-BR', options);

    const filtroProfissional = document.getElementById("agenda-filtro-profissional") ? document.getElementById("agenda-filtro-profissional").value : "";

    const agendaDoDia = store.atendimentos
        .filter(a => a.data === dataSelecionada)
        .filter(a => !filtroProfissional || a.profissionalId == filtroProfissional)
        .sort((a,b) => b.timestamp - a.timestamp);

    if(agendaDoDia.length === 0) {
        div.innerHTML = "<p class='text-muted' style='text-align:center; padding:20px;'>Nenhum atendimento neste dia.</p>";
        return;
    }

    div.innerHTML = agendaDoDia.map(a => `
        <div class="glass-panel" style="padding:15px; margin-bottom:10px; border-left:4px solid var(--primary); display:flex; justify-content:space-between; align-items:center">
            <div>
                <strong style="font-size:18px">${a.hora}</strong>
                <h4>${a.nomeCliente}</h4>
                <small class="text-muted">${a.servicos.map(s => s.nome).join(", ")}</small>
                ${a.nomeProfissional ? `<br><span class="badge" style="background:#8b5cf620; color:#8b5cf6; margin-top:4px; display:inline-block;">💅 ${a.nomeProfissional}</span>` : ''}
            </div>
            <div style="display:flex; align-items:center; gap:10px">
                <h3 style="color:var(--success); margin-right:10px">R$ ${a.total.toFixed(2)}</h3>
                <button class="btn-small bg-yellow" onclick="editarAtendimento(${a.id})" title="Editar Venda"><i data-lucide="pencil" style="width:14px"></i></button>
                <button class="btn-small bg-purple" onclick="if(confirm('Excluir este atendimento?')) db.ref('atendimentos/${a.id}').remove()" title="Excluir"><i data-lucide="trash-2" style="width:14px"></i></button>
            </div>
        </div>
    `).join("");
    lucide.createIcons();
}

// ==========================================
// 9. CLIENTES, GALERIA & EDIÇÃO
// ==========================================
function renderTabelaClientes() {
    const tbody = document.getElementById("tabela-clientes");
    if(!tbody) return;
    const hojeMesDia = new Date().toISOString().slice(5, 10); // "MM-DD"
    tbody.innerHTML = store.clientes.map(c => {
        const telefoneClean = c.telefone ? c.telefone.replace(/\D/g, '') : '';
        const linkZap = telefoneClean ? `https://wa.me/55${telefoneClean}?text=Olá ${c.nome}, Cassia Nunes passando para confirmar seu horário!` : '#';
        const ehAniversarioHoje = c.dataNasc && c.dataNasc.slice(5, 10) === hojeMesDia;
        const linkZapAniversario = telefoneClean ? `https://wa.me/55${telefoneClean}?text=${encodeURIComponent(`Feliz Aniversário, ${c.nome}! 🎉🎂 A equipe Cassia Nunes deseja um dia repleto de alegria. Contamos com sua visita para comemorar com um mimo especial! 💖`)}` : '#';
        
        return `<tr data-cliente-id="${c.id}">
            <td style="display:flex; align-items:center; gap:10px">
                <div class="avatar" style="background-image:url('${c.foto || ''}'); background-size:cover;">${c.foto ? '' : c.nome[0]}</div>
                <div>
                    <strong style="cursor:pointer; color:var(--primary)" onclick="abrirModalAnamnese(${c.id})" title="Ver Histórico Completo">${c.nome}</strong> ${ehAniversarioHoje ? '<span title="Aniversário hoje!">🎂</span>' : ''}<br>
                    <span style="font-size:12px; opacity:0.7">${c.telefone || 'Sem telefone'}</span>
                </div>
            </td>
            <td><span class="badge" style="background:#d946ef20; color:#d946ef">💎 ${c.pontos || 0} pts</span></td>
            <td>${c.ultimaVisita ? formatarData(c.ultimaVisita) : '-'}</td>
            <td>${c.previsaoRetorno ? formatarData(c.previsaoRetorno) : '-'}</td>
            <td>
                <button class="btn-small bg-yellow" onclick="editarCliente(${c.id})" title="Editar Dados">
                    <i data-lucide="pencil" style="width:16px; height:16px;"></i>
                </button>
                <button class="btn-small bg-purple" onclick="abrirModalAnamnese(${c.id})" title="Histórico e Fotos">
                    <i data-lucide="clipboard-list" style="width:16px; height:16px;"></i>
                </button>
                ${telefoneClean ? `<a href="${linkZap}" target="_blank"><button class="btn-small bg-green" title="WhatsApp"><i data-lucide="message-circle" style="width:16px; height:16px;"></i></button></a>` : ''}
                ${ehAniversarioHoje && telefoneClean ? `<a href="${linkZapAniversario}" target="_blank"><button class="btn-small" style="background:#f59e0b; color:white;" title="Enviar Parabéns no WhatsApp"><i data-lucide="cake" style="width:16px; height:16px;"></i></button></a>` : ''}
                <button class="btn-small" onclick="excluirCliente(${c.id})" title="Excluir" style="background: var(--danger); color: white;">
                    <i data-lucide="trash-2" style="width:16px; height:16px;"></i>
                </button>
            </td>
        </tr>`
    }).join("");
    lucide.createIcons();
    if(document.getElementById("busca-cliente") || document.getElementById("clientes-filtro-profissional")) filtrarClientes();
}

function excluirCliente(id) {
    if(confirm("Tem certeza que deseja excluir este cliente? O histórico será perdido.")) {
        db.ref(`clientes/${id}`).remove()
          .then(() => dispararToast("Cliente removido!", "error"));
    }
}

function filtrarRetornosDashboard() {
    const div = document.getElementById("lista-retornos-dashboard");
    if(!div) return;
    const filtroData = document.getElementById("dash-filtro-data").value;
    const hoje = new Date().toISOString().split('T')[0];
    let lista = filtroData ? store.clientes.filter(c => c.previsaoRetorno === filtroData) : store.clientes.filter(c => c.previsaoRetorno && c.previsaoRetorno <= hoje);
    
    if(lista.length === 0) {
        div.innerHTML = `<p style='padding:15px; opacity:0.6'>${filtroData ? "Nenhum retorno para esta data." : "Nenhum retorno urgente."}</p>`;
        return;
    }
    div.innerHTML = lista.map(c => {
        const telefoneClean = c.telefone ? c.telefone.replace(/\D/g, '') : '';
        const linkZap = telefoneClean ? `https://wa.me/55${telefoneClean}?text=Oi ${c.nome}, seu retorno está previsto para ${formatarData(c.previsaoRetorno)}.` : '#';
        const isLate = c.previsaoRetorno < hoje;
        return `<div style="padding:10px; border-bottom:1px solid var(--border); display:flex; justify-content:space-between; align-items:center">
            <div><strong>${c.nome}</strong><br><small style="color:${isLate ? '#f43f5e' : '#f59e0b'}">${isLate ? 'Atrasado: ' : 'Data: '}${formatarData(c.previsaoRetorno)}</small></div>
            ${telefoneClean ? `<a href="${linkZap}" target="_blank" class="btn-small bg-green" style="text-decoration:none">Chamar</a>` : ''}
        </div>`
    }).join("");
}

function limparFiltroRetorno() {
    const input = document.getElementById("dash-filtro-data");
    if(input) { input.value = ""; filtrarRetornosDashboard(); }
}

function abrirModalCliente() {
    idClienteEdicao = null;
    document.getElementById("titulo-modal-cliente").innerText = "Novo Cadastro";
    document.getElementById("novo-cli-nome").value = "";
    document.getElementById("novo-cli-tel").value = "";
    document.getElementById("novo-cli-nasc").value = "";
    document.getElementById("modal-novo-cliente").style.display = 'flex';
}

function editarCliente(id) {
    const c = store.clientes.find(x => x.id == id);
    if (!c) return;

    idClienteEdicao = id;
    document.getElementById("titulo-modal-cliente").innerText = "Editar Cliente";
    document.getElementById("novo-cli-nome").value = c.nome;
    document.getElementById("novo-cli-tel").value = c.telefone || "";
    document.getElementById("novo-cli-nasc").value = c.dataNasc || "";
    
    document.getElementById("modal-novo-cliente").style.display = 'flex';
}

function fecharModal(id) {
    document.getElementById(id).style.display = 'none';
}

function processarImagem(file, callback) {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
        const img = new Image();
        img.src = event.target.result;
        img.onload = () => {
            const elem = document.createElement('canvas');
            const width = 600; 
            const scaleFactor = width / img.width;
            elem.width = width;
            elem.height = img.height * scaleFactor;
            const ctx = elem.getContext('2d');
            ctx.drawImage(img, 0, 0, width, img.height * scaleFactor);
            callback(elem.toDataURL('image/jpeg', 0.7)); 
        }
    }
}

function salvarNovoClienteModal() {
    const nome = document.getElementById("novo-cli-nome").value;
    const tel = document.getElementById("novo-cli-tel").value;
    const nasc = document.getElementById("novo-cli-nasc").value;
    const fotoInput = document.getElementById("novo-cli-foto");
    
    if(!nome) return dispararToast("Nome é obrigatório", "error");
    
    const salvarNoBanco = (fotoBase64) => {
        if (idClienteEdicao) {
            const updates = { nome, telefone: tel, dataNasc: nasc };
            if(fotoBase64) updates.foto = fotoBase64;
            db.ref(`clientes/${idClienteEdicao}`).update(updates);
            dispararToast("Dados do cliente atualizados!");
        } else {
            const id = Date.now();
            db.ref(`clientes/${id}`).set({ 
                id, nome, telefone: tel, dataNasc: nasc, 
                dataCadastro: new Date().toISOString(),
                pontos: 0,
                foto: fotoBase64 || null
            });
            dispararToast("Cliente cadastrado!");
        }
        fecharModal('modal-novo-cliente');
        document.getElementById("novo-cli-nome").value = "";
    };

    if(fotoInput.files[0]) {
        processarImagem(fotoInput.files[0], salvarNoBanco);
    } else {
        salvarNoBanco(null);
    }
}

function abrirModalAnamnese(id) {
    clienteAnamneseAtual = store.clientes.find(c => c.id == id);
    if(!clienteAnamneseAtual) return;
    document.getElementById("modal-anamnese").style.display = 'flex';
    document.getElementById("anamnese-cliente-nome").innerText = clienteAnamneseAtual.nome;
    
    // Agora abre na aba de compras (histórico) por padrão
    trocarAbaAnamnese('compras');
    
    // PREENCHE O HISTÓRICO DE COMPRAS/SERVIÇOS
    const divCompras = document.getElementById("lista-compras-servicos");
    if(divCompras) {
        const comprasDoCliente = store.atendimentos
            .filter(a => a.clienteId == id)
            .sort((a,b) => b.timestamp - a.timestamp);

        if(comprasDoCliente.length === 0) {
            divCompras.innerHTML = "<p style='opacity:0.5; padding:10px; text-align:center'>Nenhum serviço realizado ainda.</p>";
        } else {
            divCompras.innerHTML = comprasDoCliente.map(a => `
                <div style="border-bottom:1px solid var(--border); padding:10px 0;">
                    <div style="display:flex; justify-content:space-between;">
                        <strong style="color:var(--success)">${formatarData(a.data)}</strong>
                        <small>Total: R$ ${a.total.toFixed(2)}</small>
                    </div>
                    <div style="font-size:12px; margin-top:5px; color:#ddd;">
                        ${a.servicos.map(s => `• ${s.nome}`).join("<br>")}
                    </div>
                </div>
            `).join("");
        }
    }
}

function trocarAbaAnamnese(aba) {
    // Esconde todas
    const abas = ['historico', 'galeria', 'compras'];
    abas.forEach(a => {
        const el = document.getElementById('tab-' + a);
        if(el) el.style.display = 'none';
    });
    
    // Mostra a selecionada
    const alvo = document.getElementById('tab-' + aba);
    if(alvo) alvo.style.display = 'block';
    
    // Atualiza botões
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelector(`.tab-btn[onclick*="${aba}"]`).classList.add('active');
    
    if(aba === 'historico') renderHistoricoAnamnese();
    if(aba === 'galeria') renderGaleriaFotos();
}

function renderHistoricoAnamnese() {
    const div = document.getElementById("historico-lista");
    const hist = clienteAnamneseAtual.historico ? Object.values(clienteAnamneseAtual.historico) : [];
    div.innerHTML = hist.length === 0 ? "<small style='opacity:0.5'>Sem anotações técnicas.</small>" : hist.reverse().map(h => `<div style="border-left:2px solid var(--primary); padding-left:10px; margin-bottom:15px"><div style="display:flex; justify-content:space-between"><strong>${h.titulo}</strong><small style="opacity:0.5">${h.data}</small></div><p style="font-size:13px; color:#ddd; margin-top:5px">${h.obs}</p></div>`).join("");
}

function renderGaleriaFotos() {
    const div = document.getElementById("galeria-grid");
    const fotos = clienteAnamneseAtual.galeria ? Object.values(clienteAnamneseAtual.galeria) : [];
    
    div.innerHTML = fotos.length === 0 ? "<small style='opacity:0.5; grid-column:span 3; text-align:center;'>Nenhuma foto salva.</small>" : fotos.reverse().map(f => `
        <div class="gallery-item" onclick="window.open('${f.img}')">
            <img src="${f.img}">
            <div class="gallery-caption">${f.desc}</div>
        </div>
    `).join("");
}

function salvarAnamnese() {
    const titulo = document.getElementById("anam-titulo").value;
    const obs = document.getElementById("anam-obs").value;
    if(!titulo) return alert("Preencha o título!");
    const novo = { data: new Date().toLocaleDateString('pt-BR'), titulo, obs };
    db.ref(`clientes/${clienteAnamneseAtual.id}/historico`).push(novo).then(() => {
        document.getElementById("anam-titulo").value = "";
        document.getElementById("anam-obs").value = "";
        dispararToast("Ficha atualizada!");
        abrirModalAnamnese(clienteAnamneseAtual.id); // Reload
    });
}

function salvarFotoGaleria() {
    const input = document.getElementById("input-foto-galeria");
    const desc = document.getElementById("desc-foto-galeria").value;
    
    if(!input.files[0]) return alert("Selecione uma foto!");
    
    processarImagem(input.files[0], (base64) => {
        const novaFoto = { data: new Date().toLocaleDateString('pt-BR'), desc: desc || "Sem descrição", img: base64 };
        db.ref(`clientes/${clienteAnamneseAtual.id}/galeria`).push(novaFoto).then(() => {
            document.getElementById("input-foto-galeria").value = "";
            document.getElementById("desc-foto-galeria").value = "";
            dispararToast("Foto salva!");
            abrirModalAnamnese(clienteAnamneseAtual.id); // Reload
        });
    });
}

// ==========================================
// 10. ESTOQUE (NOVO)
// ==========================================
function salvarProdutoEstoque() {
    const nome = document.getElementById("prod-nome").value;
    const qtd = parseInt(document.getElementById("prod-qtd").value);
    const preco = parseFloat(document.getElementById("prod-preco").value);

    if(!nome || isNaN(qtd) || isNaN(preco)) return dispararToast("Preencha todos os campos!", "error");

    if (idProdutoEdicao) {
        db.ref(`estoque/${idProdutoEdicao}`).update({ nome, qtd, preco })
            .then(() => dispararToast("Produto atualizado!"));
        cancelarEdicaoProduto();
    } else {
        const id = Date.now();
        db.ref(`estoque/${id}`).set({ id, nome, qtd, preco })
            .then(() => dispararToast("Produto cadastrado!"));
        document.getElementById("prod-nome").value = "";
        document.getElementById("prod-qtd").value = "";
        document.getElementById("prod-preco").value = "";
    }
}

function renderEstoque() {
    const tbody = document.getElementById("tabela-estoque");
    if(!tbody) return;

    if(store.estoque.length === 0) {
        tbody.innerHTML = "<tr><td colspan='4' style='text-align:center; opacity:0.5'>Estoque vazio.</td></tr>";
        return;
    }

    tbody.innerHTML = store.estoque.map(p => `
        <tr>
            <td>${p.nome}</td>
            <td>${p.qtd} un</td>
            <td>R$ ${parseFloat(p.preco).toFixed(2)}</td>
            <td>
                <button class="btn-small bg-yellow" onclick="editarProdutoEstoque(${p.id})"><i data-lucide="pencil" style="width:14px"></i></button>
                <button class="btn-small bg-purple" onclick="if(confirm('Excluir produto?')) db.ref('estoque/${p.id}').remove()"><i data-lucide="trash-2" style="width:14px"></i></button>
            </td>
        </tr>
    `).join("");
    lucide.createIcons();
}

function editarProdutoEstoque(id) {
    const p = store.estoque.find(x => x.id === id);
    if(!p) return;
    
    idProdutoEdicao = id;
    document.getElementById("prod-nome").value = p.nome;
    document.getElementById("prod-qtd").value = p.qtd;
    document.getElementById("prod-preco").value = p.preco;

    document.getElementById("btn-salvar-produto").innerText = "ATUALIZAR";
    document.getElementById("btn-cancelar-produto").style.display = "inline-block";
}

function cancelarEdicaoProduto() {
    idProdutoEdicao = null;
    document.getElementById("prod-nome").value = "";
    document.getElementById("prod-qtd").value = "";
    document.getElementById("prod-preco").value = "";
    document.getElementById("btn-salvar-produto").innerText = "Salvar";
    document.getElementById("btn-cancelar-produto").style.display = "none";
}


// ==========================================
// 11. DESPESAS E FINANCEIRO
// ==========================================
function lancarDespesa() {
    const desc = document.getElementById("desp-desc").value;
    const valor = parseFloat(document.getElementById("desp-valor").value);
    const data = document.getElementById("desp-data").value;
    const cat = document.getElementById("desp-cat").value;
    if(!desc || isNaN(valor) || !data) return alert("Preencha tudo!");

    if (idDespesaEdicao) {
        db.ref(`despesas/${idDespesaEdicao}`).update({ descricao: desc, valor: valor, data: data, categoria: cat }).then(() => dispararToast("Despesa atualizada!"));
        cancelarEdicaoDespesa();
    } else {
        const id = Date.now();
        db.ref(`despesas/${id}`).set({ id, descricao: desc, valor: valor, data: data, categoria: cat, tipo: 'saida' }).then(() => dispararToast("Despesa salva!"));
        document.getElementById("desp-desc").value = "";
        document.getElementById("desp-valor").value = "";
    }
}

function renderListaGestaoDespesas() {
    const tbody = document.getElementById("lista-gestao-despesas");
    if(!tbody) return;
    const lista = [...store.despesas].sort((a,b) => new Date(b.data) - new Date(a.data));
    tbody.innerHTML = lista.map(d => `<tr><td>${formatarData(d.data)}</td><td>${d.descricao}</td><td>R$ ${d.valor.toFixed(2)}</td><td><button class="btn-small bg-yellow" onclick="prepararEdicaoDespesa(${d.id})">Editar</button><button class="btn-small bg-purple" onclick="if(confirm('Apagar?')) db.ref('despesas/${d.id}').remove()">X</button></td></tr>`).join("");
}

function prepararEdicaoDespesa(id) {
    const d = store.despesas.find(x => x.id === id);
    if(!d) return;
    document.getElementById("desp-desc").value = d.descricao;
    document.getElementById("desp-valor").value = d.valor;
    document.getElementById("desp-data").value = d.data;
    document.getElementById("desp-cat").value = d.categoria;
    idDespesaEdicao = id;
    document.getElementById("titulo-form-despesa").innerText = "Editar Despesa";
    document.getElementById("btn-salvar-despesa").innerText = "SALVAR ALTERAÇÕES";
    document.getElementById("btn-cancelar-despesa").style.display = "inline-block";
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function cancelarEdicaoDespesa() {
    idDespesaEdicao = null;
    document.getElementById("titulo-form-despesa").innerText = "Registrar Despesa";
    document.getElementById("btn-salvar-despesa").innerText = "LANÇAR DESPESA";
    document.getElementById("btn-cancelar-despesa").style.display = "none";
    document.getElementById("desp-desc").value = "";
    document.getElementById("desp-valor").value = "";
}

function salvarServicoCad() {
    const nome = document.getElementById("serv-nome").value;
    const preco = document.getElementById("serv-preco").value;
    if(!nome || !preco) return dispararToast("Preencha nome e preço!", "error");
    if (idServicoEdicao) {
        db.ref(`servicos/${idServicoEdicao}`).update({ nome: nome, preco: preco }).then(() => dispararToast("Serviço atualizado!"));
        cancelarEdicaoServico();
    } else {
        const id = Date.now();
        db.ref(`servicos/${id}`).set({ id, nome, preco });
        dispararToast("Serviço salvo!");
        document.getElementById("serv-nome").value = "";
        document.getElementById("serv-preco").value = "";
    }
}

function renderListaServicosCad() {
    const div = document.getElementById("lista-servicos-cad");
    div.innerHTML = store.servicos.map(s => `<div class="glass-panel" style="padding:15px; display:flex; justify-content:space-between; align-items:center; margin-bottom:10px"><div><strong>${s.nome}</strong><br><span class="text-gradient">R$ ${parseFloat(s.preco).toFixed(2)}</span></div><div style="display:flex; gap:10px"><button class="btn-small bg-yellow" onclick="prepararEdicaoServico(${s.id})" title="Editar"><i data-lucide="pencil" style="width:14px"></i></button><button class="btn-small bg-purple" onclick="if(confirm('Excluir?')) db.ref('servicos/${s.id}').remove()" title="Excluir"><i data-lucide="trash-2" style="width:14px"></i></button></div></div>`).join("");
    lucide.createIcons();
}

function prepararEdicaoServico(id) {
    const s = store.servicos.find(x => x.id === id);
    if(!s) return;
    document.getElementById("serv-nome").value = s.nome;
    document.getElementById("serv-preco").value = s.preco;
    idServicoEdicao = id;
    const btn = document.getElementById("btn-salvar-servico");
    if(btn) { btn.innerText = "ATUALIZAR"; btn.style.background = "var(--warning)"; }
    document.getElementById("btn-cancelar-servico").style.display = "block";
    document.getElementById("servicos").scrollIntoView({ behavior: 'smooth' });
}

function cancelarEdicaoServico() {
    idServicoEdicao = null;
    document.getElementById("serv-nome").value = "";
    document.getElementById("serv-preco").value = "";
    const btn = document.getElementById("btn-salvar-servico");
    if(btn) { btn.innerText = "Salvar"; btn.style.background = ""; }
    document.getElementById("btn-cancelar-servico").style.display = "none";
}

// ==========================================
// PROFISSIONAIS (CADASTRO E FILTROS)
// ==========================================
function salvarProfissionalCad() {
    const nome = document.getElementById("prof-nome").value.trim();
    const telefone = document.getElementById("prof-telefone").value.trim();
    const especialidade = document.getElementById("prof-especialidade").value.trim();
    let comissao = parseFloat(document.getElementById("prof-comissao").value);
    if(isNaN(comissao)) comissao = 0;
    if(comissao < 0) comissao = 0;
    if(comissao > 100) comissao = 100;
    if(!nome) return dispararToast("Preencha o nome da profissional!", "error");

    if (idProfissionalEdicao) {
        db.ref(`profissionais/${idProfissionalEdicao}`).update({ nome, telefone, especialidade, comissao })
            .then(() => dispararToast("Profissional atualizada!"));
        cancelarEdicaoProfissional();
    } else {
        const id = Date.now();
        db.ref(`profissionais/${id}`).set({ id, nome, telefone, especialidade, comissao, ativo: true });
        dispararToast("Profissional cadastrada!");
        document.getElementById("prof-nome").value = "";
        document.getElementById("prof-telefone").value = "";
        document.getElementById("prof-especialidade").value = "";
        document.getElementById("prof-comissao").value = "";
    }
}

function renderListaProfissionaisCad() {
    const div = document.getElementById("lista-profissionais-cad");
    if(!div) return;
    if(store.profissionais.length === 0) {
        div.innerHTML = "<p class='text-muted' style='text-align:center; padding:20px;'>Nenhuma profissional cadastrada ainda.</p>";
        return;
    }
    div.innerHTML = store.profissionais.map(p => `<div class="glass-panel" style="padding:15px; display:flex; justify-content:space-between; align-items:center; margin-bottom:10px">
        <div>
            <strong>${p.nome}</strong><br>
            <span class="text-muted" style="font-size:12px;">${p.especialidade || 'Profissional'}${p.telefone ? ' · ' + p.telefone : ''}</span><br>
            <span class="badge" style="background:#8b5cf620; color:#8b5cf6; margin-top:4px; display:inline-block; font-size:11px;">Repassa ${p.comissao || 0}% ao salão</span>
        </div>
        <div style="display:flex; gap:10px">
            <button class="btn-small bg-yellow" onclick="prepararEdicaoProfissional(${p.id})" title="Editar"><i data-lucide="pencil" style="width:14px"></i></button>
            <button class="btn-small bg-purple" onclick="excluirProfissional(${p.id})" title="Excluir"><i data-lucide="trash-2" style="width:14px"></i></button>
        </div>
    </div>`).join("");
    lucide.createIcons();
}

function prepararEdicaoProfissional(id) {
    const p = store.profissionais.find(x => x.id === id);
    if(!p) return;
    document.getElementById("prof-nome").value = p.nome;
    document.getElementById("prof-telefone").value = p.telefone || "";
    document.getElementById("prof-especialidade").value = p.especialidade || "";
    document.getElementById("prof-comissao").value = p.comissao || "";
    idProfissionalEdicao = id;
    const btn = document.getElementById("btn-salvar-profissional");
    if(btn) { btn.innerText = "ATUALIZAR"; btn.style.background = "var(--warning)"; }
    document.getElementById("btn-cancelar-profissional").style.display = "block";
    document.getElementById("profissionais").scrollIntoView({ behavior: 'smooth' });
}

function cancelarEdicaoProfissional() {
    idProfissionalEdicao = null;
    document.getElementById("prof-nome").value = "";
    document.getElementById("prof-telefone").value = "";
    document.getElementById("prof-especialidade").value = "";
    document.getElementById("prof-comissao").value = "";
    const btn = document.getElementById("btn-salvar-profissional");
    if(btn) { btn.innerText = "Salvar"; btn.style.background = ""; }
    document.getElementById("btn-cancelar-profissional").style.display = "none";
}

function excluirProfissional(id) {
    if(confirm("Excluir esta profissional? O histórico de vendas dela será mantido, mas ela some dos filtros.")) {
        db.ref(`profissionais/${id}`).remove().then(() => dispararToast("Profissional removida!", "error"));
    }
}

// Popula todos os <select> de filtro/seleção de profissional espalhados pelo sistema
function renderSelectsProfissionais() {
    const opcoes = store.profissionais
        .slice()
        .sort((a,b) => a.nome.localeCompare(b.nome))
        .map(p => `<option value="${p.id}">${p.nome}</option>`).join("");

    // Select do PDV/Caixa (obrigatório escolher quem atendeu)
    const selPdv = document.getElementById("pdv-profissional");
    if(selPdv) {
        const valorAtual = selPdv.value;
        selPdv.innerHTML = `<option value="">Selecione...</option>${opcoes}`;
        if(valorAtual) selPdv.value = valorAtual;
    }

    // Selects de filtro (Agenda, Financeiro, Dashboard, Clientes) - todos têm opção "Todas"
    ["agenda-filtro-profissional", "financeiro-filtro-profissional", "dash-filtro-profissional", "clientes-filtro-profissional"].forEach(idSel => {
        const sel = document.getElementById(idSel);
        if(sel) {
            const valorAtual = sel.value;
            sel.innerHTML = `<option value="">Todas as Profissionais</option>${opcoes}`;
            if(valorAtual) sel.value = valorAtual;
        }
    });
}

function atualizarKPIs() {
    const filtroDash = document.getElementById("dash-filtro-profissional") ? document.getElementById("dash-filtro-profissional").value : "";
    const filtroFin = document.getElementById("financeiro-filtro-profissional") ? document.getElementById("financeiro-filtro-profissional").value : "";

    const hoje = new Date().toISOString().split('T')[0];
    const atendimentosHoje = store.atendimentos
        .filter(a => a.data === hoje)
        .filter(a => !filtroDash || a.profissionalId == filtroDash);
    const fatHoje = atendimentosHoje.reduce((acc, a) => acc + a.total, 0);
    const retornosPendentes = store.clientes.filter(c => c.previsaoRetorno && c.previsaoRetorno <= hoje).length;
    const totalPontos = store.clientes.reduce((acc, c) => acc + (c.pontos || 0), 0);
    
    document.getElementById("dash-faturamento").innerText = `R$ ${fatHoje.toFixed(2)}`;
    document.getElementById("dash-atendimentos").innerText = atendimentosHoje.length;
    document.getElementById("dash-retornos").innerText = retornosPendentes;
    document.getElementById("dash-pontos").innerText = totalPontos;
    
    const mesAtual = new Date().getMonth();
    const entMes = store.atendimentos
        .filter(a => new Date(a.data).getMonth() === mesAtual)
        .filter(a => !filtroFin || a.profissionalId == filtroFin)
        .reduce((acc, a) => acc + a.total, 0);
    const saiMes = store.despesas.filter(d => new Date(d.data).getMonth() === mesAtual).reduce((acc, d) => acc + d.valor, 0);
    document.getElementById("fin-entradas").innerText = `R$ ${entMes.toFixed(2)}`;
    document.getElementById("fin-saidas").innerText = `R$ ${saiMes.toFixed(2)}`;
    document.getElementById("fin-lucro").innerText = `R$ ${(entMes - saiMes).toFixed(2)}`;

    // Repasse (comissão) da profissional selecionada para o salão
    const cardRepasse = document.getElementById("card-repasse-profissional");
    if(cardRepasse) {
        const prof = filtroFin ? store.profissionais.find(p => p.id == filtroFin) : null;
        if(prof) {
            const percent = prof.comissao || 0;
            const valorRepasse = entMes * (percent / 100);
            document.getElementById("repasse-nome-prof").innerText = prof.nome;
            document.getElementById("repasse-percent").innerText = percent;
            document.getElementById("repasse-valor").innerText = `R$ ${valorRepasse.toFixed(2)}`;
            document.getElementById("repasse-base").innerText = entMes.toFixed(2);
            cardRepasse.style.display = "block";
        } else {
            cardRepasse.style.display = "none";
        }
    }
}

function renderTabelaFinanceiro() {
    const tbody = document.getElementById("tabela-financeiro");
    if(!tbody) return;
    const filtroFin = document.getElementById("financeiro-filtro-profissional") ? document.getElementById("financeiro-filtro-profissional").value : "";

    const receitas = store.atendimentos
        .filter(a => !filtroFin || a.profissionalId == filtroFin)
        .map(a => ({ data: a.data, desc: `Venda: ${a.nomeCliente}${a.nomeProfissional ? ' (💅 ' + a.nomeProfissional + ')' : ''}`, tipo: 'entrada', valor: a.total }));
    // Despesas são do salão como um todo, então só aparecem quando não há filtro de profissional específico
    const saidas = filtroFin ? [] : store.despesas.map(d => ({ data: d.data, desc: d.descricao, tipo: 'saida', valor: d.valor }));
    const extrato = [...receitas, ...saidas].sort((a,b) => new Date(b.data) - new Date(a.data));
    tbody.innerHTML = extrato.map(item => `<tr><td>${formatarData(item.data)}</td><td>${item.desc}</td><td><span class="badge" style="${item.tipo==='entrada'?'background:#10b98120;color:#10b981':'background:#f43f5e20;color:#f43f5e'}">${item.tipo.toUpperCase()}</span></td><td>R$ ${item.valor.toFixed(2)}</td></tr>`).join("");
}

// -----------------------------------------------------------
// ATUALIZAÇÃO IMPORTANTE NO GRÁFICO (AGRUPAMENTO POR DIA)
// -----------------------------------------------------------
// Função auxiliar para definir datas rápidas (Hoje, 7 dias, etc)
function setPeriodoGrafico(tipo) {
    const hoje = new Date().toISOString().split('T')[0];
    const inputFim = document.getElementById("dash-grafico-fim");
    const inputInicio = document.getElementById("dash-grafico-inicio");

    inputFim.value = hoje;

    if (tipo === 'hoje') {
        inputInicio.value = hoje;
    } else if (tipo === '7dias') {
        const seteDiasAtras = new Date();
        seteDiasAtras.setDate(seteDiasAtras.getDate() - 6);
        inputInicio.value = seteDiasAtras.toISOString().split('T')[0];
    }
    
    atualizarGraficos();
}

// Gráficos atualizados com filtro por data
function atualizarGraficos() {
    let dataInicio = document.getElementById("dash-grafico-inicio").value;
    let dataFim = document.getElementById("dash-grafico-fim").value;

    // Se não houver data definida, assume os últimos 7 dias por padrão
    if (!dataInicio || !dataFim) {
        const hoje = new Date();
        const seteDiasAtras = new Date();
        seteDiasAtras.setDate(hoje.getDate() - 6);
        
        dataInicio = seteDiasAtras.toISOString().split('T')[0];
        dataFim = hoje.toISOString().split('T')[0];
        
        document.getElementById("dash-grafico-inicio").value = dataInicio;
        document.getElementById("dash-grafico-fim").value = dataFim;
    }

    const filtroDash = document.getElementById("dash-filtro-profissional") ? document.getElementById("dash-filtro-profissional").value : "";

    // Filtrar atendimentos dentro do período selecionado (e por profissional, se selecionado)
    const atendimentosFiltrados = store.atendimentos
        .filter(a => a.data >= dataInicio && a.data <= dataFim)
        .filter(a => !filtroDash || a.profissionalId == filtroDash);

    // 1. Lógica do Gráfico de Rosca (Serviços)
    const contagem = {}; 
    atendimentosFiltrados.forEach(a => {
        if(a.servicos) {
            a.servicos.forEach(s => contagem[s.nome] = (contagem[s.nome] || 0) + 1);
        }
    });
    const sorted = Object.entries(contagem).sort((a,b) => b[1] - a[1]).slice(0,5);
    
    if(chartTop) chartTop.destroy();
    chartTop = new Chart(document.getElementById("chartTopServicos"), {
        type: 'doughnut',
        data: { 
            labels: sorted.map(x => x[0]), 
            datasets: [{ 
                data: sorted.map(x => x[1]), 
                backgroundColor: ['#d946ef', '#8b5cf6', '#6366f1', '#ec4899', '#a855f7'], 
                borderColor: '#09090b', 
                borderWidth: 2 
            }] 
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'right', labels: { color: '#fff', boxWidth: 10 } } } }
    });

    // 2. Lógica do Gráfico de Linha (Faturamento Agrupado)
    const diasRange = [];
    const faturamentosRange = [];
    
    let atual = new Date(dataInicio + 'T00:00:00');
    const fim = new Date(dataFim + 'T00:00:00');

    while (atual <= fim) {
        const dataStr = atual.toISOString().split('T')[0];
        const label = `${atual.getDate()}/${atual.getMonth() + 1}`;
        
        diasRange.push(label);
        
        const totalDoDia = store.atendimentos
            .filter(a => a.data === dataStr)
            .filter(a => !filtroDash || a.profissionalId == filtroDash)
            .reduce((acc, curr) => acc + parseFloat(curr.total), 0);
            
        faturamentosRange.push(totalDoDia);
        atual.setDate(atual.getDate() + 1);
    }

    if(chartSemana) chartSemana.destroy();
    chartSemana = new Chart(document.getElementById("chartSemanal"), {
        type: 'line',
        data: { 
            labels: diasRange, 
            datasets: [{ 
                label: 'Faturamento (R$)', 
                data: faturamentosRange,
                borderColor: '#10b981', 
                backgroundColor: 'rgba(16, 185, 129, 0.1)', 
                borderWidth: 3, 
                tension: 0.4, 
                fill: true, 
                pointBackgroundColor: '#09090b', 
                pointBorderColor: '#10b981', 
                pointBorderWidth: 2 
            }] 
        },
        options: { 
            responsive: true, 
            maintainAspectRatio: false, 
            plugins: { legend: { display: false } }, 
            scales: { 
                y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#a1a1aa' }, beginAtZero: true }, 
                x: { grid: { display: false }, ticks: { color: '#a1a1aa' } } 
            } 
        }
    });
}

function filtrarClientes() {
    const inputBusca = document.getElementById("busca-cliente");
    if(!inputBusca) return;
    const termo = inputBusca.value.toLowerCase();
    const filtroProfissional = document.getElementById("clientes-filtro-profissional") ? document.getElementById("clientes-filtro-profissional").value : "";
    const linhas = document.querySelectorAll("#tabela-clientes tr");
    linhas.forEach(linha => {
        const txt = linha.innerText.toLowerCase();
        const bateTexto = txt.includes(termo);

        let bateProfissional = true;
        if(filtroProfissional) {
            const clienteId = linha.getAttribute("data-cliente-id");
            bateProfissional = store.atendimentos.some(a => a.clienteId == clienteId && a.profissionalId == filtroProfissional);
        }

        linha.style.display = (bateTexto && bateProfissional) ? "" : "none";
    });
}

function formatarData(dataISO) {
    if(!dataISO) return "";
    const [ano, mes, dia] = dataISO.split("-");
    return `${dia}/${mes}/${ano}`;
}

// ==========================================
// 13. NOTIFICAÇÕES (LÓGICA)
// ==========================================
function verificarNotificacoes() {
    const hoje = new Date();
    const amanha = new Date(hoje);
    amanha.setDate(hoje.getDate() + 1);
    
    // Formata para YYYY-MM-DD mantendo o fuso local (evita erro de virada de dia UTC)
    const y = amanha.getFullYear();
    const m = String(amanha.getMonth() + 1).padStart(2, '0');
    const d = String(amanha.getDate()).padStart(2, '0');
    const dataAmanhaStr = `${y}-${m}-${d}`;

    const clientesAmanha = store.atendimentos.filter(a => a.data === dataAmanhaStr);
    
    const badge = document.getElementById("badge-notificacao");
    const lista = document.getElementById("lista-notificacoes-itens");
    
    // Atualiza a bolinha vermelha
    if (clientesAmanha.length > 0) {
        badge.style.display = "flex";
        badge.innerText = clientesAmanha.length;
        
        // Atualiza a lista
        lista.innerHTML = clientesAmanha.map(a => `
            <div class="notif-item">
                <div>
                    <strong>${a.nomeCliente}</strong>
                    <span>${a.hora} - ${a.servicos.map(s => s.nome).join(", ")}</span>
                </div>
            </div>
        `).join("");
    } else {
        badge.style.display = "none";
        lista.innerHTML = `<p style="padding:15px; opacity:0.5; font-size:12px; text-align:center;">Nenhum agendamento para amanhã.</p>`;
    }
}

function toggleNotificacoes() {
    const dropdown = document.getElementById("dropdown-notificacoes");
    if (dropdown.classList.contains('active')) {
        dropdown.classList.remove('active');
    } else {
        dropdown.classList.add('active');
    }
}

// Fecha dropdown ao clicar fora dele
document.addEventListener('click', function(e) {
    const wrapper = document.querySelector('.notification-wrapper');
    const dropdown = document.getElementById("dropdown-notificacoes");
    
    if (wrapper && !wrapper.contains(e.target)) {
        dropdown.classList.remove('active');
    }
});

// ==========================================
// 12. MÁSCARAS DE INPUT (UX)
// ==========================================
document.addEventListener('input', function (e) {
    const target = e.target;

    // Máscara de Telefone (id contém 'tel')
    if (target.id.includes('tel')) {
        let x = target.value.replace(/\D/g, '').match(/(\d{0,2})(\d{0,5})(\d{0,4})/);
        target.value = !x[2] ? x[1] : '(' + x[1] + ') ' + x[2] + (x[3] ? '-' + x[3] : '');
    }
});