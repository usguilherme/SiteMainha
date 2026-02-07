// ==========================================
// 1. CONFIGURAÇÃO FIREBASE & ESTADO GLOBAL
// ==========================================
const firebaseConfig = {
    apiKey: "AIzaSyCc5WfEY8BVaD0JN_Jqo2MB7Ib_qJT8JT4",
    authDomain: "nayarasite-cbb98.firebaseapp.com",
    databaseURL: "https://nayarasite-cbb98-default-rtdb.firebaseio.com", 
    projectId: "nayarasite-cbb98",
    storageBucket: "nayarasite-cbb98.firebasestorage.app",
    messagingSenderId: "702601827572",
    appId: "1:702601827572:web:777a342bb13fa67af7baa1",
    measurementId: "G-KLQ8BFVVFD"
};

// Inicializa Firebase apenas se ainda não estiver ativo
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
const db = firebase.database();

// Estado Global (Cache)
let store = {
    servicos: [],
    clientes: [],
    atendimentos: [],
    despesas: [],
    carrinho: []
};

// Variáveis de Controle e Edição
let chartTop = null;
let chartSemana = null;
let idDespesaEdicao = null;
let idServicoEdicao = null;
let idAtendimentoEdicao = null; 

// ==========================================
// 2. INICIALIZAÇÃO E AUTENTICAÇÃO
// ==========================================
document.addEventListener("DOMContentLoaded", () => {
    lucide.createIcons();
    const loader = document.getElementById("loader-overlay");
    
    const usuarioLogado = localStorage.getItem("cn_user");
    
    setTimeout(() => {
        if(loader) {
            loader.style.opacity = '0';
            setTimeout(() => loader.style.display = 'none', 500);
        }

        if(usuarioLogado) {
            inicializarSistema();
        } else {
            document.getElementById("login-overlay").style.display = 'flex';
        }
    }, 1500);

    const options = { weekday: 'long', day: 'numeric', month: 'long' };
    const dateEl = document.getElementById("data-hoje");
    if(dateEl) dateEl.innerText = new Date().toLocaleDateString('pt-BR', options);
});

function verificarSenha() {
    const senha = document.getElementById("input-senha").value;
    if(senha === "cassiahair" || senha === "admin") {
        localStorage.setItem("cn_user", "admin");
        document.getElementById("login-overlay").style.display = "none";
        inicializarSistema();
    } else {
        const erro = document.getElementById("erro-senha");
        erro.style.display = "block";
        document.querySelector('.login-card').animate([
            { transform: 'translateX(-10px)' },
            { transform: 'translateX(10px)' },
            { transform: 'translateX(0)' }
        ], { duration: 300 });
    }
}

function logout() {
    localStorage.removeItem("cn_user");
    location.reload();
}

function inicializarSistema() {
    console.log("Sistema Cassia Nunes Iniciado");
    
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
    });

    db.ref('despesas').on('value', snap => {
        store.despesas = snap.val() ? Object.values(snap.val()) : [];
        renderTabelaFinanceiro();
        renderListaGestaoDespesas();
        atualizarKPIs();
    });
}

// ==========================================
// 3. NAVEGAÇÃO E UI
// ==========================================
function abrirAba(idAba) {
    document.querySelectorAll('.aba').forEach(el => {
        el.style.display = 'none';
        el.classList.remove('fade-in');
    });
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
    
    const aba = document.getElementById(idAba);
    if(aba) {
        aba.style.display = 'block';
        setTimeout(() => aba.classList.add('fade-in'), 10);
    }
    
    const btnMenu = document.querySelector(`.nav-item[onclick*="${idAba}"]`);
    if(btnMenu) btnMenu.classList.add('active');

    const titulos = {
        'dashboard': 'Visão Geral',
        'novo_atendimento': 'Ponto de Venda',
        'clientes': 'Carteira de Clientes',
        'financeiro': 'Fluxo de Caixa',
        'agenda': 'Agenda Diária',
        'servicos': 'Catálogo',
        'despesas': 'Gestão de Despesas'
    };
    const tituloEl = document.getElementById('titulo-pagina');
    if(tituloEl) tituloEl.innerText = titulos[idAba] || 'Cassia Nunes';
    lucide.createIcons();
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
    
    container.style.position = 'fixed';
    container.style.bottom = '20px';
    container.style.right = '20px';
    container.style.zIndex = '9999';

    container.appendChild(el);
    setTimeout(() => el.remove(), 3000);
}

// ==========================================
// 4. MÓDULO: PDV (CAIXA)
// ==========================================
function renderServicosPDV() {
    const sel = document.getElementById("pdv-servico");
    if(!sel) return;
    sel.innerHTML = '<option value="">Selecione um serviço...</option>' + 
        store.servicos.map(s => `<option value="${s.id}" data-preco="${s.preco}">${s.nome} - R$ ${parseFloat(s.preco).toFixed(2)}</option>`).join("");
}

function renderClientesPDV() {
    const sel = document.getElementById("pdv-cliente");
    if(!sel) return;
    sel.innerHTML = '<option value="">Cliente Avulso / Sem Cadastro</option>' + 
        store.clientes.map(c => `<option value="${c.id}">${c.nome}</option>`).join("");
}

function adicionarAoCarrinho() {
    const sel = document.getElementById("pdv-servico");
    const id = sel.value;
    if(!id) return dispararToast("Selecione um serviço!", "error");

    const servico = store.servicos.find(s => s.id == id);
    // Clonar para evitar referência
    store.carrinho.push({ ...servico });
    renderCarrinho();
}

function renderCarrinho() {
    const lista = document.getElementById("lista-carrinho");
    let total = 0;
    
    if(store.carrinho.length === 0) {
        lista.innerHTML = '<li class="empty-state">Carrinho vazio...</li>';
        document.getElementById("pdv-total").innerText = "R$ 0,00";
        if(document.getElementById("pdv-troco-display")) {
             document.getElementById("pdv-troco-display").innerText = "R$ 0,00";
        }
        return;
    }

    lista.innerHTML = store.carrinho.map((item, index) => {
        total += parseFloat(item.preco);
        return `<li>
            <span>${item.nome}</span>
            <div style="display:flex; align-items:center; gap:10px">
                <strong>R$ ${parseFloat(item.preco).toFixed(2)}</strong>
                <i data-lucide="trash-2" onclick="removerDoCarrinho(${index})" style="width:14px; cursor:pointer; color:#f43f5e"></i>
            </div>
        </li>`;
    }).join("");
    
    lucide.createIcons();
    document.getElementById("pdv-total").innerText = `R$ ${total.toFixed(2)}`;

    if(document.getElementById("pdv-pagamento").value === "Dinheiro") {
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
    const area = document.getElementById("area-troco");
    if(!area) return;

    if(tipo === "Dinheiro") {
        area.style.display = "block";
    } else {
        area.style.display = "none";
        document.getElementById("pdv-valor-pago").value = "";
        document.getElementById("pdv-troco-display").innerText = "R$ 0,00";
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

function finalizarVenda() {
    if(store.carrinho.length === 0) return dispararToast("Carrinho vazio!", "error");

    const idCliente = document.getElementById("pdv-cliente").value;
    const pagamento = document.getElementById("pdv-pagamento").value;
    const retorno = document.getElementById("pdv-retorno").value;
    const obs = document.getElementById("pdv-obs").value;
    const total = store.carrinho.reduce((acc, i) => acc + parseFloat(i.preco), 0);

    let nomeCliente = "Cliente Avulso";
    if(idCliente) {
        const c = store.clientes.find(x => x.id == idCliente);
        if(c) nomeCliente = c.nome;
    }

    // Se estiver editando, usa o ID existente, senão cria novo
    const id = idAtendimentoEdicao || Date.now();

    const atendimento = {
        id: id,
        data: new Date().toISOString().split('T')[0],
        hora: new Date().toLocaleTimeString('pt-BR').substr(0,5),
        timestamp: Date.now(),
        clienteId: idCliente || null,
        nomeCliente: nomeCliente,
        servicos: store.carrinho,
        total: total,
        pagamento: pagamento,
        obs: obs,
        previsaoRetorno: retorno || null
    };

    if (idAtendimentoEdicao) {
        // Atualiza existente
        db.ref(`atendimentos/${id}`).update(atendimento);
        dispararToast("Atendimento atualizado!");
        idAtendimentoEdicao = null; // Reseta modo edição
    } else {
        // Cria novo
        db.ref(`atendimentos/${id}`).set(atendimento);
        dispararToast("✅ Venda Finalizada!");
    }

    if(idCliente) {
        let updates = { ultimaVisita: atendimento.data };
        if(retorno) updates.previsaoRetorno = retorno;
        db.ref(`clientes/${idCliente}`).update(updates);
    }

    // Resetar campos
    store.carrinho = [];
    document.getElementById("pdv-obs").value = "";
    document.getElementById("pdv-retorno").value = "";
    const diasInput = document.getElementById("pdv-dias-retorno");
    if(diasInput) diasInput.value = "";
    const valorPagoInput = document.getElementById("pdv-valor-pago");
    if(valorPagoInput) valorPagoInput.value = "";
    
    // Reseta select de cliente
    document.getElementById("pdv-cliente").value = "";
    
    toggleTroco();
    renderCarrinho();
}

// ==========================================
// 5. MÓDULO: AGENDA & EDIÇÃO DE VENDAS
// ==========================================
function renderAgenda() {
    const div = document.getElementById("lista-agenda");
    const hoje = new Date().toISOString().split('T')[0];
    const agendaHoje = store.atendimentos.filter(a => a.data === hoje).sort((a,b) => b.timestamp - a.timestamp);

    const dateDisplay = document.getElementById("agenda-data-display");
    if(dateDisplay) dateDisplay.innerText = new Date().toLocaleDateString('pt-BR', {weekday:'long', day:'numeric'});

    if(agendaHoje.length === 0) {
        div.innerHTML = "<p class='text-muted'>Nenhum atendimento registrado hoje.</p>";
        return;
    }

    div.innerHTML = agendaHoje.map(a => `
        <div class="glass-panel" style="padding:15px; margin-bottom:10px; border-left:4px solid var(--primary); display:flex; justify-content:space-between; align-items:center">
            <div>
                <strong style="font-size:18px">${a.hora}</strong>
                <h4>${a.nomeCliente}</h4>
                <small class="text-muted">${a.servicos.map(s => s.nome).join(", ")}</small>
            </div>
            <div style="display:flex; align-items:center; gap:10px">
                <h3 style="color:var(--success); margin-right:10px">R$ ${a.total.toFixed(2)}</h3>
                
                <button class="btn-small bg-yellow" onclick="editarAtendimento(${a.id})" title="Editar Venda">
                    <i data-lucide="pencil" style="width:14px"></i>
                </button>
                
                <button class="btn-small bg-purple" onclick="if(confirm('Excluir este atendimento?')) db.ref('atendimentos/${a.id}').remove()" title="Excluir">
                    <i data-lucide="trash-2" style="width:14px"></i>
                </button>
            </div>
        </div>
    `).join("");
    lucide.createIcons();
}

function editarAtendimento(id) {
    const a = store.atendimentos.find(item => item.id === id);
    if (!a) return;

    // Carrega dados de volta para o PDV
    idAtendimentoEdicao = id;
    
    // Configura Cliente
    document.getElementById("pdv-cliente").value = a.clienteId || "";
    
    // Configura Carrinho
    store.carrinho = a.servicos ? [...a.servicos] : [];
    
    // Configura Pagamento e Obs
    document.getElementById("pdv-pagamento").value = a.pagamento || "Dinheiro";
    document.getElementById("pdv-obs").value = a.obs || "";
    document.getElementById("pdv-retorno").value = a.previsaoRetorno || "";

    // Renderiza o carrinho atualizado
    renderCarrinho();
    
    // Leva o usuário para a aba de Venda
    abrirAba('novo_atendimento');
    
    dispararToast("Modo de edição ativado para: " + a.nomeCliente);
}

// ==========================================
// 6. CLIENTES & RETORNOS
// ==========================================
function renderTabelaClientes() {
    const tbody = document.getElementById("tabela-clientes");
    if(!tbody) return;

    tbody.innerHTML = store.clientes.map(c => {
        const telefoneClean = c.telefone ? c.telefone.replace(/\D/g, '') : '';
        const linkZap = telefoneClean ? `https://wa.me/55${telefoneClean}?text=Olá ${c.nome}, Cassia Nunes passando para confirmar seu horário!` : '#';
        
        return `
        <tr>
            <td>
                <strong>${c.nome}</strong><br>
                <span style="font-size:12px; opacity:0.7">${c.telefone || 'Sem telefone'}</span>
            </td>
            <td><span class="badge" style="background:#22c55e20; color:#22c55e">ATIVO</span></td>
            <td>${c.ultimaVisita ? formatarData(c.ultimaVisita) : '-'}</td>
            <td>${c.previsaoRetorno ? formatarData(c.previsaoRetorno) : '-'}</td>
            <td>
                <button class="btn-small bg-purple" onclick="abrirModalAnamnese(${c.id})"><i data-lucide="clipboard-list"></i></button>
                ${telefoneClean ? `<a href="${linkZap}" target="_blank"><button class="btn-small bg-green"><i data-lucide="message-circle"></i></button></a>` : ''}
            </td>
        </tr>
    `}).join("");
    lucide.createIcons();
}

function filtrarRetornosDashboard() {
    const div = document.getElementById("lista-retornos-dashboard");
    if(!div) return;

    const filtroData = document.getElementById("dash-filtro-data").value;
    const hoje = new Date().toISOString().split('T')[0];
    
    let lista = [];

    if (filtroData) {
        lista = store.clientes.filter(c => c.previsaoRetorno === filtroData);
    } else {
        lista = store.clientes.filter(c => c.previsaoRetorno && c.previsaoRetorno <= hoje);
    }
    
    if(lista.length === 0) {
        const msg = filtroData ? "Nenhum retorno para esta data." : "Nenhum retorno urgente.";
        div.innerHTML = `<p style='padding:15px; opacity:0.6'>${msg}</p>`;
        return;
    }

    div.innerHTML = lista.map(c => {
        const telefoneClean = c.telefone ? c.telefone.replace(/\D/g, '') : '';
        const linkZap = telefoneClean ? `https://wa.me/55${telefoneClean}?text=Oi ${c.nome}, seu retorno está previsto para ${formatarData(c.previsaoRetorno)}.` : '#';
        const isLate = c.previsaoRetorno < hoje;
        const color = isLate ? '#f43f5e' : '#f59e0b';
        
        return `
        <div style="padding:10px; border-bottom:1px solid var(--border); display:flex; justify-content:space-between; align-items:center">
            <div>
                <strong>${c.nome}</strong><br>
                <small style="color:${color}">${isLate ? 'Atrasado: ' : 'Data: '}${formatarData(c.previsaoRetorno)}</small>
            </div>
            ${telefoneClean ? `<a href="${linkZap}" target="_blank" class="btn-small bg-green" style="text-decoration:none">Chamar</a>` : ''}
        </div>
    `}).join("");
}

function limparFiltroRetorno() {
    const input = document.getElementById("dash-filtro-data");
    if(input) {
        input.value = "";
        filtrarRetornosDashboard();
    }
}

function abrirModalCliente() {
    const nome = prompt("Nome do Cliente:");
    if(nome) {
        const tel = prompt("Telefone (com DDD):");
        const id = Date.now();
        db.ref(`clientes/${id}`).set({
            id, nome, telefone: tel, dataCadastro: new Date().toISOString()
        });
        dispararToast("Cliente cadastrado!");
    }
}

// ==========================================
// 7. DESPESAS
// ==========================================
function lancarDespesa() {
    const desc = document.getElementById("desp-desc").value;
    const valor = parseFloat(document.getElementById("desp-valor").value);
    const data = document.getElementById("desp-data").value;
    const cat = document.getElementById("desp-cat").value;

    if(!desc || isNaN(valor) || !data) return alert("Preencha tudo!");

    if (idDespesaEdicao) {
        db.ref(`despesas/${idDespesaEdicao}`).update({ 
            descricao: desc, valor: valor, data: data, categoria: cat 
        }).then(() => dispararToast("Despesa atualizada!"));
        cancelarEdicaoDespesa();
    } else {
        const id = Date.now();
        db.ref(`despesas/${id}`).set({ 
            id, descricao: desc, valor: valor, data: data, categoria: cat, tipo: 'saida' 
        }).then(() => dispararToast("Despesa salva!"));
        
        document.getElementById("desp-desc").value = "";
        document.getElementById("desp-valor").value = "";
    }
}

function renderListaGestaoDespesas() {
    const tbody = document.getElementById("lista-gestao-despesas");
    if(!tbody) return;
    
    const lista = [...store.despesas].sort((a,b) => new Date(b.data) - new Date(a.data));
    
    tbody.innerHTML = lista.map(d => `
        <tr>
            <td>${formatarData(d.data)}</td>
            <td>${d.descricao}</td>
            <td>R$ ${d.valor.toFixed(2)}</td>
            <td>
                <button class="btn-small bg-yellow" onclick="prepararEdicaoDespesa(${d.id})">Editar</button>
                <button class="btn-small bg-purple" onclick="if(confirm('Apagar?')) db.ref('despesas/${d.id}').remove()">X</button>
            </td>
        </tr>
    `).join("");
}

function prepararEdicaoDespesa(id) {
    const d = store.despesas.find(x => x.id === id);
    if(!d) return;

    document.getElementById("desp-desc").value = d.descricao;
    document.getElementById("desp-valor").value = d.valor;
    document.getElementById("desp-data").value = d.data;
    document.getElementById("desp-cat").value = d.categoria;
    
    idDespesaEdicao = id;
    
    const titulo = document.getElementById("titulo-form-despesa");
    if(titulo) titulo.innerText = "Editar Despesa";
    
    const btnSalvar = document.getElementById("btn-salvar-despesa");
    if(btnSalvar) btnSalvar.innerText = "SALVAR ALTERAÇÕES";
    
    const btnCancelar = document.getElementById("btn-cancelar-despesa");
    if(btnCancelar) btnCancelar.style.display = "inline-block";
    
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function cancelarEdicaoDespesa() {
    idDespesaEdicao = null;
    
    const titulo = document.getElementById("titulo-form-despesa");
    if(titulo) titulo.innerText = "Registrar Despesa";
    
    const btnSalvar = document.getElementById("btn-salvar-despesa");
    if(btnSalvar) btnSalvar.innerText = "LANÇAR DESPESA";
    
    const btnCancelar = document.getElementById("btn-cancelar-despesa");
    if(btnCancelar) btnCancelar.style.display = "none";
    
    document.getElementById("desp-desc").value = "";
    document.getElementById("desp-valor").value = "";
}

// ==========================================
// 8. SERVIÇOS (COM EDIÇÃO)
// ==========================================
function salvarServicoCad() {
    const nome = document.getElementById("serv-nome").value;
    const preco = document.getElementById("serv-preco").value;

    if(!nome || !preco) return dispararToast("Preencha nome e preço!", "error");

    if (idServicoEdicao) {
        db.ref(`servicos/${idServicoEdicao}`).update({ 
            nome: nome, preco: preco 
        }).then(() => dispararToast("Serviço atualizado!"));
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
    
    div.innerHTML = store.servicos.map(s => `
        <div class="glass-panel" style="padding:15px; display:flex; justify-content:space-between; align-items:center; margin-bottom:10px">
            <div>
                <strong>${s.nome}</strong><br>
                <span class="text-gradient">R$ ${parseFloat(s.preco).toFixed(2)}</span>
            </div>
            <div style="display:flex; gap:10px">
                <button class="btn-small bg-yellow" onclick="prepararEdicaoServico(${s.id})" title="Editar">
                    <i data-lucide="pencil" style="width:14px"></i>
                </button>
                <button class="btn-small bg-purple" onclick="if(confirm('Excluir?')) db.ref('servicos/${s.id}').remove()" title="Excluir">
                    <i data-lucide="trash-2" style="width:14px"></i>
                </button>
            </div>
        </div>
    `).join("");
    lucide.createIcons();
}

function prepararEdicaoServico(id) {
    const s = store.servicos.find(x => x.id === id);
    if(!s) return;

    document.getElementById("serv-nome").value = s.nome;
    document.getElementById("serv-preco").value = s.preco;
    
    idServicoEdicao = id;
    
    const btnSalvar = document.getElementById("btn-salvar-servico");
    if(btnSalvar) {
        btnSalvar.innerText = "ATUALIZAR";
        btnSalvar.style.background = "var(--warning)";
    }
    
    const btnCancelar = document.getElementById("btn-cancelar-servico");
    if(btnCancelar) btnCancelar.style.display = "block";
    
    document.getElementById("servicos").scrollIntoView({ behavior: 'smooth' });
}

function cancelarEdicaoServico() {
    idServicoEdicao = null;
    document.getElementById("serv-nome").value = "";
    document.getElementById("serv-preco").value = "";
    
    const btnSalvar = document.getElementById("btn-salvar-servico");
    if(btnSalvar) {
        btnSalvar.innerText = "Salvar";
        btnSalvar.style.background = "";
    }
    
    const btnCancelar = document.getElementById("btn-cancelar-servico");
    if(btnCancelar) btnCancelar.style.display = "none";
}

// ==========================================
// 9. FUNÇÕES AUXILIARES, GRÁFICOS E MODAIS
// ==========================================
function abrirModalAnamnese(id) {
    clienteAnamneseAtual = store.clientes.find(c => c.id == id);
    if(!clienteAnamneseAtual) return;

    document.getElementById("modal-anamnese").style.display = 'flex';
    document.getElementById("anamnese-cliente-nome").innerText = clienteAnamneseAtual.nome;
    renderHistoricoAnamnese();
}

function renderHistoricoAnamnese() {
    const div = document.getElementById("historico-lista");
    const hist = clienteAnamneseAtual.historico ? Object.values(clienteAnamneseAtual.historico) : [];
    
    if(hist.length === 0) {
        div.innerHTML = "<small style='opacity:0.5'>Sem histórico.</small>";
        return;
    }

    div.innerHTML = hist.reverse().map(h => `
        <div style="border-left:2px solid var(--primary); padding-left:10px; margin-bottom:15px">
            <div style="display:flex; justify-content:space-between">
                <strong>${h.titulo}</strong>
                <small style="opacity:0.5">${h.data}</small>
            </div>
            <p style="font-size:13px; color:#ddd; margin-top:5px">${h.obs}</p>
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
        fecharModal('modal-anamnese');
    });
}

function fecharModal(id) {
    document.getElementById(id).style.display = 'none';
}

function atualizarKPIs() {
    const hoje = new Date().toISOString().split('T')[0];
    const atendimentosHoje = store.atendimentos.filter(a => a.data === hoje);
    const fatHoje = atendimentosHoje.reduce((acc, a) => acc + a.total, 0);
    const retornosPendentes = store.clientes.filter(c => c.previsaoRetorno && c.previsaoRetorno <= hoje).length;

    document.getElementById("dash-faturamento").innerText = `R$ ${fatHoje.toFixed(2)}`;
    document.getElementById("dash-atendimentos").innerText = atendimentosHoje.length;
    document.getElementById("dash-retornos").innerText = retornosPendentes;

    const mesAtual = new Date().getMonth();
    const entMes = store.atendimentos.filter(a => new Date(a.data).getMonth() === mesAtual).reduce((acc, a) => acc + a.total, 0);
    const saiMes = store.despesas.filter(d => new Date(d.data).getMonth() === mesAtual).reduce((acc, d) => acc + d.valor, 0);
    
    document.getElementById("fin-entradas").innerText = `R$ ${entMes.toFixed(2)}`;
    document.getElementById("fin-saidas").innerText = `R$ ${saiMes.toFixed(2)}`;
    document.getElementById("fin-lucro").innerText = `R$ ${(entMes - saiMes).toFixed(2)}`;
}

function renderTabelaFinanceiro() {
    const tbody = document.getElementById("tabela-financeiro");
    const receitas = store.atendimentos.map(a => ({ data: a.data, desc: `Venda: ${a.nomeCliente}`, tipo: 'entrada', valor: a.total }));
    const saidas = store.despesas.map(d => ({ data: d.data, desc: d.descricao, tipo: 'saida', valor: d.valor }));
    const extrato = [...receitas, ...saidas].sort((a,b) => new Date(b.data) - new Date(a.data));

    tbody.innerHTML = extrato.map(item => `
        <tr>
            <td>${formatarData(item.data)}</td>
            <td>${item.desc}</td>
            <td><span class="badge" style="${item.tipo==='entrada'?'background:#10b98120;color:#10b981':'background:#f43f5e20;color:#f43f5e'}">${item.tipo.toUpperCase()}</span></td>
            <td>R$ ${item.valor.toFixed(2)}</td>
        </tr>
    `).join("");
}

function atualizarGraficos() {
    const contagem = {};
    store.atendimentos.forEach(a => a.servicos.forEach(s => contagem[s.nome] = (contagem[s.nome] || 0) + 1));
    const sorted = Object.entries(contagem).sort((a,b) => b[1] - a[1]).slice(0,5);

    const ctxTop = document.getElementById("chartTopServicos");
    if(chartTop) chartTop.destroy();
    
    chartTop = new Chart(ctxTop, {
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
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { position: 'right', labels: { color: '#fff', boxWidth: 10 } } }
        }
    });

    const ultimos = store.atendimentos.slice(0, 10).reverse(); 
    const ctxWeek = document.getElementById("chartSemanal");
    if(chartSemana) chartSemana.destroy();

    chartSemana = new Chart(ctxWeek, {
        type: 'line',
        data: {
            labels: ultimos.map(a => a.hora),
            datasets: [{
                label: 'Venda (R$)',
                data: ultimos.map(a => a.total),
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
                y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#a1a1aa' } },
                x: { grid: { display: false }, ticks: { color: '#a1a1aa' } }
            }
        }
    });
}

function filtrarClientes() {
    const termo = document.getElementById("busca-cliente").value.toLowerCase();
    const linhas = document.querySelectorAll("#tabela-clientes tr");
    linhas.forEach(linha => {
        const txt = linha.innerText.toLowerCase();
        linha.style.display = txt.includes(termo) ? "" : "none";
    });
}

function formatarData(dataISO) {
    if(!dataISO) return "";
    const [ano, mes, dia] = dataISO.split("-");
    return `${dia}/${mes}/${ano}`;
}
