
const STATS = ['food', 'water', 'bath', 'sleep'];

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
        this.isDead = this.health <= 0;
    }

    checkSick() {
        this.sickLvl = 0;

        for (const stat of STATS) {
            const percentage = (this[stat] / this.max) * 100;
            const bar = document.getElementById(stat + 'Bar');

            const isDanger = percentage < 15 || percentage > 85;
            const isWarning =
                !isDanger && (percentage < 25 || percentage > 75);

            if (isDanger) {
                this.sickLvl += 1;
            }

            bar.classList.toggle('danger', isDanger);
            bar.classList.toggle('warning', isWarning);
        }
    }

    incrimStat(mainStat) {
        for (const stat of STATS) {
            const change = stat === mainStat ? 10 : -2;

            this[stat] = Math.min(
                this.max,
                Math.max(0, this[stat] + change)
            );
        }
    }

    statDecrease() {
        for (const stat of STATS) {
            this[stat] = Math.max(0, this[stat] - this.drain);
        }
    }

    ageStats() {
        this.age += 1;
        this.max *= 1.15;

        if (this.drain < 4) {
            this.drain += 0.5;
        }
    }
}


// AFFINITY SCORING SYSTEM

// Determines which condition a stat is currently in.
// 0 = normal, 1 = yellow, 2 = red, 3 = fatal

function conditionLevel(percentage) {
    if (percentage <= 0 || percentage >= 100) {
        return 3;
    }

    if (percentage < 15 || percentage > 85) {
        return 2;
    }

    if (percentage < 25 || percentage > 75) {
        return 1;
    }

    return 0;
}


// Calculates recovery bonuses when a stat moves
// from a worse condition into a healthier condition.

function recoveryBonus(beforeLevel, afterLevel) {
    let bonus = 0;

    for (let level = beforeLevel; level > afterLevel; level--) {
        if (level === 3) {
            bonus += 30; // Fatal to red
        }

        if (level === 2) {
            bonus += 20; // Red to yellow
        }

        if (level === 1) {
            bonus += 10; // Yellow to normal
        }
    }

    return bonus;
}


// Calculates one stat's contribution to affinity.
// This does not include the default +20 button reward.

function scoreStatChange(beforeValue, afterValue, max, attemptedChange) {

    const beforePercent = (beforeValue / max) * 100;
    const afterPercent = (afterValue / max) * 100;

    const beforeLevel = conditionLevel(beforePercent);
    const afterLevel = conditionLevel(afterPercent);

    // Distance from the ideal midpoint of 50%
    const beforeDistance = Math.abs(beforePercent - 50);
    const afterDistance = Math.abs(afterPercent - 50);

    const improving = afterDistance < beforeDistance - 1e-9;
    const worsening = afterDistance > beforeDistance + 1e-9;

    // Recovery into a healthier condition
    if (afterLevel < beforeLevel) {
        return 10 + recoveryBonus(beforeLevel, afterLevel);
    }

    // Improvement while remaining within the same unhealthy condition
    if (beforeLevel > 0 && afterLevel === beforeLevel && improving) {
        return 10;
    }

    // Normal stats receive no additional award or penalty
    if (afterLevel === 0) {
        return 0;
    }

    // Attempting to worsen a stat already at a fatal boundary
    const pushesPastZero = beforeValue <= 0 && attemptedChange < 0;
    const pushesPastMax = beforeValue >= max && attemptedChange > 0;

    if (
        beforeLevel === 3 &&
        afterLevel === 3 &&
        afterValue === beforeValue &&
        (pushesPastZero || pushesPastMax)
    ) {
        return -110;
    }

    // Apply the penalty for the final condition
    const penaltyByLevel = [0, -20, -40, -100];

    let contribution = penaltyByLevel[afterLevel];

    // Additional -10 for worsening within the same unhealthy condition
    if (
        beforeLevel > 0 &&
        beforeLevel === afterLevel &&
        worsening
    ) {
        contribution -= 10;
    }

    return contribution;
}


// Combines all four stat contributions with the
// default +20 reward for one button press.

function calculateAffinityChange(before, after, max, selectedStat) {
    let change = 20;

    for (const stat of STATS) {
        const attemptedChange = stat === selectedStat ? 10 : -2;

        change += scoreStatChange(
            before[stat],
            after[stat],
            max,
            attemptedChange
        );
    }

    return change;
}


// Records the four stats before or after a button press.

function snapshotStats(dog) {
    return {
        food: dog.food,
        water: dog.water,
        bath: dog.bath,
        sleep: dog.sleep
    };
}


// GLOBAL VARIABLES

let tick = 0;
let bulldog = null;
let intervalID = null;

// Temporary user affinity value.
// The backend will eventually store the actual user score.
let affinity = 50;

// Client-side picture switching and button lockout
let temporaryImage = null;
let imageTimer = null;

const LEADERBOARD_URL =
    'https://itmgfmwmz8.execute-api.us-east-2.amazonaws.com/api/leaderboard';


// RENDER BULLDOG

function renderBulldog() {

    document.querySelector('.health-section h1').textContent =
        `Techie ${bulldog.num} (${bulldog.age} Days Old)`;

    bulldog.checkSick();
    bulldog.checkDeath();

    for (const stat of STATS) {
        const bar = document.getElementById(stat + 'Bar');
        const percentage = (bulldog[stat] / bulldog.max) * 100;

        bar.style.width = percentage + '%';
    }

    // Health bar
    document.getElementById('healthFill').style.width =
        (bulldog.health / bulldog.max) * 100 + '%';

    // Affinity bar
    // Points are not capped, but the visible bar stays within 0–100%.
    const affinityBar = document.getElementById('affinityBar');

    affinityBar.style.width =
        Math.max(0, Math.min(100, affinity)) + '%';

    affinityBar.title = `${affinity} affinity points`;

    // Dog image and buttons
    const dogImage = document.querySelector('.pet-image img');
    const newDogButton = document.getElementById('newDogButton');

    newDogButton.style.display = bulldog.isDead ? 'block' : 'none';

    // Disable stat buttons during death or temporary picture switching
    for (const button of document.querySelectorAll('.stat-row button')) {
        button.disabled = bulldog.isDead || temporaryImage !== null;
    }

    // Death takes priority over temporary images
    if (bulldog.isDead) {
        dogImage.src = 'images/dawgdeath.png';
    }
    else if (temporaryImage !== null) {
        dogImage.src = temporaryImage;
    }
    else if (bulldog.sickLvl > 0) {
        dogImage.src = 'images/dawgsad.png';
    }
    else {
        dogImage.src = 'images/dawghappy.png';
    }
}


// LEADERBOARD

async function renderLeaderboard() {
    const list = document.getElementById('leaderboardList');

    try {
        const response = await fetch(LEADERBOARD_URL);

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

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

            li.textContent =
                `${user.User_Name} - ${user.Affinty_Points}`;

            list.appendChild(li);
        }
    }
    catch (error) {
        console.error('Leaderboard failed to load:', error);
        list.innerHTML = '<li>Leaderboard unavailable</li>';
    }
}


// CLIENT-SIDE PICTURE SWITCHING

function showTemporaryImage(imagePath) {
    if (bulldog.isDead) {
        return;
    }

    clearTimeout(imageTimer);

    temporaryImage = imagePath;
    renderBulldog();

    imageTimer = setTimeout(() => {
        temporaryImage = null;
        imageTimer = null;

        renderBulldog();
    }, 1000);
}


// START GAME

function startGame(num = 1) {

    // Clear previous temporary image and button lockout
    clearTimeout(imageTimer);
    imageTimer = null;
    temporaryImage = null;

    bulldog = new Bulldog(num);

    renderBulldog();
    renderLeaderboard();

    // Existing temporary tick system
    tick = 0;
    clearInterval(intervalID);

    intervalID = setInterval(timeUpdate, 1000);
}


// STAT BUTTON INPUT

function updateStat(barId) {

    // Prevent input during death or the 1-second lockout
    if (bulldog.isDead || temporaryImage !== null) {
        return;
    }

    const images = {
        food: 'images/dawgeat.png',
        water: 'images/dawgdrink.png',
        bath: 'images/dawgbath.png',
        sleep: 'images/dawgsleep.png'
    };

    const selectedStat = barId.replace('Bar', '');

    if (!Object.hasOwn(images, selectedStat)) {
        return;
    }

    // Save stat values before the action
    const before = snapshotStats(bulldog);
    const maximumAtAction = bulldog.max;

    // Apply the normal stat changes
    bulldog.incrimStat(selectedStat);

    // Save stat values after the action
    const after = snapshotStats(bulldog);

    // Calculate the user's affinity change
    const affinityChange = calculateAffinityChange(
        before,
        after,
        maximumAtAction,
        selectedStat
    );

    // Local prototype: update the user affinity display.
    // The backend will eventually calculate and persist this value.
    affinity += affinityChange;

    // Show the action picture and disable buttons for 1 second
    showTemporaryImage(images[selectedStat]);
}


// NEW DOG

function dogDeath() {
    if (bulldog.isDead) {
        startGame(bulldog.num + 1);
    }
}


// TEMPORARY GAME SIMULATION

function timeUpdate() {

    if (bulldog.isDead) {
        clearInterval(intervalID);
        intervalID = null;
        return;
    }

    tick += 1;

    if (tick % 300 === 0) {
        bulldog.ageStats();
    }

    if (tick % 6 === 0) {
        bulldog.statDecrease();
    }

    // Calculate sickness before updating health
    bulldog.checkSick();

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

    renderBulldog();

    if (bulldog.isDead) {
        clearInterval(intervalID);
        intervalID = null;
    }
}


// INITIALIZE

startGame();
