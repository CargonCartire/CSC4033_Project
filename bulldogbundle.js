class Bulldog {
    constructor(num = 1) {
        this.num = num,
        this.max = 100,
        this.drain = 1,
        this.health = 100,
        this.age = 0,
        this.food = 25,
        this.water = 25,
        this.bath = 25,
        this.sleep = 25,
        this.sickLvl = 0,
        this.isDead = false
    }

    checkDeath(){
        this.isDead = false;
        if (this.health <= 0){
            this.isDead = true;
        }
    }

    checkSick(){
        this.sickLvl = 0;
        for (const s of ['food', 'water', 'bath', 'sleep']){
            const percentage = (this[s] / this.max) * 100;
            const bar = document.getElementById(s + 'Bar');
            const isDanger = percentage < 15 || percentage > 85;
            const isWarning = !isDanger && (percentage < 25 || percentage > 75);

            if (isDanger){
                this.sickLvl += 1;
            }
            bar.classList.toggle('danger', isDanger);
            bar.classList.toggle('warning', isWarning);
        }
    }

    incrimStat(mainStat){
        for (const s of ['food', 'water', 'bath', 'sleep']){
            const change = (s == mainStat) ? 10 : -2;
            this[s] = Math.min(this.max, Math.max(0, this[s] + change));
        }
    }

    statDecrease(){
        for (const s of ['food', 'water', 'bath', 'sleep']){
            this[s] = Math.max(0, this[s] - this.drain);
        }
    }

    ageStats(){
        this.age += 1;
        this.max *= 1.15;
        if (this.drain < 4){
            this.drain += 0.5;
        }
    }
};

let tick = 0;
let bulldog = null;
let affinity = 50;
let intervalID = null;

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

    if(bulldog.isDead){
        dogImage.src = 'images/dawgdeath.png';
        newDogButton.style.display = 'block';
    } else if(bulldog.sickLvl > 0) {
        dogImage.src = 'images/dawgsad.png';
        newDogButton.style.display = 'none';
    } else {
        dogImage.src = 'images/dawghappy.png';
        newDogButton.style.display = 'none';
    }
}

function startGame(num = 1) {
    bulldog = new Bulldog(num);
    renderBulldog();
    tick = 0;
    clearInterval(intervalID);
    intervalID = setInterval(() => timeUpdate(), 1000);
}

function updateStat(barId) {
    if (bulldog.isDead) {
        return;
    }

    const stat = barId.replace('Bar', '');
    bulldog.incrimStat(stat);
    renderBulldog();
}

function dogDeath() {
    startGame(bulldog.num + 1);
}

function timeUpdate(){
    if (bulldog.isDead){
        clearInterval(intervalID);
        return;
    } else{
        tick += 1;
        if (tick % 300 == 0){
            bulldog.ageStats();
        }
        if (tick % 6 == 0){
            bulldog.statDecrease();
        }
        renderBulldog();
        if (bulldog.sickLvl > 0) {
            bulldog.health = Math.max(0, bulldog.health - bulldog.sickLvl);
        } else {
            bulldog.health = Math.min(bulldog.max, bulldog.health + 1);
        }

        document.getElementById('healthFill').style.width = (bulldog.health / bulldog.max) * 100 + '%';
    }
}

startGame();

