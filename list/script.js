var currentGen = null;

function toggleGen(generationClass) {
    var allDivs = document.querySelectorAll('.gen-row');
    
    // Check if the current generation is already shown
    if (currentGen === generationClass) {
        // Show all divs
        allDivs.forEach(function(div) {
            div.classList.remove('hidden');
        });
        currentGen = null;
    } else {
        // Hide all divs
        allDivs.forEach(function(div) {
            div.classList.add('hidden');
        });
        
        // Show only the selected generation
        var genDivs = document.querySelectorAll('.' + generationClass);
        genDivs.forEach(function(div) {
            div.classList.remove('hidden');
        });
        
        currentGen = generationClass;
    }
}

function toggleGen1() {
    toggleGen('generation-1');
}

function toggleGen2() {
    toggleGen('generation-2');
}

function toggleGen3() {
    toggleGen('generation-3');
}

function toggleGen4() {
    toggleGen('generation-4');
}

function toggleGen5() {
    toggleGen('generation-5');
}

function toggleGen6() {
    toggleGen('generation-6');
}

function toggleGen7() {
    toggleGen('generation-7');
}

function toggleGen8() {
    toggleGen('generation-8');
}

function toggleGen9() {
    toggleGen('generation-9');
}

function toggleHome() {
    toggleGen('home');
}

/* For when its needed
function toggleNew() {
    toggleGen('');
}

function toggleInProgress() {
    toggleGen('');
}

function toggleCompleted() {
    toggleGen('');
}
*/