class Bulldog {
    constructor() {
        this.num = 1,
        this.maximum = 100,
        this.health = 100,
        this.age = 0,
        this.food = 25,
        this.water = 25,
        this.bath = 25,
        this.sleep = 25
    }
    changeNum(newNum){
        num = newNum;
    }

    checkDeath(stat, max){
        return stat > 0 && stat < max;
    }

    checkSick(stat, max){
        return stat > (max * 0.25) && stat < (max * .75);
    }

    incrimStat(mainStat){
        for (const s of ['food', 'water', 'bath', 'sleep']){
            const change = (s == mainStat) ? 10 : -2;
            this[s] = Math.min(this.maximum, Math.max(0, this[s] + change));
        }
    }

    ageStats(maximum){
        day += 1;
        maximum *= 1.15;
    }
};

let bulldog = null;

function renderBulldog() {
    document.querySelector('.health-section h1').textContent =
        `Techie ${bulldog.num} (${bulldog.age} Days Old)`;

    for (const stat of ['food', 'water', 'bath', 'sleep']) {
        document.getElementById(stat + 'Bar').style.width = (bulldog[stat] / bulldog.maximum) * 100 + '%';
    }
}

function startGame() {
    bulldog = new Bulldog();
    renderBulldog();
}

function updateStat(barId) {
    const stat = barId.replace('Bar', '');
    bulldog.incrimStat(stat);
    renderBulldog();
}

function dogDeath(){
    startGame();
}

startGame();
