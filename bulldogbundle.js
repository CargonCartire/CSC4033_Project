// The server (Lambda) now owns the game state and the tick.
// The browser shows a local prediction every second for smooth bars,
// and re-syncs with the server every few seconds and after every action.
 
const API_URL = 'https://itmgfmwmz8.execute-api.us-east-2.amazonaws.com/api/bulldog';
const LEADERBOARD_URL = 'https://itmgfmwmz8.execute-api.us-east-2.amazonaws.com/api/leaderboard';
const NEEDS = ['food', 'water', 'bath', 'sleep'];
const SYNC_EVERY_MS = 15000;
 
class Bulldog {
    constructor(data) {
        Object.assign(this, data);
    }
 
    // Turn a DynamoDB item (Food, Water, ...) into the shape the page uses (food, water, ...)
    static fromServer(item) {
        return new Bulldog({
            num: Number(item.Dog_Name),
            name: item.Dog_Name,
            max: item.Max,
            drain: item.Drain,
            health: item.Health,
            age: item.Age,
            food: item.Food,
            water: item.Water,
            bath: item.Bath,
            sleep: item.Sleep,
            sickLvl: item.SickLvl,
            isDead: item.IsDead,
            affinity: item.Affinity ?? 50,
            tickCount: item.TickCount,
        });
    }
 
    checkSick() {
        this.sickLvl = 0;
        for (const s of NEEDS) {
            const pct = (this[s] / this.max) * 100;
            if (pct < 15 || pct > 85) this.sickLvl += 1;
        }
    }
 
    // Local copy of one server tick. Must match tick() in the Lambda.
    tick() {
        if (this.isDead) return;
        this.tickCount += 1;
        if (this.tickCount % 300 === 0) {
            this.age += 1;
            this.max *= 1.15;
            if (this.drain < 4) this.drain += 0.5;
        }
        if (this.tickCount % 6 === 0) {
            for (const s of NEEDS) this[s] = Math.max(0, this[s] - this.drain);
        }
        this.checkSick();
        if (this.sickLvl > 0) this.health = Math.max(0, this.health - this.sickLvl);
        else this.health = Math.min(this.max, this.health + 1);
        this.isDead = this.health <= 0;
    }
 
    // Local copy of care(). The server applies it for real.
    incrimStat(mainStat) {
        for (const s of NEEDS) {
            const change = (s == mainStat) ? 10 : -2;
            this[s] = Math.min(this.max, Math.max(0, this[s] + change));
        }
        this.checkSick();
    }
}
 
let bulldog = null;
let intervalID = null;
let lastSync = 0;
 
// ---------- Server calls ----------
 
async function api(payload) {
    const res = payload.action === 'get'
        ? await fetch(`${API_URL}?name=${encodeURIComponent(payload.name)}`)
        : await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return Bulldog.fromServer(await res.json());
}
 
const getDog    = (num)       => api({ action: 'get',  name: String(num) });
const createDog = (num)       => api({ action: 'new',  name: String(num) });
const careFor   = (num, stat) => api({ action: 'care', name: String(num), stat });
 
async function syncWithServer() {
    try {
        const fresh = await getDog(bulldog.num);
        if (fresh) bulldog = fresh;
        lastSync = Date.now();
        renderBulldog();
    } catch (err) {
        console.error('Sync failed:', err);
    }
}
 
// ---------- Rendering ----------
 
function renderBulldog() {
    document.querySelector('.health-section h1').textContent =
        `Techie ${bulldog.num} (${bulldog.age} Days Old)`;
 
    for (const stat of NEEDS) {
        const bar = document.getElementById(stat + 'Bar');
        const pct = (bulldog[stat] / bulldog.max) * 100;
        const isDanger = pct < 15 || pct > 85;
        const isWarning = !isDanger && (pct < 25 || pct > 75);
 
        bar.style.width = pct + '%';
        bar.classList.toggle('danger', isDanger);
        bar.classList.toggle('warning', isWarning);
    }
 
    document.getElementById('affinityBar').style.width =
        (bulldog.affinity / bulldog.max) * 100 + '%';
    document.getElementById('healthFill').style.width =
        (bulldog.health / bulldog.max) * 100 + '%';
 
    const dogImage = document.querySelector('.pet-image img');
    const newDogButton = document.getElementById('newDogButton');
 
    if (bulldog.isDead) {
        dogImage.src = 'images/dawgdeath.png';
        newDogButton.style.display = 'block';
    } else if (bulldog.sickLvl > 0) {
        dogImage.src = 'images/dawgsad.png';
        newDogButton.style.display = 'none';
    } else {
        dogImage.src = 'images/dawghappy.png';
        newDogButton.style.display = 'none';
    }
}
 
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
    } catch (err) {
        console.error('Leaderboard failed to load:', err);
        list.innerHTML = '<li>Leaderboard unavailable</li>';
    }
}
 
// ---------- Game flow ----------
 
async function startGame(num = 1, fresh = false) {
    clearInterval(intervalID);
    try {
        bulldog = fresh ? await createDog(num) : (await getDog(num)) ?? (await createDog(num));
    } catch (err) {
        console.error('Could not load bulldog:', err);
        return;
    }
    lastSync = Date.now();
    renderBulldog();
    renderLeaderboard();
    intervalID = setInterval(timeUpdate, 1000);
}
 
async function updateStat(barId) {
    if (!bulldog || bulldog.isDead) return;
    const stat = barId.replace('Bar', '');
 
    // Show the change instantly, then let the server confirm it
    bulldog.incrimStat(stat);
    renderBulldog();
 
    try {
        const confirmed = await careFor(bulldog.num, stat);
        if (confirmed) bulldog = confirmed;
        lastSync = Date.now();
        renderBulldog();
    } catch (err) {
        console.error('Action failed:', err);
        syncWithServer();
    }
}
 
function dogDeath() {
    startGame(bulldog.num + 1, true);
}
 
function timeUpdate() {
    bulldog.tick();    // local prediction so bars move smoothly
    renderBulldog();
    if (Date.now() - lastSync >= SYNC_EVERY_MS) syncWithServer();
}
 
startGame();
