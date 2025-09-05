const { createClient } = supabase;
const SUPABASE_URL = 'https://umyomcjotcowdzlcxyyi.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVteW9tY2pvdGNvd2R6bGN4eXlpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTcwNzkzMzcsImV4cCI6MjA3MjY1NTMzN30.wSxaf_OlY-sUeO9ANjceXApbT-LgwxHhzOBn_oEnldw';

const highAccuracyOptions = { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 };
const lyceeCenter = [45.96239, 5.34721];

const appState = {
    map: null, supabase: null, currentUser: null, userMarker: null, userAccuracyCircle: null,
    friendMarkers: {}, friends: {}, userName: "", isSharing: true, watchId: null,
    html5QrCode: null, geolocationEnabled: false, mapLayers: {}, isScannerDisabled: true
};

const ui = {};

document.addEventListener('DOMContentLoaded', async () => {
    Object.assign(ui, {
        loader: document.getElementById('loader'),
        authView: document.getElementById('auth-view'),
        appContainer: document.getElementById('app-container'),
        loginContainer: document.getElementById('login-container'),
        signupContainer: document.getElementById('signup-container'),
        loginForm: document.getElementById('login-form'),
        signupForm: document.getElementById('signup-form'),
        loginNameInput: document.getElementById('login-name'),
        loginPasswordInput: document.getElementById('login-password'),
        signupFirstnameInput: document.getElementById('signup-firstname'),
        signupLastnameInput: document.getElementById('signup-lastname'),
        signupPasswordInput: document.getElementById('signup-password'),
        loginBtn: document.getElementById('login-btn'),
        signupBtn: document.getElementById('signup-btn'),
        showLoginBtn: document.getElementById('show-login-btn'),
        showSignupBtn: document.getElementById('show-signup-btn'),
        signupStatus: document.getElementById('signup-status'),
        loginStatus: document.getElementById('login-status'),
        views: { map: document.getElementById('map-view'), friends: document.getElementById('friends-view'), settings: document.getElementById('settings-view') },
        buttons: { map: document.getElementById('map-btn-container'), friends: document.getElementById('friends-btn-container'), settings: document.getElementById('settings-btn-container') },
        status: document.getElementById('status'),
        friendsList: document.getElementById('friends-list'),
        shareLocationToggle: document.getElementById('share-location-toggle'),
        showAttributionToggle: document.getElementById('show-attribution-toggle'),
        disableScannerToggle: document.getElementById('disable-scanner-toggle'),
        topBanner: document.getElementById('top-banner'),
        myQrCodeBtn: document.getElementById('my-qr-code-btn'),
        addFriendBtn: document.getElementById('add-friend-btn'),
        myQrCodeModal: document.getElementById('my-qr-code-modal'),
        qrCodeContainer: document.getElementById('qr-code-container'),
        closeQrCodeModalBtn: document.getElementById('close-qr-code-modal-btn'),
        qrScannerModal: document.getElementById('qr-scanner-modal'),
        qrScannerContainer: document.getElementById('qr-scanner-container'),
        closeScannerModalBtn: document.getElementById('close-scanner-modal-btn'),
        pasteIdModal: document.getElementById('paste-id-modal'),
        pasteIdInput: document.getElementById('paste-id-input'),
        addFriendFromIdBtn: document.getElementById('add-friend-from-id-btn'),
        closePasteIdModalBtn: document.getElementById('close-paste-id-modal-btn'),
        logoutBtn: document.getElementById('logout-btn'),
    });

    try {
        initMap();
        const geoResult = await requestGeolocationPermission();
        appState.geolocationEnabled = geoResult.success;
        if (!geoResult.success) {
            showPermanentBanner(geoResult.error);
        }
        
        await initSupabase();
        setupEventListeners();

    } catch (error) {
        console.error("Fatal initialization error:", error);
        if (ui.loader) {
            ui.loader.innerHTML = `<div class="text-center p-4"><p class="mt-4 text-gray-700 font-semibold">Erreur d'Initialisation</p><p class="mt-2 text-gray-600">${error.message}</p></div>`;
        }
    }
});

const requestGeolocationPermission = () => new Promise((resolve) => {
    if (!("geolocation" in navigator)) {
        resolve({ success: false, error: "Géolocalisation non supportée." });
        return;
    }
    navigator.geolocation.getCurrentPosition(
        (pos) => resolve({ success: true, position: pos }),
        (error) => resolve({ success: false, error: { 1: "Géolocalisation refusée.", 2: "Position indisponible.", 3: "Délai dépassé." }[error.code] || "Erreur inconnue." }),
        highAccuracyOptions
    );
});

const initSupabase = async () => {
    appState.supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    const { data: { session } } = await appState.supabase.auth.getSession();
    
    if (session) {
        appState.currentUser = session.user;
        await loadUserProfile();
    } else {
        ui.loader.classList.add('hidden');
        ui.authView.classList.remove('hidden');
    }
};

const initMap = () => {
    appState.map = L.map('map', { 
        center: lyceeCenter, 
        zoom: 16, 
        minZoom: 16,
        maxZoom: 19,
        zoomControl: false, 
        attributionControl: true,
    });
    
    appState.mapLayers.noLabels = L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager_nolabels/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; OpenStreetMap &copy; CARTO', maxNativeZoom: 19
    });
    appState.mapLayers.withLabels = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap', maxNativeZoom: 19
    });

    appState.mapLayers.noLabels.addTo(appState.map);
    appState.map.attributionControl.setPrefix(false);
};

const loadUserProfile = async () => {
    const { data: profile, error } = await appState.supabase.from('profiles').select('full_name').eq('id', appState.currentUser.id).single();

    if (error || !profile) {
        showStatus("Impossible de charger le profil.", 'error');
        handleLogout();
        return;
    }
    
    appState.userName = profile.full_name;
    const { data: location } = await appState.supabase.from('locations').select('is_sharing').eq('user_id', appState.currentUser.id).single();
    appState.isSharing = location ? location.is_sharing : true;

    ui.shareLocationToggle.checked = appState.isSharing;
    ui.disableScannerToggle.checked = appState.isScannerDisabled;

    ui.loader.classList.add('hidden');
    ui.authView.classList.add('hidden');
    ui.appContainer.classList.remove('hidden');
    showView('map');

    // CORRECTIF : On applique les limites de la carte une fois qu'elle est visible
    const mapBounds = L.circle(lyceeCenter, { radius: 1000 }).getBounds();
    appState.map.setMaxBounds(mapBounds);

    setTimeout(async () => {
        await fetchAndDisplayFriends();
        if (appState.isSharing && appState.geolocationEnabled) startLocationTracking();
        listenToFriendLocations();
    }, 100);
};

const handleSignUp = async (event) => {
    event.preventDefault();
    ui.signupBtn.disabled = true;
    ui.signupBtn.textContent = 'Création...';
    showAuthStatus(ui.signupStatus, '', 'success');
    
    const prenom = ui.signupFirstnameInput.value.trim();
    const nom = ui.signupLastnameInput.value.trim().toLowerCase();
    const password = ui.signupPasswordInput.value;

    if (!nom || !prenom || !password) {
        showAuthStatus(ui.signupStatus, 'Veuillez remplir tous les champs.', 'error');
        ui.signupBtn.disabled = false;
        ui.signupBtn.textContent = 'Créer un compte';
        return;
    }

    const email = `${nom}@geolycee.app`;
    const fullName = `${prenom} ${nom.charAt(0).toUpperCase() + nom.slice(1)}`;

    try {
        const { data, error } = await appState.supabase.auth.signUp({
            email: email,
            password: password,
            options: {
                data: {
                    full_name: fullName
                }
            }
        });

        if (error) {
            showAuthStatus(ui.signupStatus, "Ce nom d'utilisateur existe déjà.", 'error');
        } else {
            showAuthStatus(ui.signupStatus, 'Création de compte réussie ! Redirection...', 'success');
            ui.signupForm.reset();
            setTimeout(() => {
                ui.signupContainer.classList.add('hidden');
                ui.loginContainer.classList.remove('hidden');
                showAuthStatus(ui.signupStatus, '', 'success');
            }, 2000);
        }
    } catch(e) {
        showAuthStatus(ui.signupStatus, "Une erreur est survenue.", "error");
    } finally {
        ui.signupBtn.disabled = false;
        ui.signupBtn.textContent = 'Créer un compte';
    }
};

const handleLogin = async (event) => {
    event.preventDefault();
    ui.loginBtn.disabled = true;
    ui.loginBtn.textContent = 'Connexion...';
    showAuthStatus(ui.loginStatus, '', 'success');

    const nom = ui.loginNameInput.value.trim().toLowerCase();
    const password = ui.loginPasswordInput.value;

    if (!nom || !password) {
        showAuthStatus(ui.loginStatus, 'Veuillez remplir tous les champs.', 'error');
        ui.loginBtn.disabled = false;
        ui.loginBtn.textContent = 'Se connecter';
        return;
    }

    const email = `${nom}@geolycee.app`;

    try {
        const { data, error } = await appState.supabase.auth.signInWithPassword({
            email: email,
            password: password,
        });

        if (error) {
            if (error.message.includes("Invalid login credentials")) {
                showAuthStatus(ui.loginStatus, "Nom ou mot de passe incorrect.", 'error');
            } else {
                showAuthStatus(ui.loginStatus, "Une erreur de connexion est survenue.", 'error');
            }
        } else {
            showStatus("Vous êtes connecté !", "success");
            appState.currentUser = data.user;
            await loadUserProfile();
        }
    } catch (e) {
        showAuthStatus(ui.loginStatus, "Une erreur est survenue.", "error");
    } finally {
        ui.loginBtn.disabled = false;
        ui.loginBtn.textContent = 'Se connecter';
    }
};

const handleLogout = async () => {
    await appState.supabase.auth.signOut();
    window.location.reload();
};

const startLocationTracking = () => {
    if (appState.watchId) return;
    showStatus("Recherche de votre position...", 'info');
    appState.watchId = navigator.geolocation.watchPosition(
        (pos) => {
            ui.status.classList.add('hidden');
            updateSupabaseLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
            updateUserMarker(pos.coords);
        },
        (err) => {
            showPermanentBanner("Erreur ou perte de la géolocalisation.");
            stopLocationTracking();
        }, 
        highAccuracyOptions
    );
};

const stopLocationTracking = async () => {
    if (appState.watchId) {
        navigator.geolocation.clearWatch(appState.watchId);
        appState.watchId = null;
        await updateSupabaseLocation({ is_sharing: false });
        showStatus("Partage de position arrêté.", 'info');
    }
};

const updateSupabaseLocation = async (data) => {
    try {
        await appState.supabase.from('locations').upsert({ ...data, user_id: appState.currentUser.id, timestamp: new Date().toISOString() }, { onConflict: 'user_id' });
    } catch (e) {
        showStatus("Erreur de synchronisation.", 'error');
    }
};

const updateUserMarker = (coords) => {
    const { latitude, longitude, accuracy, heading, speed } = coords;
    const latLng = L.latLng(latitude, longitude);
    
    let userIconHtml;
    if (speed && speed > 1 && heading !== null && !isNaN(heading)) {
        userIconHtml = `
            <div class="relative w-8 h-8 flex items-center justify-center" style="transform: rotate(${heading}deg);">
                <svg class="w-8 h-8 text-blue-600 filter drop-shadow-lg" fill="currentColor" viewBox="0 0 20 20">
                    <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-8.707l-3-3a1 1 0 00-1.414 0l-3 3a1 1 0 001.414 1.414L9 9.414V13a1 1 0 102 0V9.414l1.293 1.293a1 1 0 001.414-1.414z" clip-rule="evenodd" />
                </svg>
            </div>`;
    } else {
        userIconHtml = `
            <div class="relative w-6 h-6 flex items-center justify-center">
                <div class="pulse-ring"></div>
                <svg class="w-6 h-6 text-blue-500 filter drop-shadow-lg" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12,2A10,10,0,1,0,22,12,10,10,0,0,0,12,2Zm0,18a8,8,0,1,1,8-8A8,8,0,0,1,12,20Z"/>
                    <circle cx="12" cy="12" r="5" fill="currentColor"/>
                </svg>
            </div>`;
    }

    const userIcon = L.divIcon({
        className: 'custom-user-icon',
        html: userIconHtml,
        iconSize: [32, 32],
        iconAnchor: [16, 16]
    });

    if (!appState.userMarker) {
        appState.userAccuracyCircle = L.circle(latLng, { radius: accuracy, color: '#3B82F6', fillColor: '#3B82F6', fillOpacity: 0.15, weight: 1 }).addTo(appState.map);
        appState.userMarker = L.marker(latLng, { icon: userIcon, zIndexOffset: 1000 }).addTo(appState.map);
        appState.userMarker.bindTooltip(appState.userName, { permanent: true, direction: 'top', offset: [0, -15], className: 'name-tooltip' }).openTooltip();
        appState.map.setView(latLng, 18);
    } else {
        appState.userMarker.setLatLng(latLng);
        appState.userMarker.setIcon(userIcon);
        appState.userAccuracyCircle.setLatLng(latLng).setRadius(accuracy);
        appState.userMarker.setTooltipContent(appState.userName);
    }
};

const listenToFriendLocations = () => {
    appState.supabase.channel('public:locations')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'locations' }, (payload) => {
            const friendData = payload.new;
            if (!friendData || friendData.user_id === appState.currentUser.id || !appState.friends[friendData.user_id]) return;
            
            appState.friends[friendData.user_id] = { ...appState.friends[friendData.user_id], ...friendData };
            renderFriendList();
            
            const friendId = friendData.user_id;
            const friendName = appState.friends[friendId].full_name;
            const shouldDisplay = friendData.is_sharing && friendData.lat && friendData.lng;

            if (!shouldDisplay) {
                if (appState.friendMarkers[friendId]) {
                    appState.map.removeLayer(appState.friendMarkers[friendId]);
                    delete appState.friendMarkers[friendId];
                }
                return;
            }
            const friendIcon = L.divIcon({
                className: 'custom-friend-icon',
                html: `<svg class="w-8 h-8 text-purple-700 filter drop-shadow-md" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 010-5 2.5 2.5 0 010 5z"/></svg>`,
                iconSize: [32, 32], iconAnchor: [16, 32]
            });
            if (appState.friendMarkers[friendId]) {
                appState.friendMarkers[friendId].setLatLng([friendData.lat, friendData.lng]).setTooltipContent(friendName || 'Ami');
            } else {
                appState.friendMarkers[friendId] = L.marker([friendData.lat, friendData.lng], { icon: friendIcon })
                    .addTo(appState.map).bindTooltip(friendName || 'Ami', { permanent: true, direction: 'top', offset: [0, -35], className: 'name-tooltip' }).openTooltip();
            }
        }).subscribe();
};

const addFriend = async (friendId) => {
    if (!friendId) return showStatus("ID invalide.", 'warning');
    if (friendId === appState.currentUser.id) return showStatus("Vous ne pouvez pas vous ajouter.", 'warning');
    const { data: friendExists } = await appState.supabase.from('profiles').select('full_name').eq('id', friendId).single();
    if (!friendExists) return showStatus("Utilisateur introuvable.", 'error');
    const { error } = await appState.supabase.from('friends').insert({ user_id: appState.currentUser.id, friend_id: friendId });
    if (error) {
        if (error.code === '23505') showStatus(`${friendExists.full_name} est déjà votre ami.`, 'warning');
        else showStatus("Erreur lors de l'ajout.", 'error');
    } else {
        showStatus(`${friendExists.full_name} a été ajouté(e) !`, 'success');
        await fetchAndDisplayFriends();
    }
};

const fetchAndDisplayFriends = async () => {
    const { data: relations } = await appState.supabase.from('friends').select('friend_id').eq('user_id', appState.currentUser.id);
    const friendIds = relations.map(r => r.friend_id);
    if (friendIds.length === 0) return renderFriendList();
    const { data: friendsData } = await appState.supabase.from('locations').select('user_id, lat, lng, is_sharing').in('user_id', friendIds);
    const { data: profilesData } = await appState.supabase.from('profiles').select('id, full_name').in('id', friendIds);
    
    appState.friends = {};
    profilesData.forEach(profile => {
        const location = friendsData.find(loc => loc.user_id === profile.id) || {};
        appState.friends[profile.id] = { ...profile, ...location };
    });
    renderFriendList();
};

const getLocationStatus = (lat, lng) => {
    const amberieuBounds = L.latLngBounds([45.94, 5.30], [46.01, 5.40]);
    const lyceeZone = L.circle(lyceeCenter, { radius: 250 });
    const shoppingZone = L.polygon([[45.9588, 5.3533], [45.9573, 5.3562], [45.9594, 5.3615], [45.9611, 5.3585]]);
    if (!lat || !lng) return "Position inconnue";
    const point = L.latLng(lat, lng);
    if (lyceeZone.getBounds().contains(point)) return "Au lycée";
    if (shoppingZone.getBounds().contains(point)) return "Zone commerciale";
    if (amberieuBounds.contains(point)) return "À Ambérieu";
    return "En dehors d'Ambérieu";
};

const renderFriendList = () => {
    ui.friendsList.innerHTML = '';
    const friendIds = Object.keys(appState.friends);
    if (friendIds.length === 0) {
        ui.friendsList.innerHTML = `<li class="text-center text-gray-500 py-4">Ajoutez votre premier ami.</li>`;
        return;
    }
    friendIds.forEach(id => {
        const friend = appState.friends[id];
        const status = friend.is_sharing === false ? "A désactivé sa position" : getLocationStatus(friend.lat, friend.lng);
        const li = document.createElement('li');
        li.className = 'bg-white p-3 rounded-lg shadow-sm hover:bg-gray-50 cursor-pointer';
        li.innerHTML = `
            <div class="flex items-center justify-between">
                <span class="font-medium text-gray-800">${friend.full_name}</span>
                <svg class="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 8l4 4m0 0l-4 4m4-4H3"></path></svg>
            </div>
            <p class="text-sm text-gray-500 mt-1">${status}</p>`;
        li.addEventListener('click', () => centerOnFriend(id));
        ui.friendsList.appendChild(li);
    });
};

const centerOnFriend = (friendId) => {
    const friend = appState.friends[friendId];
    if (friend && friend.is_sharing !== false && appState.friendMarkers[friendId]) {
        showView('map');
        appState.map.setView(appState.friendMarkers[friendId].getLatLng(), 18, { animate: true, pan: { duration: 1 } });
        showStatus(`Centrage sur ${friend.full_name}`, 'info');
    } else {
        showStatus(`${friend.full_name} ne partage pas sa position.`, 'warning');
    }
};

const showMyQrCode = () => {
    ui.qrCodeContainer.innerHTML = '';
    const qr = qrcode(0, 'L');
    qr.addData(appState.currentUser.id);
    qr.make();
    ui.qrCodeContainer.innerHTML = qr.createImgTag(6, 8);
    ui.myQrCodeModal.classList.remove('hidden');
};

const startQrScanner = async () => {
    if (typeof Html5Qrcode === 'undefined') {
        showStatus("Librairie du scanner non chargée.", "error");
        return;
    }
    ui.qrScannerModal.classList.remove('hidden');
    if (!appState.html5QrCode) {
         appState.html5QrCode = new Html5Qrcode("qr-scanner-container");
    }
    try {
        await appState.html5QrCode.start(
            { facingMode: "environment" }, { fps: 10, qrbox: { width: 250, height: 250 } },
            (decodedText) => { stopQrScanner(); addFriend(decodedText); },
            () => {}
        );
    } catch (err) {
        console.error("Erreur du scanner QR:", err);
        showStatus("Impossible de démarrer la caméra.", "error");
        stopQrScanner();
    }
};

const stopQrScanner = () => {
    if (appState.html5QrCode && appState.html5QrCode.isScanning) {
        appState.html5QrCode.stop()
            .catch(err => console.error("Scanner non arrêté correctement.", err))
            .finally(() => ui.qrScannerModal.classList.add('hidden'));
    } else {
        ui.qrScannerModal.classList.add('hidden');
    }
};

const setupEventListeners = () => {
    ui.loginForm.addEventListener('submit', handleLogin);
    ui.signupForm.addEventListener('submit', handleSignUp);
    ui.logoutBtn.addEventListener('click', handleLogout);
    ui.showLoginBtn.addEventListener('click', () => {
        ui.signupContainer.classList.add('hidden');
        ui.loginContainer.classList.remove('hidden');
    });
    ui.showSignupBtn.addEventListener('click', () => {
        ui.loginContainer.classList.add('hidden');
        ui.signupContainer.classList.remove('hidden');
    });

    ui.buttons.friends.addEventListener('click', () => showView('friends'));
    ui.buttons.settings.addEventListener('click', () => showView('settings'));
    ui.buttons.map.addEventListener('click', () => {
        if (ui.views.map.classList.contains('hidden')) showView('map');
        else appState.map.setView(lyceeCenter, 18, { animate: true, pan: { duration: 1 } });
    });
    ui.shareLocationToggle.addEventListener('change', (e) => {
        if(e.target.checked) {
            if (appState.geolocationEnabled) startLocationTracking();
            else showPermanentBanner("Activez la géolocalisation pour partager.");
        } else {
            stopLocationTracking();
        }
    });
    ui.showAttributionToggle.addEventListener('change', (e) => {
        if (e.target.checked) {
            appState.map.removeLayer(appState.mapLayers.noLabels);
            appState.map.addLayer(appState.mapLayers.withLabels);
        } else {
            appState.map.removeLayer(appState.mapLayers.withLabels);
            appState.map.addLayer(appState.mapLayers.noLabels);
        }
    });
    ui.disableScannerToggle.addEventListener('change', (e) => {
        appState.isScannerDisabled = e.target.checked;
    });
    ui.myQrCodeBtn.addEventListener('click', showMyQrCode);
    ui.closeQrCodeModalBtn.addEventListener('click', () => ui.myQrCodeModal.classList.add('hidden'));
    ui.addFriendBtn.addEventListener('click', () => {
        if (appState.isScannerDisabled) {
            ui.pasteIdModal.classList.remove('hidden');
        } else {
            startQrScanner();
        }
    });
    ui.closePasteIdModalBtn.addEventListener('click', () => {
        ui.pasteIdModal.classList.add('hidden');
    });
    ui.addFriendFromIdBtn.addEventListener('click', () => {
        const friendId = ui.pasteIdInput.value.trim();
        if (friendId) {
            addFriend(friendId);
            ui.pasteIdInput.value = '';
            ui.pasteIdModal.classList.add('hidden');
        } else {
            showStatus("Veuillez entrer un ID.", 'warning');
        }
    });
    ui.closeScannerModalBtn.addEventListener('click', stopQrScanner);
};

const showView = (viewName) => {
    Object.values(ui.views).forEach(v => v.classList.add('hidden'));
    ui.views[viewName].classList.remove('hidden');
    document.querySelectorAll('.menu-btn-container').forEach(el => el.classList.remove('active-menu'));
    ui.buttons[viewName].classList.add('active-menu');
    if (viewName === 'map') appState.map.invalidateSize();
    if (viewName === 'friends') fetchAndDisplayFriends();
};

const showStatus = (message, type = 'info') => {
    const colors = { info: 'bg-blue-100 text-blue-800', success: 'bg-green-100 text-green-800', warning: 'bg-yellow-100 text-yellow-800', error: 'bg-red-100 text-red-800' };
    ui.status.textContent = message;
    ui.status.className = `absolute top-4 left-1/2 -translate-x-1/2 text-center text-sm font-medium p-3 rounded-xl shadow-lg transition-all duration-300 z-[1001] ${colors[type]}`;
    ui.status.classList.remove('hidden');
    setTimeout(() => {
        if (ui.status) {
            ui.status.classList.add('hidden');
        }
    }, 3000);
};

const showAuthStatus = (element, message, type = 'error') => {
    element.textContent = message;
    element.className = `mb-4 text-sm font-semibold ${type === 'success' ? 'text-green-600' : 'text-red-600'}`;
};

const showPermanentBanner = (message) => {
    ui.topBanner.textContent = message;
    ui.topBanner.className = 'absolute top-24 inset-x-0 mx-auto w-max bg-red-100 text-red-800 text-sm font-semibold px-4 py-2 rounded-full shadow-lg z-[1000]';
    ui.topBanner.classList.remove('hidden');
};

