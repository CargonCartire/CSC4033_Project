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
        for (const s of ['food', 'water', 'bath', 'sleep']){
            if (!(this[s] > 0 && this[s] < this.max)){
                this.isDead = true;
            } else if (health <= 0){
                this.isDead = true;
            }
        }
    }

    checkSick(){
        for (const s of ['food', 'water', 'bath', 'sleep']){
            if (!(this[s] > (this.max * 0.15) && this[s] < (this.max * .85))){
                this.isSick = true;
                break;
            } else if (health <= 15){
                this.isDead = true;
            } else{
                this.isSick = false;
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

function renderBulldog() {
    document.querySelector('.health-section h1').textContent =
        `Techie ${bulldog.num} (${bulldog.age} Days Old)`;

    for (const stat of ['food', 'water', 'bath', 'sleep']) {
        const bar = document.getElementById(stat + 'Bar');
        const percentage = (bulldog[stat] / bulldog.max) * 100;

        bar.style.width = percentage + '%';

        // Turn the bar red when it is at a certain danger zone
        if (percentage < 15 || percentage > 85) {
            bar.classList.add('danger');
        } else {
            bar.classList.remove('danger');
        }
    }
}

function startGame(num = 1) {
    bulldog = new Bulldog(num);
    renderBulldog();
}

function updateStat(barId) {
    const stat = barId.replace('Bar', '');
    bulldog.incrimStat(stat);
    renderBulldog();
}

function dogDeath() {
    startGame(bulldog.num + 1);
}

startGame();
