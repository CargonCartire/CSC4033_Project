class Bulldog {
    constructor(num = 1) {
        this.num = num;
        this.max = 100;
        this.drain = 1;
        this.health = 100;
        this.age = 0;
        this.food = 25;
        this.water = 25;
        this.bath = 25;
        this.sleep = 25;
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
let affinity = 50;
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

    for (const stat of ['food', 'water', 'bath', 'sleep']) {
        const bar = document.getElementById(stat + 'Bar');
        const percentage = (bulldog[stat] / bulldog.max) * 100;

        bar.style.width = percentage + '%';
    }

    const affinityBar = document.getElementById('affinityBar');
    const affinityPercentage = (affinity / bulldog.max) * 100;
    affinityBar.style.width = affinityPercentage + '%';

    const dogImage = document.querySelector('.pet-image img');
    const newDogButton = document.getElementById('newDogButton');
    const statButtons = document.querySelectorAll('.stat-row button');

    // Disable buttons if the dog is dead or a temporary image is active
    const buttonsLocked = bulldog.isDead || temporaryImage !== null;

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


// Start or restart the game

function startGame(num = 1) {
    // Clear any previous temporary picture and button lockout
    clearTimeout(imageTimer);
    imageTimer = null;
    temporaryImage = null;

    bulldog = new Bulldog(num);
    renderBulldog();
    renderLeaderboard();

    // Existing temporary simulation
    tick = 0;
    clearInterval(intervalID);
    intervalID = setInterval(() => timeUpdate(), 1000);
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


// Handle stat button presses

function updateStat(barId) {
    // Ignore input when the dog is dead or buttons are locked
    if (bulldog.isDead || temporaryImage !== null) {
        return;
    }

    const images = {
        food: 'images/dawgeat.png',
        water: 'images/dawgdrink.png',
        bath: 'images/dawgbath.png',
        sleep: 'images/dawgsleep.png'
    };

    const stat = barId.replace('Bar', '');

    // Ignore unknown stat buttons
    if (!images[stat]) {
        return;
    }

    // Update the selected stat
    bulldog.incrimStat(stat);
    renderBulldog();

    // Start the client-side 3-second effect and lockout
    if (!bulldog.isDead) {
        showTemporaryImage(images[stat]);
    }
}


// Create a new dog

function dogDeath() {
    if (!bulldog.isDead) {
        return;
    }

    startGame(bulldog.num + 1);
}


// Existing temporary simulation

function timeUpdate() {
    if (bulldog.isDead) {
        clearInterval(intervalID);
        return;
    }
    else {
        tick += 1;

        if (tick % 300 === 0) {
            bulldog.ageStats();
        }

        if (tick % 6 === 0) {
            bulldog.statDecrease();
        }

        renderBulldog();

        if (bulldog.sickLvl > 0) {
            bulldog.health = Math.max(
                0,
                bulldog.health - bulldog.sickLvl
            );
        }
        else {
            bulldog.health = Math.min(
                bulldog.max,
                bulldog.health + 1
            );
        }

        document.getElementById('healthFill').style.width =
            (bulldog.health / bulldog.max) * 100 + '%';
    }
}


// Initialize game

startGame();
