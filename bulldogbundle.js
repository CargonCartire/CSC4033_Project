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
        this.isDead = false,
        this.isSick = false
    }

    checkDeath(){
        this.isDead = false;
        for (const s of ['food', 'water', 'bath', 'sleep']){
            if (this[s] <= 0 || this[s] >= this.max){
                this.isDead = true;
                break;
            } if (this.health <= 0){
                this.isDead = true;
            }
        }
    }

    checkSick(){
        this.isSick = false;
        for (const s of ['food', 'water', 'bath', 'sleep']){
            const percentage = (this[s] / this.max) * 100;
            const bar = document.getElementById(s + 'Bar');
            if (percentage < 15 || percentage > 85) {
                this.isSick = true;
                bar.classList.add('danger'); // Turn the bar red when it is at a certain danger zone
            } else {
                bar.classList.remove('danger');
            }
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

let bulldog = null;
let affinity = 50;

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
    const affinityPercentage = (bulldog.affinity / bulldog.max) * 100;
    affinityBar.style.width = affinityPercentage + '%';

    const dogImage = document.querySelector('.pet-image img');
    const newDogButton = document.getElementById('newDogButton');

    if(bulldog.isDead){
        dogImage.src = 'images/dawgdeath.png';
        newDogButton.style.display = 'block';
    } else if(bulldog.isSick){
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

startGame();
