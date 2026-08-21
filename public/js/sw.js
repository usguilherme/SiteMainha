const VERSAO = 'v3'; // <--- MUDE ISSO A CADA DEPLOY (v3, v4...) PARA O CELULAR SABER QUE MUDOU
const CACHE_NAME = `cassia-nunes-${VERSAO}`;

// Arquivos que serão salvos para funcionar Offline
const urlsToCache = [
  './',
  './index.html',
  './css/style.css',
  './js/script.js',
  './manifest.json',
  // --- PÁGINAS MODULARES (Garante o funcionamento Offline) ---
  './pages/dashboard.html',
  './pages/agenda.html',
  './pages/novo_atendimento.html',
  './pages/profissionais.html',
  './pages/clientes.html',
  './pages/estoque.html',
  './pages/financeiro.html',
  './pages/servicos.html',
  './pages/despesas.html',
  // -----------------------------------------------------------
  'https://unpkg.com/lucide@latest',
  'https://cdn.jsdelivr.net/npm/chart.js',
  'https://cdnjs.cloudflare.com/ajax/libs/qrious/4.0.2/qrious.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js'
];

// 1. INSTALAÇÃO: Salva os arquivos iniciais
self.addEventListener('install', event => {
  self.skipWaiting(); // Força o novo Service Worker a assumir imediatamente
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Cache aberto');
        return cache.addAll(urlsToCache);
      })
  );
});

// 2. ATIVAÇÃO: Limpa caches antigos para liberar espaço e garantir atualização
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('Deletando cache antigo:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      return self.clients.claim(); // Controla a página imediatamente
    })
  );
});

// 3. INTERCEPTAÇÃO (FETCH): Estratégia Network First (Rede Primeiro)
self.addEventListener('fetch', event => {
  // Ignora chamadas do Firebase/Google (deixa elas passarem direto)
  if (event.request.url.includes('firebase') || event.request.url.includes('googleapis')) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then(response => {
        // Se a rede funcionou, atualiza o cache com a versão nova
        if (!response || response.status !== 200 || response.type !== 'basic') {
          return response;
        }
        
        const responseClone = response.clone();
        caches.open(CACHE_NAME).then(cache => {
          cache.put(event.request, responseClone);
        });
        
        return response;
      })
      .catch(() => {
        // Se a rede falhou (Offline), tenta pegar do cache
        return caches.match(event.request);
      })
  );
});