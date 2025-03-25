const CACHE_NAME = 'mcp-chatbot-v1';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/styles.css',
  '/app.js',
  '/manifest.json'
];

// Install event - cache assets
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Opened cache');
        return cache.addAll(ASSETS_TO_CACHE);
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

// Fetch event - serve from cache or network
self.addEventListener('fetch', event => {
  // Skip socket.io requests
  if (event.request.url.includes('/socket.io/')) {
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Return cached response if found
        if (response) {
          return response;
        }

        // Clone the request
        const fetchRequest = event.request.clone();

        // Make network request
        return fetch(fetchRequest).then(
          response => {
            // Check if valid response
            if (!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }

            // Clone the response
            const responseToCache = response.clone();

            // Cache the response
            caches.open(CACHE_NAME)
              .then(cache => {
                cache.put(event.request, responseToCache);
              });

            return response;
          }
        );
      })
  );
});

// Message storage using IndexedDB
const DB_NAME = 'mcp-chatbot-db';
const DB_VERSION = 1;
const MESSAGES_STORE = 'messages';

// Open IndexedDB
function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    
    request.onerror = event => {
      reject('Error opening IndexedDB');
    };
    
    request.onsuccess = event => {
      resolve(event.target.result);
    };
    
    request.onupgradeneeded = event => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(MESSAGES_STORE)) {
        db.createObjectStore(MESSAGES_STORE, { keyPath: 'id', autoIncrement: true });
      }
    };
  });
}

// Store message in IndexedDB
async function storeMessage(conversationId, message) {
  try {
    const db = await openDB();
    const transaction = db.transaction(MESSAGES_STORE, 'readwrite');
    const store = transaction.objectStore(MESSAGES_STORE);
    
    const messageData = {
      conversationId,
      message,
      timestamp: Date.now()
    };
    
    store.add(messageData);
    
    return new Promise((resolve, reject) => {
      transaction.oncomplete = () => resolve(true);
      transaction.onerror = () => reject('Error storing message');
    });
  } catch (error) {
    console.error('Failed to store message:', error);
    return false;
  }
}

// Get messages for a conversation
async function getMessages(conversationId) {
  try {
    const db = await openDB();
    const transaction = db.transaction(MESSAGES_STORE, 'readonly');
    const store = transaction.objectStore(MESSAGES_STORE);
    
    const messages = [];
    
    return new Promise((resolve, reject) => {
      store.openCursor().onsuccess = event => {
        const cursor = event.target.result;
        if (cursor) {
          if (cursor.value.conversationId === conversationId) {
            messages.push(cursor.value);
          }
          cursor.continue();
        } else {
          resolve(messages.sort((a, b) => a.timestamp - b.timestamp));
        }
      };
      
      transaction.onerror = () => reject('Error retrieving messages');
    });
  } catch (error) {
    console.error('Failed to get messages:', error);
    return [];
  }
}

// Listen for message storage requests from the client
self.addEventListener('message', async event => {
  const data = event.data;
  
  if (data.action === 'storeMessage') {
    const result = await storeMessage(data.conversationId, data.message);
    event.ports[0].postMessage({ success: result });
  } else if (data.action === 'getMessages') {
    const messages = await getMessages(data.conversationId);
    event.ports[0].postMessage({ messages });
  }
});