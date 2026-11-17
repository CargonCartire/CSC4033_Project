class Bulldog {
    constructor(num = 1) {
        this.num = num;
        this.max = 100;
        this.drain = 1;
        this.health = 100;
        this.age = 0;
        this.food = 50;
        this.water = 50;
        this.bath = 50;
        this.sleep = 50;
        this.sickLvl = 0;
        this.isDead = false;
    }

    checkDeath() {
        this.isDead = false;
        if (this.health <= 0) {
            this.isDead = true;
        }
    }

    checkSick() {
        this.sickLvl = 0;

        for (const s of ['food', 'water', 'bath', 'sleep']) {
            const percentage = (this[s] / this.max) * 100;
            const bar = document.getElementById(s + 'Bar');
            const isDanger = percentage < 15 || percentage > 85;
            const isWarning = !isDanger && (percentage < 25 || percentage > 75);

            if (isDanger) {
                this.sickLvl += 1;
            }

            bar.classList.toggle('danger', isDanger);
            bar.classList.toggle('warning', isWarning);
        }
    }

    incrimStat(mainStat) {
        for (const s of ['food', 'water', 'bath', 'sleep']) {
            const change = (s === mainStat) ? 10 : -2;
            this[s] = Math.min(this.max, Math.max(0, this[s] + change));
        }
    }

    statDecrease() {
        for (const s of ['food', 'water', 'bath', 'sleep']) {
            this[s] = Math.max(0, this[s] - this.drain);
        }
    }

    ageStats() {
        this.age += 1;
        this.max *= 1.15;

        if (this.drain < 4) {
            this.drain += 0.5;
        }
    }
};


// Global variables

let tick = 0;
let bulldog = null;
let affinity = 0;
let busy = false;
let connected = false;
let intervalID = null;

// Client-side temporary image and button lockout
let temporaryImage = null;
let imageTimer = null;


// Render the bulldog interface

function renderBulldog() {
    document.querySelector('.health-section h1').textContent =
        `Techie ${bulldog.num} (${bulldog.age} Days Old)`;

    bulldog.checkSick();
    bulldog.checkDeath();
    document.getElementById('healthFill').style.width = (bulldog.health / bulldog.max) * 100 + '%';
    document.getElementById('newDogButton').disabled = busy || !connected;

    for (const stat of ['food', 'water', 'bath', 'sleep']) {
        const bar = document.getElementById(stat + 'Bar');
        const percentage = (bulldog[stat] / bulldog.max) * 100;

        bar.style.width = percentage + '%';
    }

    const affinityBar = document.getElementById('affinityBar');
    const affinityPercentage = Math.min(100, Math.max(0, affinity));
    affinityBar.parentElement.title = `${affinity} affinity points (your account)`;
    affinityBar.style.width = affinityPercentage + '%';

    const dogImage = document.querySelector('.pet-image img');
    const newDogButton = document.getElementById('newDogButton');
    const statButtons = document.querySelectorAll('.stat-row button');

    // Disable buttons if the dog is dead or a temporary image is active
    const buttonsLocked = busy || !connected || bulldog.isDead || temporaryImage !== null;

    for (const button of statButtons) {
        button.disabled = buttonsLocked;
    }

    // Death takes priority over any temporary picture
    if (bulldog.isDead) {
        dogImage.src = 'images/dawgdeath.png';
        newDogButton.style.display = 'block';
    }
    else {
        newDogButton.style.display = 'none';

        if (temporaryImage !== null) {
            dogImage.src = temporaryImage;
        }
        else if (bulldog.sickLvl > 0) {
            dogImage.src = 'images/dawgsad.png';
        }
        else {
            dogImage.src = 'images/dawghappy.png';
        }
    }
}


// Leaderboard API

const LEADERBOARD_URL =
    'https://itmgfmwmz8.execute-api.us-east-2.amazonaws.com/api/leaderboard';

async function renderLeaderboard() {
    const list = document.getElementById('leaderboardList');

    try {
        const response = await fetch(LEADERBOARD_URL);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const users = await response.json();
        const top = users.slice(0, 5);

        list.innerHTML = '';

        if (top.length === 0) {
            const li = document.createElement('li');
            li.textContent = 'No scores yet';
            list.appendChild(li);
            return;
        }

        for (const user of top) {
            const li = document.createElement('li');
            li.textContent = `${user.User_Name} - ${user.Affinty_Points}`;
            list.appendChild(li);
        }
    }
    catch (err) {
        console.error('Leaderboard failed to load:', err);
        list.innerHTML = '<li>Leaderboard unavailable</li>';
    }
}


// Client-side temporary image switching and button lockout

function showTemporaryImage(imagePath) {
    // Prevent temporary images from overriding death
    if (bulldog.isDead) {
        return;
    }

    // Cancel any previous image timeout
    clearTimeout(imageTimer);

    // Set the temporary image and activate button lockout
    temporaryImage = imagePath;
    renderBulldog();

    // Remove temporary image and lockout after 3 seconds
    imageTimer = setTimeout(() => {
        temporaryImage = null;
        imageTimer = null;

        renderBulldog();
    }, 1000);
}


// The server owns the dog and its timer. Browsers only display snapshots.
function statusMessage(message) {
    document.getElementById('gameStatus').textContent = message;
}

async function syncGame(action = null) {
    if (busy) return false;
    busy = true;
    if (bulldog) renderBulldog();
    try {
        const response = await fetch(action ? '/api/game/action' : '/api/game', {
            method: action ? 'POST' : 'GET',
            credentials: 'same-origin',
            cache: 'no-store',
            headers: action ? { 'Content-Type': 'application/json' } : {},
            ...(action ? { body: JSON.stringify({ action, dogNum: bulldog.num }) } : {}),
            signal: AbortSignal.timeout(15000)
        });
        if (response.status === 401) {
            window.location.replace('/index.html');
            return false;
        }
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Could not load the game.');
        const changedDog = bulldog && bulldog.num !== data.dog.num;
        bulldog = Object.assign(new Bulldog(), data.dog);
        affinity = data.affinityPoints;
        if (changedDog) {
            clearTimeout(imageTimer);
            temporaryImage = null;
        }
        connected = true;
        return true;
    } catch (err) {
        connected = false;
        statusMessage(err.message + ' Reconnecting…');
        return false;
    } finally {
        busy = false;
        if (bulldog) renderBulldog();
    }
}

async function updateStat(barId) {
    if (!bulldog || !connected || busy || bulldog.isDead || temporaryImage !== null) return;
    const images = {
        food: 'images/dawgeat.png', water: 'images/dawgdrink.png',
        bath: 'images/dawgbath.png', sleep: 'images/dawgsleep.png'
    };
    const stat = barId.replace('Bar', '');
    if (!images[stat]) return;
    if (await syncGame(stat)) {
        showTemporaryImage(images[stat]);
        renderLeaderboard();
    }
}

async function dogDeath() {
    if (!bulldog || !connected || busy || !bulldog.isDead) return;
    await syncGame('newDog');
}

async function pollGame() {
    await syncGame();
    intervalID = setTimeout(pollGame, 1000);
}

document.querySelectorAll('.stat-row button').forEach(button => button.disabled = true);
document.getElementById('newDogButton').style.display = 'none';
pollGame();
renderLeaderboard();
