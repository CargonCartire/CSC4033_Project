function increaseStat(statId) {
    const bar = document.getElementById(statId);
    let currentWidth = parseFloat(bar.style.width);

    if (!currentWidth) {
        currentWidth = parseFloat(
            window.getComputedStyle(bar).width
        );

        const parentWidth = parseFloat(
            window.getComputedStyle(bar.parentElement).width
        );

        currentWidth = (currentWidth / parentWidth) * 100;
    }

    currentWidth += 10;
    if (currentWidth > 100) {
        currentWidth = 100;
    }
    bar.style.width = currentWidth + "%";
}