// Nombre de la caché - CAMBIA ESTE NÚMERO CADA VEZ QUE ACTUALICES
const CACHE_NAME = 'gestion-apps-v1.0.0';
const APP_VERSION = '1.0.0';

// Archivos a cachear
const ARCHIVOS_CACHE = [
  './AppGestionAppsFinal.html',
  'https://unpkg.com/tailwindcss-cdn@3.4.10/tailwindcss.js',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css'
];

// Evento 'install'
self.addEventListener('install', event => {
  console.log('[SW] Instalando versión:', APP_VERSION);
  
  // Fuerza la activación inmediata, incluso con pestañas abiertas
  self.skipWaiting();
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[SW] Cacheando archivos esenciales');
        return cache.addAll(ARCHIVOS_CACHE);
      })
      .then(() => {
        console.log('[SW] Instalación completada');
        return self.skipWaiting(); // Doble seguridad
      })
  );
});

// Evento 'activate'
self.addEventListener('activate', event => {
  console.log('[SW] Activado versión:', APP_VERSION);
  
  event.waitUntil(
    // Limpiar todas las cachés antiguas
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('[SW] Borrando caché antigua:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      // Reclamar control inmediatamente sobre todas las pestañas
      return self.clients.claim();
    }).then(() => {
      // Enviar mensaje a todas las pestañas para recargar
      return self.clients.matchAll().then(clients => {
        clients.forEach(client => {
          client.postMessage({
            type: 'SW_UPDATED',
            version: APP_VERSION
          });
        });
      });
    })
  );
});

// Evento 'fetch'
self.addEventListener('fetch', event => {
  // Para el HTML principal, siempre intenta red primero (para obtener actualizaciones)
  if (event.request.url.includes('AppGestionAppsFinal.html') || 
      event.request.mode === 'navigate') {
    console.log('[SW] Fetch para HTML, usando network-first');
    
    event.respondWith(
      fetch(event.request)
        .then(response => {
          // Si hay respuesta de red, actualiza la caché
          const responseClone = response.clone();
          caches.open(CACHE_NAME)
            .then(cache => cache.put(event.request, responseClone));
          return response;
        })
        .catch(() => {
          // Si falla la red, usa la caché
          return caches.match(event.request);
        })
    );
    return;
  }
  
  // Para recursos estáticos de CDN, usa cache-first pero con validación
  if (event.request.url.includes('unpkg.com') || 
      event.request.url.includes('cdnjs.cloudflare.com')) {
    
    event.respondWith(
      caches.match(event.request)
        .then(cachedResponse => {
          // Siempre hacer fetch en segundo plano para actualizar
          const fetchPromise = fetch(event.request)
            .then(networkResponse => {
              // Actualizar caché con nueva versión
              const responseClone = networkResponse.clone();
              caches.open(CACHE_NAME)
                .then(cache => cache.put(event.request, responseClone));
              return networkResponse;
            })
            .catch(() => {}); // Ignorar errores en fetch de fondo
          
          // Devolver caché inmediatamente, pero actualizar en segundo plano
          return cachedResponse || fetchPromise;
        })
    );
    return;
  }
  
  // Para API de GitHub, network only
  if (event.request.url.includes('api.github.com')) {
    event.respondWith(fetch(event.request));
    return;
  }
  
  // Para el resto, cache-first normal
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        return response || fetch(event.request);
      })
  );
});

// Escuchar mensajes desde la página web
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'CHECK_UPDATE') {
    // Verificar actualizaciones
    self.registration.update()
      .then(() => {
        console.log('[SW] Actualización verificada');
      });
  }
});

// Verificar actualizaciones cada 1 hora
self.addEventListener('periodicsync', event => {
  if (event.tag === 'check-updates') {
    console.log('[SW] Verificando actualizaciones periódicas');
    self.registration.update();
  }
});